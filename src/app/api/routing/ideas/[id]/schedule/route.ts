/**
 * Schedule Idea API
 *
 * POST /api/routing/ideas/[id]/schedule - Schedule an idea to a date
 * GET /api/routing/ideas/[id]/schedule - Get recommended slot
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  scheduleIdea,
  getRecommendedSlot,
  addToEvergreen,
} from "@/lib/routing";
import type { ScheduleIdeaInput } from "@/lib/routing";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Handle evergreen queue request
    if (body.add_to_evergreen) {
      if (!body.publication_slug) {
        return NextResponse.json(
          { error: "publication_slug is required for evergreen queue" },
          { status: 400 }
        );
      }

      await addToEvergreen(supabase, user.id, id, body.publication_slug);

      return NextResponse.json({
        success: true,
        added_to_evergreen: body.publication_slug,
      });
    }

    // Validate required fields for scheduling
    if (!body.calendar_date) {
      return NextResponse.json(
        { error: "calendar_date is required (YYYY-MM-DD format)" },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.calendar_date)) {
      return NextResponse.json(
        { error: "calendar_date must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const input: ScheduleIdeaInput = {
      idea_routing_id: id,
      calendar_date: body.calendar_date,
      slot_id: body.slot_id,
    };

    const routing = await scheduleIdea(supabase, user.id, input);

    return NextResponse.json({
      success: true,
      routing,
    });
  } catch (error) {
    console.error("Schedule idea error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to schedule idea" },
      { status: 500 }
    );
  }
}

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
    const recommendation = await getRecommendedSlot(supabase, id);

    if (!recommendation) {
      return NextResponse.json({
        has_recommendation: false,
        message: "No available slots found",
      });
    }

    return NextResponse.json({
      has_recommendation: true,
      ...recommendation,
    });
  } catch (error) {
    console.error("Get recommended slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get recommendation" },
      { status: 500 }
    );
  }
}
