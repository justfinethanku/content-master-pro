# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Personal content creation platform that transforms brain dumps into multi-platform deliverables. Built for Nate Jones Media LLC.

## Commands

```bash
npm run dev                # Start dev server (localhost:3000)
npm run build              # Production build
npm run lint               # ESLint
npm run lint:fix           # ESLint with auto-fix
npm run format             # Prettier format all files
npm run format:check       # Check formatting without writing
npm run test               # Run Vitest (watch mode)
npx vitest run             # Run tests once (CI-style)
npx vitest run src/path/to/file.test.ts  # Run single test file
npm run test:coverage      # Coverage report
```

### Supabase (Local Development)

Requires Docker Desktop running.

```bash
npm run supabase:start      # Start local containers
npm run supabase:stop       # Stop local containers
npm run supabase:env        # Generate .env.local from local Supabase
npm run supabase:seed-user  # Create test user (test@example.com / password123)
npm run supabase:reset      # Reset DB (runs all migrations)
npm run supabase:diff       # Generate migration from schema changes
npm run supabase:push       # Push migrations to remote
```

Local services: API `:54321` | Studio `:54323` | Inbucket `:54324` | DB `:54322`

To switch between local and production: create `.env.local` (local) or delete it (production).

### Scripts

```bash
npx tsx scripts/sync-ai-models.ts          # Sync models from Vercel AI Gateway
npx tsx scripts/sync-ai-models.ts --dry-run # Preview model sync changes
npx tsx scripts/sync-nate-full.ts           # Sync Nate's newsletter (needs CDP Chrome)
npx tsx scripts/reindex-all.ts              # Reindex all content in Pinecone
```

## Architecture

### Tech Stack

Next.js 16 (App Router) | shadcn/ui + Tailwind CSS v4 | Supabase (Auth + PostgreSQL) | Pinecone (vector search) | Vercel AI Gateway | TanStack Query | Vitest

### Route Groups & Auth

There is **no middleware.ts**. Auth is enforced in layouts:

- `src/app/(auth)/` — Public routes: `/login`, `/signup`
- `src/app/(dashboard)/` — Protected routes. The layout server component calls `supabase.auth.getUser()` and redirects to `/login` if unauthenticated.

Key dashboard routes: `/dashboard`, `/create`, `/draft`, `/outline`, `/research`, `/outputs`, `/search`, `/calendar`, `/projects/[id]`, `/captures`, `/studio/*`, `/admin/*`, `/partner/*`, `/routing/*`, `/settings`, `/sync`

### Data Flow

**CRUD operations:**
```
Client Component (TanStack Query hook)
    ↓ useQuery / useMutation
API Route (src/app/api/*)
    ↓ createClient() or createServiceClient()
Supabase / Pinecone
```

**AI generation:**
```
Client Component (useGenerate hook)
    ↓ fetch ${supabaseUrl}/functions/v1/generate
Supabase Edge Function (supabase/functions/generate/)
    ↓ loads prompts, models, settings, guidelines from DB
    ↓ text/research: REST → Vercel AI Gateway → Provider
    ↓ image (BFL):    AI SDK generateImage() → Gateway → BFL
    ↓ image (Gemini):  AI SDK generateImage() → Direct @ai-sdk/google → Google
```

### Supabase Client Pattern

