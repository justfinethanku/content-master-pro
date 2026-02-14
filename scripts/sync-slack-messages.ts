/**
 * Slack Message Sync Script
 *
 * Scrapes raw messages from a Slack channel into the slack_messages table.
 * 100% verbatim — no AI processing, no transformation.
 *
 * Usage:
 *   npx tsx scripts/sync-slack-messages.ts                  # Incremental sync (since last synced)
 *   npx tsx scripts/sync-slack-messages.ts --backfill       # Full channel history
 *   npx tsx scripts/sync-slack-messages.ts --dry-run        # Preview without writing
 *   npx tsx scripts/sync-slack-messages.ts --limit 50       # Cap at N messages
 *   npx tsx scripts/sync-slack-messages.ts --backfill --dry-run --limit 10
 *
 * Cron (every 6 hours):
 *   0 *​/6 * * * cd /path/to/content-master-pro && npx tsx scripts/sync-slack-messages.ts >> /tmp/slack-sync.log 2>&1
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as path from "path";

// Load environment variables
config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C0AB4V6DTDM";

// Rate limiting: Slack Tier 3 = 50 req/min → 1.2s between calls
const RATE_LIMIT_MS = 1200;
const BATCH_SIZE = 200;
const APP_SETTINGS_CATEGORY = "slack_sync";
const APP_SETTINGS_KEY = "last_synced_ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlackMessage {
  type: string;
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  attachments?: SlackAttachment[];
  reactions?: SlackReaction[];
  blocks?: unknown[];
  files?: SlackFile[];
}

interface SlackAttachment {
  title?: string;
  text?: string;
  fallback?: string;
  from_url?: string;
  original_url?: string;
  image_url?: string;
  [key: string]: unknown;
}

interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

interface SlackFile {
  id: string;
  name: string;
  title: string;
  url_private: string;
  mimetype: string;
  size: number;
  [key: string]: unknown;
}

interface SlackUser {
  id: string;
  real_name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
  };
}

interface ConversationsHistoryResponse {
  ok: boolean;
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

interface ConversationsRepliesResponse {
  ok: boolean;
  messages: SlackMessage[];
  has_more: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

interface ConversationsInfoResponse {
  ok: boolean;
  channel?: {
    name: string;
    id: string;
  };
  error?: string;
}

interface UsersInfoResponse {
  ok: boolean;
  user?: SlackUser;
  error?: string;
}

interface DbMessage {
  channel_id: string;
  channel_name: string;
  message_ts: string;
  thread_ts: string | null;
  user_slack_id: string;
  user_display_name: string | null;
  text: string;
  links: { url: string; title?: string }[];
  attachments: unknown[];
  reactions: SlackReaction[];
  is_thread_parent: boolean;
  reply_count: number;
  posted_at: string;
}

// ─── CLI Args ────────────────────────────────────────────────────────────────

interface Args {
  backfill: boolean;
  dryRun: boolean;
  limit: number | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit: number | null = null;

  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (isNaN(limit) || limit <= 0) {
      console.error("❌ --limit must be a positive number");
      process.exit(1);
    }
  }

  return {
    backfill: args.includes("--backfill"),
    dryRun: args.includes("--dry-run"),
    limit,
  };
}

// ─── Slack API Helpers ───────────────────────────────────────────────────────

const userCache = new Map<string, string>();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function slackApi<T>(method: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Slack API ${method} HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as T;
  return data;
}

async function getChannelName(channelId: string): Promise<string> {
  const data = await slackApi<ConversationsInfoResponse>("conversations.info", {
    channel: channelId,
  });

  if (!data.ok || !data.channel) {
    console.warn(`⚠️  Could not resolve channel name for ${channelId}: ${data.error}`);
    return channelId; // Fallback to ID
  }

  return data.channel.name;
}

async function resolveUserName(userId: string): Promise<string | null> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    const data = await slackApi<UsersInfoResponse>("users.info", { user: userId });
    await sleep(RATE_LIMIT_MS);

    if (!data.ok || !data.user) {
      userCache.set(userId, userId);
      return null;
    }

    const displayName =
      data.user.profile?.display_name ||
      data.user.profile?.real_name ||
      data.user.real_name ||
      userId;

    userCache.set(userId, displayName);
    return displayName;
  } catch (err) {
    console.warn(`⚠️  Could not resolve user ${userId}: ${err}`);
    userCache.set(userId, userId);
    return null;
  }
}

function extractLinks(message: SlackMessage): { url: string; title?: string }[] {
  const links: { url: string; title?: string }[] = [];

  // Extract URLs from message text using Slack's <url|label> format
  const urlPattern = /<(https?:\/\/[^>|]+)(?:\|([^>]*))?>/g;
  let match;
  while ((match = urlPattern.exec(message.text)) !== null) {
    links.push({ url: match[1], title: match[2] || undefined });
  }

  // Extract from attachments
  if (message.attachments) {
    for (const att of message.attachments) {
      if (att.from_url) links.push({ url: att.from_url, title: att.title });
      if (att.original_url && att.original_url !== att.from_url) {
        links.push({ url: att.original_url, title: att.title });
      }
    }
  }

  return links;
}

function slackTsToIso(ts: string): string {
  const epochSeconds = parseFloat(ts);
  return new Date(epochSeconds * 1000).toISOString();
}

// ─── Fetch Messages ──────────────────────────────────────────────────────────

async function fetchChannelHistory(
  channelId: string,
  oldest?: string,
  limit?: number | null
): Promise<SlackMessage[]> {
  const allMessages: SlackMessage[] = [];
  let cursor: string | undefined;
  let page = 0;

  do {
    const params: Record<string, string> = {
      channel: channelId,
      limit: "200", // Max per page
    };
    if (oldest) params.oldest = oldest;
    if (cursor) params.cursor = cursor;

    const data = await slackApi<ConversationsHistoryResponse>(
      "conversations.history",
      params
    );

    if (!data.ok) {
      throw new Error(`conversations.history failed: ${data.error}`);
    }

    // Filter to actual user messages (skip join/leave, channel_purpose, etc.)
    const userMessages = data.messages.filter(
      (m) => m.type === "message" && m.user && !m.text?.startsWith("<@") // Skip bot-like system messages
    );

    allMessages.push(...userMessages);
    page++;
    console.log(`   Page ${page}: ${userMessages.length} messages (${allMessages.length} total)`);

    if (limit && allMessages.length >= limit) {
      return allMessages.slice(0, limit);
    }

    cursor = data.response_metadata?.next_cursor || undefined;
    if (cursor) await sleep(RATE_LIMIT_MS);
  } while (cursor);

  return limit ? allMessages.slice(0, limit) : allMessages;
}

async function fetchThreadReplies(
  channelId: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const allReplies: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      channel: channelId,
      ts: threadTs,
      limit: "200",
    };
    if (cursor) params.cursor = cursor;

    const data = await slackApi<ConversationsRepliesResponse>(
      "conversations.replies",
      params
    );

    if (!data.ok) {
      throw new Error(`conversations.replies failed for ${threadTs}: ${data.error}`);
    }

    // Skip the first message (it's the parent, which we already have)
    const replies = data.messages.filter((m) => m.ts !== threadTs);
    allReplies.push(...replies);

    cursor = data.response_metadata?.next_cursor || undefined;
    if (cursor) await sleep(RATE_LIMIT_MS);
  } while (cursor);

  return allReplies;
}

// ─── Transform & Upsert ─────────────────────────────────────────────────────

function transformMessage(
  msg: SlackMessage,
  channelId: string,
  channelName: string,
  displayName: string | null
): DbMessage {
  return {
    channel_id: channelId,
    channel_name: channelName,
    message_ts: msg.ts,
    thread_ts: msg.thread_ts && msg.thread_ts !== msg.ts ? msg.thread_ts : null,
    user_slack_id: msg.user || "unknown",
    user_display_name: displayName,
    text: msg.text,
    links: extractLinks(msg),
    attachments: msg.attachments || msg.files || [],
    reactions: msg.reactions || [],
    is_thread_parent: (msg.reply_count || 0) > 0,
    reply_count: msg.reply_count || 0,
    posted_at: slackTsToIso(msg.ts),
  };
}

async function upsertBatch(supabase: SupabaseClient, batch: DbMessage[]): Promise<number> {
  const { error } = await supabase
    .from("slack_messages")
    .upsert(batch, { onConflict: "channel_id,message_ts" });

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  return batch.length;
}

// ─── App Settings (last sync timestamp) ──────────────────────────────────────

async function getLastSyncedTs(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("category", APP_SETTINGS_CATEGORY)
    .eq("key", APP_SETTINGS_KEY)
    .single();

  if (error || !data) return null;

  // value is JSONB, stored as { "ts": "1234567890.123456" }
  const val = data.value as { ts?: string };
  return val.ts || null;
}

async function setLastSyncedTs(supabase: SupabaseClient, ts: string): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        category: APP_SETTINGS_CATEGORY,
        key: APP_SETTINGS_KEY,
        value: { ts },
        description: "Last synced Slack message timestamp for incremental sync",
      },
      { onConflict: "category,key" }
    );

  if (error) {
    console.warn(`⚠️  Could not update last_synced_ts: ${error.message}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { backfill, dryRun, limit } = parseArgs();
  const mode = backfill ? "BACKFILL" : "INCREMENTAL";

  console.log(`\n🔄 Slack Message Sync [${mode}]${dryRun ? " (DRY RUN)" : ""}${limit ? ` (limit: ${limit})` : ""}\n`);

  // Validate env
  if (!SLACK_BOT_TOKEN) {
    console.error("❌ SLACK_BOT_TOKEN is not set in .env.local");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Resolve channel name
  console.log(`📡 Channel: ${SLACK_CHANNEL_ID}`);
  const channelName = await getChannelName(SLACK_CHANNEL_ID);
  console.log(`   Name: #${channelName}`);
  await sleep(RATE_LIMIT_MS);

  // Determine starting point
  let oldest: string | undefined;
  if (!backfill) {
    const lastTs = await getLastSyncedTs(supabase);
    if (lastTs) {
      oldest = lastTs;
      console.log(`   Resuming from: ${lastTs} (${slackTsToIso(lastTs)})`);
    } else {
      console.log(`   No previous sync found — fetching all history`);
    }
  }

  // Fetch channel history
  console.log(`\n📥 Fetching messages...`);
  const messages = await fetchChannelHistory(SLACK_CHANNEL_ID, oldest, limit);
  console.log(`   Fetched ${messages.length} messages from channel`);

  if (messages.length === 0) {
    console.log("\n✅ No new messages to sync");
    return;
  }

  // Identify threads that need reply fetching
  const threadParents = messages.filter((m) => (m.reply_count || 0) > 0);
  console.log(`   ${threadParents.length} threads with replies to fetch`);

  // Fetch thread replies
  const threadReplies: SlackMessage[] = [];
  if (threadParents.length > 0) {
    console.log(`\n🧵 Fetching thread replies...`);
    for (let i = 0; i < threadParents.length; i++) {
      const parent = threadParents[i];
      const replies = await fetchThreadReplies(SLACK_CHANNEL_ID, parent.ts);
      threadReplies.push(...replies);
      console.log(`   Thread ${i + 1}/${threadParents.length}: ${replies.length} replies`);
      await sleep(RATE_LIMIT_MS);
    }
    console.log(`   Total thread replies: ${threadReplies.length}`);
  }

  // Combine all messages
  const allMessages = [...messages, ...threadReplies];

  // Deduplicate by ts (thread replies might overlap with channel messages)
  const seen = new Set<string>();
  const uniqueMessages = allMessages.filter((m) => {
    if (seen.has(m.ts)) return false;
    seen.add(m.ts);
    return true;
  });

  console.log(`\n👤 Resolving ${new Set(uniqueMessages.map((m) => m.user)).size} unique users...`);

  // Resolve all unique user IDs
  const uniqueUserIds = [...new Set(uniqueMessages.map((m) => m.user).filter(Boolean))];
  for (const userId of uniqueUserIds) {
    await resolveUserName(userId!);
  }
  console.log(`   Resolved ${userCache.size} users`);

  // Transform to DB format
  const dbMessages = uniqueMessages.map((msg) =>
    transformMessage(
      msg,
      SLACK_CHANNEL_ID,
      channelName,
      msg.user ? userCache.get(msg.user) || null : null
    )
  );

  if (dryRun) {
    console.log(`\n📋 Would upsert ${dbMessages.length} messages:\n`);
    dbMessages.slice(0, 10).forEach((m) => {
      const preview = m.text.substring(0, 80).replace(/\n/g, " ");
      console.log(`  [${m.posted_at}] ${m.user_display_name || m.user_slack_id}: ${preview}${m.text.length > 80 ? "..." : ""}`);
      if (m.thread_ts) console.log(`    └── reply to thread ${m.thread_ts}`);
    });
    if (dbMessages.length > 10) {
      console.log(`  ... and ${dbMessages.length - 10} more`);
    }
    return;
  }

  // Upsert in batches
  console.log(`\n⏳ Upserting ${dbMessages.length} messages in batches of ${BATCH_SIZE}...`);
  let totalUpserted = 0;

  for (let i = 0; i < dbMessages.length; i += BATCH_SIZE) {
    const batch = dbMessages.slice(i, i + BATCH_SIZE);
    const count = await upsertBatch(supabase, batch);
    totalUpserted += count;
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} messages`);
  }

  // Update last synced timestamp (use the most recent message_ts)
  const sortedByTs = dbMessages.sort((a, b) => parseFloat(b.message_ts) - parseFloat(a.message_ts));
  const latestTs = sortedByTs[0]?.message_ts;
  if (latestTs) {
    await setLastSyncedTs(supabase, latestTs);
    console.log(`   Updated last_synced_ts: ${latestTs}`);
  }

  console.log(`\n✅ Synced ${totalUpserted} messages from #${channelName}`);
  console.log(`   Channel messages: ${messages.length}`);
  console.log(`   Thread replies: ${threadReplies.length}`);
  console.log(`   Unique users: ${userCache.size}`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal error:`, err);
  process.exit(1);
});
