"use client";

import { useState, useMemo } from "react";
import { DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import { CalendarGrid } from "./calendar-grid";
import { ProjectCard, STATUS_CONFIG } from "./project-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects, useUpdateProject, type ProjectFilters } from "@/hooks/use-projects";
import type { ContentProject, ProjectStatus } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type ViewMode = "month" | "week";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatWeekRange(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startMonth = MONTHS[startOfWeek.getMonth()].slice(0, 3);
  const endMonth = MONTHS[endOfWeek.getMonth()].slice(0, 3);

  if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
    return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
  }

  return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
}

export function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [activeProject, setActiveProject] = useState<ContentProject | null>(null);

  const updateProject = useUpdateProject();

  // Calculate date range for query
  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      // Include padding days from prev/next month
      const start = new Date(year, month, 1);
      start.setDate(start.getDate() - start.getDay() - 7); // Week before
      const end = new Date(year, month + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()) + 7); // Week after
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    } else {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return {
        startDate: startOfWeek.toISOString().split("T")[0],
        endDate: endOfWeek.toISOString().split("T")[0],
      };
    }
  }, [viewMode, currentDate]);

  // Build filters
  const filters: ProjectFilters = useMemo(() => {
    const f: ProjectFilters = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
    if (statusFilter !== "all") {
      f.status = statusFilter;
    }
    if (platformFilter !== "all") {
      f.platform = platformFilter;
    }
    return f;
  }, [dateRange, statusFilter, platformFilter]);

  const { data: projects = [], isLoading } = useProjects(filters);

  // Navigation handlers
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Drag and drop handlers
  const handleDragStart = (event: { active: { data: { current?: { project?: ContentProject } } } }) => {
    const project = event.active.data.current?.project;
    if (project) {
      setActiveProject(project);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveProject(null);

    if (!over) return;

    const projectData = active.data.current?.project as ContentProject | undefined;
    const targetDate = over.id as string;

    if (!projectData) return;

    // Don't update if dropped on the same date
    const currentScheduledDate = projectData.scheduled_date?.split("T")[0];
    if (currentScheduledDate === targetDate) return;

    try {
      await updateProject.mutateAsync({
        id: projectData.id,
        updates: { scheduled_date: targetDate },
      });
      toast.success(`Moved "${projectData.title}" to ${new Date(targetDate).toLocaleDateString()}`);
    } catch {
      toast.error("Failed to update project date");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title and Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold text-foreground min-w-[200px]">
            {viewMode === "month"
              ? formatMonthYear(currentDate)
              : formatWeekRange(currentDate)}
          </h2>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-none"
            >
              Month
            </Button>
            <Button
              variant={viewMode === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-none"
            >
              Week
            </Button>
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ProjectStatus | "all")}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <SelectItem key={status} value={status}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Platform Filter */}
          <Select
            value={platformFilter}
            onValueChange={setPlatformFilter}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="substack">Substack</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick Create */}
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4 mr-1" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Calendar Grid with DnD */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[400px] border border-border rounded-lg bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading calendar...</span>
          </div>
        </div>
      ) : (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <CalendarGrid
            projects={projects}
            viewMode={viewMode}
            currentDate={currentDate}
          />
          <DragOverlay>
            {activeProject ? (
              <div className="opacity-90 shadow-lg">
                <ProjectCard
                  project={activeProject}
                  variant={viewMode === "week" ? "full" : "compact"}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>
            {projects.length} project{projects.length !== 1 ? "s" : ""} in view
          </span>
        </div>
        <div className="flex items-center gap-4">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = projects.filter((p) => p.status === status).length;
            if (count === 0) return null;
            return (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${config.dotClass}`}
                />
                <span className="text-stone-600 dark:text-stone-400">
                  {count} {config.label.toLowerCase()}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
