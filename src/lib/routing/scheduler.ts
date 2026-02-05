/**
 * Scheduling logic - handles slot assignment, calendar placement, and bumping
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  CalendarSlot,
  SkipRule,
  DateAvailability,
  BufferStatus,
  ScheduleIdeaInput,
  IdeaRouting,
} from "./types";
import {
  getCalendarSlots,
  getPublications,
  getTierThresholds,
  getIdeaRoutingById,
  updateIdeaRouting,
  getEvergreenQueueCounts,
  addToEvergreenQueue,
  logStatusChange,
  getRoutingSetting,
} from "./queries";

/**
 * Parse a date string in YYYY-MM-DD format
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(dateStr: string): number {
  return parseDate(dateStr).getUTCDay();
}

/**
 * Check if a date matches a skip rule
 */
function matchesSkipRule(dateStr: string, rule: SkipRule): boolean {
  const mmdd = dateStr.slice(5); // Extract MM-DD from YYYY-MM-DD

  if (rule.type === "specific_date") {
    return rule.date === mmdd;
  }

  if (rule.type === "date_range" && rule.start && rule.end) {
    // Handle ranges that might wrap around year end
    if (rule.start <= rule.end) {
      return mmdd >= rule.start && mmdd <= rule.end;
    } else {
      // e.g., 12-15 to 01-05
      return mmdd >= rule.start || mmdd <= rule.end;
    }
  }

  return false;
}

/**
 * Check if a slot is available on a specific date
 */
function isSlotAvailable(
  slot: CalendarSlot,
  dateStr: string
): { available: boolean; reason?: string } {
  // Check day of week
  const dayOfWeek = getDayOfWeek(dateStr);
  if (slot.day_of_week !== dayOfWeek) {
    return { available: false, reason: "Wrong day of week" };
  }

  // Check if slot is active
  if (!slot.is_active) {
    return { available: false, reason: "Slot is inactive" };
  }

  // Check skip rules
  for (const rule of slot.skip_rules || []) {
    if (matchesSkipRule(dateStr, rule)) {
      return { available: false, reason: rule.reason || "Skipped by rule" };
    }
  }

  return { available: true };
}

/**
 * Get availability for a date range
 */
export async function getDateAvailability(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<DateAvailability[]> {
  const slots = await getCalendarSlots(supabase, { activeOnly: true });
  const publications = await getPublications(supabase, { activeOnly: true });
  const result: DateAvailability[] = [];

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = formatDate(d);
    const dayOfWeek = d.getUTCDay();

    const availability: DateAvailability = {
      date: dateStr,
      day_of_week: dayOfWeek,
      slots: [],
    };

    for (const pub of publications) {
      // Find slot for this publication and day
      const slot = slots.find(
        (s) => s.publication_id === pub.id && s.day_of_week === dayOfWeek
      );

      if (!slot) {
        availability.slots.push({
          publication_slug: pub.slug,
          is_available: false,
          is_fixed: false,
          reason: "No slot configured",
        });
        continue;
      }

      const { available, reason } = isSlotAvailable(slot, dateStr);
      availability.slots.push({
        publication_slug: pub.slug,
        is_available: available,
        is_fixed: slot.is_fixed,
        fixed_format: slot.fixed_format || undefined,
        preferred_tier: slot.preferred_tier || undefined,
        reason: available ? undefined : reason,
      });
    }

    result.push(availability);
  }

  return result;
}

/**
 * Find next available slot for a publication
 */
