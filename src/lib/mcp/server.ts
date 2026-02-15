import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = SupabaseClient<any, any, any>;

/**
 * Create a service-role Supabase client for MCP operations.
 */
export function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Create an MCP server with all registered tools.
 */
export function createMcpServer(
  supabase: AnySupabase,
  userId: string
): McpServer {
  const server = new McpServer(
    {
      name: "content-master-pro",
      version: "1.0.0",
    },
    {
      instructions: `You are connected to Content Master Pro — Jon's content creation platform for the "Limited Edition Jonathan" Substack and related newsletters.

## What you can do

You have tools to:
- **Browse recent ideas** from the #content-ideas Slack channel (links, summaries, discussion threads)
- **Search Nate's newsletter archive** (411+ posts) to find cross-linking opportunities
- **Search prompt kits** — reusable prompt templates stored as project assets
- **Manage projects** — create projects, add assets (drafts, transcripts, descriptions, etc.), update and version assets
- **Read full post content** (from Nate's archive) and Slack threads for deep context
- **Get project details** — view a project and all its assets

When the user first connects or asks what you can do, give a brief overview of these capabilities.

## Idea discovery

When the user asks about recent ideas, what's been shared, or what to write about next:
1. Use search_slack_messages to find recent messages from #content-ideas. Default to the last few days unless the user specifies a longer range. Use broad search terms or search for common patterns.
2. For each idea, present: the **link** that was shared (from the "links" array in results), a **one-sentence summary** of the idea, and a **brief take** on the angle or opportunity.
3. If a message has replies (reply_count > 0), use get_slack_thread to pull in the discussion — there's often valuable context in the thread.
4. Sort by recency. If there are many results, group them by theme.

## Cross-linking with Nate's posts

When the user is working on a draft or exploring a topic:
1. Proactively use search_nate_posts with relevant keywords from the current topic.
2. Surface 2-5 related posts from Nate's archive that the user could link to, with title, URL, and a brief note on how it connects.
3. Do this without being asked — cross-linking is a core part of the workflow.

Search uses ILIKE keyword matching, so use short terms: "prompt" not "prompting techniques for newsletters". Try multiple searches with different keywords to cast a wide net.

## Creating a project

The full flow for creating content:
1. **create_project** — Give it a descriptive name. Returns a project with a UUID (the "id" field) and a human-readable project_id like "20260214_701".
2. **add_asset** — Add one or more assets to the project. Use the project's UUID "id" (not "project_id") as the project_id parameter.
   - Asset types: post, transcript, description, thumbnail, promptkit, guide
   - Set platform when relevant: substack, youtube, tiktok, linkedin, twitter
   - Set variant for multiple versions of the same type: "01", "02", "16x9", "9x16"
   - Each asset starts at version 1 in "draft" status.

## Updating and versioning assets

When the user revises content:
1. Use **update_asset** with the asset's UUID. Provide the new content and a brief change_description of what changed.
2. The tool automatically increments the version number and saves a snapshot in version history.
3. You can also update the asset's status: draft → ready → review → final → published.
4. Always tell the user what version they're now on after an update.

## Important details

- All IDs are UUIDs. After creating a project or asset, save the returned "id" for subsequent calls.
- **Projects and posts are different things.** Use get_project for project UUIDs (from list_projects). Use get_post for archived post UUIDs (from search_nate_posts).
- Searches use ILIKE (case-insensitive keyword match). Keep search terms short — one or two words.
- Slack messages include a "links" array with URLs and titles that were shared in the message.
- When presenting search results, always include URLs so the user can click through.`,
    },
  );

  // ── search_nate_posts ──────────────────────────────────────────────────

  server.registerTool(
    "search_nate_posts",
    {
      title: "Search Nate's Posts",
      description:
        "Search Nate's published newsletter posts by keyword. Searches title and content.",
      inputSchema: {
        query: z.string().describe("Search keywords"),
        limit: z.number().min(1).max(50).default(20).describe("Max results"),
      },
    },
    async ({ query, limit }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select("id, title, subtitle, url, author, published_at, content, tags")
        .eq("source", "nate_substack")
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      if (!data?.length)
        return { content: [{ type: "text" as const, text: `No posts found matching "${query}"` }] };

      const results = data.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        url: p.url,
        author: p.author,
        published_at: p.published_at,
        tags: p.tags,
        content_preview: p.content?.substring(0, 300) + (p.content && p.content.length > 300 ? "..." : ""),
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ── get_post ───────────────────────────────────────────────────────────

  server.registerTool(
    "get_post",
    {
      title: "Get Post by ID",
      description:
        "Get the full content of an imported/archived post (e.g. from Nate's newsletter) by its UUID. Use IDs from search_nate_posts results. NOT for projects — use get_project for those.",
      inputSchema: { id: z.string().uuid().describe("Post UUID from search_nate_posts results") },
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select("id, title, subtitle, url, author, published_at, content, tags, metadata")
        .eq("id", id)
        .single();

      if (error) {
        // Check if the ID exists in projects instead
        const { data: project } = await supabase
          .from("projects")
          .select("id, name")
          .eq("id", id)
          .maybeSingle();

        if (project) {
          return {
            content: [
              {
                type: "text" as const,
                text: `That ID belongs to a project ("${project.name}"), not an archived post. Use the get_project tool instead.`,
              },
            ],
            isError: true,
          };
        }
        return { content: [{ type: "text" as const, text: `Post not found: ${error.message}` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── get_project ─────────────────────────────────────────────────────────

  server.registerTool(
    "get_project",
    {
      title: "Get Project Details",
      description:
        "Get a project and all its assets by the project's UUID. Use IDs from list_projects results.",
      inputSchema: { id: z.string().uuid().describe("Project UUID from list_projects results") },
    },
    async ({ id }) => {
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projErr)
        return { content: [{ type: "text" as const, text: `Project not found: ${projErr.message}` }], isError: true };

      const { data: assets } = await supabase
        .from("project_assets")
        .select("id, asset_id, name, asset_type, platform, variant, status, version, content, created_at, updated_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true });

      const result = {
        ...project,
        assets: (assets || []).map((a) => ({
          ...a,
          content_preview: a.content
            ? a.content.substring(0, 500) + (a.content.length > 500 ? "..." : "")
            : null,
          content: undefined,
        })),
        asset_count: (assets || []).length,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── search_prompt_kits ─────────────────────────────────────────────────

  server.registerTool(
    "search_prompt_kits",
    {
      title: "Search Prompt Kits",
      description: "Search prompt kit assets by keyword.",
      inputSchema: {
        query: z.string().describe("Search keywords"),
        limit: z.number().min(1).max(50).default(20).describe("Max results"),
      },
    },
    async ({ query, limit }) => {
      const { data, error } = await supabase
        .from("project_assets")
        .select("id, asset_id, name, content, status, metadata, created_at")
        .eq("asset_type", "promptkit")
        .or(`name.ilike.%${query}%,content.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      if (!data?.length)
        return { content: [{ type: "text" as const, text: `No prompt kits found matching "${query}"` }] };

      const results = data.map((pk) => ({
        id: pk.id,
        asset_id: pk.asset_id,
        name: pk.name,
        status: pk.status,
        content_preview: pk.content?.substring(0, 500) + (pk.content && pk.content.length > 500 ? "..." : ""),
        created_at: pk.created_at,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ── search_slack_messages ──────────────────────────────────────────────

  server.registerTool(
    "search_slack_messages",
    {
      title: "Search Slack Messages",
      description: "Search raw Slack messages from #content-ideas.",
      inputSchema: {
        query: z.string().describe("Search keywords"),
        channel_name: z.string().optional().describe("Filter by channel name"),
        limit: z.number().min(1).max(100).default(50).describe("Max results"),
      },
    },
    async ({ query, channel_name, limit }) => {
      let q = supabase
        .from("slack_messages")
        .select(
          "id, channel_name, message_ts, thread_ts, user_display_name, user_slack_id, text, links, reactions, is_thread_parent, reply_count, posted_at"
        )
        .ilike("text", `%${query}%`)
        .order("posted_at", { ascending: false })
        .limit(limit);

      if (channel_name) q = q.eq("channel_name", channel_name);
      const { data, error } = await q;

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      if (!data?.length)
        return { content: [{ type: "text" as const, text: `No messages found matching "${query}"` }] };

      const results = data.map((msg) => ({
        id: msg.id,
        channel: `#${msg.channel_name}`,
        author: msg.user_display_name || msg.user_slack_id,
        text: msg.text,
        posted_at: msg.posted_at,
        is_thread: !!msg.thread_ts,
        reply_count: msg.reply_count,
        links: msg.links,
        reactions: msg.reactions,
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ── get_slack_thread ───────────────────────────────────────────────────

  server.registerTool(
    "get_slack_thread",
    {
      title: "Get Slack Thread",
      description: "Get a Slack thread — parent message and all replies.",
      inputSchema: {
        message_ts: z.string().describe("Parent message_ts from search results"),
        channel_id: z.string().optional().describe("Optional channel_id filter"),
      },
    },
    async ({ message_ts, channel_id }) => {
      let parentQ = supabase.from("slack_messages").select("*").eq("message_ts", message_ts);
      if (channel_id) parentQ = parentQ.eq("channel_id", channel_id);
      const { data: parent, error: pErr } = await parentQ.single();
      if (pErr)
        return { content: [{ type: "text" as const, text: `Error: ${pErr.message}` }], isError: true };

      let repliesQ = supabase
        .from("slack_messages")
        .select("*")
        .eq("thread_ts", message_ts)
        .order("posted_at", { ascending: true });
      if (channel_id) repliesQ = repliesQ.eq("channel_id", channel_id);
      const { data: replies } = await repliesQ;

      const thread = {
        parent: {
          author: parent.user_display_name || parent.user_slack_id,
          text: parent.text,
          posted_at: parent.posted_at,
          reactions: parent.reactions,
        },
        replies: (replies || []).map((r: Record<string, unknown>) => ({
          author: (r.user_display_name as string) || (r.user_slack_id as string),
          text: r.text,
          posted_at: r.posted_at,
          reactions: r.reactions,
        })),
        reply_count: (replies || []).length,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(thread, null, 2) }] };
    }
  );

  // ── list_projects ──────────────────────────────────────────────────────

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "List content projects with optional status filter.",
      inputSchema: {
        status: z
          .enum(["draft", "in_progress", "review", "scheduled", "published", "archived"])
          .optional()
          .describe("Filter by status"),
        limit: z.number().min(1).max(50).default(20).describe("Max results"),
      },
    },
    async ({ status, limit }) => {
      let q = supabase
        .from("projects")
        .select("id, project_id, name, status, scheduled_date, metadata, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (status) q = q.eq("status", status);
      const { data, error } = await q;

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      if (!data?.length)
        return {
          content: [{ type: "text" as const, text: status ? `No projects with status "${status}"` : "No projects found" }],
        };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── create_project ─────────────────────────────────────────────────────

  server.registerTool(
    "create_project",
    {
      title: "Create Project",
      description: 'Create a new content project in "draft" status.',
      inputSchema: {
        name: z.string().describe("Project name/title"),
        scheduled_date: z.string().optional().describe("Scheduled date (YYYY-MM-DD)"),
        notes: z.string().optional().describe("Project notes"),
        target_platforms: z.array(z.string()).optional().describe("Target platforms"),
      },
    },
    async ({ name, scheduled_date, notes, target_platforms }) => {
      const now = new Date();
      const date = now.toISOString().slice(0, 10).replace(/-/g, "");
      const seq = String(Math.floor(Math.random() * 900) + 100);
      const projectId = `${date}_${seq}`;

      const metadata: Record<string, unknown> = {};
      if (notes) metadata.notes = notes;
      if (target_platforms) metadata.target_platforms = target_platforms;

      const { data, error } = await supabase
        .from("projects")
        .insert({ project_id: projectId, name, status: "draft", scheduled_date: scheduled_date || null, metadata, created_by: userId })
        .select()
        .single();

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── add_asset ──────────────────────────────────────────────────────────

  server.registerTool(
    "add_asset",
    {
      title: "Add Asset to Project",
      description: "Add an asset (post, transcript, promptkit, etc.) to a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        name: z.string().describe("Asset name/title"),
        asset_type: z.string().describe("Type: post, transcript, description, thumbnail, promptkit, guide"),
        content: z.string().optional().describe("Asset content (text)"),
        platform: z.string().optional().describe("Target platform"),
        variant: z.string().optional().describe("Variant identifier"),
      },
    },
    async ({ project_id, name, asset_type, content, platform, variant }) => {
      const { data: project, error: pErr } = await supabase
        .from("projects")
        .select("project_id")
        .eq("id", project_id)
        .single();

      if (pErr || !project)
        return { content: [{ type: "text" as const, text: `Project ${project_id} not found.` }], isError: true };

      const parts = [project.project_id, asset_type];
      if (platform) parts.push(platform);
      if (variant) parts.push(variant);
      const assetId = parts.join("_");

      const { data, error } = await supabase
        .from("project_assets")
        .insert({
          project_id,
          asset_id: assetId,
          name,
          asset_type,
          content: content || null,
          platform: platform || null,
          variant: variant || null,
          status: "draft",
          version: 1,
          metadata: {},
        })
        .select()
        .single();

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── update_asset ────────────────────────────────────────────────────────

  server.registerTool(
    "update_asset",
    {
      title: "Update Asset",
      description:
        "Update an existing asset's content, name, or status. Automatically increments the version and saves a snapshot to version history.",
      inputSchema: {
        asset_id: z.string().uuid().describe("Asset UUID (the 'id' field from add_asset or list results)"),
        content: z.string().optional().describe("New content (replaces existing)"),
        name: z.string().optional().describe("New asset name/title"),
        status: z
          .enum(["draft", "ready", "review", "final", "published", "archived"])
          .optional()
          .describe("New status"),
        change_description: z.string().optional().describe("Brief note on what changed (saved in version history)"),
      },
    },
    async ({ asset_id, content, name, status, change_description }) => {
      // Fetch current asset
      const { data: current, error: fetchErr } = await supabase
        .from("project_assets")
        .select("id, name, content, version, status")
        .eq("id", asset_id)
        .single();

      if (fetchErr || !current)
        return { content: [{ type: "text" as const, text: `Asset ${asset_id} not found.` }], isError: true };

      const newVersion = (current.version || 1) + 1;

      // Build update payload (only include provided fields)
      const updates: Record<string, unknown> = { version: newVersion };
      if (content !== undefined) updates.content = content;
      if (name !== undefined) updates.name = name;
      if (status !== undefined) updates.status = status;

      // Update the asset
      const { data: updated, error: updateErr } = await supabase
        .from("project_assets")
        .update(updates)
        .eq("id", asset_id)
        .select()
        .single();

      if (updateErr)
        return { content: [{ type: "text" as const, text: `Error updating asset: ${updateErr.message}` }], isError: true };

      // Save version snapshot
      const { error: versionErr } = await supabase
        .from("asset_versions")
        .insert({
          asset_id,
          version_number: newVersion,
          name: updated.name,
          content: updated.content,
          metadata: updated.metadata || {},
          change_description: change_description || null,
          created_by: userId,
        });

      if (versionErr) {
        // Non-fatal — the asset was updated, just the history entry failed
        console.error("Failed to save version snapshot:", versionErr.message);
      }

      const result = {
        ...updated,
        _version_saved: !versionErr,
        _change_description: change_description || null,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
