"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Project,
  ProjectAsset,
  ProjectInsert,
  ProjectAssetInsert,
  ProjectStatus,
} from "@/lib/types";
import { buildAssetId } from "@/lib/asset-config";

// Query key factory
export const deliverableKeys = {
  all: ["deliverables"] as const,
  lists: () => [...deliverableKeys.all, "list"] as const,
  list: (filters: DeliverableFilters) =>
    [...deliverableKeys.lists(), filters] as const,
  details: () => [...deliverableKeys.all, "detail"] as const,
  detail: (id: string) => [...deliverableKeys.details(), id] as const,
  asset: (assetId: string) =>
    [...deliverableKeys.all, "asset", assetId] as const,
};

export interface DeliverableFilters {
  status?: ProjectStatus;
  search?: string;
  sortBy?: "date" | "name";
  sortDir?: "asc" | "desc";
}

export interface DeliverableProject extends Project {
  asset_count: number;
  asset_types: string[];
}

/**
 * Fetch all projects with asset summary data
 */
export function useDeliverables(filters?: DeliverableFilters) {
  return useQuery({
    queryKey: deliverableKeys.list(filters ?? {}),
    queryFn: async (): Promise<DeliverableProject[]> => {
      const supabase = createClient();

      // Fetch projects
      let query = supabase.from("projects").select("*");

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }

      const sortBy = filters?.sortBy ?? "date";
      const sortDir = filters?.sortDir ?? "desc";

      if (sortBy === "date") {
        query = query.order("scheduled_date", {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      } else {
        query = query.order("name", { ascending: sortDir === "asc" });
      }

      query = query.limit(20);

      const { data: projects, error } = await query;
      if (error) throw error;
      if (!projects || projects.length === 0) return [];

      // Fetch asset summaries for all projects in one query
      const projectUuids = projects.map((p) => p.id);
      const { data: assets } = await supabase
        .from("project_assets")
        .select("project_id, asset_type")
        .in("project_id", projectUuids);

      // Build a map of project_id -> { count, types }
      const assetMap = new Map<
        string,
        { count: number; types: Set<string> }
      >();
      if (assets) {
        for (const asset of assets) {
          const existing = assetMap.get(asset.project_id);
          if (existing) {
            existing.count++;
            existing.types.add(asset.asset_type);
          } else {
            assetMap.set(asset.project_id, {
              count: 1,
              types: new Set([asset.asset_type]),
            });
          }
        }
      }

      return projects.map((project) => {
        const summary = assetMap.get(project.id);
        return {
          ...project,
          asset_count: summary?.count ?? 0,
          asset_types: summary ? Array.from(summary.types) : [],
        } as DeliverableProject;
      });
    },
  });
}

/**
 * Fetch a single project with all its assets
 */
export function useDeliverable(projectId: string | null) {
  return useQuery({
    queryKey: deliverableKeys.detail(projectId ?? ""),
    queryFn: async (): Promise<{
      project: Project;
      assets: ProjectAsset[];
    } | null> => {
      if (!projectId) return null;

      const supabase = createClient();

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) {
        if (projectError.code === "PGRST116") return null;
        throw projectError;
      }

      const { data: assets, error: assetsError } = await supabase
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId)
        .order("asset_type", { ascending: true });

      if (assetsError) throw assetsError;

      return {
        project: project as Project,
        assets: (assets || []) as ProjectAsset[],
      };
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single asset by UUID
 */
export function useDeliverableAsset(assetId: string | null) {
  return useQuery({
    queryKey: deliverableKeys.asset(assetId ?? ""),
    queryFn: async (): Promise<ProjectAsset | null> => {
      if (!assetId) return null;

      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .select("*")
        .eq("id", assetId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return data as ProjectAsset;
    },
    enabled: !!assetId,
  });
}

/**
 * Fetch all prompt kit assets for a given project (asset_type = "promptkit")
 */
export function useProjectPromptKits(projectId: string | null) {
  return useQuery({
    queryKey: [...deliverableKeys.detail(projectId ?? ""), "prompt-kits"],
    queryFn: async (): Promise<ProjectAsset[]> => {
      if (!projectId) return [];

      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId)
        .eq("asset_type", "promptkit")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ProjectAsset[];
    },
    enabled: !!projectId,
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

/**
 * Create a new project with an initial asset.
 * Caller provides asset defaults (type, platform, variant) — no config fetch inside mutation.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      content,
      metadata,
      initialAssetType = "post",
      initialPlatform = "substack",
      initialVariant = "main",
    }: {
      name: string;
      content: string;
      metadata?: Record<string, unknown>;
      initialAssetType?: string;
      initialPlatform?: string;
      initialVariant?: string;
    }): Promise<Project> => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const projectId = generateProjectId();

      // Insert project
      const projectInsert: ProjectInsert = {
        project_id: projectId,
        name,
        status: "draft",
        created_by: user.id,
        metadata: metadata ?? {},
      };

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert(projectInsert)
        .select()
        .single();

      if (projectError) throw projectError;

      // Insert initial asset
      const assetId = buildAssetId(projectId, initialAssetType, initialPlatform, initialVariant);
      const assetInsert: ProjectAssetInsert = {
        project_id: project.id,
        asset_id: assetId,
        name,
        asset_type: initialAssetType,
        platform: initialPlatform || null,
        content,
        status: "draft",
        metadata: metadata ?? {},
      };

      const { error: assetError } = await supabase
        .from("project_assets")
        .insert(assetInsert);

      if (assetError) throw assetError;

      return project as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.lists() });
    },
  });
}

/**
 * Create a prompt kit asset for a project
 */
export function useCreatePromptKitAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      content,
    }: {
      projectId: string;
      name: string;
      content: string;
    }): Promise<ProjectAsset> => {
      const supabase = createClient();

      // Look up the project to get its project_id pattern
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("project_id")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      // Count existing prompt kits to generate a unique suffix
      const { count } = await supabase
        .from("project_assets")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("asset_type", "promptkit");

      const suffix = (count ?? 0) + 1;
      const assetId = `${project.project_id}_promptkit_${suffix}`;

      const assetInsert: ProjectAssetInsert = {
        project_id: projectId,
        asset_id: assetId,
        name,
        asset_type: "promptkit",
        content,
        status: "draft",
      };

      const { data, error } = await supabase
        .from("project_assets")
        .insert(assetInsert)
        .select()
        .single();

      if (error) throw error;
      return data as ProjectAsset;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: [
          ...deliverableKeys.detail(variables.projectId),
          "prompt-kits",
        ],
      });
    },
  });
}

