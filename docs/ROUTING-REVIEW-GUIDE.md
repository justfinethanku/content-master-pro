# Content Routing System - Code Review Guide

This guide provides a systematic approach to reviewing the content routing system implementation.

## Overview

The content routing system consists of:
- **Database layer**: 6 new tables with migrations and RLS policies
- **Core logic**: TypeScript modules for routing, scoring, and scheduling
- **API routes**: RESTful endpoints for all CRUD operations
- **React hooks**: TanStack Query hooks for data fetching/mutations
- **UI pages**: Studio configuration pages + Routing dashboard

---

## 1. Database Schema Review

### Files to Check
```
supabase/migrations/
├── 20250204000001_routing_publications.sql
├── 20250204000002_routing_rules.sql
├── 20250204000003_scoring_rubrics.sql
├── 20250204000004_tier_thresholds.sql
├── 20250204000005_calendar_slots.sql
├── 20250204000006_idea_routing.sql
└── 20250204000007_evergreen_queue.sql
```

### Review Checklist
- [ ] All tables have proper primary keys (UUIDs)
- [ ] Foreign keys reference correct tables with ON DELETE behavior
- [ ] Timestamps use `timestamptz` with defaults
- [ ] JSONB columns have appropriate defaults (`{}` or `[]`)
- [ ] Enum types are defined before use
- [ ] RLS is enabled on all tables
- [ ] RLS policies allow authenticated users appropriate access
- [ ] Indexes exist for frequently queried columns

### Key Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `publications` | Content destinations | `slug`, `publication_type`, `weekly_target` |
| `routing_rules` | Conditional routing logic | `conditions` (JSONB), `routes_to`, `priority` |
| `scoring_rubrics` | Evaluation criteria | `publication_id`, `criteria` (JSONB), `weight` |
| `tier_thresholds` | Score-to-tier mapping | `tier`, `min_score`, `max_score` |
| `calendar_slots` | Weekly schedule template | `day_of_week`, `is_fixed`, `publication_id` |
| `idea_routing` | Per-idea routing state | `workflow_status`, `scores` (JSONB), `tier` |
| `evergreen_queue` | Backlog management | `publication_id`, `score`, `tier` |

---

## 2. Type Definitions Review

### Files to Check
```
src/lib/types.ts          # Main type definitions
src/lib/routing/types.ts  # Routing-specific types
```

### Review Checklist
- [ ] All database tables have corresponding TypeScript types
- [ ] Insert/Update partial types exist for mutations
- [ ] Enum types match database enum definitions
- [ ] JSONB column types are properly defined (not `any`)
- [ ] Nullable fields are marked with `| null`

### Key Types to Verify
```typescript
// Core entities
Publication, PublicationInsert, PublicationUpdate
RoutingRule, RoutingRuleInsert, RoutingRuleUpdate
ScoringRubric, ScoringRubricInsert, ScoringRubricUpdate
TierThreshold, TierThresholdUpdate
CalendarSlot, CalendarSlotInsert, CalendarSlotUpdate
IdeaRouting, IdeaRoutingInsert, IdeaRoutingUpdate
EvergreenQueueEntry

// Enums
PublicationType: "newsletter" | "video"
RoutingDestination: "core" | "beginner" | "both"
YouTubeVersion: "yes" | "no" | "tbd"
WorkflowStatus: "intake" | "routed" | "scored" | "slotted" | "scheduled" | "published" | "killed"
TierName: "premium_a" | "a" | "b" | "c"

// Complex types
RoutingCondition: { field, op, value } | { and: [] } | { or: [] } | { always: true }
ScoringCriterion: { score, description, example?, elements? }
```

---

## 3. Core Logic Review

### Files to Check
```
src/lib/routing/
├── index.ts      # Public exports
├── types.ts      # Type definitions
├── queries.ts    # Database operations
├── router.ts     # Routing engine
└── scorer.ts     # Scoring engine
```

### Review Checklist

#### queries.ts (Database Operations)
- [ ] All CRUD functions handle errors properly
- [ ] SELECT queries use `.select()` with appropriate columns
- [ ] INSERT/UPDATE return the modified row
- [ ] DELETE operations don't return data unnecessarily
- [ ] Pagination is implemented where needed

#### router.ts (Routing Engine)
- [ ] `evaluateCondition()` handles all condition types
- [ ] `routeIdea()` applies rules in priority order
- [ ] First matching rule wins (correct behavior)
- [ ] Unknown fields/operators throw descriptive errors

#### scorer.ts (Scoring Engine)
- [ ] `scoreIdea()` calculates weighted average correctly
- [ ] `determineTier()` finds correct tier from thresholds
- [ ] Handles edge cases (no rubrics, missing scores)
- [ ] Score normalization is consistent

