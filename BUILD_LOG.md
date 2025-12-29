# Content Master Pro - Build Log

Detailed narrative of the autonomous build process.

---

## [2024-12-27 - Session 1] Phase 1.1: Project Setup

### What I Attempted
- Create Next.js 15 project with App Router
- Install dependencies (Supabase, Pinecone, TanStack Query, Vitest, Prettier)
- Initialize shadcn/ui with core components
- Create environment files

### What Happened
- `npx create-next-app@latest` created project successfully
- Next.js 16.1.1 installed (latest stable)
- Tailwind CSS v4 auto-configured
- shadcn/ui initialized with 13 components: button, card, input, textarea, label, badge, separator, sheet, dialog, dropdown-menu, tabs, tooltip, avatar
- Core deps installed: @supabase/supabase-js, @supabase/ssr, @pinecone-database/pinecone, @tanstack/react-query, ai
- Dev deps installed: vitest, @testing-library/react, @testing-library/jest-dom, jsdom, prettier

### Lessons Learned
- Next.js create-next-app now asks about React Compiler (chose No)
- shadcn/ui auto-detects Tailwind v4 and configures appropriately
- Use `-d` flag for shadcn init to accept defaults
- Use `-y` flag when adding shadcn components to skip prompts

### Suggestions for Next Steps
- Set up Supabase clients (browser, server, middleware)
- Create middleware.ts for auth route protection
- Test dev server before proceeding

---

## [2024-12-27 - Session 1] Phase 1.2: Documentation Setup

### What I Attempted
- Create CLAUDE.md with project overview and patterns
- Create BUILD_LOG.md (this file)
- Create CHANGELOG.md
- Create .env.local and .env.example

### What Happened
- All documentation files created
- Environment variables set up with actual credentials
- .env.example created for future reference (no secrets)

### Lessons Learned
- Documentation should be created early - it provides context for the AI as the build progresses
- CLAUDE.md should include patterns and code examples, not just structure

### Suggestions for Next Steps
- Set up Supabase clients following the patterns in thumbnail_generator and AI Assessment
- Create middleware.ts for session management

---

## [2024-12-27 - Session 1] Phase 1.3: Supabase & Pinecone Clients

### What I Attempted
- Create Supabase browser client (`src/lib/supabase/client.ts`)
- Create Supabase server client (`src/lib/supabase/server.ts`)
- Create Supabase middleware helper (`src/lib/supabase/middleware.ts`)
- Create root `middleware.ts` for auth protection
- Create Pinecone client (`src/lib/pinecone/client.ts`)
- Create Pinecone search helpers (`src/lib/pinecone/search.ts`)

### What Happened
- All Supabase clients created following @supabase/ssr patterns
- Middleware protects routes and redirects unauthenticated users to /login
- Pinecone client created with singleton pattern
- Search helper created (placeholder for now - needs Pinecone inference integration)

### Lessons Learned
- Supabase SSR package (@supabase/ssr) is the correct way to handle auth in Next.js App Router
- Middleware must return the supabaseResponse object to maintain session sync
- Pinecone SDK v6 has different API than v5 - need to verify exact search methods

### Suggestions for Next Steps
- Research Pinecone integrated inference API for embedding queries
- Create database migrations for content tables

---

## [2024-12-27 - Session 1] Phase 1.4: App Structure

### What I Attempted
- Create providers (QueryProvider, ThemeProvider)
- Update root layout with providers
- Create auth layout and pages (login, signup)
- Create dashboard layout with sidebar and header
- Create dashboard home page
- Create theme toggle component

### What Happened
- All providers created and wired up
- Auth pages created with proper form handling and Supabase integration
- Dashboard layout includes sidebar navigation and header with user menu
- Theme toggle allows switching between light/dark/system
- Home page redirects to dashboard if authenticated, shows landing page if not

### Lessons Learned
- Always use semantic color classes (text-foreground, bg-background) for proper dark mode support
- suppressHydrationWarning on html tag is needed for next-themes
- Button's asChild prop is useful for wrapping Link components

### Suggestions for Next Steps
- Validate dev server runs without errors
- Create database migrations

---

## [2024-12-27 - Session 1] Phase 1.5: Validation

### What I Attempted
- Run dev server
- Run TypeScript type check
- Verify no errors

### What Happened
- Dev server starts successfully on port 3000
- Initial TypeScript error in Pinecone search.ts (incorrect SDK API usage)
- Fixed by simplifying search function to placeholder
- TypeScript passes with no errors

