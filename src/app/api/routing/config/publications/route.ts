/**
 * Publications Config API
 *
 * GET /api/routing/config/publications - List publications
 * POST /api/routing/config/publications - Create publication
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPublications,
  createPublication,
} from "@/lib/routing";
import type { PublicationInsert } from "@/lib/routing";

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
    const activeOnly = searchParams.get("active") === "true";

    const publications = await getPublications(supabase, { activeOnly });

    return NextResponse.json({ publications });
  } catch (error) {
    console.error("Get publications error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get publications" },
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
    if (!body.slug || !body.name || !body.publication_type) {
      return NextResponse.json(
        { error: "slug, name, and publication_type are required" },
        { status: 400 }
      );
    }

    const input: PublicationInsert = {
      slug: body.slug,
      name: body.name,
      description: body.description,
      publication_type: body.publication_type,
      destination_id: body.destination_id,
      weekly_target: body.weekly_target ?? 7,
      unified_with: body.unified_with,
      is_active: body.is_active ?? true,
    };

    const publication = await createPublication(supabase, input);

    return NextResponse.json({
      success: true,
      publication,
    });
  } catch (error) {
    console.error("Create publication error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create publication" },
      { status: 500 }
    );
  }
}
