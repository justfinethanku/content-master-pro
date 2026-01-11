/**
 * Supabase Admin/Service Role Client
 *
 * For operations that need to bypass RLS, like:
 * - API usage logging
 * - Partner invite redemption
 * - Admin operations from API routes
 *
 * This client doesn't require cookies context.
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client with service role key
 * Bypasses RLS - use carefully!
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