### Lessons Learned
- Pinecone SDK v6 API differs from documentation examples - need to research current API
- Always run `tsc --noEmit` after making changes to catch type errors early

### Suggestions for Next Steps
- Create database migrations (Phase 1.6)
- Then proceed to Phase 2: RAG & Content Import

---

## [2024-12-27 - Session 2] Phase 1.6: Database Migrations

### What I Attempted
- Create all database tables (profiles, ai_models, prompts, content_sessions, ai_call_logs, voice_guidelines, imported_posts, sync_manifests)
- Seed initial AI models (Claude, Gemini, Perplexity)
- Seed 9 prompt sets with active versions
- Push migrations to Supabase

### What Happened
- Created 9 migration files covering all required tables
- Pushed all migrations successfully using `supabase db push`
- Initial seed had bug: prompt_versions referenced `ai_models.slug` but column is `model_id`
- Created fix migration (20241227000009) to update model_ids
- All 9 prompt versions now correctly linked to their AI models

### Files Created
```
supabase/migrations/
├── 20241227000001_profiles.sql        # User profiles with RLS
├── 20241227000002_ai_models.sql       # AI models (6 seeded)
├── 20241227000003_prompts.sql         # prompt_sets, prompt_versions
├── 20241227000004_content_sessions.sql # All content tables
├── 20241227000005_ai_call_logs.sql    # AI call logging
├── 20241227000006_voice_guidelines.sql # Editable voice guidelines
├── 20241227000007_import_sync.sql     # imported_posts, sync_manifests
├── 20241227000008_seed_prompts.sql    # 9 prompt sets seeded
└── 20241227000009_fix_prompt_model_ids.sql # Fix model references
```

### Lessons Learned
- Always verify column names match between tables when writing INSERT/UPDATE statements
- Use `node -e` with Supabase JS client to quickly verify data since `psql` may not be installed
- Supabase CLI `db push` automatically prompts for confirmation
- The `supabase link` command needs project-ref from the URL (e.g., `uaiiskuioqirpcaliljh`)

### Database Summary
- **profiles**: User profiles with role (user/admin)
- **ai_models**: 6 models (Claude Sonnet/Haiku/Opus, Gemini Flash/Pro, Perplexity Sonar)
- **prompt_sets**: 9 sets (brain_dump_parser, research_generator, outline_generator, draft_writer_substack, voice_checker, headline_generator, youtube_script_writer, tiktok_script_writer, image_prompt_generator)
- **prompt_versions**: 9 active versions with full prompt content
- **content_sessions**: Tracks full pipeline state
- **content_brain_dumps**: Raw brain dump input
- **content_research**: Research results
- **content_outlines**: Generated outlines
- **content_drafts**: Written drafts with voice scores
- **content_outputs**: Final outputs by type
- **ai_call_logs**: Full prompt/response logging
- **voice_guidelines**: User-editable voice rules
- **imported_posts**: Synced posts from Substack
- **sync_manifests**: Sync status tracking

---

## Phase 1 Complete!

**Status:** All Phase 1 tasks completed successfully
- Next.js 15 project created ✓
- Dependencies installed ✓
- Supabase clients configured ✓
- Pinecone client configured ✓
- Auth pages created ✓
- Dashboard structure created ✓
- Dev server runs without errors ✓
- TypeScript passes ✓
- Database migrations created and pushed ✓
- Prompt sets seeded with active versions ✓

**Next:** Phase 2 - RAG & Content Import

---

## [2024-12-27 - Session 2] Phase 2: RAG & Content Import

### What I Attempted
- Create post import script for Jon's and Nate's Substack posts
- Import posts to Pinecone vector database with embeddings
- Create search API with Pinecone Inference
- Create search UI with results view and chat placeholder

### What Happened
- Created `scripts/import-posts.ts` for importing markdown posts with frontmatter
- Created new Pinecone index `content-master-pro` with 1024 dimensions (for multilingual-e5-large embeddings)
- Successfully imported 59 posts from Jon's Substack
- Successfully imported 411 posts from Nate's Substack (470 total vectors)
- Some posts had YAML parsing errors due to unescaped quotes in frontmatter (10 Jon posts skipped)
- Created search API at `/api/search` with GET and POST support
- Created search UI at `/search` with source filtering and relevance scores

### Files Created
```
scripts/
└── import-posts.ts          # Post import script with Pinecone Inference

src/
├── lib/pinecone/
│   └── search.ts             # Updated with working search implementation
├── app/api/search/
│   └── route.ts              # Search API endpoint
└── app/(dashboard)/search/
    └── page.tsx              # Search UI with tabs
```

