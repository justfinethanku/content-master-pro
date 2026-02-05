/**
 * Database queries for the routing system
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Publication,
  PublicationInsert,
  PublicationUpdate,
  CalendarSlot,
  CalendarSlotInsert,
  CalendarSlotUpdate,
  ScoringRubric,
  ScoringRubricInsert,
  ScoringRubricUpdate,
  RoutingRule,
  RoutingRuleInsert,
  RoutingRuleUpdate,
  TierThreshold,
  TierThresholdUpdate,
  IdeaRouting,
  IdeaRoutingInsert,
  IdeaRoutingUpdate,
  ProjectRouting,
  ProjectRoutingInsert,
  ProjectRoutingUpdate,
  EvergreenQueueEntry,
  EvergreenQueueInsert,
  EvergreenQueueUpdate,
  RoutingStatusLogInsert,
} from "./types";

// ============================================================================
// Publications
// ============================================================================

export async function getPublications(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
) {
  let query = supabase
    .from("publications")
    .select("*")
    .order("sort_order", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Publication[];
}

export async function getPublicationBySlug(
  supabase: SupabaseClient,
  slug: string
) {
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data as Publication;
}

export async function createPublication(
  supabase: SupabaseClient,
  publication: PublicationInsert
) {
  const { data, error } = await supabase
    .from("publications")
    .insert(publication)
    .select()
    .single();

  if (error) throw error;
  return data as Publication;
}

export async function getPublicationById(
  supabase: SupabaseClient,
  id: string
) {
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Publication;
}

export async function updatePublication(
  supabase: SupabaseClient,
  id: string,
  updates: PublicationUpdate
) {
  const { data, error } = await supabase
    .from("publications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Publication;
}

export async function deletePublication(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("publications").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================================
// Calendar Slots
// ============================================================================

export async function getCalendarSlots(
  supabase: SupabaseClient,
  options?: { publicationId?: string; activeOnly?: boolean }
) {
  let query = supabase
    .from("calendar_slots")
    .select("*, publication:publications(*)")
    .order("day_of_week", { ascending: true });

  if (options?.publicationId) {
    query = query.eq("publication_id", options.publicationId);
  }
  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (CalendarSlot & { publication: Publication })[];
}

export async function getCalendarSlotsByPublication(
  supabase: SupabaseClient,
  publicationSlug: string
) {
  const { data, error } = await supabase
    .from("calendar_slots")
    .select("*, publication:publications!inner(*)")
    .eq("publication.slug", publicationSlug)
    .order("day_of_week", { ascending: true });

  if (error) throw error;
  return data as (CalendarSlot & { publication: Publication })[];
}

export async function getCalendarSlotById(
  supabase: SupabaseClient,
  id: string
) {
  const { data, error } = await supabase
    .from("calendar_slots")
    .select("*, publication:publications(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as CalendarSlot & { publication: Publication };
}

export async function createCalendarSlot(
  supabase: SupabaseClient,
  slot: CalendarSlotInsert
) {
  const { data, error } = await supabase
    .from("calendar_slots")
    .insert(slot)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarSlot;
}

export async function updateCalendarSlot(
  supabase: SupabaseClient,
  id: string,
  updates: CalendarSlotUpdate
) {
  const { data, error } = await supabase
    .from("calendar_slots")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarSlot;
}

export async function deleteCalendarSlot(
  supabase: SupabaseClient,
  id: string
) {
  const { error } = await supabase.from("calendar_slots").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================================
// Scoring Rubrics
// ============================================================================

export async function getScoringRubrics(
  supabase: SupabaseClient,
  options?: { publicationId?: string; activeOnly?: boolean }
) {
  let query = supabase
    .from("scoring_rubrics")
    .select("*, publication:publications(*)")
    .order("sort_order", { ascending: true });

  if (options?.publicationId) {
    query = query.eq("publication_id", options.publicationId);
  }
  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (ScoringRubric & { publication: Publication })[];
}

export async function getScoringRubricsByPublication(
  supabase: SupabaseClient,
  publicationSlug: string
) {
  const { data, error } = await supabase
    .from("scoring_rubrics")
    .select("*, publication:publications!inner(*)")
    .eq("publication.slug", publicationSlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as (ScoringRubric & { publication: Publication })[];
}

export async function createScoringRubric(
  supabase: SupabaseClient,
  rubric: ScoringRubricInsert
) {
  const { data, error } = await supabase
    .from("scoring_rubrics")
    .insert(rubric)
    .select()
    .single();

  if (error) throw error;
  return data as ScoringRubric;
}

export async function updateScoringRubric(
  supabase: SupabaseClient,
  id: string,
  updates: ScoringRubricUpdate
) {
  const { data, error } = await supabase
    .from("scoring_rubrics")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ScoringRubric;
}

export async function deleteScoringRubric(
  supabase: SupabaseClient,
  id: string
) {
  const { error } = await supabase
    .from("scoring_rubrics")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================================
// Routing Rules
// ============================================================================

export async function getRoutingRules(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
) {
  let query = supabase
    .from("routing_rules")
    .select("*")
    .order("priority", { ascending: false });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as RoutingRule[];
}

export async function createRoutingRule(
  supabase: SupabaseClient,
  rule: RoutingRuleInsert
) {
  const { data, error } = await supabase
    .from("routing_rules")
    .insert(rule)
    .select()
    .single();

  if (error) throw error;
  return data as RoutingRule;
}

export async function updateRoutingRule(
  supabase: SupabaseClient,
  id: string,
  updates: RoutingRuleUpdate
) {
  const { data, error } = await supabase
    .from("routing_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as RoutingRule;
}

export async function deleteRoutingRule(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("routing_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderRoutingRules(
  supabase: SupabaseClient,
  ruleIds: string[]
) {
  // Update priority based on array order (lower index = lower priority = evaluated first)
  // UI sorts ascending by priority, so first item in array should have lowest priority
  const updates = ruleIds.map((id, index) => ({
    id,
    priority: index * 10, // 0, 10, 20, etc.
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("routing_rules")
      .update({ priority: update.priority })
      .eq("id", update.id);
    if (error) throw error;
  }
}

// ============================================================================
// Tier Thresholds
// ============================================================================

export async function getTierThresholds(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
) {
  let query = supabase
    .from("tier_thresholds")
    .select("*")
    .order("sort_order", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as TierThreshold[];
}

export async function getTierByScore(supabase: SupabaseClient, score: number) {
  const { data, error } = await supabase
    .from("tier_thresholds")
    .select("*")
    .lte("min_score", score)
    .or(`max_score.gte.${score},max_score.is.null`)
    .eq("is_active", true)
    .order("min_score", { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  return data as TierThreshold;
}

export async function updateTierThreshold(
  supabase: SupabaseClient,
  id: string,
  updates: TierThresholdUpdate
) {
  const { data, error } = await supabase
    .from("tier_thresholds")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as TierThreshold;
}

// ============================================================================
// Idea Routing
// ============================================================================

export async function getIdeaRoutings(
  supabase: SupabaseClient,
  options?: {
    userId?: string;
    status?: string | string[];
    tier?: string;
    limit?: number;
  }
) {
  let query = supabase
    .from("idea_routing")
    .select("*, slack_idea:slack_ideas(*)")
    .order("created_at", { ascending: false });

  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }
  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in("status", options.status);
    } else {
      query = query.eq("status", options.status);
    }
  }
  if (options?.tier) {
    query = query.eq("tier", options.tier);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (IdeaRouting & { slack_idea: unknown })[];
}

export async function getIdeaRoutingById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("idea_routing")
    .select("*, slack_idea:slack_ideas(*), matched_rule:routing_rules(*), slot:calendar_slots(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as IdeaRouting & {
    slack_idea: unknown;
    matched_rule: RoutingRule | null;
    slot: CalendarSlot | null;
  };
}

export async function getIdeaRoutingsByStatus(
  supabase: SupabaseClient,
  options?: {
    status?: string;
    publicationSlug?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = supabase
    .from("idea_routing")
    .select("*, slack_idea:slack_ideas(*)")
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.publicationSlug) {
    query = query.eq("routed_to", options.publicationSlug);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit || 50) - 1
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (IdeaRouting & { slack_idea: unknown })[];
}

export async function getIdeaRoutingByIdeaId(
  supabase: SupabaseClient,
  ideaId: string
) {
  const { data, error } = await supabase
    .from("idea_routing")
    .select("*")
    .eq("idea_id", ideaId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return data as IdeaRouting | null;
}

export async function createIdeaRouting(
  supabase: SupabaseClient,
  routing: IdeaRoutingInsert
) {
  const { data, error } = await supabase
    .from("idea_routing")
    .insert(routing)
    .select()
    .single();

  if (error) throw error;
  return data as IdeaRouting;
}

export async function updateIdeaRouting(
  supabase: SupabaseClient,
  id: string,
  updates: IdeaRoutingUpdate
) {
  const { data, error } = await supabase
    .from("idea_routing")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as IdeaRouting;
}

export async function deleteIdeaRouting(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("idea_routing").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================================
// Project Routing
// ============================================================================

export async function getProjectRoutings(
  supabase: SupabaseClient,
  options?: { tier?: string; limit?: number }
) {
  let query = supabase
    .from("project_routing")
    .select("*, project:nate_content_projects(*)")
    .order("created_at", { ascending: false });

  if (options?.tier) {
    query = query.eq("tier", options.tier);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (ProjectRouting & { project: unknown })[];
}

export async function getProjectRoutingById(
  supabase: SupabaseClient,
  id: string
) {
  const { data, error } = await supabase
    .from("project_routing")
    .select("*, project:nate_content_projects(*), idea_routing:idea_routing(*), slot:calendar_slots(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ProjectRouting & {
    project: unknown;
    idea_routing: IdeaRouting | null;
    slot: CalendarSlot | null;
  };
}

export async function getProjectRoutingByProjectId(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data, error } = await supabase
    .from("project_routing")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as ProjectRouting | null;
}

export async function createProjectRouting(
  supabase: SupabaseClient,
  routing: ProjectRoutingInsert
) {
  const { data, error } = await supabase
    .from("project_routing")
    .insert(routing)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectRouting;
}

export async function updateProjectRouting(
  supabase: SupabaseClient,
  id: string,
  updates: ProjectRoutingUpdate
) {
  const { data, error } = await supabase
    .from("project_routing")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectRouting;
}

// ============================================================================
// Evergreen Queues
// ============================================================================

export async function getEvergreenQueue(
  supabase: SupabaseClient,
  options?: {
    publicationId?: string;
    publicationSlug?: string;
    includeStale?: boolean;
    limit?: number;
  }
) {
  let query = supabase
    .from("evergreen_queues")
    .select(`
      *,
      publication:publications(*),
      idea_routing:idea_routing(*, slack_idea:slack_ideas(*)),
      project_routing:project_routing(*, project:nate_content_projects(*))
    `)
    .is("pulled_at", null)
    .order("score", { ascending: false });

  if (options?.publicationId) {
    query = query.eq("publication_id", options.publicationId);
  }
  if (!options?.includeStale) {
    query = query.eq("is_stale", false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as EvergreenQueueEntry[];
}

export async function removeFromEvergreenQueue(
  supabase: SupabaseClient,
  id: string
) {
  const { error } = await supabase.from("evergreen_queues").delete().eq("id", id);
  if (error) throw error;
}

export async function getEvergreenQueueCounts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("evergreen_queues")
    .select("publication:publications(slug), id")
    .is("pulled_at", null)
    .eq("is_stale", false);

  if (error) throw error;

  // Group by publication slug
  const counts: Record<string, number> = {};
  for (const item of data || []) {
    // Supabase returns relations as arrays or single objects depending on the relationship
    const publication = item.publication as unknown;
    let slug: string | undefined;
    
    if (Array.isArray(publication) && publication.length > 0) {
      slug = (publication[0] as { slug?: string })?.slug;
    } else if (publication && typeof publication === "object") {
      slug = (publication as { slug?: string }).slug;
    }
    
    if (slug) {
      counts[slug] = (counts[slug] || 0) + 1;
    }
  }
  return counts;
}

export async function addToEvergreenQueue(
  supabase: SupabaseClient,
  entry: EvergreenQueueInsert
) {
  const { data, error } = await supabase
    .from("evergreen_queues")
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data as EvergreenQueueEntry;
}

export async function updateEvergreenQueueEntry(
  supabase: SupabaseClient,
  id: string,
  updates: EvergreenQueueUpdate
) {
  const { data, error } = await supabase
    .from("evergreen_queues")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as EvergreenQueueEntry;
}

export async function pullFromEvergreenQueue(
  supabase: SupabaseClient,
  publicationSlug: string,
  forDate: string
) {
  // Get the highest-scored non-stale entry
  const { data: entries, error: fetchError } = await supabase
    .from("evergreen_queues")
    .select("*, publication:publications!inner(*)")
    .eq("publication.slug", publicationSlug)
    .is("pulled_at", null)
    .eq("is_stale", false)
    .order("score", { ascending: false })
    .limit(1);

  if (fetchError) throw fetchError;
  if (!entries || entries.length === 0) return null;

  const entry = entries[0];

  // Mark as pulled
  const { data, error } = await supabase
    .from("evergreen_queues")
    .update({
      pulled_at: new Date().toISOString(),
      pulled_for_date: forDate,
      pulled_reason: "gap_fill",
    })
    .eq("id", entry.id)
    .select()
    .single();

  if (error) throw error;
  return data as EvergreenQueueEntry;
}

// ============================================================================
// Routing Status Log
// ============================================================================

export async function logStatusChange(
  supabase: SupabaseClient,
  log: RoutingStatusLogInsert
) {
  const { data, error } = await supabase
    .from("routing_status_log")
    .insert(log)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getStatusHistory(
  supabase: SupabaseClient,
  options: { ideaRoutingId?: string; projectRoutingId?: string }
) {
  let query = supabase
    .from("routing_status_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.ideaRoutingId) {
    query = query.eq("idea_routing_id", options.ideaRoutingId);
  }
  if (options.projectRoutingId) {
    query = query.eq("project_routing_id", options.projectRoutingId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================================
// App Settings (routing-specific)
// ============================================================================

export async function getRoutingSetting<T>(
  supabase: SupabaseClient,
  category: string,
  key: string
): Promise<T | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("category", category)
    .eq("key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data?.value as T;
}

export async function getRoutingSettings(
  supabase: SupabaseClient,
  category: string
) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, description")
    .eq("category", category);

  if (error) throw error;
  return data as { key: string; value: unknown; description: string }[];
}
