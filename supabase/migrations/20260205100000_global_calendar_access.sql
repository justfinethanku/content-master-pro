-- Make content calendar data visible to all authenticated users
-- Previously: Each user only saw their own projects
-- Now: All authenticated users see all projects (shared calendar)

-- ============================================
-- nate_content_projects: Global read/write access
-- ============================================

-- Drop existing user-scoped policies
DROP POLICY IF EXISTS "Users can view own projects" ON nate_content_projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON nate_content_projects;
DROP POLICY IF EXISTS "Users can update own projects" ON nate_content_projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON nate_content_projects;

-- New global policies for authenticated users
CREATE POLICY "Authenticated users can view all projects"
  ON nate_content_projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert projects"
  ON nate_content_projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update all projects"
  ON nate_content_projects FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete all projects"
  ON nate_content_projects FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- nate_project_assets: Global read/write access
-- ============================================

-- Drop existing user-scoped policies
DROP POLICY IF EXISTS "Users can view own project assets" ON nate_project_assets;
DROP POLICY IF EXISTS "Users can insert own project assets" ON nate_project_assets;
DROP POLICY IF EXISTS "Users can update own project assets" ON nate_project_assets;
DROP POLICY IF EXISTS "Users can delete own project assets" ON nate_project_assets;

-- New global policies for authenticated users
CREATE POLICY "Authenticated users can view all project assets"
  ON nate_project_assets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert project assets"
  ON nate_project_assets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update all project assets"
  ON nate_project_assets FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete all project assets"
  ON nate_project_assets FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Comments
COMMENT ON POLICY "Authenticated users can view all projects" ON nate_content_projects
  IS 'All authenticated users can view all calendar projects (shared calendar)';
COMMENT ON POLICY "Authenticated users can view all project assets" ON nate_project_assets
  IS 'All authenticated users can view all project assets (shared calendar)';
