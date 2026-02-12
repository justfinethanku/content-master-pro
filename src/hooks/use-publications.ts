"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  ProjectPublication,
  ProjectPublicationInsert,
  ProjectPublicationUpdate,
} from "@/lib/types";
import { projectKeys } from "./use-projects";

// Query key factory for publications
export const publicationKeys = {
  all: ["publications"] as const,
  lists: () => [...publicationKeys.all, "list"] as const,
  list: (projectId: string) => [...publicationKeys.lists(), projectId] as const,
  details: () => [...publicationKeys.all, "detail"] as const,
  detail: (id: string) => [...publicationKeys.details(), id] as const,
  byPlatform: (platform: string) =>
    [...publicationKeys.all, "byPlatform", platform] as const,
};

/**
 * Fetch all publications for a project
 */
export function usePublications(projectId: string | null) {
  return useQuery({
    queryKey: publicationKeys.list(projectId ?? ""),
    queryFn: async (): Promise<ProjectPublication[]> => {
      if (!projectId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_project_publications")
        .select("*")
        .eq("project_id", projectId)
        .order("published_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ProjectPublication[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single publication by ID
 */
export function usePublication(id: string | null) {
  return useQuery({
    queryKey: publicationKeys.detail(id ?? ""),
    queryFn: async (): Promise<ProjectPublication | null> => {
      if (!id) return null;

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_project_publications")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data as ProjectPublication;
    },
    enabled: !!id,
  });
}

/**
 * Create a new publication record
 */
export function useCreatePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      publication: ProjectPublicationInsert
    ): Promise<ProjectPublication> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_project_publications")
        .insert(publication)
        .select()
        .single();

      if (error) throw error;
      return data as ProjectPublication;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: publicationKeys.list(data.project_id),
      });
      // Also invalidate project to reflect published status
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(data.project_id),
      });
    },
  });
}

/**
 * Update a publication record
 */
export function useUpdatePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ProjectPublicationUpdate;
    }): Promise<ProjectPublication> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_project_publications")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ProjectPublication;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: publicationKeys.list(data.project_id),
      });
      queryClient.invalidateQueries({ queryKey: publicationKeys.detail(data.id) });
    },
  });
}

/**
 * Delete a publication record
 */
export function useDeletePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      projectId: string;
    }): Promise<void> => {
      const supabase = createClient();

      const { error } = await supabase
        .from("nate_project_publications")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: publicationKeys.list(projectId),
      });
    },
  });
}

/**
 * Fetch all publications by platform (for analytics)
 */
export function usePublicationsByPlatform(platform: string | null) {
  return useQuery({
    queryKey: publicationKeys.byPlatform(platform ?? ""),
    queryFn: async (): Promise<ProjectPublication[]> => {
      if (!platform) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_project_publications")
        .select("*")
        .eq("platform", platform)
        .order("published_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ProjectPublication[];
    },
    enabled: !!platform,
  });
}

/**
 * Record a quick publication (creates publication and optionally updates project status)
 */
export function useRecordPublication() {
  const createPublication = useCreatePublication();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      platform,
      publishedUrl,
      publishedAt,
      updateProjectStatus = true,
    }: {
      projectId: string;
      platform: string;
      publishedUrl?: string;
      publishedAt?: string;
      updateProjectStatus?: boolean;
    }): Promise<ProjectPublication> => {
      const supabase = createClient();

      // Create publication
      const publication = await createPublication.mutateAsync({
        project_id: projectId,
        platform,
        published_url: publishedUrl,
        published_at: publishedAt || new Date().toISOString(),
      });

      // Optionally update project status to published
      if (updateProjectStatus) {
        await supabase
          .from("nate_content_projects")
          .update({ status: "published" })
          .eq("id", projectId);

        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(projectId),
        });
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      }

      return publication;
    },
  });
}
