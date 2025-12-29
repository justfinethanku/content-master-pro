"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  MoreVertical,
  Play,
  Eye,
  Sparkles,
  Trash2,
  Loader2,
  AlertCircle,
  Brain,
  Search,
  FileText,
  Edit,
  CheckCircle,
  Image,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ContentSession {
  id: string;
  user_id: string;
  status: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  brain_dump?: { raw_content: string; extracted_themes: any };
  outputs_count?: number;
  images_count?: number;
}

interface GeneratedImage {
  id: string;
  public_url: string | null;
  prompt: string;
  model_used: string;
  created_at: string;
}

const STATUS_ORDER = ["brain_dump", "research", "outline", "draft", "review", "outputs", "completed"];

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; route: string }> = {
  brain_dump: {
    label: "Brain Dump",
    icon: Brain,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    route: "/create",
  },
  research: {
    label: "Research",
    icon: Search,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    route: "/research",
  },
  outline: {
    label: "Outline",
    icon: FileText,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    route: "/outline",
  },
  draft: {
    label: "Draft",
    icon: Edit,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    route: "/draft",
  },
  review: {
    label: "Review",
    icon: Eye,
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    route: "/draft",
  },
  outputs: {
    label: "Outputs",
    icon: Image,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    route: "/outputs",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    route: "/outputs",
  },
};

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ContentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteSession, setDeleteSession] = useState<ContentSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewSession, setViewSession] = useState<ContentSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);

  const supabase = createClient();

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("content_sessions")
        .select(`
          *,
          content_brain_dumps(raw_content, extracted_themes),
          content_outputs(id),
          generated_images(id)
        `)
        .order("updated_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Process sessions to include counts
      const processed = (data || []).map((session: any) => ({
        ...session,
        brain_dump: session.content_brain_dumps?.[0],
        outputs_count: session.content_outputs?.length || 0,
        images_count: session.generated_images?.length || 0,
      }));

      setSessions(processed);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, statusFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleContinue = (session: ContentSession) => {
    const config = STATUS_CONFIG[session.status];
    if (config) {
      router.push(`${config.route}?session_id=${session.id}`);
    }
  };

  const handleView = async (session: ContentSession) => {
    setViewSession(session);

    // Load full session details including images
    const { data } = await supabase
      .from("content_sessions")
      .select(`
        *,
        content_brain_dumps(*),
        content_research(*),
        content_outlines(*),
        content_drafts(*),
        content_outputs(*),
        generated_images(id, public_url, prompt, model_used, created_at)
      `)
      .eq("id", session.id)
      .single();

    setSessionDetails(data);
  };

  const handleGenerateMore = async (session: ContentSession) => {
    // Check what content exists to determine the best next step
    const { data } = await supabase
      .from("content_sessions")
      .select(`
        content_drafts(id),
        content_outlines(id),
        content_research(id)
      `)
      .eq("id", session.id)
      .single();

    const drafts = data?.content_drafts ?? [];
    const outlines = data?.content_outlines ?? [];
    const research = data?.content_research ?? [];

    if (drafts.length > 0) {
      // Has draft → go to outputs
      router.push(`/outputs?session_id=${session.id}`);
    } else if (outlines.length > 0) {
      // Has outline but no draft → go to draft
      router.push(`/draft?session_id=${session.id}`);
    } else if (research.length > 0) {
      // Has research but no outline → go to outline
      router.push(`/outline?session_id=${session.id}`);
    } else {
      // No content yet - nothing to generate more from
      setError("This session doesn't have enough content yet. Try continuing from where you left off.");
    }
  };

  const handleDelete = async () => {
    if (!deleteSession) return;

    setIsDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from("content_sessions")
        .delete()
        .eq("id", deleteSession.id);

      if (deleteError) throw deleteError;

      setSessions((prev) => prev.filter((s) => s.id !== deleteSession.id));
      setDeleteSession(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
      setError(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  };

  const getProgressSteps = (currentStatus: string) => {
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    return STATUS_ORDER.map((status, index) => ({
      status,
      completed: index < currentIndex,
      current: index === currentIndex,
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return "Just now";
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getSessionTitle = (session: ContentSession): string => {
    if (session.title) return session.title;
    if (session.brain_dump?.extracted_themes?.themes?.[0]?.theme) {
      return session.brain_dump.extracted_themes.themes[0].theme;
    }
    if (session.brain_dump?.raw_content) {
      return session.brain_dump.raw_content.slice(0, 50) + "...";
    }
    return "Untitled Session";
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
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground">
            View and manage your past content sessions.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            {STATUS_ORDER.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_CONFIG[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              {statusFilter === "all"
                ? "No content sessions yet. Start by creating a brain dump!"
                : `No sessions with status "${STATUS_CONFIG[statusFilter]?.label}"`}
            </p>
            <Button className="mt-4" onClick={() => router.push("/create")}>
              <Brain className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const statusConfig = STATUS_CONFIG[session.status];
            const StatusIcon = statusConfig?.icon || Brain;

            return (
              <Card key={session.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {getSessionTitle(session)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span>{formatDate(session.updated_at)}</span>
                        {(session.outputs_count ?? 0) > 0 && (
                          <span>• {session.outputs_count} outputs</span>
                        )}
                        {(session.images_count ?? 0) > 0 && (
                          <span>• {session.images_count} images</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={statusConfig?.color}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusConfig?.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleContinue(session)}>
                            <Play className="mr-2 h-4 w-4" />
                            Continue
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleView(session)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerateMore(session)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate More
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteSession(session)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Steps */}
                  <div className="flex items-center gap-1">
                    {getProgressSteps(session.status).map((step, index) => {
                      const StepConfig = STATUS_CONFIG[step.status];
                      return (
                        <div key={step.status} className="flex items-center">
                          <div
                            className={`w-6 h-1 rounded-full ${
                              step.completed
                                ? "bg-primary"
                                : step.current
                                ? "bg-primary/50"
                                : "bg-muted"
                            }`}
                            title={StepConfig?.label}
                          />
                          {index < STATUS_ORDER.length - 1 && (
                            <div className="w-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteSession && getSessionTitle(deleteSession)}"?
              This will permanently delete all brain dumps, research, outlines, drafts, and outputs
              associated with this session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSession(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Session Dialog */}
      <Dialog open={!!viewSession} onOpenChange={(open) => !open && setViewSession(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewSession && getSessionTitle(viewSession)}</DialogTitle>
            <DialogDescription>
              Created {viewSession && formatDate(viewSession.created_at)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {sessionDetails && (
              <div className="space-y-6">
                {/* Brain Dump */}
                {sessionDetails.content_brain_dumps?.[0] && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Brain Dump
                    </h3>
                    <pre className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                      {sessionDetails.content_brain_dumps[0].raw_content}
                    </pre>
                  </div>
                )}

                {/* Research */}
                {sessionDetails.content_research?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Research ({sessionDetails.content_research.length})
                    </h3>
                    {sessionDetails.content_research.map((r: any, i: number) => (
                      <div key={i} className="text-sm bg-muted p-3 rounded-lg mb-2">
                        <p className="font-medium">{r.query}</p>
                        <p className="text-muted-foreground mt-1 line-clamp-3">{r.response}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Draft */}
                {sessionDetails.content_drafts?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Draft
                    </h3>
                    <pre className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap line-clamp-10">
                      {sessionDetails.content_drafts[0].content}
                    </pre>
                  </div>
                )}

                {/* Outputs */}
                {sessionDetails.content_outputs?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Outputs ({sessionDetails.content_outputs.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {sessionDetails.content_outputs.map((o: any) => (
                        <Badge key={o.id} variant="secondary">
                          {o.output_type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated Images */}
                {sessionDetails.generated_images?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Generated Images ({sessionDetails.generated_images.length})
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {sessionDetails.generated_images.map((img: GeneratedImage) => (
                        <div key={img.id} className="relative rounded-lg overflow-hidden border">
                          {img.public_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img.public_url}
                              alt={img.prompt.slice(0, 50)}
                              className="w-full h-auto object-cover"
                            />
                          ) : (
                            <div className="w-full h-24 bg-muted flex items-center justify-center">
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-xs text-white truncate" title={img.prompt}>
                              {img.prompt.slice(0, 40)}...
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewSession(null)}>
              Close
            </Button>
            <Button onClick={() => viewSession && handleContinue(viewSession)}>
              <Play className="mr-2 h-4 w-4" />
              Continue Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
