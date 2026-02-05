/**
 * Routing Dashboard API
 *
 * GET /api/routing/dashboard - Get dashboard stats
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getBufferStatus,
  getEvergreenQueueCounts,
} from "@/lib/routing";
import type { RoutingDashboardStats, RoutingAlert, IdeaRoutingStatus, TierSlug } from "@/lib/routing";

// Status counts query
async function getStatusCounts(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const { data, error } = await supabase
    .from("idea_routing")
    .select("status");

  if (error) throw error;

  const counts: Record<IdeaRoutingStatus, number> = {
    intake: 0,
    routed: 0,
    scored: 0,
    slotted: 0,
    scheduled: 0,
    published: 0,
    killed: 0,
  };

  for (const row of data || []) {
    if (row.status && row.status in counts) {
      counts[row.status as IdeaRoutingStatus]++;
    }
  }

  return counts;
}

// Tier counts query
async function getTierCounts(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const { data, error } = await supabase
    .from("idea_routing")
    .select("tier")
    .neq("status", "killed");

  if (error) throw error;

  const counts: Record<TierSlug, number> = {
    premium_a: 0,
    a: 0,
    b: 0,
    c: 0,
    kill: 0,
  };

  for (const row of data || []) {
    if (row.tier && row.tier in counts) {
      counts[row.tier as TierSlug]++;
    }
  }

  return counts;
}

// Get scheduled count for this week
async function getScheduledThisWeek(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay());
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from("idea_routing")
    .select("*", { count: "exact", head: true })
    .eq("status", "scheduled")
    .gte("calendar_date", startOfWeek.toISOString().split("T")[0])
    .lte("calendar_date", endOfWeek.toISOString().split("T")[0]);

  if (error) throw error;
  return count || 0;
}

// Generate alerts based on buffer status and other factors
async function generateAlerts(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never
): Promise<RoutingAlert[]> {
  const alerts: RoutingAlert[] = [];
  const bufferStatus = await getBufferStatus(supabase);

  // Buffer alerts
  for (const status of bufferStatus) {
    if (status.status === "red") {
      alerts.push({
        type: "low_buffer",
        severity: "red",
        message: `${status.publication_name} has only ${status.weeks_of_buffer} weeks of buffer (${status.queue_count} ideas)`,
        publication_slug: status.publication_slug,
      });
    } else if (status.status === "yellow") {
      alerts.push({
        type: "low_buffer",
        severity: "yellow",
        message: `${status.publication_name} buffer is getting low: ${status.weeks_of_buffer} weeks (${status.queue_count} ideas)`,
        publication_slug: status.publication_slug,
      });
    }
  }

  // Check for time-sensitive ideas approaching deadline
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);

  const { data: timeSensitiveIdeas } = await supabase
    .from("idea_routing")
    .select("id, news_window")
    .eq("time_sensitivity", "news_hook")
    .not("news_window", "is", null)
    .lte("news_window", sevenDaysFromNow.toISOString().split("T")[0])
    .in("status", ["intake", "routed", "scored"]);

  for (const idea of timeSensitiveIdeas || []) {
    alerts.push({
      type: "time_sensitive",
      severity: "yellow",
      message: `Time-sensitive idea approaching news window: ${idea.news_window}`,
      idea_routing_id: idea.id,
    });
  }

  return alerts;
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
    const includeAlerts = searchParams.get("alerts") !== "false";

    const [statusCounts, tierCounts, evergreenCounts, scheduledThisWeek] = await Promise.all([
      getStatusCounts(supabase),
      getTierCounts(supabase),
      getEvergreenQueueCounts(supabase),
      getScheduledThisWeek(supabase),
    ]);

    const alerts = includeAlerts ? await generateAlerts(supabase) : [];

    const stats: RoutingDashboardStats = {
      ideas_by_status: statusCounts,
      ideas_by_tier: tierCounts,
      evergreen_queue_counts: evergreenCounts,
      scheduled_this_week: scheduledThisWeek,
      alerts,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get dashboard stats" },
      { status: 500 }
    );
  }
}
