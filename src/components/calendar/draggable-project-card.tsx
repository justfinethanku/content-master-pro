"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ProjectCard } from "./project-card";
import type { CalendarProject } from "@/hooks/use-deliverables";
import { cn } from "@/lib/utils";

interface DraggableProjectCardProps {
  project: CalendarProject;
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
      {...listeners}
      {...attributes}
      className={cn(
        "group relative cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 z-50"
      )}
    >
      <div className={cn(isDragging && "pointer-events-none", "w-full overflow-hidden")}>
        <ProjectCard project={project} variant={variant} />
      </div>
    </div>
  );
}
