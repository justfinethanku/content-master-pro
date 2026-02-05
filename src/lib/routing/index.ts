/**
 * Content Routing & Scoring System
 *
 * This module provides the core logic for routing, scoring, and scheduling content ideas.
 * It uses a "linking tables" architecture to maintain isolation from the rest of the app.
 *
 * Main exports:
 * - Router: Route ideas to publications based on configurable rules
 * - Scorer: Score ideas against publication-specific rubrics
 * - Scheduler: Assign slots and calendar dates
 * - Queries: Database access functions
 * - Types: TypeScript interfaces
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Publications
  Publication,
  PublicationInsert,
  PublicationUpdate,
  PublicationWithUnified,
  PublicationType,
  // Calendar Slots
  CalendarSlot,
  CalendarSlotInsert,
  CalendarSlotUpdate,
  CalendarSlotWithPublication,
  SkipRule,
  // Scoring Rubrics
  ScoringRubric,
  ScoringRubricInsert,
  ScoringRubricUpdate,
  ScoringRubricWithPublication,
  ScoringCriterion,
  ScoringModifier,
  // Routing Rules
  RoutingRule,
  RoutingRuleInsert,
  RoutingRuleUpdate,
  RoutingCondition,
  RoutingConditionOperator,
  RoutingDestination,
  YouTubeVersion,
  // Tier Thresholds
  TierThreshold,
  TierThresholdInsert,
  TierThresholdUpdate,
  TierSlug,
  TierActions,
  // Idea Routing
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
  // Project Routing
  ProjectRouting,
  ProjectRoutingInsert,
  ProjectRoutingUpdate,
  ProjectRoutingWithProject,
  ProjectRoutingWithAll,
  // Evergreen Queue
  EvergreenQueueEntry,
  EvergreenQueueInsert,
  EvergreenQueueUpdate,
  EvergreenQueueWithDetails,
  // Status Log
  RoutingStatusLog,
  RoutingStatusLogInsert,
  // Dashboard
  RoutingDashboardStats,
  RoutingAlert,
  ScoreBreakdown,
  RoutingResult,
  // Module-specific
  RouteIdeaInput,
  ScoreIdeaInput,
  ScheduleIdeaInput,
  RoutingContext,
  TierResult,
  DateAvailability,
  BufferStatus,
} from "./types";

// ============================================================================
// Queries
// ============================================================================

export {
  // Publications
  getPublications,
  getPublicationBySlug,
  getPublicationById,
  createPublication,
  updatePublication,
  deletePublication,
  // Calendar Slots
  getCalendarSlots,
  getCalendarSlotById,
  getCalendarSlotsByPublication,
  createCalendarSlot,
  updateCalendarSlot,
  deleteCalendarSlot,
  // Scoring Rubrics
  getScoringRubrics,
  getScoringRubricsByPublication,
  createScoringRubric,
  updateScoringRubric,
  deleteScoringRubric,
  // Routing Rules
  getRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  reorderRoutingRules,
  // Tier Thresholds
  getTierThresholds,
  getTierByScore,
  updateTierThreshold,
  // Idea Routing
  getIdeaRoutings,
  getIdeaRoutingById,
  getIdeaRoutingByIdeaId,
  getIdeaRoutingsByStatus,
  createIdeaRouting,
  updateIdeaRouting,
  deleteIdeaRouting,
  // Project Routing
  getProjectRoutings,
  getProjectRoutingById,
  getProjectRoutingByProjectId,
  createProjectRouting,
  updateProjectRouting,
  // Evergreen Queue
  getEvergreenQueue,
  addToEvergreenQueue,
  removeFromEvergreenQueue,
  updateEvergreenQueueEntry,
  getEvergreenQueueCounts,
  pullFromEvergreenQueue,
  // Status Log
  logStatusChange,
  getStatusHistory,
  // Settings
  getRoutingSetting,
  getRoutingSettings,
} from "./queries";

// ============================================================================
// Router
// ============================================================================

export {
  // Core routing functions
  routeIdea,
  rerouteIdea,
  previewRouting,
  // Utility functions
  findMatchingRule,
} from "./router";

// ============================================================================
// Scorer
// ============================================================================

export {
  // Core scoring functions
  scoreIdea,
  previewScore,
  overrideScore,
  // Utility functions
  calculatePublicationScore,
  determineTier,
  getScoringGuidance,
} from "./scorer";

// ============================================================================
// Scheduler
// ============================================================================

export {
  // Core scheduling functions
  scheduleIdea,
  addToEvergreen,
  // Availability functions
  getDateAvailability,
  findNextAvailableSlot,
  getRecommendedSlot,
  // Buffer status
  getBufferStatus,
} from "./scheduler";