export async function findNextAvailableSlot(
  supabase: SupabaseClient,
  publicationSlug: string,
  startDate: string,
  options?: {
    preferredDays?: number[];
    excludeFixed?: boolean;
    maxDaysAhead?: number;
  }
): Promise<{ date: string; slot: CalendarSlot } | null> {
  const publications = await getPublications(supabase, { activeOnly: true });
  const pub = publications.find((p) => p.slug === publicationSlug);
  if (!pub) return null;

  const slots = await getCalendarSlots(supabase, {
    publicationId: pub.id,
    activeOnly: true,
  });

  const maxDays = options?.maxDaysAhead || 90;
  const start = parseDate(startDate);

  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = formatDate(d);
    const dayOfWeek = d.getUTCDay();

    // Check preferred days if specified
    if (options?.preferredDays?.length && !options.preferredDays.includes(dayOfWeek)) {
      continue;
    }

    // Find slot for this day
    const slot = slots.find((s) => s.day_of_week === dayOfWeek);
    if (!slot) continue;

    // Skip fixed slots if requested
    if (options?.excludeFixed && slot.is_fixed) continue;

    const { available } = isSlotAvailable(slot, dateStr);
    if (available) {
      // TODO: Also check if date is already taken by another project
      return { date: dateStr, slot };
    }
  }

  return null;
}

/**
 * Schedule an idea to a specific date
 */
export async function scheduleIdea(
  supabase: SupabaseClient,
  userId: string,
  input: ScheduleIdeaInput
): Promise<IdeaRouting> {
  const routing = await getIdeaRoutingById(supabase, input.idea_routing_id);

  if (!routing) {
    throw new Error(`Idea routing not found: ${input.idea_routing_id}`);
  }

  // Get tier info for stagger logic
  const tiers = await getTierThresholds(supabase, { activeOnly: true });
  const tierThreshold = tiers.find((t) => t.tier === routing.tier);

  // Calculate stagger dates if applicable
  let staggerYoutubeDate: string | undefined;
  let staggerSubstackDate: string | undefined;
  let isStaggered = false;

  if (
    tierThreshold?.auto_stagger &&
    routing.routed_to === "core" &&
    routing.youtube_version === "yes"
  ) {
    // Get stagger config from settings
    const staggerConfig = await getRoutingSetting<{
      enabled: boolean;
      youtube_first: boolean;
      gap_days: number;
    }>(supabase, "routing", "premium_stagger");

    if (staggerConfig?.enabled) {
      isStaggered = true;
      const baseDate = parseDate(input.calendar_date);

      if (staggerConfig.youtube_first) {
        staggerYoutubeDate = input.calendar_date;
        const substackDate = new Date(baseDate);
        substackDate.setUTCDate(substackDate.getUTCDate() + staggerConfig.gap_days);
        staggerSubstackDate = formatDate(substackDate);
      } else {
        staggerSubstackDate = input.calendar_date;
        const youtubeDate = new Date(baseDate);
        youtubeDate.setUTCDate(youtubeDate.getUTCDate() + staggerConfig.gap_days);
        staggerYoutubeDate = formatDate(youtubeDate);
      }
    }
  }

  const previousStatus = routing.status;

  const updated = await updateIdeaRouting(supabase, input.idea_routing_id, {
    calendar_date: input.calendar_date,
    slot_id: input.slot_id,
    status: "scheduled",
    is_staggered: isStaggered,
    stagger_youtube_date: staggerYoutubeDate,
    stagger_substack_date: staggerSubstackDate,
    scheduled_at: new Date().toISOString(),
  });

  await logStatusChange(supabase, {
    idea_routing_id: input.idea_routing_id,
    from_status: previousStatus,
    to_status: "scheduled",
    changed_by: userId,
    metadata: {
      calendar_date: input.calendar_date,
      is_staggered: isStaggered,
      stagger_youtube_date: staggerYoutubeDate,
      stagger_substack_date: staggerSubstackDate,
    },
  });

  return updated;
}

/**
 * Add an idea to the evergreen queue
 */
