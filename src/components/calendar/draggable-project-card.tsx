"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ProjectCard } from "./project-card";
import type { ContentProject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface DraggableProjectCardProps {
  project: ContentProject;
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
      {/* Drag handle overlay */}
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
          "cursor-grab active:cursor-grabbing",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "z-10 rounded-l-md",
          variant === "compact" ? "bg-accent/80" : "bg-accent/80"
        )}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* The actual card - wrapped to prevent link navigation during drag */}
      <div className={cn(isDragging && "pointer-events-none")}>
        <ProjectCard project={project} variant={variant} />
      </div>
    </div>
  );
}
