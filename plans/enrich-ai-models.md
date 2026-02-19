# Plan: Enrich AI Models Infrastructure

## Context

The Studio Models page currently shows basic model cards populated by a limited sync script that uses hardcoded metadata and only inserts new models. The Vercel AI Gateway actually provides rich data per model (description, pricing, tags, capabilities, release date) that we're not leveraging. Additionally, the Prompt editor's model dropdown shows all available models with no type filtering — prompts for image generation show text models and vice versa.

This plan enriches the model sync to pull all available gateway data, redesigns the Models page with rich auto-populated cards + availability toggles, and adds type-filtered model selection to the Prompt editor.

## Status: In Progress

---

## Phase 1: Database Migration

**File:** `supabase/migrations/YYYYMMDD_enrich_ai_models.sql`

Add new columns to `ai_models`:
- `description` TEXT — model description from gateway
- `pricing` JSONB — full pricing object (input/output/image/web_search/cache rates)
- `tags` JSONB DEFAULT '[]' — capability tags array (reasoning, vision, tool-use, etc.)
- `released_at` TIMESTAMPTZ — when model was released
- `gateway_type` TEXT — raw gateway type (language/image/embedding)

Change `is_available` default to `FALSE` (new models start hidden).

Add `model_type_filter` TEXT column to `prompt_sets` with CHECK constraint ('text', 'image', 'research'). Default 'text'. Backfill existing prompts based on their current model's type.

Add composite index on `(model_type, is_available)` for filtered queries.

---

## Phase 2: Sync API Route Rewrite

**File:** `src/app/api/admin/sync-models/route.ts`

Rewrite to:
- Fetch full model data from gateway (description, pricing, tags, released, type)
- Exclude embedding models (`type === 'embedding'`)
- **Upsert** instead of insert-only — update gateway fields on existing models
- **Preserve manual fields** on existing models: `is_available`, `system_prompt_tips`, `preferred_format`, `format_instructions`, `quirks`, `api_notes`, `default_temperature`, `default_max_tokens`, `image_config`, `research_config`, `model_type` (if manually overridden)
- New models default `is_available = false`
- Infer `model_type`: image type → 'image', perplexity provider → 'research', otherwise → 'text'
- Infer `supports_thinking` from `reasoning` tag
- Infer `supports_images` from `vision` tag or image type
- Return detailed sync report (new/updated/excluded counts)

Remove hardcoded `MODEL_METADATA` map — gateway now provides `name`, `context_window`, `max_tokens` directly.

---

## Phase 3: CLI Script Update

**File:** `scripts/sync-ai-models.ts`

Simplify: remove duplicated transform logic. Keep `--dry-run` mode (fetches gateway directly for preview). For actual sync, call the API route or duplicate the upsert logic with direct Supabase client (since dotenv was removed, use `process.loadEnvFile()` or read `.env.local` manually).

---

## Phase 4: Models Page Redesign

**File:** `src/app/(dashboard)/studio/models/page.tsx`

Update `AIModel` interface to include new fields (description, pricing, tags, released_at, gateway_type).

**Card redesign:**
- Header row: type icon + display name + type badge + **availability Switch** (inline on card, not in dialog)
- Model ID as subtitle
- Description paragraph (2-line clamp)
- Pricing row: formatted human-readable (e.g., "$3/M in, $15/M out" or "$0.04/image")
- Tags row: capability badges (reasoning, vision, tool-use, file-input, image-generation, implicit-caching)
- Specs row: context window, max output, release date
- Dimmed at 50% opacity when `is_available = false`
- Click card → opens editor dialog for **manual fields only** (system_prompt_tips, format_instructions, preferred_format, quirks, default_temperature, default_max_tokens, api_notes, model_type override)

**Availability toggle:** Optimistic UI update + Supabase update. Stops click propagation so it doesn't open the editor dialog.

**Pricing formatter:** Helper function that converts raw per-token strings to human-readable per-million format.

---

## Phase 5: Prompts Editor Update

**File:** `src/app/(dashboard)/studio/prompts/[id]/page.tsx`

Add model type filter:
- Load `model_type_filter` from `prompt_sets` row
- Add `model_type` to the model query: `select("id, model_id, provider, display_name, supports_thinking, model_type")`
- Add segmented button group above model dropdown: **Text** / **Image** / **Research**
- Filter model dropdown to only show models matching selected type AND `is_available = true`
- Clear model selection if switching types makes current selection invalid
- Save `model_type_filter` back to `prompt_sets` when saving the prompt

---

## Phase 6: Edge Function — No Changes

The Edge Function (`supabase/functions/_shared/models.ts` and `generate/index.ts`) uses `SELECT *` so it already gets new columns. The new columns (description, pricing, tags, etc.) are metadata-only and don't affect AI call routing. No code changes needed.

---

## Phase 7: Open Studio to All Users

Currently Studio is admin-gated (only `jon@contentionmedia.com` sees the sidebar link). Open it to all authenticated users with a warning banner.

**File:** `src/components/dashboard/sidebar.tsx`

