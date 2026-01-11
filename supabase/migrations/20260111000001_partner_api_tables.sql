-- Partner API System Tables
-- Invite-only partner access with API key authentication and usage tracking

-- ============================================================================
-- Table: partner_invites
-- Admin-created invites that partners redeem to gain access
-- ============================================================================
CREATE TABLE partner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                    -- e.g., "INV_abc123xyz"
  email TEXT NOT NULL,                          -- Expected recipient email
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired', 'revoked')),
  metadata JSONB DEFAULT '{}',                  -- Notes, preset permissions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_invites_code ON partner_invites(code);
CREATE INDEX idx_partner_invites_email ON partner_invites(email);
CREATE INDEX idx_partner_invites_status ON partner_invites(status);
CREATE INDEX idx_partner_invites_expires_at ON partner_invites(expires_at);
CREATE INDEX idx_partner_invites_created_by ON partner_invites(created_by);

-- ============================================================================
-- Table: partners
-- Users who have redeemed invites and are now partners
-- ============================================================================
CREATE TABLE partners (
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

CREATE INDEX idx_partners_user_id ON partners(user_id);
CREATE INDEX idx_partners_status ON partners(status);
CREATE INDEX idx_partners_contact_email ON partners(contact_email);

-- ============================================================================
-- Table: partner_namespace_permissions
-- Per-partner access control for Pinecone namespaces
-- ============================================================================
CREATE TABLE partner_namespace_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  namespace_id UUID NOT NULL REFERENCES pinecone_namespaces(id) ON DELETE CASCADE,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, namespace_id)
);

CREATE INDEX idx_partner_namespace_permissions_partner_id ON partner_namespace_permissions(partner_id);
CREATE INDEX idx_partner_namespace_permissions_namespace_id ON partner_namespace_permissions(namespace_id);

-- ============================================================================
-- Table: partner_api_keys
-- API keys for programmatic access (hashed, never store plaintext)
-- ============================================================================
CREATE TABLE partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,                -- SHA-256 hash of the key
  key_prefix TEXT NOT NULL,                     -- First 16 chars for UI display
  name TEXT NOT NULL,                           -- User-friendly name
  last_used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at TIMESTAMPTZ,                       -- Optional expiration
  metadata JSONB DEFAULT '{}',                  -- IP whitelist, scopes, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_api_keys_partner_id ON partner_api_keys(partner_id);
CREATE INDEX idx_partner_api_keys_key_hash ON partner_api_keys(key_hash);
CREATE INDEX idx_partner_api_keys_key_prefix ON partner_api_keys(key_prefix);
CREATE INDEX idx_partner_api_keys_status ON partner_api_keys(status);

