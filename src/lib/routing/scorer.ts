/**
 * Scoring logic - calculates scores for ideas based on rubrics
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  ScoringRubric,
  IdeaRouting,
  IdeaRoutingScores,
  TierSlug,
  ScoreBreakdown,
  TierResult,
  ScoreIdeaInput,
} from "./types";
import {
  getScoringRubricsByPublication,
  getTierThresholds,
  getIdeaRoutingById,
  updateIdeaRouting,
  logStatusChange,
} from "./queries";

/**
 * Calculate the weighted score for a single publication
 */
export function calculatePublicationScore(
  rubricScores: { [rubricSlug: string]: number },
  rubrics: ScoringRubric[]
): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    publication_slug: "", // Set by caller
    total_score: 0,
    rubric_scores: [],
    tier: "kill",
  };

  if (rubrics.length === 0) {
    return breakdown;
  }

  let totalWeight = 0;

  for (const rubric of rubrics) {
    if (!rubric.is_active) continue;

    const rawScore = rubricScores[rubric.slug];
    if (rawScore === undefined) continue;

    // Clamp score to 1-10 range
    const clampedScore = Math.max(1, Math.min(10, rawScore));
    const weightedScore = clampedScore * rubric.weight;

    breakdown.rubric_scores.push({
      rubric_slug: rubric.slug,
      rubric_name: rubric.name,
      raw_score: clampedScore,
      weight: rubric.weight,
      weighted_score: weightedScore,
    });

    breakdown.total_score += weightedScore;
    totalWeight += rubric.weight;
  }

  // Normalize if weights don't sum to 1
  if (totalWeight === 0) {
    breakdown.total_score = 0;
  } else if (totalWeight !== 1) {
    breakdown.total_score = breakdown.total_score / totalWeight;
  }

  // Round to 1 decimal place
  breakdown.total_score = Math.round(breakdown.total_score * 10) / 10;

  return breakdown;
}

/**
 * Determine tier from score
 */
export async function determineTier(
  supabase: SupabaseClient,
  score: number
): Promise<TierResult> {
  const thresholds = await getTierThresholds(supabase, { activeOnly: true });

  // Sort by min_score descending to find the highest matching tier
  const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);

  for (const threshold of sorted) {
    if (score >= threshold.min_score) {
      // Check max_score if it exists
      const maxScore = threshold.max_score ?? Infinity;
      if (score <= maxScore) {
        return {
          tier: threshold.tier as TierSlug,
          threshold: {
            display_name: threshold.display_name,
            auto_stagger: threshold.auto_stagger,
            preferred_days: threshold.preferred_days,
            actions: threshold.actions as Record<string, unknown>,
          },
        };
      }
    }
  }

  // Fallback to kill tier
  return {
    tier: "kill",
    threshold: {
      display_name: "🔴 KILL",
      auto_stagger: false,
      preferred_days: [],
      actions: { do_not_produce: true },
    },
  };
}

/**
 * Score an idea across all relevant publications
 */
