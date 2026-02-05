/**
 * Routing logic - evaluates rules and determines where ideas should be routed
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  RoutingRule,
  RoutingCondition,
  RoutingDestination,
  YouTubeVersion,
  IdeaRouting,
  IdeaRoutingUpdate,
  RoutingContext,
  RoutingResult,
  RouteIdeaInput,
} from "./types";
import {
  getRoutingRules,
  getIdeaRoutingByIdeaId,
  createIdeaRouting,
  updateIdeaRouting,
  logStatusChange,
} from "./queries";

/**
 * Evaluate a single condition against the context
 */
function evaluateCondition(
  condition: RoutingCondition,
  context: RoutingContext
): boolean {
  // Handle "always" condition (default/catch-all rule)
  if (condition.always === true) {
    return true;
  }

  // Handle AND conditions
  if (condition.and && Array.isArray(condition.and)) {
    return condition.and.every((c) => evaluateCondition(c, context));
  }

  // Handle OR conditions
  if (condition.or && Array.isArray(condition.or)) {
    return condition.or.some((c) => evaluateCondition(c, context));
  }

  // Handle simple field comparison
  if (condition.field && condition.op !== undefined) {
    const fieldValue = context[condition.field];
    const compareValue = condition.value;

    switch (condition.op) {
      case "=":
        return fieldValue === compareValue;
      case "!=":
        return fieldValue !== compareValue;
      case ">":
        return (
          typeof fieldValue === "number" &&
          typeof compareValue === "number" &&
          fieldValue > compareValue
        );
      case "<":
        return (
          typeof fieldValue === "number" &&
          typeof compareValue === "number" &&
          fieldValue < compareValue
        );
      case ">=":
        return (
          typeof fieldValue === "number" &&
          typeof compareValue === "number" &&
          fieldValue >= compareValue
        );
      case "<=":
        return (
          typeof fieldValue === "number" &&
          typeof compareValue === "number" &&
          fieldValue <= compareValue
        );
      default:
        return false;
    }
  }

  return false;
}

/**
 * Find the first matching routing rule for the given context
 */
export function findMatchingRule(
  rules: RoutingRule[],
  context: RoutingContext
): RoutingRule | null {
  // Rules should already be sorted by priority (highest first)
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (evaluateCondition(rule.conditions, context)) {
      return rule;
    }
  }
  return null;
}

/**
 * Convert RouteIdeaInput to RoutingContext for rule evaluation
 */
function inputToContext(input: RouteIdeaInput): RoutingContext {
  return {
    audience: input.audience,
    action: input.action,
    time_sensitivity: input.time_sensitivity,
    resource: input.resource,
    angle: input.angle,
    estimated_length: input.estimated_length,
    can_frame_as_complete_guide: input.can_frame_as_complete_guide ?? false,
    can_frame_as_zero_to_hero: input.can_frame_as_zero_to_hero ?? false,
    is_foundational: input.is_foundational ?? false,
    would_bore_paid_subs: input.would_bore_paid_subs ?? false,
    requires_tool_familiarity: input.requires_tool_familiarity ?? false,
    has_contrarian_angle: input.has_contrarian_angle ?? false,
    is_technical_implementation: input.is_technical_implementation ?? false,
    could_serve_both_audiences: input.could_serve_both_audiences ?? false,
  };
}

/**
 * Route an idea - main entry point
 * Creates or updates the idea_routing record with routing decisions
 */