### Technical Details
- **Embedding Model**: `multilingual-e5-large` via Pinecone Inference API
- **Index Dimensions**: 1024
- **Namespaces**: `jon-substack` (59 vectors), `nate-substack` (411 vectors)
- **Search**: Generates query embedding and searches both namespaces, combines and sorts by score

### Lessons Learned
- Pinecone SDK v6 returns union types for embeddings (dense vs sparse) - must check for `values` property
- The `multilingual-e5-large` model produces 1024-dim vectors, not 3072 like text-embedding-3-large
- gray-matter YAML parser requires properly escaped quotes in frontmatter
- Search accuracy is excellent - relevant posts rank highly (0.83-0.84 scores for "prompting" query)

---

## Phase 2 Complete!

**Status:** All Phase 2 tasks completed successfully
- Post import script created ✓
- New Pinecone index created (content-master-pro) ✓
- Jon's posts imported (59 vectors) ✓
- Nate's posts imported (411 vectors) ✓
- Search API created ✓
- Search UI created with results view ✓
- Chat view placeholder added ✓

**Next:** Phase 3 - Brain Dump → Outline Pipeline

---

## [2024-12-27 - Session 3] Phase 3.1: Edge Functions Setup

### What I Attempted
- Create shared Edge Function utilities
- Set up Supabase client for Edge Functions
- Create AI client with Vercel AI Gateway
- Create prompt loading utilities
- Create CORS helpers

### What Happened
- Created `supabase/functions/_shared/` directory with utilities:
  - `supabase.ts` - Supabase client helpers
  - `prompts.ts` - Prompt loading from database
  - `ai.ts` - AI client with logging
  - `cors.ts` - CORS helpers
