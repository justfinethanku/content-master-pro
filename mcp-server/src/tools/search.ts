import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../lib/supabase.js";

export function registerSearchTools(server: McpServer) {
  // ─── search_nate_posts ───────────────────────────────────────────────────

  server.registerTool(
    "search_nate_posts",
    {
      title: "Search Nate's Posts",
      description:
        "Search Nate's published newsletter posts by keyword. Searches title and content. Returns title, subtitle, URL, published date, and a content preview.",
      inputSchema: {
        query: z.string().describe("Search query (keywords to match in title or content)"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max results to return (default: 20)"),
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

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error searching posts: ${error.message}` }],
          isError: true,
        };
      }

      if (!data || data.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No posts found matching "${query}"` }],
        };
      }

      const results = data.map((post) => ({
        id: post.id,
        title: post.title,
        subtitle: post.subtitle,
        url: post.url,
        author: post.author,
        published_at: post.published_at,
        tags: post.tags,
        content_preview:
          post.content?.substring(0, 300) +
          (post.content && post.content.length > 300 ? "..." : ""),
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // ─── get_post ────────────────────────────────────────────────────────────

  server.registerTool(
    "get_post",
    {
      title: "Get Post by ID",
      description:
        "Get the full content of a specific post by its ID. Use after searching to read the complete text.",
      inputSchema: {
        id: z.string().uuid().describe("The post UUID"),
      },
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select("id, title, subtitle, url, author, published_at, content, tags, metadata")
        .eq("id", id)
        .single();

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching post: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── get_asset ───────────────────────────────────────────────────────────

  server.registerTool(
    "get_asset",
    {
      title: "Get Asset Content",
      description:
        "Get the full content of a project asset by its UUID. Use this to read the complete text of a post draft, prompt kit, transcript, or any other asset. Use asset UUIDs from get_project results.",
      inputSchema: {
        id: z.string().uuid().describe("Asset UUID (the 'id' field from get_project or add_asset results)"),
      },
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("project_assets")
        .select("id, asset_id, name, asset_type, platform, variant, status, version, content, metadata, created_at, updated_at, project_id")
        .eq("id", id)
        .single();

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Asset not found: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── search_prompt_kits ──────────────────────────────────────────────────

  server.registerTool(
    "search_prompt_kits",
    {
      title: "Search Prompt Kits",
      description:
        "Search prompt kits (project assets of type 'promptkit'). Searches name and content.",
      inputSchema: {
        query: z
          .string()
          .describe("Search query (keywords to match in name or content)"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max results to return (default: 20)"),
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

      if (error) {
        return {
          content: [
            { type: "text" as const, text: `Error searching prompt kits: ${error.message}` },
          ],
          isError: true,
        };
      }

      if (!data || data.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No prompt kits found matching "${query}"` },
          ],
        };
      }

      const results = data.map((pk) => ({
        id: pk.id,
        asset_id: pk.asset_id,
        name: pk.name,
        status: pk.status,
        content_preview:
          pk.content?.substring(0, 500) +
          (pk.content && pk.content.length > 500 ? "..." : ""),
        created_at: pk.created_at,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // ─── search_slack_messages ───────────────────────────────────────────────

  server.registerTool(
    "search_slack_messages",
    {
      title: "Search Slack Messages",
      description:
        "Search raw Slack messages from the content-ideas channel. Returns who said it, when, and the full message text.",
      inputSchema: {
        query: z.string().describe("Search query (keywords to match in message text)"),
        channel_name: z
          .string()
          .optional()
          .describe("Optional: filter by channel name (default: all channels)"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(50)
          .describe("Max results to return (default: 50)"),
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

      if (channel_name) {
        q = q.eq("channel_name", channel_name);
      }

      const { data, error } = await q;

      if (error) {
        return {
          content: [
            { type: "text" as const, text: `Error searching Slack messages: ${error.message}` },
          ],
          isError: true,
        };
      }

      if (!data || data.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No Slack messages found matching "${query}"` },
          ],
        };
      }

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

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // ─── get_slack_thread ────────────────────────────────────────────────────

  server.registerTool(
    "get_slack_thread",
    {
      title: "Get Slack Thread",
      description:
        "Get a Slack thread — the parent message and all replies. Use after finding an interesting message to see the full conversation.",
      inputSchema: {
        message_ts: z
          .string()
          .describe("The message_ts of the parent message (from search results)"),
        channel_id: z
          .string()
          .optional()
          .describe("Optional channel_id filter (default: searches all channels)"),
      },
    },
    async ({ message_ts, channel_id }) => {
      // Get the parent message
      let parentQuery = supabase
        .from("slack_messages")
        .select("*")
        .eq("message_ts", message_ts);

      if (channel_id) parentQuery = parentQuery.eq("channel_id", channel_id);

      const { data: parent, error: parentError } = await parentQuery.single();

      if (parentError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching thread parent: ${parentError.message}`,
            },
          ],
          isError: true,
        };
      }

      // Get all replies
      let repliesQuery = supabase
        .from("slack_messages")
        .select("*")
        .eq("thread_ts", message_ts)
        .order("posted_at", { ascending: true });

      if (channel_id) repliesQuery = repliesQuery.eq("channel_id", channel_id);

      const { data: replies, error: repliesError } = await repliesQuery;

      if (repliesError) {
        return {
          content: [
            { type: "text" as const, text: `Error fetching replies: ${repliesError.message}` },
          ],
          isError: true,
        };
      }

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

      return {
        content: [{ type: "text" as const, text: JSON.stringify(thread, null, 2) }],
      };
    }
  );

  // ─── list_projects ───────────────────────────────────────────────────────

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description:
        "List existing content projects. Optionally filter by status. Shows project name, status, scheduled date, and metadata.",
      inputSchema: {
        status: z
          .enum([
            "draft",
            "in_progress",
            "review",
            "scheduled",
            "published",
            "archived",
          ])
          .optional()
          .describe("Optional: filter by project status"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max results to return (default: 20)"),
      },
    },
    async ({ status, limit }) => {
      let q = supabase
        .from("projects")
        .select(
          "id, project_id, name, status, scheduled_date, metadata, created_at, updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (status) {
        q = q.eq("status", status);
      }

      const { data, error } = await q;

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error listing projects: ${error.message}` }],
          isError: true,
        };
      }

      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: status
                ? `No projects found with status "${status}"`
                : "No projects found",
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