### Key Functions to Trace
```typescript
// Routing flow
routeIdea(supabase, ideaId) → IdeaRouting

// Scoring flow  
scoreIdea(supabase, ideaId, scores) → IdeaRouting

// Query functions
getPublications(), getRoutingRules(), getScoringRubrics()
getTierThresholds(), getCalendarSlots()
getRoutedIdeas(), getEvergreenQueue()
```

---

## 4. API Routes Review

### Files to Check
```
src/app/api/routing/
├── config/
│   ├── publications/
│   │   ├── route.ts           # GET (list), POST (create)
│   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   ├── rules/
│   │   ├── route.ts           # GET, POST (create + reorder)
│   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   ├── rubrics/
│   │   ├── route.ts           # GET, POST
│   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   ├── slots/
│   │   ├── route.ts           # GET, POST
│   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   └── tiers/
│       ├── route.ts           # GET
│       └── [id]/route.ts      # PATCH
├── ideas/route.ts             # GET (list ideas)
├── dashboard/route.ts         # GET (stats)
├── calendar/route.ts          # GET (scheduled content)
└── evergreen/route.ts         # GET, DELETE
```

### Review Checklist
- [ ] All routes check authentication (`supabase.auth.getUser()`)
- [ ] Unauthorized requests return 401
- [ ] Required fields are validated before database operations
- [ ] Error responses include descriptive messages
- [ ] Dynamic route params use `await params` pattern (Next.js 16)
- [ ] Response shapes are consistent (`{ data }` or `{ success, data }`)

### Common Patterns to Verify
```typescript
// Auth check pattern
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Error handling pattern
try {
  // ... operation
} catch (error) {
  console.error("Operation error:", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Failed" },
    { status: 500 }
  );
}
```

---

## 5. React Hooks Review

### Files to Check
```
src/hooks/
├── use-routing.ts        # Dashboard, ideas, calendar, evergreen
└── use-routing-config.ts # Publications, rules, rubrics, slots, tiers
```

### Review Checklist
- [ ] Query keys are unique and descriptive
- [ ] Mutations invalidate correct queries on success
- [ ] Error handling doesn't swallow errors silently
- [ ] Return types match API response shapes
- [ ] Optional parameters have sensible defaults

### Key Hooks
```typescript
// Config hooks (use-routing-config.ts)
usePublications(), useCreatePublication(), useUpdatePublication()
useRoutingRules(), useCreateRoutingRule(), useUpdateRoutingRule(), useReorderRoutingRules()
useScoringRubrics(), useCreateScoringRubric(), useUpdateScoringRubric()
useTierThresholds(), useUpdateTierThreshold()
useCalendarSlots(), useCreateCalendarSlot(), useUpdateCalendarSlot()

// Operational hooks (use-routing.ts)
useRoutedIdeas(filters)
useRoutingDashboard()
useCalendarView(startDate, endDate)
useEvergreenQueue(publicationSlug?, limit?)
```

---

## 6. UI Pages Review

### Files to Check
```
src/app/(dashboard)/
├── studio/
│   ├── layout.tsx              # Nav tabs (includes new items)
│   ├── publications/page.tsx   # Publications CRUD
│   ├── routing-rules/page.tsx  # Rules CRUD + reorder
│   ├── scoring/page.tsx        # Rubrics CRUD
│   ├── tiers/page.tsx          # Tier thresholds edit
│   └── calendar-slots/page.tsx # Slots CRUD
└── routing/
    ├── layout.tsx              # Nav tabs
    ├── page.tsx                # Dashboard overview
    ├── ideas/page.tsx          # Ideas list + detail
    ├── calendar/page.tsx       # Calendar view
    └── queues/page.tsx         # Evergreen queues
```

### Review Checklist
- [ ] Loading states show spinner
- [ ] Error states show descriptive message
- [ ] Empty states have helpful messaging
- [ ] Forms validate required fields
- [ ] Mutations show saving/success feedback
- [ ] No hardcoded values (use types/constants)
- [ ] No `any` types (use proper typing)
- [ ] Unused imports removed
- [ ] Accessibility: proper labels, focus management

### UI Patterns to Verify
```typescript
// Loading state
if (isLoading) {
  return <Loader2 className="animate-spin" />;
}

// Error state
if (error) {
  return <AlertCircle /> {error.message};
}

// Empty state
if (data.length === 0) {
  return <EmptyState message="No items yet" />;
}

// Mutation feedback
{isSaving ? <Loader2 /> : saveSuccess ? <Check /> : <Save />}
```

---

## 7. Integration Points Review

### Sidebar Navigation
- [ ] `src/components/dashboard/sidebar.tsx` includes "Routing" link
- [ ] Icon imported (`Route` from lucide-react)
- [ ] Link points to `/routing`

### Studio Layout
- [ ] `src/app/(dashboard)/studio/layout.tsx` includes new tabs
- [ ] Publications, Routing, Scoring, Tiers, Slots tabs present
- [ ] Icons imported for each tab

---

