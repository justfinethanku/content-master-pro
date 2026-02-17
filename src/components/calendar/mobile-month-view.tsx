"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { DraggableProjectCard } from "./draggable-project-card";
import type { CalendarProject } from "@/hooks/use-deliverables";
import { cn } from "@/lib/utils";

// Compact mini-calendar cell - shows date number + dot indicators
interface CompactDayCellProps {
  date: Date;
  projects: CalendarProject[];
  inCurrentMonth: boolean;
  isToday: boolean;
}

export function CompactDayCell({ date, projects, inCurrentMonth, isToday }: CompactDayCellProps) {
  const dateKey = date.toISOString().split("T")[0];
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey, type: "calendar-day" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "p-1 border-r border-b border-stone-200 dark:border-stone-800 last:border-r-0",
        "min-h-10 overflow-hidden",
        !inCurrentMonth && "bg-stone-50/50 dark:bg-stone-900/30",
        isToday && "bg-yellow-50/50 dark:bg-yellow-950/20 ring-2 ring-inset ring-yellow-400 dark:ring-yellow-500",
        isOver && "ring-2 ring-yellow-400 ring-inset bg-yellow-50/80 dark:bg-yellow-950/40"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] font-medium",
            isToday
              ? "text-yellow-700 dark:text-yellow-400 font-semibold"
              : inCurrentMonth
                ? "text-stone-700 dark:text-stone-300"
                : "text-stone-400 dark:text-stone-600"
          )}
        >
          {date.getDate()}
        </span>
        {projects.length > 0 && (
          <span className="flex items-center gap-0.5">
            {projects.slice(0, 3).map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            ))}
            {projects.length > 3 && (
              <span className="text-[8px] text-stone-400">+{projects.length - 3}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// Droppable day row for mobile list view
interface MobileDayRowProps {
  date: Date;
  projects: CalendarProject[];
  isToday: boolean;
}

function MobileDayRow({ date, projects, isToday }: MobileDayRowProps) {
  const dateKey = date.toISOString().split("T")[0];
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey, type: "calendar-day" },
  });

  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3",
        isToday
          ? "border-yellow-400 dark:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20"
          : "border-stone-200 dark:border-stone-800",
        isOver && "ring-2 ring-yellow-400 bg-yellow-50/80 dark:bg-yellow-950/40"
      )}
    >
      <div className={cn(
        "text-xs font-medium mb-2",
        isToday
          ? "text-yellow-700 dark:text-yellow-400"
          : "text-stone-500 dark:text-stone-400"
      )}>
        {dayLabel}
      </div>
      {projects.length > 0 ? (
        <div className="space-y-1.5">
          {projects.map((project) => (
            <DraggableProjectCard key={project.id} project={project} variant="compact" />
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-400 dark:text-stone-600 italic">No content</p>
      )}
    </div>
  );
}

// List of days that have projects (or today), for mobile month view
interface MobileMonthListProps {
  days: Date[];
  projectsByDate: Record<string, CalendarProject[]>;
  currentDate: Date;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isSameMonth(date: Date, currentDate: Date): boolean {
  return date.getMonth() === currentDate.getMonth();
}

function checkIsToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function MobileMonthList({ days, projectsByDate, currentDate }: MobileMonthListProps) {
  const daysWithContent = useMemo(() => {
    return days.filter((day) => {
      const dateKey = formatDateKey(day);
      const inMonth = isSameMonth(day, currentDate);
      const hasProjects = (projectsByDate[dateKey] || []).length > 0;
      return inMonth && (hasProjects || checkIsToday(day));
    });
  }, [days, projectsByDate, currentDate]);

  if (daysWithContent.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No projects scheduled this month
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {daysWithContent.map((day) => {
        const dateKey = formatDateKey(day);
        const dayProjects = projectsByDate[dateKey] || [];

        return (
          <MobileDayRow
            key={dateKey}
            date={day}
            projects={dayProjects}
            isToday={checkIsToday(day)}
          />
        );
      })}
    </div>
  );
}
