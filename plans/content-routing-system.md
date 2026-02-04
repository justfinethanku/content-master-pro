# Content Routing & Scoring System

## Problem Statement

Implement a comprehensive content routing and scoring system that:
1. Routes ideas from Slack capture → scoring → slot assignment → calendar placement
2. Supports multiple publications (Core Substack, Beginner Substack, YouTube)
3. Scores content using configurable rubrics (Actionability, Depth, CTR Potential, etc.)
4. Assigns tiers and calendar slots based on scores
5. **All configuration is database-driven and editable via UI** - no hardcoded values

**Source Spec:** `/Users/kal/Downloads/Content_Routing_Spec_FULL.docx.pdf`

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| No hardcoding | All rules, weights, thresholds in database |
| Sensible defaults | Seed values from spec, all editable |
| Platform unification optional | `publications.unified_with` relationship |
| Fixed slots configurable | `calendar_slots.is_fixed` flag with override |
| Full UI control | Studio pages for all configuration |

---

## Implementation Plan

### Phase 1: Database Schema (Migrations)

Create new tables and extend existing ones to support routing, scoring, and calendar management.

**New Tables:**
1. `publications` - Define content publications (Core Substack, Beginner, YouTube)
2. `calendar_slots` - Weekly slot configuration with fixed slot support
3. `scoring_rubrics` - Configurable scoring criteria per publication
4. `routing_rules` - Database-driven routing logic
5. `tier_thresholds` - Configurable tier boundaries and behaviors
6. `evergreen_queues` - Queue management for evergreen content
7. `idea_status_history` - Audit trail for status transitions

**Extend Existing Tables:**
1. `slack_ideas` - Add routing fields (audience, action, time_sensitivity, scores, tier, etc.)
2. `nate_content_projects` - Add scoring, tier, slot linkage

### Phase 2: TypeScript Types

Update `src/lib/types.ts` with all new interfaces and types.

### Phase 3: Core Logic (Library Functions)

Implement routing and scoring logic as reusable functions:
1. `src/lib/routing/router.ts` - Route ideas based on database rules
2. `src/lib/routing/scorer.ts` - Score ideas using configurable rubrics
3. `src/lib/routing/scheduler.ts` - Assign slots and calendar dates
4. `src/lib/routing/queries.ts` - Database queries for routing system

### Phase 4: API Routes

Create API endpoints for the routing system:
1. `POST /api/ideas/route` - Route an idea
2. `POST /api/ideas/score` - Score an idea
3. `POST /api/ideas/schedule` - Assign to calendar
4. `GET /api/routing/dashboard` - Dashboard data (alerts, queues, etc.)

### Phase 5: Studio Configuration UI

Create Studio pages for managing all configuration:
1. `/studio/publications` - Manage publications and unified calendars
2. `/studio/routing` - Edit routing rules
3. `/studio/scoring` - Configure rubrics and weights
4. `/studio/tiers` - Set tier thresholds
5. `/studio/calendar-slots` - Configure weekly slots

### Phase 6: Workflow UI

Update existing UI to integrate routing workflow:
1. Idea intake form with new fields
2. Status workflow visualization
3. Calendar integration with slot assignment
4. Alerts and queue management

---

## Files to Modify

### Existing Files
- `src/lib/types.ts` - Add new types for routing system
- `supabase/migrations/20260127000002_slack_ideas.sql` - Reference for extension migration
- `src/app/(dashboard)/studio/layout.tsx` - Add new nav items

### App Settings Additions
- `supabase/migrations/20241227000012_app_settings.sql` - Reference for settings pattern

---

## New Files

### Migrations
- `supabase/migrations/[timestamp]_publications.sql`
- `supabase/migrations/[timestamp]_calendar_slots.sql`
- `supabase/migrations/[timestamp]_scoring_rubrics.sql`
- `supabase/migrations/[timestamp]_routing_rules.sql`
- `supabase/migrations/[timestamp]_tier_thresholds.sql`
- `supabase/migrations/[timestamp]_evergreen_queues.sql`
- `supabase/migrations/[timestamp]_extend_slack_ideas.sql`
- `supabase/migrations/[timestamp]_extend_content_projects.sql`
- `supabase/migrations/[timestamp]_routing_app_settings.sql`

