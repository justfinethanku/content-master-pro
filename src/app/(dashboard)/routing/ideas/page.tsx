"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Lightbulb,
  Loader2,
  AlertCircle,
  Search,
  Target,
  Scale,
  Calendar,
  ArrowRight,
  Trophy,
  Award,
  Medal,
  Star,
  XCircle,
  Video,
} from "lucide-react";
import { useRoutedIdeas, useKillIdeaRouting } from "@/hooks/use-routing";
import { usePublications } from "@/hooks/use-routing-config";
import type { IdeaRouting, IdeaRoutingStatus } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  intake: { label: "Intake", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", description: "New ideas awaiting routing" },
  routed: { label: "Routed", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", description: "Assigned to publication, needs scoring" },
  scored: { label: "Scored", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", description: "Scored and tiered, ready for scheduling" },
  slotted: { label: "Slotted", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", description: "Assigned to calendar slot" },
  scheduled: { label: "Scheduled", color: "bg-green-500/10 text-green-600 border-green-500/20", description: "Confirmed publish date" },
  published: { label: "Published", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", description: "Content is live" },
  killed: { label: "Killed", color: "bg-red-500/10 text-red-600 border-red-500/20", description: "Archived or rejected" },
};

const TIER_ICONS: Record<string, React.ElementType> = {
  premium_a: Trophy,
  a: Award,
  b: Medal,
  c: Star,
  kill: XCircle,
};

const TIER_COLORS: Record<string, string> = {
  premium_a: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  a: "bg-green-500/10 text-green-600 border-green-500/20",
  b: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  c: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  kill: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function RoutingIdeasPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as IdeaRoutingStatus | null;

  const [statusFilter, setStatusFilter] = useState<IdeaRoutingStatus | "all">(
    initialStatus || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdea, setSelectedIdea] = useState<IdeaRouting | null>(null);

  const { data, isLoading, error } = useRoutedIdeas(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const { data: publications = [] } = usePublications();
  const killMutation = useKillIdeaRouting();

  // Extract ideas from response
  const ideas = data?.ideas || [];

  // Filter ideas by search query (search in ID since we don't have title)
  const filteredIdeas = ideas.filter((idea) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      idea.id.toLowerCase().includes(query) ||
      idea.idea_id.toLowerCase().includes(query) ||
      idea.routed_to?.toLowerCase().includes(query)
    );
  });

  const getPublicationName = (slug: string | undefined) => {
    if (!slug) return "Unassigned";
    return publications.find((p) => p.slug === slug)?.name || slug;
  };

  const handleKill = async () => {
    if (!selectedIdea) return;
    if (!confirm("Kill this idea? It will be archived and won't appear in active lists.")) return;
    try {
      await killMutation.mutateAsync({
        id: selectedIdea.id,
        reason: "Killed from routing dashboard",
      });
      setSelectedIdea(null);
    } catch {
      // Error handled by mutation
    }
  };

  // Get the total score from scores object
  const getTotalScore = (scores: IdeaRouting["scores"]) => {
    if (!scores) return null;
    // Sum up all publication scores if available
    let total = 0;
    let count = 0;
    Object.values(scores).forEach(score => {
      if (score !== null && score !== undefined) {
        total += score;
        count++;
      }
    });
    return count > 0 ? total / count : null;
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as IdeaRoutingStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <SelectItem key={status} value={status}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredIdeas.length} ideas
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error.message}
          </p>
        </div>
      )}

      {/* Ideas List */}
      <div className="space-y-3">
        {filteredIdeas.map((idea) => {
          const statusConfig = STATUS_CONFIG[idea.status] || STATUS_CONFIG.intake;
          const TierIcon = idea.tier ? TIER_ICONS[idea.tier.toLowerCase()] : null;
          const tierColor = idea.tier ? TIER_COLORS[idea.tier.toLowerCase()] : "";
          const totalScore = getTotalScore(idea.scores);

          return (
            <Card
              key={idea.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedIdea(idea)}
            >
              <CardHeader className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <CardTitle className="text-base truncate">
                        Idea: {idea.idea_id.slice(0, 8)}...
                      </CardTitle>
                    </div>
                    <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                      <Target className="h-3 w-3" />
                      {getPublicationName(idea.routed_to)}
                      {idea.youtube_version === "yes" && (
                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                          <Video className="h-3 w-3 mr-1" />
                          YouTube
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {idea.tier && TierIcon && (
                      <Badge variant="outline" className={tierColor}>
                        <TierIcon className="h-3 w-3 mr-1" />
                        {idea.tier.replace("_", " ").toUpperCase()}
                      </Badge>
                    )}
                    {totalScore !== null && (
                      <Badge variant="secondary" className="font-mono">
                        {totalScore.toFixed(1)}
                      </Badge>
                    )}
                    <Badge variant="outline" className={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}

        {filteredIdeas.length === 0 && (
          <div className="text-center py-12">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "No ideas match your filters"
                : "No ideas in the routing pipeline yet"}
            </p>
          </div>
        )}
      </div>

      {/* Idea Detail Dialog */}
      <Dialog open={!!selectedIdea} onOpenChange={(open) => !open && setSelectedIdea(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Idea Routing Details
            </DialogTitle>
            <DialogDescription>
              View and manage this routing entry
            </DialogDescription>
          </DialogHeader>

          {selectedIdea && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge
                    variant="outline"
                    className={STATUS_CONFIG[selectedIdea.status]?.color}
                  >
                    {STATUS_CONFIG[selectedIdea.status]?.label}
                  </Badge>
                </div>

                {/* IDs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Routing ID</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {selectedIdea.id.slice(0, 12)}...
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Idea ID</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {selectedIdea.idea_id.slice(0, 12)}...
                    </span>
                  </div>
                </div>

                {/* Routed To */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Publication</span>
                  <span className="text-sm">
                    {getPublicationName(selectedIdea.routed_to)}
                  </span>
                </div>

                {/* YouTube */}
                {selectedIdea.youtube_version === "yes" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">YouTube Version</span>
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                      <Video className="h-3 w-3 mr-1" />
                      Yes
                    </Badge>
                  </div>
                )}

                {/* Scores */}
                {selectedIdea.scores && Object.keys(selectedIdea.scores).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        Scores
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(selectedIdea.scores).map(([key, value]) => (
                          value !== null && (
                            <div key={key} className="text-center p-2 rounded bg-muted/50">
                              <div className="text-xs text-muted-foreground capitalize">{key}</div>
                              <div className="font-mono font-bold">{value.toFixed(1)}</div>
                            </div>
                          )
                        ))}
                      </div>
                      {selectedIdea.tier && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Tier</span>
                          <Badge
                            variant="outline"
                            className={TIER_COLORS[selectedIdea.tier.toLowerCase()]}
                          >
                            {(() => {
                              const TierIcon = TIER_ICONS[selectedIdea.tier!.toLowerCase()];
                              return TierIcon && <TierIcon className="h-3 w-3 mr-1" />;
                            })()}
                            {selectedIdea.tier.replace("_", " ").toUpperCase()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Schedule */}
                {selectedIdea.calendar_date && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Scheduled
                      </span>
                      <span className="text-sm">
                        {new Date(selectedIdea.calendar_date).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}

                {/* Content Attributes */}
                <Separator />
                <div className="space-y-2">
                  <span className="text-sm font-medium">Content Attributes</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedIdea.audience && (
                      <Badge variant="secondary">
                        Audience: {selectedIdea.audience}
                      </Badge>
                    )}
                    {selectedIdea.time_sensitivity && (
                      <Badge variant="secondary">
                        Timing: {selectedIdea.time_sensitivity}
                      </Badge>
                    )}
                    {selectedIdea.resource && (
                      <Badge variant="secondary">
                        Resource: {selectedIdea.resource}
                      </Badge>
                    )}
                    {selectedIdea.estimated_length && (
                      <Badge variant="secondary">
                        Length: {selectedIdea.estimated_length}
                      </Badge>
                    )}
                    {selectedIdea.is_foundational && (
                      <Badge variant="secondary">Foundational</Badge>
                    )}
                    {selectedIdea.has_contrarian_angle && (
                      <Badge variant="secondary">Contrarian</Badge>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <Separator className="my-4" />

          <div className="flex justify-between">
            {selectedIdea?.status !== "killed" && selectedIdea?.status !== "published" && (
              <Button
                variant="destructive"
                onClick={handleKill}
                disabled={killMutation.isPending}
              >
                {killMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Kill
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              {selectedIdea?.status === "scored" && (
                <Button asChild>
                  <a href={`/routing/calendar?ideaId=${selectedIdea.id}`}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
