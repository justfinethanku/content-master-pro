/**
 * Single Slot Config API
 *
 * GET /api/routing/config/slots/[id] - Get slot
 * PATCH /api/routing/config/slots/[id] - Update slot
 * DELETE /api/routing/config/slots/[id] - Deactivate slot
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCalendarSlotById,
  updateCalendarSlot,
} from "@/lib/routing";
import type { CalendarSlotUpdate } from "@/lib/routing";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const slot = await getCalendarSlotById(supabase, id);

    if (!slot) {
      return NextResponse.json(
        { error: "Slot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(slot);
  } catch (error) {
    console.error("Get slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get slot" },
      { status: 500 }
    );
  }
}

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

    const updates: CalendarSlotUpdate = {};

    if (body.day_of_week !== undefined) updates.day_of_week = body.day_of_week;
    if (body.is_fixed !== undefined) updates.is_fixed = body.is_fixed;
    if (body.fixed_format !== undefined) updates.fixed_format = body.fixed_format;
    if (body.preferred_tier !== undefined) updates.preferred_tier = body.preferred_tier;
    if (body.skip_rules !== undefined) updates.skip_rules = body.skip_rules;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const slot = await updateCalendarSlot(supabase, id, updates);

    return NextResponse.json({
      success: true,
      slot,
    });
  } catch (error) {
    console.error("Update slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update slot" },
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
    const slot = await updateCalendarSlot(supabase, id, { is_active: false });

    return NextResponse.json({
      success: true,
      slot,
      message: "Slot deactivated",
    });
  } catch (error) {
    console.error("Deactivate slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to deactivate slot" },
      { status: 500 }
    );
  }
}
