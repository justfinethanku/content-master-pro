"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Lightbulb,
  Calendar,
  Inbox,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Loader2,
  Trophy,
  Award,
  Medal,
  Star,
} from "lucide-react";
import { useRoutingDashboard } from "@/hooks/use-routing";

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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  intake: { label: "Intake", color: "bg-blue-500/10 text-blue-600" },
  routed: { label: "Routed", color: "bg-purple-500/10 text-purple-600" },
  scored: { label: "Scored", color: "bg-amber-500/10 text-amber-600" },
  slotted: { label: "Slotted", color: "bg-cyan-500/10 text-cyan-600" },
  scheduled: { label: "Scheduled", color: "bg-green-500/10 text-green-600" },
  published: { label: "Published", color: "bg-emerald-500/10 text-emerald-600" },
  killed: { label: "Killed", color: "bg-red-500/10 text-red-600" },
};

export default function RoutingDashboardPage() {
  const { data, isLoading, error } = useRoutingDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <p className="text-sm text-destructive mt-2">{error?.message}</p>
      </div>
    );
  }

  const { stats = {}, alerts = [] } = data;
  
  // Provide defaults for stats properties
  const byStatus = stats.byStatus || {};
  const byTier = stats.byTier || {};
  const scheduledThisWeek = stats.scheduledThisWeek || 0;
  const evergreenBuffer = stats.evergreenBuffer || 0;
  
  // Calculate totals
  const totalInPipeline = Object.entries(byStatus)
    .filter(([status]) => !['published', 'killed'].includes(status))
    .reduce((sum, [, count]) => sum + (count as number), 0);

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: { type: string; message: string }, i: number) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                alert.type === "warning"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                  : alert.type === "error"
                    ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400"
              }`}
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInPipeline}</div>
            <p className="text-xs text-muted-foreground">Ideas being processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledThisWeek}</div>
            <p className="text-xs text-muted-foreground">Content pieces scheduled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evergreen Buffer</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evergreenBuffer}</div>
            <p className="text-xs text-muted-foreground">Pieces in queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Action</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((byStatus.intake as number) || 0) + ((byStatus.routed as number) || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Need scoring or routing</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown & Tier Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pipeline Status</CardTitle>
              <CardDescription>Ideas by workflow stage</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/routing/ideas">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byStatus).map(([status, count]) => {
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.intake;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={config.color}>
                        {config.label}
                      </Badge>
                    </div>
                    <span className="font-mono text-sm">{count as number}</span>
                  </div>
                );
              })}
              {Object.keys(byStatus).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ideas in pipeline yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Distribution</CardTitle>
            <CardDescription>Scored content by tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byTier).map(([tier, count]) => {
                const Icon = TIER_ICONS[tier.toLowerCase()] || Star;
                const color = TIER_COLORS[tier.toLowerCase()] || TIER_COLORS.c;
                return (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {tier.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                    <span className="font-mono text-sm">{count as number}</span>
                  </div>
                );
              })}
              {Object.keys(byTier).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scored content yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common routing tasks</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/routing/ideas?status=intake">
              <Lightbulb className="mr-2 h-4 w-4" />
              Review Intake ({(byStatus.intake as number) || 0})
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/routing/ideas?status=routed">
              <CheckCircle className="mr-2 h-4 w-4" />
              Score Routed ({(byStatus.routed as number) || 0})
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/routing/calendar">
              <Calendar className="mr-2 h-4 w-4" />
              View Calendar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/routing/queues">
              <Inbox className="mr-2 h-4 w-4" />
              Manage Queues
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
