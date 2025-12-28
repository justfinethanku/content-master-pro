-- Fix RLS policies for prompt management
-- Allow authenticated users to read and write prompt sets and versions

-- prompt_sets policies
DROP POLICY IF EXISTS "Allow authenticated read prompt_sets" ON prompt_sets;
DROP POLICY IF EXISTS "Allow authenticated insert prompt_sets" ON prompt_sets;
DROP POLICY IF EXISTS "Allow authenticated update prompt_sets" ON prompt_sets;

CREATE POLICY "Allow authenticated read prompt_sets" ON prompt_sets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert prompt_sets" ON prompt_sets
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update prompt_sets" ON prompt_sets
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- prompt_versions policies
DROP POLICY IF EXISTS "Allow authenticated read prompt_versions" ON prompt_versions;
DROP POLICY IF EXISTS "Allow authenticated insert prompt_versions" ON prompt_versions;
DROP POLICY IF EXISTS "Allow authenticated update prompt_versions" ON prompt_versions;

CREATE POLICY "Allow authenticated read prompt_versions" ON prompt_versions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert prompt_versions" ON prompt_versions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update prompt_versions" ON prompt_versions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ai_models policies (read-only for authenticated users)
DROP POLICY IF EXISTS "Allow authenticated read ai_models" ON ai_models;

CREATE POLICY "Allow authenticated read ai_models" ON ai_models
  FOR SELECT TO authenticated
  USING (true);
