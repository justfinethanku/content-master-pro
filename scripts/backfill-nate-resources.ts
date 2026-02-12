/**
 * Backfill Nate's Resource Content as Project Assets
 *
 * For each post asset in the DB, extracts Notion and Google Docs URLs
 * from the markdown content, matches them to scraped resource files
 * in nate_substack/data/resources/, and inserts each as a project_asset
 * (type: promptkit or guide) linked to the parent project.
 *
 * Usage:
 *   npx tsx scripts/backfill-nate-resources.ts --dry-run   # Preview
 *   npx tsx scripts/backfill-nate-resources.ts              # Execute
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 50;

const RESOURCES_DIR =
  "/Users/jonathanedwards/AUTOMATION/SubStack/nate_substack/data/resources";

// ----- Types -----

interface ResourceMeta {
  url: string;
  domain: string;
  link_text: string;
  source_post: Record<string, unknown>;
  extracted_at: string;
  content_length: number;
  method: string;
}

interface PostAsset {
  id: string;
  project_id: string;
  asset_id: string;
  name: string;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ExtractedLink {
  url: string;
  text: string;
  normalizedKey: string;
  domain: string;
  resourceType: "notion" | "gdoc" | "gsheet" | "gdrive" | "other";
}

interface ScrapedResource {
  meta: ResourceMeta;
  textContent: string;
  filename: string;
}

// ----- URL Normalization -----

function normalizeUrl(url: string): { type: string; key: string } {
  // Notion: extract 32-char hex UUID
  const notionMatch = url.match(/([a-f0-9]{32})\b/);
  if (notionMatch && url.includes("notion")) {
    return { type: "notion", key: notionMatch[1] };
  }

  // Google Docs/Sheets: extract doc ID
  const docMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && url.includes("google.com")) {
    const dtype = url.includes("spreadsheets") ? "gsheet" : "gdoc";
    return { type: dtype, key: docMatch[1] };
  }

  // Google Drive
  if (url.includes("drive.google.com")) {
    const driveMatch = url.match(/\/(?:folders|d)\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return { type: "gdrive", key: driveMatch[1] };
    }
  }

  return { type: "other", key: url };
}

function normalizedKeyString(url: string): string {
  const { type, key } = normalizeUrl(url);
  return `${type}:${key}`;
}

function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

// ----- Helpers -----

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase credentials in .env.local");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function findUserId(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 5 });
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  if (!data.users || data.users.length === 0) {
    throw new Error("No users found");
  }
  const user = data.users[0];
  console.log(`Using user: ${user.email} (${user.id})`);
  return user.id;
}

async function batchInsert(
  supabase: ReturnType<typeof createClient>,
  table: string,
  records: Record<string, unknown>[],
) {
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(
        `Error inserting batch into ${table} at offset ${i}:`,
        error.message,
      );
      console.error(
        `  First record:`,
        JSON.stringify(batch[0]).slice(0, 300),
      );
      throw error;
    }
    inserted += batch.length;
  }
  return inserted;
}

// ----- Resource Loading -----

function loadScrapedResources(): Map<string, ScrapedResource> {
  const resources = new Map<string, ScrapedResource>();

  const jsonFiles = fs
    .readdirSync(RESOURCES_DIR)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json");

  for (const jsonFile of jsonFiles) {
    try {
      const metaPath = path.join(RESOURCES_DIR, jsonFile);
      const txtPath = path.join(
        RESOURCES_DIR,
        jsonFile.replace(".json", ".txt"),
      );

      const meta: ResourceMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

      // Skip if no corresponding text file
      if (!fs.existsSync(txtPath)) continue;

      const textContent = fs.readFileSync(txtPath, "utf-8");

      // Skip empty or tiny content
      if (textContent.length < 100) continue;

      const key = normalizedKeyString(meta.url);
      resources.set(key, {
        meta,
        textContent,
        filename: jsonFile.replace(".json", ""),
      });
    } catch {
      // Skip malformed files
    }
  }

  return resources;
}

function extractLinksFromContent(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  // Match markdown links: [text](url)
  const linkRegex =
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:notion\.(?:so|site)|docs\.google\.com)[^\)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const text = match[1];
    let url = match[2].replace(/[).,;]+$/, "");

    const { type } = normalizeUrl(url);
    const domain = getDomain(url);

    links.push({
      url,
      text,
      normalizedKey: normalizedKeyString(url),
      domain,
      resourceType: type as ExtractedLink["resourceType"],
    });
  }

  // Also match bare URLs (not in markdown link syntax)
  const bareNotionRegex =
    /(?<!\()(?<!\])\b(https?:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s\)\">\]]+)/g;
  const bareGdocsRegex =
    /(?<!\()(?<!\])\b(https?:\/\/docs\.google\.com\/(?:document|spreadsheets)\/d\/[^\s\)\">\]]+)/g;

  for (const regex of [bareNotionRegex, bareGdocsRegex]) {
    while ((match = regex.exec(content)) !== null) {
      let url = match[1].replace(/[).,;]+$/, "");
      const key = normalizedKeyString(url);

      // Skip if already found as a markdown link
      if (links.some((l) => l.normalizedKey === key)) continue;

      const { type } = normalizeUrl(url);
      const domain = getDomain(url);

      links.push({
        url,
        text: url, // No link text for bare URLs
        normalizedKey: key,
        domain,
        resourceType: type as ExtractedLink["resourceType"],
      });
    }
  }

  return links;
}

function determineAssetType(link: ExtractedLink): "promptkit" | "guide" | null {
  // Notion product-templates → promptkit
  if (
    link.resourceType === "notion" &&
    link.url.includes("product-templates")
  ) {
    return "promptkit";
  }

  // Other Notion pages → promptkit (most Nate's Notion content is prompt packs)
  if (link.resourceType === "notion") {
    return "promptkit";
  }

  // Google Docs → guide
  if (link.resourceType === "gdoc") {
    return "guide";
  }

  // Google Sheets → guide (spreadsheet templates)
  if (link.resourceType === "gsheet") {
    return "guide";
  }

  // Google Drive → skip
  if (link.resourceType === "gdrive") {
    return null;
  }

  return null;
}

function determinePlatform(link: ExtractedLink): string {
  if (link.resourceType === "notion") return "notion";
  if (link.resourceType === "gdoc" || link.resourceType === "gsheet")
    return "gdocs";
  return "other";
}

// ----- Main -----

async function main() {
  console.log("=== Nate Resources Backfill ===");
  console.log(DRY_RUN ? "** DRY RUN — no database writes **\n" : "");

  // 1. Load scraped resources
  console.log("Loading scraped resources...");
  const scrapedResources = loadScrapedResources();
  console.log(`  Loaded ${scrapedResources.size} scraped resources\n`);

  // 2. Query all post assets from DB
  const supabase = getSupabase();

  console.log("Querying post assets from DB...");
  const { data: postAssets, error: queryError } = await supabase
    .from("project_assets")
    .select("id,project_id,asset_id,name,content,metadata,created_at")
    .eq("asset_type", "post")
    .order("asset_id", { ascending: true });

  if (queryError) {
    throw new Error(`Failed to query posts: ${queryError.message}`);
  }

  console.log(`  Found ${postAssets!.length} post assets\n`);

  // 2b. Query existing resource assets to skip duplicates
  console.log("Checking existing resource assets...");
  const { data: existingAssets } = await supabase
    .from("project_assets")
    .select("asset_id, published_url")
    .in("asset_type", ["promptkit", "guide"]);

  const existingUrls = new Set<string>();
  // Track max counter per project+type+platform prefix to avoid asset_id collisions
  const existingCounters = new Map<string, number>();
  if (existingAssets) {
    for (const a of existingAssets) {
      if (a.published_url) {
        existingUrls.add(normalizedKeyString(a.published_url));
      }
      // Parse counter from asset_id like "20251002_001_promptkit_notion_04"
      const counterMatch = a.asset_id.match(
        /^(\d{8}_\d{3}_\w+_\w+)_(\d+)$/,
      );
      if (counterMatch) {
        const prefix = counterMatch[1];
        const counter = parseInt(counterMatch[2], 10);
        const current = existingCounters.get(prefix) ?? 0;
        if (counter > current) existingCounters.set(prefix, counter);
      }
    }
  }
  console.log(`  Found ${existingUrls.size} existing resource assets\n`);

  // 3. Extract resource links and match to scraped content
  console.log("Extracting resource links from post content...");

  // Track which normalized keys we've already created assets for (dedup)
  const createdKeys = new Set<string>();

  const assetRecords: Record<string, unknown>[] = [];

  let matchedCount = 0;
  let unmatchedCount = 0;
  let skippedDupeCount = 0;
  let skippedTypeCount = 0;
  let skippedExistingCount = 0;

  for (const post of postAssets as PostAsset[]) {
    if (!post.content) continue;

    const links = extractLinksFromContent(post.content);
    if (links.length === 0) continue;

    // Extract date part from asset_id
    // Handles both "20251002_001_post" and "20260211_nate_post_substack_main"
    const dateMatch = post.asset_id.match(/^(\d{8})_(\d{3}|nate)/);
    if (!dateMatch) continue;

    const dateStr = dateMatch[1]; // YYYYMMDD
    const postCounter = dateMatch[2] === "nate" ? "001" : dateMatch[2];
    const publishDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    // Track counters per type+platform prefix within this post
    const postCounters = new Map<string, number>();

    for (const link of links) {
      // Skip Google Drive
      const assetType = determineAssetType(link);
      if (!assetType) {
        skippedTypeCount++;
        continue;
      }

      // Skip if already in DB from a previous run
      if (existingUrls.has(link.normalizedKey)) {
        skippedExistingCount++;
        continue;
      }

      // Dedup: only create one asset per unique resource URL
      if (createdKeys.has(link.normalizedKey)) {
        skippedDupeCount++;
        continue;
      }

      // Match to scraped content
      const scraped = scrapedResources.get(link.normalizedKey);
      if (!scraped) {
        unmatchedCount++;
        continue;
      }

      matchedCount++;
      createdKeys.add(link.normalizedKey);

      const platform = determinePlatform(link);
      const prefix = `${dateStr}_${postCounter}_${assetType}_${platform}`;

      // Get next counter, accounting for existing DB assets
      const existingMax = existingCounters.get(prefix) ?? 0;
      const currentMax = postCounters.get(prefix) ?? existingMax;
      const nextCounter = currentMax + 1;
      postCounters.set(prefix, nextCounter);

      const counterStr = String(nextCounter).padStart(2, "0");
      const assetId = `${prefix}_${counterStr}`;
      const assetUuid = crypto.randomUUID();

      const wordCount = scraped.textContent.split(/\s+/).filter(Boolean).length;

      // Determine a good name — skip generic anchor text
      const genericTexts = new Set([
        "here",
        "this",
        "link",
        "click here",
        "this link",
        "download",
        "get it here",
        "grab it here",
        "full response",
        "the full thing",
        "prompt",
        "grab the prompt",
        "grab the prompt.",
        "grab the prompts",
        "grab the prompts.",
        "grab the prompts!",
        "grab them here",
        "grab it",
        "grab the prompt pack",
        "sample here",
      ]);
      const genericPatterns = [
        /\bis here\b/i,
        /\bfull .+ here\b/i,
        /^grab the prompts?[.!]?$/i,
        /^here['\u2019]?s the (?:full )?prompt$/i,
        /^it['\u2019]?s right here$/i,
        /^you can (?:see|get|find) /i,
        /^yes[, ]/i,
        /^prepped /i,
        /^prompt$/i,
      ];
      const linkTextLower = (link.text || "").toLowerCase().trim();
      const linkTextUsable =
        link.text &&
        link.text !== link.url &&
        !genericTexts.has(linkTextLower) &&
        !genericPatterns.some((p) => p.test(linkTextLower));

      let name: string;
      if (linkTextUsable) {
        name = link.text;
      } else if (
        scraped.meta.link_text &&
        scraped.meta.link_text !== scraped.meta.url &&
        !genericTexts.has(scraped.meta.link_text.toLowerCase().trim()) &&
        !genericPatterns.some((p) =>
          p.test(scraped.meta.link_text.toLowerCase().trim()),
        )
      ) {
        name = scraped.meta.link_text;
      } else {
        // Try extracting title from content first line (Google Docs have titles)
        const contentLines = scraped.textContent
          .replace(/^\uFEFF/, "") // strip BOM
          .split("\n")
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0);

        // Skip ChatGPT reasoning lines and generic/short titles
        const titleLine = contentLines.find(
          (l: string) =>
            l.length > 5 &&
            l.length < 120 &&
            !/^(Got it|Okay|Sure|Let me|I'll |I will|Alright)/i.test(l) &&
            !genericTexts.has(l.toLowerCase().trim()) &&
            !genericPatterns.some((p) => p.test(l.toLowerCase().trim())),
        );

        if (titleLine) {
          name = titleLine;
        } else {
          // Extract a readable name from Notion URL slug
          const slugMatch = link.url.match(
            /\/([A-Za-z][A-Za-z0-9-]+)-[a-f0-9]{32}/,
          );
          if (slugMatch) {
            name = slugMatch[1].replace(/-/g, " ");
          } else {
            name = `${assetType === "promptkit" ? "Prompt Pack" : "Guide"} Resource`;
          }
        }
      }

      assetRecords.push({
        id: assetUuid,
        project_id: post.project_id,
        asset_id: assetId,
        name,
        asset_type: assetType,
        platform,
        variant: "main",
        content: scraped.textContent,
        version: 1,
        status: "published",
        published_url: link.url,
        published_at: `${publishDate}T12:00:00Z`,
        metadata: {
          word_count: wordCount,
          source_post_slug: post.asset_id,
          link_text: link.text,
          content_length: scraped.textContent.length,
          domain: link.domain,
          source: "backfill-nate-resources",
        },
        created_at: `${publishDate}T12:00:00Z`,
        updated_at: `${publishDate}T12:00:00Z`,
      });

    }
  }

  // 4. Summary
  console.log(`\nLink extraction results:`);
  console.log(`  Matched to scraped content: ${matchedCount}`);
  console.log(`  No scraped content found:   ${unmatchedCount}`);
  console.log(`  Skipped (already in DB):    ${skippedExistingCount}`);
  console.log(`  Skipped (duplicate URL):    ${skippedDupeCount}`);
  console.log(`  Skipped (unsupported type): ${skippedTypeCount}`);
  console.log();

  // Breakdown by type
  const byType: Record<string, number> = {};
  for (const r of assetRecords) {
    const t = r.asset_type as string;
    byType[t] = (byType[t] || 0) + 1;
  }
  console.log(`Assets to create:`);
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`  Total: ${assetRecords.length}`);
  console.log();

  // Show all records (or samples)
  const verbose = process.argv.includes("--verbose");
  const displayRecords = verbose ? assetRecords : assetRecords.slice(0, 10);
  console.log(verbose ? "All records:" : "Sample records (use --verbose for all):");
  for (const r of displayRecords) {
    console.log(
      `  ${r.asset_id} — [${r.asset_type}] "${(r.name as string).slice(0, 60)}"`,
    );
  }
  if (!verbose && assetRecords.length > 10) {
    console.log(`  ... and ${assetRecords.length - 10} more`);
  }
  console.log();

  if (DRY_RUN) {
    console.log("Dry run complete. No data written.");
    return;
  }

  if (assetRecords.length === 0) {
    console.log("No assets to insert.");
    return;
  }

  // 5. Insert
  console.log("Inserting project assets...");
  const assetCount = await batchInsert(
    supabase,
    "project_assets",
    assetRecords,
  );
  console.log(`  Inserted ${assetCount} assets`);

  // 6. Verify
  console.log("\nVerifying...");
  const { data: typeCounts } = await supabase
    .from("project_assets")
    .select("asset_type")
    .limit(1000);

  if (typeCounts) {
    const types: Record<string, number> = {};
    for (const r of typeCounts) {
      types[r.asset_type] = (types[r.asset_type] || 0) + 1;
    }
    console.log("Asset types in DB:");
    for (const [t, c] of Object.entries(types).sort()) {
      console.log(`  ${t}: ${c}`);
    }
  }

  console.log("\n=== Backfill complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
