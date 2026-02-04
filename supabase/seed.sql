-- Local Development Seed Data
-- This file runs AFTER migrations during `supabase db reset`
--
-- Most seed data (ai_models, app_settings, prompts, pinecone_namespaces) 
-- is already in the migrations. This file is for local-dev-specific data.

-- =============================================================================
-- TEST ADMIN USER
-- =============================================================================
-- Creates a test admin user for local development.
-- Email: test@example.com
-- Password: password123
--
-- Note: In production, users are created through the normal auth flow.

-- Insert test user into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  FALSE,
  'authenticated',
  'authenticated',
  ''
) ON CONFLICT (id) DO NOTHING;

-- The profiles trigger auto-creates the profile, but we need to make them admin
UPDATE profiles 
SET role = 'admin', display_name = 'Test Admin'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- =============================================================================
-- LOCAL DEV NOTES
-- =============================================================================
-- After running `supabase start`:
--   - Studio: http://127.0.0.1:54323
--   - API: http://127.0.0.1:54321
--   - Inbucket (email): http://127.0.0.1:54324
--
-- Test credentials:
--   Email: test@example.com
--   Password: password123
--
-- To reset database: supabase db reset
