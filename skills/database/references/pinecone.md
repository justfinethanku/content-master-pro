# Pinecone (Vector Store)

## Table of Contents
- Scope
- Environment Variables
- How to Interact
- Index and Namespace Conventions
- Scripts and Workflows
- Safety Checks
- Code Touchpoints
- Troubleshooting

## Scope
Use this reference for Pinecone indexing, reindexing, namespace management, and any workflow that touches vector data.

## Environment Variables
Set these in `.env.local` (see `.env.example`):
- `PINECONE_API_KEY` (required)
- `PINECONE_INDEX` (optional; defaults to `content-master-pro-v2` in code)
- `VERCEL_AI_GATEWAY_API_KEY` (required for embedding scripts)

Note: `PINECONE_HOST` appears in `.env.example` and test setup, but the runtime client in `src/lib/pinecone/client.ts` only uses the API key and index name.

## How to Interact
- This repo uses the Pinecone TypeScript SDK (not a CLI).
- Client entrypoint: `src/lib/pinecone/client.ts`.
- Create client: `getPineconeClient()`.
- Select index: `getPineconeIndexName()`.
- Select namespace: `getPineconeNamespace(namespace)`.

If you plan to use a Pinecone CLI or the Pinecone console for manual inspection, confirm with the repo owner first. No CLI workflow is defined in this repo.

## Index and Namespace Conventions
- Index name defaults to `content-master-pro-v2` if `PINECONE_INDEX` is not set.
- Namespace configuration is database-driven via the `pinecone_namespaces` table.
- Schema and seed data live in `supabase/migrations/20260110000001_pinecone_namespaces.sql`.
- Keep `src/lib/pinecone/namespaces.ts` in sync with the table (see `NAMESPACE_SLUGS`).

## Scripts and Workflows
All scripts load `.env.local` via `dotenv` and run with `npx tsx`.
- `scripts/reindex-all.ts` re-embeds all posts and clears target namespaces with `deleteAll`.
- `scripts/import-posts.ts` imports markdown posts from absolute paths in `PATHS`; update these paths on non-Jonathan machines.
- `scripts/sync-nate-full.ts` syncs posts and upserts Pinecone vectors.
- `scripts/reindex-all.ts --dry-run` or `scripts/import-posts.ts --dry-run` is the safe first step.

## Safety Checks
- Confirm `PINECONE_INDEX` before any write.
- Run dry-run first whenever available.
- Do not run scripts that call `deleteAll` without explicit approval.

## Code Touchpoints
- Pinecone client: `src/lib/pinecone/client.ts`
- Namespace helpers: `src/lib/pinecone/namespaces.ts`
- Search and embedding flows: `src/lib/pinecone/search.ts`, `src/lib/pinecone/embed-research.ts`, `src/lib/pinecone/search-research.ts`
- API routes that write Pinecone: `src/app/api/sync/route.ts`, `src/app/api/cron/sync/route.ts`

## Troubleshooting
- Missing env: check `.env.local` and run the script from repo root.
- Index mismatch: set `PINECONE_INDEX` explicitly for the target environment.
- Namespace mismatch: verify `pinecone_namespaces` table and `NAMESPACE_SLUGS`.
- Embedding errors: confirm `VERCEL_AI_GATEWAY_API_KEY` and that the embedding model is available.