- Move `{ name: "Studio", href: "/studio", icon: Sliders }` from `adminNavigation` into the main `navigation` array (keep the separator before it for visual grouping, or just append to main nav).
- Remove the `isAdmin` conditional rendering block that gates the admin section (since Studio was the only admin nav item, the whole block goes).
- Remove `ADMIN_EMAIL` constant and `isAdmin` check if no longer needed elsewhere.
- Keep `userEmail` prop — may be used by the warning banner in the layout.

**File:** `src/app/(dashboard)/studio/layout.tsx`

- Convert to server component (or keep client, fetch user session)
- Add a warning banner at the top of all Studio pages:
  - Rendered **above** the tab nav, inside a yellow/amber alert box
  - Text: "Studio is a configuration area. Changes here affect how the platform works. If you're not sure what you're doing, please don't modify anything."
  - Only shown to **non-admin** users (check `userEmail !== ADMIN_EMAIL` or equivalent)
  - Uses shadcn Alert component with `variant="warning"` or a custom amber-styled div
  - Admin users (`jon@contentionmedia.com`) see no banner

**Implementation note:** The layout is currently a client component using `usePathname`. To check the user's email, either:
- Accept `userEmail` as context from the dashboard layout (via React context or prop drilling), or
- Use `createClient()` browser client to fetch `supabase.auth.getUser()` in a useEffect
- Simplest approach: use the Supabase browser client since the sidebar already receives `userEmail` as a prop — pass it through the dashboard layout context that already exists, or fetch it directly in the Studio layout.

---

## Phase 8: Portable Playbook Document

**File:** `SCRAPBOOK/ai-models-enrichment-playbook.md`

Create a document that captures exactly what we did and provides enough context + instructions for Claude Code to replicate these patterns in other repos/databases. The document covers:

**What we did:**
- Synced rich model metadata from Vercel AI Gateway (description, pricing, tags, capabilities, release date)
- Built an upsert sync that preserves manually-curated fields while auto-updating gateway fields
- Redesigned model cards with auto-populated rich data + manual override fields
- Added inline availability toggles for curation (sync everything, toggle what's visible)
- Added type-filtered model selection in prompt editors
- Opened admin-gated Studio pages to all users with a non-admin warning banner

**Transferable patterns (with SQL/code snippets):**
1. **Vercel AI Gateway integration** — API endpoint, auth, response shape, field mapping, how to exclude embedding models
2. **Database migration pattern** — Adding enrichment columns alongside existing manual columns, changing defaults for curation (`is_available` → `FALSE`), composite indexes for filtered queries
3. **Upsert sync with field preservation** — The pattern of updating auto fields (description, pricing, tags) while preserving manual fields (tips, notes, availability) using Supabase upsert with `onConflict` + selective column updates
4. **Model type inference** — Mapping gateway `type` (language/image/embedding) to app types (text/image/research), plus provider-based overrides (perplexity → research)
5. **Rich card UI pattern** — Auto-populated data display + manual override dialog + inline toggle with optimistic update
6. **Type-filtered dropdown** — Storing a `model_type_filter` on the parent record, filtering related records by type + availability
7. **Opening admin gates with warnings** — Removing email-gated sidebar items, adding role-based warning banners in layout components

**Document structure — two sections:**

**Section 1: Reference Playbook** (for you to read)
- Each pattern includes: why, the SQL migration snippet, the TypeScript/React code, what to customize per-repo
- Written as a human-readable walkthrough of what we did and why

**Section 2: Claude Code Instruction Block** (copy-pasteable)
- A self-contained prompt/context block you can paste into another repo's CLAUDE.md or feed to a Claude Code session
- Includes the Vercel AI Gateway API shape, migration templates, upsert patterns, and UI patterns as direct instructions
- Written so Claude Code can execute the patterns with minimal additional context (just needs the target repo's table names and structure)

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_enrich_ai_models.sql` | New migration |
| `src/app/api/admin/sync-models/route.ts` | Full rewrite |
| `scripts/sync-ai-models.ts` | Simplify, remove hardcoded metadata |
| `src/app/(dashboard)/studio/models/page.tsx` | Rich cards, inline toggle |
| `src/app/(dashboard)/studio/prompts/[id]/page.tsx` | Type filter + filtered dropdown |
| `src/components/dashboard/sidebar.tsx` | Remove admin gate on Studio link |
| `src/app/(dashboard)/studio/layout.tsx` | Add warning banner for non-admin users |
| `SCRAPBOOK/ai-models-enrichment-playbook.md` | Portable playbook for replicating in other repos |

## Verification

1. Run migration locally: `npm run supabase:reset`
2. Run sync: click "Sync Models" on Models page or `npx tsx scripts/sync-ai-models.ts`
3. Verify: ~177 models synced (197 - 20 embeddings), all `is_available = false` for new ones
4. Toggle a few models on, verify they appear in Prompt editor dropdown
5. Set a prompt's type to Image, verify only image models show in dropdown
6. Save prompt, reload, verify type filter persists
7. Log in as non-admin user — verify Studio appears in sidebar and warning banner shows
8. Log in as admin — verify no warning banner
9. Run `npx tsc --noEmit` — clean compile
10. Push migration to production: `npm run supabase:push`