// Calendar-specific types and hooks

export interface CalendarProject extends Project {
  content_summary: string | null;
  asset_types: string[];
}

export interface CalendarFilters {
  startDate: string;
  endDate: string;
  status?: ProjectStatus;
}

/**
 * Fetch projects for calendar view with content summaries
 */
export function useCalendarProjects(filters: CalendarFilters) {
  return useQuery({
    queryKey: [...deliverableKeys.lists(), "calendar", filters] as const,
    queryFn: async (): Promise<CalendarProject[]> => {
      const supabase = createClient();

      let query = supabase
        .from("projects")
        .select("*")
        .gte("scheduled_date", filters.startDate)
        .lte("scheduled_date", filters.endDate)
        .neq("status", "idea");

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      query = query.order("scheduled_date", { ascending: true });

      const { data: projects, error } = await query;
      if (error) throw error;
      if (!projects || projects.length === 0) return [];

      // Fetch assets for each project (content summary + asset types)
      const projectUuids = projects.map((p) => p.id);
      const { data: assets } = await supabase
        .from("project_assets")
        .select("project_id, asset_type, content")
        .in("project_id", projectUuids)
        .order("created_at", { ascending: true });

      // Build maps: project_id -> first post content, project_id -> asset types
      const summaryMap = new Map<string, string>();
      const assetTypeMap = new Map<string, Set<string>>();
      if (assets) {
        for (const asset of assets) {
          // Content summary: use first post asset's content
          if (asset.asset_type === "post" && !summaryMap.has(asset.project_id) && asset.content) {
            summaryMap.set(asset.project_id, asset.content);
          }
          // Collect all asset types
          if (!assetTypeMap.has(asset.project_id)) {
            assetTypeMap.set(asset.project_id, new Set());
          }
          assetTypeMap.get(asset.project_id)!.add(asset.asset_type);
        }
      }

      return projects.map((project) => ({
        ...project,
        content_summary: summaryMap.get(project.id) ?? null,
        asset_types: assetTypeMap.has(project.id)
          ? Array.from(assetTypeMap.get(project.id)!)
          : [],
      })) as CalendarProject[];
    },
  });
}

