# Content Routing System - Complete Status & Next Steps

> Written: Feb 16, 2026
> Branch: `feature/content-routing-system` (merged to main via PR #2)
> Last audit: Feb 21, 2026 (post-merge: asset config, Add Asset dialog, guide support, branding — routing unchanged)

---

## Table of Contents

1. [Current App State](#1-current-app-state)
2. [Environment Setup](#2-environment-setup)
3. [Routing System - What Works](#3-routing-system---what-works)
4. [Routing System - What's Broken](#4-routing-system---whats-broken)
5. [What Jonathan Changed](#5-what-jonathan-changed)
6. [Database Schema Map](#6-database-schema-map)
7. [Rebuild Plan](#7-rebuild-plan)
8. [New Features Plan](#8-new-features-plan)
9. [File Reference](#9-file-reference)
10. [Implementation Order](#10-implementation-order)

---

## 1. Current App State

### Sidebar Navigation (5 items; routing not in sidebar)

| Page | Feature | Status |
|------|---------|--------|
| `/calendar` | Content calendar with DnD, backlog panel | **Working** |
| `/deliverables` | Project CRUD, asset editor, Add Asset dialog, prompt kit converter | **Working** |
| `/roadmap` | Roadmap view | Likely works |
| `/mcp` | MCP server tools | Likely works |
| `/executive-mcp` | Exec Circle subscriber MCP | Likely works |

### Hidden Pages (accessible via direct URL)

#### Core Content Pipeline
| Page | Feature | Status |
|------|---------|--------|
| `/create` | Brain dump → themes | Likely works (uses `content_sessions`) |
| `/research` | Perplexity research | Likely works (uses `content_research`) |
| `/outline` | Outline generation | Likely works (uses `content_outlines`) |
| `/draft` | Draft generation | Likely works (uses `content_drafts`) |
| `/outputs` | Multi-platform outputs | Likely works (uses `content_outputs`) |
| `/dashboard` | Overview stats | May error (uses `any` types) |
| `/search` | Semantic search | Likely works (uses Pinecone) |
| `/history` | Session history | Likely works (uses `content_sessions`) |
| `/swipe` | News curation | Likely works (uses `changelog_items`) |
| `/captures` | Saved news items | Likely works (uses `swipe_captures`) |
| `/sync` | Newsletter sync | Likely works (uses `sync_manifests`) |
| `/settings` | User settings | Likely works |

#### Routing System Pages
| Page | Feature | Status |
|------|---------|--------|
| `/routing` | Dashboard overview | **BROKEN** (can throw `stats is undefined` at runtime; API/dashboard need defensive handling) |
| `/routing/ideas` | Ideas list + filters | **Works** |
| `/routing/calendar` | Routing calendar view | **Works** |
| `/routing/queues` | Evergreen queues | **BROKEN** (table dropped) |

#### Studio Configuration Pages
| Page | Feature | Status |
|------|---------|--------|
| `/studio/publications` | Publications CRUD | **Works** |
| `/studio/routing-rules` | Routing rules + reorder | **Works** |
| `/studio/scoring` | Scoring rubrics CRUD | **Works** |
| `/studio/tiers` | Tier thresholds edit | **Works** |
| `/studio/calendar-slots` | Calendar slots CRUD | **Works** |
| `/studio/prompts` | Prompt management | Likely works |
| `/studio/models` | AI model config | Likely works |
| `/studio/destinations` | Destinations config | Likely works |
| `/studio/logs` | AI call logs | Likely works |
| `/studio/test` | Prompt testing | Likely works |

#### Old Project Pages
| Page | Feature | Status |
|------|---------|--------|
| `/projects/[id]` | Project detail | **BROKEN** (queries `nate_content_projects`) |
| `/projects/new` | New project | **BROKEN** (inserts to `nate_content_projects`) |

---

## 2. Environment Setup

### Switching Between Local and Remote Database

The app uses `.env` file layering:

| File | Points To | Purpose |
|------|-----------|---------|
| `.env` | Remote production (`uaiiskuioqirpcaliljh.supabase.co`) | Base config |
| `.env.local` | Local Supabase (`127.0.0.1:54321`) | Overrides `.env` |

Next.js loads `.env` first, then `.env.local` overrides matching keys.

**To switch:**
```bash
# Switch to REMOTE (production database)
mv .env.local .env.local.bak

# Switch back to LOCAL (local Supabase)
mv .env.local.bak .env.local

# Then restart dev server
npm run dev
```

### Running Migrations Locally

Jonathan's migrations are already applied to remote production. Local is behind.

```bash
# See what would be applied
supabase db push --local --dry-run

# Apply Jonathan's migrations locally
supabase db push --local
```

**Pending local migrations:**
- `20260205100000_global_calendar_access.sql`
- `20260211000001_replace_nate_tables.sql` (DROPS 6 tables, creates new ones)
- `20260211000002_consolidate_to_two_tables.sql`
- `20260211000003_rename_assets_to_project_assets.sql`
- `20260211100000_open_rls_policies.sql`
- `20260211200000_prompt_kit_converter.sql`

**WARNING:** Running `20260211000001` locally will drop `evergreen_queues`, `project_routing`, `nate_asset_versions`, `nate_project_publications`, `nate_project_assets`, `nate_content_projects`. These are already gone from production.

### Supabase Project Info

- **Project ref:** `uaiiskuioqirpcaliljh`
- **Project name:** `content-master-pro`
- **Region:** West US (Oregon)
- **Link command:** `supabase link --project-ref uaiiskuioqirpcaliljh`

---

## 3. Routing System - What Works

### Configuration (All Working)

| Table | API Routes | Hooks | UI Page |
|-------|-----------|-------|---------|
| `publications` | GET/POST `/api/routing/config/publications`, GET/PATCH/DELETE `[id]` | `usePublications`, `useCreatePublication`, `useUpdatePublication`, `useDeletePublication` | `/studio/publications` |
| `routing_rules` | GET/POST `/api/routing/config/rules` (includes reorder), GET/PATCH/DELETE `[id]` | `useRoutingRules`, `useCreateRoutingRule`, `useUpdateRoutingRule`, `useDeleteRoutingRule`, `useReorderRoutingRules` | `/studio/routing-rules` |
| `scoring_rubrics` | GET/POST `/api/routing/config/rubrics`, GET/PATCH/DELETE `[id]` | `useScoringRubrics`, `useCreateScoringRubric`, `useUpdateScoringRubric`, `useDeleteScoringRubric` | `/studio/scoring` |
| `tier_thresholds` | GET `/api/routing/config/tiers`, PATCH `[id]` | `useTierThresholds`, `useUpdateTierThreshold` | `/studio/tiers` |
| `calendar_slots` | GET/POST `/api/routing/config/slots`, GET/PATCH/DELETE `[id]` | `useCalendarSlots`, `useCreateCalendarSlot`, `useUpdateCalendarSlot`, `useDeleteCalendarSlot` | `/studio/calendar-slots` |

### Core Routing Engine (Working)

| Module | File | Purpose |
|--------|------|---------|
| Router | `src/lib/routing/router.ts` | Evaluates conditions, matches rules, routes ideas |
| Scorer | `src/lib/routing/scorer.ts` | Calculates weighted scores, determines tier |
| Queries | `src/lib/routing/queries.ts` | All database operations (PARTIALLY broken for project/evergreen joins) |
| Types | `src/lib/routing/types.ts` | Internal type definitions |
| Index | `src/lib/routing/index.ts` | Public exports |

### Operational Features (Working)

| Feature | API Route | Hook |
|---------|----------|------|
| List routed ideas | GET `/api/routing/ideas` | `useRoutedIdeas(filters)` |
| Get single idea | GET `/api/routing/ideas/[id]` | n/a |
| Route an idea | POST `/api/routing/ideas/[id]/route` | `useRouteIdea()` |
| Score an idea | POST `/api/routing/ideas/[id]/score` | `useScoreIdea()` |
| Schedule an idea | POST `/api/routing/ideas/[id]/schedule` | `useScheduleIdea()` |
| Dashboard stats | GET `/api/routing/dashboard` | `useRoutingDashboard()` |
| Calendar view | GET `/api/routing/calendar` | `useCalendarView(start, end)` |

### Routing Workflow State Machine

```
INTAKE → ROUTED → SCORED → SLOTTED → SCHEDULED → PUBLISHED
                                                 ↘ KILLED
```

All transitions work. The `idea_routing` table tracks the full lifecycle.

---

## 4. Routing System - What's Broken

### Dropped Tables (Production)

Jonathan's migration `20260211000001_replace_nate_tables.sql` dropped:

| Table | Our Purpose | Why Dropped |
|-------|------------|-------------|
| `project_routing` | Bridge: `idea_routing` ↔ `nate_content_projects` | FK to `nate_content_projects` which was dropped |
| `evergreen_queues` | Backlog queue management | FK to `project_routing` which was dropped |
| `nate_content_projects` | Was the main project table | Replaced by `projects` |
| `nate_project_assets` | Was the assets table | Replaced by `project_assets` |
| `nate_asset_versions` | Version history | Removed (now `version` column on `project_assets`) |
| `nate_project_publications` | Publication tracking | Merged into `project_assets` (`published_url`, `published_at`) |

### Broken Code

#### `src/lib/routing/queries.ts`
- Lines ~577-630: `getProjectRoutings()`, `getProjectRoutingById()`, `createProjectRouting()`, `updateProjectRouting()` all query `project_routing` table (GONE)
- Lines ~577-598: Joins reference `nate_content_projects` (renamed to `projects`)
- Lines ~669-783: `getEvergreenQueue()`, `addToEvergreenQueue()`, `updateEvergreenQueueEntry()`, `removeFromEvergreenQueue()`, `pullFromEvergreenQueue()` all query `evergreen_queues` table (GONE)

#### `src/app/api/routing/evergreen/route.ts`
- GET handler queries `evergreen_queues` via `getEvergreenQueue()` → 500 error
- DELETE handler queries `evergreen_queues` via `removeFromEvergreenQueue()` → 500 error

#### `src/app/(dashboard)/routing/queues/page.tsx`
- Calls `useEvergreenQueue()` → API returns 500 → empty/error state

#### `src/hooks/use-routing.ts`
- `useEvergreenQueue()` hook works but API behind it fails
- `useRemoveFromEvergreen()` same issue

#### Dashboard stats
- `src/app/api/routing/dashboard/route.ts` can return a response where `stats` is undefined → dashboard page throws "can't access property 'byStatus', stats is undefined" at runtime. Fix requires defensive handling in the dashboard page (and/or ensuring the API always returns a valid stats shape).
- Dashboard also tries to count evergreen items → that part fails when `evergreen_queues` is missing.

### Broken Legacy Hooks (NOT used by active pages)

| Hook | Problem |
|------|---------|
| `use-projects.ts` | Queries `nate_content_projects` (now `projects`) |
| `use-asset-versions.ts` | Queries `nate_asset_versions` (dropped entirely) |
| `use-publications.ts` | Queries `nate_project_publications` (dropped entirely) |

**Note:** `use-assets.ts` is **not** legacy — it queries `project_assets` and is the active hook used by deliverables and the Add Asset dialog. Only the hooks above are legacy (used only by hidden `/projects/*` pages). Calendar + Deliverables use `use-deliverables.ts` and `use-assets.ts`.

### Sidebar

Our routing links were removed. Only Calendar + Deliverables remain. All routing/studio pages are accessible only via direct URL.

---

## 5. What Jonathan Changed

### Commit Timeline (newest first)

| Commit | Date | Summary |
|--------|------|---------|
| `a062a25` | Feb 11 | Calendar DnD fixes, backlog panel, warm theme |
| `f6a460c` | Feb 11 | Asset type indicators on calendar cards |
| `9726840` | Feb 11 | Wire calendar to new `projects` table, fix types |
| `888a43e` | Feb 11 | Restore all deleted pages (files stay, hidden from nav) |
| `1598c85` | Feb 11 | **BIG: Deliverables system, DB consolidation, 6 table drops** |
| `d37ec2f` | Feb 7 | Revert posts tab |
| `448d989` | Feb 7 | Add posts tab (then reverted) |
| `d2e528a` | Feb 5 | Initial exploration, skills, global calendar access migration |

### Key Architecture Changes

1. **Database consolidated:** 6 old tables → 2 new tables (`projects` + `project_assets`)
2. **Types renamed:** `ContentProject` → `Project`, `title` → `name`, `target_platforms`/`notes` → `metadata` JSONB
3. **New hook:** `use-deliverables.ts` replaces `use-projects.ts` + `use-assets.ts`
4. **Sidebar stripped:** Only Calendar + Deliverables shown
5. **Mobile sidebar:** Added mobile overlay support (`isMobileOpen`, `closeMobile`)
6. **Theme:** Light mode changed from cold gray to warm cream/paper tones
7. **RLS opened up:** `20260211100000_open_rls_policies.sql` - simplified access

---

## 6. Database Schema Map

### Current Production Tables

#### Routing System (Ours - Intact)
```
publications
routing_rules
scoring_rubrics
tier_thresholds
calendar_slots
idea_routing
routing_status_log
app_settings (routing entries)
```

#### Routing System (Ours - DROPPED)
```
project_routing     ← GONE (FK to nate_content_projects)
evergreen_queues    ← GONE (FK to project_routing)
```

#### Jonathan's New System
```
projects            ← Replaces nate_content_projects
project_assets      ← Replaces nate_project_assets + nate_asset_versions + nate_project_publications
```

#### Idea Capture (Intact)
```
slack_ideas
slack_integration_config
idea_clusters
```

#### Content Pipeline (Intact)
```
content_sessions
content_brain_dumps
content_research
content_outlines
content_drafts
content_outputs
```

#### AI & Config (Intact)
```
ai_models
ai_call_logs
prompt_sets
prompt_versions
prompt_variables
prompt_variable_selections
prompt_guidelines
brand_guidelines
voice_guidelines
destinations
pinecone_namespaces
app_settings
```

#### Other (Intact)
```
profiles
partners
partner_invites
partner_api_keys
partner_api_usage
partner_namespace_permissions
imported_posts
sync_manifests
swipe_captures
changelog_items
recordings
transcripts
transcript_speakers
summaries
summary_modes
generated_images
```

### Connection Gap

```
                    CURRENT STATE
                    =============

slack_ideas ──→ idea_routing ──→ [NOTHING] ──→ projects
                    │                              │
                    │  (was: project_routing)       │
                    │  (DROPPED)                    │
                    │                              │
                    └── routing_rules              └── project_assets
                    └── scoring_rubrics
                    └── tier_thresholds
                    └── calendar_slots

                    DESIRED STATE
                    =============

slack_ideas ──→ idea_routing ──→ project_routing ──→ projects
                    │                                    │
                    │                                    │
                    └── routing_rules                    └── project_assets
                    └── scoring_rubrics
                    └── tier_thresholds
                    └── calendar_slots
                    └── evergreen_queues
```

---

## 7. Rebuild Plan

### 7.1 Recreate `project_routing` (Updated for new `projects` table)

**New migration needed.** Key changes from original:
- FK: `projects(id)` instead of `nate_content_projects(id)`
- RLS: Reference `projects.created_by` instead of `nate_content_projects.created_by`

```sql
CREATE TABLE project_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE SET NULL,
  scores JSONB,
  tier TEXT CHECK (tier IN ('premium_a', 'a', 'b', 'c', 'kill')),
  slot_id UUID REFERENCES calendar_slots(id) ON DELETE SET NULL,
  is_staggered BOOLEAN DEFAULT false,
  stagger_youtube_date DATE,
  stagger_substack_date DATE,
  original_date DATE,
  bump_reason TEXT,
  bumped_at TIMESTAMPTZ,
  bumped_by UUID REFERENCES auth.users(id),
  bump_count INTEGER DEFAULT 0,
  published_platforms JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);
```

### 7.2 Recreate `evergreen_queues`

Same schema as before, but FK to rebuilt `project_routing`:

```sql
CREATE TABLE evergreen_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE CASCADE,
  project_routing_id UUID REFERENCES project_routing(id) ON DELETE CASCADE,
  score DECIMAL(3,1) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('premium_a', 'a', 'b', 'c')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  staleness_check_at TIMESTAMPTZ,
  is_stale BOOLEAN DEFAULT false,
  stale_reason TEXT,
  pulled_at TIMESTAMPTZ,
  pulled_for_date DATE,
  pulled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT evergreen_queues_one_source CHECK (
    (idea_routing_id IS NOT NULL AND project_routing_id IS NULL) OR
    (idea_routing_id IS NULL AND project_routing_id IS NOT NULL)
  )
);
```

### 7.3 Update `src/lib/routing/queries.ts`

Replace all `nate_content_projects` → `projects` in joins.

### 7.4 Re-add Sidebar Links

Add routing and studio links back to `src/components/dashboard/sidebar.tsx`.

### 7.5 Update Types

Verify `ProjectRouting` type in `src/lib/types.ts` references correct project type.

---

## 8. New Features Plan

### Feature A: Ideas Management UI + Manual Capture

**Goal:** View, manage, and manually add ideas.

**New page:** `/ideas` (or add to routing dashboard)

**Functionality:**
- List all `slack_ideas` with filters (status, source_type, search)
- Manual capture form: textarea for content, source type selector
- Quick actions: archive, delete, "send to routing"
- AI processing button: generate summary, topics, type, angles

**Tables used:** `slack_ideas` (existing)

**New code needed:**
- `src/app/(dashboard)/ideas/page.tsx` - Ideas list + capture form
- `src/app/api/ideas/route.ts` - GET (list), POST (create)
- `src/app/api/ideas/[id]/route.ts` - GET, PATCH, DELETE
- `src/app/api/ideas/[id]/process/route.ts` - POST (AI processing)
- `src/lib/ideas/processor.ts` - AI processing function
- New prompt set: `idea_processor` in database

**Hook:** `src/hooks/use-ideas.ts` already exists with full CRUD.

### Feature B: Approve & Process Pipeline

**Goal:** Review raw ideas, approve for routing, process with AI.

**Flow:**
```
slack_ideas (status: backlog)
    ↓ [Human reviews in /ideas UI]
    ↓ [Clicks "Approve & Process"]
    ↓
AI processes → fills summary, topics, type, angles on slack_idea
    ↓
    ↓ [Clicks "Send to Routing"]
    ↓
Creates idea_routing row (status: intake)
    ↓
Routing engine evaluates conditions → matches rule → status: routed
    ↓
Scoring engine scores per rubric → assigns tier → status: scored
```

**Implementation:**
- "Approve" button in Ideas UI → triggers AI processing
- "Send to Routing" button → creates `idea_routing` entry
- Can be combined: "Approve & Route" does both steps
- Partial info handling: if raw content is thin, AI still extracts what it can + flags for human review

**Key logic:**
```typescript
// In src/lib/ideas/processor.ts
async function processIdea(supabase, ideaId: string): Promise<ProcessedIdea> {
  const idea = await getIdea(supabase, ideaId);
  const config = await loadActivePromptConfig(supabase, 'idea_processor');
  const result = await callAIWithLogging({
    promptSlug: 'idea_processor',
    userMessage: idea.raw_content,
    variables: { source_type: idea.source_type }
  });
  // Update slack_idea with processed fields
  await updateIdea(supabase, ideaId, {
    summary: result.summary,
    extracted_topics: result.topics,
    idea_type: result.type,
    potential_angles: result.angles,
    processed_at: new Date().toISOString(),
  });
}

// In src/lib/ideas/promote.ts
async function sendToRouting(supabase, ideaId: string): Promise<IdeaRouting> {
  const idea = await getIdea(supabase, ideaId);
  // Create idea_routing entry
  const routing = await createIdeaRouting(supabase, {
    idea_id: ideaId,
    user_id: idea.user_id,
    status: 'intake',
  });
  // Update idea status
  await updateIdea(supabase, ideaId, { status: 'in_progress' });
  // Optionally auto-route
  await routeIdea(supabase, routing.id);
  return routing;
}
```

### Feature C: Promote to Project

**Goal:** Scored/approved ideas become real projects in the deliverables system.

**Flow:**
```
idea_routing (status: scored, tier: A)
    ↓ [Human clicks "Promote to Project" in routing UI]
    ↓
Creates row in projects table (name from idea summary, scheduled_date from routing)
Creates row in project_routing (links project ↔ idea_routing)
Updates idea_routing status → "scheduled"
    ↓
Project appears on Calendar + Deliverables
User can create assets (posts, scripts, etc.) in Deliverables
```

**Implementation:**
```typescript
// In src/lib/routing/promote.ts
async function promoteToProject(supabase, ideaRoutingId: string): Promise<Project> {
  const routing = await getIdeaRoutingById(supabase, ideaRoutingId);
  const idea = await getIdea(supabase, routing.idea_id);

  // Generate project_id (yyyymmdd_xxx format)
  const projectId = generateProjectId();

  // Create project
  const project = await createProject(supabase, {
    project_id: projectId,
    name: idea.summary || idea.raw_content.slice(0, 100),
    scheduled_date: routing.calendar_date,
    status: routing.calendar_date ? 'scheduled' : 'draft',
    metadata: {
      source_idea_id: idea.id,
      routing_tier: routing.tier,
      routing_destination: routing.routed_to,
      topics: idea.extracted_topics,
    },
    created_by: routing.user_id,
  });

  // Create project_routing link
  await createProjectRouting(supabase, {
    project_id: project.id,
    idea_routing_id: ideaRoutingId,
    scores: routing.scores,
    tier: routing.tier,
    slot_id: routing.slot_id,
  });

  // Update idea_routing status
  await updateIdeaRouting(supabase, ideaRoutingId, {
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
  });

  return project;
}
```

**UI:**
- Add "Promote to Project" button on scored ideas in `/routing/ideas`
- Confirmation dialog showing: title, tier, scheduled date, destination
- After promotion, link to the new project in `/deliverables/[id]`

### Feature D: Slack Integration (Real Scraping)

**Goal:** Automatically sync messages from a Slack channel into `slack_ideas`.

**Components needed:**

1. **Slack App Setup** (manual, one-time)
   - Create at https://api.slack.com/apps
   - Scopes: `channels:history`, `channels:read`, `users:read`
   - Redirect URL: `https://your-domain.com/api/auth/slack/callback`

2. **Environment Variables**
   ```
   SLACK_CLIENT_ID=
   SLACK_CLIENT_SECRET=
   SLACK_SIGNING_SECRET=
   ```

3. **OAuth Flow**
   - `src/app/api/auth/slack/route.ts` - Initiate OAuth redirect
   - `src/app/api/auth/slack/callback/route.ts` - Exchange code for token, store in `slack_integration_config`

4. **Message Sync Cron**
   - `src/app/api/cron/sync-slack/route.ts` - Triggered every 15 min
   - Fetches messages since `last_message_ts`
   - Deduplicates via `slack_message_id` unique index
   - Inserts into `slack_ideas` with `source_type: 'slack'`

5. **Settings UI**
   - `src/app/(dashboard)/settings/slack/page.tsx`
   - Connect/disconnect workspace
   - Select channel
   - Manual sync trigger
   - View sync status

**Existing tables:** `slack_integration_config`, `slack_ideas` — both exist and are ready.

---

## 9. File Reference

### Routing System Files (Our Work)

#### Database Migrations
```
supabase/migrations/20260205000001_publications.sql
supabase/migrations/20260205000002_calendar_slots.sql
supabase/migrations/20260205000003_scoring_rubrics.sql
supabase/migrations/20260205000004_routing_rules.sql
supabase/migrations/20260205000005_tier_thresholds.sql
supabase/migrations/20260205000006_idea_routing.sql
supabase/migrations/20260205000007_project_routing.sql          ← TABLE DROPPED
supabase/migrations/20260205000008_evergreen_queues.sql         ← TABLE DROPPED
supabase/migrations/20260205000009_routing_status_log.sql
supabase/migrations/20260205000010_routing_app_settings.sql
```

#### Core Logic
```
src/lib/routing/index.ts      # Public exports
src/lib/routing/types.ts      # Type definitions
src/lib/routing/queries.ts    # Database operations (PARTIALLY BROKEN - evergreen/project joins)
src/lib/routing/router.ts     # Routing engine (WORKING)
src/lib/routing/scorer.ts     # Scoring engine (WORKING)
```

#### API Routes
```
src/app/api/routing/config/publications/route.ts        # WORKING
src/app/api/routing/config/publications/[id]/route.ts   # WORKING
src/app/api/routing/config/rules/route.ts               # WORKING
src/app/api/routing/config/rules/[id]/route.ts          # WORKING
src/app/api/routing/config/rubrics/route.ts             # WORKING
src/app/api/routing/config/rubrics/[id]/route.ts        # WORKING
src/app/api/routing/config/slots/route.ts               # WORKING
src/app/api/routing/config/slots/[id]/route.ts          # WORKING
src/app/api/routing/config/tiers/route.ts               # WORKING
src/app/api/routing/config/tiers/[id]/route.ts          # WORKING
src/app/api/routing/ideas/route.ts                      # WORKING
src/app/api/routing/ideas/[id]/route.ts                 # WORKING
src/app/api/routing/ideas/[id]/route/route.ts           # WORKING
src/app/api/routing/ideas/[id]/score/route.ts           # WORKING
src/app/api/routing/ideas/[id]/schedule/route.ts        # WORKING
src/app/api/routing/dashboard/route.ts                  # BROKEN (can return undefined stats → dashboard crash)
src/app/api/routing/calendar/route.ts                   # WORKING
src/app/api/routing/evergreen/route.ts                  # BROKEN (table dropped)
```

#### React Hooks
```
src/hooks/use-routing.ts        # PARTIALLY BROKEN (evergreen hooks fail)
src/hooks/use-routing-config.ts # WORKING (all config hooks)
```

#### UI Pages
```
src/app/(dashboard)/routing/layout.tsx           # WORKING (hidden from nav)
src/app/(dashboard)/routing/page.tsx             # WORKING
src/app/(dashboard)/routing/ideas/page.tsx       # WORKING
src/app/(dashboard)/routing/calendar/page.tsx    # WORKING
src/app/(dashboard)/routing/queues/page.tsx      # BROKEN (evergreen table gone)
src/app/(dashboard)/studio/layout.tsx            # WORKING (hidden from nav)
src/app/(dashboard)/studio/publications/page.tsx # WORKING
src/app/(dashboard)/studio/routing-rules/page.tsx # WORKING
src/app/(dashboard)/studio/scoring/page.tsx      # WORKING
src/app/(dashboard)/studio/tiers/page.tsx        # WORKING
src/app/(dashboard)/studio/calendar-slots/page.tsx # WORKING
```

### Jonathan's New Files
```
src/app/(dashboard)/deliverables/page.tsx
src/app/(dashboard)/deliverables/new/page.tsx
src/app/(dashboard)/deliverables/[id]/page.tsx
src/app/(dashboard)/deliverables/[id]/assets/[assetId]/page.tsx
src/hooks/use-deliverables.ts
src/components/calendar/backlog-panel.tsx
src/components/post-markdown.tsx
scripts/backfill-nate-posts.ts
scripts/backfill-nate-resources.ts
scripts/fetch-nate-resources.py
docs/dropped-tables-20260211.md
CONTEXT.md
skills/database/
```

### Hooks Status Summary
```
src/hooks/use-deliverables.ts     # Queries projects + project_assets ✅
src/hooks/use-assets.ts           # Active - queries project_assets (deliverables, Add Asset dialog) ✅
src/hooks/use-routing.ts          # Partially broken (evergreen) ⚠️
src/hooks/use-routing-config.ts   # Fully working ✅
src/hooks/use-ideas.ts            # Queries slack_ideas ✅
src/hooks/use-clusters.ts         # Queries idea_clusters ✅
src/hooks/use-projects.ts         # Legacy - queries nate_content_projects ❌
src/hooks/use-asset-versions.ts   # Legacy - queries nate_asset_versions (dropped) ❌
src/hooks/use-publications.ts     # Legacy - queries nate_project_publications (dropped) ❌
src/hooks/use-captures.ts         # Queries swipe_captures ✅
src/hooks/use-changelog-items.ts  # Queries changelog_items ✅
```

---

## 10. Implementation Order

### Phase 1: Fix What's Broken (~4 hours)
1. New migration: Recreate `project_routing` referencing `projects(id)`
2. New migration: Recreate `evergreen_queues` referencing rebuilt `project_routing`
3. Update `src/lib/routing/queries.ts`: Replace `nate_content_projects` → `projects` in joins
4. Re-add routing + studio links to sidebar
5. Test all routing pages work

### Phase 2: Ideas Management UI (~4 hours)
1. Create `/ideas` page with list view + manual capture form
2. Create ideas API routes (or use existing Supabase direct queries)
3. Add sidebar link
4. Basic CRUD: create, view, filter, archive, delete

### Phase 3: Approve & Process Pipeline (~4 hours)
1. AI processing function (`idea_processor` prompt)
2. "Approve & Process" button in Ideas UI
3. "Send to Routing" action
4. Status sync between `slack_ideas` and `idea_routing`

### Phase 4: Promote to Project (~3 hours)
1. `promoteToProject()` function
2. "Promote to Project" button in routing ideas UI
3. Confirmation dialog with details
4. Links between routing and deliverables

### Phase 5: Slack Integration (~6 hours)
1. Slack App configuration
2. OAuth flow (2 routes)
3. Message sync cron job
4. Settings UI for connection management

### Phase 6: Polish & Cleanup (~2 hours)
1. Delete or update legacy hooks (`use-projects.ts`, `use-asset-versions.ts`, `use-publications.ts` — not `use-assets.ts`)
2. Update CLAUDE.md with new architecture
3. Update CAPABILITIES.md
4. Mark routing system plan as complete

---

## Quick Reference: Key Decisions Needed

1. **Sidebar strategy:** Add all routing/studio links back? Or a phased approach?
2. **Legacy hooks:** Delete `use-projects.ts`, `use-asset-versions.ts`, `use-publications.ts`? (Keep `use-assets.ts` — it's active.)
3. **Auto-routing:** Should some ideas auto-route based on AI analysis?
4. **Slack channel:** Single channel per user, or configurable?
5. **Evergreen queue redesign:** Same design or simplify?
6. **Calendar unification:** Keep separate routing calendar, or merge into main?
