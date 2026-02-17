import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

const ALLOWED_ORIGIN = "https://promptkit.natebjones.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  let body: { name?: string; email?: string; access_code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { name, email, access_code } = body;

  if (!name || !email || !access_code) {
    return NextResponse.json(
      { error: "name, email, and access_code are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validate access code
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("category", "executive_circle")
    .eq("key", "access_code")
    .single();

  const validCode = setting?.value?.value;
  if (!validCode || access_code !== validCode) {
    return NextResponse.json(
      { error: "Invalid access code" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  // Check if email already registered — return existing token (recovery)
  const { data: existing } = await supabase
    .from("subscriber_mcp_access")
    .select("token")
    .eq("email", email.toLowerCase().trim())
    .eq("is_revoked", false)
    .maybeSingle();

  if (existing) {
    const connectorUrl = `https://www.contentmasterpro.limited/api/mcp/subscriber/${existing.token}`;
    return NextResponse.json(
      { token: existing.token, connector_url: connectorUrl, recovered: true },
      { headers: CORS_HEADERS }
    );
  }

  // Generate token: exc__ + 32 random base64url chars
  const token = `exc__${randomBytes(24).toString("base64url")}`;

  const { error: insertError } = await supabase
    .from("subscriber_mcp_access")
    .insert({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      token,
      access_code_used: access_code,
    });

  if (insertError) {
    console.error("Subscriber registration error:", insertError);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const connectorUrl = `https://www.contentmasterpro.limited/api/mcp/subscriber/${token}`;

  return NextResponse.json(
    { token, connector_url: connectorUrl },
    { status: 201, headers: CORS_HEADERS }
  );
}
