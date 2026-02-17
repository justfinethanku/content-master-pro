"use client";

import { useState } from "react";
import Link from "next/link";
import { useDeliverables, type DeliverableFilters } from "@/hooks/use-deliverables";
import type { ProjectStatus } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ExternalLink,
  FileText,
  Package,
  Plus,
  Search,
} from "lucide-react";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  review: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  scheduled: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  published: "bg-green-500/15 text-green-700 dark:text-green-400",
  archived: "bg-muted text-muted-foreground",
};

export default function DeliverablesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("draft");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");

  const filters: DeliverableFilters = {
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as ProjectStatus) : undefined,
    sortBy,
    sortDir: "desc",
  };

  const { data: projects, isLoading, error } = useDeliverables(filters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deliverables</h1>
          <p className="text-sm text-muted-foreground">
            {projects?.length ?? 0} projects
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/deliverables/new">
            <Plus className="mr-2 h-4 w-4" />
            Add project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "name")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load projects: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && projects?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="mb-3 h-10 w-10" />
          <p>No projects found</p>
        </div>
      )}

      {!isLoading && projects && projects.length > 0 && (
        <div className="grid gap-3">
          {projects.map((project) => {
            const meta = project.metadata as Record<string, unknown>;
            const subtitle = meta?.subtitle as string | undefined;
            const wordCount = meta?.word_count as number | undefined;
            const publishedUrl = meta?.url as string | undefined;

            return (
              <Link
                key={project.id}
                href={`/deliverables/${project.id}`}
                className="group flex items-start gap-4 rounded-lg border border-border bg-card p-3 sm:p-4 transition-colors hover:bg-muted/50"
              >
                {/* Left: content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2">
                    <h3 className="font-medium text-foreground line-clamp-2 wrap-break-word group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 text-xs mt-0.5",
                        STATUS_COLORS[project.status]
                      )}
                    >
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {subtitle && (
                    <p className="text-sm text-muted-foreground truncate">
                      {subtitle}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {project.scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.scheduled_date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        )}
                      </span>
                    )}

                    {wordCount && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {wordCount.toLocaleString()} words
                      </span>
                    )}

                    {project.asset_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {project.asset_count} asset{project.asset_count !== 1 ? "s" : ""}
                      </span>
                    )}

                    {project.asset_types.length > 0 && (
                      <div className="flex gap-1">
                        {project.asset_types.map((type) => (
                          <Badge
                            key={type}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: published link */}
                {publishedUrl && (
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
