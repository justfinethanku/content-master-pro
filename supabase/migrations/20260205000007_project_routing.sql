-- Project Routing: Links to nate_content_projects without modifying it
-- Part of Content Routing System (isolated architecture)

CREATE TABLE project_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to existing project (does not modify nate_content_projects table)
  project_id UUID NOT NULL REFERENCES nate_content_projects(id) ON DELETE CASCADE,
  
  -- Optional link to idea routing (if project was created from routed idea)
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE SET NULL,
  
  -- ============================================
  -- SCORING
  -- ============================================
  
  -- Scores per publication: {core_substack: 7.4, youtube: 5.75}
  scores JSONB,
  
  -- Assigned tier
  tier TEXT CHECK (tier IN ('premium_a', 'a', 'b', 'c', 'kill')),
  
  -- ============================================
  -- SCHEDULING
  -- ============================================
  
  slot_id UUID REFERENCES calendar_slots(id) ON DELETE SET NULL,
  
  -- Stagger configuration for premium content
  is_staggered BOOLEAN DEFAULT false,
  stagger_youtube_date DATE,
  stagger_substack_date DATE,
  
  -- ============================================
  -- BUMPING TRACKING
  -- ============================================
  
  -- If content was bumped, track original date
  original_date DATE,
  bump_reason TEXT,
  bumped_at TIMESTAMPTZ,
  bumped_by UUID REFERENCES auth.users(id),
  
  -- Count of times bumped
  bump_count INTEGER DEFAULT 0,
  
  -- ============================================
  -- PUBLICATION TRACKING
  -- ============================================
  
  -- Track which platforms have been published
  published_platforms JSONB DEFAULT '[]',  -- ['youtube', 'substack']
  
  -- ============================================
  -- TIMESTAMPS
  -- ============================================
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One routing record per project
  UNIQUE(project_id)
);

-- Indexes
CREATE INDEX idx_project_routing_project ON project_routing(project_id);
CREATE INDEX idx_project_routing_idea ON project_routing(idea_routing_id) WHERE idea_routing_id IS NOT NULL;
CREATE INDEX idx_project_routing_tier ON project_routing(tier);
CREATE INDEX idx_project_routing_staggered ON project_routing(is_staggered) WHERE is_staggered = true;
CREATE INDEX idx_project_routing_bumped ON project_routing(original_date) WHERE original_date IS NOT NULL;

-- Enable RLS
ALTER TABLE project_routing ENABLE ROW LEVEL SECURITY;

-- Users can see routing for projects they created
CREATE POLICY "Users can view own project_routing"
  ON project_routing FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project_routing"
  ON project_routing FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own project_routing"
  ON project_routing FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project_routing"
  ON project_routing FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_project_routing_updated_at
  BEFORE UPDATE ON project_routing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE project_routing IS 'Routing data for projects - links to nate_content_projects without modifying it';
COMMENT ON COLUMN project_routing.idea_routing_id IS 'Link to idea_routing if project was created from a routed idea';
COMMENT ON COLUMN project_routing.original_date IS 'Original scheduled date if project was bumped';
COMMENT ON COLUMN project_routing.published_platforms IS 'Array of platform slugs where content has been published';
