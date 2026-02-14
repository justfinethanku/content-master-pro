import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer, getSupabase, AnySupabase } from "@/lib/mcp/server";

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authenticateRequest(
  req: NextRequest,
  supabase: AnySupabase
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  // Check mcp_api_keys table
  const { data: keyRow } = await supabase
    .from("mcp_api_keys")
    .select("id, user_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (keyRow) {
    // Fire-and-forget: update last_used_at
    supabase
      .from("mcp_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id)
      .then();

    return { userId: keyRow.user_id };
  }

  return null;
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  // Authenticate
  const auth = await authenticateRequest(req, supabase);
  if (!auth) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create fresh server + transport per request (stateless)
  const server = createMcpServer(supabase, auth.userId);
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);

  return transport.handleRequest(req as unknown as Request);
}

export async function GET() {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Use POST." }, id: null }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE() {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
