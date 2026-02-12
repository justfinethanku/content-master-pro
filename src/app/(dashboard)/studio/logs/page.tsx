"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Clock,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";

interface AICallLog {
  id: string;
  session_id: string | null;
  prompt_set_slug: string | null;
  full_prompt: string;
  full_response: string;
  model_id: string;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AICallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AICallLog | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("ai_call_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Call Logs</h1>
          <p className="text-muted-foreground">
            View all outgoing prompts and incoming responses
          </p>
        </div>
        <Button onClick={fetchLogs} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No AI calls logged yet. Generate some content to see logs here.
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            const hasError = !!log.error_message;

            return (
              <Card
                key={log.id}
                className={hasError ? "border-destructive/50" : ""}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={hasError ? "destructive" : "secondary"}>
                        {log.prompt_set_slug || "unknown"}
                      </Badge>
                      <span className="text-sm text-muted-foreground font-mono">
                        {log.model_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {log.tokens_in !== null && log.tokens_out !== null && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {log.tokens_in} → {log.tokens_out} tokens
                        </span>
                      )}
                      {log.duration_ms !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(log.duration_ms / 1000).toFixed(2)}s
                        </span>
                      )}
                      <span>{formatTimestamp(log.created_at)}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="py-3 px-4 pt-0">
                  {hasError && (
                    <div className="mb-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                      <strong>Error:</strong> {log.error_message}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* Prompt Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          Prompt Sent
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(log.full_prompt, `prompt-${log.id}`)}
                        >
                          {copiedId === `prompt-${log.id}` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="bg-muted/50 rounded p-2 text-xs font-mono whitespace-pre-wrap break-words max-h-24 overflow-hidden">
                        {truncateText(log.full_prompt, 300)}
                      </div>
                    </div>

                    {/* Response Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          Response Received
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(log.full_response, `response-${log.id}`)}
                        >
                          {copiedId === `response-${log.id}` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="bg-muted/50 rounded p-2 text-xs font-mono whitespace-pre-wrap break-words max-h-24 overflow-hidden">
                        {truncateText(log.full_response, 300)}
                      </div>
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <div className="flex justify-center mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                      className="text-xs"
                    >
                      View Full Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedLog?.prompt_set_slug || "unknown"}
              </Badge>
              <span className="text-sm font-mono text-muted-foreground">
                {selectedLog?.model_id}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 max-h-[60vh]">
              {/* Metadata */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{formatTimestamp(selectedLog.created_at)}</span>
                {selectedLog.tokens_in !== null && (
                  <span>Tokens in: {selectedLog.tokens_in}</span>
                )}
                {selectedLog.tokens_out !== null && (
                  <span>Tokens out: {selectedLog.tokens_out}</span>
                )}
                {selectedLog.duration_ms !== null && (
                  <span>Duration: {(selectedLog.duration_ms / 1000).toFixed(2)}s</span>
                )}
                {selectedLog.session_id && (
                  <span className="font-mono text-xs">
                    Session: {selectedLog.session_id.slice(0, 8)}...
                  </span>
                )}
              </div>

              {selectedLog.error_message && (
                <div className="p-3 bg-destructive/10 rounded text-destructive">
                  <strong>Error:</strong> {selectedLog.error_message}
                </div>
              )}

              {/* Full Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Full Prompt</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedLog.full_prompt, "dialog-prompt")}
                  >
                    {copiedId === "dialog-prompt" ? (
                      <>
                        <Check className="h-3 w-3 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-muted rounded p-4 text-sm font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {selectedLog.full_prompt}
                </div>
              </div>

              {/* Full Response */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Full Response</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedLog.full_response, "dialog-response")}
                  >
                    {copiedId === "dialog-response" ? (
                      <>
                        <Check className="h-3 w-3 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-muted rounded p-4 text-sm font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {selectedLog.full_response}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
