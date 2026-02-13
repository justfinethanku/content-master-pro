"use client";

import { useMemo, useState, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { DraggableProjectCard } from "./draggable-project-card";
import { ProjectCard, EmptyDayCard } from "./project-card";
import type { CalendarProject } from "@/hooks/use-deliverables";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarGridProps {
  projects: CalendarProject[];
  viewMode: "month" | "week";
  currentDate: Date;
  scrollToToday?: number; // Increment this to trigger scroll to today
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

// Get extended range of days for infinite scroll (90 days before and after)
function getExtendedDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - 90);

  const days: Date[] = [];
  for (let i = 0; i < 181; i++) { // 90 + 1 + 90 = 181 days
    const day = new Date(start);
    day.setDate(start.getDate() + i);
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

// Droppable day cell for month view
interface DroppableDayMonthProps {
  date: Date;
  projects: CalendarProject[];
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

// Card item type for gallery - either a project or an empty day placeholder
type GalleryItem =
  | { type: "project"; project: CalendarProject; date: string; isToday: boolean }
  | { type: "empty"; date: string; isToday: boolean };

// Droppable wrapper for card view items
interface DroppableDayCardProps {
  date: string;
  isToday: boolean;
  children: React.ReactNode;
}

function DroppableDayCard({ date, isToday: todayFlag, children }: DroppableDayCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: date,
    data: { date, type: "calendar-day" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "aspect-2/3 rounded-xl transition-shadow",
        isOver && "ring-2 ring-yellow-400 shadow-lg shadow-yellow-200/30 dark:shadow-yellow-900/30",
        todayFlag && isOver && "ring-yellow-500"
      )}
    >
      {children}
    </div>
  );
}

// Gallery carousel for week view
interface GalleryCarouselProps {
  projects: CalendarProject[];
  days: Date[];
  scrollToToday?: number;
}

function GalleryCarousel({ projects, days, scrollToToday }: GalleryCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardsPerPage = 3;

  // Build gallery items: projects + empty day placeholders
  // Also track the index of today's first item
  const { galleryItems, todayIndex } = useMemo(() => {
    const items: GalleryItem[] = [];
    const projectsByDate = new Map<string, CalendarProject[]>();
    let foundTodayIndex = -1;

    // Group projects by date
    projects.forEach((project) => {
      if (project.scheduled_date) {
        const dateKey = project.scheduled_date.split("T")[0];
        if (!projectsByDate.has(dateKey)) {
          projectsByDate.set(dateKey, []);
        }
        projectsByDate.get(dateKey)!.push(project);
      }
    });

    // Build items array in chronological order
    for (const day of days) {
      const dateKey = formatDateKey(day);
      const dayProjects = projectsByDate.get(dateKey) || [];
      const dayIsToday = isToday(day);

      if (dayProjects.length === 0) {
        // Empty day - add placeholder
        if (dayIsToday && foundTodayIndex === -1) {
          foundTodayIndex = items.length;
        }
        items.push({ type: "empty", date: dateKey, isToday: dayIsToday });
      } else {
        // Add all projects for this day
        if (dayIsToday && foundTodayIndex === -1) {
          foundTodayIndex = items.length;
        }
        for (const project of dayProjects) {
          items.push({ type: "project", project, date: dateKey, isToday: dayIsToday });
        }
      }
    }

    return { galleryItems: items, todayIndex: foundTodayIndex };
  }, [projects, days]);

  // Scroll to today when scrollToToday changes or on initial mount
  useEffect(() => {
    if (todayIndex >= 0) {
      // Center today's card (put it in the middle of 3 cards)
      const centeredIndex = Math.max(0, Math.min(todayIndex - 1, galleryItems.length - cardsPerPage));
      setCurrentIndex(centeredIndex);
    }
  }, [scrollToToday, todayIndex, galleryItems.length]);

  const goBack = () => {
    setCurrentIndex(Math.max(0, currentIndex - cardsPerPage));
  };

  const goForward = () => {
    setCurrentIndex(Math.min(galleryItems.length - cardsPerPage, currentIndex + cardsPerPage));
  };

  // Allow scrolling but show visual indication when near edges
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex + cardsPerPage < galleryItems.length;

  const visibleItems = galleryItems.slice(currentIndex, currentIndex + cardsPerPage);

  return (
    <div className="relative">
      {/* Arrow buttons */}
      <Button
        variant="outline"
        size="icon"
        onClick={goBack}
        disabled={!canGoBack}
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10",
          "h-10 w-10 rounded-full shadow-md",
          "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700",
          "hover:bg-yellow-50 hover:border-yellow-300 dark:hover:bg-yellow-950/50",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={goForward}
        disabled={!canGoForward}
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10",
          "h-10 w-10 rounded-full shadow-md",
          "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700",
          "hover:bg-yellow-50 hover:border-yellow-300 dark:hover:bg-yellow-950/50",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Cards grid - portrait aspect ratio (2:3, like paper) */}
      <div className="px-8">
        <div className="grid grid-cols-3 gap-5">
          {visibleItems.map((item) => (
            <DroppableDayCard
              key={item.type === "project" ? item.project.id : `empty-${item.date}`}
              date={item.type === "project" ? item.date : item.date}
              isToday={item.isToday}
            >
              {item.type === "project" ? (
                <DraggableProjectCard project={item.project} variant="full" />
              ) : (
                <EmptyDayCard date={item.date} isToday={item.isToday} />
              )}
            </DroppableDayCard>
          ))}
          {/* Fill empty slots to maintain grid */}
          {visibleItems.length < cardsPerPage &&
            Array.from({ length: cardsPerPage - visibleItems.length }).map((_, i) => (
              <div key={`filler-${i}`} className="aspect-2/3" />
            ))}
        </div>
      </div>

    </div>
  );
}

export function CalendarGrid({ projects, viewMode, currentDate, scrollToToday }: CalendarGridProps) {
  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate]);
  const extendedDays = useMemo(() => getExtendedDays(currentDate), [currentDate]);

  const projectsByDate = useMemo(() => {
    const grouped: Record<string, CalendarProject[]> = {};

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

  // Week view = Gallery carousel
  if (viewMode === "week") {
    return (
      <div className="py-4">
        <GalleryCarousel projects={projects} days={extendedDays} scrollToToday={scrollToToday} />
      </div>
    );
  }

  // Month view = Traditional calendar grid
  return (
    <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
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

      <div className="grid grid-cols-7">
        {monthDays.map((day, i) => {
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
