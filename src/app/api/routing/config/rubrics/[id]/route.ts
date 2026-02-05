/**
 * Single Rubric Config API
 *
 * PATCH /api/routing/config/rubrics/[id] - Update rubric
 * DELETE /api/routing/config/rubrics/[id] - Deactivate rubric
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateScoringRubric } from "@/lib/routing";
import type { ScoringRubricUpdate } from "@/lib/routing";

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

    const updates: ScoringRubricUpdate = {};

    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.weight !== undefined) updates.weight = body.weight;
    if (body.criteria !== undefined) updates.criteria = body.criteria;
    if (body.is_modifier !== undefined) updates.is_modifier = body.is_modifier;
    if (body.baseline_score !== undefined) updates.baseline_score = body.baseline_score;
    if (body.modifiers !== undefined) updates.modifiers = body.modifiers;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const rubric = await updateScoringRubric(supabase, id, updates);

    return NextResponse.json({
      success: true,
      rubric,
    });
  } catch (error) {
    console.error("Update rubric error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update rubric" },
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

    // Soft delete by deactivating
    const rubric = await updateScoringRubric(supabase, id, { is_active: false });

    return NextResponse.json({
      success: true,
      rubric,
      message: "Rubric deactivated",
    });
  } catch (error) {
    console.error("Deactivate rubric error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to deactivate rubric" },
      { status: 500 }
    );
  }
}
