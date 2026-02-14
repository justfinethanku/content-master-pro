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
  const server = new McpServer({
    name: "content-master-pro",
    version: "1.0.0",
  });

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
      description: "Get the full content of a specific post by its ID.",
      inputSchema: { id: z.string().uuid().describe("Post UUID") },
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select("id, title, subtitle, url, author, published_at, content, tags, metadata")
        .eq("id", id)
        .single();

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
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
          current_version: 1,
          metadata: {},
        })
        .select()
        .single();

      if (error)
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}
