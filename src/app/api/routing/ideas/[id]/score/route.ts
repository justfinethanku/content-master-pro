/**
 * Score Idea API
 *
 * POST /api/routing/ideas/[id]/score - Score an idea
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  scoreIdea,
  previewScore,
  getScoringGuidance,
  overrideScore,
} from "@/lib/routing";
import type { ScoreIdeaInput } from "@/lib/routing";

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

    // Handle override request
    if (body.override) {
      if (typeof body.override_score !== "number") {
        return NextResponse.json(
          { error: "override_score is required for override" },
          { status: 400 }
        );
      }

      const routing = await overrideScore(
        supabase,
        user.id,
        id,
        body.override_score,
        body.override_reason || "Manual override"
      );

      return NextResponse.json({
        success: true,
        routing,
        override: true,
      });
    }

    // Handle preview request
    if (body.preview && body.publication_slug && body.rubric_scores) {
      const breakdown = await previewScore(
        supabase,
        body.publication_slug,
        body.rubric_scores
      );

      return NextResponse.json({
        preview: true,
        breakdown,
      });
    }

    // Handle guidance request
    if (body.guidance && body.publication_slug) {
      const guidance = await getScoringGuidance(supabase, body.publication_slug);

      return NextResponse.json({
        guidance: true,
        ...guidance,
      });
    }

    // Validate required fields for scoring
    if (!body.rubric_scores || typeof body.rubric_scores !== "object") {
      return NextResponse.json(
        { error: "rubric_scores object is required" },
        { status: 400 }
      );
    }

    const input: ScoreIdeaInput = {
      idea_routing_id: id,
      rubric_scores: body.rubric_scores,
    };

    const { routing, breakdowns, primaryTier } = await scoreIdea(
      supabase,
      user.id,
      input
    );

    return NextResponse.json({
      success: true,
      routing,
      breakdowns,
      tier: primaryTier,
    });
  } catch (error) {
    console.error("Score idea error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score idea" },
      { status: 500 }
    );
  }
}

// Get scoring guidance for all publications
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

    // Get the publication from query params
    const searchParams = request.nextUrl.searchParams;
    const publicationSlug = searchParams.get("publication");

    if (!publicationSlug) {
      return NextResponse.json(
        { error: "publication query parameter is required" },
        { status: 400 }
      );
    }

    const guidance = await getScoringGuidance(supabase, publicationSlug);

    return NextResponse.json(guidance);
  } catch (error) {
    console.error("Get scoring guidance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get guidance" },
      { status: 500 }
    );
  }
}
