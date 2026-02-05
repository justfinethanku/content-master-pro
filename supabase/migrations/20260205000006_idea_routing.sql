-- Idea Routing: Links to slack_ideas without modifying it
-- Part of Content Routing System (isolated architecture)
-- This is the KEY isolation mechanism - all routing data here, not in slack_ideas

CREATE TABLE idea_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to existing idea (does not modify slack_ideas table)
  idea_id UUID NOT NULL REFERENCES slack_ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- ============================================
  -- INTAKE FIELDS (from spec)
  -- These are filled in when routing an idea
  -- ============================================
  
  -- Audience targeting
  audience TEXT CHECK (audience IN ('beginner', 'intermediate', 'executive')),
  
  -- Action - what will the reader DO after consuming this?
  action TEXT,
  
  -- Time sensitivity
  time_sensitivity TEXT DEFAULT 'evergreen'
    CHECK (time_sensitivity IN ('evergreen', 'news_hook', 'launch_tie', 'seasonal')),
  news_window DATE,  -- Required if time_sensitivity != evergreen
  
  -- Resource type
  resource TEXT CHECK (resource IN ('prompts', 'template', 'guide', 'framework', 'toolkit', 'none')),
  
  -- Angle - what makes this not-obvious or contrarian?
  angle TEXT,
  
  -- Estimated length
  estimated_length TEXT CHECK (estimated_length IN ('short', 'medium', 'long')),
  
  -- Helper flags for routing rules (can be AI-assisted or manual)
  can_frame_as_complete_guide BOOLEAN DEFAULT false,
  can_frame_as_zero_to_hero BOOLEAN DEFAULT false,
  is_foundational BOOLEAN DEFAULT false,
  would_bore_paid_subs BOOLEAN DEFAULT false,
  requires_tool_familiarity BOOLEAN DEFAULT false,
  has_contrarian_angle BOOLEAN DEFAULT false,
  is_technical_implementation BOOLEAN DEFAULT false,
  could_serve_both_audiences BOOLEAN DEFAULT false,
  
  -- ============================================
  -- ROUTING OUTPUTS (system-generated)
  -- ============================================
  
  routed_to TEXT CHECK (routed_to IN ('core', 'beginner', 'both')),
  youtube_version TEXT DEFAULT 'tbd' CHECK (youtube_version IN ('yes', 'no', 'tbd')),
  matched_rule_id UUID REFERENCES routing_rules(id) ON DELETE SET NULL,
  
  -- ============================================
  -- SCORING
  -- ============================================
  
  -- Scores per publication: {core_substack: 7.4, youtube: 5.75, beginner_substack: null}
  scores JSONB,
  
  -- Assigned tier based on primary score
  tier TEXT CHECK (tier IN ('premium_a', 'a', 'b', 'c', 'kill')),
  
  -- ============================================
  -- SCHEDULING
  -- ============================================
  
  recommended_slot TEXT,  -- Day of week recommendation
  slot_id UUID REFERENCES calendar_slots(id) ON DELETE SET NULL,
  calendar_date DATE,
  is_staggered BOOLEAN DEFAULT false,
  stagger_youtube_date DATE,
  stagger_substack_date DATE,
  
  -- ============================================
  -- STATUS TRACKING
  -- ============================================
  
  status TEXT DEFAULT 'intake'
    CHECK (status IN ('intake', 'routed', 'scored', 'slotted', 'scheduled', 'published', 'killed')),
  
  -- ============================================
  -- OVERRIDES (human can override any system decision)
  -- ============================================
  
  override_routing TEXT CHECK (override_routing IN ('core', 'beginner', 'both')),
  override_score DECIMAL(3,1) CHECK (override_score >= 0 AND override_score <= 10),
  override_slot TEXT,
  override_reason TEXT,  -- Required if any override is set
  
  -- Notes for context
  notes TEXT,
  
  -- ============================================
  -- TIMESTAMPS
  -- ============================================
  
  routed_at TIMESTAMPTZ,
  scored_at TIMESTAMPTZ,
  slotted_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  killed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One routing record per idea
  UNIQUE(idea_id)
);

-- Indexes
CREATE INDEX idx_idea_routing_idea ON idea_routing(idea_id);
CREATE INDEX idx_idea_routing_user ON idea_routing(user_id);
CREATE INDEX idx_idea_routing_status ON idea_routing(status);
CREATE INDEX idx_idea_routing_tier ON idea_routing(tier);
CREATE INDEX idx_idea_routing_routed_to ON idea_routing(routed_to);
CREATE INDEX idx_idea_routing_calendar_date ON idea_routing(calendar_date) WHERE calendar_date IS NOT NULL;
CREATE INDEX idx_idea_routing_time_sensitivity ON idea_routing(time_sensitivity);

-- Index for finding ideas that need attention
CREATE INDEX idx_idea_routing_pending ON idea_routing(status, created_at) 
  WHERE status IN ('intake', 'routed', 'scored');

-- Enable RLS
ALTER TABLE idea_routing ENABLE ROW LEVEL SECURITY;

-- Users can only see their own routing data
CREATE POLICY "Users can view own idea_routing"
  ON idea_routing FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own idea_routing"
  ON idea_routing FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own idea_routing"
  ON idea_routing FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own idea_routing"
  ON idea_routing FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_idea_routing_updated_at
  BEFORE UPDATE ON idea_routing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE idea_routing IS 'Routing data for ideas - links to slack_ideas without modifying it';
COMMENT ON COLUMN idea_routing.idea_id IS 'Foreign key to slack_ideas. One routing record per idea.';
COMMENT ON COLUMN idea_routing.scores IS 'JSON object of scores per publication slug';
COMMENT ON COLUMN idea_routing.matched_rule_id IS 'The routing rule that matched this idea';
COMMENT ON COLUMN idea_routing.override_reason IS 'Required explanation when human overrides system decisions';
