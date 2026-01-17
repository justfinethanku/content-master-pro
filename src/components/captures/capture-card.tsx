"use client";

import { useState } from "react";
import { ExternalLink, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Capture } from "@/hooks/use-captures";

interface CaptureCardProps {
  capture: Capture;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export function CaptureCard({
  capture,
  onDelete,
  isDeleting,
}: CaptureCardProps) {
  const [expanded, setExpanded] = useState(false);

  const impactColors = {
    minor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    major: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    breaking: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const item = capture.changelog_item;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {item.source_name}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${impactColors[item.impact_level]}`}
            >
              {item.impact_level}
            </Badge>
          </div>
          <h3 className="font-medium text-foreground leading-tight">
            {item.headline}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete capture?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this capture. The original
                  changelog item will remain in the archive.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(capture.id)}
                  disabled={isDeleting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* User commentary */}
      <div className="bg-muted/50 rounded-md p-3">
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {capture.user_commentary}
        </p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm text-muted-foreground">{item.summary}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Captured{" "}
              {new Date(capture.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              View source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Footer (when collapsed) */}
      {!expanded && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {new Date(capture.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