-- ============================================================================
-- Table: partner_api_usage
-- Complete audit trail of all API calls
-- ============================================================================
CREATE TABLE partner_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES partner_api_keys(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,                       -- '/api/v1/search', etc.
  method TEXT NOT NULL,                         -- 'GET', 'POST'
  namespace_slug TEXT,                          -- Which namespace queried
  query_params JSONB DEFAULT '{}',              -- Request parameters
  status_code INTEGER NOT NULL,                 -- HTTP response code
  response_time_ms INTEGER,                     -- Latency
  error_message TEXT,                           -- If error occurred
  ip_address TEXT,                              -- Client IP
  user_agent TEXT,                              -- Client user agent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_api_usage_api_key_id ON partner_api_usage(api_key_id);
CREATE INDEX idx_partner_api_usage_partner_id ON partner_api_usage(partner_id);
CREATE INDEX idx_partner_api_usage_endpoint ON partner_api_usage(endpoint);
CREATE INDEX idx_partner_api_usage_created_at ON partner_api_usage(created_at);
CREATE INDEX idx_partner_api_usage_status_code ON partner_api_usage(status_code);
-- Composite index for rate limiting queries
CREATE INDEX idx_partner_api_usage_rate_limit ON partner_api_usage(partner_id, created_at DESC);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE partner_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_namespace_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper function to check if user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a partner
CREATE OR REPLACE FUNCTION is_partner(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM partners
    WHERE user_id = user_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get partner_id for a user
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

-- ============================================================================
-- RLS Policies: partner_invites
-- Admins can read/write all, partners can read own redeemed invites
-- ============================================================================
CREATE POLICY "Admins can read all invites"
  ON partner_invites FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can read own redeemed invites"
  ON partner_invites FOR SELECT
  TO authenticated
  USING (redeemed_by = auth.uid());

CREATE POLICY "Admins can create invites"
  ON partner_invites FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update invites"
  ON partner_invites FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete invites"
  ON partner_invites FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- RLS Policies: partners
-- Admins can read/write all, partners can read own record
-- ============================================================================
CREATE POLICY "Admins can read all partners"
  ON partners FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can read own record"
  ON partners FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can create partners"
  ON partners FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Partners can also be created during invite redemption (service role handles this)
CREATE POLICY "Service role can create partners"
  ON partners FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can update partners"
  ON partners FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete partners"
  ON partners FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- RLS Policies: partner_namespace_permissions
-- Admins can read/write all, partners can read own permissions
-- ============================================================================
CREATE POLICY "Admins can read all permissions"
  ON partner_namespace_permissions FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can read own permissions"
  ON partner_namespace_permissions FOR SELECT
  TO authenticated
  USING (partner_id = get_partner_id(auth.uid()));

CREATE POLICY "Admins can manage permissions"
  ON partner_namespace_permissions FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- ============================================================================
-- RLS Policies: partner_api_keys
-- Admins can read/revoke all, partners can manage own keys
-- ============================================================================
CREATE POLICY "Admins can read all API keys"
  ON partner_api_keys FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can read own API keys"
  ON partner_api_keys FOR SELECT
  TO authenticated
  USING (partner_id = get_partner_id(auth.uid()));

CREATE POLICY "Partners can create own API keys"
  ON partner_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (partner_id = get_partner_id(auth.uid()));

CREATE POLICY "Partners can update own API keys"
  ON partner_api_keys FOR UPDATE
  TO authenticated
  USING (partner_id = get_partner_id(auth.uid()))
  WITH CHECK (partner_id = get_partner_id(auth.uid()));

CREATE POLICY "Admins can update any API key"
  ON partner_api_keys FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Partners can delete own API keys"
  ON partner_api_keys FOR DELETE
  TO authenticated
  USING (partner_id = get_partner_id(auth.uid()));

CREATE POLICY "Admins can delete any API key"
  ON partner_api_keys FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- RLS Policies: partner_api_usage
-- Admins can read all, partners can read own usage
-- Writing is only via service role (API logging)
-- ============================================================================
CREATE POLICY "Admins can read all usage"
  ON partner_api_usage FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Partners can read own usage"
  ON partner_api_usage FOR SELECT
  TO authenticated
  USING (partner_id = get_partner_id(auth.uid()));

-- Only service role can insert usage logs (from API routes)
CREATE POLICY "Service role can insert usage"
  ON partner_api_usage FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- Update triggers for updated_at columns
-- ============================================================================
CREATE TRIGGER trigger_partner_invites_updated_at
  BEFORE UPDATE ON partner_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_partner_namespace_permissions_updated_at
  BEFORE UPDATE ON partner_namespace_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_partner_api_keys_updated_at
  BEFORE UPDATE ON partner_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE partner_invites IS 'Admin-created invite codes that partners redeem to gain API access';
COMMENT ON TABLE partners IS 'Registered partner organizations with API access';
COMMENT ON TABLE partner_namespace_permissions IS 'Per-partner access control for Pinecone namespaces';
COMMENT ON TABLE partner_api_keys IS 'API keys for programmatic access (hashed)';
COMMENT ON TABLE partner_api_usage IS 'Complete audit trail of all partner API calls';

COMMENT ON COLUMN partner_api_keys.key_hash IS 'SHA-256 hash of the API key - never store plaintext';
COMMENT ON COLUMN partner_api_keys.key_prefix IS 'First 16 characters of key for display (e.g., pk_live_abc123...)';
