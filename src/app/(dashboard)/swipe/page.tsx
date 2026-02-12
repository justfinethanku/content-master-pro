"use client";

import { useState } from "react";
import { useUnreadItems } from "@/hooks/use-changelog-items";
import { CardStack } from "@/components/swipe/card-stack";
import { IOSInstallPrompt } from "@/components/ios-install-prompt";
import { Loader2, RefreshCw, Inbox, Download, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type IngestResult = {
  type: "success" | "error";
  message: string;
} | null;

export default function SwipePage() {
  const { data: items, isLoading, error, refetch, isRefetching } = useUnreadItems();
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult>(null);

  const handleFetchUpdates = async () => {
    setIsIngesting(true);
    setIngestResult(null);
    try {
      const response = await fetch("/api/cron/ingest-changelogs");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch updates");
      }

      setIngestResult({
        type: "success",
        message: `Found ${data.summary.totalFound} updates, added ${data.summary.totalInserted} new items`,
      });
      refetch();
    } catch (err) {
      setIngestResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to fetch updates",
      });
    } finally {
      setIsIngesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center px-6">
        <p className="text-destructive mb-4">Failed to load items</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-10rem)] max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">News Feed</h1>
          <p className="text-sm text-muted-foreground">
            {items?.length || 0} items to review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchUpdates}
            disabled={isIngesting}
          >
            {isIngesting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Fetch Updates
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Ingest Result Banner */}
      {ingestResult && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            ingestResult.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {ingestResult.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{ingestResult.message}</span>
          <button
            onClick={() => setIngestResult(null)}
            className="text-current opacity-50 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Card Stack */}
      {items && items.length > 0 ? (
        <div className="relative h-[calc(100%-5rem)]">
          <CardStack items={items} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[calc(100%-5rem)] text-center">
          <Inbox className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium text-foreground mb-2">
            All caught up
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            No new updates to review
          </p>
          <div className="flex gap-2">
            <Button onClick={handleFetchUpdates} disabled={isIngesting}>
              {isIngesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Fetch Updates
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* iOS Install Prompt */}
      <IOSInstallPrompt />
    </div>
  );
}
