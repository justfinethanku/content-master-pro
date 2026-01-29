"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { DraggableProjectCard } from "./draggable-project-card";
import type { ContentProject } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  projects: ContentProject[];
  viewMode: "month" | "week";
  currentDate: Date;
}

// Get days in month grid (includes prev/next month padding)
function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);

  // Start from Sunday of the week containing the first day
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // End on Saturday of the week containing the last day
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

// Get days in current week
function getWeekDays(date: Date): Date[] {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }

  return days;
}

// Format date to YYYY-MM-DD for comparison
function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Check if date is in current month
function isCurrentMonth(date: Date, currentDate: Date): boolean {
  return date.getMonth() === currentDate.getMonth();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Droppable day cell component
interface DroppableDayProps {
  date: Date;
  projects: ContentProject[];
  inCurrentMonth: boolean;
  variant: "month" | "week";
}

function DroppableDay({
  date,
  projects,
  inCurrentMonth,
  variant,
}: DroppableDayProps) {
  const dateKey = formatDateKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: {
      date: dateKey,
      type: "calendar-day",
    },
  });

  const today = isToday(date);

  if (variant === "week") {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "p-2 border-r border-border last:border-r-0 bg-background min-h-[300px]",
          today && "bg-primary/5",
          isOver && "ring-2 ring-primary ring-inset bg-primary/10"
        )}
      >
        <div className="space-y-2">
          {projects.map((project) => (
            <DraggableProjectCard
              key={project.id}
              project={project}
              variant="full"
            />
          ))}
        </div>
      </div>
    );
  }

  // Month view
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[100px] p-1 border-r border-b border-border last:border-r-0",
        !inCurrentMonth && "bg-muted/50",
        today && "bg-primary/5",
        isOver && "ring-2 ring-primary ring-inset bg-primary/10"
      )}
    >
      {/* Day number */}
      <div
        className={cn(
          "text-xs font-medium mb-1 p-1",
          today
            ? "text-primary font-bold"
            : inCurrentMonth
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      >
        {date.getDate()}
      </div>

      {/* Projects */}
      <div className="space-y-1">
        {projects.slice(0, 3).map((project) => (
          <DraggableProjectCard
            key={project.id}
            project={project}
            variant="compact"
          />
        ))}
        {projects.length > 3 && (
          <p className="text-xs text-muted-foreground px-1">
            +{projects.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  projects,
  viewMode,
  currentDate,
}: CalendarGridProps) {
  // Get days based on view mode
  const days = useMemo(() => {
    return viewMode === "month"
      ? getMonthDays(currentDate)
      : getWeekDays(currentDate);
  }, [viewMode, currentDate]);

  // Group projects by date
  const projectsByDate = useMemo(() => {
    const grouped: Record<string, ContentProject[]> = {};

    projects.forEach((project) => {
      if (project.scheduled_date) {
        const key = project.scheduled_date.split("T")[0];
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(project);
      }
    });

    return grouped;
  }, [projects]);

  if (viewMode === "week") {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted">
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "p-3 text-center border-r border-border last:border-r-0",
                isToday(day) && "bg-primary/10"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {WEEKDAYS[day.getDay()]}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold mt-1",
                  isToday(day)
                    ? "text-primary"
                    : "text-foreground"
                )}
              >
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dateKey = formatDateKey(day);
            const dayProjects = projectsByDate[dateKey] || [];

            return (
              <DroppableDay
                key={i}
                date={day}
                projects={dayProjects}
                inCurrentMonth={true}
                variant="week"
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Month view
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateKey = formatDateKey(day);
          const dayProjects = projectsByDate[dateKey] || [];
          const inCurrentMonth = isCurrentMonth(day, currentDate);

          return (
            <DroppableDay
              key={i}
              date={day}
              projects={dayProjects}
              inCurrentMonth={inCurrentMonth}
              variant="month"
            />
          );
        })}
      </div>
    </div>
  );
}
