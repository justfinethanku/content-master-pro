# Content Master Pro

Personal content creation platform that transforms brain dumps into multi-platform deliverables.

## Quick Start

```bash
npm run dev      # Start development server (localhost:3000)
npm run lint     # Run ESLint
npm run test     # Run Vitest tests
npm run format   # Run Prettier
```

## Local Development (Supabase)

Run a local Supabase instance via Docker for development. This keeps your production database safe.

### Prerequisites

- Docker Desktop running
- Supabase CLI: `brew install supabase/tap/supabase`

### Starting Local Supabase

```bash
# Start local Supabase (first time pulls Docker images ~2-3 min)
npm run supabase:start

# Output shows connection info:
#   API URL: http://127.0.0.1:54321
#   anon key: eyJhbGciOiJIUzI1NiIs...
#   service_role key: eyJhbGciOiJIUzI1NiIs...
```

### Switching to Local Database

Run the setup script to generate `.env.local` automatically:

```bash
npm run supabase:env
```

This extracts keys from `supabase status` and creates `.env.local`. Any existing non-Supabase env vars (like PINECONE keys) are preserved.

To switch back to production: delete `.env.local`.

### Local URLs

| Service | URL |
|---------|-----|
| API | http://127.0.0.1:54321 |
| Studio (DB GUI) | http://127.0.0.1:54323 |
| Inbucket (email) | http://127.0.0.1:54324 |
| Database | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

### Test Credentials (Local Only)

Create a test admin user via the Auth API (resilient to Supabase version changes):

```bash
npm run supabase:seed-user
```

- Email: `test@example.com`
- Password: `password123`

### Common Commands

```bash
npm run supabase:start      # Start local containers
npm run supabase:stop       # Stop local containers
npm run supabase:status     # Show status and keys
npm run supabase:env        # Generate .env.local from local Supabase
npm run supabase:seed-user  # Create test admin user via Auth API
npm run supabase:reset      # Reset DB (runs migrations only)
npm run supabase:diff       # Generate migration from schema changes
npm run supabase:push       # Push migrations to remote
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Auth & DB | Supabase (PostgreSQL) |
| Vector Search | Pinecone |
| AI | Vercel AI Gateway (Claude, Gemini, Perplexity) |
| Data Fetching | TanStack Query |
| Testing | Vitest + Testing Library |

## Project Structure

```
content-master-pro/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth pages (login, signup)
│   │   ├── (dashboard)/        # Protected dashboard pages
│   │   └── api/                # API routes
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── supabase/           # Supabase clients
│   │   ├── pinecone/           # Pinecone client
│   │   ├── utils.ts            # Utility functions
│   │   ├── constants.ts        # App constants
│   │   └── types.ts            # TypeScript types
│   └── hooks/                  # Custom React hooks
├── supabase/
│   └── migrations/             # Database migrations
├── docs/
│   ├── decisions/              # Architecture Decision Records
│   ├── learnings.md            # Accumulated lessons
│   └── phase-summaries/        # Build phase summaries
├── CLAUDE.md                   # This file
├── BUILD_LOG.md                # Detailed build narrative
└── CHANGELOG.md                # All changes
```

## Engineering Rules (MANDATORY)

All code must follow these 14 rules.

### Rule 1: No Hardcoded Values
**Any value that might change must be configurable** (database, env var, or config file):
- API parameters (temperatures, token limits, aspect ratios)
- Model IDs and model-specific settings
- Feature flags and limits
- Prompt content
- Edge Function settings → use `app_settings` table

### Rule 2: Database-Driven AI Model Configuration
**ALL AI MODELS MUST BE REFERENCED FROM THE DATABASE. NEVER HARDCODE MODEL IDs.**
```typescript
// ✅ CORRECT: Fetch model from database
const config = await loadActivePromptConfig('brain_dump_parser');

