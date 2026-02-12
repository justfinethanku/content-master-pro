"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Plus,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  Trash2,
  ExternalLink,
  Clock,
  FileText,
  Key,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SyncManifest {
  id: string;
  source: string;
  last_sync_at: string | null;
  post_count: number;
  status: "idle" | "syncing" | "completed" | "error";
  error_message: string | null;
  sync_config: {
    newsletter_url?: string;
    display_name?: string;
    auth_cookie?: string;
    auto_sync?: boolean;
  };
  created_at: string;
}

interface ImportedPost {
  id: string;
  title: string;
  url: string | null;
  published_at: string | null;
  pinecone_id: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Check }> = {
  idle: { label: "Ready", color: "bg-muted text-muted-foreground", icon: Clock },
  syncing: { label: "Syncing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: RefreshCw },
  completed: { label: "Synced", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Check },
  error: { label: "Error", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertCircle },
};

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never synced";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = diffMs / (1000 * 60);
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${Math.floor(diffMins)}m ago`;
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return date.toLocaleDateString();
}

export default function SyncPage() {
  const [manifests, setManifests] = useState<SyncManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<ImportedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Add newsletter dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newNewsletterUrl, setNewNewsletterUrl] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newAuthCookie, setNewAuthCookie] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const supabase = createClient();

  const loadManifests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("sync_manifests")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setManifests(data || []);
    } catch (err) {
      console.error("Failed to load sync manifests:", err);
      setError(err instanceof Error ? err.message : "Failed to load newsletters");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadManifests();
  }, [loadManifests]);

  const loadPostsForSource = async (source: string) => {
    setPostsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("imported_posts")
        .select("id, title, url, published_at, pinecone_id")
        .eq("source", source)
        .order("published_at", { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;
      setExpandedPosts(data || []);
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  const toggleExpanded = (manifest: SyncManifest) => {
    if (expandedId === manifest.id) {
      setExpandedId(null);
      setExpandedPosts([]);
    } else {
      setExpandedId(manifest.id);
      loadPostsForSource(manifest.source);
    }
  };

  const extractSubdomain = (url: string): string => {
    // Handle formats like:
    // - limitededitionjonathan.substack.com
    // - https://limitededitionjonathan.substack.com
    // - https://limitededitionjonathan.substack.com/
    const cleaned = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const match = cleaned.match(/^([^.]+)\.substack\.com$/);
    return match ? match[1] : cleaned;
  };

  const addNewsletter = async () => {
    if (!newNewsletterUrl.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const subdomain = extractSubdomain(newNewsletterUrl.trim());
      const source = `${subdomain}_substack`;
      const feedUrl = `https://${subdomain}.substack.com/feed`;

      // Check if already exists
      const { data: existing } = await supabase
        .from("sync_manifests")
        .select("id")
        .eq("source", source)
        .single();

      if (existing) {
        setError("This newsletter is already configured");
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: insertError } = await supabase
        .from("sync_manifests")
        .insert({
          user_id: user.id,
          source,
          sync_config: {
            newsletter_url: feedUrl,
            display_name: newDisplayName.trim() || subdomain,
            auth_cookie: newAuthCookie.trim() || undefined,
            auto_sync: true,
          },
        });

      if (insertError) throw insertError;

      setAddDialogOpen(false);
      setNewNewsletterUrl("");
      setNewDisplayName("");
      setNewAuthCookie("");
      loadManifests();
    } catch (err) {
      console.error("Failed to add newsletter:", err);
      setError(err instanceof Error ? err.message : "Failed to add newsletter");
    } finally {
      setIsAdding(false);
    }
  };

  const syncNewsletter = async (manifest: SyncManifest) => {
    setSyncingIds((prev) => new Set(prev).add(manifest.id));

    try {
      // Update status to syncing
      await supabase
        .from("sync_manifests")
        .update({ status: "syncing", error_message: null })
        .eq("id", manifest.id);

      // Call the sync API
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifestId: manifest.id,
          source: manifest.source,
          feedUrl: manifest.sync_config.newsletter_url,
          authCookie: manifest.sync_config.auth_cookie,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Sync failed");
      }

      // Reload manifests to get updated counts
      loadManifests();
    } catch (err) {
      console.error("Sync failed:", err);
      await supabase
        .from("sync_manifests")
        .update({
          status: "error",
          error_message: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", manifest.id);
      loadManifests();
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(manifest.id);
        return next;
      });
    }
  };

  const deleteNewsletter = async () => {
    if (!deleteId) return;

    try {
      const manifest = manifests.find((m) => m.id === deleteId);
      if (!manifest) return;

      // Delete associated posts first
      await supabase
        .from("imported_posts")
        .delete()
        .eq("source", manifest.source);

      // Delete manifest
      await supabase
        .from("sync_manifests")
        .delete()
        .eq("id", deleteId);

      setDeleteId(null);
      loadManifests();
    } catch (err) {
      console.error("Failed to delete newsletter:", err);
      setError(err instanceof Error ? err.message : "Failed to delete newsletter");
    }
  };

  const syncAll = async () => {
    for (const manifest of manifests) {
      if (manifest.status !== "syncing") {
        await syncNewsletter(manifest);
      }
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Newsletters</h1>
          <p className="text-muted-foreground">
            Import posts from Substack newsletters to your content library.
          </p>
        </div>
        <div className="flex gap-2">
          {manifests.length > 0 && (
            <Button variant="outline" onClick={syncAll} disabled={syncingIds.size > 0}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncingIds.size > 0 ? "animate-spin" : ""}`} />
              Sync All
            </Button>
          )}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Newsletter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Newsletter</DialogTitle>
                <DialogDescription>
                  Enter the Substack newsletter URL to start syncing posts.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="newsletter-url">Newsletter URL</Label>
                  <Input
                    id="newsletter-url"
                    placeholder="e.g., limitededitionjonathan.substack.com"
                    value={newNewsletterUrl}
                    onChange={(e) => setNewNewsletterUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full URL or just the subdomain (e.g., "limitededitionjonathan")
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display Name (optional)</Label>
                  <Input
                    id="display-name"
                    placeholder="e.g., Jon's Newsletter"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <Key className="h-4 w-4" />
                    Paywalled Content (Advanced)
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-2">
                    <Label htmlFor="auth-cookie">Session Cookie (substack.sid)</Label>
                    <Input
                      id="auth-cookie"
                      type="password"
                      placeholder="Paste your substack.sid cookie value"
                      value={newAuthCookie}
                      onChange={(e) => setNewAuthCookie(e.target.value)}
                    />
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>
                        For paywalled newsletters you subscribe to: Open Substack, press F12,
                        go to Application → Cookies → substack.com, and copy the "substack.sid" value.
                        Valid for ~3 months.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addNewsletter} disabled={isAdding || !newNewsletterUrl.trim()}>
                  {isAdding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Newsletter"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {/* Info card for first-time users */}
      {manifests.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Getting Started with Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Sync imports posts from Substack newsletters directly into your content library.
              These posts are then indexed for semantic search so you can find relevant content
              while creating new posts.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Free Newsletters</h4>
                <p className="text-sm text-muted-foreground">
                  Just add the newsletter URL - full content is available via RSS.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Paywalled Newsletters</h4>
                <p className="text-sm text-muted-foreground">
                  If you're a subscriber, paste your session cookie to access full content.
                </p>
              </div>
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Newsletter
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Newsletter list */}
      <div className="space-y-4">
        {manifests.map((manifest) => {
          const config = STATUS_CONFIG[manifest.status] || STATUS_CONFIG.idle;
          const StatusIcon = config.icon;
          const isSyncing = syncingIds.has(manifest.id);
          const isExpanded = expandedId === manifest.id;

          return (
            <Card key={manifest.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {manifest.sync_config.display_name || manifest.source}
                      {manifest.sync_config.auth_cookie && (
                        <Badge variant="outline" className="text-xs">
                          <Key className="mr-1 h-3 w-3" />
                          Auth
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {manifest.post_count} posts
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(manifest.last_sync_at)}
                      </span>
                      {manifest.sync_config.newsletter_url && (
                        <a
                          href={manifest.sync_config.newsletter_url.replace("/feed", "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={config.color}>
                      <StatusIcon className={`mr-1 h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Syncing..." : config.label}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncNewsletter(manifest)}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(manifest.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {manifest.error_message && (
                  <p className="text-sm text-destructive mt-2">{manifest.error_message}</p>
                )}
              </CardHeader>

              {/* Expandable posts section */}
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(manifest)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start px-6 py-2">
                    <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    {isExpanded ? "Hide" : "Show"} recent posts
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {postsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : expandedPosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No posts synced yet. Click "Sync" to import posts.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {expandedPosts.map((post) => (
                          <div
                            key={post.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{post.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {post.published_at
                                  ? new Date(post.published_at).toLocaleDateString()
                                  : "Unknown date"}
                                {post.pinecone_id && (
                                  <span className="ml-2 text-green-600">● Indexed</span>
                                )}
                              </p>
                            </div>
                            {post.url && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={post.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        ))}
                        {expandedPosts.length >= 20 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            Showing most recent 20 posts
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the newsletter configuration and delete all imported posts.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteNewsletter}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
