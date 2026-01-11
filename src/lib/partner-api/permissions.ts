/**
 * Partner Namespace Permission Helpers
 *
 * Utilities for managing and checking partner permissions on namespaces.
 */

import { createServiceClient } from "@/lib/supabase/admin";
import {
  PartnerNamespacePermission,
  PartnerNamespacePermissionWithNamespace,
  PineconeNamespace,
} from "@/lib/types";

/**
 * Get all permissions for a partner with namespace details
 */
export async function getPartnerPermissions(
  partnerId: string
): Promise<PartnerNamespacePermissionWithNamespace[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("partner_namespace_permissions")
    .select(
      `
      *,
      pinecone_namespaces (*)
    `
    )
    .eq("partner_id", partnerId);

  if (error) {
    console.error("Error fetching partner permissions:", error);
    return [];
  }

  return (data as PartnerNamespacePermissionWithNamespace[]) || [];
}

/**
 * Get all namespaces with permission status for a partner
 * Useful for building permission matrices in admin UI
 */
export async function getNamespacesWithPermissions(partnerId: string): Promise<
  Array<{
    namespace: PineconeNamespace;
    permission: PartnerNamespacePermission | null;
  }>
> {
  const supabase = createServiceClient();

  // Get all active namespaces
  const { data: namespaces, error: nsError } = await supabase
    .from("pinecone_namespaces")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (nsError) {
    console.error("Error fetching namespaces:", nsError);
    return [];
  }

  // Get partner's permissions
  const { data: permissions, error: permError } = await supabase
    .from("partner_namespace_permissions")
    .select("*")
    .eq("partner_id", partnerId);

  if (permError) {
    console.error("Error fetching permissions:", permError);
    return [];
  }

  // Map namespaces with their permissions
  const permissionMap = new Map(
    (permissions as PartnerNamespacePermission[]).map((p) => [p.namespace_id, p])
  );

  return (namespaces as PineconeNamespace[]).map((namespace) => ({
    namespace,
    permission: permissionMap.get(namespace.id) || null,
  }));
}

/**
 * Set permission for a partner on a namespace
 * Creates or updates the permission record
 */
export async function setNamespacePermission(
  partnerId: string,
  namespaceId: string,
  canRead: boolean,
  canWrite: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Upsert the permission
  const { error } = await supabase.from("partner_namespace_permissions").upsert(
    {
      partner_id: partnerId,
      namespace_id: namespaceId,
      can_read: canRead,
      can_write: canWrite,
    },
    {
      onConflict: "partner_id,namespace_id",
    }
  );

  if (error) {
    console.error("Error setting permission:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Remove permission for a partner on a namespace
 */
export async function removeNamespacePermission(
  partnerId: string,
  namespaceId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("partner_namespace_permissions")
    .delete()
    .eq("partner_id", partnerId)
    .eq("namespace_id", namespaceId);

  if (error) {
    console.error("Error removing permission:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Grant read access to all active namespaces for a partner
 * Useful for initial partner setup
 */
export async function grantDefaultPermissions(
  partnerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // Get all active namespaces
  const { data: namespaces, error: nsError } = await supabase
    .from("pinecone_namespaces")
    .select("id")
    .eq("is_active", true)
    .eq("is_searchable", true);

  if (nsError) {
    console.error("Error fetching namespaces:", nsError);
    return { success: false, error: nsError.message };
  }

  if (!namespaces || namespaces.length === 0) {
    return { success: true };
  }

  // Create permission records for each namespace
  const permissions = (namespaces as { id: string }[]).map((ns) => ({
    partner_id: partnerId,
    namespace_id: ns.id,
    can_read: true,
    can_write: false,
  }));

  const { error } = await supabase
    .from("partner_namespace_permissions")
    .upsert(permissions, {
      onConflict: "partner_id,namespace_id",
    });

  if (error) {
    console.error("Error granting default permissions:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Revoke all permissions for a partner
 */
export async function revokeAllPermissions(
  partnerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("partner_namespace_permissions")
    .delete()
    .eq("partner_id", partnerId);

  if (error) {
    console.error("Error revoking permissions:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Bulk update permissions for a partner
 */
export async function bulkUpdatePermissions(
  partnerId: string,
  permissions: Array<{
    namespaceId: string;
    canRead: boolean;
    canWrite: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const records = permissions.map((p) => ({
    partner_id: partnerId,
    namespace_id: p.namespaceId,
    can_read: p.canRead,
    can_write: p.canWrite,
  }));

  const { error } = await supabase
    .from("partner_namespace_permissions")
    .upsert(records, {
      onConflict: "partner_id,namespace_id",
    });

  if (error) {
    console.error("Error bulk updating permissions:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
