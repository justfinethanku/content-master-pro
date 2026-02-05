# Content Master Pro - Context

**Purpose**
- Personal content creation platform that turns brain dumps into multi-platform drafts with AI assistance.
- Built for a single primary user but includes partner-facing APIs and admin tooling.

**High-Level Architecture**
- Next.js 16 App Router with React 19 and Tailwind v4.
- Supabase is the system of record for auth and data.
- AI generation is centralized in a Supabase Edge Function (`supabase/functions/generate`).
- Pinecone powers semantic search and research retrieval.
- Vercel AI Gateway provides text, image, and embedding models.
- PWA support via `next-pwa`.

**Core Product Flows**
- Brain Dump → Research → Outline → Draft → Outputs.
- Semantic Search across imported newsletters (Pinecone namespaces).
- Swipe (news curation) → Captures (saved items).
- Studio (admin) for prompts, models, logs, destinations, guidelines.
- Partner API for third-party semantic search.

**Key Directories**
- `src/app/` App Router pages and API routes.
- `src/components/` UI components and feature components.
- `src/hooks/` React hooks, including AI generation.
- `src/lib/` Supabase clients, Pinecone utilities, AI helpers, types.
- `supabase/functions/` Edge Functions and shared utilities.
- `supabase/migrations/` Database schema changes.
- `scripts/` CLI utilities for sync, ingest, reindexing, model sync.

**Auth & Layout**
- Auth handled by Supabase; callback at `src/app/auth/callback/route.ts`.
- Protected routes are gated in `src/app/(dashboard)/layout.tsx`.

**AI + Prompt System**
- Prompts and model configs are database-driven (`prompt_sets`, `prompt_versions`, `ai_models`).
- Universal Edge Function (`supabase/functions/generate`) loads prompt config, model config, settings, guidelines, and logs every call.
- Client hook `src/hooks/use-generate.ts` calls the Edge Function via Supabase Functions endpoint.
- Search chat uses `src/app/api/search/chat/route.ts` with the Vercel AI SDK and DB-driven prompts.

**Embeddings & Search**
- Text embeddings use Vercel AI Gateway `text-embedding-3-large` via `src/lib/ai/embeddings.ts`.
- Semantic search for newsletters uses `src/lib/pinecone/search.ts` and database-driven namespaces (`pinecone_namespaces`).
- Research indexing uses `src/lib/pinecone/embed-research.ts` and the `research` namespace.

**Newsletter Sync**
- Manual sync: `POST /api/sync` in `src/app/api/sync/route.ts`.
- Cron sync: `GET /api/cron/sync` in `src/app/api/cron/sync/route.ts`.
- RSS fetch with optional `substack.sid` cookie for paywalled content.
- Chunking in `src/lib/chunking.ts` (word-based, ~800 words with overlap), upserted into Pinecone.

**Changelog Ingestion**
- Cron route `src/app/api/cron/ingest-changelogs/route.ts`.
- Uses RSS feeds where available and Perplexity for sources without feeds.

**Partner API**
- Public endpoints under `src/app/api/v1/*`.
- Uses API keys, rate limiting, namespace permissions, and usage logging in `src/lib/partner-api/*`.

**Environment Variables**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PINECONE_API_KEY`
- `PINECONE_HOST`
- `PINECONE_INDEX` (defaults if unset)
- `VERCEL_AI_GATEWAY_API_KEY`
- `PERPLEXITY_API_KEY` (changelog ingestion)
- `CRON_SECRET` (cron auth)

**Testing**
- Vitest configured in `vitest.config.ts` with setup in `src/test/setup.ts`.
- Minimal test coverage currently.

**Operational Notes**
- Rule: no hardcoded models or prompts; all should be DB-driven.
- Every AI call must be logged to `ai_call_logs`.
- Contrast rules: avoid `text-white`/`text-black`; use semantic tokens from `globals.css`.

