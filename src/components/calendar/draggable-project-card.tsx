"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ProjectCard } from "./project-card";
import type { ContentProject, ContentProjectWithSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface DraggableProjectCardProps {
  project: ContentProject | ContentProjectWithSummary;
  variant?: "compact" | "full";
}

export function DraggableProjectCard({
  project,
  variant = "compact",
}: DraggableProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: project.id,
      data: {
        project,
        type: "project",
      },
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        isDragging && "opacity-50 z-50"
      )}
    >
      {/* Drag handle - subtle, only visible on hover */}
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "absolute left-0 top-0 bottom-0 flex items-center justify-center",
          "cursor-grab active:cursor-grabbing",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          "z-10",
          variant === "compact" ? "w-4 -ml-1" : "w-5 -ml-1"
        )}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical
          className={cn(
            "text-stone-400 dark:text-stone-600",
            variant === "compact" ? "h-3 w-3" : "h-4 w-4"
          )}
        />
      </div>

      {/* The actual card */}
      <div className={cn(isDragging && "pointer-events-none", "w-full overflow-hidden")}>
        <ProjectCard project={project} variant={variant} />
      </div>
    </div>
  );
}
