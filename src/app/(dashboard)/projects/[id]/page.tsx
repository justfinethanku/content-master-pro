"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AssetCard } from "@/components/projects/asset-card";
import { PublicationModal } from "@/components/projects/publication-modal";
import { STATUS_CONFIG } from "@/components/calendar/project-card";
import {
  useProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/use-projects";
import { useAssets, useCreateAsset } from "@/hooks/use-assets";
import { usePublications } from "@/hooks/use-publications";
import type { ProjectStatus, AssetType } from "@/lib/types";
import {
  ArrowLeft,
  CalendarIcon,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Youtube,
  Video,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Platform icons
const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  tiktok: Video,
  substack: FileText,
};

// Status workflow order
const STATUS_ORDER: ProjectStatus[] = ["draft", "review", "scheduled", "published"];

// Asset types to create
const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "post", label: "Main Post" },
  { value: "transcript_youtube", label: "YouTube Transcript" },
  { value: "description_youtube", label: "YouTube Description" },
  { value: "transcript_tiktok", label: "TikTok Transcript" },
  { value: "description_tiktok", label: "TikTok Description" },
  { value: "prompts", label: "Prompt Kit" },
  { value: "guide", label: "Guide" },
  { value: "post_linkedin", label: "LinkedIn Post" },
  { value: "post_substack", label: "Substack Post" },
];

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: assets = [], isLoading: assetsLoading } = useAssets(id);
  const { data: publications = [] } = usePublications(id);

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createAsset = useCreateAsset();

  const [notes, setNotes] = useState<string | null>(null);
  const [newAssetType, setNewAssetType] = useState<AssetType | "">("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Initialize notes from project when loaded
  if (project && notes === null) {
    setNotes(project.notes || "");
  }

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return;
    await updateProject.mutateAsync({
      id: project.id,
      updates: { status: newStatus },
    });
  };

  const handleNotesBlur = async () => {
    if (!project || notes === project.notes) return;
    await updateProject.mutateAsync({
      id: project.id,
      updates: { notes: notes || null },
    });
  };

  const handleDateChange = async (date: Date | undefined) => {
    if (!project) return;

    const newScheduledDate = date
      ? date.toISOString().split("T")[0]
      : null;

    // Don't update if same date
    const currentDate = project.scheduled_date?.split("T")[0];
    if (currentDate === newScheduledDate) {
      setDatePickerOpen(false);
      return;
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        updates: { scheduled_date: newScheduledDate },
      });
      setDatePickerOpen(false);
      toast.success(
        newScheduledDate
          ? `Scheduled for ${new Date(newScheduledDate).toLocaleDateString()}`
          : "Removed scheduled date"
      );
    } catch {
      toast.error("Failed to update scheduled date");
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    await deleteProject.mutateAsync(project.id);
    router.push("/calendar");
  };

  const handleCreateAsset = async () => {
    if (!newAssetType || !project) return;
    await createAsset.mutateAsync({
      project_id: project.id,
      asset_type: newAssetType,
    });
    setNewAssetType("");
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground">
          Project not found
        </h2>
        <p className="text-muted-foreground mt-2">
          The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button asChild className="mt-4">
          <Link href="/calendar">Back to Calendar</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[project.status];
  const currentStatusIndex = STATUS_ORDER.indexOf(project.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/calendar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {project.title}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1 hover:text-foreground transition-colors rounded-md px-2 py-1 -mx-2 -my-1",
                      "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      !project.scheduled_date && "text-muted-foreground/70"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {project.scheduled_date
                      ? new Date(project.scheduled_date).toLocaleDateString()
                      : "Set date..."}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={
                      project.scheduled_date
                        ? new Date(project.scheduled_date)
                        : undefined
                    }
                    onSelect={handleDateChange}
                    initialFocus
                  />
                  {project.scheduled_date && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={() => handleDateChange(undefined)}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {project.video_runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {project.video_runtime}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
                <span className={`text-sm font-medium ${statusConfig.textClass}`}>
                  {statusConfig.label}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{project.title}&quot; and all its
                  assets. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status Workflow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Status Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {STATUS_ORDER.map((status, index) => {
              const config = STATUS_CONFIG[status];
              const isCurrentOrPast = index <= currentStatusIndex;
              const isCurrent = status === project.status;

              return (
                <div key={status} className="flex items-center gap-2">
                  <Button
                    variant={isCurrent ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                    disabled={updateProject.isPending}
                    className={isCurrent ? "" : isCurrentOrPast ? "opacity-70" : ""}
                  >
                    {config.label}
                  </Button>
                  {index < STATUS_ORDER.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Assets</h2>
            <div className="flex items-center gap-2">
              <Select
                value={newAssetType}
                onValueChange={(v) => setNewAssetType(v as AssetType)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleCreateAsset}
                disabled={!newAssetType || createAsset.isPending}
              >
                {createAsset.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {assetsLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No assets yet. Add your first asset above.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  projectId={project.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Publications
                </CardTitle>
                <PublicationModal projectId={project.id} />
              </div>
            </CardHeader>
            <CardContent>
              {publications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not published yet
                </p>
              ) : (
                <div className="space-y-3">
                  {publications.map((pub) => {
                    const Icon =
                      PLATFORM_ICONS[pub.platform.toLowerCase()] || FileText;
                    return (
                      <div
                        key={pub.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {pub.platform}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(pub.published_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {pub.published_url && (
                          <Button asChild variant="ghost" size="icon">
                            <a
                              href={pub.published_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target Platforms */}
          {project.target_platforms && project.target_platforms.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Target Platforms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {project.target_platforms.map((platform) => {
                    const Icon =
                      PLATFORM_ICONS[platform.toLowerCase()] || FileText;
                    return (
                      <Badge
                        key={platform}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        <span className="capitalize">{platform}</span>
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this project..."
                value={notes || ""}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
