/**
 * Admin API - Invite Management
 *
 * GET /api/admin/invites - List all invites
 * POST /api/admin/invites - Create new invite
 * DELETE /api/admin/invites?id=<id> - Revoke invite
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/partner-api";
import { PartnerInvite } from "@/lib/types";

/**
 * List all invites (admin only)
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

  // Get status filter from query params
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("partner_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: invites, error } = await query;

  if (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites });
}

/**
 * Create new invite (admin only)
 */
export async function POST(request: NextRequest) {
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
  let body: {
    email: string;
    expires_in_days?: number;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate email
  if (!body.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Generate invite code
  const code = generateInviteCode();

  // Calculate expiration (default 7 days)
  const expiresInDays = body.expires_in_days || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Create invite
  const { data: invite, error } = await supabase
    .from("partner_invites")
    .insert({
      code,
      email: body.email.toLowerCase().trim(),
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
      metadata: body.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invite }, { status: 201 });
}

/**
 * Revoke invite (admin only)
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

  // Get invite ID from query params
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Invite ID is required" }, { status: 400 });
  }

  // Check invite status
  const { data: invite, error: fetchError } = await supabase
    .from("partner_invites")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if ((invite as PartnerInvite).status === "redeemed") {
    return NextResponse.json(
      { error: "Cannot revoke a redeemed invite" },
      { status: 400 }
    );
  }

  // Revoke invite
  const { error } = await supabase
    .from("partner_invites")
    .update({ status: "revoked" })
    .eq("id", id);

  if (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