// ❌ WRONG: Hardcoded model ID
const modelId = "anthropic/claude-sonnet-4-5"; // DO NOT DO THIS
```

### Rule 3: Database-Driven Prompt Management
All prompts stored in database with UI for modification. Required tables:
- `prompt_sets` - Groups prompts by purpose
- `prompt_versions` - Versioned content with status
- `ai_models` - All model configurations

### Rule 4: Prompt Manager UI Required
Every prompt must be editable through a web UI:
- CRUD for prompt sets
- Version management (draft → active → archived)
- Model selection per prompt
- Variable interpolation preview
- Test prompt button

### Rule 5: Edge Function Architecture
All AI calls go through Supabase Edge Functions:
```
Next.js → Edge Function → Vercel AI Gateway → Provider
```
Each Edge Function must:
1. Load settings from `app_settings` table
2. Load prompt config from database
3. Interpolate template variables
4. Call AI provider with configured model
5. Log the call and return structured response

### Rule 6: SSE Streaming for Long Responses
Use Server-Sent Events for AI responses >2 seconds (drafts, research, outlines).

### Rule 7: Single Source of Truth
Every reusable element has ONE canonical location:
- Colors → `globals.css` CSS variables
- Utilities → `@/lib/utils`
- Types → `@/lib/types`
- Components → `@/components/ui/`
- Settings → `app_settings` table

### Rule 8: Testing & Code Quality
Required tooling: ESLint, Prettier, Vitest
```json
{
  "lint": "next lint",
  "test": "vitest",
  "format": "prettier --write ."
}
```

### Rule 9: Documentation Accuracy
All documentation must reflect current reality:
- Model names must be accurate
- File paths must exist
- Code examples must compile
- Update docs when code changes

### Rule 10: Living Documentation System
The build documents itself for continuous improvement:
- `CLAUDE.md` - Primary context (updated as we learn)
- `BUILD_LOG.md` - Detailed build narrative
- `CHANGELOG.md` - All changes in reverse chronological order

### Rule 11: Proactive Research
Don't rely solely on training data. Before implementing major features, research:
- Current API patterns
- UI/UX best practices
- Accessibility standards (WCAG, ARIA)
- Security best practices

### Rule 12: Contrast and Visibility (CRITICAL)
**NO WHITE TEXT ON WHITE BACKGROUNDS. NO BLACK TEXT ON BLACK BACKGROUNDS.**
- WCAG AA contrast minimum (4.5:1 for normal text)
- Test BOTH dark mode and light mode
- Use CSS custom properties for ALL colors
```tsx
// ✅ CORRECT
<p className="text-foreground">Visible text</p>
<p className="text-muted-foreground">Muted text</p>

