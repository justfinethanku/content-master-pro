import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AnySupabase } from "./server";

/**
 * Create a read-only MCP server for Executive Circle subscribers.
 * Exposes published posts and prompt kits — no write operations.
 */
export function createSubscriberMcpServer(supabase: AnySupabase): McpServer {
  const server = new McpServer(
    {
      name: "executive-circle",
      version: "1.0.0",
    },
    {
      instructions: `You are connected to the Executive Circle — a read-only content library from the "Limited Edition Jonathan" and Nate's Newsletter archives.

## What you can do

You have tools to:
- **Search published posts** across the newsletter archive by keyword
- **Read full post content** by ID
- **Browse recent posts** with pagination
- **Search prompt kits** — reusable prompt templates for content creation
- **Read full prompt kit content** by ID
- **List all prompt kits** available in the library

## Tips

- Search uses keyword matching. Keep terms short — one or two words work best.
- Try "prompt" instead of "prompting techniques for newsletters".
- All content is published/final — you won't see drafts or archived items.
- Use get_post or get_prompt_kit to read the full content after finding items via search.

## Limits

- This is a read-only connection. You cannot create, edit, or delete anything.
- Rate limits: 120 requests/minute, 2,000 requests/day.`,
    }
  );

  // ── search_posts ─────────────────────────────────────────────────────

  server.registerTool(
    "search_posts",
    {
      title: "Search Posts",
      description:
        "Search published newsletter posts by keyword. Searches title and content.",
      inputSchema: {
        query: z.string().describe("Search keywords"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max results"),
      },
    },
    async ({ query, limit }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select(
          "id, title, subtitle, url, author, published_at, content, tags"
        )
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      if (!data?.length)
        return {
          content: [
            {
              type: "text" as const,
              text: `No posts found matching "${query}"`,
            },
          ],
        };

      const results = data.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        url: p.url,
        author: p.author,
        published_at: p.published_at,
        tags: p.tags,
        content_preview:
          p.content?.substring(0, 300) +
          (p.content && p.content.length > 300 ? "..." : ""),
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(results, null, 2) },
        ],
      };
    }
  );

  // ── get_post ─────────────────────────────────────────────────────────

  server.registerTool(
    "get_post",
    {
      title: "Get Post",
      description:
        "Get the full content of a published post by its UUID. Use IDs from search_posts or list_recent_posts results.",
      inputSchema: {
        id: z.string().uuid().describe("Post UUID"),
      },
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select(
          "id, title, subtitle, url, author, published_at, content, tags, metadata"
        )
        .eq("id", id)
        .single();

      if (error)
        return {
          content: [
            {
              type: "text" as const,
              text: `Post not found: ${error.message}`,
            },
          ],
          isError: true,
        };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  // ── list_recent_posts ────────────────────────────────────────────────

  server.registerTool(
    "list_recent_posts",
    {
      title: "List Recent Posts",
      description:
        "Browse the most recent published posts, ordered by publish date.",
      inputSchema: {
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max results"),
        offset: z
          .number()
          .min(0)
          .default(0)
          .describe("Number of posts to skip (for pagination)"),
      },
    },
    async ({ limit, offset }) => {
      const { data, error } = await supabase
        .from("imported_posts")
        .select(
          "id, title, subtitle, url, author, published_at, tags"
        )
        .order("published_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      if (!data?.length)
        return {
          content: [{ type: "text" as const, text: "No posts found." }],
        };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  // ── search_prompt_kits ───────────────────────────────────────────────

  server.registerTool(
    "search_prompt_kits",
    {
      title: "Search Prompt Kits",
      description: "Search prompt kit assets by keyword.",
      inputSchema: {
        query: z.string().describe("Search keywords"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max results"),
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
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      if (!data?.length)
        return {
          content: [
            {
              type: "text" as const,
              text: `No prompt kits found matching "${query}"`,
            },
          ],
        };

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
        content: [
          { type: "text" as const, text: JSON.stringify(results, null, 2) },
        ],
      };
    }
  );

  // ── get_prompt_kit ───────────────────────────────────────────────────

  server.registerTool(
    "get_prompt_kit",
    {
      title: "Get Prompt Kit",
      description:
        "Get the full content of a prompt kit by its UUID. Use IDs from search_prompt_kits or list_prompt_kits results.",
      inputSchema: {
        id: z.string().uuid().describe("Prompt kit UUID"),
      },
    },
    async ({ id }) => {
      const { data, error } = await supabase
        .from("project_assets")
        .select(
          "id, asset_id, name, asset_type, content, status, metadata, created_at, updated_at"
        )
        .eq("id", id)
        .eq("asset_type", "promptkit")
        .single();

      if (error)
        return {
          content: [
            {
              type: "text" as const,
              text: `Prompt kit not found: ${error.message}`,
            },
          ],
          isError: true,
        };
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  // ── list_prompt_kits ─────────────────────────────────────────────────

  server.registerTool(
    "list_prompt_kits",
    {
      title: "List Prompt Kits",
      description: "List all available prompt kits.",
      inputSchema: {
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(50)
          .describe("Max results"),
      },
    },
    async ({ limit }) => {
      const { data, error } = await supabase
        .from("project_assets")
        .select("id, asset_id, name, status, metadata, created_at")
        .eq("asset_type", "promptkit")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error)
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      if (!data?.length)
        return {
          content: [{ type: "text" as const, text: "No prompt kits found." }],
        };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    }
  );

  return server;
}
