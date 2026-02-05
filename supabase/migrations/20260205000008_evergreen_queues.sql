-- Evergreen Queues: Queue management for evergreen content
-- Part of Content Routing System (isolated architecture)

CREATE TABLE evergreen_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Publication this queue entry belongs to
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  
  -- Link to either idea_routing OR project_routing (not both)
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE CASCADE,
  project_routing_id UUID REFERENCES project_routing(id) ON DELETE CASCADE,
  
  -- ============================================
  -- QUEUE DATA
  -- ============================================
  
  -- Score at time of queue entry (for sorting)
  score DECIMAL(3,1) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('premium_a', 'a', 'b', 'c')),
  
  -- When added to queue
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- ============================================
  -- STALENESS TRACKING
  -- ============================================
  
  -- Last time staleness was checked
  staleness_check_at TIMESTAMPTZ,
  
  -- Whether content is now stale (AI topics especially prone)
  is_stale BOOLEAN DEFAULT false,
  stale_reason TEXT,
  
  -- ============================================
  -- PULL TRACKING
  -- ============================================
  
  -- When pulled from queue to fill a gap
  pulled_at TIMESTAMPTZ,
  pulled_for_date DATE,
  pulled_reason TEXT,  -- 'gap_fill', 'manual', etc.
  
  -- ============================================
  -- TIMESTAMPS
  -- ============================================
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Must have either idea or project, not both
  CONSTRAINT evergreen_queues_one_source CHECK (
    (idea_routing_id IS NOT NULL AND project_routing_id IS NULL) OR
    (idea_routing_id IS NULL AND project_routing_id IS NOT NULL)
  ),
  
  -- Unique constraint per source
  CONSTRAINT evergreen_queues_unique_idea UNIQUE (publication_id, idea_routing_id),
  CONSTRAINT evergreen_queues_unique_project UNIQUE (publication_id, project_routing_id)
);

-- Indexes
CREATE INDEX idx_evergreen_queues_publication ON evergreen_queues(publication_id);
CREATE INDEX idx_evergreen_queues_score ON evergreen_queues(score DESC);
CREATE INDEX idx_evergreen_queues_tier ON evergreen_queues(tier);
CREATE INDEX idx_evergreen_queues_added ON evergreen_queues(added_at DESC);
CREATE INDEX idx_evergreen_queues_stale ON evergreen_queues(is_stale) WHERE is_stale = false;
CREATE INDEX idx_evergreen_queues_unpulled ON evergreen_queues(publication_id, score DESC) WHERE pulled_at IS NULL;

-- Index for staleness check queries
CREATE INDEX idx_evergreen_queues_staleness_due ON evergreen_queues(staleness_check_at)
  WHERE pulled_at IS NULL AND is_stale = false;

-- Enable RLS
ALTER TABLE evergreen_queues ENABLE ROW LEVEL SECURITY;

-- Queue entries visible based on underlying idea/project ownership
CREATE POLICY "Users can view own evergreen_queues"
  ON evergreen_queues FOR SELECT
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

CREATE POLICY "Users can insert own evergreen_queues"
  ON evergreen_queues FOR INSERT
  WITH CHECK (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

CREATE POLICY "Users can update own evergreen_queues"
  ON evergreen_queues FOR UPDATE
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

CREATE POLICY "Users can delete own evergreen_queues"
  ON evergreen_queues FOR DELETE
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

-- Updated_at trigger
CREATE TRIGGER update_evergreen_queues_updated_at
  BEFORE UPDATE ON evergreen_queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE evergreen_queues IS 'Queue of evergreen content waiting to fill calendar gaps';
COMMENT ON COLUMN evergreen_queues.score IS 'Score at time of queue entry, used for priority sorting';
COMMENT ON COLUMN evergreen_queues.is_stale IS 'Whether content has become stale and needs review';
COMMENT ON COLUMN evergreen_queues.pulled_at IS 'When content was pulled from queue to fill a gap';
