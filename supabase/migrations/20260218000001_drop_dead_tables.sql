-- Drop Dead Tables Cleanup
-- Removes unused tables from abandoned features (voice memos, prompt variables)
-- All tables verified to have zero references in application code.

-- ============================================================================
-- 1. Drop voice memo tables (abandoned feature from 20260107000001)
--    Order matters: drop children first due to FK constraints
-- ============================================================================

-- summaries → references transcripts + summary_modes
DROP TABLE IF EXISTS summaries CASCADE;

-- transcript_speakers → references transcripts
DROP TABLE IF EXISTS transcript_speakers CASCADE;

-- transcripts → references recordings
DROP TABLE IF EXISTS transcripts CASCADE;

-- summary_modes → referenced by recordings.summary_mode_id
DROP TABLE IF EXISTS summary_modes CASCADE;

-- recordings (parent table)
DROP TABLE IF EXISTS recordings CASCADE;

-- ============================================================================
-- 2. Drop voice_guidelines (replaced by brand_guidelines in 20241228000003)
-- ============================================================================

DROP TABLE IF EXISTS voice_guidelines CASCADE;

-- ============================================================================
-- 3. Drop prompt variable tables (never adopted, 0 refs in code)
-- ============================================================================

-- prompt_variable_selections → references prompt_variables + prompt_sets
DROP TABLE IF EXISTS prompt_variable_selections CASCADE;

-- prompt_variables
DROP TABLE IF EXISTS prompt_variables CASCADE;

-- Drop the dedicated trigger function (no longer needed)
DROP FUNCTION IF EXISTS update_prompt_variables_updated_at() CASCADE;

-- ============================================================================
-- Note: update_updated_at_column() is NOT dropped — it's used by many
-- other tables (profiles, content_sessions, etc.)
-- ============================================================================
