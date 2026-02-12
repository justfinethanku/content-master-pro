"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  ContentProject,
  ContentProjectInsert,
  ContentProjectUpdate,
  ContentProjectWithSummary,
  ProjectStatus,
} from "@/lib/types";

// Query key factory for projects
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  byDate: (startDate: string, endDate: string) =>
    [...projectKeys.all, "byDate", startDate, endDate] as const,
};

// Filter options for projects
export interface ProjectFilters {
  status?: ProjectStatus;
  platform?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetch all projects with optional filters
 */
export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters ?? {}),
    queryFn: async (): Promise<ContentProject[]> => {
      const supabase = createClient();

      let query = supabase
        .from("nate_content_projects")
        .select("*")
        .order("scheduled_date", { ascending: true, nullsFirst: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.platform) {
        query = query.contains("target_platforms", [filters.platform]);
      }

      if (filters?.startDate) {
        query = query.gte("scheduled_date", filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte("scheduled_date", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ContentProject[];
    },
  });
}

/**
 * Fetch projects within a date range (for calendar view)
 */
export function useProjectsByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: projectKeys.byDate(startDate, endDate),
    queryFn: async (): Promise<ContentProject[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_content_projects")
        .select("*")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return (data || []) as ContentProject[];
    },
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Fetch a single project by ID
 */
export function useProject(id: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ""),
    queryFn: async (): Promise<ContentProject | null> => {
      if (!id) return null;

      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_content_projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      return data as ContentProject;
    },
    enabled: !!id,
  });
}

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      project: Omit<ContentProjectInsert, "created_by">
    ): Promise<ContentProject> => {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("nate_content_projects")
        .insert({ ...project, created_by: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as ContentProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: ContentProjectUpdate;
    }): Promise<ContentProject> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("nate_content_projects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ContentProject;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(data.id) });
    },
  });
}

/**
 * Delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const supabase = createClient();

      const { error } = await supabase
        .from("nate_content_projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Update project status (convenience hook for status workflow)
 */
export function useUpdateProjectStatus() {
  const updateProject = useUpdateProject();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ProjectStatus;
    }): Promise<ContentProject> => {
      return updateProject.mutateAsync({
        id,
        updates: { status },
      });
    },
  });
}

/**
 * Generate a project_id in yyyymmdd_xxx format
 */
export function generateProjectId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 5);
  return `${year}${month}${day}_${random}`;
}

// Asset types that contain main content (for summary extraction)
// Ordered by priority: main post drafts first, then outlines
const CONTENT_ASSET_TYPES = [
  "post",
  "post_substack",
  "post_linkedin",
  "outline",
  "guide",
];

/**
 * Fetch projects with content summary from related assets (for calendar gallery view)
 */
export function useProjectsWithSummary(filters?: ProjectFilters) {
  return useQuery({
    queryKey: [...projectKeys.list(filters ?? {}), "withSummary"],
    queryFn: async (): Promise<ContentProjectWithSummary[]> => {
      const supabase = createClient();

      // First fetch projects
      let query = supabase
        .from("nate_content_projects")
        .select("*")
        .order("scheduled_date", { ascending: true, nullsFirst: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.platform) {
        query = query.contains("target_platforms", [filters.platform]);
      }
      if (filters?.startDate) {
        query = query.gte("scheduled_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("scheduled_date", filters.endDate);
      }

      const { data: projects, error } = await query;
      if (error) throw error;
      if (!projects || projects.length === 0) return [];

      // Fetch assets for all projects in one query
      const projectIds = projects.map((p) => p.id);
      const { data: assets } = await supabase
        .from("nate_project_assets")
        .select("project_id, asset_type, content")
        .in("project_id", projectIds)
        .in("asset_type", CONTENT_ASSET_TYPES);

      // Create a map of project_id to best content asset (prioritized by type)
      const assetMap = new Map<string, { content: string; priority: number }>();
      if (assets) {
        for (const asset of assets) {
          if (!asset.content) continue;

          const priority = CONTENT_ASSET_TYPES.indexOf(asset.asset_type);
          const existing = assetMap.get(asset.project_id);

          // Use this asset if no existing one, or if it has higher priority (lower index)
          if (!existing || priority < existing.priority) {
            assetMap.set(asset.project_id, { content: asset.content, priority });
          }
        }
      }

      // Merge projects with their content summary
      return projects.map((project) => ({
        ...project,
        content_summary: assetMap.get(project.id)?.content || null,
      })) as ContentProjectWithSummary[];
    },
  });
}
