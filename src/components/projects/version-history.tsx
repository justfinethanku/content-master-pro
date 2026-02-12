"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssetVersions, useRestoreVersion } from "@/hooks/use-asset-versions";
import type { AssetVersion } from "@/lib/types";
import { History, RotateCcw, Loader2, Check, Eye } from "lucide-react";

interface VersionHistoryProps {
  assetId: string;
  currentVersion: number;
  onRestore?: (version: AssetVersion) => void;
  onView?: (version: AssetVersion) => void;
  viewingVersionId?: string | null;
  disabled?: boolean;
}

export function VersionHistory({
  assetId,
  currentVersion,
  onRestore,
  onView,
  viewingVersionId,
  disabled = false,
}: VersionHistoryProps) {
  const { data: versions = [], isLoading } = useAssetVersions(assetId);
  const restoreVersion = useRestoreVersion();

  const handleRestore = async (version: AssetVersion) => {
    try {
      const newVersion = await restoreVersion.mutateAsync({
        assetId,
        versionId: version.id,
      });
      onRestore?.(newVersion);
    } catch (error) {
      console.error("Failed to restore version:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    }
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No version history yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Save your changes to create the first version
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Version History
        </span>
        <span className="text-xs text-muted-foreground">
          ({versions.length})
        </span>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-1 pr-4">
          {versions.map((version) => {
            const isCurrent = version.version_number === currentVersion;
            const isViewing = viewingVersionId === version.id;

            return (
              <div
                key={version.id}
                className={`flex items-center justify-between p-2 rounded-md ${
                  isViewing
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : isCurrent
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      v{version.version_number}
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Check className="h-3 w-3" />
                        Current
                      </span>
                    )}
                    {isViewing && !isCurrent && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Eye className="h-3 w-3" />
                        Viewing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(version.created_at)}
                  </p>
                </div>

                {!isCurrent && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={isViewing ? "secondary" : "ghost"}
                      onClick={() => onView?.(version)}
                      className="h-7 px-2"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRestore(version)}
                      disabled={disabled || restoreVersion.isPending}
                      className="h-7 px-2"
                    >
                      {restoreVersion.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
