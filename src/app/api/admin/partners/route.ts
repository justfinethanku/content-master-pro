/**
 * Admin API - Partner Management
 *
 * GET /api/admin/partners - List all partners
 * GET /api/admin/partners?id=<id> - Get single partner details
 * PATCH /api/admin/partners - Update partner
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Partner, PartnerUpdate } from "@/lib/types";

/**
 * List all partners or get single partner (admin only)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated and admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check for single partner request
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    // Get single partner with API keys and permissions
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("*")
      .eq("id", id)
      .single();

    if (partnerError) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Get API keys (without hash)
    const { data: apiKeys } = await supabase
      .from("partner_api_keys")
      .select("id, key_prefix, name, status, last_used_at, created_at")
      .eq("partner_id", id)
      .order("created_at", { ascending: false });

    // Get permissions with namespace details
    const { data: permissions } = await supabase
      .from("partner_namespace_permissions")
      .select(
        `
        *,
        pinecone_namespaces (*)
      `
      )
      .eq("partner_id", id);

    return NextResponse.json({
      partner,
      apiKeys: apiKeys || [],
      permissions: permissions || [],
    });
  }

  // Get status filter
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: partners, error } = await query;

  if (error) {
    console.error("Error fetching partners:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ partners });
}

/**
 * Update partner (admin only)
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated and admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request body
  let body: { id: string } & PartnerUpdate;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Partner ID is required" }, { status: 400 });
  }

  // Build update object
  const updateData: Partial<Partner> = {};

  if (body.organization_name !== undefined) {
    updateData.organization_name = body.organization_name;
  }
  if (body.contact_email !== undefined) {
    updateData.contact_email = body.contact_email;
  }
  if (body.status !== undefined) {
    updateData.status = body.status;
  }
  if (body.rate_limit_per_minute !== undefined) {
    updateData.rate_limit_per_minute = body.rate_limit_per_minute;
  }
  if (body.rate_limit_per_day !== undefined) {
    updateData.rate_limit_per_day = body.rate_limit_per_day;
  }
  if (body.metadata !== undefined) {
    updateData.metadata = body.metadata;
  }

  // Update partner
  const { data: partner, error } = await supabase
    .from("partners")
    .update(updateData)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating partner:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ partner });
}

/**
 * Delete/revoke partner API key (admin only)
 * DELETE /api/admin/partners?keyId=<keyId>
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated and admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keyId = request.nextUrl.searchParams.get("keyId");

  if (!keyId) {
    return NextResponse.json({ error: "keyId is required" }, { status: 400 });
  }

  // Revoke the API key (set status to 'revoked' rather than deleting)
  const { data: apiKey, error } = await supabase
    .from("partner_api_keys")
    .update({ status: "revoked" })
    .eq("id", keyId)
    .select()
    .single();

  if (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ apiKey, message: "API key revoked" });
}
