# Codex 5.3 Analysis Prompt: Asset Type & Platform Refactor

## Instructions for Codex

You are analyzing a Next.js 16 codebase called **Content Master Pro** — a personal content creation platform. Your job is to produce a **comprehensive, leave-no-stone-unturned implementation plan** for moving hardcoded asset type and platform values into database-driven configuration, and then adding a generic "Add Asset" button to the project detail page.

**Do not write code.** Produce only the analysis and plan.

---

## Context

### What the app does
Content Master Pro transforms brain dumps into multi-platform deliverables for a Substack newsletter. Projects contain multiple **assets** — a post, a prompt kit, a guide, a thumbnail, etc. — each optionally tagged with a **platform** (substack, linkedin, twitter, etc.).

### Data model
The `project_assets` table has free-text columns for `asset_type` and `platform` — no database enums. The asset ID naming convention is `{project_id}_{type}_{platform}_{variant}` (e.g., `20260214_701_post_substack_main`). This is flexible by design.

### The problem
Despite the flexible data model, the **UI and MCP tool descriptions have hardcoded lists** of asset types and platforms scattered across multiple files. This violates the project's Rule 1: "No Hardcoded Values — any value that might change must be configurable (database, env var, or config file)."

### The goal
1. Create `app_settings` entries for asset types and platforms as the **single source of truth**
2. Update all hardcoded references to read from `app_settings`
3. Add a generic "Add Asset" button to the project detail page
4. **Nothing breaks** — all existing functionality continues working identically

---

## Known Hardcoded Locations

### File 1: `src/lib/mcp/server.ts`

**Lines 69-70** — MCP tool instructions (free-text description string):
```
   - Asset types: post, transcript, description, thumbnail, promptkit, guide
   - Set platform when relevant: substack, youtube, tiktok, linkedin, twitter
```

**Line 462** — `add_asset` tool input schema description:
```typescript
asset_type: z.string().describe("Type: post, transcript, description, thumbnail, promptkit, guide"),
```

### File 2: `src/hooks/use-deliverables.ts`

**Line 263** — `useCreateProject` hardcodes the initial asset as `post` + `substack`:
```typescript
const assetId = `${projectId}_post_substack_main`;
// ...
asset_type: "post",
```

**Lines 291-354** — `useCreatePromptKitAsset` is a specialized hook hardcoded to `asset_type: "promptkit"`:
```typescript
asset_type: "promptkit",
// asset_id pattern: `${project.project_id}_promptkit_${suffix}`
```

### File 3: `src/components/calendar/project-card.tsx`

**Lines 53-65** — Display label mapping is a hardcoded object:
```typescript
const ASSET_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  transcript: "Script",
  description: "Description",
  thumbnail: "Thumbnail",
  transcript_youtube: "YT Script",
  transcript_tiktok: "TT Script",
  description_youtube: "YT Desc",
  description_tiktok: "TT Desc",
  prompts: "Prompts",
  promptkit: "Prompt Kit",
  guide: "Guide",
  post_linkedin: "LinkedIn",
  post_substack: "Substack",
  image_substack: "Image",
};
```

### File 4: `src/app/(dashboard)/settings/page.tsx`

**Line 72** — Default output formats hardcoded:
```typescript
default_output_formats: ["substack", "youtube", "tiktok"],
```

### File 5: `src/app/(dashboard)/thumbnails/page.tsx`

**Line 286** — Hardcodes `asset_type: "thumbnail"` when saving generated images.

### File 6: `src/app/(dashboard)/deliverables/[id]/assets/[assetId]/page.tsx`

**Lines 205-210** — Prompt kit detection hardcoded:
```typescript
const isPromptKit = asset.asset_type === "promptkit";
const { data: promptKits = [] } = useProjectPromptKits(
  isPromptKit ? null : projectId
);
```

### File 7: `src/lib/mcp/subscriber-server.ts`

**Lines 214, 271, 312** — Subscriber MCP tools filter by `asset_type = "promptkit"` (these are correct — they're querying for a specific type, not defining the list of types).

---

## Existing Infrastructure

### `app_settings` table
Already used for other configuration. Structure:
- `id` (UUID)
- `category` (text) — groups related settings
- `key` (text) — setting name within category
- `value` (JSONB) — stored as `{ "value": <actual_value> }`
- `description` (text)

Settings are loaded in the settings page (`/settings`) and by the Edge Function. The pattern is:
```typescript
const { data } = await supabase
  .from("app_settings")
  .select("*")
  .eq("category", "some_category")
  .eq("key", "some_key")
  .single();
const actualValue = data.value.value;
```

### `useCreateAsset()` hook
A **generic** asset creation hook already exists in `src/hooks/use-assets.ts` (lines 82-103). It accepts any `ProjectAssetInsert` including arbitrary `asset_type` and `platform`. The thumbnails page already uses it. This is the hook the new "Add Asset" button should use.

### Project detail page
Lives at `src/app/(dashboard)/deliverables/[id]/page.tsx`. Currently lists assets in a grid but has **no "Add Asset" button**. When empty, shows "No assets yet."

---

## What I Need From You

Analyze every file listed above (and any others you discover) and produce:

### 1. Database Schema
- Exact `app_settings` rows to insert (category, key, value structure, description)
- Consider: should asset types include display labels? Should platforms include display labels? Should there be a "default" flag?
- Consider the `ASSET_TYPE_LABELS` mapping in project-card.tsx — this maps compound keys like `transcript_youtube` to labels. How should this be represented in app_settings?

### 2. Migration SQL
- The exact SQL INSERT statements for the new `app_settings` rows
- Any indexes or constraints needed

### 3. Shared Data Loading
- Where should the settings be loaded and cached? (React context? TanStack Query hook? Utility function?)
- The MCP server runs server-side — it needs access too
- The Edge Function loads settings from `app_settings` already — does it need these?
- Consider: should there be a `useAssetTypeConfig()` hook that other hooks and components consume?

### 4. File-by-File Changes
For EVERY file that needs modification, specify:
- Exact lines to change
- What the current code does
- What it should do instead
- Any new imports needed
- Risk assessment (what could break?)

### 5. New "Add Asset" UI
- Component design for the "Add Asset" dialog on the project detail page
- How to populate the type and platform dropdowns from app_settings
- Default selections (substack post)
- Required vs optional fields
- How the asset_id is auto-generated from the selections

### 6. Edge Cases & Risks
- What happens if app_settings rows are missing? (fallback values?)
- What about the MCP tool descriptions — they're free-text strings, not UI dropdowns. How do we keep them in sync?
- The `ASSET_TYPE_LABELS` mapping includes compound keys (`transcript_youtube`). Is this a type+platform combo or a distinct type? How should this be handled?
- The `useCreateProject` hook creates a default `post_substack_main` asset. Should this still be hardcoded as the default, or configurable?
- What about existing data — do any database records need updating?

### 7. Testing Plan
- What to test manually after the refactor
- Any automated tests to add or update

### 8. Implementation Order
- Step-by-step order of operations that minimizes risk
- Which changes can be done in parallel vs sequentially
- Suggested PR/commit boundaries

---

## Constraints

- **Next.js 16** with App Router
- **Supabase** (PostgreSQL) with RLS
- **TanStack Query** for client-side data fetching (1-min stale time)
- **shadcn/ui** component library
- No breaking changes to existing functionality
- The MCP servers (both internal and subscriber) must continue working
- The calendar view must continue displaying asset type badges correctly
- The existing "Convert to Prompt Kit" and "Add Prompt Kit" buttons on the asset editor page should keep working
- Follow existing patterns in the codebase (query key factories, Supabase client patterns, etc.)