export async function routeIdea(
  supabase: SupabaseClient,
  userId: string,
  input: RouteIdeaInput
): Promise<{
  routing: IdeaRouting;
  result: RoutingResult;
}> {
  // Get all active routing rules
  const rules = await getRoutingRules(supabase, { activeOnly: true });

  // Build context from input
  const context = inputToContext(input);

  // Find matching rule
  const matchedRule = findMatchingRule(rules, context);

  if (!matchedRule) {
    throw new Error("No matching routing rule found (not even default)");
  }

  const result: RoutingResult = {
    routed_to: matchedRule.routes_to as RoutingDestination,
    youtube_version: matchedRule.youtube_version as YouTubeVersion,
    matched_rule: matchedRule,
  };

  // Check if routing already exists for this idea
  const existing = await getIdeaRoutingByIdeaId(supabase, input.idea_id);

  const routingData: IdeaRoutingUpdate = {
    audience: input.audience,
    action: input.action,
    time_sensitivity: input.time_sensitivity,
    news_window: input.news_window,
    resource: input.resource,
    angle: input.angle,
    estimated_length: input.estimated_length,
    can_frame_as_complete_guide: input.can_frame_as_complete_guide,
    can_frame_as_zero_to_hero: input.can_frame_as_zero_to_hero,
    is_foundational: input.is_foundational,
    would_bore_paid_subs: input.would_bore_paid_subs,
    requires_tool_familiarity: input.requires_tool_familiarity,
    has_contrarian_angle: input.has_contrarian_angle,
    is_technical_implementation: input.is_technical_implementation,
    could_serve_both_audiences: input.could_serve_both_audiences,
    routed_to: result.routed_to,
    youtube_version: result.youtube_version,
    matched_rule_id: matchedRule.id,
    status: "routed",
    routed_at: new Date().toISOString(),
  };

  let routing: IdeaRouting;

  if (existing) {
    // Update existing
    routing = await updateIdeaRouting(supabase, existing.id, routingData);

    // Log status change if status changed
    if (existing.status !== "routed") {
      await logStatusChange(supabase, {
        idea_routing_id: existing.id,
        from_status: existing.status,
        to_status: "routed",
        changed_by: userId,
        metadata: {
          matched_rule_name: matchedRule.name,
          routed_to: result.routed_to,
        },
      });
    }
  } else {
    // Create new - filter out null values for insert
    const created = await createIdeaRouting(supabase, {
      idea_id: input.idea_id,
      user_id: userId,
      audience: input.audience,
      action: input.action,
      time_sensitivity: input.time_sensitivity,
      news_window: input.news_window,
      resource: input.resource,
      angle: input.angle,
      estimated_length: input.estimated_length,
      can_frame_as_complete_guide: input.can_frame_as_complete_guide,
      can_frame_as_zero_to_hero: input.can_frame_as_zero_to_hero,
      is_foundational: input.is_foundational,
      would_bore_paid_subs: input.would_bore_paid_subs,
      requires_tool_familiarity: input.requires_tool_familiarity,
      has_contrarian_angle: input.has_contrarian_angle,
      is_technical_implementation: input.is_technical_implementation,
      could_serve_both_audiences: input.could_serve_both_audiences,
      status: "routed",
    });

    // Update with routing result fields
    routing = await updateIdeaRouting(supabase, created.id, {
      routed_to: result.routed_to,
      youtube_version: result.youtube_version,
      matched_rule_id: matchedRule.id,
      routed_at: new Date().toISOString(),
    });

    // Log initial status
    await logStatusChange(supabase, {
      idea_routing_id: routing.id,
      from_status: undefined,
      to_status: "routed",
      changed_by: userId,
      metadata: {
        matched_rule_name: matchedRule.name,
        routed_to: result.routed_to,
      },
    });
  }

  return { routing, result };
}

/**
 * Re-route an idea with potentially updated input
 */
export async function rerouteIdea(
  supabase: SupabaseClient,
  userId: string,
  ideaRoutingId: string,
  input: Partial<RouteIdeaInput>
): Promise<{
  routing: IdeaRouting;
  result: RoutingResult;
}> {
  // Get existing routing
  const { data: existing, error } = await supabase
    .from("idea_routing")
    .select("*")
    .eq("id", ideaRoutingId)
    .single();

  if (error) throw error;
  if (!existing) {
    throw new Error(`Idea routing not found: ${ideaRoutingId}`);
  }

  // Merge existing data with new input
  const mergedInput: RouteIdeaInput = {
    idea_id: existing.idea_id,
    audience: input.audience ?? existing.audience,
    action: input.action ?? existing.action,
    time_sensitivity: input.time_sensitivity ?? existing.time_sensitivity,
    news_window: input.news_window ?? existing.news_window,
    resource: input.resource ?? existing.resource,
    angle: input.angle ?? existing.angle,
    estimated_length: input.estimated_length ?? existing.estimated_length,
    can_frame_as_complete_guide:
      input.can_frame_as_complete_guide ?? existing.can_frame_as_complete_guide,
    can_frame_as_zero_to_hero:
      input.can_frame_as_zero_to_hero ?? existing.can_frame_as_zero_to_hero,
    is_foundational: input.is_foundational ?? existing.is_foundational,
    would_bore_paid_subs:
      input.would_bore_paid_subs ?? existing.would_bore_paid_subs,
    requires_tool_familiarity:
      input.requires_tool_familiarity ?? existing.requires_tool_familiarity,
    has_contrarian_angle:
      input.has_contrarian_angle ?? existing.has_contrarian_angle,
    is_technical_implementation:
      input.is_technical_implementation ?? existing.is_technical_implementation,
    could_serve_both_audiences:
      input.could_serve_both_audiences ?? existing.could_serve_both_audiences,
  };

  return routeIdea(supabase, userId, mergedInput);
}

/**
 * Get routing preview without saving
 * Useful for showing what would happen if routed with current input
 */
export async function previewRouting(
  supabase: SupabaseClient,
  input: RouteIdeaInput
): Promise<RoutingResult | null> {
  const rules = await getRoutingRules(supabase, { activeOnly: true });
  const context = inputToContext(input);
  const matchedRule = findMatchingRule(rules, context);

  if (!matchedRule) return null;

  return {
    routed_to: matchedRule.routes_to as RoutingDestination,
    youtube_version: matchedRule.youtube_version as YouTubeVersion,
    matched_rule: matchedRule,
  };
}
