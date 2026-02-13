"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  ProjectAsset,
  ProjectAssetInsert,
  ProjectAssetUpdate,
  AssetStatus,
  LockStatus,
} from "@/lib/types";
import { projectKeys } from "./use-projects";
import { deliverableKeys } from "./use-deliverables";

// Query key factory for assets
export const assetKeys = {
  all: ["assets"] as const,
  lists: () => [...assetKeys.all, "list"] as const,
  list: (projectId: string) => [...assetKeys.lists(), projectId] as const,
  details: () => [...assetKeys.all, "detail"] as const,
  detail: (id: string) => [...assetKeys.details(), id] as const,
  lock: (id: string) => [...assetKeys.detail(id), "lock"] as const,
};

/**
 * Fetch all assets for a project
 */
export function useAssets(projectId: string | null) {
  return useQuery({
    queryKey: assetKeys.list(projectId ?? ""),
    queryFn: async (): Promise<ProjectAsset[]> => {
      if (!projectId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ProjectAsset[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single asset by ID
 */
export function useAsset(id: string | null) {
  return useQuery({
    queryKey: assetKeys.detail(id ?? ""),
    queryFn: async (): Promise<ProjectAsset | null> => {
      if (!id) return null;

      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data as ProjectAsset;
    },
    enabled: !!id,
  });
}

/**
 * Create a new asset
 */
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (asset: ProjectAssetInsert): Promise<ProjectAsset> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .insert(asset)
        .select()
        .single();

      if (error) throw error;
      return data as ProjectAsset;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: assetKeys.list(data.project_id),
      });
    },
  });
}

/**
 * Update an asset
 */
export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ProjectAssetUpdate;
    }): Promise<ProjectAsset> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ProjectAsset;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: assetKeys.list(data.project_id),
      });
      queryClient.invalidateQueries({ queryKey: assetKeys.detail(data.id) });
    },
  });
}

/**
 * Delete an asset. If it was the last asset in the project, also delete the project.
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      projectId,
    }: {
      id: string;
      projectId: string;
    }): Promise<{ projectDeleted: boolean }> => {
      const supabase = createClient();

      // Delete the asset
      const { error } = await supabase
        .from("project_assets")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Check if the project has any remaining assets
      const { count, error: countError } = await supabase
        .from("project_assets")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);

      if (countError) throw countError;

      // If no assets remain, delete the orphaned project
      if (count === 0) {
        const { error: deleteProjectError } = await supabase
          .from("projects")
          .delete()
          .eq("id", projectId);

        if (deleteProjectError) throw deleteProjectError;
        return { projectDeleted: true };
      }

      return { projectDeleted: false };
    },
    onSuccess: ({ projectDeleted }, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.list(projectId) });
      if (projectDeleted) {
        queryClient.invalidateQueries({ queryKey: projectKeys.all });
        queryClient.invalidateQueries({ queryKey: deliverableKeys.all });
      }
    },
  });
}

/**
 * Update asset status
 */
export function useUpdateAssetStatus() {
  const updateAsset = useUpdateAsset();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AssetStatus;
    }): Promise<ProjectAsset> => {
      return updateAsset.mutateAsync({
        id,
        updates: { status },
      });
    },
  });
}

// ============================================================================
// Edit Locking Hooks
// ============================================================================

/**
 * Check lock status for an asset
 */
export function useCheckLock(assetId: string | null) {
  return useQuery({
    queryKey: assetKeys.lock(assetId ?? ""),
    queryFn: async (): Promise<LockStatus> => {
      if (!assetId) {
        return {
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          isLockedByCurrentUser: false,
        };
      }

      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Get asset lock status
      const { data, error } = await supabase
        .from("project_assets")
        .select("locked_by, locked_at")
        .eq("id", assetId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return {
            isLocked: false,
            lockedBy: null,
            lockedAt: null,
            isLockedByCurrentUser: false,
          };
        }
        throw error;
      }

      const isLocked = !!data.locked_by;
      const isLockedByCurrentUser = data.locked_by === user?.id;

      // Check if lock is stale (older than 30 minutes)
      const lockAge = data.locked_at
        ? Date.now() - new Date(data.locked_at).getTime()
        : 0;
      const isStale = lockAge > 30 * 60 * 1000; // 30 minutes

      return {
        isLocked: isLocked && !isStale,
        lockedBy: isStale ? null : data.locked_by,
        lockedAt: isStale ? null : data.locked_at,
        isLockedByCurrentUser: isLockedByCurrentUser && !isStale,
      };
    },
    enabled: !!assetId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Acquire edit lock on an asset
 */
export function useAcquireLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string): Promise<boolean> => {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check current lock status
      const { data: current } = await supabase
        .from("project_assets")
        .select("locked_by, locked_at")
        .eq("id", assetId)
        .single();

      // If locked by someone else and not stale, fail
      if (current?.locked_by && current.locked_by !== user.id) {
        const lockAge = current.locked_at
          ? Date.now() - new Date(current.locked_at).getTime()
          : 0;
        if (lockAge < 30 * 60 * 1000) {
          return false; // Lock is held by someone else
        }
      }

      // Acquire or refresh lock
      const { error } = await supabase
        .from("project_assets")
        .update({
          locked_by: user.id,
          locked_at: new Date().toISOString(),
        })
        .eq("id", assetId);

      if (error) throw error;
      return true;
    },
    onSuccess: (_, assetId) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lock(assetId) });
      queryClient.invalidateQueries({ queryKey: assetKeys.detail(assetId) });
    },
  });
}

/**
 * Release edit lock on an asset
 */
export function useReleaseLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string): Promise<void> => {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Only release if we own the lock
      const { error } = await supabase
        .from("project_assets")
        .update({
          locked_by: null,
          locked_at: null,
        })
        .eq("id", assetId)
        .eq("locked_by", user.id);

      if (error) throw error;
    },
    onSuccess: (_, assetId) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lock(assetId) });
      queryClient.invalidateQueries({ queryKey: assetKeys.detail(assetId) });
    },
  });
}

/**
 * Refresh lock timestamp (to prevent timeout while actively editing)
 */
export function useRefreshLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string): Promise<void> => {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Only refresh if we own the lock
      const { error } = await supabase
        .from("project_assets")
        .update({
          locked_at: new Date().toISOString(),
        })
        .eq("id", assetId)
        .eq("locked_by", user.id);

      if (error) throw error;
    },
    onSuccess: (_, assetId) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lock(assetId) });
    },
  });
}
