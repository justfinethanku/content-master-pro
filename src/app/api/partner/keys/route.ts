/**
 * Partner API - API Key Management
 *
 * GET /api/partner/keys - List partner's API keys
 * POST /api/partner/keys - Create new API key
 * DELETE /api/partner/keys?id=<id> - Revoke API key
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/partner-api";
import { Partner, PartnerApiKey } from "@/lib/types";

/**
 * Get current user's partner record
 */
async function getCurrentPartner(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Partner | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  return partner as Partner | null;
}

/**
 * List partner's API keys
 */
export async function GET() {
  const supabase = await createClient();

  const partner = await getCurrentPartner(supabase);
  if (!partner) {
    return NextResponse.json(
      { error: "Not a registered partner" },
      { status: 403 }
    );
  }

  // Get API keys (without hash)
  const { data: keys, error } = await supabase
    .from("partner_api_keys")
    .select("id, key_prefix, name, status, last_used_at, expires_at, created_at")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: keys || [] });
}

/**
 * Create new API key
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const partner = await getCurrentPartner(supabase);
  if (!partner) {
    return NextResponse.json(
      { error: "Not a registered partner" },
      { status: 403 }
    );
  }

  // Parse request body
  let body: {
    name: string;
    expires_in_days?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json(
      { error: "Key name is required" },
      { status: 400 }
    );
  }

  // Check key limit (max 5 active keys per partner)
  const { count } = await supabase
    .from("partner_api_keys")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partner.id)
    .eq("status", "active");

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Maximum of 5 active API keys allowed. Please revoke an existing key." },
      { status: 400 }
    );
  }

  // Generate API key
  const { fullKey, keyHash, keyPrefix } = generateApiKey();

  // Calculate expiration if specified
  let expiresAt: string | null = null;
  if (body.expires_in_days && body.expires_in_days > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + body.expires_in_days);
    expiresAt = expDate.toISOString();
  }

  // Create key record
  const { data: keyRecord, error } = await supabase
    .from("partner_api_keys")
    .insert({
      partner_id: partner.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: body.name.trim(),
      expires_at: expiresAt,
    })
    .select("id, key_prefix, name, status, expires_at, created_at")
    .single();

  if (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return the full key ONLY ONCE
  return NextResponse.json(
    {
      key: {
        ...keyRecord,
        fullKey, // This is shown only once!
      },
      warning:
        "Store this API key securely. It will not be shown again.",
    },
    { status: 201 }
  );
}

/**
 * Revoke API key
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const partner = await getCurrentPartner(supabase);
  if (!partner) {
    return NextResponse.json(
      { error: "Not a registered partner" },
      { status: 403 }
    );
  }

  const keyId = request.nextUrl.searchParams.get("id");
  if (!keyId) {
    return NextResponse.json(
      { error: "Key ID is required" },
      { status: 400 }
    );
  }

  // Verify key belongs to partner
  const { data: key, error: fetchError } = await supabase
    .from("partner_api_keys")
    .select("id, partner_id, status")
    .eq("id", keyId)
    .single();

  if (fetchError || !key) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  if ((key as PartnerApiKey).partner_id !== partner.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if ((key as PartnerApiKey).status === "revoked") {
    return NextResponse.json(
      { error: "Key is already revoked" },
      { status: 400 }
    );
  }

  // Revoke key
  const { error } = await supabase
    .from("partner_api_keys")
    .update({ status: "revoked" })
    .eq("id", keyId);

  if (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
