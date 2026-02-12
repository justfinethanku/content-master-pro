"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { DraggableProjectCard } from "./draggable-project-card";
import type { CalendarProject } from "@/hooks/use-deliverables";
import { cn } from "@/lib/utils";

interface BacklogPanelProps {
  projects: CalendarProject[];
}

export function BacklogPanel({ projects }: BacklogPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (projects.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors rounded-lg"
      >
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <span>
          {projects.length} unscheduled project
          {projects.length !== 1 ? "s" : ""}
        </span>
        {expanded ? (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Drag projects to calendar days to schedule them
          </p>
          <div
            className={cn(
              "flex gap-3 overflow-x-auto pb-2",
              "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            )}
          >
            {projects.map((project) => (
              <div key={project.id} className="w-[200px] shrink-0">
                <DraggableProjectCard project={project} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
