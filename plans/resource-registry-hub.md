# Resource Registry / Tools Hub

## Status: Draft — Awaiting Kaleab's Review

**Created:** 2026-03-09
**Author:** Jon (via Claude)
**Reviewer:** Kaleab

---

## The Problem

Everything in CMP today is a **project asset** — content that belongs to a newsletter issue. Posts, prompt kits, guides, transcripts, thumbnails — all live inside a parent project.

But the team needs to share **standalone resources** that don't belong to any newsletter:

- Claude Skills packages (downloadable `.md` or `.zip` files)
- Standalone guides and templates (not tied to a post)
- Video walkthroughs (embedded media, not just text)
- Reusable prompt sets
- Reference docs, checklists, editorial policies

Today there's no place for these. The `project_assets` table requires a parent project, content is stored as text in Postgres (no file support), and there's no concept of standalone downloadable/viewable resources.

## What Exists Today

### Storage Buckets
| Bucket | Type | Status |
|--------|------|--------|
| `generated-images` | Public | Active — AI-generated thumbnails |
| `voice-memos` | Private | Abandoned — bucket exists but feature was dropped |

### Asset Storage
- All content (posts, prompt kits, guides) → markdown text in `project_assets.content` column
- `project_assets.file_url` column exists but is **unused**
- No file upload/download flow exists anywhere in the app
- Presenter reads text directly from Postgres via Drizzle ORM

### Auth / Permissions
- RLS policies currently allow **all authenticated users** full CRUD on projects and assets
- No roles, no permissions table, no RBAC
- `profiles` table has a `role` column but it's not enforced anywhere

---

## Proposed Solution: Resource Registry

Build a **resource library** alongside the existing project/asset system. Projects and assets stay exactly as they are. The registry is a new, parallel system for standalone resources.

### Mental Model

```
EXISTING (unchanged)                    NEW
────────────────────                    ────────────────────
Projects → Assets                       Resource Registry
  "AI Prompting 101"                      Claude Skills Package
    ├── Post                              Workflow Template
    ├── Prompt Kit                        Video: How to Use CMP
    ├── Guide                             Reference: Voice Guide
    └── Thumbnail                         Reusable Prompt Set
```

### Key Principles

1. **Database for metadata, storage for files** — Postgres tracks what resources exist (title, tags, versions, relationships). Supabase Storage holds the actual files.
2. **Text resources can live in both places** — A markdown guide gets its content in the DB (for rendering on the presenter) AND optionally as a downloadable file in storage.
3. **Binary resources only live in storage** — Videos, zips, images are referenced by path. DB stores metadata only.
4. **Single source of truth** — No Vimeo, no external hosting. Everything in our Supabase instance.
5. **RBAC from day one** — Multi-user team needs role-based access control now, not later.

---

## Database Schema

### New Tables

#### `resources`
The catalog card for each resource in the library.

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- url-friendly identifier (e.g., "gemini-summary-skill")
  title TEXT NOT NULL,
  description TEXT,                        -- short description for cards/search results
  resource_type TEXT NOT NULL,             -- skill, guide, template, reference, video, prompt_set, checklist
  content TEXT,                            -- markdown content (for text resources, enables presenter rendering)
  storage_path TEXT,                       -- path in Supabase Storage (for downloadable/binary resources)
  mime_type TEXT,                          -- file type (application/zip, video/mp4, text/markdown, etc.)
  file_size INTEGER,                       -- bytes
  thumbnail_url TEXT,                      -- optional preview image
  is_published BOOLEAN DEFAULT false,      -- visible to non-admin users?
  is_downloadable BOOLEAN DEFAULT true,    -- show download button?
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_resources_type ON resources(resource_type);
CREATE INDEX idx_resources_slug ON resources(slug);
CREATE INDEX idx_resources_published ON resources(is_published) WHERE is_published = true;
CREATE INDEX idx_resources_created_by ON resources(created_by);
```

**Why both `content` and `storage_path`?**
- A markdown guide: `content` has the text (for rendering on presenter/in-app), `storage_path` has the `.md` file (for download)
- A video: `content` is NULL, `storage_path` points to the video file
- A Claude Skills package: `content` has a README/description, `storage_path` has the `.zip`

#### `resource_versions`
Version history — every update creates a snapshot.

```sql
CREATE TABLE resource_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT,                            -- snapshot of content at this version
  storage_path TEXT,                       -- snapshot of file path at this version
  file_size INTEGER,
  changelog TEXT,                          -- what changed in this version
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_id, version)
);

