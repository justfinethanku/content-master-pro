"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  IdeaRouting,
  IdeaRoutingStatus,
  RouteIdeaInput,
  RoutingResult,
  ScoreBreakdown,
  TierResult,
} from "@/lib/routing";

// Query key factory for routing
export const routingKeys = {
  all: ["routing"] as const,
  ideas: () => [...routingKeys.all, "ideas"] as const,
  ideasList: (filters?: IdeaRoutingFilters) => [...routingKeys.ideas(), "list", filters] as const,
  ideaDetail: (id: string) => [...routingKeys.ideas(), "detail", id] as const,
  ideaScore: (id: string) => [...routingKeys.ideas(), "score", id] as const,
  ideaSchedule: (id: string) => [...routingKeys.ideas(), "schedule", id] as const,
  dashboard: () => [...routingKeys.all, "dashboard"] as const,
  calendar: (start?: string, end?: string) => [...routingKeys.all, "calendar", start, end] as const,
  evergreen: (publicationSlug?: string) => [...routingKeys.all, "evergreen", publicationSlug] as const,
};

// Filter options
export interface IdeaRoutingFilters {
  status?: IdeaRoutingStatus;
  publication?: string;
  limit?: number;
  offset?: number;
}

// API response types
interface RouteIdeaResponse {
  success: boolean;
  routing: IdeaRouting;
  result: RoutingResult;
}

interface ScoreIdeaResponse {
  success: boolean;
  routing: IdeaRouting;
  breakdowns: Record<string, ScoreBreakdown>;
  tier: TierResult;
}

interface ScheduleIdeaResponse {
  success: boolean;
  routing: IdeaRouting;
}

// ============================================================================
// Idea Routing Hooks
// ============================================================================

/**
 * Fetch routed ideas with optional filters
 */
export function useRoutedIdeas(filters?: IdeaRoutingFilters) {
  return useQuery({
    queryKey: routingKeys.ideasList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.publication) params.set("publication", filters.publication);
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.offset) params.set("offset", filters.offset.toString());

      const response = await fetch(`/api/routing/ideas?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch ideas");
      }
      return response.json() as Promise<{
        ideas: IdeaRouting[];
        count: number;
        limit: number;
        offset: number;
      }>;
    },
  });
}

/**
 * Fetch a single idea routing by ID
 */
export function useIdeaRouting(id: string | null) {
  return useQuery({
    queryKey: routingKeys.ideaDetail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;

      const response = await fetch(`/api/routing/ideas/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch idea routing");
      }
      return response.json() as Promise<IdeaRouting>;
    },
    enabled: !!id,
  });
}

/**
 * Route an idea to a publication
 */
export function useRouteIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RouteIdeaInput): Promise<RouteIdeaResponse> => {
      const response = await fetch("/api/routing/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to route idea");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

/**
 * Preview routing without saving
 */
export function usePreviewRouting() {
  return useMutation({
    mutationFn: async (input: RouteIdeaInput): Promise<{ preview: boolean; result: RoutingResult | null }> => {
      const response = await fetch("/api/routing/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, preview: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to preview routing");
      }
      return response.json();
    },
  });
}

/**
 * Update an idea routing
 */
