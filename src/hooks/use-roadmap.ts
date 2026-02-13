"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  RoadmapItem,
  RoadmapItemInsert,
  RoadmapItemUpdate,
  RoadmapItemWithDetails,
  RoadmapCommentInsert,
  RoadmapCommentWithUser,
  RoadmapComment,
} from "@/lib/types";

// Query key factory
export const roadmapKeys = {
  all: ["roadmap"] as const,
  lists: () => [...roadmapKeys.all, "list"] as const,
  details: () => [...roadmapKeys.all, "detail"] as const,
  detail: (id: string) => [...roadmapKeys.details(), id] as const,
  comments: (itemId: string) =>
    [...roadmapKeys.all, "comments", itemId] as const,
};

/**
 * Fetch all roadmap items with vote/comment counts and user vote status
 */
export function useRoadmapItems() {
  return useQuery({
    queryKey: roadmapKeys.lists(),
    queryFn: async (): Promise<RoadmapItemWithDetails[]> => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch items
      const { data: items, error } = await supabase
        .from("roadmap_items")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (!items || items.length === 0) return [];

      const itemIds = items.map((i) => i.id);

      // Fetch submitter profiles
      const submitterIds = [...new Set(items.map((i) => i.submitted_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", submitterIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.id, { email: p.email, display_name: p.display_name }]) ?? []
      );

      // Fetch vote counts
      const { data: voteCounts } = await supabase
        .from("roadmap_votes")
        .select("item_id")
        .in("item_id", itemIds);

      // Fetch user's votes
      const { data: userVotes } = await supabase
        .from("roadmap_votes")
        .select("item_id")
        .eq("user_id", user.id)
        .in("item_id", itemIds);

      // Fetch comment counts
      const { data: commentCounts } = await supabase
        .from("roadmap_comments")
        .select("item_id")
        .in("item_id", itemIds);

      // Build count maps
      const voteMap = new Map<string, number>();
      voteCounts?.forEach((v) => {
        voteMap.set(v.item_id, (voteMap.get(v.item_id) || 0) + 1);
      });

      const commentMap = new Map<string, number>();
      commentCounts?.forEach((c) => {
        commentMap.set(c.item_id, (commentMap.get(c.item_id) || 0) + 1);
      });

      const userVoteSet = new Set(userVotes?.map((v) => v.item_id));

      return items.map((item) => ({
        ...item,
        vote_count: voteMap.get(item.id) || 0,
        comment_count: commentMap.get(item.id) || 0,
        user_has_voted: userVoteSet.has(item.id),
        profiles: profileMap.get(item.submitted_by) ?? null,
      })) as RoadmapItemWithDetails[];
    },
  });
}

/**
 * Create a new roadmap item
 */
export function useCreateRoadmapItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      item: Omit<RoadmapItemInsert, "submitted_by" | "sort_order">
    ): Promise<RoadmapItem> => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get max sort_order
      const { data: maxItem } = await supabase
        .from("roadmap_items")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxItem?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("roadmap_items")
        .insert({
          ...item,
          submitted_by: user.id,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as RoadmapItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}

/**
 * Update a roadmap item's title/description
 */
export function useUpdateRoadmapItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: RoadmapItemUpdate;
    }): Promise<RoadmapItem> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("roadmap_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as RoadmapItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}

/**
 * Delete a roadmap item (cascades comments/votes)
 */
export function useDeleteRoadmapItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const supabase = createClient();

      const { error } = await supabase
        .from("roadmap_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}

/**
 * Batch update sort_order after drag reorder
 */
export function useReorderRoadmapItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      items: { id: string; sort_order: number }[]
    ): Promise<void> => {
      const supabase = createClient();

      // Update each item's sort_order
      const promises = items.map(({ id, sort_order }) =>
        supabase
          .from("roadmap_items")
          .update({ sort_order })
          .eq("id", id)
      );

      const results = await Promise.all(promises);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}

/**
 * Toggle vote on a roadmap item (add or remove)
 */
export function useToggleVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      hasVoted,
    }: {
      itemId: string;
      hasVoted: boolean;
    }): Promise<void> => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (hasVoted) {
        // Remove vote
        const { error } = await supabase
          .from("roadmap_votes")
          .delete()
          .eq("item_id", itemId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Add vote
        const { error } = await supabase
          .from("roadmap_votes")
          .insert({ item_id: itemId, user_id: user.id });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}

/**
 * Fetch comments for a specific item
 */
export function useRoadmapComments(itemId: string | null) {
  return useQuery({
    queryKey: roadmapKeys.comments(itemId ?? ""),
    queryFn: async (): Promise<RoadmapCommentWithUser[]> => {
      if (!itemId) return [];

      const supabase = createClient();

      const { data: comments, error } = await supabase
        .from("roadmap_comments")
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!comments || comments.length === 0) return [];

      // Fetch commenter profiles
      const userIds = [...new Set(comments.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.id, { email: p.email, display_name: p.display_name }]) ?? []
      );

      return comments.map((c) => ({
        ...c,
        profiles: profileMap.get(c.user_id) ?? null,
      })) as RoadmapCommentWithUser[];
    },
    enabled: !!itemId,
  });
}

/**
 * Add a comment to a roadmap item
 */
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      comment: Omit<RoadmapCommentInsert, "user_id">
    ): Promise<RoadmapComment> => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("roadmap_comments")
        .insert({ ...comment, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as RoadmapComment;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.comments(variables.item_id),
      });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}

/**
 * Delete own comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      itemId,
    }: {
      commentId: string;
      itemId: string;
    }): Promise<string> => {
      const supabase = createClient();

      const { error } = await supabase
        .from("roadmap_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      return itemId;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.comments(variables.itemId),
      });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.lists() });
    },
  });
}
