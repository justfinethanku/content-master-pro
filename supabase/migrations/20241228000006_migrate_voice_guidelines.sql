-- Migrate voice_guidelines to brand_guidelines
-- Part of Meta Prompt Assembly System Refactor
--
-- This migration copies voice_guidelines data into the brand_guidelines table
-- with category='voice'. The voice_guidelines table is NOT dropped here -
-- that will happen in Phase 5 cleanup after verifying the migration works.

-- First, ensure brand_guidelines table exists (should already exist from 20241229000001)
-- This is a safety check - we won't recreate if it exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_guidelines') THEN
    RAISE EXCEPTION 'brand_guidelines table does not exist. Ensure 20241229000001_brand_guidelines.sql has been applied.';
  END IF;
END $$;

-- Copy voice_guidelines to brand_guidelines
-- We generate a unique slug from the name to avoid conflicts
INSERT INTO brand_guidelines (user_id, category, slug, name, content, examples, is_active, sort_order)
SELECT
  user_id,
  'voice' as category,
  'voice_' || LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '_', 'g')) || '_' || SUBSTRING(id::text, 1, 8) as slug,
  name,
  guidelines as content,
  COALESCE(examples, '[]'::jsonb) as examples,
  true as is_active,
  CASE WHEN is_default THEN 0 ELSE 1 END as sort_order
FROM voice_guidelines
ON CONFLICT (user_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  content = EXCLUDED.content,
  examples = EXCLUDED.examples,
  updated_at = NOW();

-- Log the migration count
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM voice_guidelines;
  RAISE NOTICE 'Migrated % voice_guidelines to brand_guidelines', migrated_count;
END $$;

-- Add comment documenting the migration
COMMENT ON TABLE voice_guidelines IS 'DEPRECATED: Voice guidelines have been migrated to brand_guidelines with category=voice. This table will be dropped in Phase 5 cleanup after verification.';

