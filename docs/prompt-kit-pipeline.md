# Companion Asset Pipeline: CMP ↔ Prompt Kit Presenter

## Overview

Companion assets (prompt kits and guides) are AI-generated or manually created resources that accompany newsletter posts. They're created in Content Master Pro (CMP), stored in Supabase, and displayed publicly via the Prompt Kit Presenter app. Both apps share the same Supabase database — no sync mechanism needed.

```
CMP (create/edit/publish)
    ↓ writes to project_assets table
Supabase (shared database)
    ↑ direct pooler connection (read-only)
Prompt Kit Presenter (display)
    → promptkit.natebjones.com/{assetId}
```

## Asset Types

| Type | `asset_type` | Description | Presenter accent |
|------|-------------|-------------|------------------|
| Post | `post` | Newsletter content | N/A (not displayed on presenter) |
| Prompt Kit | `promptkit` | AI-generated prompts companion | Blue (`#4a6488`) |
| Guide | `guide` | Step-by-step walkthrough companion | Green (`#486847`) |

Both prompt kits and guides are **companion assets** — they live as siblings alongside a post within the same project.

## Data Model

### Tables

**`project_assets`** — stores all deliverables (posts, prompt kits, guides, etc.)
- `asset_type` identifies the type: `'post'`, `'promptkit'`, `'guide'`
- `asset_id` format: `{project_id}_{type}_{variant}` (e.g., `20260214_701_promptkit_1`, `20260213_3ox_guide_main`)
- `content` — full markdown content
- `status` — `draft | ready | review | final | published | archived`
- `version` — auto-incremented on updates

**`asset_versions`** — full snapshot history for every asset update

**`projects`** — parent table; each companion asset belongs to a project alongside its source post

### Asset Relationship

Companion assets are **sibling assets** within the same project:
```
Project (20260213_3ox)
  ├── post asset      (20260213_3ox_post_substack_main)
  ├── promptkit asset (20260213_3ox_promptkit_1)
  └── guide asset     (20260213_3ox_guide_main)
```

A project may have any combination: just a post, post + prompt kit, post + guide, or post + both.

## Creation Workflow (CMP)

### Prompt Kits
1. User creates/imports a post in the deliverables editor
2. Clicks **"Convert to Prompt Kit"** (optionally provides custom direction)
3. CMP calls the Edge Function with `prompt_slug: "prompt_kit_converter"`
4. AI generates the prompt kit (two-layer structure: human preamble + AI prompt in code block)
5. System creates a new `project_assets` row with `asset_type = 'promptkit'`
6. User can **regenerate** (updates content, increments version, creates snapshot)

### Guides
Guides are currently created manually or via external tooling and added as `asset_type = 'guide'` rows in `project_assets`. There is no AI converter for guides yet.

### Preamble Generation
When a post has companion assets (prompt kit and/or guide), the user can **Add Preamble** or **Regenerate Preamble**:

1. `handleAddPreamble` in the asset editor builds variables:
   - `content` — the post body (old preamble stripped if regenerating)
   - `resources_cta` — markdown CTA link(s) built from available companions:
     - Prompt kit only: `[Grab the prompts](link)`
     - Guide only: `[Read the guide](link)`
     - Both: `[Grab the prompts](link) · [Read the guide](link)`
   - `companion_resources` — full content of guide and/or prompt kit so the AI can describe what each covers
2. Calls Edge Function with `prompt_slug: "post_preamble_generator"` (v2)
3. AI generates a preamble (hook + summary referencing companion resources + bullet list + CTA)
4. System prepends preamble + `---` separator to the post content
5. Metadata stored: `preamble_added_at`, `prompt_kit_link`, `guide_link`, `resources_cta`

### Key Prompts (database-driven)
- `prompt_kit_converter` — converts post content into a production-ready prompt kit
- `post_preamble_generator` (v2) — generates hook + summary + CTA referencing companion resources. Template variables: `{{content}}`, `{{resources_cta}}`, `{{companion_resources}}`

