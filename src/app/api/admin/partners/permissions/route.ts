/**
 * Admin API - Partner Namespace Permissions
 *
 * GET /api/admin/partners/permissions?partnerId=<id> - Get partner permissions with all namespaces
 * PUT /api/admin/partners/permissions - Set/update permissions
 * DELETE /api/admin/partners/permissions - Remove permission
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  setNamespacePermission,
  removeNamespacePermission,
  bulkUpdatePermissions,
} from "@/lib/partner-api";

/**
 * Get partner permissions with all namespaces (admin only)
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

  const partnerId = request.nextUrl.searchParams.get("partnerId");
  if (!partnerId) {
    return NextResponse.json(
      { error: "partnerId is required" },
      { status: 400 }
    );
  }

  // Get all active namespaces
  const { data: namespaces, error: nsError } = await supabase
    .from("pinecone_namespaces")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (nsError) {
    return NextResponse.json({ error: nsError.message }, { status: 500 });
  }

  // Get partner's permissions
  const { data: permissions, error: permError } = await supabase
    .from("partner_namespace_permissions")
    .select("*")
    .eq("partner_id", partnerId);

  if (permError) {
    return NextResponse.json({ error: permError.message }, { status: 500 });
  }

  // Map namespaces with their permissions
  const permissionMap = new Map(
    (permissions || []).map((p: { namespace_id: string }) => [p.namespace_id, p])
  );

  const matrix = (namespaces || []).map(
    (namespace: { id: string; slug: string; display_name: string }) => ({
      namespace_id: namespace.id,
      namespace_slug: namespace.slug,
      namespace_name: namespace.display_name,
      can_read: (permissionMap.get(namespace.id) as { can_read?: boolean })?.can_read ?? false,
      can_write: (permissionMap.get(namespace.id) as { can_write?: boolean })?.can_write ?? false,
    })
  );

  return NextResponse.json({ matrix });
}

/**
 * Set/update permissions (admin only)
 */
export async function PUT(request: NextRequest) {
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
    partnerId: string;
    permissions?: Array<{
      namespaceId: string;
      canRead: boolean;
      canWrite: boolean;
    }>;
    // Single permission update
    namespaceId?: string;
    canRead?: boolean;
    canWrite?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.partnerId) {
    return NextResponse.json(
      { error: "partnerId is required" },
      { status: 400 }
    );
  }

  // Bulk update
  if (body.permissions && Array.isArray(body.permissions)) {
    const result = await bulkUpdatePermissions(body.partnerId, body.permissions);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Single update
  if (body.namespaceId !== undefined) {
    const result = await setNamespacePermission(
      body.partnerId,
      body.namespaceId,
      body.canRead ?? false,
      body.canWrite ?? false
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "permissions array or namespaceId is required" },
    { status: 400 }
  );
}

/**
 * Remove permission (admin only)
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

  const partnerId = request.nextUrl.searchParams.get("partnerId");
  const namespaceId = request.nextUrl.searchParams.get("namespaceId");

  if (!partnerId || !namespaceId) {
    return NextResponse.json(
      { error: "partnerId and namespaceId are required" },
      { status: 400 }
    );
  }

  const result = await removeNamespacePermission(partnerId, namespaceId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
