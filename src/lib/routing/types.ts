/**
 * Internal types for the routing module
 * Re-exports from main types.ts and adds module-specific types
 */

// Re-export all routing types from main types file
export type {
  Publication,
  PublicationInsert,
  PublicationUpdate,
  PublicationWithUnified,
  PublicationType,
  CalendarSlot,
  CalendarSlotInsert,
  CalendarSlotUpdate,
  CalendarSlotWithPublication,
  SkipRule,
  ScoringRubric,
  ScoringRubricInsert,
  ScoringRubricUpdate,
  ScoringRubricWithPublication,
  ScoringCriterion,
  ScoringModifier,
  RoutingRule,
  RoutingRuleInsert,
  RoutingRuleUpdate,
  RoutingCondition,
  RoutingConditionOperator,
  RoutingDestination,
  YouTubeVersion,
  TierThreshold,
  TierThresholdInsert,
  TierThresholdUpdate,
  TierSlug,
  TierActions,
  IdeaRouting,
  IdeaRoutingInsert,
  IdeaRoutingUpdate,
  IdeaRoutingWithIdea,
  IdeaRoutingWithAll,
  IdeaRoutingScores,
  IdeaRoutingStatus,
  RoutingAudience,
  TimeSensitivity,
  ResourceType,
  EstimatedLength,
  ProjectRouting,
  ProjectRoutingInsert,
  ProjectRoutingUpdate,
  ProjectRoutingWithProject,
  ProjectRoutingWithAll,
  EvergreenQueueEntry,
  EvergreenQueueInsert,
  EvergreenQueueUpdate,
  EvergreenQueueWithDetails,
  RoutingStatusLog,
  RoutingStatusLogInsert,
  RoutingDashboardStats,
  RoutingAlert,
  ScoreBreakdown,
  RoutingResult,
} from "@/lib/types";

// Module-specific types

/**
 * Input for routing an idea
 */
export interface RouteIdeaInput {
  idea_id: string;
  audience?: "beginner" | "intermediate" | "executive";
  action?: string;
  time_sensitivity?: "evergreen" | "news_hook" | "launch_tie" | "seasonal";
  news_window?: string;
  resource?: "prompts" | "template" | "guide" | "framework" | "toolkit" | "none";
  angle?: string;
  estimated_length?: "short" | "medium" | "long";
  // Helper flags (can be set manually or by AI)
  can_frame_as_complete_guide?: boolean;
  can_frame_as_zero_to_hero?: boolean;
  is_foundational?: boolean;
  would_bore_paid_subs?: boolean;
  requires_tool_familiarity?: boolean;
  has_contrarian_angle?: boolean;
  is_technical_implementation?: boolean;
  could_serve_both_audiences?: boolean;
}

/**
 * Input for scoring an idea
 */
export interface ScoreIdeaInput {
  idea_routing_id: string;
  rubric_scores: {
    [rubricSlug: string]: number;
  };
}

/**
 * Input for scheduling an idea
 */
export interface ScheduleIdeaInput {
  idea_routing_id: string;
  calendar_date: string;
  slot_id?: string;
  force?: boolean; // Override bumping rules
}

/**
 * Context for evaluating routing rules
 */
export interface RoutingContext {
  audience?: string;
  action?: string;
  time_sensitivity?: string;
  resource?: string;
  angle?: string;
  estimated_length?: string;
  can_frame_as_complete_guide?: boolean;
  can_frame_as_zero_to_hero?: boolean;
  is_foundational?: boolean;
  would_bore_paid_subs?: boolean;
  requires_tool_familiarity?: boolean;
  has_contrarian_angle?: boolean;
  is_technical_implementation?: boolean;
  could_serve_both_audiences?: boolean;
  [key: string]: unknown;
}

/**
 * Result of tier determination
 */
export interface TierResult {
  tier: "premium_a" | "a" | "b" | "c" | "kill";
  threshold: {
    display_name: string;
    auto_stagger: boolean;
    preferred_days: number[];
    actions: Record<string, unknown>;
  };
}

/**
 * Calendar availability for a specific date
 */
export interface DateAvailability {
  date: string;
  day_of_week: number;
  slots: {
    publication_slug: string;
    is_available: boolean;
    is_fixed: boolean;
    fixed_format?: string;
    preferred_tier?: string;
    reason?: string; // If not available, why
  }[];
}

/**
 * Buffer status for evergreen queues
 */
export interface BufferStatus {
  publication_slug: string;
  publication_name: string;
  queue_count: number;
  weekly_target: number;
  weeks_of_buffer: number;
  status: "green" | "yellow" | "red";
}
