/**
 * Partner API Key Authentication
 *
 * Handles:
 * - Extracting and validating Bearer tokens
 * - Looking up API keys by hash
 * - Verifying key and partner status
 * - Loading partner permissions
 */

import { createServiceClient } from "@/lib/supabase/admin";
import {
  Partner,
  PartnerApiKey,
  PartnerAuthContext,
  PartnerNamespacePermissionWithNamespace,
} from "@/lib/types";
import { extractBearerToken, hashApiKey, isValidApiKeyFormat } from "./keys";
import { NextRequest } from "next/server";

export type AuthResult =
  | { success: true; context: PartnerAuthContext }
  | { success: false; error: string; statusCode: number };

/**
 * Authenticate an API request using the Authorization header
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  // Extract Bearer token
  const token = extractBearerToken(authHeader);
  if (!token) {
    return {
      success: false,
      error: "Missing or invalid Authorization header. Use: Bearer <api_key>",
      statusCode: 401,
    };
  }

  // Validate key format
  if (!isValidApiKeyFormat(token)) {
    return {
      success: false,
      error: "Invalid API key format",
      statusCode: 401,
    };
  }

  // Hash the token for lookup
  const keyHash = hashApiKey(token);

  // Create Supabase client with service role to bypass RLS
  // (API key auth doesn't have a user session)
  const supabase = createServiceClient();

  // Look up the API key by hash
  const { data: apiKey, error: keyError } = await supabase
    .from("partner_api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !apiKey) {
    return {
      success: false,
      error: "Invalid API key",
      statusCode: 401,
    };
  }

  const typedApiKey = apiKey as PartnerApiKey;

  // Check if key is active
  if (typedApiKey.status !== "active") {
    return {
      success: false,
      error: "API key has been revoked",
      statusCode: 401,
    };
  }

  // Check if key is expired
  if (typedApiKey.expires_at && new Date(typedApiKey.expires_at) < new Date()) {
    return {
      success: false,
      error: "API key has expired",
      statusCode: 401,
    };
  }

  // Look up the partner
  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("*")
    .eq("id", typedApiKey.partner_id)
    .single();

  if (partnerError || !partner) {
    return {
      success: false,
      error: "Partner not found",
      statusCode: 401,
    };
  }

  const typedPartner = partner as Partner;

  // Check if partner is active
  if (typedPartner.status !== "active") {
    return {
      success: false,
      error: `Partner account is ${typedPartner.status}`,
      statusCode: 403,
    };
  }

  // Load partner namespace permissions
  const { data: permissions, error: permError } = await supabase
    .from("partner_namespace_permissions")
    .select(
      `
      *,
      pinecone_namespaces (*)
    `
    )
    .eq("partner_id", typedPartner.id);

  if (permError) {
    console.error("Error loading permissions:", permError);
    return {
      success: false,
      error: "Failed to load permissions",
      statusCode: 500,
    };
  }

  const typedPermissions =
    (permissions as PartnerNamespacePermissionWithNamespace[]) || [];

  // Update last_used_at (fire and forget)
  supabase
    .from("partner_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", typedApiKey.id)
    .then(() => {
      // Intentionally empty - we don't wait for this
    });

  return {
    success: true,
    context: {
      partner: typedPartner,
      apiKey: typedApiKey,
      permissions: typedPermissions,
    },
  };
}

/**
 * Check if partner has read access to a namespace
 */
export function hasReadAccess(
  context: PartnerAuthContext,
  namespaceSlug: string
): boolean {
  const permission = context.permissions.find(
    (p) => p.pinecone_namespaces.slug === namespaceSlug
  );
  return permission?.can_read ?? false;
}

/**
 * Check if partner has write access to a namespace
 */
export function hasWriteAccess(
  context: PartnerAuthContext,
  namespaceSlug: string
): boolean {
  const permission = context.permissions.find(
    (p) => p.pinecone_namespaces.slug === namespaceSlug
  );
  return permission?.can_write ?? false;
}

/**
 * Get all namespace slugs the partner can read
 */
export function getReadableNamespaces(context: PartnerAuthContext): string[] {
  return context.permissions
    .filter((p) => p.can_read && p.pinecone_namespaces.is_active)
    .map((p) => p.pinecone_namespaces.slug);
}

/**
 * Get all namespace slugs the partner can write to
 */
export function getWritableNamespaces(context: PartnerAuthContext): string[] {
  return context.permissions
    .filter((p) => p.can_write && p.pinecone_namespaces.is_active)
    .map((p) => p.pinecone_namespaces.slug);
}

/**
 * Filter requested namespaces to only those the partner can access
 */
export function filterAllowedNamespaces(
  context: PartnerAuthContext,
  requestedNamespaces: string[] | undefined,
  accessType: "read" | "write" = "read"
): string[] {
  const allowedNamespaces =
    accessType === "read"
      ? getReadableNamespaces(context)
      : getWritableNamespaces(context);

  if (!requestedNamespaces || requestedNamespaces.length === 0) {
    // Return all allowed namespaces if none specified
    return allowedNamespaces;
  }

  // Filter to only allowed namespaces
  return requestedNamespaces.filter((ns) => allowedNamespaces.includes(ns));
}

/**
 * Get client IP from request
 */
export function getClientIp(request: NextRequest): string | undefined {
  // Try various headers in order of preference
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP if there are multiple
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Vercel-specific header
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    return vercelIp.split(",")[0].trim();
  }

  return undefined;
}
