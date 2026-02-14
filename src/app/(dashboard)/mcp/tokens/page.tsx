"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { Plus, Copy, Check, X, Key, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface McpToken {
  id: string;
  token: string;
  user_id: string | null;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function McpTokensPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTokenUrl, setNewTokenUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    setIsAdmin(true);
    await loadTokens();
  }

  async function loadTokens() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/mcp-tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch (error) {
      console.error("Error loading tokens:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/admin/mcp-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });

      if (res.ok) {
        const data = await res.json();
        setTokens([data.token, ...tokens]);
        setNewTokenUrl(data.url);
        setNewLabel("");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create token");
      }
    } catch (error) {
      console.error("Error creating token:", error);
      alert("Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/admin/mcp-tokens?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTokens(
          tokens.map((t) =>
            t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t
          )
        );
      }
    } catch (error) {
      console.error("Error revoking token:", error);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getConnectorUrl(token: string) {
    return `https://www.contentmasterpro.limited/api/mcp/${token}`;
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Link href="/mcp">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">MCP tokens</h1>
          <p className="text-muted-foreground">
            Create and manage MCP connector tokens
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setNewTokenUrl(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create token
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newTokenUrl ? (
              <>
                <DialogHeader>
                  <DialogTitle>Token created</DialogTitle>
                  <DialogDescription>
                    Copy this connector URL and send it to the user. They paste it into
                    Claude Desktop &rarr; Settings &rarr; Connectors &rarr; Add custom connector.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-3">
                  <Label>Connector URL</Label>
                  <div className="relative group">
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono text-foreground break-all whitespace-pre-wrap">
                      {newTokenUrl}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-7 w-7"
                      onClick={() => copyToClipboard(newTokenUrl, "new-url")}
                    >
                      {copiedId === "new-url" ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This URL contains the API key. Treat it like a password.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateOpen(false);
                      setNewTokenUrl(null);
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create MCP token</DialogTitle>
                  <DialogDescription>
                    Generate a new connector URL. Label it so you know who it&apos;s for.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Label</Label>
                    <Input
                      id="label"
                      placeholder='e.g. "Jon - Claude Desktop" or "Nate - laptop"'
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create token"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
          <CardDescription>
            {tokens.length} total &middot; {tokens.filter((t) => !t.revoked_at).length} active
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading tokens...</p>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No tokens yet</p>
              <p className="text-sm text-muted-foreground">
                Create a token to give someone MCP access
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{t.label}</span>
                      {t.revoked_at ? (
                        <Badge variant="destructive">
                          <X className="mr-1 h-3 w-3" />Revoked
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                        {t.token.slice(0, 12)}...{t.token.slice(-4)}
                      </code>
                      {!t.revoked_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => copyToClipboard(getConnectorUrl(t.token), t.id)}
                        >
                          {copiedId === t.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(t.created_at)}
                      {t.last_used_at && <> &middot; Last used {formatDate(t.last_used_at)}</>}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {!t.revoked_at && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke token?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately disconnect &ldquo;{t.label}&rdquo; from the MCP server.
                              They will need a new token to reconnect.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRevoke(t.id)}>
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
