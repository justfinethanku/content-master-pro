/**
 * Scoring Rubrics Config API
 *
 * GET /api/routing/config/rubrics - List rubrics
 * POST /api/routing/config/rubrics - Create rubric
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getScoringRubrics,
  getScoringRubricsByPublication,
  createScoringRubric,
  getPublicationBySlug,
} from "@/lib/routing";
import type { ScoringRubricInsert } from "@/lib/routing";

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

    let rubrics;
    if (publicationSlug) {
      rubrics = await getScoringRubricsByPublication(supabase, publicationSlug);
    } else {
      rubrics = await getScoringRubrics(supabase);
    }

    return NextResponse.json({ rubrics });
  } catch (error) {
    console.error("Get rubrics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get rubrics" },
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
    if (!body.publication_slug || !body.name || !body.slug) {
      return NextResponse.json(
        { error: "publication_slug, name, and slug are required" },
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

    const input: ScoringRubricInsert = {
      publication_id: publication.id,
      slug: body.slug,
      name: body.name,
      description: body.description,
      weight: body.weight ?? 1.0,
      criteria: body.criteria || [],
      is_modifier: body.is_modifier ?? false,
      baseline_score: body.baseline_score,
      modifiers: body.modifiers,
      is_active: body.is_active ?? true,
    };

    const rubric = await createScoringRubric(supabase, input);

    return NextResponse.json({
      success: true,
      rubric,
    });
  } catch (error) {
    console.error("Create rubric error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create rubric" },
      { status: 500 }
    );
  }
}
