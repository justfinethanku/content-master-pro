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
import { Partner } from "@/lib/types";
import { Key, Plus, Copy, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";

interface ApiKeyDisplay {
  id: string;
  key_prefix: string;
  name: string;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function PartnerKeysPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    loadPartnerData();
  }, []);

  async function loadPartnerData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: partnerData, error } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !partnerData) {
      router.push("/partner/redeem");
      return;
    }

    setPartner(partnerData as Partner);
    await loadKeys();
  }

  async function loadKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (error) {
      console.error("Error loading keys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/partner/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key.fullKey);
        setKeys([data.key, ...keys]);
        setNewKeyName("");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create key");
      }
    } catch (error) {
      console.error("Error creating key:", error);
      alert("Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    try {
      const res = await fetch(`/api/partner/keys?id=${keyId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setKeys(
          keys.map((k) => (k.id === keyId ? { ...k, status: "revoked" } : k))
        );
      }
    } catch (error) {
      console.error("Error revoking key:", error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function closeNewKeyDialog() {
    setNewKey(null);
    setCreateOpen(false);
    setShowKey(false);
  }

  if (loading || !partner) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const activeKeys = keys.filter((k) => k.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-muted-foreground">
            Manage your API keys for programmatic access
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) closeNewKeyDialog();
            else setCreateOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={activeKeys.length >= 5}>
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Store this key securely. It will not be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                    <AlertTriangle className="h-4 w-4" />
                    This is the only time you&apos;ll see this key!
                  </div>
                  <div className="relative">
                    <Input
                      value={showKey ? newKey : "•".repeat(40)}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(newKey)}
                      >
                        {copiedKey ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={closeNewKeyDialog}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <form onSubmit={handleCreateKey}>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for programmatic access to the Partner
                    API.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Production, Development"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      A friendly name to help you identify this key
                    </p>
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
                  <Button type="submit" disabled={creating || !newKeyName.trim()}>
                    {creating ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {activeKeys.length >= 5 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          Maximum of 5 active keys allowed. Revoke an existing key to create a
          new one.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {activeKeys.length} active key{activeKeys.length !== 1 ? "s" : ""} of
            5 maximum
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No API keys yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first API key to start using the Partner API
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm text-foreground">
                        {key.key_prefix}...
                      </span>
                      <Badge
                        variant={
                          key.status === "active" ? "default" : "destructive"
                        }
                      >
                        {key.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {key.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && (
                        <>
                          {" "}
                          &middot; Last used:{" "}
                          {new Date(key.last_used_at).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  {key.status === "active" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately invalidate the key. Any
                            applications using this key will stop working.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevokeKey(key.id)}
                          >
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
