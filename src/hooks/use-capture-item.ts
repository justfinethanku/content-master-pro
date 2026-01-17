"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CaptureInput {
  changelog_item_id: string;
  user_commentary: string;
}

/**
 * Save a captured item with user commentary
 */
export function useCaptureItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ changelog_item_id, user_commentary }: CaptureInput) => {
      const supabase = createClient();

      // Insert capture
      const { error: captureError } = await supabase
        .from("swipe_captures")
        .insert({
          changelog_item_id,
          user_commentary,
        });

      if (captureError) throw captureError;

      // Update changelog item status
      const { error: updateError } = await supabase
        .from("changelog_items")
        .update({ status: "captured" })
        .eq("id", changelog_item_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-items"] });
      queryClient.invalidateQueries({ queryKey: ["captures"] });
    },
  });
}
