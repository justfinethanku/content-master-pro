import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { supabase } from "../lib/supabase.js";

const NATE_USER_ID = process.env.NATE_USER_ID;

function generateProjectId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100); // 3-digit random
  return `${date}_${seq}`;
}

function generateAssetId(
  projectId: string,
  assetType: string,
  platform?: string,
  variant?: string
): string {
  const parts = [projectId, assetType];
  if (platform) parts.push(platform);
  if (variant) parts.push(variant);
  return parts.join("_");
}

export function registerWriteTools(server: McpServer) {
  // ─── create_project ──────────────────────────────────────────────────────

  server.registerTool(
    "create_project",
    {
      title: "Create Project",
      description:
        'Create a new content project. Starts in "draft" status. Returns the created project with its ID.',
      inputSchema: {
        name: z.string().describe("Project name/title"),
        scheduled_date: z
          .string()
          .optional()
          .describe("Optional scheduled date (YYYY-MM-DD format)"),
        notes: z.string().optional().describe("Optional project notes"),
        target_platforms: z
          .array(z.string())
          .optional()
          .describe('Optional target platforms (e.g., ["youtube", "substack"])'),
      },
    },
    async ({ name, scheduled_date, notes, target_platforms }) => {
      if (!NATE_USER_ID) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: NATE_USER_ID environment variable is not set. Cannot create projects without a user ID.",
            },
          ],
          isError: true,
        };
      }

      const projectId = generateProjectId();
      const metadata: Record<string, unknown> = {};
      if (notes) metadata.notes = notes;
      if (target_platforms) metadata.target_platforms = target_platforms;

      const { data, error } = await supabase
        .from("projects")
        .insert({
          project_id: projectId,
          name,
          status: "draft",
          scheduled_date: scheduled_date || null,
          metadata,
          created_by: NATE_USER_ID,
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation on project_id (rare)
        if (error.code === "23505") {
          const retryId = generateProjectId();
          const { data: retryData, error: retryError } = await supabase
            .from("projects")
            .insert({
              project_id: retryId,
              name,
              status: "draft",
              scheduled_date: scheduled_date || null,
              metadata,
              created_by: NATE_USER_ID,
            })
            .select()
            .single();

          if (retryError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error creating project: ${retryError.message}`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(retryData, null, 2) },
            ],
          };
        }

        return {
          content: [
            { type: "text" as const, text: `Error creating project: ${error.message}` },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ─── add_asset ───────────────────────────────────────────────────────────

  server.registerTool(
    "add_asset",
    {
      title: "Add Asset to Project",
      description:
        'Add a new asset (post draft, transcript, description, prompt kit, etc.) to an existing project. Starts in "draft" status.',
      inputSchema: {
        project_id: z
          .string()
          .uuid()
          .describe("The project UUID (from list_projects or create_project)"),
        name: z.string().describe("Asset name/title"),
        asset_type: z
          .string()
          .describe(
            'Type of asset: "post", "transcript", "description", "thumbnail", "promptkit", "guide", etc.'
          ),
        content: z.string().optional().describe("The asset content (text)"),
        platform: z
          .string()
          .optional()
          .describe(
            'Optional target platform: "youtube", "tiktok", "substack", etc.'
          ),
        variant: z
          .string()
          .optional()
          .describe('Optional variant identifier: "01", "02", "16x9", etc.'),
      },
    },
    async ({ project_id, name, asset_type, content, platform, variant }) => {
      // Verify the project exists
      const { data: project, error: projError } = await supabase
        .from("projects")
        .select("project_id")
        .eq("id", project_id)
        .single();

      if (projError || !project) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Project ${project_id} not found. Use list_projects or create_project first.`,
            },
          ],
          isError: true,
        };
      }

      const assetId = generateAssetId(
        project.project_id,
        asset_type,
        platform,
        variant
      );

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

      if (error) {
        // Handle duplicate asset_id
        if (error.code === "23505") {
          const retryAssetId = `${assetId}_${Date.now().toString(36)}`;
          const { data: retryData, error: retryError } = await supabase
            .from("project_assets")
            .insert({
              project_id,
              asset_id: retryAssetId,
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

          if (retryError) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error adding asset: ${retryError.message}`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(retryData, null, 2) },
            ],
          };
        }

        return {
          content: [
            { type: "text" as const, text: `Error adding asset: ${error.message}` },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
