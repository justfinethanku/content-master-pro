# Content Routing & Scoring System (v2 - Isolated Architecture)

## Problem Statement

Implement a comprehensive content routing and scoring system that:
1. Routes ideas from Slack capture → scoring → slot assignment → calendar placement
2. Supports multiple publications (Core Substack, Beginner Substack, YouTube)
3. Scores content using configurable rubrics (Actionability, Depth, CTR Potential, etc.)
4. Assigns tiers and calendar slots based on scores
5. **All configuration is database-driven and editable via UI** - no hardcoded values

**Source Spec:** `/Users/kal/Downloads/Content_Routing_Spec_FULL.docx.pdf`

---

## Architecture: Linking Tables (Isolation Strategy)

**Key Decision:** Instead of extending existing tables, create **linked tables** that overlay routing data onto existing entities. This ensures:

- Existing tables (`slack_ideas`, `nate_content_projects`) remain unchanged
- Existing pages/hooks/queries unaffected
- Routing system can be disabled/removed without schema changes
- New Studio pages are purely additive

```
┌─────────────────┐         ┌─────────────────────┐
│  slack_ideas    │◄────────│  idea_routing       │
│  (UNCHANGED)    │   FK    │  (audience, scores, │
└─────────────────┘         │   tier, slot, etc.) │
                            └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│nate_content_projects│◄────│  project_routing    │
│  (UNCHANGED)        │  FK │  (scores, tier,     │
└─────────────────────┘     │   calendar_date)    │
                            └─────────────────────┘
```

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| No hardcoding | All rules, weights, thresholds in database |
| Sensible defaults | Seed values from spec, all editable |
| Platform unification optional | `publications.unified_with` relationship |
| Fixed slots configurable | `calendar_slots.is_fixed` flag with override |
| Full UI control | Studio pages for all configuration |
| **Isolation** | Linking tables, not schema extensions |

---

## Implementation Plan

### Phase 1: Core Configuration Tables

New tables for system configuration (no existing tables modified):

1. `publications` - Define content publications (Core Substack, Beginner, YouTube)
2. `calendar_slots` - Weekly slot configuration with fixed slot support
3. `scoring_rubrics` - Configurable scoring criteria per publication
4. `routing_rules` - Database-driven routing logic
5. `tier_thresholds` - Configurable tier boundaries and behaviors

### Phase 2: Routing Data Tables (Linking)

Tables that link to existing entities without modifying them:

1. `idea_routing` - Links to `slack_ideas`, stores all routing/scoring data
2. `project_routing` - Links to `nate_content_projects`, stores scoring/tier/slot
3. `evergreen_queues` - Queue management for evergreen content
4. `routing_status_log` - Audit trail for status transitions

### Phase 3: App Settings

Add routing-related configuration to `app_settings` table.

### Phase 4: TypeScript Types

Add new interfaces to `src/lib/types.ts`.

### Phase 5: Core Logic (Library Functions)

Implement routing and scoring logic as reusable functions:
1. `src/lib/routing/router.ts` - Route ideas based on database rules
2. `src/lib/routing/scorer.ts` - Score ideas using configurable rubrics
3. `src/lib/routing/scheduler.ts` - Assign slots and calendar dates
4. `src/lib/routing/queries.ts` - Database queries for routing system

### Phase 6: API Routes

Create API endpoints for the routing system.

### Phase 7: Studio Configuration UI

Create Studio pages for managing all configuration.

### Phase 8: Routing Dashboard UI

Create dedicated routing pages (separate from existing calendar/projects).

---

## Files to Modify

### Minimal Modifications
- `src/lib/types.ts` - Add new types (additive only)
- `src/app/(dashboard)/studio/layout.tsx` - Add nav items for new Studio pages

### No Modifications Required
- `slack_ideas` table - unchanged
- `nate_content_projects` table - unchanged
- Existing hooks (`use-ideas.ts`, `use-projects.ts`) - unchanged
- Existing pages (`/calendar`, `/projects`, `/create`, etc.) - unchanged