**Browser (client components):** No `await` required.
```typescript
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

**Server (server components, API routes):** Must `await`.
```typescript
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
```

**Service role (admin operations):** Full access, bypasses RLS.
```typescript
import { createServiceClient } from "@/lib/supabase/server";
const supabase = await createServiceClient();
```

### AI Integration (Edge Function Architecture)

All AI generation goes through a **universal Supabase Edge Function**:
```
useGenerate hook → Supabase Edge Function (generate) → AI Provider
```

**Edge Function:** `supabase/functions/generate/index.ts` — One endpoint for text, image, and research generation. Loads prompt config, model config, destinations, and guidelines from the database, then routes to the appropriate handler.

**Shared modules** in `supabase/functions/_shared/`:
- `prompts.ts` — `loadActivePromptConfig()`, `interpolateTemplate()`
- `models.ts` — `loadModelConfig()` with model type routing (text/image/research)
- `settings.ts` — `getSetting()`, `EdgeFunctionSettings` with per-function config
- `destinations.ts` — Destination-specific requirements and aspect ratios
- `guidelines.ts` — User voice guidelines injection
- `variables.ts` — Template variable resolution from session data
- `ai.ts` — `callAI()`, `parseJSONResponse()`
- `supabase.ts` — Admin and user Supabase clients
- `cors.ts` — CORS headers

**Client-side hook:** `src/hooks/use-generate.ts` — `useGenerate()`, `useGenerateJSON<T>()`, `useResearch()`. Calls `${supabaseUrl}/functions/v1/generate` with auth token. Supports SSE streaming.

**Image Generation (AI SDK):**
Image generation uses the Vercel AI SDK's `generateImage()` (imported as `experimental_generateImage`). One unified function `callImageModelSDK()` handles all providers:
- **BFL models** (FLUX Kontext Pro/Max): `gateway.image(modelId)` via Vercel AI Gateway
- **Google Gemini** (`gemini-3-pro-image`): `google.image('gemini-3-pro-image-preview')` via direct `@ai-sdk/google` (v3.x)
- **Reference images**: Passed via `prompt.images[]` (raw base64, no data URI prefix). Only sent when `imageConfig.supports_image_input` is `true` in the DB.
- **Why Gemini needs direct provider**: The Gateway classifies Gemini as `modelType: "language"`, not `"image"`. The compatibility path works for text-to-image but doesn't reliably pass `prompt.images[]` for image editing. The direct provider gives first-class support.
- **`@ai-sdk/google` must be v3+**: v2 routes Gemini to `:predict` (Imagen-only). v3 routes to `:generateContent`.
- **Full reference**: `docs/vercel-docs/ai-sdk-image-generation.md`

**Text & Research Generation (REST):**
- **Text endpoint:** `https://ai-gateway.vercel.sh/v1/chat/completions`
- **Model ID format:** `provider/model-name` (e.g., `anthropic/claude-sonnet-4-5`)
- **Response format:** OpenAI-compatible (`choices[0].message.content`, `usage.prompt_tokens`)
- **Extended thinking:** `reasoning: { enabled: true, budget_tokens: N }` — temperature must be omitted
- **Embeddings:** `text-embedding-3-large` (3072 dims) via `src/lib/ai/embeddings.ts` (separate from Edge Function)

Models stored in `ai_models` table. Sync with `npx tsx scripts/sync-ai-models.ts`.

**Integration Testing (Image):**
```bash
npx tsx test-images/run-test.ts    # Run image generation tests across all models
```
Bump `TEST_NUMBER` and `TEST_WORD` in the script for each run. Results saved to `test-images/test{N}/`.

### Pinecone (Vector Search)

Namespaces are **database-driven** via the `pinecone_namespaces` table (60-second cache). Multi-namespace search:

```typescript
import { searchPosts } from "@/lib/pinecone/search";
const results = await searchPosts(supabase, {
  query: "AI content creation",
  namespaces: ["jon", "nate"],  // Optional: defaults to all searchable
  topK: 10,
});
```

### TanStack Query Pattern

All hooks use query key factories for smart cache invalidation:

```typescript
// Key factory (src/hooks/use-*.ts)
export const ideaKeys = {
  all: ["ideas"] as const,
  lists: () => [...ideaKeys.all, "list"] as const,
  list: (filters) => [...ideaKeys.lists(), filters] as const,
  detail: (id) => [...ideaKeys.all, "detail", id] as const,
};

// Usage in components
const { data } = useQuery({
  queryKey: ideaKeys.list(filters),
  queryFn: async () => { /* Supabase query */ },
});
```

Provider hierarchy (`src/components/providers/`): `ThemeProvider` → `QueryProvider` (1-min stale time, no refetch on focus) → `TooltipProvider`

### Content Routing System (hidden, not in sidebar)

Rule-based routing engine in `src/lib/routing/`:
- `router.ts` — Recursive condition evaluator, first-match rule finder
- `scorer.ts` — Publication scoring against rubrics
- `scheduler.ts` — Calendar slot assignment
- `queries.ts` — Database queries for routing config

Built by Kaleab. Pages exist at `/routing/*` and `/studio/routing-rules|scoring|tiers|publications|calendar-slots` but are not in the sidebar. Preserved for future revisiting.

## Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Supabase clients | `src/lib/supabase/` | Browser, server, and service role clients |
| Prompt loading | `src/lib/supabase/prompts.ts` | DB-driven prompts with interpolation |
| AI logging | `src/lib/supabase/ai-logging.ts` | AI call audit trail |
| AI embeddings | `src/lib/ai/embeddings.ts` | Vercel AI SDK embedding client |
| Generate Edge Fn | `supabase/functions/generate/` | Universal AI generation endpoint |
| EF shared modules | `supabase/functions/_shared/` | Prompts, models, settings, destinations, guidelines |
| Generate hook | `src/hooks/use-generate.ts` | `useGenerate()`, `useGenerateJSON<T>()`, `useResearch()` |
| Pinecone search | `src/lib/pinecone/search.ts` | Multi-namespace semantic search |
| Pinecone namespaces | `src/lib/pinecone/namespaces.ts` | DB-driven config with cache |
| Content routing | `src/lib/routing/` | Rule engine, scorer, scheduler (hidden) |
| AI SDK docs | `docs/vercel-docs/` | Provider reference docs (BFL, Google, Gateway, etc.) |
| Image test script | `test-images/run-test.ts` | Integration test for image models with reference images |
| Types | `src/lib/types.ts` | All TypeScript types |
| Utils | `src/lib/utils.ts` | `cn()` for Tailwind class merging |

