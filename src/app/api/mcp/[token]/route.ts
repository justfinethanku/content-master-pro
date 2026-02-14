import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer, getSupabase } from "@/lib/mcp/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabase();

  // Look up token in mcp_api_keys
  const { data: keyRow, error } = await supabase
    .from("mcp_api_keys")
    .select("id, user_id")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (error || !keyRow) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fire-and-forget: update last_used_at
  supabase
    .from("mcp_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then();

  // Create fresh server + transport per request (stateless)
  const server = createMcpServer(supabase, keyRow.user_id);
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
