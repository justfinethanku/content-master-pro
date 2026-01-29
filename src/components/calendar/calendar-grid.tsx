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

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

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

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isCurrentMonth(date: Date, currentDate: Date): boolean {
  return date.getMonth() === currentDate.getMonth();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Droppable day cell for month view
interface DroppableDayMonthProps {
  date: Date;
  projects: ContentProject[];
  inCurrentMonth: boolean;
}

function DroppableDayMonth({ date, projects, inCurrentMonth }: DroppableDayMonthProps) {
  const dateKey = formatDateKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey, type: "calendar-day" },
  });

  const today = isToday(date);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-25 p-1.5 border-r border-b border-stone-200 dark:border-stone-800 last:border-r-0",
        "overflow-hidden",
        !inCurrentMonth && "bg-stone-50/50 dark:bg-stone-900/30",
        today && "bg-yellow-50/50 dark:bg-yellow-950/20",
        isOver && "ring-2 ring-yellow-400 ring-inset bg-yellow-50/80 dark:bg-yellow-950/40"
      )}
    >
      {/* Day number */}
      <div
        className={cn(
          "text-xs font-medium mb-1.5 px-1",
          today
            ? "text-yellow-700 dark:text-yellow-400 font-semibold"
            : inCurrentMonth
              ? "text-stone-700 dark:text-stone-300"
              : "text-stone-400 dark:text-stone-600"
        )}
      >
        {date.getDate()}
      </div>

      {/* Projects - with proper overflow handling */}
      <div className="space-y-1 overflow-hidden">
        {projects.slice(0, 3).map((project) => (
          <DraggableProjectCard key={project.id} project={project} variant="compact" />
        ))}
        {projects.length > 3 && (
          <p className="text-[10px] text-stone-500 dark:text-stone-500 px-1 font-medium">
            +{projects.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}

// Droppable day cell for week view - gallery style
interface DroppableDayWeekProps {
  date: Date;
  projects: ContentProject[];
}

function DroppableDayWeek({ date, projects }: DroppableDayWeekProps) {
  const dateKey = formatDateKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey, type: "calendar-day" },
  });

  const today = isToday(date);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-100",
        "bg-white dark:bg-stone-950",
        "border-r border-stone-200 dark:border-stone-800 last:border-r-0",
        today && "bg-yellow-50/30 dark:bg-yellow-950/10",
        isOver && "ring-2 ring-yellow-400 ring-inset bg-yellow-50/60 dark:bg-yellow-950/30"
      )}
    >
      {/* Day header */}
      <div
        className={cn(
          "px-3 py-3 border-b border-stone-100 dark:border-stone-800/50",
          today && "bg-yellow-100/50 dark:bg-yellow-900/20"
        )}
      >
        <p className="text-[11px] font-medium text-stone-500 dark:text-stone-500 uppercase tracking-wide">
          {WEEKDAYS_FULL[date.getDay()]}
        </p>
        <p
          className={cn(
            "text-2xl font-semibold mt-0.5",
            today
              ? "text-yellow-700 dark:text-yellow-400"
              : "text-stone-800 dark:text-stone-200"
          )}
        >
          {date.getDate()}
        </p>
      </div>

      {/* Projects gallery */}
      <div className="flex-1 p-3 overflow-y-auto overflow-x-hidden">
        <div className="space-y-3">
          {projects.map((project) => (
            <DraggableProjectCard key={project.id} project={project} variant="full" />
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-stone-400 dark:text-stone-600 text-center py-8">
              No content scheduled
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarGrid({ projects, viewMode, currentDate }: CalendarGridProps) {
  const days = useMemo(() => {
    return viewMode === "month" ? getMonthDays(currentDate) : getWeekDays(currentDate);
  }, [viewMode, currentDate]);

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
      <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
        {/* Week grid - gallery layout */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dateKey = formatDateKey(day);
            const dayProjects = projectsByDate[dateKey] || [];

            return <DroppableDayWeek key={i} date={day} projects={dayProjects} />;
          })}
        </div>
      </div>
    );
  }

  // Month view
  return (
    <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-medium text-stone-500 dark:text-stone-500 border-r border-stone-200 dark:border-stone-800 last:border-r-0"
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
            <DroppableDayMonth
              key={i}
              date={day}
              projects={dayProjects}
              inCurrentMonth={inCurrentMonth}
            />
          );
        })}
      </div>
    </div>
  );
}
