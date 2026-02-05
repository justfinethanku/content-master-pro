"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Publication,
  PublicationInsert,
  PublicationUpdate,
  ScoringRubric,
  ScoringRubricInsert,
  ScoringRubricUpdate,
  RoutingRule,
  RoutingRuleInsert,
  RoutingRuleUpdate,
  CalendarSlot,
  CalendarSlotInsert,
  CalendarSlotUpdate,
  TierThreshold,
  TierThresholdUpdate,
} from "@/lib/routing";

// Query key factory for routing config
export const routingConfigKeys = {
  all: ["routing-config"] as const,
  publications: () => [...routingConfigKeys.all, "publications"] as const,
  publicationsList: (activeOnly?: boolean) => [...routingConfigKeys.publications(), "list", activeOnly] as const,
  publicationDetail: (id: string) => [...routingConfigKeys.publications(), "detail", id] as const,
  rubrics: () => [...routingConfigKeys.all, "rubrics"] as const,
  rubricsList: (publicationSlug?: string) => [...routingConfigKeys.rubrics(), "list", publicationSlug] as const,
  rules: () => [...routingConfigKeys.all, "rules"] as const,
  rulesList: (activeOnly?: boolean) => [...routingConfigKeys.rules(), "list", activeOnly] as const,
  slots: () => [...routingConfigKeys.all, "slots"] as const,
  slotsList: (publicationSlug?: string, activeOnly?: boolean) =>
    [...routingConfigKeys.slots(), "list", publicationSlug, activeOnly] as const,
  slotDetail: (id: string) => [...routingConfigKeys.slots(), "detail", id] as const,
  tiers: () => [...routingConfigKeys.all, "tiers"] as const,
  tiersList: (activeOnly?: boolean) => [...routingConfigKeys.tiers(), "list", activeOnly] as const,
};

// ============================================================================
// Publication Hooks
// ============================================================================

/**
 * Fetch all publications
 */
export function usePublications(activeOnly?: boolean) {
  return useQuery({
    queryKey: routingConfigKeys.publicationsList(activeOnly),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeOnly) params.set("active", "true");

      const response = await fetch(`/api/routing/config/publications?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch publications");
      }
      const data = await response.json();
      return data.publications as Publication[];
    },
  });
}

/**
 * Fetch a single publication
 */
export function usePublication(id: string | null) {
  return useQuery({
    queryKey: routingConfigKeys.publicationDetail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;

      const response = await fetch(`/api/routing/config/publications/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch publication");
      }
      return response.json() as Promise<Publication>;
    },
    enabled: !!id,
  });
}

/**
 * Create a new publication
 */
export function useCreatePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PublicationInsert): Promise<Publication> => {
      const response = await fetch("/api/routing/config/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create publication");
      }
      const data = await response.json();
      return data.publication;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.publications() });
    },
  });
}

/**
 * Update a publication
 */
export function useUpdatePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: PublicationUpdate;
    }): Promise<Publication> => {
      const response = await fetch(`/api/routing/config/publications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update publication");
      }
      const data = await response.json();
      return data.publication;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.publications() });
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.publicationDetail(variables.id) });
    },
  });
}

// ============================================================================
// Scoring Rubric Hooks
// ============================================================================

/**
 * Fetch scoring rubrics
 */
export function useScoringRubrics(publicationSlug?: string) {
  return useQuery({
    queryKey: routingConfigKeys.rubricsList(publicationSlug),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (publicationSlug) params.set("publication", publicationSlug);

      const response = await fetch(`/api/routing/config/rubrics?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch rubrics");
      }
      const data = await response.json();
      return data.rubrics as ScoringRubric[];
    },
  });
}

/**
 * Create a new rubric
 */
export function useCreateScoringRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: ScoringRubricInsert & { publication_slug: string }
    ): Promise<ScoringRubric> => {
      const response = await fetch("/api/routing/config/rubrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create rubric");
      }
      const data = await response.json();
      return data.rubric;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rubrics() });
    },
  });
}

/**
 * Update a rubric
 */
