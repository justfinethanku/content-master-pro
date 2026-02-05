-- Routing Status Log: Audit trail for status transitions
-- Part of Content Routing System (isolated architecture)

CREATE TABLE routing_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to either idea_routing OR project_routing
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE CASCADE,
  project_routing_id UUID REFERENCES project_routing(id) ON DELETE CASCADE,
  
  -- ============================================
  -- STATUS CHANGE
  -- ============================================
  
  from_status TEXT,  -- NULL for initial creation
  to_status TEXT NOT NULL,
  
  -- Who made the change
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Why the change was made
  change_reason TEXT,
  
  -- ============================================
  -- CONTEXT
  -- ============================================
  
  -- Additional metadata about the change
  metadata JSONB,  -- {matched_rule: "...", score_breakdown: {...}, etc.}
  
  -- ============================================
  -- TIMESTAMP
  -- ============================================
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Must have either idea or project
  CONSTRAINT routing_status_log_one_source CHECK (
    idea_routing_id IS NOT NULL OR project_routing_id IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_routing_status_log_idea ON routing_status_log(idea_routing_id) WHERE idea_routing_id IS NOT NULL;
CREATE INDEX idx_routing_status_log_project ON routing_status_log(project_routing_id) WHERE project_routing_id IS NOT NULL;
CREATE INDEX idx_routing_status_log_status ON routing_status_log(to_status);
CREATE INDEX idx_routing_status_log_created ON routing_status_log(created_at DESC);
CREATE INDEX idx_routing_status_log_user ON routing_status_log(changed_by) WHERE changed_by IS NOT NULL;

-- Enable RLS
ALTER TABLE routing_status_log ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own ideas/projects
CREATE POLICY "Users can view own routing_status_log"
  ON routing_status_log FOR SELECT
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = routing_status_log.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = routing_status_log.project_routing_id AND p.created_by = auth.uid()
    ))
  );

-- Insert policy - users can create logs for their content
CREATE POLICY "Users can insert own routing_status_log"
  ON routing_status_log FOR INSERT
  WITH CHECK (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = routing_status_log.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = routing_status_log.project_routing_id AND p.created_by = auth.uid()
    ))
  );

-- No update/delete - audit logs are immutable

-- Comments
COMMENT ON TABLE routing_status_log IS 'Immutable audit trail of status changes in the routing workflow';
COMMENT ON COLUMN routing_status_log.from_status IS 'Previous status (NULL for initial creation)';
COMMENT ON COLUMN routing_status_log.metadata IS 'Additional context like matched rule, score breakdown, etc.';
