import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getSupabase } from "@/lib/mcp/server";
import { createSubscriberMcpServer } from "@/lib/mcp/subscriber-server";
import {
  checkSubscriberRateLimit,
  getSubscriberRateLimitHeaders,
} from "@/lib/mcp/subscriber-rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabase();

  // Authenticate subscriber token
  const { data: subscriber, error } = await supabase
    .from("subscriber_mcp_access")
    .select("id")
    .eq("token", token)
    .eq("is_revoked", false)
    .single();

  if (error || !subscriber) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  // Rate limit check
  const rateLimit = await checkSubscriberRateLimit(supabase, subscriber.id);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32029,
          message: `Rate limit exceeded. Retry after ${rateLimit.retryAfter}s.`,
        },
        id: null,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": (rateLimit.retryAfter ?? 60).toString(),
          ...getSubscriberRateLimitHeaders(rateLimit.info),
          ...CORS_HEADERS,
        },
      }
    );
  }

  // Fire-and-forget: update stats + log usage
  const now = new Date().toISOString();
  supabase.rpc("increment_subscriber_requests", { sub_id: subscriber.id }).then();
  supabase
    .from("subscriber_mcp_access")
    .update({ last_used_at: now })
    .eq("id", subscriber.id)
    .then();
  supabase
    .from("subscriber_mcp_usage")
    .insert({ subscriber_id: subscriber.id, tool_name: "mcp_request" })
    .then();

  // Create server + transport
  const server = createSubscriberMcpServer(supabase);
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);

  const response = await transport.handleRequest(req as unknown as Request);

  // Add CORS headers to the response
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST." },
      id: null,
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    }
  );
}

export async function DELETE() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    }
  );
}
