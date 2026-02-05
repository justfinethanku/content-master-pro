/**
 * Evergreen Queue API
 *
 * GET /api/routing/evergreen - Get evergreen queue
 * DELETE /api/routing/evergreen - Remove from queue
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEvergreenQueue,
  removeFromEvergreenQueue,
  getPublicationBySlug,
} from "@/lib/routing";

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
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let publicationId: string | undefined;
    if (publicationSlug) {
      const pub = await getPublicationBySlug(supabase, publicationSlug);
      publicationId = pub?.id;
    }

    const queue = await getEvergreenQueue(supabase, {
      publicationId,
      limit,
    });

    return NextResponse.json({
      queue,
      count: queue.length,
    });
  } catch (error) {
    console.error("Get evergreen queue error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get queue" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    await removeFromEvergreenQueue(supabase, body.id);

    return NextResponse.json({
      success: true,
      message: "Removed from evergreen queue",
    });
  } catch (error) {
    console.error("Remove from evergreen queue error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove from queue" },
      { status: 500 }
    );
  }
}
