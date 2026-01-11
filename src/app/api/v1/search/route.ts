/**
 * Partner API - Semantic Search Endpoint
 *
 * POST /api/v1/search
 *
 * Searches across allowed Pinecone namespaces using semantic similarity.
 * Requires API key authentication via Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateApiKey,
  filterAllowedNamespaces,
  checkRateLimit,
  getRateLimitHeaders,
  getRateLimitExceededHeaders,
  logApiUsage,
  getClientIp,
} from "@/lib/partner-api";
import { searchPosts } from "@/lib/pinecone/search";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  PartnerSearchRequest,
  PartnerSearchResponse,
  SearchResult,
} from "@/lib/types";

// CORS headers for public API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let partnerId: string | undefined;
  let apiKeyId: string | undefined;
  const endpoint = "/api/v1/search";
  const method = "POST";

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

    // Parse request body
    let body: PartnerSearchRequest;
    try {
      body = await request.json();
    } catch {
      await logApiUsage({
        api_key_id: apiKeyId,
        partner_id: partnerId,
        endpoint,
        method,
        status_code: 400,
        response_time_ms: Date.now() - startTime,
        error_message: "Invalid JSON body",
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json(
        { error: "Invalid JSON body" },
        {
          status: 400,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult.info),
          },
        }
      );
    }

    // Validate query
    if (!body.query || typeof body.query !== "string" || body.query.trim() === "") {
      await logApiUsage({
        api_key_id: apiKeyId,
        partner_id: partnerId,
        endpoint,
        method,
        query_params: { query: body.query, namespaces: body.namespaces, topK: body.topK },
        status_code: 400,
        response_time_ms: Date.now() - startTime,
        error_message: "Query is required",
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json(
        { error: "Query is required and must be a non-empty string" },
        {
          status: 400,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult.info),
          },
        }
      );
    }

    // Filter namespaces to only those the partner can access
    const allowedNamespaces = filterAllowedNamespaces(
      context,
      body.namespaces,
      "read"
    );

    if (allowedNamespaces.length === 0) {
      await logApiUsage({
        api_key_id: apiKeyId,
        partner_id: partnerId,
        endpoint,
        method,
        query_params: { query: body.query, namespaces: body.namespaces, topK: body.topK },
        status_code: 403,
        response_time_ms: Date.now() - startTime,
        error_message: "No accessible namespaces",
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json(
        { error: "No accessible namespaces. Contact your administrator." },
        {
          status: 403,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult.info),
          },
        }
      );
    }

    // Validate topK
    const topK = Math.min(Math.max(body.topK || 10, 1), 100);

    // Create Supabase client for search
    const supabase = createServiceClient();

    // Execute search
    const searchResults = await searchPosts(supabase, {
      query: body.query.trim(),
      namespaces: allowedNamespaces,
      topK,
    });

    // Map results to response format
    const results: SearchResult[] = searchResults.map((r) => ({
      id: r.id,
      score: r.score,
      title: r.title,
      content: r.contentPreview,
      source: r.namespace || r.source,
      url: r.url,
      metadata: {
        author: r.author,
        publishedAt: r.publishedAt,
        chunkIndex: r.chunkIndex,
        chunkCount: r.chunkCount,
      },
    }));

    // Log successful request
    await logApiUsage({
      api_key_id: apiKeyId,
      partner_id: partnerId,
      endpoint,
      method,
      namespace_slug: allowedNamespaces.join(","),
      query_params: {
        query: body.query,
        namespaces: allowedNamespaces,
        topK,
      },
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      ip_address: getClientIp(request),
      user_agent: request.headers.get("user-agent") || undefined,
    });

    const response: PartnerSearchResponse = {
      results,
      query: body.query,
      namespaces: allowedNamespaces,
      count: results.length,
      rateLimit: rateLimitResult.info,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...getRateLimitHeaders(rateLimitResult.info),
      },
    });
  } catch (error) {
    console.error("Search API error:", error);

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