export async function scoreIdea(
  supabase: SupabaseClient,
  userId: string,
  input: ScoreIdeaInput
): Promise<{
  routing: IdeaRouting;
  breakdowns: Record<string, ScoreBreakdown>;
  primaryTier: TierResult;
}> {
  // Get the idea routing
  const routing = await getIdeaRoutingById(supabase, input.idea_routing_id);

  if (!routing) {
    throw new Error(`Idea routing not found: ${input.idea_routing_id}`);
  }

  if (!routing.routed_to) {
    throw new Error(`Cannot score idea: routing destination not set. Route the idea first.`);
  }

  // Determine which publications to score based on routing
  const publicationsToScore: string[] = [];

  if (routing.routed_to === "core" || routing.routed_to === "both") {
    publicationsToScore.push("core_substack");
    if (routing.youtube_version === "yes") {
      publicationsToScore.push("youtube");
    }
  }

  if (routing.routed_to === "beginner" || routing.routed_to === "both") {
    publicationsToScore.push("beginner_substack");
  }

  // Calculate scores for each publication
  const scores: IdeaRoutingScores = {};
  const breakdowns: Record<string, ScoreBreakdown> = {};

  for (const pubSlug of publicationsToScore) {
    const rubrics = await getScoringRubricsByPublication(supabase, pubSlug);

    if (rubrics.length === 0) continue;

    const breakdown = calculatePublicationScore(input.rubric_scores, rubrics);
    breakdown.publication_slug = pubSlug;

    scores[pubSlug] = breakdown.total_score;
    breakdowns[pubSlug] = breakdown;
  }

  // Determine primary score (for tier assignment)
  // Priority: core_substack > youtube > beginner_substack
  let primaryScore = 0;
  let primaryPub = "";

  const coreScore = scores["core_substack"];
  const youtubeScore = scores["youtube"];
  const beginnerScore = scores["beginner_substack"];

  if (coreScore != null) {
    primaryScore = coreScore;
    primaryPub = "core_substack";
  } else if (youtubeScore != null) {
    primaryScore = youtubeScore;
    primaryPub = "youtube";
  } else if (beginnerScore != null) {
    primaryScore = beginnerScore;
    primaryPub = "beginner_substack";
  }

  // Determine tier
  const tierResult = await determineTier(supabase, primaryScore);

  // Update breakdowns with tier
  for (const breakdown of Object.values(breakdowns)) {
    const tierForScore = await determineTier(supabase, breakdown.total_score);
    breakdown.tier = tierForScore.tier;
  }

  // Update the idea routing
  const previousStatus = routing.status;
  const updatedRouting = await updateIdeaRouting(
    supabase,
    input.idea_routing_id,
    {
      scores,
      tier: tierResult.tier,
      status: tierResult.tier === "kill" ? "killed" : "scored",
      scored_at: new Date().toISOString(),
      ...(tierResult.tier === "kill" && { killed_at: new Date().toISOString() }),
    }
  );

  // Log status change
  await logStatusChange(supabase, {
    idea_routing_id: input.idea_routing_id,
    from_status: previousStatus,
    to_status: tierResult.tier === "kill" ? "killed" : "scored",
    changed_by: userId,
    metadata: {
      scores,
      tier: tierResult.tier,
      primary_publication: primaryPub,
      primary_score: primaryScore,
    },
  });

  return {
    routing: updatedRouting,
    breakdowns,
    primaryTier: tierResult,
  };
}

/**
 * Preview scoring without saving
 */
export async function previewScore(
  supabase: SupabaseClient,
  publicationSlug: string,
  rubricScores: { [rubricSlug: string]: number }
): Promise<ScoreBreakdown> {
  const rubrics = await getScoringRubricsByPublication(supabase, publicationSlug);

  if (rubrics.length === 0) {
    throw new Error(`No rubrics found for publication: ${publicationSlug}`);
  }

  const breakdown = calculatePublicationScore(rubricScores, rubrics);
  breakdown.publication_slug = publicationSlug;

  const tierResult = await determineTier(supabase, breakdown.total_score);
  breakdown.tier = tierResult.tier;

  return breakdown;
}

/**
 * Get scoring guidance - returns rubric info for UI
 */
export async function getScoringGuidance(
  supabase: SupabaseClient,
  publicationSlug: string
): Promise<{
  publication_slug: string;
  rubrics: ScoringRubric[];
  total_weight: number;
}> {
  const rubrics = await getScoringRubricsByPublication(supabase, publicationSlug);

  const totalWeight = rubrics.reduce((sum, r) => sum + r.weight, 0);

  return {
    publication_slug: publicationSlug,
    rubrics,
    total_weight: Math.round(totalWeight * 100) / 100,
  };
}

/**
 * Override score manually
 */
export async function overrideScore(
  supabase: SupabaseClient,
  userId: string,
  ideaRoutingId: string,
  overrideScore: number,
  reason: string
): Promise<IdeaRouting> {
  const routing = await getIdeaRoutingById(supabase, ideaRoutingId);

  if (!routing) {
    throw new Error(`Idea routing not found: ${ideaRoutingId}`);
  }

  const tierResult = await determineTier(supabase, overrideScore);

  const updated = await updateIdeaRouting(supabase, ideaRoutingId, {
    override_score: overrideScore,
    override_reason: reason,
    tier: tierResult.tier,
    status: tierResult.tier === "kill" ? "killed" : "scored",
    scored_at: new Date().toISOString(),
  });

  await logStatusChange(supabase, {
    idea_routing_id: ideaRoutingId,
    from_status: routing.status,
    to_status: tierResult.tier === "kill" ? "killed" : "scored",
    changed_by: userId,
    change_reason: `Manual score override: ${reason}`,
    metadata: {
      override_score: overrideScore,
      original_scores: routing.scores,
      new_tier: tierResult.tier,
    },
  });

  return updated;
}
