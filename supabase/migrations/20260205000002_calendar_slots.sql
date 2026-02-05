-- Calendar Slots: Weekly slot configuration for publications
-- Part of Content Routing System (isolated architecture)

CREATE TABLE calendar_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  
  -- Day of week (0 = Sunday, 6 = Saturday)
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  
  -- Fixed slot configuration (e.g., Sunday Executive Briefing)
  -- These are DEFAULTS that can be disabled/changed via UI
  is_fixed BOOLEAN DEFAULT false,
  fixed_format TEXT,                      -- 'executive_briefing', 'news_roundup', etc.
  fixed_format_name TEXT,                 -- Human-readable: 'Executive Briefing'
  
  -- Tier preferences for non-fixed slots
  preferred_tier TEXT,                    -- 'premium_a', 'a', 'b', 'c'
  tier_priority INTEGER DEFAULT 0,        -- Higher = better day for that tier
  
  -- Skip rules (e.g., skip holidays)
  -- Format: [{"type": "date_range", "start": "12-20", "end": "01-02"}, {"type": "specific_date", "date": "07-04"}]
  skip_rules JSONB DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One slot per day per publication
  UNIQUE(publication_id, day_of_week)
);

-- Indexes
CREATE INDEX idx_calendar_slots_publication ON calendar_slots(publication_id);
CREATE INDEX idx_calendar_slots_day ON calendar_slots(day_of_week);
CREATE INDEX idx_calendar_slots_fixed ON calendar_slots(is_fixed) WHERE is_fixed = true;
CREATE INDEX idx_calendar_slots_active ON calendar_slots(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE calendar_slots ENABLE ROW LEVEL SECURITY;

-- Calendar slots are global configuration
CREATE POLICY "Authenticated users can read calendar_slots"
  ON calendar_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage calendar_slots"
  ON calendar_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_calendar_slots_updated_at
  BEFORE UPDATE ON calendar_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE calendar_slots IS 'Weekly slot configuration for each publication day';
COMMENT ON COLUMN calendar_slots.is_fixed IS 'If true, this slot has a fixed format (e.g., Sunday Executive Briefing)';
COMMENT ON COLUMN calendar_slots.fixed_format IS 'Identifier for the fixed format type';
COMMENT ON COLUMN calendar_slots.tier_priority IS 'Higher values indicate better days for high-tier content';
COMMENT ON COLUMN calendar_slots.skip_rules IS 'JSON array of rules for skipping this slot (holidays, etc.)';

-- Seed default slots from spec
-- Note: All of these are configurable via Studio UI

DO $$
DECLARE
  core_pub_id UUID;
  beginner_pub_id UUID;
  youtube_pub_id UUID;
BEGIN
  -- Get publication IDs
  SELECT id INTO core_pub_id FROM publications WHERE slug = 'core_substack';
  SELECT id INTO beginner_pub_id FROM publications WHERE slug = 'beginner_substack';
  SELECT id INTO youtube_pub_id FROM publications WHERE slug = 'youtube';

  -- ============================================
  -- CORE SUBSTACK SLOTS (7 per week)
  -- ============================================
  
  -- Sunday: Executive Briefing (FIXED - but can be disabled)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, fixed_format, fixed_format_name, preferred_tier, tier_priority, skip_rules)
  VALUES (
    core_pub_id,
    0, -- Sunday
    true,
    'executive_briefing',
    'Executive Briefing',
    'a',
    3,
    '[{"type": "date_range", "start": "12-20", "end": "01-02", "reason": "Holiday period"}]'::jsonb
  );

  -- Monday: B-tier (YouTube worst day, but good for Substack stagger)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (core_pub_id, 1, false, 'b', 2);

  -- Tuesday: B-tier
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (core_pub_id, 2, false, 'b', 2);

  -- Wednesday: A-tier (good for both YouTube and Substack)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (core_pub_id, 3, false, 'a', 4);

  -- Thursday: B-tier (slight penalty per spec)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (core_pub_id, 4, false, 'b', 1);

  -- Friday: A-tier (best day per spec)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (core_pub_id, 5, false, 'a', 5);

  -- Saturday: News Roundup (FIXED - but can be disabled)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, fixed_format, fixed_format_name, preferred_tier, tier_priority)
  VALUES (
    core_pub_id,
    6, -- Saturday
    true,
    'news_roundup',
    'News Roundup',
    'a',
    3
  );

  -- ============================================
  -- BEGINNER SUBSTACK SLOTS (3-4 per week, flexible)
  -- No fixed slots, spread evenly
  -- ============================================
  
  -- Monday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (beginner_pub_id, 1, false, 'a', 3);

  -- Wednesday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (beginner_pub_id, 3, false, 'a', 3);

  -- Friday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (beginner_pub_id, 5, false, 'a', 3);

  -- Saturday (optional 4th slot)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority, is_active)
  VALUES (beginner_pub_id, 6, false, 'b', 2, true);

  -- ============================================
  -- YOUTUBE SLOTS (7 per week)
  -- Note: YouTube is unified with Core Substack by default,
  -- so it shares the same calendar. These slots define
  -- YouTube-specific preferences when scheduling.
  -- ============================================
  
  -- Sunday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 0, false, 'b', 1);

  -- Monday (YouTube worst day per spec)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 1, false, 'b', 0);

  -- Tuesday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 2, false, 'b', 2);

  -- Wednesday (A-tier for YouTube)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 3, false, 'a', 4);

  -- Thursday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 4, false, 'b', 2);

  -- Friday (BEST day for YouTube per spec)
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 5, false, 'a', 5);

  -- Saturday
  INSERT INTO calendar_slots (publication_id, day_of_week, is_fixed, preferred_tier, tier_priority)
  VALUES (youtube_pub_id, 6, false, 'b', 2);

END $$;
