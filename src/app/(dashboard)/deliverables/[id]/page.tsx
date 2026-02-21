"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeliverable, useUpdateProjectName, useUpdateProjectUrl, useUpdateProjectStatus, useDeleteProject } from "@/hooks/use-deliverables";
import { useCreateAsset } from "@/hooks/use-assets";
import { useAssetConfig } from "@/hooks/use-asset-config";
import { buildAssetId, getActiveTypes, getActivePlatforms } from "@/lib/asset-config";
import type { ProjectAsset, ProjectStatus, ProjectAssetInsert } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import PostMarkdown from "@/components/post-markdown";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  review: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  scheduled: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  published: "bg-green-500/15 text-green-700 dark:text-green-400",
  archived: "bg-muted text-muted-foreground",
  ready: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  final: "bg-green-500/15 text-green-700 dark:text-green-400",
};

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function AssetCard({
  asset,
  projectId,
}: {
  asset: ProjectAsset;
  projectId: string;
}) {
  const meta = asset.metadata as Record<string, unknown>;
  const wordCount = meta?.word_count as number | undefined;

  const isClickable = asset.content !== null;
  const cardClass = cn(
    "rounded-lg border border-border bg-card p-3 sm:p-4 space-y-2 block overflow-hidden",
    isClickable &&
      "hover:border-primary/40 hover:bg-muted/50 transition-colors cursor-pointer"
  );

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <h3 className="font-medium text-sm text-foreground line-clamp-2 wrap-break-word">
            {asset.name}
          </h3>
        </div>
        <Badge
          variant="secondary"
          className={cn("shrink-0 text-xs", STATUS_COLORS[asset.status])}
        >
          {asset.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {asset.asset_type}
        </Badge>

        {asset.platform && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {asset.platform}
          </Badge>
        )}

        {wordCount && (
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {wordCount.toLocaleString()} words
          </span>
        )}

        <span>v{asset.version}</span>
      </div>

      {asset.published_url && (
        <a
          href={asset.published_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View published
        </a>
      )}

      {asset.content && (
        <div className="pt-1 border-t border-border text-xs line-clamp-3 overflow-hidden wrap-break-word **:text-xs! **:leading-snug! **:mb-0! **:mt-0! **:p-0!">
          <PostMarkdown content={asset.content.slice(0, 500)} />
        </div>
      )}
    </>
  );

  if (isClickable) {
    return (
      <Link href={`/deliverables/${projectId}/assets/${asset.id}`} className={cardClass}>
        {cardContent}
      </Link>
    );
  }

  return <div className={cardClass}>{cardContent}</div>;
}