### Library Functions
- `src/lib/routing/router.ts`
- `src/lib/routing/scorer.ts`
- `src/lib/routing/scheduler.ts`
- `src/lib/routing/queries.ts`
- `src/lib/routing/types.ts`
- `src/lib/routing/index.ts`

### API Routes
- `src/app/api/ideas/route/route.ts`
- `src/app/api/ideas/score/route.ts`
- `src/app/api/ideas/schedule/route.ts`
- `src/app/api/routing/dashboard/route.ts`
- `src/app/api/routing/publications/route.ts`
- `src/app/api/routing/rubrics/route.ts`
- `src/app/api/routing/rules/route.ts`
- `src/app/api/routing/tiers/route.ts`
- `src/app/api/routing/slots/route.ts`

### React Hooks
- `src/hooks/use-publications.ts` (may already exist - check/extend)
- `src/hooks/use-routing-rules.ts`
- `src/hooks/use-scoring-rubrics.ts`
- `src/hooks/use-tier-thresholds.ts`
- `src/hooks/use-calendar-slots.ts`
- `src/hooks/use-routing-dashboard.ts`

### Studio Pages
- `src/app/(dashboard)/studio/publications/page.tsx`
- `src/app/(dashboard)/studio/routing/page.tsx`
- `src/app/(dashboard)/studio/scoring/page.tsx`
- `src/app/(dashboard)/studio/tiers/page.tsx`
- `src/app/(dashboard)/studio/calendar-slots/page.tsx`

### Components
- `src/components/routing/publication-form.tsx`
- `src/components/routing/routing-rule-form.tsx`
- `src/components/routing/scoring-rubric-form.tsx`
- `src/components/routing/tier-form.tsx`
- `src/components/routing/slot-form.tsx`
- `src/components/routing/dashboard-alerts.tsx`
- `src/components/routing/evergreen-queue.tsx`

---

## Database Schema Details

