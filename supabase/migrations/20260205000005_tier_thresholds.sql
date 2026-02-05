-- Tier Thresholds: Configurable tier boundaries and behaviors
-- Part of Content Routing System (isolated architecture)

CREATE TABLE tier_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tier identification
  tier TEXT UNIQUE NOT NULL,              -- 'premium_a', 'a', 'b', 'c', 'kill'
  display_name TEXT NOT NULL,             -- '⭐ PREMIUM A-TIER'
  description TEXT,
  
  -- Score boundaries
  min_score DECIMAL(3,1) NOT NULL,        -- 9.0
  max_score DECIMAL(3,1),                 -- null for top tier (no upper bound)
  
  -- Behavior configuration
  auto_stagger BOOLEAN DEFAULT false,     -- Premium A-tier auto-staggers
  preferred_days JSONB DEFAULT '[]',      -- [3, 5] = Wed, Fri (0=Sun, 6=Sat)
  actions JSONB DEFAULT '{}',             -- {"rework_recommended": true, "backlog": true}
  
  -- UI display
  color TEXT,                             -- Tailwind color class or hex
  icon TEXT,                              -- Icon identifier
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tier_thresholds_tier ON tier_thresholds(tier);
CREATE INDEX idx_tier_thresholds_score ON tier_thresholds(min_score DESC);
CREATE INDEX idx_tier_thresholds_active ON tier_thresholds(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE tier_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tier_thresholds"
  ON tier_thresholds FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tier_thresholds"
  ON tier_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_tier_thresholds_updated_at
  BEFORE UPDATE ON tier_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE tier_thresholds IS 'Configurable tier boundaries and associated behaviors';
COMMENT ON COLUMN tier_thresholds.min_score IS 'Minimum score to qualify for this tier (inclusive)';
COMMENT ON COLUMN tier_thresholds.max_score IS 'Maximum score for this tier (exclusive). NULL for top tier.';
COMMENT ON COLUMN tier_thresholds.auto_stagger IS 'If true, content in this tier automatically gets staggered release';
COMMENT ON COLUMN tier_thresholds.preferred_days IS 'Array of preferred days of week (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN tier_thresholds.actions IS 'JSON object of actions/flags for this tier';

-- Seed default tiers from spec (all configurable via Studio UI)

INSERT INTO tier_thresholds (tier, display_name, description, min_score, max_score, auto_stagger, preferred_days, actions, color, sort_order) VALUES

-- Premium A-Tier (9.0+)
(
  'premium_a',
  '⭐ PREMIUM A-TIER',
  'Top-tier content that auto-staggers: Friday YouTube → Monday Substack. Creates content echo effect.',
  9.0,
  NULL,  -- No upper bound
  true,  -- Auto-stagger enabled
  '[5]'::jsonb,  -- Friday preferred for YouTube
  '{
    "stagger_youtube_day": 5,
    "stagger_substack_day": 1,
    "priority_scheduling": true
  }'::jsonb,
  'yellow',  -- Gold star color
  1
),

-- A-Tier (8.0 - 8.9)
(
  'a',
  '🟢 A-TIER',
  'High-quality content prioritized for Wednesday and Friday slots.',
  8.0,
  8.9,
  false,
  '[3, 5]'::jsonb,  -- Wed, Fri preferred
  '{
    "priority_scheduling": true
  }'::jsonb,
  'green',
  2
),

-- B-Tier (5.0 - 7.9)
(
  'b',
  '🟡 B-TIER',
  'Solid content for Tuesday and Thursday slots.',
  5.0,
  7.9,
  false,
  '[1, 2, 4]'::jsonb,  -- Mon, Tue, Thu
  '{}'::jsonb,
  'yellow',
  3
),

-- C-Tier (3.0 - 4.9)
(
  'c',
  '🟠 C-TIER',
  'Content that needs rework or should be used for experiments. Consider improving before scheduling.',
  3.0,
  4.9,
  false,
  '[]'::jsonb,  -- No preferred days
  '{
    "rework_recommended": true,
    "experimental": true
  }'::jsonb,
  'orange',
  4
),

-- Kill (< 3.0)
(
  'kill',
  '🔴 KILL',
  'Content that should not be produced. Needs fundamental rethink or should be archived.',
  0.0,
  2.9,
  false,
  '[]'::jsonb,
  '{
    "do_not_produce": true,
    "archive": true,
    "requires_rethink": true
  }'::jsonb,
  'red',
  5
);
