/**
 * Routing Calendar API
 *
 * GET /api/routing/calendar - Get calendar availability
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateAvailability } from "@/lib/routing";

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
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    // Default to current week if no dates provided
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setUTCDate(today.getUTCDate() - today.getUTCDay()); // Start of week (Sunday)
    
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setUTCDate(defaultStart.getUTCDate() + 27); // 4 weeks

    const start = startDate || defaultStart.toISOString().split("T")[0];
    const end = endDate || defaultEnd.toISOString().split("T")[0];

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const availability = await getDateAvailability(supabase, start, end);

    // Also get scheduled ideas for this period
    const { data: scheduledIdeas, error: scheduledError } = await supabase
      .from("idea_routing")
      .select(`
        id,
        calendar_date,
        routed_to,
        tier,
        is_staggered,
        stagger_youtube_date,
        stagger_substack_date,
        slack_ideas:slack_idea_id (
          title
        )
      `)
      .gte("calendar_date", start)
      .lte("calendar_date", end)
      .eq("status", "scheduled");

    if (scheduledError) {
      console.error("Error fetching scheduled ideas:", scheduledError);
    }

    return NextResponse.json({
      start_date: start,
      end_date: end,
      availability,
      scheduled_ideas: scheduledIdeas || [],
    });
  } catch (error) {
    console.error("Calendar error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get calendar" },
      { status: 500 }
    );
  }
}
