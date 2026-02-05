/**
 * Single Idea Routing API
 *
 * GET /api/routing/ideas/[id] - Get idea routing details
 * PATCH /api/routing/ideas/[id] - Update idea routing
 * DELETE /api/routing/ideas/[id] - Kill/archive an idea routing
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getIdeaRoutingById,
  updateIdeaRouting,
  logStatusChange,
} from "@/lib/routing";
import type { IdeaRoutingUpdate } from "@/lib/routing";

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
    const routing = await getIdeaRoutingById(supabase, id);

    if (!routing) {
      return NextResponse.json(
        { error: "Idea routing not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(routing);
  } catch (error) {
    console.error("Get idea routing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get routing" },
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

    // Get current routing for status change logging
    const current = await getIdeaRoutingById(supabase, id);
    if (!current) {
      return NextResponse.json(
        { error: "Idea routing not found" },
        { status: 404 }
      );
    }

    const updates: IdeaRoutingUpdate = {};

    // Only include allowed updates
    if (body.routed_to !== undefined) updates.routed_to = body.routed_to;
    if (body.youtube_version !== undefined) updates.youtube_version = body.youtube_version;
    if (body.tier !== undefined) updates.tier = body.tier;
    if (body.calendar_date !== undefined) updates.calendar_date = body.calendar_date;
    if (body.slot_id !== undefined) updates.slot_id = body.slot_id;
    if (body.override_score !== undefined) updates.override_score = body.override_score;
    if (body.override_reason !== undefined) updates.override_reason = body.override_reason;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Handle status changes
    if (body.status !== undefined && body.status !== current.status) {
      updates.status = body.status;

      // Set timestamp based on status
      if (body.status === "routed" && !current.routed_at) {
        updates.routed_at = new Date().toISOString();
      } else if (body.status === "scored" && !current.scored_at) {
        updates.scored_at = new Date().toISOString();
      } else if (body.status === "slotted" && !current.slotted_at) {
        updates.slotted_at = new Date().toISOString();
      } else if (body.status === "scheduled" && !current.scheduled_at) {
        updates.scheduled_at = new Date().toISOString();
      } else if (body.status === "published" && !current.published_at) {
        updates.published_at = new Date().toISOString();
      } else if (body.status === "killed" && !current.killed_at) {
        updates.killed_at = new Date().toISOString();
      }
    }

    const updated = await updateIdeaRouting(supabase, id, updates);

    // Log status change if applicable
    if (body.status !== undefined && body.status !== current.status) {
      await logStatusChange(supabase, {
        idea_routing_id: id,
        from_status: current.status,
        to_status: body.status,
        changed_by: user.id,
        change_reason: body.change_reason,
        metadata: body.change_metadata,
      });
    }

    return NextResponse.json({
      success: true,
      routing: updated,
    });
  } catch (error) {
    console.error("Update idea routing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update routing" },
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
    const body = await request.json().catch(() => ({}));

    const current = await getIdeaRoutingById(supabase, id);
    if (!current) {
      return NextResponse.json(
        { error: "Idea routing not found" },
        { status: 404 }
      );
    }

    // Mark as killed instead of deleting
    const updated = await updateIdeaRouting(supabase, id, {
      status: "killed",
      killed_at: new Date().toISOString(),
      notes: body.reason || "Killed via API",
    });

    await logStatusChange(supabase, {
      idea_routing_id: id,
      from_status: current.status,
      to_status: "killed",
      changed_by: user.id,
      change_reason: body.reason || "Killed via API",
    });

    return NextResponse.json({
      success: true,
      routing: updated,
    });
  } catch (error) {
    console.error("Kill idea routing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to kill routing" },
      { status: 500 }
    );
  }
}