/**
 * Update a project's scheduled_date (for drag-and-drop rescheduling)
 * Optionally updates status (e.g. auto-set "scheduled" when moving to future)
 */
export function useUpdateProjectSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      scheduled_date,
      status,
    }: {
      id: string;
      scheduled_date: string | null;
      status?: ProjectStatus;
    }): Promise<Project> => {
      const supabase = createClient();

      const payload: { scheduled_date: string | null; status?: ProjectStatus } = {
        scheduled_date,
      };
      if (status) {
        payload.status = status;
      }

      const { data, error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.lists() });
    },
  });
}

/**
 * Fetch unscheduled projects (no scheduled_date) for the backlog panel
 */
export function useUnscheduledProjects() {
  return useQuery({
    queryKey: [...deliverableKeys.lists(), "unscheduled"] as const,
    queryFn: async (): Promise<CalendarProject[]> => {
      const supabase = createClient();

      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .is("scheduled_date", null)
        .neq("status", "idea")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!projects || projects.length === 0) return [];

      // Fetch assets for content summary + types
      const projectUuids = projects.map((p) => p.id);
      const { data: assets } = await supabase
        .from("project_assets")
        .select("project_id, asset_type, content")
        .in("project_id", projectUuids)
        .order("created_at", { ascending: true });

      const summaryMap = new Map<string, string>();
      const assetTypeMap = new Map<string, Set<string>>();
      if (assets) {
        for (const asset of assets) {
          if (
            asset.asset_type === "post" &&
            !summaryMap.has(asset.project_id) &&
            asset.content
          ) {
            summaryMap.set(asset.project_id, asset.content);
          }
          if (!assetTypeMap.has(asset.project_id)) {
            assetTypeMap.set(asset.project_id, new Set());
          }
          assetTypeMap.get(asset.project_id)!.add(asset.asset_type);
        }
      }

      return projects.map((project) => ({
        ...project,
        content_summary: summaryMap.get(project.id) ?? null,
        asset_types: assetTypeMap.has(project.id)
          ? Array.from(assetTypeMap.get(project.id)!)
          : [],
      })) as CalendarProject[];
    },
  });
}

/**
 * Delete a project (CASCADE handles assets + versions)
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const supabase = createClient();

      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.all });
    },
  });
}

/**
 * Update an asset's name
 */
export function useUpdateAssetName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      projectId,
    }: {
      id: string;
      name: string;
      projectId: string;
    }): Promise<ProjectAsset> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("project_assets")
        .update({ name })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ProjectAsset;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.asset(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(variables.projectId),
      });
    },
  });
}

/**
 * Update a project's published URL (stored in metadata.url)
 */
export function useUpdateProjectUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      url,
    }: {
      id: string;
      url: string;
    }): Promise<Project> => {
      const supabase = createClient();

      // Read current metadata so we merge, not overwrite
      const { data: existing, error: fetchError } = await supabase
        .from("projects")
        .select("metadata")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const currentMeta =
        (existing.metadata as Record<string, unknown>) || {};
      const updatedMeta = { ...currentMeta, url };

      const { data, error } = await supabase
        .from("projects")
        .update({ metadata: updatedMeta })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(data.id),
      });
    },
  });
}

/**
 * Update a project's name
 */
export function useUpdateProjectName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
    }: {
      id: string;
      name: string;
    }): Promise<Project> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("projects")
        .update({ name })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(data.id),
      });
    },
  });
}

/**
 * Update a project's status
 */
export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ProjectStatus;
    }): Promise<Project> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("projects")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: deliverableKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: deliverableKeys.detail(data.id),
      });
    },
  });
}
