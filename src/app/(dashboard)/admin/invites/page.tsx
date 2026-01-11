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
import { PartnerInvite } from "@/lib/types";
import { Mail, Plus, Copy, Check, X, Clock } from "lucide-react";

export default function AdminInvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadInvites();
  }, []);

  async function checkAdminAndLoadInvites() {
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
    await loadInvites();
  }

  async function loadInvites() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error("Error loading invites:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          expires_in_days: parseInt(expiresInDays),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInvites([data.invite, ...invites]);
        setCreateOpen(false);
        setNewEmail("");
        setExpiresInDays("7");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create invite");
      }
    } catch (error) {
      console.error("Error creating invite:", error);
      alert("Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    try {
      const res = await fetch(`/api/admin/invites?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setInvites(
          invites.map((inv) =>
            inv.id === id ? { ...inv, status: "revoked" } : inv
          )
        );
      }
    } catch (error) {
      console.error("Error revoking invite:", error);
    }
  }

  function copyToClipboard(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "redeemed":
        return <Badge variant="default"><Check className="mr-1 h-3 w-3" />Redeemed</Badge>;
      case "expired":
        return <Badge variant="outline"><X className="mr-1 h-3 w-3" />Expired</Badge>;
      case "revoked":
        return <Badge variant="destructive"><X className="mr-1 h-3 w-3" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Partner Invites</h1>
          <p className="text-muted-foreground">
            Create and manage partner invite codes
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Invite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateInvite}>
              <DialogHeader>
                <DialogTitle>Create Partner Invite</DialogTitle>
                <DialogDescription>
                  Generate an invite code for a new partner. They will need to sign
                  up with this email address to redeem it.
                </DialogDescription>
              </DialogHeader>
              <div className="my-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Partner Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="partner@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires">Expires In (days)</Label>
                  <Input
                    id="expires"
                    type="number"
                    min="1"
                    max="30"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
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
                  {creating ? "Creating..." : "Create Invite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invites</CardTitle>
          <CardDescription>
            {invites.length} total invites
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading invites...</p>
          ) : invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No invites yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first invite to onboard a partner
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {invite.code}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(invite.code)}
                      >
                        {copiedCode === invite.code ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invite.status)}
                    {invite.status === "pending" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Invite?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently invalidate the invite code. The
                              partner will not be able to use it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevokeInvite(invite.id)}
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
