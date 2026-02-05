/**
 * Routing Ideas API
 *
 * POST /api/routing/ideas - Route a new idea
 * GET /api/routing/ideas - Get routed ideas (with filtering)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  routeIdea,
  getIdeaRoutingsByStatus,
  previewRouting,
} from "@/lib/routing";
import type { RouteIdeaInput, IdeaRoutingStatus } from "@/lib/routing";

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

    // Check if this is a preview request
    if (body.preview) {
      const input: RouteIdeaInput = {
        idea_id: body.idea_id,
        audience: body.audience,
        time_sensitivity: body.time_sensitivity,
        news_window: body.news_window,
        resource: body.resource,
        angle: body.angle,
        estimated_length: body.estimated_length,
        can_frame_as_complete_guide: body.can_frame_as_complete_guide,
        can_frame_as_zero_to_hero: body.can_frame_as_zero_to_hero,
        is_foundational: body.is_foundational,
        would_bore_paid_subs: body.would_bore_paid_subs,
        requires_tool_familiarity: body.requires_tool_familiarity,
        has_contrarian_angle: body.has_contrarian_angle,
        is_technical_implementation: body.is_technical_implementation,
        could_serve_both_audiences: body.could_serve_both_audiences,
      };

      const result = await previewRouting(supabase, input);

      return NextResponse.json({
        preview: true,
        result,
      });
    }

    // Validate required fields
    if (!body.idea_id) {
      return NextResponse.json(
        { error: "idea_id is required" },
        { status: 400 }
      );
    }

    const input: RouteIdeaInput = {
      idea_id: body.idea_id,
      audience: body.audience,
      action: body.action,
      time_sensitivity: body.time_sensitivity || "evergreen",
      news_window: body.news_window,
      resource: body.resource,
      angle: body.angle,
      estimated_length: body.estimated_length || "medium",
      can_frame_as_complete_guide: body.can_frame_as_complete_guide,
      can_frame_as_zero_to_hero: body.can_frame_as_zero_to_hero,
      is_foundational: body.is_foundational,
      would_bore_paid_subs: body.would_bore_paid_subs,
      requires_tool_familiarity: body.requires_tool_familiarity,
      has_contrarian_angle: body.has_contrarian_angle,
      is_technical_implementation: body.is_technical_implementation,
      could_serve_both_audiences: body.could_serve_both_audiences,
    };

    const { routing, result } = await routeIdea(supabase, user.id, input);

    return NextResponse.json({
      success: true,
      routing,
      result,
    });
  } catch (error) {
    console.error("Route idea error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to route idea" },
      { status: 500 }
    );
  }
}

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
    const status = searchParams.get("status") as IdeaRoutingStatus | null;
    const publicationSlug = searchParams.get("publication");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const ideas = await getIdeaRoutingsByStatus(supabase, {
      status: status || undefined,
      publicationSlug: publicationSlug || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      ideas,
      count: ideas.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get routed ideas error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get ideas" },
      { status: 500 }
    );
  }
}
