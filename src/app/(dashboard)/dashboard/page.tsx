import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Brain, Search, FileText, History, Sparkles, ArrowRight, RefreshCw, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface RecentSession {
  id: string;
  status: string;
  title: string | null;
  updated_at: string;
  brain_dump_preview?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  brain_dump: { label: "Brain Dump", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  research: { label: "Research", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  outline: { label: "Outline", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  draft: { label: "Draft", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  review: { label: "Review", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  outputs: { label: "Outputs", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return date.toLocaleDateString();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch stats in parallel
  const [
    { count: activeCount },
    { count: completedCount },
    { count: postsCount },
    { count: outputsCount },
    { data: recentSessions },
    { data: syncStatus },
  ] = await Promise.all([
    // Active sessions (not completed)
    supabase
      .from("content_sessions")
      .select("*", { count: "exact", head: true })
      .neq("status", "completed"),
    // Completed sessions
    supabase
      .from("content_sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    // Imported posts
    supabase
      .from("imported_posts")
      .select("*", { count: "exact", head: true }),
    // Outputs this month
    supabase
      .from("content_outputs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    // Recent sessions
    supabase
      .from("content_sessions")
      .select(`
        id,
        status,
        title,
        updated_at,
        content_brain_dumps(raw_content)
      `)
      .order("updated_at", { ascending: false })
      .limit(5),
    // Sync manifests for status
    supabase
      .from("sync_manifests")
      .select("source, last_sync_at, post_count, status")
      .order("last_sync_at", { ascending: false }),
  ]);

  // Process recent sessions
  const sessions: RecentSession[] = (recentSessions || []).map((s: any) => ({
    id: s.id,
    status: s.status,
    title: s.title || s.content_brain_dumps?.[0]?.raw_content?.slice(0, 50) + "..." || "Untitled",
    updated_at: s.updated_at,
  }));

  // Calculate sync summary
  const totalSyncedPosts = (syncStatus || []).reduce((sum: number, s: any) => sum + (s.post_count || 0), 0);
  const lastSyncTime = syncStatus?.[0]?.last_sync_at;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to Content Master Pro. Start creating or explore your content library.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/create">
            <Sparkles className="mr-2 h-5 w-5" />
            Create New
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Active Sessions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeCount || 0}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Posts Indexed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{postsCount || totalSyncedPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {lastSyncTime ? `Last sync ${formatRelativeTime(lastSyncTime)}` : "In content library"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Completed</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{completedCount || 0}</div>
            <p className="text-xs text-muted-foreground">Content sessions</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Outputs</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{outputsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Generated this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
            <CardDescription className="text-muted-foreground">
              Start a new content session or search your library
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="w-full justify-start">
              <Link href="/create">
                <Brain className="mr-2 h-4 w-4" />
                New Brain Dump
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/search">
                <Search className="mr-2 h-4 w-4" />
                Search Content Library
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/history">
                <History className="mr-2 h-4 w-4" />
                View Past Sessions
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/sync">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Newsletters
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Recent Sessions</CardTitle>
              <CardDescription className="text-muted-foreground">
                Your latest content sessions
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/history">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.brain_dump;
                  return (
                    <Link
                      key={session.id}
                      href={`/history`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(session.updated_at)}
                        </p>
                      </div>
                      <Badge variant="secondary" className={config.color}>
                        {config.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No sessions yet. Start a brain dump to get going!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
