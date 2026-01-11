/**
 * Partner API - Invite Redemption
 *
 * POST /api/partner/redeem - Redeem an invite code
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { grantDefaultPermissions, isValidInviteCodeFormat } from "@/lib/partner-api";
import { PartnerInvite } from "@/lib/types";

/**
 * Redeem an invite code
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is already a partner
  const { data: existingPartner } = await supabase
    .from("partners")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (existingPartner) {
    return NextResponse.json(
      { error: "You are already a registered partner" },
      { status: 400 }
    );
  }

  // Parse request body
  let body: {
    code: string;
    organization_name: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate invite code format
  if (!body.code || !isValidInviteCodeFormat(body.code)) {
    return NextResponse.json({ error: "Invalid invite code format" }, { status: 400 });
  }

  // Validate organization name
  if (
    !body.organization_name ||
    typeof body.organization_name !== "string" ||
    body.organization_name.trim() === ""
  ) {
    return NextResponse.json(
      { error: "Organization name is required" },
      { status: 400 }
    );
  }

  // Use service client to bypass RLS for atomic transaction
  const serviceClient = createServiceClient();

  // Look up invite
  const { data: invite, error: inviteError } = await serviceClient
    .from("partner_invites")
    .select("*")
    .eq("code", body.code.toUpperCase())
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  }

  const typedInvite = invite as PartnerInvite;

  // Check invite status
  if (typedInvite.status !== "pending") {
    const statusMessages: Record<string, string> = {
      redeemed: "This invite has already been redeemed",
      expired: "This invite has expired",
      revoked: "This invite has been revoked",
    };
    return NextResponse.json(
      { error: statusMessages[typedInvite.status] || "Invalid invite" },
      { status: 400 }
    );
  }

  // Check expiration
  if (new Date(typedInvite.expires_at) < new Date()) {
    // Mark as expired
    await serviceClient
      .from("partner_invites")
      .update({ status: "expired" })
      .eq("id", typedInvite.id);

    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  // Check email match (optional - can be relaxed)
  if (
    typedInvite.email.toLowerCase() !== user.email?.toLowerCase()
  ) {
    return NextResponse.json(
      {
        error: "This invite was issued to a different email address",
      },
      { status: 400 }
    );
  }

  // Create partner record
  const { data: partner, error: partnerError } = await serviceClient
    .from("partners")
    .insert({
      user_id: user.id,
      organization_name: body.organization_name.trim(),
      contact_email: user.email,
      status: "active",
      invite_id: typedInvite.id,
    })
    .select()
    .single();

  if (partnerError) {
    console.error("Error creating partner:", partnerError);
    return NextResponse.json(
      { error: "Failed to create partner account" },
      { status: 500 }
    );
  }

  // Mark invite as redeemed
  await serviceClient
    .from("partner_invites")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeemed_by: user.id,
    })
    .eq("id", typedInvite.id);

  // Grant default permissions (read access to all searchable namespaces)
  const permResult = await grantDefaultPermissions(partner.id);
  if (!permResult.success) {
    console.error("Error granting default permissions:", permResult.error);
    // Don't fail the redemption, just log the error
  }

  return NextResponse.json(
    {
      success: true,
      partner: {
        id: partner.id,
        organization_name: partner.organization_name,
        status: partner.status,
      },
      message: "Welcome! Your partner account has been created.",
    },
    { status: 201 }
  );
}