### Companion Delete
When deleting a post asset, CMP also deletes all sibling prompt kits and guides (cascade via the asset editor's delete mutation, not DB FK cascade).

### CMP UI
- **Asset Editor**: `/deliverables/[id]/assets/[assetId]` — view/edit, version history, convert/regenerate buttons, side-by-side prompt kit panel, preamble generation
- **Project Detail**: `/deliverables/[id]` — asset card grid with color-coded tints (green=guide, blue=promptkit, neutral=post)
- **Deliverables List**: `/deliverables` — shows projects with asset type badges

### CMP Hooks (`src/hooks/use-deliverables.ts`)
- `useProjectAssetsByType(projectId, assetType)` — generic: fetch all assets of a type for a project
- `useProjectPromptKits(projectId)` — wrapper for `useProjectAssetsByType(id, "promptkit")`
- `useProjectGuides(projectId)` — wrapper for `useProjectAssetsByType(id, "guide")`
- `useCreatePromptKitAsset()` — create new prompt kit asset
- `useDeliverableAsset(assetId)` — fetch single asset by UUID

**Query key pattern**: `[...deliverableKeys.detail(projectId), "assets-by-type", assetType]`

## Display (Prompt Kit Presenter)

**Repo**: `/Users/jonathanedwards/AUTOMATION/SubStack/prompt-kit-presenter`
**Domain**: `promptkit.natebjones.com`
**Tech**: Next.js 16, Drizzle ORM, Tailwind CSS v4, react-markdown

### Architecture

- **No API routes** — purely a read-only frontend
- **Direct DB connection** via Drizzle ORM + Supabase transaction pooler
- **Same database** as CMP (project ID `uaiiskuioqirpcaliljh`)
- **Single env var**: `DATABASE_URL` (pooler connection string)

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/[assetId]` | Displays a prompt kit OR guide (e.g., `/20260211_001_promptkit_notion_01`) |
| `/executive/mcp` | MCP registration page for Executive Circle subscribers |

### Allowed Asset Types

The `[assetId]` route serves both `promptkit` and `guide` types. Other asset types return 404. Controlled by `ALLOWED_TYPES` array + `isAllowedType()` guard in the page component.

### Variant System

Both `PromptKitRenderer` and `CollapsibleCode` accept a `variant` prop (`"promptkit" | "guide"`):

| Aspect | Prompt Kit (`promptkit`) | Guide (`guide`) |
|--------|-------------------------|-----------------|
| Page heading | "Prompt Kit" | "Guide" |
| Background | Default body gradient (blue) | Green gradient overlay (`.guide-bg` div) |
| Collapsible header color | `#4a6488` (blue) | `#486847` (green) |
| Collapsible header text | "View & Copy Prompt" | "View & Copy Code" |
| Collapse threshold | 10 lines (+ `language-prompt` always) | 25 lines (no `language-prompt` override) |
| Typography | `prose-sm`, compact spacing | `prose` (larger), article-style spacing |
| Metadata title suffix | "— Prompt Kits" | "— Guides" |

### Query Pattern
```typescript
// src/app/[assetId]/page.tsx
await db
  .select({ name, content, status, updatedAt, assetType, projectName })
  .from(projectAssets)
  .innerJoin(projects, eq(projectAssets.projectId, projects.id))
  .where(and(
    eq(projectAssets.assetId, assetId),
    inArray(projectAssets.assetType, ["promptkit", "guide"])
  ))
  .limit(1);
```

### Rendering
- `react-markdown` + `remark-gfm` for markdown
- `` ```prompt `` fenced blocks → `CollapsibleCode` component (expandable with copy button) — prompt kit variant only
- Long code blocks (>threshold) also collapse
- Tailwind Typography styling, variant-aware

### Design
- Left-of-center content column (max 65ch)
- Right sidebar: social links + app links (desktop only)
- Theme toggle (light/dark) in top-right corner
- Disclaimer tooltip with usage terms
- Guide pages: fixed-position green gradient overlay div (`.guide-bg` in `globals.css`)

## MCP Access (Subscribers)

Executive Circle subscribers access prompt kits via MCP tools. Registration happens on the presenter; the MCP server lives in CMP.

### Registration Flow
```
Presenter (/executive/mcp)
    ↓ POST to CMP /api/subscriber/register (access code + name + email)
CMP validates access code, creates token in subscriber_mcp_access
    ↓ returns { token, connector_url }
Subscriber configures Claude Desktop / ChatGPT with connector_url
    ↓ MCP calls to CMP /api/mcp/subscriber/{token}
CMP subscriber-server.ts (read-only tools)
    ↓ queries project_assets + imported_posts
Supabase
```

### Subscriber MCP Tools (read-only)
| Tool | Description |
|------|-------------|
| `search_prompt_kits` | Keyword search (ILIKE on name + content), returns preview (500 chars) |
| `get_prompt_kit` | Full content by UUID |
| `list_prompt_kits` | All kits, ordered by created_at DESC, limit 50 |

### Rate Limits
120 requests/minute, 2,000 requests/day per subscriber.

## Cross-Repo Connection Points

| What | CMP (content-master-pro) | Presenter (prompt-kit-presenter) |
|------|--------------------------|----------------------------------|
| Database | Supabase client (server/browser/service) | Drizzle ORM (transaction pooler) |
| Tables used | All tables | `projects`, `project_assets` only |
| Access level | Full CRUD | Read-only |
| Companion assets | Create, edit, version, publish | Display published kits + guides |
| MCP registration | `/api/subscriber/register` endpoint | `/executive/mcp` UI (calls CMP API) |
| MCP server | `src/lib/mcp/subscriber-server.ts` | N/A |
| Hardcoded URL | N/A | `https://www.contentmasterpro.limited` (registration API) |

## Key Files

### CMP
| File | Purpose |
|------|---------|
| `src/hooks/use-deliverables.ts` | Asset CRUD hooks (prompt kits, guides, generic by-type) |
| `src/app/(dashboard)/deliverables/[id]/assets/[assetId]/page.tsx` | Asset editor with convert/regenerate UI, preamble generation |
| `src/app/(dashboard)/deliverables/[id]/page.tsx` | Project detail with color-coded asset cards |
| `src/lib/mcp/subscriber-server.ts` | MCP tools (search/get/list prompt kits) |
| `src/lib/mcp/server.ts` | Internal MCP with full CRUD |
| `src/app/api/subscriber/register/route.ts` | Registration endpoint |

### Presenter
| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema (projects, project_assets) |
| `src/db/index.ts` | DB client with pooler config |
| `src/app/[assetId]/page.tsx` | Dynamic asset display route (prompt kits + guides) |
| `src/app/globals.css` | `.guide-bg` green gradient overlay class |
| `src/components/prompt-kit-renderer.tsx` | Markdown renderer with variant-aware typography/collapse |
| `src/components/collapsible-code.tsx` | Expandable code block with variant colors/labels |
| `src/components/mcp-registration.tsx` | 3-step MCP registration flow |