- **CRITICAL BUG FOUND:** ai.ts was using wrong API endpoint
  - Wrong: `https://gateway.ai.cloudflare.com/v1/anthropic/messages` (Cloudflare's gateway)
  - Correct: `https://ai-gateway.vercel.sh/v1/chat/completions` (Vercel AI Gateway)
- Also fixed response parsing (Vercel uses OpenAI-compatible format, not Anthropic format)

### Lessons Learned
- **Vercel AI Gateway uses OpenAI-compatible API format:**
  - Endpoint: `https://ai-gateway.vercel.sh/v1/chat/completions`
  - Auth: `Authorization: Bearer ${API_KEY}` (not x-api-key)
  - Request: Uses `messages` array with `role: "system"` (not separate `system` field)
  - Response: `choices[0].message.content` (not `content[0].text`)
  - Tokens: `usage.prompt_tokens` (not `usage.input_tokens`)
- **Always verify API endpoints against current documentation before implementing**
- Model ID format for Vercel AI Gateway is `provider/model-name` (e.g., `anthropic/claude-sonnet-4-5`)

### Files Created
```
supabase/functions/_shared/
├── supabase.ts    # Supabase client + getAuthenticatedUser
├── prompts.ts     # loadActivePromptConfig, interpolateTemplate
├── ai.ts          # callAI with logging (fixed to use Vercel AI Gateway)
└── cors.ts        # CORS helpers
```

### Suggestions for Next Steps
- Create parse-brain-dump Edge Function
- Create brain dump input UI
- Test the full flow with actual AI calls

---

## [2024-12-27 - Session 3] Phase 3.2: Edge Functions & Brain Dump UI

### What I Attempted
- Create parse-brain-dump Edge Function
- Create brain dump input UI at /create
- Create generate-research Edge Function (Perplexity)
- Create generate-outlines Edge Function
- Create auth callback route
- Create AI model sync system

### What Happened
- Created 3 Edge Functions:
  - `parse-brain-dump` - Extracts themes from raw brain dump
  - `generate-research` - Uses Perplexity for real-time research
  - `generate-outlines` - Generates detailed content outlines
- Created `/create` page with brain dump input UI
- Created `/auth/callback` route for Supabase OAuth
- Created dynamic AI model sync system:
  - CLI script: `scripts/sync-ai-models.ts`
  - API route: `/api/admin/sync-models`
  - Fetches from `https://ai-gateway.vercel.sh/v1/models`
- Added comprehensive image generation models to database

### Documentation Errors Fixed
1. **Vercel AI Gateway URL** - Was pointing to Cloudflare's AI Gateway
2. **Next.js version** - Was 15, should be 16
3. **Image generation model** - gemini-2.0-flash mislabeled as image model

### Files Created
```
supabase/functions/
├── parse-brain-dump/index.ts   # Brain dump parser
├── generate-research/index.ts  # Perplexity research
└── generate-outlines/index.ts  # Outline generator

src/app/
├── (dashboard)/create/page.tsx # Brain dump input UI
├── auth/callback/route.ts      # OAuth callback
└── api/admin/sync-models/route.ts # Model sync API

scripts/
└── sync-ai-models.ts           # CLI model sync
```

### Lessons Learned
- Vercel AI Gateway has an API at `/v1/models` to list all available models
- AI models change weekly - need automated sync system
- Image generation uses different models than text (Imagen, FLUX, DALL-E)
- Auth callback route is required for Supabase email confirmation flow

### Suggestions for Next Steps
- Create research review UI
- Create outline selection UI
- Test full pipeline end-to-end
- Deploy Edge Functions to Supabase

---

## [2024-12-29 - Session] Brand Guidelines System

### What I Attempted
- Create database-driven brand guidelines system
- Replace hardcoded LEJ brand guidelines with configurable database records
- Add per-prompt guideline defaults in Prompt Manager
- Add runtime guideline overrides on generation pages
- Create full CRUD for guidelines in Settings

### What Happened
- Created `brand_guidelines` table with RLS policies
- Created `prompt_guidelines` junction table for per-prompt defaults
- Created Next.js utility `src/lib/supabase/guidelines.ts`
- Created Edge Function utility `supabase/functions/_shared/guidelines.ts`
- Created `GuidelineToggle` component for runtime overrides
- Created `GuidelinesManager` component for Settings page CRUD
- Updated `generate-image-prompt` Edge Function to use database guidelines
- Added Guidelines tab to Prompt Manager for setting defaults

### Files Created
```
supabase/migrations/
└── 20241229000001_brand_guidelines.sql  # Schema + RLS + seed data

src/lib/supabase/
└── guidelines.ts                         # Loading/saving guidelines

supabase/functions/_shared/
└── guidelines.ts                         # Edge Function guidelines utility

src/components/
├── guideline-toggle.tsx                  # Runtime override checkboxes
└── guidelines-manager.tsx                # Full CRUD for Settings
```

### Files Modified
```
src/app/(dashboard)/outputs/page.tsx      # Added GuidelineToggle to Images tab
src/app/(dashboard)/settings/page.tsx     # Added GuidelinesManager
src/app/(dashboard)/prompts/page.tsx      # Added Guidelines tab to editor
supabase/functions/generate-image-prompt/index.ts  # Use DB guidelines
```

### Database Schema

**brand_guidelines:**
- `id`, `user_id`, `category`, `slug`, `name`, `content`, `is_active`, `sort_order`
- Categories: `image`, `voice` (extensible)
- RLS: Users can only access their own guidelines

**prompt_guidelines:**
- `id`, `prompt_set_id`, `guideline_id`, `is_default`
- Junction table linking prompts to their default guidelines

### Template Variable Convention
- Category `image` → Variable `{{image_guidelines}}`
- Category `voice` → Variable `{{voice_guidelines}}`
- All active guidelines in a category are concatenated when interpolated

### Default Image Guidelines Seeded
| Slug | Name | Content |
|------|------|---------|
| `lej_cinematic` | Cinematic Realism | Hyper-realistic, photorealistic - should look like a frame from a high-budget movie |
| `lej_anti_corporate` | Anti-Corporate | Avoid blazers, suits, offices, shared workspaces. Prefer influencer/creator aesthetic. |
| `lej_uniform` | LEJ Uniform | Characters wear fitted crop tops with "LEJ" in bold sans-serif. Black/white or grey/black. |
| `lej_diversity` | Diverse Representation | Prefer female protagonists. Weather-appropriate real clothing. |
| `lej_no_generic` | No Generic Imagery | No clip art, no cheesy illustrations, no glowing brains, no stock photo poses. |

### Lessons Learned
- Junction table pattern works well for many-to-many relationships with metadata (is_default flag)
- Auto-seeding defaults on first load provides good UX for new users
- Template variable naming convention (`{{category_guidelines}}`) allows auto-discovery
- Separating "defaults per prompt" from "runtime overrides" gives granular control

### Architecture Flow
1. User creates guidelines in Settings (stored in `brand_guidelines`)
2. Admin sets defaults per prompt in Prompt Manager (stored in `prompt_guidelines`)
3. At generation time, user can override which guidelines are active (passed to Edge Function)
4. Edge Function loads guidelines, applies overrides, builds template variables
5. Variables interpolated into prompt before AI call

---

## [2024-12-28 - Session] Meta Prompt Assembly System Refactor - Phase 1

### Background & Motivation

The user initiated a deep exploration of the prompt assembly system to understand how it works. During this exploration, we discovered significant architectural complexity:

- **10 separate Edge Functions** all doing essentially the same thing: load prompt → load settings → load guidelines → interpolate → call AI → log result
- **Two conflicting model selection strategies**: 7 functions load models from `prompt_versions.model_id` (correct), but 2 functions load from `app_settings` (inconsistent)
- **Platform specs hardcoded** in Edge Functions rather than database-driven
- **Three distinct model types** (text, image, research) with different API patterns, but no explicit classification in the database
- **Confusing split** between `/prompts` and `/settings` pages with overlapping concerns

The user had a breakthrough insight: "Doesn't that feel a little fucking insane? Couldn't we have one universal edge function?"

### The Vision

Consolidate everything into:
1. **One universal Edge Function** (`POST /functions/v1/generate`) that handles all AI generation
2. **One Prompt Studio UI** with tabs for Templates, Models, Destinations, Guidelines, and Test
3. **Database-driven everything** — zero hardcoded values, full CRUD for all configuration

### What I Attempted (Phase 1: Database Schema)

Phase 1 focuses on preparing the database schema without breaking existing code:

1. **Extend `ai_models` table** with:
   - `model_type` classification ('text', 'image', 'research')
   - Prompting guidance columns (system_prompt_tips, preferred_format, quirks)
   - Type-specific config (image_config JSONB, research_config JSONB)
   - Default parameters (temperature, max_tokens)
   - API notes and endpoint overrides

2. **Create `destinations` table** for platform-specific configuration:
   - YouTube, TikTok, Substack, LinkedIn, Twitter, etc.
   - Each has specs (aspect ratios, character limits), prompt instructions, tone modifiers

3. **Add `examples` column** to `brand_guidelines` for demonstration content

4. **Seed destinations** with 8 platforms across 3 categories (video, social, newsletter)

5. **Seed model configs** with comprehensive type-specific settings for all 18+ models

6. **Migrate voice_guidelines** to brand_guidelines with category='voice'

### What Happened

**Migration 1: Extend ai_models** (`20241228000001_extend_ai_models.sql`)
- Added `model_type` column with CHECK constraint for 'text', 'image', 'research'
- Added prompting guidance: system_prompt_tips, preferred_format, format_instructions, quirks
- Added type-specific JSONB configs: image_config, research_config
- Added API specifics: api_endpoint_override, api_notes
- Added defaults: default_temperature (0.7), default_max_tokens (4096)
- All columns are nullable or have defaults — existing code unaffected

**Migration 2: Create destinations** (`20241228000002_create_destinations.sql`)
- Created destinations table with slug, name, category, specs, prompt_instructions, tone_modifiers
- Added RLS policies (authenticated users can read, service role can manage)
- Added trigger for updated_at

**Migration 3: Add examples to brand_guidelines** (`20241228000003_add_guideline_examples.sql`)
- Added examples JSONB column with default empty array
- This will be used for showing example content that demonstrates each guideline

**Migration 4: Seed destinations** (`20241228000004_seed_destinations.sql`)
- Seeded 8 destinations across 3 categories:
  - **Newsletter**: Substack
  - **Video (long-form)**: YouTube
  - **Video (short-form)**: TikTok, YouTube Shorts, Instagram Reels
  - **Social**: LinkedIn, Twitter/X, Facebook
- Each has category-appropriate specs and prompt instructions
- Example: YouTube has `[B-ROLL: description]` markers, TikTok has "hook in first 2 seconds"

**Migration 5: Seed model configs** (`20241228000005_seed_model_configs.sql`)
- This was the big one — comprehensive configuration for all AI models:
  - **Anthropic Claude** (text): XML-structured prompting tips, 0.7 temp
  - **Google Gemini** (text): Markdown preference, massive context windows
  - **Perplexity** (research): Citation handling, 0.3 temp for accuracy
  - **Google Imagen** (image): Aspect ratio-based config, no negative prompts
  - **OpenAI DALL-E** (image): Size-based config (1024x1024, etc.)
  - **BFL FLUX** (image): Pixel-based config, supports negative prompts
- Added Nano Banana Pro (google/gemini-3-pro-image) with special capabilities
- Each model gets appropriate provider_options_key for Vercel AI SDK

**Migration 6: Migrate voice_guidelines** (`20241228000006_migrate_voice_guidelines.sql`)
- Copies voice_guidelines to brand_guidelines with category='voice'
- Generates unique slugs from name + UUID fragment
- Does NOT drop voice_guidelines yet (cleanup in Phase 5)
- Migrated 0 rows (no voice guidelines existed yet)

**Push to Supabase**
- Used `--include-all` flag since migrations were dated before last remote migration
- All 6 migrations applied successfully
- No errors, no data loss

### Technical Decisions Made

**1. Three Model Types, Not Two**
Initially considered just "text" and "image", but Perplexity requires special handling:
- Returns `citations[]` array in response (other models don't)
- Needs lower temperature (0.3) for factual accuracy
- Different response parsing logic needed

**2. Provider-Specific Image Config**
Image models need different parameters based on provider:
- **Google**: Uses `aspectRatio` (e.g., "16:9")
- **OpenAI**: Uses `size` (e.g., "1024x1024")
- **BFL**: Uses `width/height` pixels

The `image_config.provider_options_key` field tells the universal Edge Function which format to use.

**3. Destinations vs Outputs**
Considered calling this table "outputs" or "platforms" but "destinations" is clearer — it's WHERE the content is going, which determines HOW it should be formatted.

**4. Nullable New Columns**
All new columns are nullable or have sensible defaults. This means:
- Existing code continues to work unchanged
- Migrations are non-breaking
- We can populate data incrementally

**5. Voice Guidelines Migration Approach**
Rather than modifying voice_guidelines in place, we:
1. Copy to brand_guidelines (preserves original)
2. Mark voice_guidelines as DEPRECATED in comments
3. Drop in Phase 5 after verifying everything works

This is defensive migration — rollback is trivial.

### Lessons Learned

1. **Migration Ordering Matters**: Supabase applies migrations alphabetically by filename, not by creation date. Had to use `--include-all` flag for migrations dated before the last remote migration.

2. **Model-Specific Knowledge is Valuable**: Each AI model has quirks. Claude loves XML. Gemini has massive context. FLUX supports negative prompts. Storing this in the database means we can leverage it in prompts.

3. **Non-Breaking First**: By making all schema changes additive (new columns with defaults), we can evolve the database without breaking existing code. The universal Edge Function (Phase 2) will read these new columns; existing functions ignore them.

4. **The Three Model Types Are Real**: Text, image, and research models genuinely need different handling. This isn't just classification — it determines API patterns, response parsing, and available options.

### Files Created

```
supabase/migrations/
├── 20241228000001_extend_ai_models.sql      # Model type + configs
├── 20241228000002_create_destinations.sql   # Destinations table
├── 20241228000003_add_guideline_examples.sql # Examples column
├── 20241228000004_seed_destinations.sql     # 8 platforms seeded
├── 20241228000005_seed_model_configs.sql    # All models configured
└── 20241228000006_migrate_voice_guidelines.sql # Voice → Brand migration

plans/
└── meta-prompt-assembly-refactor.md         # Full refactor plan (~1000 lines)
```

### Database Schema Changes Summary

**ai_models table now has:**
```sql
model_type TEXT ('text' | 'image' | 'research')
system_prompt_tips TEXT
preferred_format TEXT
format_instructions TEXT
quirks JSONB
image_config JSONB  -- provider_options_key, dimensions, aspect_ratios
research_config JSONB -- returns_citations, recency options
api_endpoint_override TEXT
api_notes TEXT
default_temperature NUMERIC(3,2)
default_max_tokens INTEGER
```

**destinations table (new):**
```sql
slug TEXT UNIQUE
name TEXT
category TEXT ('video' | 'social' | 'newsletter')
specs JSONB
prompt_instructions TEXT
tone_modifiers JSONB
is_active BOOLEAN
sort_order INTEGER
```

### Suggestions for Next Steps

**Phase 2: Universal Edge Function**
- Create `supabase/functions/generate/index.ts`
- Implement assembly logic that:
  1. Loads prompt template by slug
  2. Loads model config (with type-specific handling)
  3. Loads destination config (if specified)
  4. Loads user guidelines
  5. Assembles system prompt with all variables
  6. Calls appropriate AI handler (text/image/research)
  7. Logs the call and returns structured response

**Phase 3: Frontend Migration**
- Create `useGenerate()` hook
- Update each page to use new endpoint
- Regression test full journey

**Phase 4: Prompt Studio UI**
- Build the tabbed interface
- The "Test" tab is the killer feature — preview assembled prompts before execution

**Phase 5: Cleanup**
- Delete 10 old Edge Functions
- Drop voice_guidelines table
- Remove obsolete app_settings

---

## [2024-12-28 - Session] Meta Prompt Assembly System Refactor - Phase 2

### What I Attempted

Phase 2 focused on creating the universal Edge Function that consolidates all 10 existing functions into one.

### What Happened

**Created Shared Utilities:**
- `supabase/functions/_shared/models.ts` - Model configuration loader with type-specific handling
- `supabase/functions/_shared/destinations.ts` - Destination configuration loader

**Created Universal Edge Function:**
- `supabase/functions/generate/index.ts` - The one function to rule them all

**Key Features of Universal Endpoint:**

1. **Three Model Types Handled Differently:**
   - **Text Models**: Stream via SSE, standard chat completions
   - **Image Models**: Use `/images/generations` endpoint with provider-specific configs
   - **Research Models**: Parse citations array from Perplexity response

2. **Provider-Specific Image Config:**
   - Google models use `aspectRatio`
   - OpenAI models use `size`
   - BFL models use `width/height` pixels

3. **Destination-Aware Assembly:**
   - Loads destination specs (character limits, aspect ratios, etc.)
   - Builds `{{destination_requirements}}` variable for prompt interpolation
   - Tone modifiers automatically applied

4. **Full AI Logging:**
   - Every call logged to `ai_call_logs` table
   - Includes full prompt, response, token counts, duration

**Authentication Bug Fixed:**
- Initial deployment returned `Cannot read properties of undefined (reading 'getUser')`
- Issue: `getAuthenticatedUser()` was being called with `Request` instead of `SupabaseClient`
- Fixed by properly extracting auth header and creating client first

**Successful Tests:**
- Text generation: Returned themes and insights correctly
- Destination override: YouTube destination specs applied to response

### Files Created

```
supabase/functions/
├── _shared/
│   ├── models.ts        # loadModelConfig(), loadAvailableModels()
│   └── destinations.ts  # loadDestination(), buildDestinationRequirements()
└── generate/
    └── index.ts         # Universal generate endpoint
```

### API Design

**Request:**
```typescript
POST /functions/v1/generate
{
  prompt_slug: string;       // Required: e.g., "brain_dump_parser"
  session_id?: string;       // Optional: for logging/state
  variables: Record<string, string>;  // Template variables
  overrides?: {
    model_id?: string;       // Override prompt's default model
    destination_slug?: string; // Apply platform-specific requirements
    temperature?: number;
    max_tokens?: number;
    guideline_overrides?: Record<string, boolean>;
  };
  stream?: boolean;          // Enable SSE streaming (text only)
}
```

**Response (text):**
```typescript
{
  success: true,
  content: string,          // AI response
  meta: {
    model_used: string,
    model_type: "text" | "image" | "research",
    prompt_version: number,
    destination_applied?: string,
    tokens_in: number,
    tokens_out: number,
    duration_ms: number
  }
}
```

**Response (image):**
```typescript
{
  success: true,
  image: {
    base64: string,
    media_type: string,
    storage_url?: string   // If uploaded to Supabase Storage
  },
  meta: { ... }
}
```

**Response (research):**
```typescript
{
  success: true,
  content: string,
  citations: string[],     // URLs from Perplexity
  meta: { ... }
}
```

### Lessons Learned

1. **Model Type Determines API Pattern**: Text models use chat completions, image models use /images/generations, research models need citation parsing. Having `model_type` in the database makes the universal function possible.

2. **Auth Header Must Be Extracted Manually**: Supabase Edge Functions receive the auth token in the Authorization header, but you must manually create a client with it — the automatic client doesn't work for user context.

3. **Provider Options Vary Significantly**: Google uses `aspectRatio`, OpenAI uses `size`, BFL uses `width/height`. Storing `provider_options_key` in the model config enables automatic adaptation.

4. **SSE Streaming Requires Special Handling**: The streaming response needs to write `data: ` prefix and `data: [DONE]` suffix to conform to SSE standard that the frontend expects.

---

## [2024-12-28 - Session] Meta Prompt Assembly System Refactor - Phase 3

### What I Attempted

Phase 3 focused on migrating the frontend from direct Edge Function calls to the new universal endpoint via a React hook.

### What Happened

**Created Universal Generate Hook:**
- `src/hooks/use-generate.ts` with three exports:
  - `useGenerate()` - Main hook for all generation
  - `useGenerateJSON<T>()` - Convenience hook that parses JSON responses
  - `useResearch()` - Convenience hook for Perplexity research

**Updated All Dashboard Pages:**

| Page | Old Endpoint(s) | New Usage |
|------|-----------------|-----------|
| `/create` | `parse-brain-dump` | `useGenerateJSON` with `brain_dump_parser` |
| `/research` | `generate-research` | `useGenerateJSON` with `generate_research` |
| `/outline` | `generate-outlines` | `useGenerateJSON` with `generate_outlines` |
| `/draft` | `generate-draft`, `check-voice` | `useGenerate` (streaming) + `useGenerateJSON` |
| `/outputs` | `generate-youtube-script`, `generate-tiktok-script`, `generate-image-prompt`, `generate-image` | Multiple `useGenerateJSON` and `useGenerate` hooks |

**Pattern Used:**

```tsx
// Before: Direct fetch
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-research`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ theme, description, session_id }),
  }
);
const data = await response.json();

