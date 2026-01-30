"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useDeleteAsset } from "@/hooks/use-assets";
import { toast } from "sonner";
import type { ProjectAsset, AssetStatus } from "@/lib/types";
import {
  FileText,
  Video,
  Image,
  FileCode,
  Lock,
  Edit,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Asset type icons
const ASSET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  post: FileText,
  transcript_youtube: Video,
  transcript_tiktok: Video,
  description_youtube: FileText,
  description_tiktok: FileText,
  prompts: FileCode,
  guide: FileText,
  post_linkedin: FileText,
  post_substack: FileText,
  image_substack: Image,
};

// Asset type labels
const ASSET_TYPE_LABELS: Record<string, string> = {
  post: "Main Post",
  transcript_youtube: "YouTube Transcript",
  transcript_tiktok: "TikTok Transcript",
  description_youtube: "YouTube Description",
  description_tiktok: "TikTok Description",
  prompts: "Prompt Kit",
  guide: "Guide",
  post_linkedin: "LinkedIn Post",
  post_substack: "Substack Post",
  image_substack: "Substack Image",
};

// Status configuration
const STATUS_CONFIG: Record<AssetStatus, { label: string; bgClass: string }> = {
  draft: {
    label: "Draft",
    bgClass: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  ready: {
    label: "Ready",
    bgClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  final: {
    label: "Final",
    bgClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
};

interface AssetCardProps {
  asset: ProjectAsset;
  projectId: string;
  currentUserId?: string;
}

export function AssetCard({ asset, projectId, currentUserId }: AssetCardProps) {
  const deleteAsset = useDeleteAsset();
  const Icon = ASSET_TYPE_ICONS[asset.asset_type] || FileText;
  const typeLabel = ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type;
  const statusConfig = STATUS_CONFIG[asset.status];

  const isLocked = !!asset.locked_by;
  const isLockedByMe = asset.locked_by === currentUserId;

  // Calculate lock staleness - locks older than 30 minutes are considered stale
  const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const isLockStale = asset.locked_at
    ? new Date().getTime() - new Date(asset.locked_at).getTime() > LOCK_TIMEOUT_MS
    : false;

  const handleDelete = async () => {
    try {
      await deleteAsset.mutateAsync({ id: asset.id, projectId });
      toast.success(`Deleted ${typeLabel}`);
    } catch {
      toast.error("Failed to delete asset");
    }
  };

  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">
                {asset.title || typeLabel}
              </p>
              <p className="text-xs text-muted-foreground">{typeLabel}</p>
            </div>
          </div>
          <Badge variant="secondary" className={statusConfig.bgClass}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Lock indicator */}
        {isLocked && !isLockStale && (
          <div
            className={`flex items-center gap-1 text-xs mb-2 ${
              isLockedByMe
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            <Lock className="h-3 w-3" />
            <span>
              {isLockedByMe
                ? "You are editing"
                : `Locked by another user`}
            </span>
          </div>
        )}

        {/* Content preview */}
        {asset.content && (
          <div className="max-h-48 overflow-y-auto mb-3 pr-1 border border-border rounded-md p-2 bg-muted/30">
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs *:text-muted-foreground [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_code]:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {asset.content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Version info */}
        <p className="text-xs text-muted-foreground mb-3">
          Version {asset.current_version}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href={`/projects/${projectId}/assets/${asset.id}`}>
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Link>
          </Button>

          {asset.external_url && (
            <Button asChild size="sm" variant="ghost">
              <a
                href={asset.external_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={isLocked && !isLockStale}
              >
                {deleteAsset.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {typeLabel}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this asset and all its versions.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export { STATUS_CONFIG as ASSET_STATUS_CONFIG, ASSET_TYPE_LABELS };