// ❌ WRONG
<p className="text-white">Might be invisible</p>
```

### Rule 13: AI Call Logging
Every AI call logged to `ai_call_logs` table:
- `full_prompt` - Complete request sent
- `full_response` - Entire AI response
- `model_id`, `tokens_in`, `tokens_out`, `duration_ms`

### Rule 14: Plan Tracking
All implementation plans must be tracked:
- Copy plans from `~/.claude/plans/` to `./plans/<descriptive-name>.md`
- Update the plan during implementation (check off completed items)
- Mark status when finished: add `## Status: ✅ Complete` at the top
- Keep completed plans for reference (don't delete)

**See `CLAUDE-PLAN.md` for the full planning workflow.** Use it when:
- Task touches 3+ files
- Multiple valid implementation approaches exist
- Architectural decisions are needed
- You're unsure of the full scope

## Database Tables

### Core Content
- `content_sessions` - Full pipeline tracking
- `content_brain_dumps` - Raw input with extracted themes
- `content_research` - Perplexity research results
- `content_outlines` - Generated outlines
- `content_drafts` - Full drafts with voice scores
- `content_outputs` - Final deliverables

### Prompt Management
- `prompt_sets` - Prompt groupings by purpose
- `prompt_versions` - Versioned prompts (draft/active/archived)
- `ai_models` - Model configurations
- `ai_call_logs` - Full audit trail

### Content Library
- `imported_posts` - Jon's and Nate's posts
- `sync_manifests` - Sync status tracking

### Configuration
- `app_settings` - All configurable values (Edge Function params, feature flags, limits)
  - `category` - Setting category (e.g., "edge_function", "general")
  - `key` - Setting key (e.g., "generate_research_temperature")
  - `value` - JSON value (e.g., `{"value": 0.3}`)

### Vector Database
- `pinecone_namespaces` - Database-driven Pinecone namespace configuration
  - `slug` - Namespace identifier in Pinecone (e.g., "jon", "nate", "research")
  - `display_name` - Human-readable name for UI
  - `source_type` - Category: "newsletter", "documentation", "research"
  - `is_active` - Enable/disable namespace
  - `is_searchable` - Include in search results

## AI Models (Vercel AI Gateway format)

**API Endpoint:** `https://ai-gateway.vercel.sh/v1/chat/completions` (OpenAI-compatible)
**Auth Header:** `Authorization: Bearer ${VERCEL_AI_GATEWAY_API_KEY}`

### Text Generation Models

| Model ID | Use Case |
|----------|----------|
| `anthropic/claude-sonnet-4-5` | Primary text generation |
| `anthropic/claude-haiku-4-5` | Fast, cost-effective |
| `anthropic/claude-opus-4-5` | Complex reasoning |
| `perplexity/sonar-pro` | Web research with citations |
| `google/gemini-2.0-flash` | Fast multimodal (text) |

### Image Generation Models

| Model ID | Provider | Use Case |
|----------|----------|----------|
| `google/gemini-3-pro-image` | Google | Nano Banana Pro - Advanced diagrams, web search integration |
| `google/imagen-4.0-generate` | Google | Imagen 4.0 - Standard quality |
| `google/imagen-4.0-fast-generate` | Google | Imagen 4.0 Fast - Optimized for speed |
| `google/imagen-4.0-ultra-generate` | Google | Imagen 4.0 Ultra - Highest quality |
| `openai/dall-e-3` | OpenAI | DALL·E 3 - Creative imagery |
| `bfl/flux-2-pro` | Black Forest Labs | FLUX 2 Pro - Latest FLUX model |
| `bfl/flux-pro-1.1-ultra` | Black Forest Labs | FLUX 1.1 Pro Ultra - High quality |
| `bfl/flux-pro-1.1` | Black Forest Labs | FLUX 1.1 Pro - Balanced quality/speed |
| `bfl/flux-kontext-pro` | Black Forest Labs | FLUX Kontext - Context-aware editing |

**Note:** The model ID format is `provider/model-name`. Vercel AI Gateway uses OpenAI-compatible format (not native Anthropic format), so responses use `choices[0].message.content` and `usage.prompt_tokens`.

**Image Generation API:** Use `https://ai-gateway.vercel.sh/v1/images/generations` for image-only models.

### Keeping Models Up-to-Date

AI models change rapidly. Use the model sync system to keep the database current:

```bash
# CLI - sync new models from Vercel AI Gateway
npx tsx scripts/sync-ai-models.ts

# Dry run to preview changes
npx tsx scripts/sync-ai-models.ts --dry-run
```

Or call the admin API:
```bash
curl -X POST /api/admin/sync-models -H "Authorization: Bearer $TOKEN"
```

The sync fetches from `https://ai-gateway.vercel.sh/v1/models` and adds any new models to the database.

### Syncing Nate's Newsletter (Full Content)

**See [`CLAUDE-SYNC.md`](./CLAUDE-SYNC.md) for complete sync documentation.**

Quick start:
```bash
# 1. Start Chrome with CDP (one-time setup)
open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-substack-profile"

# 2. Log into Substack in that Chrome window

# 3. Run sync
npx tsx scripts/sync-nate-full.ts

# 4. (Optional) Enable daily automation
./scripts/manage-sync-schedule.sh install
```

**Current status:** 239 posts synced → 1,670 vectors in `nate` namespace with 20,000+ links preserved.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server component client |
| `src/lib/supabase/middleware.ts` | Session refresh |
| `src/lib/pinecone/client.ts` | Pinecone client |
| `src/lib/utils.ts` | Utility functions (cn, etc.) |
| `middleware.ts` | Auth route protection |
| `scripts/sync-nate-full.ts` | Full content sync for Nate's newsletter |
| `scripts/daily-sync.sh` | Shell wrapper for daily automated sync |
| `scripts/manage-sync-schedule.sh` | Install/manage macOS LaunchAgent |

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY     # For server-side operations
PINECONE_API_KEY              # Pinecone API key
PINECONE_HOST                 # Pinecone index host
VERCEL_AI_GATEWAY_API_KEY     # AI Gateway key
TEST_EMAIL                    # Test account email
TEST_PASSWORD                 # Test account password
```

**Test Credentials:** See `.env.local` for `TEST_EMAIL` and `TEST_PASSWORD` values.

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
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const results = await searchPosts(supabase, {
  query: "AI content creation",
  namespaces: ["jon", "nate"], // Optional: defaults to all searchable namespaces
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
