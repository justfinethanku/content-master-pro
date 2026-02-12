-- Replace Nate-specific tables with generic project/asset system
-- Drops 6 tables, creates 5 new ones
-- Full schema of dropped tables preserved in docs/dropped-tables-20260211.md

-- ============================================================================
-- PHASE 1: DROP OLD TABLES (FK dependency order)
-- ============================================================================

DROP TABLE IF EXISTS evergreen_queues CASCADE;
DROP TABLE IF EXISTS project_routing CASCADE;
DROP TABLE IF EXISTS nate_asset_versions CASCADE;
DROP TABLE IF EXISTS nate_project_publications CASCADE;
DROP TABLE IF EXISTS nate_project_assets CASCADE;
DROP TABLE IF EXISTS nate_content_projects CASCADE;

-- ============================================================================
-- PHASE 2: CREATE NEW GENERIC TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- projects — One row per publication/content piece
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE NOT NULL,        -- yyyymmdd_xxx format
  name TEXT NOT NULL,                     -- human-readable, versionable
  scheduled_date DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'review', 'scheduled', 'published', 'archived')),
  metadata JSONB DEFAULT '{}',            -- tags, subtitle, target_platforms, notes, etc.
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_scheduled_date ON projects(scheduled_date);
CREATE INDEX idx_projects_project_id ON projects(project_id);
CREATE INDEX idx_projects_metadata ON projects USING GIN (metadata);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE projects IS 'Generic content projects with human-readable yyyymmdd_xxx IDs';
COMMENT ON COLUMN projects.project_id IS 'Human-readable ID in yyyymmdd_xxx format (date + sequential counter)';
COMMENT ON COLUMN projects.name IS 'Project name — tracked in project_name_versions for history';
COMMENT ON COLUMN projects.metadata IS 'Flexible JSON: tags, subtitle, target_platforms, notes, image, url, slug, etc.';

-- ---------------------------------------------------------------------------
-- project_name_versions — Project name change history
-- ---------------------------------------------------------------------------
CREATE TABLE project_name_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- name snapshot
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_name_versions_project_id ON project_name_versions(project_id);
CREATE INDEX idx_project_name_versions_created_at ON project_name_versions(created_at DESC);

-- RLS
ALTER TABLE project_name_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project name versions"
  ON project_name_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_name_versions.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project name versions"
  ON project_name_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_name_versions.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE project_name_versions IS 'Tracks project name changes over time';

-- ---------------------------------------------------------------------------
-- assets — One row per deliverable within a project
-- ---------------------------------------------------------------------------
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id TEXT UNIQUE NOT NULL,          -- yyyymmdd_xxx_type_platform_variant
  name TEXT NOT NULL,                     -- human-readable, versionable
  asset_type TEXT NOT NULL,               -- post, transcript, description, thumbnail, prompt, etc.
  platform TEXT,                          -- youtube, tiktok, substack, etc.
  variant TEXT,                           -- 01, 02, 16x9, 9x16, etc.
  content TEXT,                           -- text assets
  file_url TEXT,                          -- binary assets
  current_version INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'review', 'final', 'published', 'archived')),
  metadata JSONB DEFAULT '{}',            -- word_count, dimensions, duration, etc.
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assets_project_id ON assets(project_id);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_platform ON assets(platform) WHERE platform IS NOT NULL;
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_project_type ON assets(project_id, asset_type);
CREATE INDEX idx_assets_type_platform ON assets(asset_type, platform);
CREATE INDEX idx_assets_metadata ON assets USING GIN (metadata);

-- RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE assets IS 'Individual deliverables within a project (posts, transcripts, thumbnails, etc.)';
COMMENT ON COLUMN assets.asset_id IS 'Human-readable ID: yyyymmdd_xxx_type[_platform][_variant]';
COMMENT ON COLUMN assets.asset_type IS 'Free text type: post, transcript, description, thumbnail, prompt, guide, etc.';
COMMENT ON COLUMN assets.platform IS 'Target platform: youtube, tiktok, substack, linkedin, etc.';
COMMENT ON COLUMN assets.variant IS 'Variant identifier: 01, 02, 16x9, 9x16, etc.';
COMMENT ON COLUMN assets.locked_by IS 'User currently editing this asset (edit lock)';

-- ---------------------------------------------------------------------------
-- asset_versions — Full snapshot version history
-- ---------------------------------------------------------------------------
CREATE TABLE asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,                     -- name at this version
  content TEXT,                           -- content snapshot
  file_url TEXT,                          -- file snapshot
  metadata JSONB DEFAULT '{}',            -- metadata snapshot
  change_description TEXT,                -- what changed
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, version_number)
);

-- Indexes
CREATE INDEX idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX idx_asset_versions_created_by ON asset_versions(created_by);
CREATE INDEX idx_asset_versions_created_at ON asset_versions(created_at DESC);
CREATE INDEX idx_asset_versions_asset_version ON asset_versions(asset_id, version_number DESC);

-- RLS
ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asset versions"
  ON asset_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets.project_id
      WHERE assets.id = asset_versions.asset_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own asset versions"
  ON asset_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets.project_id
      WHERE assets.id = asset_versions.asset_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own asset versions"
  ON asset_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets.project_id
      WHERE assets.id = asset_versions.asset_id
      AND projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets.project_id
      WHERE assets.id = asset_versions.asset_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own asset versions"
  ON asset_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assets
      JOIN projects ON projects.id = assets.project_id
      WHERE assets.id = asset_versions.asset_id
      AND projects.created_by = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE asset_versions IS 'Full snapshot version history for assets';
COMMENT ON COLUMN asset_versions.version_number IS 'Sequential version number within the asset';
COMMENT ON COLUMN asset_versions.name IS 'Asset name at this version (snapshot)';
COMMENT ON COLUMN asset_versions.change_description IS 'Human-readable description of what changed';

-- ---------------------------------------------------------------------------
-- project_publications — Where/when published
-- ---------------------------------------------------------------------------
CREATE TABLE project_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES destinations(id),
  platform TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  published_url TEXT,
  metadata JSONB DEFAULT '{}',            -- views, engagement, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_publications_project_id ON project_publications(project_id);
CREATE INDEX idx_project_publications_platform ON project_publications(platform);
CREATE INDEX idx_project_publications_published_at ON project_publications(published_at DESC);

-- RLS
ALTER TABLE project_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project publications"
  ON project_publications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_publications.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project publications"
  ON project_publications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_publications.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own project publications"
  ON project_publications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_publications.project_id
      AND projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_publications.project_id
      AND projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project publications"
  ON project_publications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_publications.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE project_publications IS 'Track where and when project content has been published';
COMMENT ON COLUMN project_publications.destination_id IS 'Optional link to destinations table for platform config';
COMMENT ON COLUMN project_publications.published_url IS 'URL where the content was published';
COMMENT ON COLUMN project_publications.metadata IS 'Platform-specific metadata (views, engagement, etc.)';