// After: Universal hook
const { generateJSON, isLoading, error } = useGenerateJSON<ResearchResult>();

const result = await generateJSON({
  prompt_slug: "generate_research",
  session_id: sessionId || undefined,
  variables: {
    content: theme.trim(),
    description: additionalContext.trim() || "",
  },
  overrides: {
    model_id: "perplexity/sonar-pro",
  },
});
```

**TypeScript Fixes Required:**
- Added `loadError` state for database loading errors (separate from generation errors)
- Fixed `session_id` type coercion (`null` → `undefined`)

**Build Verification:**
- TypeScript passes with no errors
- Next.js build succeeds
- All pages generate correctly

### Files Created/Modified

```
src/hooks/
└── use-generate.ts          # NEW: Universal generate hook

src/app/(dashboard)/
├── create/page.tsx          # Updated: useGenerateJSON
├── research/page.tsx        # Updated: useGenerateJSON
├── outline/page.tsx         # Updated: useGenerateJSON
├── draft/page.tsx           # Updated: useGenerate (streaming) + useGenerateJSON
└── outputs/page.tsx         # Updated: 4x useGenerateJSON/useGenerate hooks
```

### Hook API

```typescript
interface GenerateOptions {
  prompt_slug: string;
  session_id?: string;
  variables: Record<string, string>;
  overrides?: {
    model_id?: string;
    destination_slug?: string;
    temperature?: number;
    max_tokens?: number;
    guideline_overrides?: Record<string, boolean>;
  };
  stream?: boolean;
}

