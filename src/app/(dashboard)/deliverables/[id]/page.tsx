"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeliverable, useUpdateProjectName } from "@/hooks/use-deliverables";
import type { ProjectAsset } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PostMarkdown from "@/components/post-markdown";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Package,
  Pencil,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  review: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  scheduled: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  published: "bg-green-500/15 text-green-700 dark:text-green-400",
  archived: "bg-muted text-muted-foreground",
  ready: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  final: "bg-green-500/15 text-green-700 dark:text-green-400",
};

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
    "rounded-lg border border-border bg-card p-4 space-y-2 block",
    isClickable &&
      "hover:border-primary/40 hover:bg-muted/50 transition-colors cursor-pointer"
  );

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground truncate">
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
        <div className="pt-1 border-t border-border text-xs line-clamp-3 [&_*]:!text-xs [&_*]:!leading-snug [&_*]:!mb-0 [&_*]:!mt-0 [&_*]:!p-0">
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

export default function DeliverableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error } = useDeliverable(id);

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
      <Link
        href="/deliverables"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to deliverables
      </Link>

      {/* Project header */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="space-y-1 min-w-0">
            <InlineTitle name={project.name} projectId={project.id} />
            {subtitle && (
              <p className="text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn("shrink-0 self-start", STATUS_COLORS[project.status])}
          >
            {project.status.replace("_", " ")}
          </Badge>
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

          {publishedUrl && (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              View published
            </a>
          )}
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
        <h2 className="text-lg font-semibold text-foreground">
          Assets ({assets.length})
        </h2>

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
