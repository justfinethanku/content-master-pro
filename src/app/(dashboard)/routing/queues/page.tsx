"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Inbox,
  Loader2,
  AlertCircle,
  Trash2,
  Clock,
  ChevronRight,
  Trophy,
  Award,
  Medal,
  Star,
} from "lucide-react";
import { useEvergreenQueue, useRemoveFromEvergreen } from "@/hooks/use-routing";
import { usePublications } from "@/hooks/use-routing-config";
import type { EvergreenQueueEntry } from "@/lib/types";

const TIER_ICONS: Record<string, React.ElementType> = {
  premium_a: Trophy,
  a: Award,
  b: Medal,
  c: Star,
};

const TIER_COLORS: Record<string, string> = {
  premium_a: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  a: "bg-green-500/10 text-green-600 border-green-500/20",
  b: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  c: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

export default function RoutingQueuesPage() {
  const { data: publications = [] } = usePublications();
  const { data: queueData, isLoading, error } = useEvergreenQueue();
  const removeMutation = useRemoveFromEvergreen();

  const [selectedItem, setSelectedItem] = useState<EvergreenQueueEntry | null>(null);

  // Extract queue items from response (API returns { queue, count })
  const queueItems: EvergreenQueueEntry[] = queueData?.queue || [];

  // Group items by publication
  const itemsByPublication = queueItems.reduce(
    (acc: Record<string, EvergreenQueueEntry[]>, item: EvergreenQueueEntry) => {
      const pub = item.publication_id || "unknown";
      if (!acc[pub]) acc[pub] = [];
      acc[pub].push(item);
      return acc;
    },
    {} as Record<string, EvergreenQueueEntry[]>
  );

  // Sort each publication's items by score (descending)
  Object.keys(itemsByPublication).forEach((pub) => {
    itemsByPublication[pub].sort((a: EvergreenQueueEntry, b: EvergreenQueueEntry) => b.score - a.score);
  });

  const getPublicationName = (pubId: string) => {
    return publications.find((p) => p.id === pubId)?.name || pubId;
  };

  // Publication slug lookup removed - not currently used

  const handleRemove = async () => {
    if (!selectedItem) return;
    if (!confirm("Remove this item from the evergreen queue?")) return;

    try {
      await removeMutation.mutateAsync(selectedItem.id);
      setSelectedItem(null);
    } catch {
      // Error handled by mutation
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString();
  };

  const getQueueStats = (pubId: string) => {
    const items = itemsByPublication[pubId] || [];
    const publication = publications.find((p) => p.id === pubId);
    const weeklyTarget = publication?.weekly_target || 3;
    const weeksOfBuffer = Math.floor(items.length / weeklyTarget);
    
    return {
      count: items.length,
      weeksOfBuffer,
      status: weeksOfBuffer >= 4 ? "healthy" : weeksOfBuffer >= 2 ? "warning" : "critical",
    };
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
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {publications.filter(p => p.is_active).map((pub) => {
          const stats = getQueueStats(pub.id);
          return (
            <Card
              key={pub.id}
              className={`${
                stats.status === "critical"
                  ? "border-red-500/50"
                  : stats.status === "warning"
                    ? "border-amber-500/50"
                    : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{pub.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      stats.status === "critical"
                        ? "bg-red-500/10 text-red-600 border-red-500/20"
                        : stats.status === "warning"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-green-500/10 text-green-600 border-green-500/20"
                    }
                  >
                    {stats.weeksOfBuffer}w buffer
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Queued items</span>
                  <span className="font-mono font-bold">{stats.count}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Weekly target</span>
                  <span className="font-mono">{pub.weekly_target}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error.message}
          </p>
        </div>
      )}

      {/* Queue Lists */}
      {Object.entries(itemsByPublication).map(([pubId, items]) => (
        <Card key={pubId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  {getPublicationName(pubId)} Queue
                </CardTitle>
                <CardDescription>
                  {(items as EvergreenQueueEntry[]).length} items • Sorted by score
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(items as EvergreenQueueEntry[]).map((item, index) => {
                const TierIcon = TIER_ICONS[item.tier.toLowerCase()] || Star;
                const tierColor = TIER_COLORS[item.tier.toLowerCase()] || TIER_COLORS.c;
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-mono">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={tierColor}>
                          <TierIcon className="h-3 w-3 mr-1" />
                          {item.tier.replace("_", " ").toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="font-mono">
                          {item.score.toFixed(1)}
                        </Badge>
                        {item.is_stale && (
                          <Badge variant="destructive" className="text-xs">
                            Stale
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        Added {formatDate(item.added_at)}
                        {item.idea_routing_id && (
                          <span className="font-mono">
                            • Idea: {item.idea_routing_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}

              {(items as EvergreenQueueEntry[]).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No items in queue</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(itemsByPublication).length === 0 && (
        <div className="text-center py-12">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No items in any evergreen queue</p>
          <p className="text-sm text-muted-foreground mt-2">
            Evergreen content will appear here when added from scored ideas
          </p>
        </div>
      )}

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Queue Item
            </DialogTitle>
            <DialogDescription>
              Manage this evergreen queue entry
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Score</span>
                <Badge variant="secondary" className="font-mono">
                  {selectedItem.score.toFixed(1)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tier</span>
                <Badge
                  variant="outline"
                  className={TIER_COLORS[selectedItem.tier.toLowerCase()]}
                >
                  {(() => {
                    const TierIcon = TIER_ICONS[selectedItem.tier.toLowerCase()];
                    return TierIcon && <TierIcon className="h-3 w-3 mr-1" />;
                  })()}
                  {selectedItem.tier.replace("_", " ").toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Publication</span>
                <span className="text-sm">
                  {getPublicationName(selectedItem.publication_id)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Added</span>
                <span className="text-sm">
                  {formatDate(selectedItem.added_at)}
                </span>
              </div>

              {selectedItem.is_stale && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant="destructive">Stale</Badge>
                </div>
              )}

              {selectedItem.idea_routing_id && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Linked Idea Routing</span>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-xs font-mono">
                        {selectedItem.idea_routing_id}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {selectedItem.pulled_at && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Pull History</span>
                    <div className="text-sm text-muted-foreground">
                      <p>Pulled: {formatDate(selectedItem.pulled_at)}</p>
                      {selectedItem.pulled_for_date && (
                        <p>For date: {formatDate(selectedItem.pulled_for_date)}</p>
                      )}
                      {selectedItem.pulled_reason && (
                        <p>Reason: {selectedItem.pulled_reason}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove from Queue
            </Button>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