// Main hook
const { generate, isLoading, result, error, streamedContent, reset } = useGenerate();

// JSON parsing variant
const { generateJSON, isLoading, error } = useGenerateJSON<T>();

// Research convenience hook
const { research, isLoading, error } = useResearch();
```

### Benefits of New Architecture

1. **Single Point of Change**: Any prompt assembly logic changes happen in one place (the Edge Function)

2. **Type Safety**: `useGenerateJSON<T>()` provides typed responses with automatic JSON parsing

3. **Streaming Support**: The hook handles SSE parsing and state updates automatically

4. **Error Handling**: Consistent error handling across all pages through the hook

5. **Loading States**: Built-in `isLoading` state eliminates boilerplate

6. **Model/Destination Flexibility**: Any page can now request any model or destination with simple override options

### Lessons Learned

1. **Separate Loading Errors from Generation Errors**: Pages that load data from the database before generating need separate error states. The hook manages generation errors; the component manages loading errors.

2. **Type Coercion for Optional Fields**: TypeScript distinguishes `null` from `undefined`. When passing `sessionId || undefined`, it correctly converts `null` to `undefined` for optional parameters.

3. **Multiple Hooks Per Page is Fine**: The outputs page uses 4 different hook instances for different generation types. Each manages its own state independently.

4. **Streaming State Updates**: The `streamedContent` state in the hook updates progressively, allowing the UI to show content as it arrives.

---

## Phase 3 Complete!

**Status:** Frontend migration completed successfully
- Universal generate hook created ✓
- All 5 dashboard pages migrated ✓
- TypeScript passes ✓
- Build succeeds ✓

**Next:**
- Phase 4: Prompt Studio UI
- Phase 5: Cleanup old Edge Functions
- Update CHANGELOG.md
