-- Scoring Rubrics: Configurable scoring criteria per publication
-- Part of Content Routing System (isolated architecture)

CREATE TABLE scoring_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  
  -- Identification
  slug TEXT NOT NULL,                     -- 'actionability', 'depth', 'ctr_potential'
  name TEXT NOT NULL,                     -- 'Actionability'
  description TEXT,
  
  -- Scoring weight (must sum to 1.0 per publication)
  weight DECIMAL(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  
  -- Scoring criteria
  -- Format: [{score: 10, description: "...", example: "..."}, {score: 8, ...}, ...]
  criteria JSONB NOT NULL,
  
  -- Modifier-type rubrics (like Timing)
  -- These add/subtract from a baseline rather than being weighted
  is_modifier BOOLEAN DEFAULT false,
  baseline_score INTEGER DEFAULT 5,
  -- Format: [{condition: "strategic_window", modifier: 2}, {condition: "thursday", modifier: -1}]
  modifiers JSONB,
  
  -- Status and ordering
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One rubric per slug per publication
  UNIQUE(publication_id, slug)
);

-- Indexes
CREATE INDEX idx_scoring_rubrics_publication ON scoring_rubrics(publication_id);
CREATE INDEX idx_scoring_rubrics_slug ON scoring_rubrics(slug);
CREATE INDEX idx_scoring_rubrics_active ON scoring_rubrics(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE scoring_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scoring_rubrics"
  ON scoring_rubrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage scoring_rubrics"
  ON scoring_rubrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_scoring_rubrics_updated_at
  BEFORE UPDATE ON scoring_rubrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE scoring_rubrics IS 'Configurable scoring rubrics for each publication';
COMMENT ON COLUMN scoring_rubrics.weight IS 'Weight for this rubric (0-1). Weights per publication should sum to 1.';
COMMENT ON COLUMN scoring_rubrics.criteria IS 'JSON array of score levels with descriptions and examples';
COMMENT ON COLUMN scoring_rubrics.is_modifier IS 'If true, this rubric adds/subtracts from baseline rather than being weighted';
COMMENT ON COLUMN scoring_rubrics.modifiers IS 'For modifier rubrics: conditions and their score adjustments';

-- Seed rubrics from spec (all configurable via Studio UI)

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
  -- CORE SUBSTACK RUBRICS (from spec)
  -- Total = Actionability × 0.5 + Depth × 0.3 + Timing × 0.2
  -- ============================================

  -- Actionability (50% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    core_pub_id,
    'actionability',
    'Actionability',
    'How actionable is the content? Does it provide specific systems, frameworks, and implementation steps?',
    0.50,
    '[
      {"score": 10, "description": "Specific system/workflow + step-by-step implementation + prompts/templates", "example": "The Delegation System: workflow + 5 prompts + checklist"},
      {"score": 8, "description": "Framework + diagnostic tool + concrete actions", "example": "4-question audit + decision tree + next steps"},
      {"score": 6, "description": "Analysis + audit questions (no full system)", "example": "8 yes/no questions to assess your readiness"},
      {"score": 4, "description": "Strategic insight + loose guidance", "example": "Here''s the pattern I''m seeing + general direction"},
      {"score": 2, "description": "Reflection/observation without action path", "example": "Interesting trend to watch"}
    ]'::jsonb,
    1
  );

  -- Depth/Uniqueness (30% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    core_pub_id,
    'depth',
    'Depth/Uniqueness',
    'How deep and unique is the content? Does it offer original frameworks or contrarian angles?',
    0.30,
    '[
      {"score": 10, "description": "Original framework OR contrarian angle with evidence", "example": "The Skill Tree framework (new mental model)"},
      {"score": 8, "description": "Synthesis of multiple sources into new insight", "example": "Combining McKinsey data + practitioner interviews"},
      {"score": 6, "description": "Solid coverage with fresh examples", "example": "Standard topic but updated company examples"},
      {"score": 4, "description": "Standard topic, standard framing", "example": "AI for productivity (same angle as everyone)"},
      {"score": 2, "description": "Retreading well-worn ground", "example": "Why AI matters (no new information)"}
    ]'::jsonb,
    2
  );

  -- Timing (20% weight) - MODIFIER type
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, is_modifier, baseline_score, modifiers, sort_order)
  VALUES (
    core_pub_id,
    'timing',
    'Timing',
    'How well does this content align with timing considerations? Baseline 5, modified by conditions.',
    0.20,
    '[
      {"score": 10, "description": "Perfect timing alignment"},
      {"score": 5, "description": "Neutral/evergreen timing"},
      {"score": 1, "description": "Poor timing (holiday period, bad day)"}
    ]'::jsonb,
    true,
    5,
    '[
      {"condition": "strategic_window", "modifier": 2, "description": "Model launch, New Year Jan 1-15, late June"},
      {"condition": "friday_or_monday", "modifier": 1, "description": "Friday or Monday publish"},
      {"condition": "thursday", "modifier": -1, "description": "Thursday publish"},
      {"condition": "holiday_period", "modifier": -3, "description": "Dec 20 - Jan 2"}
    ]'::jsonb,
    3
  );

  -- ============================================
  -- YOUTUBE RUBRICS (from spec)
  -- Total = CTR Potential × 0.5 + Length × 0.25 + Timing × 0.25
  -- ============================================

  -- CTR Potential (50% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    youtube_pub_id,
    'ctr_potential',
    'CTR Potential',
    'How many high-CTR elements can the title include? More elements = higher score.',
    0.50,
    '[
      {"score": 10, "description": "5+ elements possible, matches proven top-performer pattern", "elements": ["specific_numbers", "parenthetical_payoff", "company_name_stakes", "contrast_intrigue", "heres_why_how", "negative_fear_hook"]},
      {"score": 8, "description": "4 elements possible"},
      {"score": 6, "description": "2-3 elements possible"},
      {"score": 4, "description": "1 element possible"},
      {"score": 2, "description": "Generic hook, no specificity, no proven elements"}
    ]'::jsonb,
    1
  );

  -- Length Potential (25% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    youtube_pub_id,
    'length',
    'Length Potential',
    'Can this content fill the optimal 25-35 minute sweet spot?',
    0.25,
    '[
      {"score": 10, "description": "25-35 min of substantive content (sweet spot)"},
      {"score": 8, "description": "20-25 min"},
      {"score": 6, "description": "15-20 min"},
      {"score": 4, "description": "35-45 min (too long, retention drops)"},
      {"score": 2, "description": "<15 min OR >45 min"}
    ]'::jsonb,
    2
  );

  -- YouTube Timing (25% weight) - MODIFIER type
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, is_modifier, baseline_score, modifiers, sort_order)
  VALUES (
    youtube_pub_id,
    'timing',
    'Timing',
    'YouTube timing considerations. Wednesday and Friday are best days.',
    0.25,
    '[
      {"score": 10, "description": "Perfect timing alignment"},
      {"score": 5, "description": "Neutral timing"},
      {"score": 1, "description": "Poor timing"}
    ]'::jsonb,
    true,
    5,
    '[
      {"condition": "wednesday_or_friday", "modifier": 2, "description": "Wednesday or Friday publish"},
      {"condition": "news_tie_in", "modifier": 2, "description": "News cycle tie-in (same week as event)"},
      {"condition": "product_launch", "modifier": 2, "description": "Model/product launch tie-in"},
      {"condition": "sunday", "modifier": -1, "description": "Sunday publish"},
      {"condition": "monday", "modifier": -2, "description": "Monday publish (worst day)"}
    ]'::jsonb,
    3
  );

  -- ============================================
  -- BEGINNER SUBSTACK RUBRICS (from spec)
  -- Total = Accessibility × 0.5 + Completeness × 0.3 + Resource Density × 0.2
  -- ============================================

  -- Accessibility (50% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    beginner_pub_id,
    'accessibility',
    'Accessibility',
    'How accessible is this content to beginners? Can it use "Complete Guide" or "Zero to Hero" framing?',
    0.50,
    '[
      {"score": 10, "description": "Complete Guide + Zero to framing + visual aids + step-by-step + no jargon"},
      {"score": 8, "description": "Simplified or Easy framing + explicit beginner language"},
      {"score": 6, "description": "Beginner-friendly, minimal assumed context"},
      {"score": 4, "description": "Moderate complexity, some assumed knowledge"},
      {"score": 2, "description": "Would confuse newcomers, requires tool experience"}
    ]'::jsonb,
    1
  );

  -- Completeness (30% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    beginner_pub_id,
    'completeness',
    'Completeness',
    'How complete is the coverage? Does it provide everything a beginner needs?',
    0.30,
    '[
      {"score": 10, "description": "Full roadmap, exhaustive, everything you need"},
      {"score": 8, "description": "Comprehensive coverage of focused topic"},
      {"score": 6, "description": "Substantial but intentionally scoped"},
      {"score": 4, "description": "Partial coverage, leaves gaps"},
      {"score": 2, "description": "Fragment requiring external context"}
    ]'::jsonb,
    2
  );

  -- Resource Density (20% weight)
  INSERT INTO scoring_rubrics (publication_id, slug, name, description, weight, criteria, sort_order)
  VALUES (
    beginner_pub_id,
    'resource_density',
    'Resource Density',
    'How many tangible resources does this content include?',
    0.20,
    '[
      {"score": 10, "description": "Prompt kit + visual guide + examples + templates (4+ resource types)"},
      {"score": 8, "description": "2-3 resource types (e.g., prompts + guide)"},
      {"score": 6, "description": "Single resource type"},
      {"score": 4, "description": "Light resource mention"},
      {"score": 2, "description": "No tangible takeaway"}
    ]'::jsonb,
    3
  );

END $$;