### publications
```sql
CREATE TABLE publications (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,              -- 'core_substack', 'beginner_substack', 'youtube'
  name TEXT NOT NULL,
  publication_type TEXT NOT NULL,         -- 'newsletter', 'video'
  destination_id UUID REFERENCES destinations(id),
  unified_with UUID REFERENCES publications(id),  -- For calendar unification
  weekly_target INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### calendar_slots
```sql
CREATE TABLE calendar_slots (
  id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES publications(id),
  day_of_week INTEGER NOT NULL CHECK (0-6),
  is_fixed BOOLEAN DEFAULT false,
  fixed_format TEXT,                      -- 'executive_briefing', 'news_roundup'
  fixed_format_name TEXT,
  preferred_tier TEXT,
  tier_priority INTEGER DEFAULT 0,
  skip_rules JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  UNIQUE(publication_id, day_of_week)
);
```

### scoring_rubrics
```sql
CREATE TABLE scoring_rubrics (
  id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES publications(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  weight DECIMAL(3,2) NOT NULL,
  criteria JSONB NOT NULL,                -- [{score: 10, description, example}]
  is_modifier BOOLEAN DEFAULT false,
  baseline_score INTEGER DEFAULT 5,
  modifiers JSONB,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(publication_id, slug)
);
```

### routing_rules
```sql
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  routes_to TEXT NOT NULL,                -- 'core', 'beginner', 'both'
  youtube_version TEXT DEFAULT 'tbd',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

### tier_thresholds
```sql
CREATE TABLE tier_thresholds (
  id UUID PRIMARY KEY,
  tier TEXT NOT NULL,
  display_name TEXT NOT NULL,
  min_score DECIMAL(3,1) NOT NULL,
  max_score DECIMAL(3,1),
  auto_stagger BOOLEAN DEFAULT false,
  preferred_days JSONB DEFAULT '[]',
  actions JSONB DEFAULT '{}',
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

### slack_ideas extensions
```sql
ALTER TABLE slack_ideas ADD COLUMN audience TEXT;
ALTER TABLE slack_ideas ADD COLUMN action TEXT;
ALTER TABLE slack_ideas ADD COLUMN time_sensitivity TEXT DEFAULT 'evergreen';
ALTER TABLE slack_ideas ADD COLUMN resource TEXT;
ALTER TABLE slack_ideas ADD COLUMN angle TEXT;
ALTER TABLE slack_ideas ADD COLUMN estimated_length TEXT;
ALTER TABLE slack_ideas ADD COLUMN news_window DATE;
ALTER TABLE slack_ideas ADD COLUMN routed_to TEXT;
ALTER TABLE slack_ideas ADD COLUMN youtube_version TEXT DEFAULT 'tbd';
ALTER TABLE slack_ideas ADD COLUMN scores JSONB;
ALTER TABLE slack_ideas ADD COLUMN tier TEXT;
ALTER TABLE slack_ideas ADD COLUMN recommended_slot TEXT;
ALTER TABLE slack_ideas ADD COLUMN calendar_date DATE;
ALTER TABLE slack_ideas ADD COLUMN routing_notes TEXT;
ALTER TABLE slack_ideas ADD COLUMN override_routing TEXT;
ALTER TABLE slack_ideas ADD COLUMN override_score DECIMAL(3,1);
ALTER TABLE slack_ideas ADD COLUMN override_slot TEXT;
ALTER TABLE slack_ideas ADD COLUMN override_reason TEXT;
```

---

## Execution Order

0. [x] Copy this plan to `./plans/content-routing-system.md`
1. [ ] Create migration: `publications` table with seed data
2. [ ] Create migration: `calendar_slots` table with seed data
3. [ ] Create migration: `scoring_rubrics` table with seed data
4. [ ] Create migration: `routing_rules` table with seed data
5. [ ] Create migration: `tier_thresholds` table with seed data
6. [ ] Create migration: `evergreen_queues` table
7. [ ] Create migration: Extend `slack_ideas` with routing fields
8. [ ] Create migration: Extend `nate_content_projects` with scoring/tier fields
9. [ ] Create migration: Add routing-related `app_settings`
10. [ ] Update `src/lib/types.ts` with new types
11. [ ] Create `src/lib/routing/` module with core logic
12. [ ] Create API routes for routing operations
13. [ ] Create React hooks for data fetching
14. [ ] Create Studio UI pages for configuration
15. [ ] Create routing components
16. [ ] Update existing UI to integrate routing workflow
17. [ ] Test end-to-end workflow
18. [ ] Update documentation
19. [ ] Mark plan complete

---

## App Settings to Add

```sql
-- Scoring weights
('scoring', 'core_substack_weights', '{"actionability": 0.5, "depth": 0.3, "timing": 0.2}')
('scoring', 'youtube_weights', '{"ctr_potential": 0.5, "length": 0.25, "timing": 0.25}')
('scoring', 'beginner_weights', '{"accessibility": 0.5, "completeness": 0.3, "resource_density": 0.2}')

-- Premium stagger
('routing', 'premium_stagger_youtube_day', '{"value": 5}')
('routing', 'premium_stagger_substack_day', '{"value": 1}')
('routing', 'premium_manual_elevations_per_month', '{"value": 2}')
('routing', 'premium_elevation_min_score', '{"value": 8.5}')

-- Calendar rules
('calendar', 'allow_same_day_bump', '{"value": false}')
('calendar', 'holiday_blackout_dates', '{"value": ["12-20", ..., "01-02"]}')

-- Buffer alerts
('routing', 'evergreen_buffer_yellow_weeks', '{"value": 2}')
('routing', 'evergreen_buffer_red_weeks', '{"value": 1}')
('routing', 'staleness_check_days', '{"value": 30}')

-- Timing modifiers
('timing', 'strategic_window_bonus', '{"value": 2}')
('timing', 'friday_monday_bonus', '{"value": 1}')
('timing', 'thursday_penalty', '{"value": -1}')
('timing', 'holiday_penalty', '{"value": -3}')
```

---

## Notes

### Dependencies
- Migrations must run in order (publications before calendar_slots, etc.)
- `destinations` table already exists with YouTube, Substack, etc.
- `app_settings` pattern already established

### Edge Cases
- When `unified_with` is set, calendar queries must union both publications
- Fixed slots can be overridden but should show warning
- Bumping time-sensitive content outside window triggers alert
- Premium stagger only applies to 9.0+ scores (configurable threshold)

### Testing Approach
1. Unit tests for scoring calculations
2. Unit tests for routing rule evaluation
3. Integration tests for full workflow
4. Manual testing of Studio UI

### Future Considerations
- AI-assisted scoring (auto-score actionability, depth, etc.)
- Slack integration for automatic idea capture
- Performance dashboard with actual vs predicted tier analysis
