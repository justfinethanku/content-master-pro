/**
 * Partner API - List Namespaces Endpoint
 *
 * GET /api/v1/namespaces
 *
 * Returns the list of namespaces the partner has access to.
 * Requires API key authentication via Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateApiKey,
  checkRateLimit,
  getRateLimitHeaders,
  getRateLimitExceededHeaders,
  logApiUsage,
  getClientIp,
} from "@/lib/partner-api";
import { PartnerNamespaceResponse } from "@/lib/types";

// CORS headers for public API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let partnerId: string | undefined;
  let apiKeyId: string | undefined;
  const endpoint = "/api/v1/namespaces";
  const method = "GET";

  try {
    // Authenticate API key
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        {
          status: authResult.statusCode,
          headers: corsHeaders,
        }
      );
    }

    const { context } = authResult;
    partnerId = context.partner.id;
    apiKeyId = context.apiKey.id;

    // Check rate limit
    const rateLimitResult = await checkRateLimit(partnerId, context.partner);
    if (!rateLimitResult.allowed) {
      // Log the rate-limited request
      await logApiUsage({
        api_key_id: apiKeyId,
        partner_id: partnerId,
        endpoint,
        method,
        status_code: 429,
        response_time_ms: Date.now() - startTime,
        error_message: "Rate limit exceeded",
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...getRateLimitExceededHeaders(
              rateLimitResult.info,
              rateLimitResult.retryAfter!
            ),
          },
        }
      );
    }

    // Map permissions to response format
    const namespaces: PartnerNamespaceResponse[] = context.permissions
      .filter((p) => p.pinecone_namespaces.is_active)
      .map((p) => ({
        slug: p.pinecone_namespaces.slug,
        display_name: p.pinecone_namespaces.display_name,
        description: p.pinecone_namespaces.description,
        source_type: p.pinecone_namespaces.source_type,
        can_read: p.can_read,
        can_write: p.can_write,
      }));

    // Log successful request
    await logApiUsage({
      api_key_id: apiKeyId,
      partner_id: partnerId,
      endpoint,
      method,
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      ip_address: getClientIp(request),
      user_agent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json(
      { namespaces },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          ...getRateLimitHeaders(rateLimitResult.info),
        },
      }
    );
  } catch (error) {
    console.error("Namespaces API error:", error);

    // Log error if we have partner context
    if (partnerId && apiKeyId) {
      await logApiUsage({
        api_key_id: apiKeyId,
        partner_id: partnerId,
        endpoint,
        method,
        status_code: 500,
        response_time_ms: Date.now() - startTime,
        error_message:
          error instanceof Error ? error.message : "Internal server error",
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent") || undefined,
      });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
