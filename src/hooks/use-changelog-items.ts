"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface ChangelogItem {
  id: string;
  source_name: string;
  source_url: string;
  headline: string;
  summary: string;
  impact_level: "minor" | "major" | "breaking";
  published_at: string | null;
  ingested_at: string;
  status: "unread" | "dismissed" | "captured";
  metadata: Record<string, unknown>;
}

/**
 * Fetch unread changelog items for the swipe interface
 */
export function useUnreadItems() {
  return useQuery({
    queryKey: ["changelog-items", "unread"],
    queryFn: async (): Promise<ChangelogItem[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("changelog_items")
        .select("*")
        .eq("status", "unread")
        .order("ingested_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Dismiss a changelog item (swipe left)
 */
export function useDismissItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("changelog_items")
        .update({ status: "dismissed" })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-items"] });
    },
  });
}

/**
 * Mark a changelog item as captured (after right swipe + commentary)
 */
export function useMarkCaptured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("changelog_items")
        .update({ status: "captured" })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-items"] });
    },
  });
}