## 8. Code Quality Checks

### Run These Commands
```bash
# TypeScript compilation
npx tsc --noEmit

# Linting (new files only)
npx eslint src/app/\(dashboard\)/routing src/app/\(dashboard\)/studio/publications \
  src/app/\(dashboard\)/studio/routing-rules src/app/\(dashboard\)/studio/scoring \
  src/app/\(dashboard\)/studio/tiers src/app/\(dashboard\)/studio/calendar-slots \
  src/lib/routing src/hooks/use-routing.ts src/hooks/use-routing-config.ts \
  src/app/api/routing

# Full lint (may have pre-existing warnings)
npx eslint src/ --max-warnings 100
```

### Expected Results
- [ ] TypeScript: Exit code 0, no errors
- [ ] ESLint (new files): Exit code 0, no errors/warnings
- [ ] ESLint (full): May have pre-existing warnings in other files

---

## 9. Quick Functionality Test

### Without Data (Empty State)
1. Navigate to `/routing` - Should show empty dashboard with zeros
2. Navigate to `/routing/ideas` - Should show "No ideas" message
3. Navigate to `/routing/calendar` - Should show empty calendar
4. Navigate to `/routing/queues` - Should show "No items" message
5. Navigate to `/studio/publications` - Should show "No publications"
6. Navigate to `/studio/routing-rules` - Should show "No rules"

### With Test Data (Manual Testing Later)
1. Create a publication → Verify it appears in list
2. Create a routing rule → Verify reordering works
3. Create a scoring rubric → Verify criteria JSON saves
4. Edit tier thresholds → Verify score ranges update
5. Create calendar slots → Verify day/time saves

---

## 10. Files Changed Summary

### New Files Created
```
# Database migrations (7 files)
supabase/migrations/20250204000001_routing_publications.sql
supabase/migrations/20250204000002_routing_rules.sql
supabase/migrations/20250204000003_scoring_rubrics.sql
supabase/migrations/20250204000004_tier_thresholds.sql
supabase/migrations/20250204000005_calendar_slots.sql
supabase/migrations/20250204000006_idea_routing.sql
supabase/migrations/20250204000007_evergreen_queue.sql

# Core logic (5 files)
src/lib/routing/index.ts
src/lib/routing/types.ts
src/lib/routing/queries.ts
src/lib/routing/router.ts
src/lib/routing/scorer.ts

# API routes (16 files)
src/app/api/routing/config/publications/route.ts
src/app/api/routing/config/publications/[id]/route.ts
src/app/api/routing/config/rules/route.ts
src/app/api/routing/config/rules/[id]/route.ts
src/app/api/routing/config/rubrics/route.ts
src/app/api/routing/config/rubrics/[id]/route.ts
src/app/api/routing/config/slots/route.ts
src/app/api/routing/config/slots/[id]/route.ts
src/app/api/routing/config/tiers/route.ts
src/app/api/routing/config/tiers/[id]/route.ts
src/app/api/routing/ideas/route.ts
src/app/api/routing/dashboard/route.ts
src/app/api/routing/calendar/route.ts
src/app/api/routing/evergreen/route.ts

# React hooks (2 files)
src/hooks/use-routing.ts
src/hooks/use-routing-config.ts

# UI pages (11 files)
src/app/(dashboard)/studio/publications/page.tsx
src/app/(dashboard)/studio/routing-rules/page.tsx
src/app/(dashboard)/studio/scoring/page.tsx
src/app/(dashboard)/studio/tiers/page.tsx
src/app/(dashboard)/studio/calendar-slots/page.tsx
src/app/(dashboard)/routing/layout.tsx
src/app/(dashboard)/routing/page.tsx
src/app/(dashboard)/routing/ideas/page.tsx
src/app/(dashboard)/routing/calendar/page.tsx
src/app/(dashboard)/routing/queues/page.tsx
```

### Modified Files
```
src/lib/types.ts                              # Added routing types
src/app/(dashboard)/studio/layout.tsx         # Added nav tabs
src/components/dashboard/sidebar.tsx          # Added Routing link
```

---

## Review Session Commands

Run this sequence to perform the review:

```bash
# 1. Check TypeScript
npx tsc --noEmit

# 2. Check linting on new routing files
npx eslint src/lib/routing src/hooks/use-routing*.ts \
  src/app/api/routing src/app/\(dashboard\)/routing \
  src/app/\(dashboard\)/studio/publications \
  src/app/\(dashboard\)/studio/routing-rules \
  src/app/\(dashboard\)/studio/scoring \
  src/app/\(dashboard\)/studio/tiers \
  src/app/\(dashboard\)/studio/calendar-slots

# 3. Check git status
git status

# 4. Review diff summary
git diff --stat

# 5. Review specific areas (optional)
git diff src/lib/routing/
git diff src/app/api/routing/
git diff src/app/\(dashboard\)/routing/
```
