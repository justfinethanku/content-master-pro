# Swipe-to-Content Implementation Plan

## Status: ✅ Complete

Implementation completed on 2026-01-17. All core features are implemented and the build passes.

**Remaining manual steps:**
- Add PWA icons (`icon-192.png` and `icon-512.png`) to `/public/`
- Install LaunchAgent: `./scripts/manage-ingest-schedule.sh install`
- Test ingestion: `npx tsx scripts/ingest-changelogs.ts`
- Test on real iPhone via HTTPS

---

## Problem Statement

Build a mobile-first news curation interface for Nate Jones that presents AI/dev tool changelog updates as swipeable cards. Swipe left to dismiss, swipe right to capture with commentary. Captured items are stored for later pipeline integration.

---

## Architecture Overview

```
Daily Cron (6am)
  -> Perplexity (sonar-pro)
    -> Parse official changelogs (10 sources)
    -> Generate impact assessments
    -> Store as cards in `changelog_items` table

User (iPhone PWA)
  -> /swipe page
    -> Swipe left = dismiss
    -> Swipe right = text input + confirm
      -> Save to `swipe_captures` table

User
  -> /captures page
    -> View all captured items with commentary
    -> (Future: trigger pipeline integration)
```

---

## Implementation Plan

### Phase 1: Database Schema

Create two new tables for storing changelog items and user captures.

**Files to create:**
- `supabase/migrations/YYYYMMDD000001_changelog_items.sql`
- `supabase/migrations/YYYYMMDD000002_swipe_captures.sql`

**Tables:**

```sql
-- changelog_items: Ingested news cards
CREATE TABLE changelog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,           -- "Anthropic", "OpenAI", etc.
  source_url TEXT NOT NULL,            -- Link to original changelog
  headline TEXT NOT NULL,              -- Short title
  summary TEXT NOT NULL,               -- 2-3 sentence description
  impact_level TEXT NOT NULL,          -- "minor", "major", "breaking"
  published_at TIMESTAMPTZ,            -- When the change was published
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'unread',        -- "unread", "dismissed", "captured"
  metadata JSONB DEFAULT '{}'          -- Raw data, additional context
);

-- swipe_captures: User's right-swiped items with commentary
CREATE TABLE swipe_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changelog_item_id UUID REFERENCES changelog_items(id) ON DELETE CASCADE,
  user_commentary TEXT NOT NULL,       -- Nate's reaction/notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,            -- When fed into pipeline (future)
  pipeline_session_id UUID             -- FK to content_sessions (future)
);
```

### Phase 2: Prompt Manager Integration

Create a new prompt set for changelog ingestion that can be edited via Prompt Studio.

**Files to create:**
- `supabase/migrations/YYYYMMDD000003_changelog_ingestion_prompt.sql`

**Prompt set:**
- Slug: `changelog_ingestion`
- Pipeline stage: `utility`
- Model: `perplexity/sonar-pro`
- Template variables: `{{source_name}}`, `{{source_url}}`, `{{date_range}}`

**Prompt content (initial version):**
```
You are analyzing the official changelog/release notes for {{source_name}}.

Source URL: {{source_url}}
Date range: {{date_range}}

For each update found, extract:
1. Headline (concise title, max 100 chars)
2. Summary (2-3 sentences explaining the change)
3. Impact level: "minor" (bug fix, small improvement), "major" (new feature, significant change), or "breaking" (API changes, deprecations)
4. Published date (if available)

Return as JSON array:
[
  {
    "headline": "...",
    "summary": "...",
    "impact_level": "minor|major|breaking",
    "published_at": "YYYY-MM-DD" or null
  }
]

Only include updates from the last 7 days. If no recent updates, return empty array.
```

### Phase 3: Daily Ingestion Script

Create automated script that runs daily to fetch changelog updates.

**Files to create:**
- `scripts/ingest-changelogs.ts` - Main TypeScript script
- `scripts/daily-ingest.sh` - Shell wrapper
- `scripts/com.contentmasterpro.ingest.plist` - LaunchAgent config

**Source list (10 sources):**
1. Anthropic: `https://docs.anthropic.com/en/release-notes/overview`
2. OpenAI: `https://platform.openai.com/docs/changelog`
3. Google/Gemini: `https://ai.google.dev/gemini-api/docs/changelog`
4. xAI/Grok: `https://docs.x.ai/docs/changelog`
5. Cursor: `https://www.cursor.com/changelog`
6. n8n: `https://docs.n8n.io/release-notes/`
7. Perplexity: `https://docs.perplexity.ai/changelog`
8. Meta/Llama: `https://ai.meta.com/blog/` (filter for Llama)
9. Mistral: `https://docs.mistral.ai/getting-started/changelog/`
10. Windsurf/Codeium: `https://codeium.com/changelog`

**Flow:**
1. For each source, call Perplexity with `changelog_ingestion` prompt
2. Parse JSON response
3. Dedupe against existing `changelog_items` (by source_url + headline)
4. Insert new items with status = 'unread'
5. Log results

### Phase 4: PWA Setup

Configure Next.js as installable PWA for iPhone.

**Files to modify:**
- `next.config.ts` - Add next-pwa wrapper
- `src/app/layout.tsx` - Add viewport-fit, safe area meta tags

**Files to create:**
- `public/manifest.json` - PWA manifest
- `public/icon-192.png` - App icon (192x192)
- `public/icon-512.png` - App icon (512x512)
- `src/components/ios-install-prompt.tsx` - Install instructions for iOS

**Dependencies to add:**
```bash
npm install next-pwa framer-motion
```

### Phase 5: Swipe Page UI

