"use client";

import Link from "next/link";
import type { CalendarProject } from "@/hooks/use-deliverables";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Status configuration
const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  draft: {
    label: "Draft",
    dotClass: "bg-stone-400",
    textClass: "text-stone-500 dark:text-stone-500",
  },
  in_progress: {
    label: "In Progress",
    dotClass: "bg-blue-400",
    textClass: "text-blue-600 dark:text-blue-500",
  },
  review: {
    label: "Review",
    dotClass: "bg-amber-400",
    textClass: "text-amber-600 dark:text-amber-500",
  },
  scheduled: {
    label: "Scheduled",
    dotClass: "bg-yellow-400",
    textClass: "text-yellow-600 dark:text-yellow-500",
  },
  published: {
    label: "Published",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-600 dark:text-emerald-500",
  },
  archived: {
    label: "Archived",
    dotClass: "bg-stone-300",
    textClass: "text-stone-400 dark:text-stone-600",
  },
};

// Short labels for asset type pills on calendar cards
const ASSET_SHORT_LABELS: Record<string, string> = {
  post: "Post",
  transcript_youtube: "YT Script",
  transcript_tiktok: "TT Script",
  description_youtube: "YT Desc",
  description_tiktok: "TT Desc",
  prompts: "Prompts",
  promptkit: "Prompt Kit",
  guide: "Guide",
  post_linkedin: "LinkedIn",
  post_substack: "Substack",
  image_substack: "Image",
};

// Parse a date string as local time (avoids UTC shift for date-only strings like "2025-02-15")
function parseLocalDate(dateString: string): Date {
  // If it's a bare date (no "T"), treat as local midnight
  if (!dateString.includes("T")) {
    return new Date(dateString + "T00:00:00");
  }
  return new Date(dateString);
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return "Unscheduled";
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Format date for empty card
function formatDateFull(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Extract first N words from text
function truncateWords(text: string | null | undefined, wordCount: number): string {
  if (!text) return "";
  // Strip HTML tags if present
  const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = stripped.split(/\s+/);
  if (words.length <= wordCount) return stripped;
  return words.slice(0, wordCount).join(" ") + "...";
}

interface ProjectCardProps {
  project: CalendarProject;
  variant?: "compact" | "full";
  isToday?: boolean;
}

export function ProjectCard({ project, variant = "compact", isToday = false }: ProjectCardProps) {
  // Treat past-date "scheduled" posts as "published"
  const today = new Date().toISOString().split("T")[0];
  const effectiveStatus: ProjectStatus =
    project.status === "scheduled" && project.scheduled_date && project.scheduled_date < today
      ? "published"
      : project.status;
  const statusConfig = STATUS_CONFIG[effectiveStatus];
  // Use content_summary from main post draft or outline (not notes)
  const summary = truncateWords(project.content_summary, 75);

  if (variant === "compact") {
    // Compact card for month view
    return (
      <Link
        href={`/deliverables/${project.id}`}
        className={cn(
          "block rounded-lg transition-all duration-200",
          "bg-amber-50/80 dark:bg-amber-950/30",
          "border-l-3 border-l-yellow-400",
          "hover:bg-amber-100/80 dark:hover:bg-amber-900/40",
          "hover:shadow-sm",
          "px-2.5 py-1.5"
        )}
      >
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", statusConfig.dotClass)}
            aria-label={statusConfig.label}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-800 dark:text-stone-200 leading-tight">
              {project.name}
            </p>
            {project.asset_types.length > 0 && (
              <div className="flex items-center gap-0.5 mt-0.5">
                {project.asset_types.map((type) => (
                  <span
                    key={type}
                    className="text-[8px] font-medium px-1 py-px rounded bg-stone-200/80 text-stone-500 dark:bg-stone-800 dark:text-stone-500 leading-none"
                  >
                    {ASSET_SHORT_LABELS[type] ?? type}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Full card for gallery view - portrait, paper-like aspect ratio
  return (
    <Link
      href={`/deliverables/${project.id}`}
      className={cn(
        "flex flex-col h-full rounded-xl transition-all duration-200",
        "bg-amber-50/80 dark:bg-amber-950/30",
        "border-2",
        isToday
          ? "border-emerald-400 dark:border-emerald-500 hover:border-emerald-500 dark:hover:border-emerald-400"
          : "border-yellow-400 dark:border-yellow-600 hover:border-yellow-500 dark:hover:border-yellow-500",
        "hover:shadow-lg",
        isToday
          ? "hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/40"
          : "hover:shadow-amber-200/50 dark:hover:shadow-amber-900/40",
        "hover:-translate-y-0.5",
        "p-4 overflow-hidden"
      )}
    >
      {/* Date at top */}
      <p className="text-xs font-medium text-yellow-700 dark:text-yellow-500 uppercase tracking-wide mb-2">
        {formatDate(project.scheduled_date)}
      </p>

      {/* Title */}
      <h3 className="font-semibold text-stone-900 dark:text-stone-100 leading-snug mb-3 line-clamp-2">
        {project.name}
      </h3>

      {/* Summary - white content box */}
      <div className="flex-1 min-h-0 bg-white dark:bg-stone-900 rounded-lg p-3 border border-stone-200 dark:border-stone-700">
        {summary ? (
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed line-clamp-12">
            {summary}
          </p>
        ) : (
          <p className="text-sm text-stone-400 dark:text-stone-600 italic">
            No content yet
          </p>
        )}
      </div>

      {/* Status + asset types at bottom */}
      <div className="mt-3 pt-2 flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-medium uppercase tracking-wider", statusConfig.textClass)}>
          {statusConfig.label}
        </span>
        {project.asset_types.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {project.asset_types.map((type) => (
              <span
                key={type}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-stone-200/80 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
              >
                {ASSET_SHORT_LABELS[type] ?? type}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// Empty card for days with no content scheduled
interface EmptyDayCardProps {
  date: string;
  isToday?: boolean;
}

export function EmptyDayCard({ date, isToday = false }: EmptyDayCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-xl",
        "bg-stone-50/50 dark:bg-stone-900/30",
        "border-2 border-dashed",
        isToday
          ? "border-emerald-400 dark:border-emerald-500"
          : "border-stone-300 dark:border-stone-700",
        "p-5"
      )}
    >
      {/* Date at top */}
      <p className={cn(
        "text-xs font-medium uppercase tracking-wide mb-3",
        isToday
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-stone-500 dark:text-stone-500"
      )}>
        {formatDateFull(date)}
      </p>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-stone-400 dark:text-stone-600 mb-4">
          No content scheduled
        </p>
        <Button
          variant="outline"
          size="sm"
          asChild
          className={cn(
            isToday
              ? "border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-500 dark:hover:bg-emerald-950/30"
              : "border-yellow-400 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-500 dark:hover:bg-yellow-950/30"
          )}
        >
          <Link href={`/deliverables/new?date=${date}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add project
          </Link>
        </Button>
      </div>
    </div>
  );
}

export { STATUS_CONFIG };
