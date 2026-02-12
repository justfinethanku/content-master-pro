"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Badge import removed - not currently used
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Lightbulb,
  Video,
} from "lucide-react";
import { useRoutingCalendar, useRoutedIdeas } from "@/hooks/use-routing";
import { usePublications } from "@/hooks/use-routing-config";
import type { IdeaRouting } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function RoutingCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPublication, setSelectedPublication] = useState<string>("all");
  
  const { data: publications = [] } = usePublications();
  const { data: scheduledData } = useRoutedIdeas({ status: "scheduled" });

  // Memoize to avoid unnecessary re-renders
  const scheduledIdeas = useMemo(() => scheduledData?.ideas || [], [scheduledData?.ideas]);
  
  // Calculate date range for the current month view
  const startDate = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    start.setDate(start.getDate() - start.getDay()); // Go to previous Sunday
    return start.toISOString().split("T")[0];
  }, [currentDate]);

  const endDate = useMemo(() => {
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    end.setDate(end.getDate() + (6 - end.getDay())); // Go to next Saturday
    return end.toISOString().split("T")[0];
  }, [currentDate]);

  const { data: calendarData, isLoading, error } = useRoutingCalendar(startDate, endDate);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [startDate, endDate]);

  // Group scheduled ideas by date
  const ideasByDate = useMemo(() => {
    const map = new Map<string, IdeaRouting[]>();
    scheduledIdeas.forEach((idea: IdeaRouting) => {
      if (idea.calendar_date) {
        const dateKey = idea.calendar_date.split("T")[0];
        const existing = map.get(dateKey) || [];
        if (selectedPublication === "all" || idea.routed_to === selectedPublication) {
          map.set(dateKey, [...existing, idea]);
        }
      }
    });
    return map;
  }, [scheduledIdeas, selectedPublication]);

  // Get slot availability for a date
  const getDateAvailability = (dateStr: string) => {
    return calendarData?.availability?.[dateStr];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold ml-2">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2">
            Today
          </Button>
        </div>
        <Select value={selectedPublication} onValueChange={setSelectedPublication}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Publications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Publications</SelectItem>
            {publications.map((pub) => (
              <SelectItem key={pub.id} value={pub.slug}>
                {pub.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error.message}
          </p>
        </div>
      )}

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b">
            {DAYS.map((day) => (
              <div
                key={day}
                className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, index) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayIdeas = ideasByDate.get(dateStr) || [];
              const availability = getDateAvailability(dateStr);
              const isInMonth = isCurrentMonth(date);
              const isTodayDate = isToday(date);

              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${
                    !isInMonth ? "bg-muted/30" : ""
                  } ${isTodayDate ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm ${
                        isTodayDate
                          ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center font-bold"
                          : isInMonth
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {availability && (
                      <span
                        className={`text-xs ${
                          availability.availableSlots > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {availability.availableSlots}/{availability.totalSlots}
                      </span>
                    )}
                  </div>

                  {/* Ideas for this day */}
                  <div className="space-y-1">
                    {dayIdeas.slice(0, 3).map((idea) => (
                      <div
                        key={idea.id}
                        className="text-xs p-1 rounded bg-primary/10 border border-primary/20 truncate flex items-center gap-1"
                        title={`Idea ${idea.idea_id.slice(0, 8)}`}
                      >
                        <Lightbulb className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {idea.idea_id.slice(0, 8)}...
                        </span>
                        {idea.youtube_version === "yes" && (
                          <Video className="h-3 w-3 flex-shrink-0 text-red-500" />
                        )}
                      </div>
                    ))}
                    {dayIdeas.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayIdeas.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" />
          <span>Scheduled content</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-600">N/M</span>
          <span>Available/Total slots</span>
        </div>
      </div>
    </div>
  );
}
