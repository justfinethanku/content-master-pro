"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { Partner, PartnerApiKey } from "@/lib/types";
import { ArrowLeft, Key, Save } from "lucide-react";
import Link from "next/link";

interface PermissionRow {
  namespace_id: string;
  namespace_slug: string;
  namespace_name: string;
  can_read: boolean;
  can_write: boolean;
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [apiKeys, setApiKeys] = useState<Partial<PartnerApiKey>[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Editable fields
  const [status, setStatus] = useState<string>("active");
  const [rateLimitMinute, setRateLimitMinute] = useState("60");
  const [rateLimitDay, setRateLimitDay] = useState("5000");

  useEffect(() => {
    checkAdminAndLoadPartner();
  }, [id]);

  async function checkAdminAndLoadPartner() {
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
    await loadPartner();
    await loadPermissions();
  }

  async function loadPartner() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partners?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setPartner(data.partner);
        setApiKeys(data.apiKeys || []);
        setStatus(data.partner.status);
        setRateLimitMinute(data.partner.rate_limit_per_minute.toString());
        setRateLimitDay(data.partner.rate_limit_per_day.toString());
      }
    } catch (error) {
      console.error("Error loading partner:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions() {
    try {
      const res = await fetch(`/api/admin/partners/permissions?partnerId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.matrix || []);
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
  }

  async function handleSavePartner() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          rate_limit_per_minute: parseInt(rateLimitMinute),
          rate_limit_per_day: parseInt(rateLimitDay),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPartner(data.partner);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save");
      }
    } catch (error) {
      console.error("Error saving partner:", error);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePermissionChange(
    namespaceId: string,
    field: "can_read" | "can_write",
    value: boolean
  ) {
    // Update local state immediately
    setPermissions((prev) =>
      prev.map((p) =>
        p.namespace_id === namespaceId ? { ...p, [field]: value } : p
      )
    );

    // Save to server
    const perm = permissions.find((p) => p.namespace_id === namespaceId);
    if (!perm) return;

    try {
      await fetch("/api/admin/partners/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: id,
          namespaceId,
          canRead: field === "can_read" ? value : perm.can_read,
          canWrite: field === "can_write" ? value : perm.can_write,
        }),
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      // Revert on error
      setPermissions((prev) =>
        prev.map((p) =>
          p.namespace_id === namespaceId ? { ...p, [field]: !value } : p
        )
      );
    }
  }

  async function handleRevokeKey(keyId: string) {
    try {
      const res = await fetch(`/api/admin/partners?keyId=${keyId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setApiKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, status: "revoked" } : k))
        );
      } else {
        const error = await res.json();
        alert(error.error || "Failed to revoke key");
      }
    } catch (error) {
      console.error("Error revoking key:", error);
      alert("Failed to revoke key");
    }
  }

  if (!isAdmin || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Partner not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/partners">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {partner.organization_name}
          </h1>
          <p className="text-muted-foreground">{partner.contact_email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Partner Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Settings</CardTitle>
            <CardDescription>
              Manage status and rate limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate-minute">Rate Limit (per minute)</Label>
              <Input
                id="rate-minute"
                type="number"
                min="1"
                value={rateLimitMinute}
                onChange={(e) => setRateLimitMinute(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate-day">Rate Limit (per day)</Label>
              <Input
                id="rate-day"
                type="number"
                min="1"
                value={rateLimitDay}
                onChange={(e) => setRateLimitDay(e.target.value)}
              />
            </div>

            <Button onClick={handleSavePartner} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              {apiKeys.length} keys issued
            </CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No API keys created yet
              </p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded border border-border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{key.key_prefix}...</span>
                        <Badge
                          variant={key.status === "active" ? "default" : "destructive"}
                        >
                          {key.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {key.name} &middot; Last used:{" "}
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    {key.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeKey(key.id!)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Namespace Permissions</CardTitle>
          <CardDescription>
            Control which namespaces this partner can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No namespaces configured
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Namespace
                    </th>
                    <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                      Read
                    </th>
                    <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                      Write
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => (
                    <tr key={perm.namespace_id} className="border-b border-border">
                      <td className="py-3">
                        <div>
                          <span className="font-medium text-foreground">
                            {perm.namespace_name}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({perm.namespace_slug})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <Switch
                          checked={perm.can_read}
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              perm.namespace_id,
                              "can_read",
                              checked
                            )
                          }
                        />
                      </td>
                      <td className="py-3 text-center">
                        <Switch
                          checked={perm.can_write}
                          onCheckedChange={(checked) =>
                            handlePermissionChange(
                              perm.namespace_id,
                              "can_write",
                              checked
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
