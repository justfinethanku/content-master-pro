-- Add examples column to brand_guidelines
-- Part of Meta Prompt Assembly System Refactor
-- This migrates the examples field from voice_guidelines to brand_guidelines

ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS
  examples JSONB DEFAULT '[]';

-- Add comment explaining the field
COMMENT ON COLUMN brand_guidelines.examples IS 'Sample content demonstrating this guideline - e.g., example sentences, phrases, or style demonstrations';
