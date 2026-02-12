"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AssetVersion, AssetVersionInsert } from "@/lib/types";
import { assetKeys } from "./use-assets";

// Query key factory for asset versions
export const versionKeys = {
  all: ["asset-versions"] as const,
  lists: () => [...versionKeys.all, "list"] as const,
  list: (assetId: string) => [...versionKeys.lists(), assetId] as const,
  details: () => [...versionKeys.all, "detail"] as const,
  detail: (id: string) => [...versionKeys.details(), id] as const,
};

/**
 * Fetch all versions for an asset
 */
export function useAssetVersions(assetId: string | null) {
  return useQuery({
    queryKey: versionKeys.list(assetId ?? ""),
    queryFn: async (): Promise<AssetVersion[]> => {
      if (!assetId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_asset_versions")
        .select("*")
        .eq("asset_id", assetId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return (data || []) as AssetVersion[];
    },
    enabled: !!assetId,
  });
}

/**
 * Fetch a specific version by ID
 */
export function useAssetVersion(id: string | null) {
  return useQuery({
    queryKey: versionKeys.detail(id ?? ""),
    queryFn: async (): Promise<AssetVersion | null> => {
      if (!id) return null;

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_asset_versions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data as AssetVersion;
    },
    enabled: !!id,
  });
}

/**
 * Create a new version (called on every save)
 */
export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assetId,
      content,
    }: {
      assetId: string;
      content: string;
    }): Promise<AssetVersion> => {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current version number
      const { data: asset } = await supabase
        .from("nate_project_assets")
        .select("current_version")
        .eq("id", assetId)
        .single();

      const nextVersion = (asset?.current_version || 0) + 1;

      // Create version
      const { data: version, error: versionError } = await supabase
        .from("nate_asset_versions")
        .insert({
          asset_id: assetId,
          version_number: nextVersion,
          content,
          created_by: user.id,
        } as AssetVersionInsert)
        .select()
        .single();

      if (versionError) throw versionError;

      // Update asset's current_version and content
      const { error: updateError } = await supabase
        .from("nate_project_assets")
        .update({
          current_version: nextVersion,
          content,
        })
        .eq("id", assetId);

      if (updateError) throw updateError;

      return version as AssetVersion;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: versionKeys.list(data.asset_id),
      });
      queryClient.invalidateQueries({
        queryKey: assetKeys.detail(data.asset_id),
      });
    },
  });
}

/**
 * Restore from a previous version
 * Creates a new version with the old content (doesn't overwrite history)
 */
export function useRestoreVersion() {
  const createVersion = useCreateVersion();

  return useMutation({
    mutationFn: async ({
      assetId,
      versionId,
    }: {
      assetId: string;
      versionId: string;
    }): Promise<AssetVersion> => {
      const supabase = createClient();

      // Get the version to restore
      const { data: oldVersion, error } = await supabase
        .from("nate_asset_versions")
        .select("content")
        .eq("id", versionId)
        .single();

      if (error) throw error;
      if (!oldVersion) throw new Error("Version not found");

      // Create a new version with the old content
      return createVersion.mutateAsync({
        assetId,
        content: oldVersion.content,
      });
    },
  });
}

/**
 * Get the latest version for an asset
 */
export function useLatestVersion(assetId: string | null) {
  return useQuery({
    queryKey: [...versionKeys.list(assetId ?? ""), "latest"],
    queryFn: async (): Promise<AssetVersion | null> => {
      if (!assetId) return null;

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_asset_versions")
        .select("*")
        .eq("asset_id", assetId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data as AssetVersion;
    },
    enabled: !!assetId,
  });
}

/**
 * Compare two versions (returns both for UI to diff)
 */
export function useCompareVersions(versionId1: string | null, versionId2: string | null) {
  return useQuery({
    queryKey: [...versionKeys.all, "compare", versionId1, versionId2],
    queryFn: async (): Promise<{ v1: AssetVersion; v2: AssetVersion } | null> => {
      if (!versionId1 || !versionId2) return null;

      const supabase = createClient();

      const [{ data: v1 }, { data: v2 }] = await Promise.all([
        supabase
          .from("nate_asset_versions")
          .select("*")
          .eq("id", versionId1)
          .single(),
        supabase
          .from("nate_asset_versions")
          .select("*")
          .eq("id", versionId2)
          .single(),
      ]);

      if (!v1 || !v2) return null;

      return {
        v1: v1 as AssetVersion,
        v2: v2 as AssetVersion,
      };
    },
    enabled: !!versionId1 && !!versionId2,
  });
}