export function useUpdateIdeaRouting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<IdeaRouting> & { change_reason?: string };
    }): Promise<{ success: boolean; routing: IdeaRouting }> => {
      const response = await fetch(`/api/routing/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update routing");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.ideaDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

/**
 * Kill (archive) an idea routing
 */
export function useKillIdeaRouting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: string;
      reason?: string;
    }): Promise<{ success: boolean; routing: IdeaRouting }> => {
      const response = await fetch(`/api/routing/ideas/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to kill idea");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.ideaDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

// ============================================================================
// Scoring Hooks
// ============================================================================

/**
 * Score an idea
 */
export function useScoreIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      rubricScores,
    }: {
      id: string;
      rubricScores: Record<string, number>;
    }): Promise<ScoreIdeaResponse> => {
      const response = await fetch(`/api/routing/ideas/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubric_scores: rubricScores }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to score idea");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.ideaDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

/**
 * Preview score without saving
 */
export function usePreviewScore() {
  return useMutation({
    mutationFn: async ({
      publicationSlug,
      rubricScores,
    }: {
      publicationSlug: string;
      rubricScores: Record<string, number>;
    }): Promise<{ preview: boolean; breakdown: ScoreBreakdown }> => {
      // Using a dummy ID since we're just previewing
      const response = await fetch("/api/routing/ideas/preview/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          publication_slug: publicationSlug,
          rubric_scores: rubricScores,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to preview score");
      }
      return response.json();
    },
  });
}

/**
 * Override an idea's score
 */
export function useOverrideScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      score,
      reason,
    }: {
      id: string;
      score: number;
      reason: string;
    }): Promise<{ success: boolean; routing: IdeaRouting }> => {
      const response = await fetch(`/api/routing/ideas/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          override: true,
          override_score: score,
          override_reason: reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to override score");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.ideaDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

/**
 * Get scoring guidance for a publication
 */
export function useScoringGuidance(publicationSlug: string | null) {
  return useQuery({
    queryKey: ["routing", "scoring-guidance", publicationSlug],
    queryFn: async () => {
      if (!publicationSlug) return null;

      const response = await fetch(
        `/api/routing/ideas/guidance/score?publication=${publicationSlug}`
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get scoring guidance");
      }
      return response.json();
    },
    enabled: !!publicationSlug,
  });
}

// ============================================================================
// Scheduling Hooks
// ============================================================================

/**
 * Schedule an idea to a date
 */
export function useScheduleIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      calendarDate,
      slotId,
    }: {
      id: string;
      calendarDate: string;
      slotId?: string;
    }): Promise<ScheduleIdeaResponse> => {
      const response = await fetch(`/api/routing/ideas/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar_date: calendarDate,
          slot_id: slotId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to schedule idea");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.ideaDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: routingKeys.calendar() });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

/**
 * Add idea to evergreen queue
 */
export function useAddToEvergreen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      publicationSlug,
    }: {
      id: string;
      publicationSlug: string;
    }): Promise<{ success: boolean; added_to_evergreen: string }> => {
      const response = await fetch(`/api/routing/ideas/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_to_evergreen: true,
          publication_slug: publicationSlug,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to evergreen queue");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingKeys.ideas() });
      queryClient.invalidateQueries({ queryKey: routingKeys.ideaDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: routingKeys.evergreen() });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}

/**
 * Get recommended slot for an idea
 */
export function useRecommendedSlot(id: string | null) {
  return useQuery({
    queryKey: routingKeys.ideaSchedule(id ?? ""),
    queryFn: async () => {
      if (!id) return null;

      const response = await fetch(`/api/routing/ideas/${id}/schedule`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get recommendation");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// ============================================================================
// Dashboard & Calendar Hooks
// ============================================================================

/**
 * Get routing dashboard stats
 */
export function useRoutingDashboard(options?: { includeAlerts?: boolean }) {
  return useQuery({
    queryKey: routingKeys.dashboard(),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.includeAlerts === false) params.set("alerts", "false");

      const response = await fetch(`/api/routing/dashboard?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch dashboard");
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Get calendar availability
 */
export function useRoutingCalendar(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: routingKeys.calendar(startDate, endDate),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);

      const response = await fetch(`/api/routing/calendar?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch calendar");
      }
      return response.json();
    },
  });
}

/**
 * Get evergreen queue
 */
export function useEvergreenQueue(publicationSlug?: string, limit?: number) {
  return useQuery({
    queryKey: routingKeys.evergreen(publicationSlug),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (publicationSlug) params.set("publication", publicationSlug);
      if (limit) params.set("limit", limit.toString());

      const response = await fetch(`/api/routing/evergreen?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch evergreen queue");
      }
      return response.json();
    },
  });
}

/**
 * Remove from evergreen queue
 */
export function useRemoveFromEvergreen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean }> => {
      const response = await fetch("/api/routing/evergreen", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove from queue");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingKeys.evergreen() });
      queryClient.invalidateQueries({ queryKey: routingKeys.dashboard() });
    },
  });
}
