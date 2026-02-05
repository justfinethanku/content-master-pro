---
name: database
description: Operate the Content Master Pro databases (Supabase Postgres and Pinecone vector store). Use for local DB startup/teardown, migrations and seeding, schema inspection, Supabase CLI workflows, Pinecone indexing/reindexing, namespace management, and any task touching `supabase/`, `supabase/migrations/`, `src/lib/supabase/`, `src/lib/pinecone/`, or `scripts/` that read or write these databases.
---

# Database

## Overview
Use this skill to safely work with Supabase Postgres and Pinecone in this repo. It covers local database operations, migration workflow and ordering, CLI usage, and Pinecone index/namespace workflows.

## Agent Checklist (NEAI)
1. Identify target system: Supabase Postgres vs Pinecone.
2. Confirm environment: local vs remote (never assume).
3. Load the correct reference file before acting:
   - Supabase: `references/supabase.md`
   - Pinecone: `references/pinecone.md`
4. Verify `.env.local` is present and required keys are set.
5. Use dry-run/status checks first.
6. Get explicit approval before destructive or remote writes.

## Decision Tree
- Postgres, migrations, or Supabase CLI → open `references/supabase.md`.
- Vector search, indexes, namespaces, or Pinecone scripts → open `references/pinecone.md`.
- Schema context → read `CLAUDE.md` and relevant files under `supabase/migrations/`.

## Known Repo-Specific Pitfalls
- `supabase/config.toml` references `supabase/seed.sql`, but that file is not in this repo.
- `scripts/import-posts.ts` uses absolute paths tied to Jonathan’s machine.
- `scripts/reindex-all.ts` calls Pinecone `deleteAll` and is destructive.
- `.env.example` includes `PINECONE_HOST`, but runtime Pinecone client only uses API key and index name.

## Safety Guardrails (Always)
- Confirm target environment before running any command.
- Do not run destructive commands (`supabase db reset`, `supabase db push`, `supabase migration repair`, Pinecone namespace `deleteAll`) without explicit approval.
- Never commit secrets; use `.env.local` and `dotenv` loading.
- Prefer dry-run or status checks first.

## Approvals & Contacts
- Primary approver for remote or destructive actions: repo owner (Jonathan Edwards).
- If approval is missing or unclear, stop and ask in the current thread.

## Repo Map (Signals)
- Supabase config and migrations: `supabase/config.toml`, `supabase/migrations/`
- Supabase edge functions: `supabase/functions/`
- Supabase clients: `src/lib/supabase/`
- Pinecone clients: `src/lib/pinecone/`
- DB scripts: `scripts/*.ts`
- Migration guidance: `docs/supabase-migration-best-practices.md`
- Env template: `.env.example`
