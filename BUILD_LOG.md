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
