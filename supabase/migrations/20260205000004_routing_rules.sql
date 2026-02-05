-- Routing Rules: Database-driven routing logic
-- Part of Content Routing System (isolated architecture)

CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  
  -- Conditions (evaluated in priority order)
  -- Format: {field: "audience", op: "=", value: "beginner"}
  -- Or compound: {and: [{field: "audience", op: "=", value: "beginner"}, {field: "can_frame_as_complete_guide", op: "=", value: true}]}
  -- Or: {or: [...]}
  conditions JSONB NOT NULL,
  
  -- Routing outcome
  routes_to TEXT NOT NULL
    CHECK (routes_to IN ('core', 'beginner', 'both')),
  youtube_version TEXT DEFAULT 'tbd'
    CHECK (youtube_version IN ('yes', 'no', 'tbd')),
  
  -- Priority (higher = evaluated first)
  priority INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_routing_rules_priority ON routing_rules(priority DESC);
CREATE INDEX idx_routing_rules_active ON routing_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_routing_rules_routes_to ON routing_rules(routes_to);

-- Enable RLS
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read routing_rules"
  ON routing_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage routing_rules"
  ON routing_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_routing_rules_updated_at
  BEFORE UPDATE ON routing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE routing_rules IS 'Database-driven routing rules evaluated in priority order';
COMMENT ON COLUMN routing_rules.conditions IS 'JSON conditions to match against idea fields';
COMMENT ON COLUMN routing_rules.priority IS 'Higher priority rules are evaluated first. First match wins.';
COMMENT ON COLUMN routing_rules.routes_to IS 'Where to route: core, beginner, or both (creates two versions)';

-- Seed default routing rules from spec (all configurable via Studio UI)
-- Rules are evaluated in priority order (highest first), first match wins

INSERT INTO routing_rules (name, description, conditions, routes_to, youtube_version, priority) VALUES

-- Rule 1: Beginner audience + can frame as Complete Guide
(
  'Beginner Complete Guide',
  'Route beginner content that can be framed as a "Complete Guide" or "Zero to Hero" to Beginner Substack',
  '{
    "and": [
      {"field": "audience", "op": "=", "value": "beginner"},
      {"or": [
        {"field": "can_frame_as_complete_guide", "op": "=", "value": true},
        {"field": "can_frame_as_zero_to_hero", "op": "=", "value": true}
      ]}
    ]
  }'::jsonb,
  'beginner',
  'tbd',
  100
),

-- Rule 2: Beginner audience + foundational + would bore paid subs
(
  'Beginner Foundational',
  'Route foundational beginner content that would bore existing paid subscribers',
  '{
    "and": [
      {"field": "audience", "op": "=", "value": "beginner"},
      {"field": "is_foundational", "op": "=", "value": true},
      {"field": "would_bore_paid_subs", "op": "=", "value": true}
    ]
  }'::jsonb,
  'beginner',
  'tbd',
  95
),

-- Rule 3: Executive audience → Core (Executive Briefing)
(
  'Executive Briefing',
  'Route executive-level content to Core Substack',
  '{"field": "audience", "op": "=", "value": "executive"}'::jsonb,
  'core',
  'yes',
  90
),

-- Rule 4: Requires tool familiarity → Core
(
  'Tool Familiarity Required',
  'Route content requiring 30+ hours of tool experience to Core',
  '{"field": "requires_tool_familiarity", "op": "=", "value": true}'::jsonb,
  'core',
  'yes',
  80
),

-- Rule 5: Has contrarian angle → Core
(
  'Contrarian Angle',
  'Route content with contrarian angles to Core Substack',
  '{"field": "has_contrarian_angle", "op": "=", "value": true}'::jsonb,
  'core',
  'yes',
  75
),

-- Rule 6: Technical implementation → Core
(
  'Technical Implementation',
  'Route technical content (code, APIs, system config) to Core',
  '{"field": "is_technical_implementation", "op": "=", "value": true}'::jsonb,
  'core',
  'yes',
  70
),

-- Rule 7: Could serve both audiences → Both
(
  'Dual Audience',
  'Create two versions when content works for both beginners and practitioners',
  '{"field": "could_serve_both_audiences", "op": "=", "value": true}'::jsonb,
  'both',
  'yes',
  60
),

-- Rule 8: Beginner audience (fallback - reframe for intermediate)
(
  'Beginner Reframe',
  'Beginner content that does not fit beginner framing - route to Core and reframe for intermediate',
  '{"field": "audience", "op": "=", "value": "beginner"}'::jsonb,
  'core',
  'yes',
  50
),

-- Rule 9: Default → Core (catch-all)
(
  'Default to Core',
  'Default rule: route to Core Substack when no other rules match',
  '{"always": true}'::jsonb,
  'core',
  'yes',
  0
);
