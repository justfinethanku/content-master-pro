-- Swipe captures: User's right-swiped items with commentary
CREATE TABLE swipe_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changelog_item_id UUID NOT NULL REFERENCES changelog_items(id) ON DELETE CASCADE,
  user_commentary TEXT NOT NULL,       -- User's reaction/notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,            -- When fed into pipeline (future)
  pipeline_session_id UUID REFERENCES content_sessions(id) -- FK to content_sessions (future)
);

-- Index for efficient queries
CREATE INDEX idx_swipe_captures_created ON swipe_captures(created_at DESC);
CREATE INDEX idx_swipe_captures_changelog ON swipe_captures(changelog_item_id);

-- Enable RLS
ALTER TABLE swipe_captures ENABLE ROW LEVEL SECURITY;

-- Solo user MVP: allow all authenticated users full access
CREATE POLICY "Authenticated users can view captures"
  ON swipe_captures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert captures"
  ON swipe_captures FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update captures"
  ON swipe_captures FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete captures"
  ON swipe_captures FOR DELETE
  TO authenticated
  USING (true);
