"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Capture {
  id: string;
  changelog_item_id: string;
  user_commentary: string;
  created_at: string;
  processed_at: string | null;
  pipeline_session_id: string | null;
  changelog_item: {
    id: string;
    source_name: string;
    source_url: string;
    headline: string;
    summary: string;
    impact_level: "minor" | "major" | "breaking";
    published_at: string | null;
  };
}

/**
 * Fetch all captures with their changelog items
 */
export function useCaptures(options?: { search?: string }) {
  return useQuery({
    queryKey: ["captures", options?.search],
    queryFn: async (): Promise<Capture[]> => {
      const supabase = createClient();

      let query = supabase
        .from("swipe_captures")
        .select(
          `
          *,
          changelog_item:changelog_items (
            id,
            source_name,
            source_url,
            headline,
            summary,
            impact_level,
            published_at
          )
        `
        )
        .order("created_at", { ascending: false });

      if (options?.search) {
        query = query.or(
          `user_commentary.ilike.%${options.search}%,changelog_items.headline.ilike.%${options.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Capture[];
    },
  });
}

/**
 * Delete a capture
 */
export function useDeleteCapture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (captureId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("swipe_captures")
        .delete()
        .eq("id", captureId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captures"] });
    },
  });
}
