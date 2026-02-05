/**
 * Tier Thresholds Config API
 *
 * GET /api/routing/config/tiers - List tiers
 * PATCH /api/routing/config/tiers - Update tier(s)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getTierThresholds,
  updateTierThreshold,
} from "@/lib/routing";
import type { TierThresholdUpdate } from "@/lib/routing";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("active") === "true";

    const tiers = await getTierThresholds(supabase, { activeOnly });

    return NextResponse.json({ tiers });
  } catch (error) {
    console.error("Get tiers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get tiers" },
      { status: 500 }
    );
  }
}

// Update a single tier
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const updates: TierThresholdUpdate = {};

    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.min_score !== undefined) updates.min_score = body.min_score;
    if (body.max_score !== undefined) updates.max_score = body.max_score;
    if (body.color !== undefined) updates.color = body.color;
    if (body.actions !== undefined) updates.actions = body.actions;
    if (body.auto_stagger !== undefined) updates.auto_stagger = body.auto_stagger;
    if (body.preferred_days !== undefined) updates.preferred_days = body.preferred_days;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const tier = await updateTierThreshold(supabase, body.id, updates);

    return NextResponse.json({
      success: true,
      tier,
    });
  } catch (error) {
    console.error("Update tier error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tier" },
      { status: 500 }
    );
  }
}
