-- ROLLBACK for 20260218000002_drop_dead_feature_tables.sql
-- Run this manually via Supabase SQL Editor if you need to restore dropped tables.
-- NOTE: This recreates the schema only — data is NOT recoverable.

-- ============================================================================
-- 1. Restore Partner API tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired', 'revoked')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 5000,
  invite_id UUID REFERENCES partner_invites(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_namespace_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  namespace_id UUID NOT NULL REFERENCES pinecone_namespaces(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, namespace_id)
);

CREATE TABLE IF NOT EXISTS partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES partner_api_keys(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  namespace_slug TEXT,
  query_params JSONB DEFAULT '{}',
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Restore Content Pipeline tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'brain_dump' CHECK (status IN (
    'brain_dump', 'research', 'outline', 'draft', 'review', 'outputs', 'completed'
  )),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_brain_dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
  raw_content TEXT NOT NULL,
  extracted_themes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
  outline_json JSONB NOT NULL,
  selected BOOLEAN DEFAULT FALSE,
  user_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  voice_score JSONB,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL CHECK (output_type IN (
    'substack_post', 'substack_image',
    'youtube_script', 'youtube_description', 'youtube_thumbnail',
    'tiktok_15s', 'tiktok_30s', 'tiktok_60s',
    'shorts_script', 'reels_script'
  )),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Restore helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION is_partner(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM partners
    WHERE user_id = user_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_partner_id(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  partner_uuid UUID;
BEGIN
  SELECT id INTO partner_uuid FROM partners
  WHERE user_id = user_uuid AND status = 'active';
  RETURN partner_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
