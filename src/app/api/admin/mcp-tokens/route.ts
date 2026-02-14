/**
 * Admin API - MCP Token Management
 *
 * GET /api/admin/mcp-tokens - List all tokens
 * POST /api/admin/mcp-tokens - Create new token
 * DELETE /api/admin/mcp-tokens?id=<id> - Revoke token (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * List all MCP tokens (admin only)
 */
export async function GET() {
  const supabase = await createClient();

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

  const { data: tokens, error } = await supabase
    .from("mcp_api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens });
}

/**
 * Create new MCP token (admin only)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

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

  let body: { label: string; user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.label || typeof body.label !== "string") {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  // Generate token: cmp__ + 32 random base64url chars
  const token = "cmp__" + crypto.randomBytes(24).toString("base64url");

  const { data: row, error } = await supabase
    .from("mcp_api_keys")
    .insert({
      token,
      label: body.label.trim(),
      user_id: body.user_id || user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return the token + full connector URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.contentmasterpro.limited";
  const url = `${baseUrl}/api/mcp/${token}`;

  return NextResponse.json({ token: row, url }, { status: 201 });
}

/**
 * Revoke MCP token (admin only) — soft delete via revoked_at
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

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

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Token ID is required" }, { status: 400 });
  }

  // Check it exists and isn't already revoked
  const { data: existing, error: fetchError } = await supabase
    .from("mcp_api_keys")
    .select("id, revoked_at")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (existing.revoked_at) {
    return NextResponse.json({ error: "Token is already revoked" }, { status: 400 });
  }

  const { error } = await supabase
    .from("mcp_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
