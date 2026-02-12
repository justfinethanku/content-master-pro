-- Consolidate 5 tables down to 2 (projects + assets)
-- Migrates publication data into assets, then drops 3 redundant tables

-- ============================================================================
-- PHASE 1: Add publication columns to assets
-- ============================================================================

ALTER TABLE assets ADD COLUMN published_url TEXT;
ALTER TABLE assets ADD COLUMN published_at TIMESTAMPTZ;

-- ============================================================================
-- PHASE 2: Migrate publication data into assets
-- ============================================================================

UPDATE assets
SET
  published_url = pp.published_url,
  published_at = pp.published_at
FROM project_publications pp
WHERE pp.project_id = assets.project_id;

-- ============================================================================
-- PHASE 3: Rename current_version to version for clarity
-- ============================================================================

ALTER TABLE assets RENAME COLUMN current_version TO version;

-- ============================================================================
-- PHASE 4: Drop redundant tables
-- ============================================================================

DROP TABLE IF EXISTS project_name_versions CASCADE;
DROP TABLE IF EXISTS asset_versions CASCADE;
DROP TABLE IF EXISTS project_publications CASCADE;