---

## New Files

### Migrations (Phase 1 & 2)
- `supabase/migrations/[timestamp]_publications.sql`
- `supabase/migrations/[timestamp]_calendar_slots.sql`
- `supabase/migrations/[timestamp]_scoring_rubrics.sql`
- `supabase/migrations/[timestamp]_routing_rules.sql`
- `supabase/migrations/[timestamp]_tier_thresholds.sql`
- `supabase/migrations/[timestamp]_idea_routing.sql`
- `supabase/migrations/[timestamp]_project_routing.sql`
- `supabase/migrations/[timestamp]_evergreen_queues.sql`
- `supabase/migrations/[timestamp]_routing_status_log.sql`
- `supabase/migrations/[timestamp]_routing_app_settings.sql`

### Library Functions (Phase 5)
- `src/lib/routing/router.ts`
- `src/lib/routing/scorer.ts`
- `src/lib/routing/scheduler.ts`
- `src/lib/routing/queries.ts`
- `src/lib/routing/types.ts`
- `src/lib/routing/index.ts`

### API Routes (Phase 6)
- `src/app/api/routing/ideas/route.ts` - CRUD for idea_routing
- `src/app/api/routing/ideas/[id]/route.ts` - Single idea routing ops
- `src/app/api/routing/ideas/[id]/score/route.ts` - Score an idea
- `src/app/api/routing/ideas/[id]/schedule/route.ts` - Schedule an idea
- `src/app/api/routing/projects/route.ts` - CRUD for project_routing
- `src/app/api/routing/dashboard/route.ts` - Dashboard data
- `src/app/api/routing/publications/route.ts` - CRUD publications
- `src/app/api/routing/rubrics/route.ts` - CRUD rubrics
- `src/app/api/routing/rules/route.ts` - CRUD rules
- `src/app/api/routing/tiers/route.ts` - CRUD tiers
- `src/app/api/routing/slots/route.ts` - CRUD slots

### React Hooks (Phase 6)
- `src/hooks/use-routing-publications.ts`
- `src/hooks/use-routing-rules.ts`
- `src/hooks/use-scoring-rubrics.ts`
- `src/hooks/use-tier-thresholds.ts`
- `src/hooks/use-calendar-slots.ts`
- `src/hooks/use-idea-routing.ts`
- `src/hooks/use-project-routing.ts`
- `src/hooks/use-routing-dashboard.ts`

### Studio Pages (Phase 7)
- `src/app/(dashboard)/studio/publications/page.tsx`
- `src/app/(dashboard)/studio/routing-rules/page.tsx`
- `src/app/(dashboard)/studio/scoring/page.tsx`
- `src/app/(dashboard)/studio/tiers/page.tsx`
- `src/app/(dashboard)/studio/calendar-slots/page.tsx`

### Routing Dashboard Pages (Phase 8)
- `src/app/(dashboard)/routing/page.tsx` - Main routing dashboard
- `src/app/(dashboard)/routing/ideas/page.tsx` - Ideas in routing pipeline
- `src/app/(dashboard)/routing/calendar/page.tsx` - Routing calendar view
- `src/app/(dashboard)/routing/queues/page.tsx` - Evergreen queue management

### Components
- `src/components/routing/publication-form.tsx`
- `src/components/routing/routing-rule-form.tsx`
- `src/components/routing/scoring-rubric-form.tsx`
- `src/components/routing/tier-form.tsx`
- `src/components/routing/slot-form.tsx`
- `src/components/routing/idea-routing-card.tsx`
- `src/components/routing/score-display.tsx`
- `src/components/routing/tier-badge.tsx`
- `src/components/routing/dashboard-alerts.tsx`
- `src/components/routing/evergreen-queue.tsx`
- `src/components/routing/status-workflow.tsx`

---

## Database Schema Details