export async function addToEvergreen(
  supabase: SupabaseClient,
  userId: string,
  ideaRoutingId: string,
  publicationSlug: string
): Promise<void> {
  const routing = await getIdeaRoutingById(supabase, ideaRoutingId);

  if (!routing) {
    throw new Error(`Idea routing not found: ${ideaRoutingId}`);
  }

  if (!routing.tier || routing.tier === "kill") {
    throw new Error("Cannot add killed ideas to evergreen queue");
  }

  const publications = await getPublications(supabase, { activeOnly: true });
  const pub = publications.find((p) => p.slug === publicationSlug);

  if (!pub) {
    throw new Error(`Publication not found: ${publicationSlug}`);
  }

  // Get the score for this publication
  const score = routing.scores?.[publicationSlug] ||
    routing.override_score ||
    5.0; // Default if no score

  await addToEvergreenQueue(supabase, {
    publication_id: pub.id,
    idea_routing_id: ideaRoutingId,
    score,
    tier: routing.tier,
  });

  // Update status if not already scheduled
  if (routing.status === "scored" || routing.status === "slotted") {
    await updateIdeaRouting(supabase, ideaRoutingId, {
      status: "slotted",
      slotted_at: new Date().toISOString(),
    });

    await logStatusChange(supabase, {
      idea_routing_id: ideaRoutingId,
      from_status: routing.status,
      to_status: "slotted",
      changed_by: userId,
      metadata: {
        added_to_evergreen: publicationSlug,
        score,
      },
    });
  }
}

/**
 * Get buffer status for all publications
 */
export async function getBufferStatus(
  supabase: SupabaseClient
): Promise<BufferStatus[]> {
  const publications = await getPublications(supabase, { activeOnly: true });
  const queueCounts = await getEvergreenQueueCounts(supabase);

  // Get buffer alert thresholds from settings
  const alertConfig = await getRoutingSetting<{
    red_weeks: number;
    yellow_weeks: number;
  }>(supabase, "routing", "buffer_alerts");

  const redWeeks = alertConfig?.red_weeks || 2;
  const yellowWeeks = alertConfig?.yellow_weeks || 4;

  return publications.map((pub) => {
    const count = queueCounts[pub.slug] || 0;
    const weeklyTarget = pub.weekly_target || 7;
    const weeksOfBuffer = weeklyTarget > 0 ? count / weeklyTarget : 0;

    let status: "green" | "yellow" | "red" = "green";
    if (weeksOfBuffer < redWeeks) {
      status = "red";
    } else if (weeksOfBuffer < yellowWeeks) {
      status = "yellow";
    }

    return {
      publication_slug: pub.slug,
      publication_name: pub.name,
      queue_count: count,
      weekly_target: weeklyTarget,
      weeks_of_buffer: Math.round(weeksOfBuffer * 10) / 10,
      status,
    };
  });
}

/**
 * Get recommended slot based on tier and time sensitivity
 */
export async function getRecommendedSlot(
  supabase: SupabaseClient,
  ideaRoutingId: string
): Promise<{
  recommended_date: string;
  slot: CalendarSlot;
  reason: string;
} | null> {
  const routing = await getIdeaRoutingById(supabase, ideaRoutingId);

  if (!routing) return null;

  // Get tier info
  const tiers = await getTierThresholds(supabase, { activeOnly: true });
  const tierThreshold = tiers.find((t) => t.tier === routing.tier);

  // Determine target publication
  const targetPub =
    routing.routed_to === "beginner" ? "beginner_substack" : "core_substack";

  // Check time sensitivity
  if (routing.time_sensitivity === "news_hook" && routing.news_window) {
    // Schedule close to news window
    const newsDate = parseDate(routing.news_window);
    const startSearch = new Date(newsDate);
    startSearch.setUTCDate(startSearch.getUTCDate() - 3); // Start 3 days before news window

    const result = await findNextAvailableSlot(
      supabase,
      targetPub,
      formatDate(startSearch),
      { excludeFixed: true, maxDaysAhead: 14 }
    );

    if (result) {
      return {
        recommended_date: result.date,
        slot: result.slot,
        reason: `News-tied content - scheduled near news window (${routing.news_window})`,
      };
    }
  }

  // Use tier preferred days
  const preferredDays = tierThreshold?.preferred_days || [];

  // Start from today or tomorrow
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const startDate = formatDate(tomorrow);

  const result = await findNextAvailableSlot(supabase, targetPub, startDate, {
    preferredDays: preferredDays.length > 0 ? preferredDays : undefined,
    excludeFixed: !routing.tier?.includes("premium"),
  });

  if (result) {
    return {
      recommended_date: result.date,
      slot: result.slot,
      reason: tierThreshold
        ? `${tierThreshold.display_name} tier content`
        : "Standard scheduling",
    };
  }

  return null;
}
