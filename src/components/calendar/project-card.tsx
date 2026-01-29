"use client";

import Link from "next/link";
import type { ContentProject, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Status configuration with summer yellow accents
const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  draft: {
    label: "Draft",
    dotClass: "bg-stone-400",
    textClass: "text-stone-600 dark:text-stone-400",
  },
  review: {
    label: "Review",
    dotClass: "bg-amber-400",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  scheduled: {
    label: "Scheduled",
    dotClass: "bg-yellow-400",
    textClass: "text-yellow-700 dark:text-yellow-400",
  },
  published: {
    label: "Published",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
};

// Extract first N words from text
function truncateWords(text: string | null | undefined, wordCount: number): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) return text;
  return words.slice(0, wordCount).join(" ") + "...";
}

interface ProjectCardProps {
  project: ContentProject;
  variant?: "compact" | "full";
}

export function ProjectCard({ project, variant = "compact" }: ProjectCardProps) {
  const statusConfig = STATUS_CONFIG[project.status];
  const summary = truncateWords(project.notes, 50);

  if (variant === "compact") {
    // Compact card for month view - just title and status dot
    return (
      <Link
        href={`/projects/${project.id}`}
        className={cn(
          "block rounded-lg transition-all duration-200",
          "bg-amber-50/80 dark:bg-amber-950/30",
          "border-l-3 border-l-yellow-400",
          "hover:bg-amber-100/80 dark:hover:bg-amber-900/40",
          "hover:shadow-sm",
          "px-2.5 py-1.5"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusConfig.dotClass)}
            aria-label={statusConfig.label}
          />
          <p className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">
            {project.title}
          </p>
        </div>
      </Link>
    );
  }

  // Full card for week view - magazine editorial style
  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "block rounded-xl transition-all duration-200",
        "bg-linear-to-br from-amber-50 to-yellow-50/50",
        "dark:from-amber-950/40 dark:to-yellow-950/20",
        "border border-amber-200/60 dark:border-amber-800/40",
        "hover:shadow-md hover:shadow-amber-200/40 dark:hover:shadow-amber-900/30",
        "hover:border-yellow-300 dark:hover:border-yellow-700",
        "p-4 overflow-hidden"
      )}
    >
      {/* Status indicator - subtle top accent */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={cn("w-2 h-2 rounded-full", statusConfig.dotClass)}
          aria-label={statusConfig.label}
        />
        <span className={cn("text-[11px] font-medium uppercase tracking-wide", statusConfig.textClass)}>
          {statusConfig.label}
        </span>
      </div>

      {/* Title - editorial headline style */}
      <h3 className="font-semibold text-stone-900 dark:text-stone-100 leading-snug mb-2 line-clamp-2">
        {project.title}
      </h3>

      {/* Summary - magazine body text */}
      {summary && (
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
          {summary}
        </p>
      )}
    </Link>
  );
}

export { STATUS_CONFIG };