Build the mobile-first card stack interface.

**Files to create:**
- `src/app/(dashboard)/swipe/page.tsx` - Main swipe page
- `src/components/swipe/card-stack.tsx` - Card stack container
- `src/components/swipe/swipe-card.tsx` - Individual swipeable card (Framer Motion)
- `src/components/swipe/capture-modal.tsx` - Text input modal on right-swipe
- `src/hooks/use-changelog-items.ts` - TanStack Query hook for fetching cards
- `src/hooks/use-capture-item.ts` - Mutation hook for saving captures

**UX Flow:**
1. Load unread changelog items from database
2. Display top card with headline, summary, source, impact badge
3. Swipe left → Update status to 'dismissed', show next card
4. Swipe right → Show capture modal with text input
5. User types/dictates commentary → Confirm → Save to swipe_captures
6. Update changelog_item status to 'captured', show next card
7. When no cards left, show "All caught up" message

**Mobile-first considerations:**
- Card: 90vw width, 60vh height, 12px border radius
- Safe area padding for iPhone notch/home indicator
- Touch-action: manipulation to prevent zoom delay
- Overscroll prevention in PWA mode

### Phase 6: Captures Viewer Page

Build the captured items list view.

**Files to create:**
- `src/app/(dashboard)/captures/page.tsx` - Captures list page
- `src/components/captures/capture-card.tsx` - Individual capture display
- `src/hooks/use-captures.ts` - TanStack Query hook

**Features:**
- List all captured items, newest first
- Each card shows: headline, summary, Nate's commentary, timestamp, source
- Search/filter by source or keyword
- Click to expand full details
- (Future) Button to send to pipeline

---

## Files to Modify

- `next.config.ts` - PWA wrapper
- `src/app/layout.tsx` - iOS meta tags, viewport-fit
- `src/app/(dashboard)/layout.tsx` - Add nav links for /swipe and /captures

## New Files

### Database
- `supabase/migrations/YYYYMMDD000001_changelog_items.sql`
- `supabase/migrations/YYYYMMDD000002_swipe_captures.sql`
- `supabase/migrations/YYYYMMDD000003_changelog_ingestion_prompt.sql`

### Scripts
- `scripts/ingest-changelogs.ts`
- `scripts/daily-ingest.sh`
- `scripts/com.contentmasterpro.ingest.plist`

### PWA
- `public/manifest.json`
- `public/icon-192.png`
- `public/icon-512.png`
- `src/components/ios-install-prompt.tsx`

### Swipe UI
- `src/app/(dashboard)/swipe/page.tsx`
- `src/components/swipe/card-stack.tsx`
- `src/components/swipe/swipe-card.tsx`
- `src/components/swipe/capture-modal.tsx`
- `src/hooks/use-changelog-items.ts`
- `src/hooks/use-capture-item.ts`

### Captures Viewer
- `src/app/(dashboard)/captures/page.tsx`
- `src/components/captures/capture-card.tsx`
- `src/hooks/use-captures.ts`

---

## Execution Order

0. [x] Copy this plan to `./plans/swipe-to-content.md`
1. [x] Install dependencies: `npm install next-pwa framer-motion`
2. [x] Create database migrations (Phase 1)
3. [x] Run migrations: `npx supabase db push`
4. [x] Create changelog_ingestion prompt (Phase 2)
5. [x] Build ingestion script (Phase 3)
6. [ ] Test ingestion with one source (manual step)
7. [x] Configure PWA (Phase 4)
8. [x] Build swipe card component with Framer Motion
9. [x] Build swipe page with card stack
10. [x] Build capture modal
11. [ ] Test swipe flow end-to-end (manual step)
12. [x] Build captures viewer page
13. [x] Add navigation links
14. [x] Create LaunchAgent for daily ingestion
15. [ ] Test on iPhone (real device, not simulator) (manual step)
16. [x] Mark plan complete

---

## Dependencies

**New packages:**
- `next-pwa` - PWA support for Next.js
- `framer-motion` - Swipe gesture animations

**Existing infrastructure used:**
- Perplexity via Vercel AI Gateway
- Supabase for database
- TanStack Query for data fetching
- shadcn/ui for UI components
- Tailwind CSS v4 for styling

---

## Notes

- **Solo user MVP**: No auth complexity, Nate is the only user
- **iOS keyboard dictation**: No custom voice recording needed
- **PWA testing**: Must test on real iPhone via HTTPS (ngrok or deployed)
- **Safe areas**: Critical for notch and home indicator
- **Future integration**: swipe_captures table designed for later pipeline connection

---

## Future Enhancement: Translation Layer

**Status:** Pending

The raw RSS feed data (especially GitHub releases) often contains technical version strings and changelog fragments that aren't user-friendly. Before items become swipe cards, we need a "translation layer" where Claude/LLM processes the raw data to:

1. **Humanize headlines** - Turn "v0.2.47-beta.4" into readable titles like "Claude Code: New terminal improvements"
2. **Summarize content** - Extract key changes from release notes and explain their significance
3. **Assess impact accurately** - Better than keyword matching for determining minor/major/breaking
4. **Add context** - Explain why a change matters to AI practitioners

**Implementation approach:**
- Add a processing step after RSS parsing but before database insert
- Use Claude Haiku for speed (sonnet for complex releases)
- Batch process multiple entries per API call to reduce costs
- Store both raw and processed versions for reference

---

## Research References

- [Mobile Swipe UI Research](../Research/content-master-pro/2026-01-16-mobile-swipe-ui-pwa-websearch.md)
- [Codebase Patterns](../Research/content-master-pro/2026-01-16-codebase-patterns-exploration.md)