## Database Tables

### Core Content Pipeline
`content_sessions` → `content_brain_dumps` → `content_research` → `content_outlines` → `content_drafts` → `content_outputs`

### Prompt Management
`prompt_sets` + `prompt_versions` (draft/active/archived) + `ai_models` + `ai_call_logs`

### Content Library
`imported_posts`, `sync_manifests`

### Ideas & Routing
`slack_ideas`, `idea_clusters`, `idea_routing`, `routing_rules`, `scoring_rubrics`, `calendar_slots`, `publications`, `tier_thresholds`, `evergreen_queues`

### Projects
`content_projects`, `project_assets`, `asset_versions`

### Configuration
- `app_settings` — All configurable values (JSON). Keyed by `category` + `key`.
- `pinecone_namespaces` — Namespace config (slug, display_name, source_type, is_active, is_searchable)
- `ai_models` — All model configs (synced from gateway)

## Engineering Rules (MANDATORY)

### Rule 1: No Hardcoded Values
Any value that might change must be configurable (database, env var, or config file): API parameters, model IDs, feature flags, prompt content → use `app_settings` table.

### Rule 2: Database-Driven AI Models
**NEVER hardcode model IDs.** Always load from database via `loadActivePromptConfig()`.

### Rule 3: Database-Driven Prompts
All prompts in `prompt_sets` + `prompt_versions` tables. Version lifecycle: draft → active → archived.

### Rule 4: Prompt Manager UI
Every prompt editable through the web UI at `/studio/prompts`.

### Rule 5: Edge Function Architecture
All AI calls go through the Supabase Edge Function (`supabase/functions/generate/`):
```
Next.js (useGenerate) → Edge Function → AI Provider (Gateway or Direct)
```
Each Edge Function must:
1. Load settings from `app_settings` table
2. Load prompt config from database
3. Interpolate template variables (including guidelines and destinations)
4. Call AI provider with configured model (text/research via Gateway REST, images via AI SDK `generateImage()`)
5. Log the call to `ai_call_logs` and return structured response

### Rule 6: SSE Streaming
Use Server-Sent Events for AI responses >2 seconds.

### Rule 7: Single Source of Truth
Colors → `globals.css` CSS variables | Utilities → `@/lib/utils` | Types → `@/lib/types` | Components → `@/components/ui/` | Settings → `app_settings` table

### Rule 8: Testing & Code Quality
ESLint, Prettier, Vitest required. Run before committing.

### Rule 9: Documentation Accuracy
All docs must reflect current reality. Update docs when code changes.

### Rule 10: Living Documentation
`CLAUDE.md` (primary context) | `BUILD_LOG.md` (build narrative) | `CHANGELOG.md` (all changes, reverse chronological)

### Rule 11: Proactive Research
Research current APIs, UI/UX patterns, and accessibility standards before implementing major features.

### Rule 12: Contrast and Visibility (CRITICAL)
**WCAG AA minimum (4.5:1).** Test both dark and light modes. Always use semantic color classes (`text-foreground`, `text-muted-foreground`), never raw colors (`text-white`).

### Rule 13: AI Call Logging
Every AI call logged to `ai_call_logs`: `full_prompt`, `full_response`, `model_id`, `tokens_in`, `tokens_out`, `duration_ms`.

### Rule 14: Plan Tracking
Copy plans from `~/.claude/plans/` to `./plans/<name>.md`. Update checkboxes during implementation. Mark `## Status: Complete` when done. See `CLAUDE-PLAN.md` for full workflow. Use for tasks touching 3+ files or with multiple valid approaches.

## Common Patterns

### Loading Prompts
```typescript
import { loadActivePromptConfig } from '@/lib/supabase/prompts';

const config = await loadActivePromptConfig(supabase, 'brain_dump_parser');
const systemPrompt = interpolateTemplate(config.prompt_content, {
  userName: user.name
});
```

### Semantic Search
```typescript
import { searchPosts } from '@/lib/pinecone/search';

const results = await searchPosts(supabase, {
  query: "AI content creation",
  namespaces: ["jon", "nate"],
  topK: 10,
});
```

### AI Call with Logging
```typescript
import { callAIWithLogging } from '@/lib/ai/gateway';

const response = await callAIWithLogging({
  sessionId,
  promptSlug: 'outline_generator',
  userMessage: brainDumpContent,
  variables: { themes: extractedThemes }
});
```