CREATE INDEX idx_resource_versions_resource ON resource_versions(resource_id);
CREATE INDEX idx_resource_versions_created ON resource_versions(created_at DESC);
```

#### `tags`
Reusable tags shared across resources.

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,               -- lowercase, e.g., "gemini", "summarization", "youtube"
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `resource_tags`
Many-to-many join between resources and tags.

```sql
CREATE TABLE resource_tags (
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

CREATE INDEX idx_resource_tags_tag ON resource_tags(tag_id);
```

#### `resource_relations` (optional — could defer)
Links between related resources ("this skill has a companion guide").

```sql
CREATE TABLE resource_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,             -- companion, prerequisite, alternative, see_also
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX idx_resource_relations_source ON resource_relations(source_id);
CREATE INDEX idx_resource_relations_target ON resource_relations(target_id);
```

### New Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false);
-- Private bucket — access via signed URLs only
```

**Path convention:**
```
resources/{resource_id}/v{version}/{filename}
```
Example: `resources/a1b2c3d4/v1/claude-summary-skill.zip`

### RBAC Tables

```sql
-- Roles table (could also use app_settings, but a dedicated table is cleaner)
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',     -- admin, editor, viewer
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- Seed: make Jon and Kaleab admins
-- Other team members start as editors or viewers
```

**Role definitions:**
| Role | Resources | Projects/Assets | Admin |
|------|-----------|-----------------|-------|
| `admin` | Full CRUD, publish, manage versions | Full CRUD | Manage roles, settings |
| `editor` | Create, edit own, view all | Full CRUD | No |
| `viewer` | View published, download | View only | No |

**RLS approach:** Enforce via RLS policies on the `resources` table using `user_roles.role`. This is more robust than application-level checks.

---

## Implementation Phases

### Phase 1: Foundation (Schema + Storage + RBAC)
- [ ] Create migration for all new tables (`resources`, `resource_versions`, `tags`, `resource_tags`, `user_roles`)
- [ ] Create `resources` storage bucket with RLS policies
- [ ] Implement RBAC — RLS policies on `resources` table based on `user_roles`
- [ ] Seed `user_roles` for existing team members
- [ ] Add `resource_type` options to `app_settings` (configurable, like asset types)
- [ ] **Defer:** `resource_relations` table (build it when we have enough resources to relate)

### Phase 2: API + Hooks
- [ ] API routes: `GET/POST /api/resources`, `GET/PATCH/DELETE /api/resources/[id]`
- [ ] API route: `POST /api/resources/[id]/upload` — generates signed upload URL
- [ ] API route: `GET /api/resources/[id]/download` — generates signed download URL
- [ ] TanStack Query hooks: `useResources()`, `useResource(id)`, `useCreateResource()`, `useUpdateResource()`, `useDeleteResource()`
- [ ] Version hooks: `useResourceVersions(id)`, `useCreateResourceVersion()`
- [ ] Tag hooks: `useTags()`, `useCreateTag()`, `useResourceTags(id)`

### Phase 3: CMP UI — Library Section
- [ ] New sidebar item: "Library" (or "Tools Hub")
- [ ] Library index page: card grid with search, type filter, tag filter
- [ ] Resource detail page: view content, download file, see version history, related resources
- [ ] Resource editor: create/edit resources, upload files, manage tags
- [ ] Admin: role management UI (assign viewer/editor/admin to team members)

### Phase 4: Presenter Integration
- [ ] New presenter route for standalone resources (not just project-tied prompt kits)
- [ ] Embedded video player for video resources (HTML5 `<video>` with signed URL)
- [ ] Download button for binary resources
- [ ] Rendered markdown for text resources (same as current prompt kit rendering)

### Phase 5: MCP / Subscriber Access
- [ ] Add `search_resources` and `get_resource` tools to subscriber MCP server
- [ ] Respect `is_published` flag — subscribers only see published resources
- [ ] Rate limit applies same as existing tools

### Phase 6 (Future): Search + Discovery
- [ ] Full-text search on `resources.title`, `resources.description`, `resources.content`
- [ ] Pinecone embeddings for semantic search across resources
- [ ] "Related resources" section on resource detail page (requires `resource_relations`)
- [ ] Resource activity feed ("New: Claude Skills Package v2.0 uploaded")

---

## How This Connects to Existing Systems

### What Stays the Same
- Projects and assets — unchanged
- Prompt kit / guide companion workflow — unchanged
- Presenter's existing `/{assetId}` route — unchanged
- MCP subscriber tools for posts and prompt kits — unchanged
- `generated-images` bucket — unchanged

### What's New
- `resources` storage bucket (private, signed URLs)
- Resource registry tables in Postgres
- RBAC via `user_roles` table (benefits the whole app, not just resources)
- New CMP sidebar section
- New presenter routes for standalone resources
- New MCP tools for resource discovery

### Migration Path for Existing Content
Some things currently stored as project assets might want to *also* live in the registry (e.g., a prompt kit that's both a companion to a post AND a standalone downloadable). We have two options:

1. **Dual existence** — The resource registry entry links to the project asset via metadata. Content stays in `project_assets`, registry just points to it.
2. **Copy on publish** — When promoting a project asset to the registry, copy the content. They become independent.

Recommendation: Start with option 2 (copy on publish). It's simpler, avoids cross-system dependencies, and the content diverging over time is actually a feature (the standalone version might get updated independently).

---

## Open Questions for Kaleab

1. **RBAC scope:** Should RBAC apply to the whole app (projects + resources) or just resources for now? Applying it app-wide is cleaner but more migration work since current RLS is "all authenticated users = full access."

2. **Resource relations:** Build the `resource_relations` table in Phase 1 (your original recommendation) or defer until we have enough resources to make it useful?

3. **Upload flow:** You recommended signed upload URLs (frontend → storage direct). Agreed. Any preference on chunk size / multipart for larger video files?

4. **Video hosting:** The plan calls for Supabase Storage for videos (HTML5 player, signed URLs). For short walkthrough videos this should be fine. Do you foresee issues with larger/longer videos that would push us toward a CDN or transcoding layer?

5. **Tag management:** Free-form tags (users type whatever) vs. predefined tag vocabulary (admin maintains a list)? Leaning toward predefined to avoid tag soup, but open to your take.

6. **Presenter auth:** Currently the presenter is fully public (anyone with a URL can view). Should resource pages on the presenter require authentication, or is `is_published` gating enough?

---

## Files That Would Change

### New Files
- `supabase/migrations/YYYYMMDD_resource_registry.sql` — all new tables
- `supabase/migrations/YYYYMMDD_resource_storage.sql` — storage bucket + policies
- `supabase/migrations/YYYYMMDD_user_roles.sql` — RBAC tables + seed
- `src/hooks/use-resources.ts` — TanStack Query hooks
- `src/hooks/use-tags.ts` — Tag management hooks
- `src/app/api/resources/` — API routes
- `src/app/(dashboard)/library/` — UI pages
- `src/components/library/` — Resource cards, editor, filters

### Modified Files
- `src/components/sidebar.tsx` — Add "Library" nav item
- `src/lib/types.ts` — Add Resource, ResourceVersion, Tag types
- `src/lib/mcp/subscriber-server.ts` — Add resource search/get tools
- `CLAUDE.md` — Document new tables, routes, patterns
