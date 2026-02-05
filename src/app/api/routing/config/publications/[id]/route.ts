/**
 * Single Publication Config API
 *
 * GET /api/routing/config/publications/[id] - Get publication
 * PATCH /api/routing/config/publications/[id] - Update publication
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPublicationById,
  updatePublication,
} from "@/lib/routing";
import type { PublicationUpdate } from "@/lib/routing";

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
    const publication = await getPublicationById(supabase, id);

    if (!publication) {
      return NextResponse.json(
        { error: "Publication not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(publication);
  } catch (error) {
    console.error("Get publication error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get publication" },
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

    const updates: PublicationUpdate = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.weekly_target !== undefined) updates.weekly_target = body.weekly_target;
    if (body.unified_with !== undefined) updates.unified_with = body.unified_with;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const publication = await updatePublication(supabase, id, updates);

    return NextResponse.json({
      success: true,
      publication,
    });
  } catch (error) {
    console.error("Update publication error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update publication" },
      { status: 500 }
    );
  }
}
