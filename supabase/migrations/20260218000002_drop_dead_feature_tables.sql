-- Drop Dead Feature Tables (Phase 2)
-- Removes tables from deleted features: Partner API, old content pipeline
-- All code referencing these tables has been removed.
--
-- ROLLBACK: See supabase/rollback/20260218000002_rollback.sql

-- ============================================================================
-- 1. Partner API tables (entire system removed)
--    Order: usage → keys → permissions → invites → partners
-- ============================================================================

DROP TABLE IF EXISTS partner_api_usage CASCADE;
DROP TABLE IF EXISTS partner_api_keys CASCADE;
DROP TABLE IF EXISTS partner_namespace_permissions CASCADE;
DROP TABLE IF EXISTS partner_invites CASCADE;
DROP TABLE IF EXISTS partners CASCADE;

-- NOTE: mcp_api_keys is NOT dropped — it's actively used by the MCP system
-- (/api/mcp/*, /api/admin/mcp-tokens)

-- Drop partner helper functions (only used by partner RLS policies)
DROP FUNCTION IF EXISTS is_partner(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_id(UUID) CASCADE;
-- NOTE: is_admin() is kept — it may be useful for other RLS policies

-- ============================================================================
-- 2. Old content pipeline tables (pages deleted, replaced by deliverables)
--    These may still have data but the UI is gone.
--    content_sessions is the parent; children reference it via FK.
-- ============================================================================

DROP TABLE IF EXISTS content_outputs CASCADE;
DROP TABLE IF EXISTS content_drafts CASCADE;
DROP TABLE IF EXISTS content_outlines CASCADE;
DROP TABLE IF EXISTS content_research CASCADE;
DROP TABLE IF EXISTS content_brain_dumps CASCADE;
DROP TABLE IF EXISTS content_sessions CASCADE;
