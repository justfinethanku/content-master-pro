# Prompt Kit Pipeline: CMP ↔ Prompt Kit Presenter

## Overview

Prompt kits are AI-generated companion assets for newsletter posts. They're created in Content Master Pro (CMP), stored in Supabase, and displayed publicly via the Prompt Kit Presenter app. Both apps share the same Supabase database — no sync mechanism needed.

```
CMP (create/edit/publish)
    ↓ writes to project_assets table
Supabase (shared database)
    ↑ direct pooler connection (read-only)
Prompt Kit Presenter (display)
    → promptkit.natebjones.com/{assetId}
```

## Data Model

### Tables

**`project_assets`** — stores all deliverables (posts, prompt kits, transcripts, etc.)
- `asset_type = 'promptkit'` identifies prompt kits
- `asset_id` format: `{project_id}_promptkit_{variant}` (e.g., `20260214_701_promptkit_1`)
- `content` — full markdown content
- `status` — `draft | ready | review | final | published | archived`
- `version` — auto-incremented on updates

**`asset_versions`** — full snapshot history for every asset update

**`projects`** — parent table; each prompt kit belongs to a project alongside its source post

### Asset Relationship

Prompt kits are **sibling assets** within the same project as their source post:
```
Project (20260214_701)
  ├── post asset (20260214_701_post_substack_01)
  └── promptkit asset (20260214_701_promptkit_1)
```

## Creation Workflow (CMP)

1. User creates/imports a post in the deliverables editor
2. Clicks **"Convert to Prompt Kit"** (optionally provides custom direction)
3. CMP calls the Edge Function with `prompt_slug: "prompt_kit_converter"`
4. AI generates the prompt kit (two-layer structure: human preamble + AI prompt in code block)
5. System creates a new `project_assets` row with `asset_type = 'promptkit'`
6. User can **regenerate** (updates content, increments version, creates snapshot)
7. User can **add preamble** to the source post linking to the prompt kit
8. User sets status to `published` when ready

### Key Prompts (database-driven)
- `prompt_kit_converter` — converts post content into a production-ready prompt kit
- `post_preamble_generator` — generates hook + summary + CTA for posts with companion kits

### CMP UI
- **Asset Editor**: `/deliverables/[id]/assets/[assetId]` — view/edit, version history, convert/regenerate buttons, side-by-side prompt kit panel
- **Deliverables List**: `/deliverables` — shows projects with asset type badges

### CMP Hooks (`src/hooks/use-deliverables.ts`)
- `useProjectPromptKits(projectId)` — fetch all prompt kits for a project
- `useCreatePromptKitAsset()` — create new prompt kit asset
- `useDeliverableAsset(assetId)` — fetch single asset by UUID

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
| `/[assetId]` | Displays a prompt kit (e.g., `/20260211_001_promptkit_notion_01`) |
| `/executive/mcp` | MCP registration page for Executive Circle subscribers |

### Query Pattern
```typescript
// src/app/[assetId]/page.tsx
await db
  .select({ name, content, status, updatedAt, projectName })
  .from(projectAssets)
  .innerJoin(projects, eq(projectAssets.projectId, projects.id))
  .where(and(
    eq(projectAssets.assetId, assetId),
    eq(projectAssets.assetType, "promptkit")
  ))
  .limit(1);
```

### Rendering
- `react-markdown` + `remark-gfm` for markdown
- ` ```prompt` fenced blocks → `CollapsibleCode` component (expandable with copy button)
- Long untagged code blocks (>10 lines) also treated as prompts (legacy fallback)
- Tailwind Typography styling

### Design
- Left-of-center content column (max 65ch)
- Right sidebar: social links + app links (desktop only)
- Theme toggle (light/dark) in top-right corner
- Disclaimer tooltip with usage terms

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
| Prompt kits | Create, edit, version, publish | Display published kits |
| MCP registration | `/api/subscriber/register` endpoint | `/executive/mcp` UI (calls CMP API) |
| MCP server | `src/lib/mcp/subscriber-server.ts` | N/A |
| Hardcoded URL | N/A | `https://www.contentmasterpro.limited` (registration API) |

## Key Files

### CMP
| File | Purpose |
|------|---------|
| `src/hooks/use-deliverables.ts` | Prompt kit CRUD hooks |
| `src/app/(dashboard)/deliverables/[id]/assets/[assetId]/page.tsx` | Asset editor with convert/regenerate UI |
| `src/lib/mcp/subscriber-server.ts` | MCP tools (search/get/list prompt kits) |
| `src/lib/mcp/server.ts` | Internal MCP with full CRUD |
| `src/app/api/subscriber/register/route.ts` | Registration endpoint |

### Presenter
| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema (projects, project_assets) |
| `src/db/index.ts` | DB client with pooler config |
| `src/app/[assetId]/page.tsx` | Dynamic prompt kit display route |
| `src/components/prompt-kit-renderer.tsx` | Markdown renderer with collapsible prompts |
| `src/components/mcp-registration.tsx` | 3-step MCP registration flow |
