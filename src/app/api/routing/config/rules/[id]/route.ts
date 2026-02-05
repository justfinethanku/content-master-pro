/**
 * Single Rule Config API
 *
 * PATCH /api/routing/config/rules/[id] - Update rule
 * DELETE /api/routing/config/rules/[id] - Delete rule
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateRoutingRule, deleteRoutingRule } from "@/lib/routing";
import type { RoutingRuleUpdate } from "@/lib/routing";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updates: RoutingRuleUpdate = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.conditions !== undefined) updates.conditions = body.conditions;
    if (body.routes_to !== undefined) updates.routes_to = body.routes_to;
    if (body.youtube_version !== undefined) updates.youtube_version = body.youtube_version;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const rule = await updateRoutingRule(supabase, id, updates);

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error("Update rule error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await deleteRoutingRule(supabase, id);

    return NextResponse.json({
      success: true,
      message: "Rule deleted",
    });
  } catch (error) {
    console.error("Delete rule error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete rule" },
      { status: 500 }
    );
  }
}
