# Supabase (Postgres)

## Table of Contents
- Scope
- Prerequisites
- Local Stack + CLI
- Local DB Location
- Migrations (Order, Naming, Contents)
- Apply and Verify
- Seed Data
- Remote Operations
- Repair and Recovery
- Code Touchpoints
- Common Tricky Bits

## Scope
Use this reference for Supabase CLI workflows, Postgres schema changes, migrations, and local/remote database operations.

## Prerequisites
- Install the Supabase CLI and confirm it runs with `supabase --version`.
- Start Docker before using `supabase start`.
- Populate `.env.local` from `.env.example`. Do not commit secrets.

## Local Stack + CLI
- Start: `supabase start`
- Status and URLs: `supabase status`
- Stop: `supabase stop`

`supabase status` is the source of truth for local API URL, anon/service keys, and DB connection string. Use it to connect instead of guessing credentials.

Supabase Studio runs locally (see `supabase/config.toml`):
- Studio: `http://127.0.0.1:54323`

## Local DB Location
Supabase CLI runs the local stack in Docker. Postgres data lives in Docker volumes, not in the repo.
- Inspect running containers with `docker ps`.
- Inspect volumes with `docker volume ls`.
- Expect volume names to include the project id `content-master-pro`.

Do not edit `supabase/.temp/` or `supabase/.branches/` by hand. These are CLI state files.

## Migrations (Order, Naming, Contents)
- Location: `supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Ordering: Supabase applies migrations in lexicographic order by filename (timestamp order).
- Contents: DDL plus reference data inserts. This repo already includes reference data in migrations (example: `20241227000008_seed_prompts.sql`).
- Prefer idempotent statements (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

### Create a Migration
- Generate: `supabase migration new <slug>`
- Edit the generated SQL file under `supabase/migrations/`.
- Do not edit previously applied migration files; add a new migration instead.

## Apply and Verify
- Apply locally (drops and recreates local DB): `supabase db reset`
- Check status: `supabase migration list`
- Lint: `supabase db lint`
- Inspect history (SQL): `SELECT * FROM supabase_migrations.schema_migrations;`

## Seed Data
`supabase/config.toml` references `supabase/seed.sql`, but that file is not present.
- Treat required reference data as migrations unless a seed file is added.
- Keep test-only data out of migrations.

## Remote Operations
- Confirm the linked project before pushing: `supabase status`.
- Link if needed: `supabase link --project-ref <ref>`.
- Push migrations: `supabase db push`.

Do not push to production without explicit approval.

## Repair and Recovery
Use only with approval:
- Repair migration status: `supabase migration repair --status reverted <timestamp>`
- Re-check status: `supabase migration list`

## Code Touchpoints
- Supabase clients: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`
- Service role key is required for admin scripts. Keep it out of logs.

## Common Tricky Bits
- Local vs remote keys: local keys come from `supabase status` and are not the same as hosted keys.
- `supabase db reset` destroys local data and replays all migrations.
- Migrations that insert reference data should be idempotent to avoid duplicate rows.