## Cron Jobs (TODO — needs review)

Three cron API routes exist but need review and possible rewiring:

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/cron/sync` | Automated content sync | Needs review — verify what it syncs and whether it's active on Vercel |
| `/api/cron/link-substack` | Links imported posts to Substack URLs | Needs review — check if still relevant |
| `/api/cron/ingest-changelogs` | Ingests changelog entries | Needs review — may feed the roadmap feature |

These are not currently wired into any UI. Revisit in a future session to determine which are still needed and configure Vercel cron schedules.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY     # For server-side operations
PINECONE_API_KEY              # Pinecone API key
PINECONE_HOST                 # Pinecone index host
VERCEL_AI_GATEWAY_API_KEY     # AI Gateway key (text, research, BFL image models)
GOOGLE_GENERATIVE_AI_API_KEY  # Direct Google AI key (Gemini image generation)
TEST_EMAIL                    # Test account email
TEST_PASSWORD                 # Test account password
```

## Content Sync

See [`CLAUDE-SYNC.md`](./CLAUDE-SYNC.md) for Nate's newsletter sync (CDP-based, daily automation available).

## Executive Circle MCP

Read-only MCP server for Executive Circle subscribers (paid Substack tier). Gives subscribers AI-powered access to published posts and prompt kits from their AI clients.

### Architecture

```
Subscriber registers at promptkit.natebjones.com/executive/mcp
    ↓ POST /api/subscriber/register (validates access code, returns token)
Subscriber connects Claude Desktop / ChatGPT
    ↓ POST /api/mcp/subscriber/{token}
subscriber-server.ts (6 read-only tools)
    ↓ queries imported_posts + project_assets
Supabase
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/mcp/subscriber-server.ts` | MCP server with 6 read-only tools |
| `src/lib/mcp/subscriber-rate-limit.ts` | 120/min, 2,000/day rate limiting |
| `src/app/api/mcp/subscriber/[token]/route.ts` | MCP endpoint (auth + rate limit + transport) |
| `src/app/api/subscriber/register/route.ts` | Registration API (access code validation) |
| `src/app/api/executive-mcp/subscribers/route.ts` | Admin API (list/revoke subscribers) |
| `src/app/(dashboard)/executive-mcp/page.tsx` | Admin dashboard page |

### Database Tables

- `subscriber_mcp_access` — subscriber tokens, usage stats, revocation
- `subscriber_mcp_usage` — per-request log for rate limiting
- `app_settings` (category: `executive_circle`, key: `access_code`) — access code gate

### Registration Page (separate repo)

Lives in `prompt-kit-presenter` (`/Users/jonathanedwards/AUTOMATION/SubStack/prompt-kit-presenter`):
- `src/app/executive/mcp/page.tsx` — page wrapper
- `src/components/mcp-registration.tsx` — 3-step flow (access code → register → setup instructions)
- Calls CMP's `/api/subscriber/register` endpoint
- URL: `promptkit.natebjones.com/executive/mcp`

### Tools Exposed to Subscribers

| Tool | Description |
|------|-------------|
| `search_posts` | Keyword search across all published posts |
| `get_post` | Full post content by UUID |
| `list_recent_posts` | Paginated recent posts |
| `search_prompt_kits` | Keyword search across prompt kits |
| `get_prompt_kit` | Full prompt kit content by UUID |
| `list_prompt_kits` | All available prompt kits |

### Companion Asset Pipeline (cross-repo)

See [`docs/prompt-kit-pipeline.md`](./docs/prompt-kit-pipeline.md) for the full companion asset data flow between CMP and prompt-kit-presenter. Key points:
- **Two companion types**: prompt kits (`promptkit`) and guides (`guide`) — sibling assets alongside posts in the same project
- **Shared database** — Presenter reads directly from CMP's Supabase via Drizzle ORM + transaction pooler. No sync needed.
- **CMP creates** companion assets → `project_assets` table
- **Presenter displays** them at `promptkit.natebjones.com/{assetId}` — blue accent for prompt kits, green for guides
- **Preamble generator** (`post_preamble_generator` v2) receives companion content via `{{companion_resources}}` and builds CTA links via `{{resources_cta}}`
- **Asset cards** in CMP are color-coded: green tint for guides, blue for prompt kits, neutral for posts
- **Hooks**: `useProjectPromptKits(id)`, `useProjectGuides(id)` — both wrap `useProjectAssetsByType(id, type)`
- **MCP registration** is the only API call between the two apps (presenter → CMP `/api/subscriber/register`)
- **Presenter repo**: `/Users/jonathanedwards/AUTOMATION/SubStack/prompt-kit-presenter`