export function useUpdateScoringRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ScoringRubricUpdate;
    }): Promise<ScoringRubric> => {
      const response = await fetch(`/api/routing/config/rubrics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update rubric");
      }
      const data = await response.json();
      return data.rubric;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rubrics() });
    },
  });
}

/**
 * Delete (deactivate) a rubric
 */
export function useDeleteScoringRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/routing/config/rubrics/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete rubric");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rubrics() });
    },
  });
}

// ============================================================================
// Routing Rule Hooks
// ============================================================================

/**
 * Fetch routing rules
 */
export function useRoutingRules(activeOnly?: boolean) {
  return useQuery({
    queryKey: routingConfigKeys.rulesList(activeOnly),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeOnly) params.set("active", "true");

      const response = await fetch(`/api/routing/config/rules?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch rules");
      }
      const data = await response.json();
      return data.rules as RoutingRule[];
    },
  });
}

/**
 * Create a new rule
 */
export function useCreateRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RoutingRuleInsert): Promise<RoutingRule> => {
      const response = await fetch("/api/routing/config/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create rule");
      }
      const data = await response.json();
      return data.rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rules() });
    },
  });
}

/**
 * Update a rule
 */
export function useUpdateRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: RoutingRuleUpdate;
    }): Promise<RoutingRule> => {
      const response = await fetch(`/api/routing/config/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update rule");
      }
      const data = await response.json();
      return data.rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rules() });
    },
  });
}

/**
 * Delete a rule
 */
export function useDeleteRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/routing/config/rules/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete rule");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rules() });
    },
  });
}

/**
 * Reorder rules
 */
export function useReorderRoutingRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleIds: string[]): Promise<void> => {
      const response = await fetch("/api/routing/config/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: true, rule_ids: ruleIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reorder rules");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.rules() });
    },
  });
}

// ============================================================================
// Calendar Slot Hooks
// ============================================================================

/**
 * Fetch calendar slots
 */
export function useCalendarSlots(publicationSlug?: string, activeOnly?: boolean) {
  return useQuery({
    queryKey: routingConfigKeys.slotsList(publicationSlug, activeOnly),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (publicationSlug) params.set("publication", publicationSlug);
      if (activeOnly) params.set("active", "true");

      const response = await fetch(`/api/routing/config/slots?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch slots");
      }
      const data = await response.json();
      return data.slots as CalendarSlot[];
    },
  });
}

/**
 * Fetch a single slot
 */
export function useCalendarSlot(id: string | null) {
  return useQuery({
    queryKey: routingConfigKeys.slotDetail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;

      const response = await fetch(`/api/routing/config/slots/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch slot");
      }
      return response.json() as Promise<CalendarSlot>;
    },
    enabled: !!id,
  });
}

/**
 * Create a new slot
 */
export function useCreateCalendarSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CalendarSlotInsert & { publication_slug: string }
    ): Promise<CalendarSlot> => {
      const response = await fetch("/api/routing/config/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create slot");
      }
      const data = await response.json();
      return data.slot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.slots() });
    },
  });
}

/**
 * Update a slot
 */
export function useUpdateCalendarSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: CalendarSlotUpdate;
    }): Promise<CalendarSlot> => {
      const response = await fetch(`/api/routing/config/slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update slot");
      }
      const data = await response.json();
      return data.slot;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.slots() });
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.slotDetail(variables.id) });
    },
  });
}

/**
 * Delete (deactivate) a slot
 */
export function useDeleteCalendarSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/routing/config/slots/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete slot");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.slots() });
    },
  });
}

// ============================================================================
// Tier Threshold Hooks
// ============================================================================

/**
 * Fetch tier thresholds
 */
export function useTierThresholds(activeOnly?: boolean) {
  return useQuery({
    queryKey: routingConfigKeys.tiersList(activeOnly),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeOnly) params.set("active", "true");

      const response = await fetch(`/api/routing/config/tiers?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch tiers");
      }
      const data = await response.json();
      return data.tiers as TierThreshold[];
    },
  });
}

/**
 * Update a tier threshold
 */
export function useUpdateTierThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: TierThresholdUpdate;
    }): Promise<TierThreshold> => {
      const response = await fetch("/api/routing/config/tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tier");
      }
      const data = await response.json();
      return data.tier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routingConfigKeys.tiers() });
    },
  });
}
