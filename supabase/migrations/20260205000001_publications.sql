-- Publications: Define content publications for the routing system
-- Part of Content Routing System (isolated architecture)

CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- 'core_substack', 'beginner_substack', 'youtube'
  name TEXT NOT NULL,
  description TEXT,
  publication_type TEXT NOT NULL          -- 'newsletter', 'video'
    CHECK (publication_type IN ('newsletter', 'video')),
  destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  
  -- Calendar unification (optional - can link/unlink anytime)
  unified_with UUID REFERENCES publications(id) ON DELETE SET NULL,
  
  -- Weekly targets (configurable per publication)
  weekly_target INTEGER DEFAULT 7,
  
  -- Status and ordering
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_publications_slug ON publications(slug);
CREATE INDEX idx_publications_type ON publications(publication_type);
CREATE INDEX idx_publications_active ON publications(is_active) WHERE is_active = true;
CREATE INDEX idx_publications_unified ON publications(unified_with) WHERE unified_with IS NOT NULL;

-- Enable RLS
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Publications are global configuration, authenticated users can read
CREATE POLICY "Authenticated users can read publications"
  ON publications FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify publications
CREATE POLICY "Admins can manage publications"
  ON publications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_publications_updated_at
  BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE publications IS 'Content publications for routing system (Core Substack, Beginner Substack, YouTube)';
COMMENT ON COLUMN publications.unified_with IS 'If set, this publication shares a calendar with the referenced publication';
COMMENT ON COLUMN publications.weekly_target IS 'Target number of posts/videos per week for this publication';

-- Seed default publications from spec
-- Note: These are defaults that can be modified via Studio UI

-- First, get destination IDs (they may or may not exist)
DO $$
DECLARE
  substack_dest_id UUID;
  youtube_dest_id UUID;
  core_pub_id UUID;
BEGIN
  -- Get destination IDs if they exist
  SELECT id INTO substack_dest_id FROM destinations WHERE slug = 'substack' LIMIT 1;
  SELECT id INTO youtube_dest_id FROM destinations WHERE slug = 'youtube' LIMIT 1;

  -- Insert Core Substack
  INSERT INTO publications (slug, name, description, publication_type, destination_id, weekly_target, sort_order)
  VALUES (
    'core_substack',
    'Core Substack',
    'Main newsletter for intermediate and executive audiences. Features contrarian angles, technical implementations, and actionable frameworks.',
    'newsletter',
    substack_dest_id,
    7,
    1
  )
  RETURNING id INTO core_pub_id;

  -- Insert Beginner Substack
  INSERT INTO publications (slug, name, description, publication_type, destination_id, weekly_target, sort_order)
  VALUES (
    'beginner_substack',
    'Beginner Substack',
    'Newsletter for beginners. Features "Complete Guide" and "Zero to Hero" content with high accessibility.',
    'newsletter',
    substack_dest_id,
    4,
    2
  );

  -- Insert YouTube (unified with Core Substack by default)
  INSERT INTO publications (slug, name, description, publication_type, destination_id, unified_with, weekly_target, sort_order)
  VALUES (
    'youtube',
    'YouTube Longform',
    'Long-form video content. Shares calendar with Core Substack by default.',
    'video',
    youtube_dest_id,
    core_pub_id,  -- Unified with Core Substack (can be changed via UI)
    7,
    3
  );
END $$;