function InlineTitle({
  name,
  projectId,
}: {
  name: string;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateName = useUpdateProjectName();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const save = useCallback(() => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setEditValue(name);
      return;
    }
    updateName.mutate(
      { id: projectId, name: trimmed },
      {
        onSuccess: () => {
          setEditing(false);
          showToast("Title updated");
        },
        onError: () => showToast("Failed to update title"),
      }
    );
  }, [editValue, name, projectId, updateName]);

  if (editing) {
    return (
      <>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setEditing(false);
              setEditValue(name);
            }
          }}
          className="text-xl sm:text-2xl font-bold text-foreground bg-transparent border-b-2 border-primary outline-none w-full"
        />
        {toast && (
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-foreground text-background px-4 py-2 rounded-lg text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setEditing(true)}
        className="group/title flex items-center gap-2 text-left"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{name}</h1>
        <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
      </button>
      {toast && (
        <div className="fixed bottom-6 right-6 bg-foreground text-background px-4 py-2 rounded-lg text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </>
  );
}

function InlineUrl({
  url,
  projectId,
}: {
  url: string | undefined;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(url ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateUrl = useUpdateProjectUrl();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const save = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed === (url ?? "")) {
      setEditing(false);
      return;
    }
    if (!trimmed) {
      setEditing(false);
      setEditValue(url ?? "");
      return;
    }
    updateUrl.mutate(
      { id: projectId, url: trimmed },
      {
        onSuccess: () => {
          setEditing(false);
          showToast("URL updated");
        },
        onError: () => showToast("Failed to update URL"),
      }
    );
  }, [editValue, url, projectId, updateUrl]);

  if (editing) {
    return (
      <>
        <div className="flex items-center gap-1">
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setEditing(false);
                setEditValue(url ?? "");
              }
            }}
            placeholder="https://natesnewsletter.substack.com/p/..."
            className="text-sm bg-transparent border-b border-primary outline-none w-full max-w-md text-foreground"
          />
        </div>
        {toast && (
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-foreground text-background px-4 py-2 rounded-lg text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {toast}
          </div>
        )}
      </>
    );
  }

  if (url) {
    return (
      <>
        <span className="group/url inline-flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            View published
          </a>
          <button
            onClick={() => { setEditValue(url ?? ""); setEditing(true); }}
            className="p-0.5 text-muted-foreground opacity-0 group-hover/url:opacity-100 transition-opacity"
            title="Edit URL"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </span>
        {toast && (
          <div className="fixed bottom-6 right-6 bg-foreground text-background px-4 py-2 rounded-lg text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <button
      onClick={() => { setEditValue(""); setEditing(true); }}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Pencil className="h-3 w-3" />
      <span className="text-xs">Add Substack URL</span>
    </button>
  );
}

function AddAssetDialog({
  projectId,
  projectHumanId,
  existingAssets,
}: {
  projectId: string;
  projectHumanId: string;
  existingAssets: ProjectAsset[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("");
  const [platform, setPlatform] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { config: assetConfig } = useAssetConfig();
  const createAsset = useCreateAsset();

  const activeTypes = getActiveTypes(assetConfig);
  const activePlatforms = getActivePlatforms(assetConfig);

  const selectedType = assetConfig.types.find((t) => t.key === assetType);
  const showPlatform = selectedType?.supports_platform ?? false;

  // Set defaults from config when dialog opens
  useEffect(() => {
    if (open) {
      const defaults = assetConfig.defaults.add_asset_dialog;
      setAssetType(defaults.asset_type);
      setPlatform(defaults.platform);
      setName("");
      setError(null);
    }
  }, [open, assetConfig.defaults.add_asset_dialog]);

  // Preview the asset_id
  const previewAssetId = assetType
    ? buildAssetId(projectHumanId, assetType, showPlatform ? platform : null, "main")
    : "";

  async function handleSubmit() {
    if (!name.trim() || !assetType) return;
    setError(null);

    const effectivePlatform = showPlatform ? platform || null : null;

    // Find a unique variant by checking existing assets
    let variant = "main";
    const existingIds = new Set(existingAssets.map((a) => a.asset_id));
    let candidateId = buildAssetId(projectHumanId, assetType, effectivePlatform, variant);

    if (existingIds.has(candidateId)) {
      // Increment numeric variant until we find a gap
      let n = 2;
      do {
        variant = String(n).padStart(2, "0");
        candidateId = buildAssetId(projectHumanId, assetType, effectivePlatform, variant);
        n++;
      } while (existingIds.has(candidateId) && n < 100);
    }

    const insert: ProjectAssetInsert = {
      project_id: projectId,
      asset_id: candidateId,
      name: name.trim(),
      asset_type: assetType,
      platform: effectivePlatform,
      variant,
      status: "draft",
      metadata: {},
    };

    createAsset.mutate(insert, {
      onSuccess: () => {
        setOpen(false);
      },
      onError: (err) => {
        const msg = (err as Error).message;
        // Handle DB unique constraint violation with retry
        if (msg.includes("23505") || msg.includes("duplicate")) {
          const retryId = `${candidateId}_${Date.now().toString(36)}`;
          createAsset.mutate(
            { ...insert, asset_id: retryId },
            {
              onSuccess: () => setOpen(false),
              onError: (retryErr) =>
                setError(`Failed to add asset: ${(retryErr as Error).message}`),
            }
          );
        } else {
          setError(`Failed to add asset: ${msg}`);
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add asset</DialogTitle>
          <DialogDescription>
            Add a new asset to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YouTube transcript"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && assetType) handleSubmit();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {activeTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showPlatform && (
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {activePlatforms.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {previewAssetId && (
            <p className="text-xs text-muted-foreground font-mono">
              ID: {previewAssetId}
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !assetType || createAsset.isPending}
          >
            {createAsset.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Add asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DeliverableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error } = useDeliverable(id);
  const deleteProject = useDeleteProject();
  const updateStatus = useUpdateProjectStatus();
  const [deleting, setDeleting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load project: {(error as Error).message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="mb-3 h-10 w-10" />
        <p>Project not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/deliverables")}>
          Back to deliverables
        </Button>
      </div>
    );
  }

  const { project, assets } = data;
  const meta = project.metadata as Record<string, unknown>;
  const subtitle = meta?.subtitle as string | undefined;
  const publishedUrl = meta?.url as string | undefined;
  const image = meta?.image as string | undefined;
  const author = meta?.author as string | undefined;
  const tags = meta?.tags as string[] | undefined;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Project header */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="space-y-1 min-w-0">
            <InlineTitle name={project.name} projectId={project.id} />
            {subtitle && (
              <p className="text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start">
            <Select
              value={project.status}
              onValueChange={(value) =>
                updateStatus.mutate({ id: project.id, status: value as ProjectStatus })
              }
            >
              <SelectTrigger
                className={cn(
                  "h-7 w-auto gap-1.5 rounded-full border-0 px-2.5 text-xs font-medium",
                  STATUS_COLORS[project.status]
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-destructive transition rounded-md"
                  title="Delete project"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{project.name}</strong> and all its assets and versions. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setDeleting(true);
                      deleteProject.mutate(project.id, {
                        onSuccess: () => router.push("/deliverables"),
                        onError: () => setDeleting(false),
                      });
                    }}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
          {project.scheduled_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(project.scheduled_date + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </span>
          )}

          {author && <span>by {author}</span>}

          <InlineUrl url={publishedUrl} projectId={project.id} />
        </div>

        {tags && tags.length > 0 && (
          <div className="flex gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Assets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Assets ({assets.length})
          </h2>
          <AddAssetDialog
            projectId={project.id}
            projectHumanId={project.project_id}
            existingAssets={assets}
          />
        </div>

        {assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No assets yet
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} projectId={project.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
