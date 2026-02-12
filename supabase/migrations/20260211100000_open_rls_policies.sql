-- Open RLS policies: all authenticated users have full access
-- (multi-tenant but shared data)

-- ============================================================================
-- projects
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert projects"
  ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update projects"
  ON projects FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete projects"
  ON projects FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- project_assets
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own assets" ON project_assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON project_assets;
DROP POLICY IF EXISTS "Users can update own assets" ON project_assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON project_assets;

CREATE POLICY "Authenticated users can view project_assets"
  ON project_assets FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert project_assets"
  ON project_assets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update project_assets"
  ON project_assets FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete project_assets"
  ON project_assets FOR DELETE
  USING (auth.role() = 'authenticated');
