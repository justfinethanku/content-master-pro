/**
 * Calendar Slots Config API
 *
 * GET /api/routing/config/slots - List slots
 * POST /api/routing/config/slots - Create slot
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCalendarSlots,
  createCalendarSlot,
  getPublicationBySlug,
} from "@/lib/routing";
import type { CalendarSlotInsert } from "@/lib/routing";

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
    const publicationSlug = searchParams.get("publication");
    const activeOnly = searchParams.get("active") === "true";

    let publicationId: string | undefined;
    if (publicationSlug) {
      const pub = await getPublicationBySlug(supabase, publicationSlug);
      publicationId = pub?.id;
    }

    const slots = await getCalendarSlots(supabase, {
      publicationId,
      activeOnly,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Get slots error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get slots" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Validate required fields
    if (!body.publication_slug || body.day_of_week === undefined) {
      return NextResponse.json(
        { error: "publication_slug and day_of_week are required" },
        { status: 400 }
      );
    }

    // Validate day_of_week
    if (body.day_of_week < 0 || body.day_of_week > 6) {
      return NextResponse.json(
        { error: "day_of_week must be 0-6 (Sunday-Saturday)" },
        { status: 400 }
      );
    }

    // Get publication ID
    const publication = await getPublicationBySlug(supabase, body.publication_slug);
    if (!publication) {
      return NextResponse.json(
        { error: "Publication not found" },
        { status: 404 }
      );
    }

    const input: CalendarSlotInsert = {
      publication_id: publication.id,
      day_of_week: body.day_of_week,
      is_fixed: body.is_fixed ?? false,
      fixed_format: body.fixed_format,
      preferred_tier: body.preferred_tier,
      skip_rules: body.skip_rules ?? [],
      is_active: body.is_active ?? true,
    };

    const slot = await createCalendarSlot(supabase, input);

    return NextResponse.json({
      success: true,
      slot,
    });
  } catch (error) {
    console.error("Create slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create slot" },
      { status: 500 }
    );
  }
}
