-- Changelog items: Ingested news cards from AI/dev tool changelogs
CREATE TABLE changelog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,           -- "Anthropic", "OpenAI", etc.
  source_url TEXT NOT NULL,            -- Link to original changelog
  headline TEXT NOT NULL,              -- Short title
  summary TEXT NOT NULL,               -- 2-3 sentence description
  impact_level TEXT NOT NULL CHECK (impact_level IN ('minor', 'major', 'breaking')),
  published_at TIMESTAMPTZ,            -- When the change was published
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'dismissed', 'captured')),
  metadata JSONB DEFAULT '{}'          -- Raw data, additional context
);

-- Index for efficient queries
CREATE INDEX idx_changelog_items_status ON changelog_items(status);
CREATE INDEX idx_changelog_items_source ON changelog_items(source_name);
CREATE INDEX idx_changelog_items_ingested ON changelog_items(ingested_at DESC);

-- Unique constraint to prevent duplicate ingestion
CREATE UNIQUE INDEX idx_changelog_items_unique ON changelog_items(source_name, headline);

-- Enable RLS
ALTER TABLE changelog_items ENABLE ROW LEVEL SECURITY;

-- Solo user MVP: allow all authenticated users full access
CREATE POLICY "Authenticated users can view changelog items"
  ON changelog_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert changelog items"
  ON changelog_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update changelog items"
  ON changelog_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow service role for ingestion scripts
CREATE POLICY "Service role has full access"
  ON changelog_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
