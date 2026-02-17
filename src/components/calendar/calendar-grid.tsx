"use client";

import { useMemo, useState, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { DraggableProjectCard } from "./draggable-project-card";
import { EmptyDayCard } from "./project-card";
import { CompactDayCell, MobileMonthList } from "./mobile-month-view";
import type { CalendarProject } from "@/hooks/use-deliverables";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ──────────────────────────────────────────────
// Shared date helpers
// ──────────────────────────────────────────────

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isCurrentMonth(date: Date, referenceDate: Date): boolean {
  return date.getMonth() === referenceDate.getMonth();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

// ──────────────────────────────────────────────
// Date range generators
// ──────────────────────────────────────────────

/** Returns all days visible in a month grid (including prev/next month padding). */
function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  if (startDate.getTime() === firstDay.getTime()) {
    startDate.setDate(startDate.getDate() - 7);
  }

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  if (endDate.getDate() === lastDay.getDate() && endDate.getMonth() === lastDay.getMonth()) {
    endDate.setDate(endDate.getDate() + 7);
  }

  const days: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/** Returns 181 days centered on the given date (90 before + today + 90 after). */
function getExtendedDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - 90);

  const days: Date[] = [];
  for (let i = 0; i < 181; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

/** Groups projects by their scheduled date key (YYYY-MM-DD). */
function groupByDate(projects: CalendarProject[]): Record<string, CalendarProject[]> {
  const grouped: Record<string, CalendarProject[]> = {};
  for (const project of projects) {
    if (project.scheduled_date) {
      const key = project.scheduled_date.split("T")[0];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(project);
    }
  }
  return grouped;
}

// ──────────────────────────────────────────────
// Desktop month view: droppable day cell
// ──────────────────────────────────────────────

interface DroppableDayCellProps {
  date: Date;
  projects: CalendarProject[];
  inCurrentMonth: boolean;
}

function DroppableDayCell({ date, projects, inCurrentMonth }: DroppableDayCellProps) {
  const dateKey = formatDateKey(date);
  const today = isToday(date);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey, type: "calendar-day" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-25 p-1.5 border-r border-b border-stone-200 dark:border-stone-800 last:border-r-0",
        "overflow-hidden",
        !inCurrentMonth && "bg-stone-50/50 dark:bg-stone-900/30",
        today && "bg-yellow-50/50 dark:bg-yellow-950/20 ring-2 ring-inset ring-yellow-400 dark:ring-yellow-500",
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

// ──────────────────────────────────────────────
// Card/gallery view types & components
// ──────────────────────────────────────────────

type GalleryItem =
  | { type: "project"; project: CalendarProject; date: string; isToday: boolean }
  | { type: "empty"; date: string; isToday: boolean };

interface DroppableCardSlotProps {
  date: string;
  isToday: boolean;
  children: React.ReactNode;
}

function DroppableCardSlot({ date, isToday: todayFlag, children }: DroppableCardSlotProps) {
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

// ──────────────────────────────────────────────
// Gallery carousel (card view)
// ──────────────────────────────────────────────

interface GalleryCarouselProps {
  projects: CalendarProject[];
  days: Date[];
  scrollToToday?: number;
}

function GalleryCarousel({ projects, days, scrollToToday }: GalleryCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Responsive cards-per-page: read once from media queries for scroll math.
  // The actual grid layout is driven by Tailwind breakpoints (grid-cols-1 md:grid-cols-2 lg:grid-cols-3).
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const cardsPerPage = isLg ? 3 : isMd ? 2 : 1;

  const { galleryItems, todayIndex } = useMemo(() => {
    const items: GalleryItem[] = [];
    const projectsByDate = new Map<string, CalendarProject[]>();
    let foundTodayIndex = -1;

    for (const project of projects) {
      if (project.scheduled_date) {
        const dateKey = project.scheduled_date.split("T")[0];
        if (!projectsByDate.has(dateKey)) projectsByDate.set(dateKey, []);
        projectsByDate.get(dateKey)!.push(project);
      }
    }

    for (const day of days) {
      const dateKey = formatDateKey(day);
      const dayProjects = projectsByDate.get(dateKey) || [];
      const dayIsToday = isToday(day);

      if (dayIsToday && foundTodayIndex === -1) {
        foundTodayIndex = items.length;
      }

      if (dayProjects.length === 0) {
        items.push({ type: "empty", date: dateKey, isToday: dayIsToday });
      } else {
        for (const project of dayProjects) {
          items.push({ type: "project", project, date: dateKey, isToday: dayIsToday });
        }
      }
    }

    return { galleryItems: items, todayIndex: foundTodayIndex };
  }, [projects, days]);

  // Scroll to today on mount or when the Today button is pressed
  useEffect(() => {
    if (todayIndex >= 0) {
      const centeredIndex = Math.max(0, Math.min(todayIndex - 1, galleryItems.length - cardsPerPage));
      requestAnimationFrame(() => setCurrentIndex(centeredIndex));
    }
  }, [scrollToToday, todayIndex, galleryItems.length, cardsPerPage]);

  const goBack = () => setCurrentIndex(Math.max(0, currentIndex - cardsPerPage));
  const goForward = () => setCurrentIndex(Math.min(galleryItems.length - cardsPerPage, currentIndex + cardsPerPage));

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex + cardsPerPage < galleryItems.length;
  const visibleItems = galleryItems.slice(currentIndex, currentIndex + cardsPerPage);

  return (
    <div className="relative">
      {/* Navigation arrows */}
      <Button
        variant="outline"
        size="icon"
        onClick={goBack}
        disabled={!canGoBack}
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 z-10",
          "h-8 w-8 sm:h-10 sm:w-10 rounded-full shadow-md",
          "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700",
          "hover:bg-yellow-50 hover:border-yellow-300 dark:hover:bg-yellow-950/50",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={goForward}
        disabled={!canGoForward}
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 z-10",
          "h-8 w-8 sm:h-10 sm:w-10 rounded-full shadow-md",
          "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700",
          "hover:bg-yellow-50 hover:border-yellow-300 dark:hover:bg-yellow-950/50",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </Button>

      {/* Responsive card grid: Tailwind handles column count, JS handles pagination */}
      <div className="px-10 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-sm md:max-w-none mx-auto md:mx-0">
          {visibleItems.map((item) => (
            <DroppableCardSlot
              key={item.type === "project" ? item.project.id : `empty-${item.date}`}
              date={item.date}
              isToday={item.isToday}
            >
              {item.type === "project" ? (
                <DraggableProjectCard project={item.project} variant="full" />
              ) : (
                <EmptyDayCard date={item.date} isToday={item.isToday} />
              )}
            </DroppableCardSlot>
          ))}
          {/* Filler slots to keep grid shape consistent */}
          {visibleItems.length < cardsPerPage &&
            Array.from({ length: cardsPerPage - visibleItems.length }).map((_, i) => (
              <div key={`filler-${i}`} className="aspect-2/3" />
            ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main CalendarGrid export
// ──────────────────────────────────────────────

interface CalendarGridProps {
  projects: CalendarProject[];
  viewMode: "month" | "week";
  currentDate: Date;
  scrollToToday?: number;
}

export function CalendarGrid({ projects, viewMode, currentDate, scrollToToday }: CalendarGridProps) {
  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate]);
  const extendedDays = useMemo(() => getExtendedDays(currentDate), [currentDate]);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const projectsByDate = useMemo(() => groupByDate(projects), [projects]);

  // Card/gallery view
  if (viewMode === "week") {
    return (
      <div className="py-4">
        <GalleryCarousel projects={projects} days={extendedDays} scrollToToday={scrollToToday} />
      </div>
    );
  }

  // Mobile month view: compact mini-calendar + scrollable day list
  if (isMobile) {
    return (
      <div>
        <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm mb-4">
          <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
            {WEEKDAYS_SHORT.map((day, i) => (
              <div
                key={`${day}-${i}`}
                className="py-1 text-center text-[10px] font-medium text-stone-500 dark:text-stone-500 border-r border-stone-200 dark:border-stone-800 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => (
              <CompactDayCell
                key={i}
                date={day}
                projects={projectsByDate[formatDateKey(day)] || []}
                inCurrentMonth={isCurrentMonth(day, currentDate)}
                isToday={isToday(day)}
              />
            ))}
          </div>
        </div>

        <MobileMonthList
          days={monthDays}
          projectsByDate={projectsByDate}
          currentDate={currentDate}
        />
      </div>
    );
  }

  // Desktop month view: traditional 7-column grid
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
        {monthDays.map((day, i) => (
          <DroppableDayCell
            key={i}
            date={day}
            projects={projectsByDate[formatDateKey(day)] || []}
            inCurrentMonth={isCurrentMonth(day, currentDate)}
          />
        ))}
      </div>
    </div>
  );
}
