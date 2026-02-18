# Codebase & Database Cleanup Plan

## Status: Phase 1 Complete

---

## Phase 1: Safe Deletions (Zero-Risk Dead Code)

These items have **zero references** anywhere in the codebase and can be safely removed.

### 1a. Drop Dead Database Tables

Write a migration to drop these tables. They're all from the abandoned voice-memo feature or replaced by newer tables:

| Table | Reason |
|-------|--------|
| `recordings` | Voice memo feature — 0 refs in code |
| `transcripts` | Voice memo feature — 0 refs in code |
| `transcript_speakers` | Voice memo feature — 0 refs in code |
| `summary_modes` | Voice memo feature — 0 refs in code |
| `summaries` | Voice memo feature — 0 refs in code |
| `voice_guidelines` | Replaced by `brand_guidelines` — 0 refs |
| `prompt_variable_selections` | 0 refs in code |
| `prompt_variables` | 0 refs in code |

Also drop related triggers/RLS policies on these tables, and the `update_prompt_variables_updated_at()` trigger function.

### 1b. Delete Dead Hook Files

| File | Reason |
|------|--------|
| `src/hooks/use-ideas.ts` | Never imported anywhere |
| `src/hooks/use-clusters.ts` | Never imported anywhere |

### 1c. Delete Dead Component Files

| File | Reason |
|------|--------|
| `src/components/calendar/mobile-month-view.tsx` | Never imported anywhere |

### 1d. Delete Dead Constants File

| File | Reason |
|------|--------|
| `src/lib/constants.ts` | All 8 exports (`APP_NAME`, `APP_DESCRIPTION`, `AI_MODELS`, `SESSION_STATUSES`, `OUTPUT_TYPES`, `PROMPT_SLUGS`, `API_ROUTES`, `VOICE_DEFAULTS`) are never used |

### 1e. Remove Unused NPM Packages

```bash
npm uninstall gray-matter next-pwa dotenv
```

Also move `@types/turndown` from `dependencies` to `devDependencies` if it's still needed (turndown itself IS used).

### 1f. Clean Dead Types from `types.ts`

Remove these types that are never imported outside of `types.ts`:

**Content Pipeline types:**
- `SessionStatus`, `BrainDump`, `ExtractedThemes`, `ContentResearch`, `ResearchSource`, `ContentOutline`, `ContentDraft`, `VoiceScore`, `ContentOutput`

**Ideas/Slack types:**
- `SlackIdeaInsert`, `SlackIdeaUpdate`, `IdeaSummaryResult`, `ClusterNameResult`, `SlackIntegrationConfig`, `SlackIntegrationConfigInsert`, `SlackIntegrationConfigUpdate`, `IdeaVectorMetadata`

**Routing/Misc types:**
- `RoutingStatusLog`, `RoutingStatusLogInsert`, `RoutingDashboardStats`, `RoutingAlert`, `RoadmapVote`, `PineconeNamespaceUpdate`, `ProjectUpdate`

---

## Phase 2: Fix Broken References

### 2a. Missing RPC Functions

`use-clusters.ts` calls `increment_cluster_idea_count` and `decrement_cluster_idea_count` — these RPCs were never created in migrations. The code has a fallback (fetch-update pattern), so this works but is sloppy. Since we're deleting `use-clusters.ts` in Phase 1, this is already resolved.

---

## Phase 3: Needs Your Decision — Potentially Dead Feature Systems

These are larger systems where the sidebar navigation is **commented out**, but the code, routes, and database tables still exist. I need you to tell me which of these you've abandoned vs plan to bring back.

### 3a. Partner API System (likely dead?)

The entire sidebar section is commented out:
```typescript
//   { name: "Invites", href: "/admin/invites", icon: Mail },
//   { name: "Partners", href: "/admin/partners", icon: Users },
//   { name: "API Usage", href: "/admin/usage", icon: BarChart3 },
//   { name: "Partner Dashboard", href: "/partner", icon: LayoutDashboard },
//   { name: "API Keys", href: "/partner/keys", icon: Key },
//   { name: "Usage", href: "/partner/usage", icon: BarChart3 },
//   { name: "API Docs", href: "/docs/api", icon: BookOpen },
```

**If dead, we'd remove:**
- 6 pages: `/admin/invites`, `/admin/partners`, `/admin/partners/[id]`, `/admin/usage`, `/partner/*` (5 pages), `/docs/api`
- 9 API routes: `/api/admin/*`, `/api/partner/*`, `/api/v1/*`
- 1 lib module: `src/lib/partner-api/` (auth, permissions, rate-limit, usage — 4 files)
- 6 DB tables: `partners`, `partner_api_keys`, `partner_api_usage`, `partner_invites`, `partner_namespace_permissions`, `mcp_api_keys`

### 3b. Old Content Pipeline Pages (likely superseded by Deliverables?)

These pages are NOT in the sidebar and may be the old single-session pipeline:
- `/create` — Brain dump creator
- `/draft` — Draft page
- `/outline` — Outline page
- `/research` — Research page
- `/outputs` — Outputs page
- `/history` — History page
- `/search` — Search page

**Question:** Are these still accessible from within the app (deep links from deliverables/projects), or completely orphaned?

### 3c. Routing System Pages (not in sidebar)

These have working code and API routes, but no sidebar navigation:
- `/routing` — Dashboard
- `/routing/ideas` — Idea routing
- `/routing/calendar` — Routing calendar
- `/routing/queues` — Evergreen queues
- `/studio/routing-rules` — Rule config
- `/studio/scoring` — Scoring rubrics
- `/studio/tiers` — Tier thresholds
- `/studio/publications` — Publications
- `/studio/calendar-slots` — Calendar slots

**Question:** Are you still using the routing system, or has this been superseded?

### 3d. Swipe & Captures (not in sidebar)

- `/swipe` — Tinder-style idea swiping
- `/captures` — Capture cards

Code is functional. Not in sidebar. Still used?

### 3e. Studio Pages (not in sidebar)

These admin/config pages aren't directly in the sidebar navigation:
- `/studio` — Studio hub
- `/studio/prompts` — Prompt editor
- `/studio/models` — Model config
- `/studio/destinations` — Destinations
- `/studio/guidelines` — Voice guidelines
- `/studio/logs` — AI call logs
- `/studio/test` — Test page

**Question:** Are you accessing these via URL directly? Should they have sidebar links?

---

## Phase 4: Documentation Cleanup

After removals are done:
- [ ] Update `CLAUDE.md` to remove references to dropped tables and deleted files
- [ ] Update `CHANGELOG.md` with cleanup changes
- [ ] Clean up any stale references in `BUILD_LOG.md`

---

## Summary

| Category | Items | Risk |
|----------|-------|------|
| Phase 1 — Safe deletions | 8 tables, 2 hooks, 1 component, 1 file, 3 packages, ~20 types | None |
| Phase 2 — Fix broken refs | Already covered by Phase 1 | None |
| Phase 3 — Needs your call | Partner API, old pipeline pages, routing, swipe, studio | Depends on your answer |
| Phase 4 — Docs | CLAUDE.md, CHANGELOG.md | None |
