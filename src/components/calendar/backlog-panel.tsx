"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { DraggableProjectCard } from "./draggable-project-card";
import type { CalendarProject } from "@/hooks/use-deliverables";
import { cn } from "@/lib/utils";

interface BacklogPanelProps {
  projects: CalendarProject[];
}

export const BACKLOG_DROPPABLE_ID = "backlog";

export function BacklogPanel({ projects }: BacklogPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const { setNodeRef, isOver } = useDroppable({
    id: BACKLOG_DROPPABLE_ID,
    data: { type: "backlog" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mb-4 rounded-lg border bg-card transition-colors",
        isOver
          ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20 ring-2 ring-yellow-400 ring-inset"
          : "border-border",
        projects.length === 0 && !isOver && "hidden"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors rounded-lg"
      >
        <Inbox className="h-4 w-4 text-muted-foreground" />
        <span>
          {isOver
            ? "Drop to unschedule"
            : `${projects.length} unscheduled project${projects.length !== 1 ? "s" : ""}`}
        </span>
        {expanded ? (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && projects.length > 0 && (
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
              <div key={project.id} className="w-[160px] sm:w-[200px] shrink-0">
                <DraggableProjectCard project={project} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
