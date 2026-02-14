-- MCP API keys table (replaces JSON blob in app_settings)
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ  -- soft delete
);

-- Index for token lookups (auth on every request)
CREATE INDEX idx_mcp_api_keys_token ON mcp_api_keys (token) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage mcp_api_keys"
  ON mcp_api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Migrate existing key from app_settings into new table
DO $$
DECLARE
  setting_value JSONB;
  key_record JSONB;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE category = 'mcp' AND key = 'api_keys';

  IF setting_value IS NOT NULL AND setting_value->'keys' IS NOT NULL THEN
    FOR key_record IN SELECT * FROM jsonb_array_elements(setting_value->'keys')
    LOOP
      INSERT INTO mcp_api_keys (token, user_id, label, created_at)
      VALUES (
        key_record->>'key',
        (key_record->>'user_id')::UUID,
        COALESCE(key_record->>'label', 'Migrated key'),
        NOW()
      )
      ON CONFLICT (token) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

-- Ensure Jon's profile is admin (by email since we don't know the UUID)
UPDATE profiles SET role = 'admin'
WHERE email = 'jonathan@contentionmedia.com'
  AND role != 'admin';