### publications
```sql
CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- 'core_substack', 'beginner_substack', 'youtube'
  name TEXT NOT NULL,
  publication_type TEXT NOT NULL          -- 'newsletter', 'video'
    CHECK (publication_type IN ('newsletter', 'video')),
  destination_id UUID REFERENCES destinations(id),
  unified_with UUID REFERENCES publications(id),  -- For calendar unification
  weekly_target INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### calendar_slots
```sql
CREATE TABLE calendar_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  is_fixed BOOLEAN DEFAULT false,
  fixed_format TEXT,                      -- 'executive_briefing', 'news_roundup'
  fixed_format_name TEXT,
  preferred_tier TEXT,
  tier_priority INTEGER DEFAULT 0,        -- Higher = better day for that tier
  skip_rules JSONB DEFAULT '[]',          -- [{"type": "date_range", "start": "12-20", "end": "01-02"}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, day_of_week)
);
```

### scoring_rubrics
```sql
CREATE TABLE scoring_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                     -- 'actionability', 'depth', 'timing'
  name TEXT NOT NULL,
  description TEXT,
  weight DECIMAL(3,2) NOT NULL,           -- 0.50 = 50%
  criteria JSONB NOT NULL,                -- [{score: 10, description, example}]
  is_modifier BOOLEAN DEFAULT false,      -- For timing-type modifiers
  baseline_score INTEGER DEFAULT 5,
  modifiers JSONB,                        -- [{condition, modifier}]
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publication_id, slug)
);
```

### routing_rules
```sql
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,              -- {field, op, value} or {and: [...]}
  routes_to TEXT NOT NULL                 -- 'core', 'beginner', 'both'
    CHECK (routes_to IN ('core', 'beginner', 'both')),
  youtube_version TEXT DEFAULT 'tbd'
    CHECK (youtube_version IN ('yes', 'no', 'tbd')),
  priority INTEGER DEFAULT 0,             -- Higher = evaluated first
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### tier_thresholds
```sql
CREATE TABLE tier_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL,              -- 'premium_a', 'a', 'b', 'c', 'kill'
  display_name TEXT NOT NULL,             -- '⭐ PREMIUM A-TIER'
  min_score DECIMAL(3,1) NOT NULL,
  max_score DECIMAL(3,1),                 -- null for top tier
  auto_stagger BOOLEAN DEFAULT false,     -- Premium A-tier auto-staggers
  preferred_days JSONB DEFAULT '[]',      -- [3, 5] = Wed, Fri
  actions JSONB DEFAULT '{}',             -- {"rework_recommended": true}
  color TEXT,                             -- For UI display
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### idea_routing (LINKING TABLE - key isolation mechanism)
```sql
CREATE TABLE idea_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES slack_ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Intake fields (from spec)
  audience TEXT CHECK (audience IN ('beginner', 'intermediate', 'executive')),
  action TEXT,                            -- What will they DO after consuming
  time_sensitivity TEXT DEFAULT 'evergreen'
    CHECK (time_sensitivity IN ('evergreen', 'news_hook', 'launch_tie', 'seasonal')),
  resource TEXT CHECK (resource IN ('prompts', 'template', 'guide', 'framework', 'toolkit', 'none')),
  angle TEXT,                             -- What makes this contrarian
  estimated_length TEXT CHECK (estimated_length IN ('short', 'medium', 'long')),
  news_window DATE,                       -- If time_sensitivity != evergreen
  
  -- Routing outputs (system-generated)
  routed_to TEXT CHECK (routed_to IN ('core', 'beginner', 'both')),
  youtube_version TEXT DEFAULT 'tbd' CHECK (youtube_version IN ('yes', 'no', 'tbd')),
  
  -- Scoring
  scores JSONB,                           -- {core_substack: 7.4, youtube: 5.75}
  tier TEXT CHECK (tier IN ('premium_a', 'a', 'b', 'c', 'kill')),
  
  -- Scheduling
  recommended_slot TEXT,                  -- Day of week
  slot_id UUID REFERENCES calendar_slots(id),
  calendar_date DATE,
  is_staggered BOOLEAN DEFAULT false,
  
  -- Status tracking
  status TEXT DEFAULT 'intake'
    CHECK (status IN ('intake', 'routed', 'scored', 'slotted', 'scheduled', 'published', 'killed')),
  
  -- Notes and overrides
  notes TEXT,
  override_routing TEXT,
  override_score DECIMAL(3,1),
  override_slot TEXT,
  override_reason TEXT,
  
  -- Timestamps
  routed_at TIMESTAMPTZ,
  scored_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(idea_id)                         -- One routing record per idea
);
```

### project_routing (LINKING TABLE)
```sql
CREATE TABLE project_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES nate_content_projects(id) ON DELETE CASCADE,
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE SET NULL,
  
  -- Scoring
  scores JSONB,
  tier TEXT CHECK (tier IN ('premium_a', 'a', 'b', 'c', 'kill')),
  
  -- Scheduling
  slot_id UUID REFERENCES calendar_slots(id),
  is_staggered BOOLEAN DEFAULT false,
  stagger_youtube_date DATE,
  stagger_substack_date DATE,
  
  -- Bumping
  original_date DATE,                     -- If bumped, stores original
  bump_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id)
);
```

### evergreen_queues
```sql
CREATE TABLE evergreen_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE CASCADE,
  project_routing_id UUID REFERENCES project_routing(id) ON DELETE CASCADE,
  
  score DECIMAL(3,1) NOT NULL,
  tier TEXT NOT NULL,
  
  added_at TIMESTAMPTZ DEFAULT NOW(),
  staleness_check_at TIMESTAMPTZ,
  is_stale BOOLEAN DEFAULT false,
  pulled_at TIMESTAMPTZ,                  -- When pulled to fill gap
  pulled_for_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Must have either idea or project, not both
  CHECK (
    (idea_routing_id IS NOT NULL AND project_routing_id IS NULL) OR
    (idea_routing_id IS NULL AND project_routing_id IS NOT NULL)
  )
);
```

### routing_status_log (Audit Trail)
```sql
CREATE TABLE routing_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE CASCADE,
  project_routing_id UUID REFERENCES project_routing(id) ON DELETE CASCADE,
  
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  metadata JSONB,                         -- Additional context
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (idea_routing_id IS NOT NULL OR project_routing_id IS NOT NULL)
);
```

---

## Execution Order

0. [x] Copy this plan to `./plans/content-routing-system-v2.md`

### Phase 1: Core Configuration Tables
1. [ ] Create migration: `publications` table with seed data
2. [ ] Create migration: `calendar_slots` table with seed data
3. [ ] Create migration: `scoring_rubrics` table with seed data
4. [ ] Create migration: `routing_rules` table with seed data
5. [ ] Create migration: `tier_thresholds` table with seed data

### Phase 2: Routing Data Tables
6. [ ] Create migration: `idea_routing` table (links to slack_ideas)
7. [ ] Create migration: `project_routing` table (links to nate_content_projects)
8. [ ] Create migration: `evergreen_queues` table
9. [ ] Create migration: `routing_status_log` table

### Phase 3: App Settings
10. [ ] Create migration: Add routing-related `app_settings`

### Phase 4: TypeScript Types
11. [ ] Update `src/lib/types.ts` with new types

### Phase 5: Core Logic
12. [ ] Create `src/lib/routing/types.ts` - Internal types
13. [ ] Create `src/lib/routing/queries.ts` - Database queries
14. [ ] Create `src/lib/routing/router.ts` - Routing logic
15. [ ] Create `src/lib/routing/scorer.ts` - Scoring logic
16. [ ] Create `src/lib/routing/scheduler.ts` - Scheduling logic
17. [ ] Create `src/lib/routing/index.ts` - Exports

### Phase 6: API Routes & Hooks
18. [ ] Create API routes for routing operations
19. [ ] Create React hooks for data fetching

### Phase 7: Studio Configuration UI
20. [ ] Create `/studio/publications` page
21. [ ] Create `/studio/routing-rules` page
22. [ ] Create `/studio/scoring` page
23. [ ] Create `/studio/tiers` page
24. [ ] Create `/studio/calendar-slots` page
25. [ ] Update Studio layout with new nav items

### Phase 8: Routing Dashboard UI
26. [ ] Create `/routing` dashboard page
27. [ ] Create `/routing/ideas` page
28. [ ] Create `/routing/calendar` page
29. [ ] Create `/routing/queues` page
30. [ ] Create routing components

### Phase 9: Finalize
31. [ ] Test end-to-end workflow
32. [ ] Update documentation (CAPABILITIES.md, CLAUDE.md)
33. [ ] Mark plan complete

---

## App Settings to Add

```sql
-- Scoring weights (defaults, all editable)
('scoring', 'core_substack_weights', '{"actionability": 0.5, "depth": 0.3, "timing": 0.2}')
('scoring', 'youtube_weights', '{"ctr_potential": 0.5, "length": 0.25, "timing": 0.25}')
('scoring', 'beginner_weights', '{"accessibility": 0.5, "completeness": 0.3, "resource_density": 0.2}')

