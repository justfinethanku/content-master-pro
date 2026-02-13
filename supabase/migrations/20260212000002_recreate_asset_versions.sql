-- Recreate asset_versions table
-- Dropped accidentally in 20260211000002_consolidate_to_two_tables.sql (line 33)
-- Matches original schema from 20260211000001 but with name nullable
-- (current insert code doesn't provide it) and FK updated to project_assets

-- ============================================================================
-- TABLE
-- ============================================================================
CREATE TABLE asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES project_assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT,                              -- nullable (was NOT NULL in original)
  content TEXT,                           -- content snapshot
  file_url TEXT,                          -- file snapshot
  metadata JSONB DEFAULT '{}',            -- metadata snapshot
  change_description TEXT,                -- what changed
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, version_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX idx_asset_versions_created_by ON asset_versions(created_by);
CREATE INDEX idx_asset_versions_created_at ON asset_versions(created_at DESC);
CREATE INDEX idx_asset_versions_asset_version ON asset_versions(asset_id, version_number DESC);

-- ============================================================================
-- RLS — open policies (all authenticated users, matching 20260211100000 pattern)
-- ============================================================================
ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view asset_versions"
  ON asset_versions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert asset_versions"
  ON asset_versions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update asset_versions"
  ON asset_versions FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete asset_versions"
  ON asset_versions FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE asset_versions IS 'Full snapshot version history for assets';
COMMENT ON COLUMN asset_versions.version_number IS 'Sequential version number within the asset';
COMMENT ON COLUMN asset_versions.name IS 'Asset name at this version (snapshot, nullable)';
COMMENT ON COLUMN asset_versions.change_description IS 'Human-readable description of what changed';
