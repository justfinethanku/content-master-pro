"use client";

import { useState, useEffect, useCallback } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Activity, BarChart3, CalendarDays } from "lucide-react";

interface Subscriber {
  id: string;
  name: string;
  email: string;
  created_at: string;
  last_used_at: string | null;
  total_requests: number;
  is_revoked: boolean;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isActiveThisWeek(lastUsed: string | null): boolean {
  if (!lastUsed) return false;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return new Date(lastUsed) > weekAgo;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function ExecutiveMcpPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/executive-mcp/subscribers");
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
      }
    } catch (error) {
      console.error("Error loading subscribers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/executive-mcp/subscribers?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSubscribers(
          subscribers.map((s) =>
            s.id === id ? { ...s, is_revoked: true } : s
          )
        );
      }
    } catch (error) {
      console.error("Error revoking subscriber:", error);
    }
  }

  const active = subscribers.filter((s) => !s.is_revoked);
  const activeThisWeek = active.filter((s) =>
    isActiveThisWeek(s.last_used_at)
  );
  const totalRequests = subscribers.reduce(
    (sum, s) => sum + s.total_requests,
    0
  );
  const requestsToday = subscribers.filter((s) =>
    isToday(s.last_used_at)
  ).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Executive Circle MCP
        </h1>
        <p className="text-muted-foreground">
          Subscriber access to the read-only content library
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {active.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total subscribers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {activeThisWeek.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Active this week
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalRequests.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total requests
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {requestsToday}
                </p>
                <p className="text-xs text-muted-foreground">Active today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscribers table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
          <CardDescription>
            {subscribers.length} total &middot; {active.length} active
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading subscribers...</p>
          ) : subscribers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No subscribers yet
              </p>
              <p className="text-sm text-muted-foreground">
                Subscribers register at promptkits.natebjones.com/executive/mcp
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {subscribers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {s.name}
                      </span>
                      {s.is_revoked ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Registered {formatDate(s.created_at)}</span>
                      <span>
                        Last active {formatDateTime(s.last_used_at)}
                      </span>
                      <span>
                        {s.total_requests.toLocaleString()} requests
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {!s.is_revoked && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                          >
                            Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Revoke access?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately disconnect{" "}
                              <strong>{s.name}</strong> ({s.email}) from
                              the Executive Circle MCP. They will not be
                              able to reconnect with their current token.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevoke(s.id)}
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