-- Premium stagger configuration
('routing', 'premium_stagger_youtube_day', '{"value": 5}')  -- Friday
('routing', 'premium_stagger_substack_day', '{"value": 1}') -- Monday
('routing', 'premium_manual_elevations_per_month', '{"value": 2}')
('routing', 'premium_elevation_min_score', '{"value": 8.5}')

-- Calendar rules
('calendar', 'allow_same_day_bump', '{"value": false}')
('calendar', 'holiday_blackout_dates', '{"value": ["12-20", "12-21", ..., "01-02"]}')

-- Buffer alerts
('routing', 'evergreen_buffer_yellow_weeks', '{"value": 2}')
('routing', 'evergreen_buffer_red_weeks', '{"value": 1}')
('routing', 'staleness_check_days', '{"value": 30}')

-- Timing modifiers
('timing', 'strategic_window_bonus', '{"value": 2}')
('timing', 'friday_monday_bonus', '{"value": 1}')
('timing', 'thursday_penalty', '{"value": -1}')
('timing', 'holiday_penalty', '{"value": -3}')

-- Feature flag (for gradual rollout)
('routing', 'routing_system_enabled', '{"value": true}')
```

---

## Isolation Summary

### Tables NOT Modified
- `slack_ideas` - unchanged
- `nate_content_projects` - unchanged
- `content_sessions` - unchanged
- `destinations` - unchanged (just referenced)

### Pages NOT Affected
- `/create`, `/research`, `/outline`, `/draft`, `/outputs` - unchanged
- `/calendar` - unchanged (routing has its own `/routing/calendar`)
- `/projects` - unchanged
- `/search`, `/swipe`, `/captures` - unchanged

### New Isolated Pages
- `/studio/publications` - new
- `/studio/routing-rules` - new
- `/studio/scoring` - new
- `/studio/tiers` - new
- `/studio/calendar-slots` - new
- `/routing/*` - all new

---

## Notes

### Dependencies
- Migrations must run in order (publications → calendar_slots → others)
- `destinations` table already exists with YouTube, Substack, etc.
- `app_settings` pattern already established

### Edge Cases
- When `unified_with` is set, calendar queries must union both publications
- Fixed slots can be overridden but should show warning in UI
- Bumping time-sensitive content outside window triggers alert
- Premium stagger only applies to 9.0+ scores (configurable)

### Integration Points (Optional, Future)
- Could add "Send to Routing" button on Ideas page
- Could add routing status to Project cards
- Could unify calendars in future iteration

### Testing Approach
1. Unit tests for scoring calculations
2. Unit tests for routing rule evaluation
3. Integration tests for full workflow
4. Manual testing of Studio UI

### Rollback Strategy
If routing system needs to be removed:
1. Drop routing tables (no FK dependencies from existing tables)
2. Remove routing-related app_settings
3. Delete `/routing/*` and `/studio/[routing pages]`
4. Remove routing types and lib module

No changes to existing tables = clean rollback.
