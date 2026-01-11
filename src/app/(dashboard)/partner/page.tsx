"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Partner, PartnerNamespacePermissionWithNamespace } from "@/lib/types";
import {
  Key,
  BarChart3,
  Search,
  BookOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface UsageSummary {
  todayCalls: number;
  monthCalls: number;
  successRate: number;
}

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [permissions, setPermissions] = useState<
    PartnerNamespacePermissionWithNamespace[]
  >([]);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [usage, setUsage] = useState<UsageSummary>({
    todayCalls: 0,
    monthCalls: 0,
    successRate: 100,
  });
  const [loading, setLoading] = useState(true);

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

    // Get partner record
    const { data: partnerData, error: partnerError } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (partnerError || !partnerData) {
      router.push("/partner/redeem");
      return;
    }

    setPartner(partnerData as Partner);

    // Get permissions
    const { data: perms } = await supabase
      .from("partner_namespace_permissions")
      .select(
        `
        *,
        pinecone_namespaces (*)
      `
      )
      .eq("partner_id", partnerData.id);

    setPermissions((perms as PartnerNamespacePermissionWithNamespace[]) || []);

    // Get API key count
    const { count } = await supabase
      .from("partner_api_keys")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partnerData.id)
      .eq("status", "active");

    setApiKeyCount(count || 0);

    // Get usage summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: usageData } = await supabase
      .from("partner_api_usage")
      .select("status_code, created_at")
      .eq("partner_id", partnerData.id)
      .gte("created_at", monthStart.toISOString());

    if (usageData) {
      const todayCalls = usageData.filter(
        (u) => new Date(u.created_at) >= today
      ).length;
      const successfulCalls = usageData.filter(
        (u) => u.status_code >= 200 && u.status_code < 300
      ).length;
      const successRate =
        usageData.length > 0
          ? Math.round((successfulCalls / usageData.length) * 100)
          : 100;

      setUsage({
        todayCalls,
        monthCalls: usageData.length,
        successRate,
      });
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!partner) {
    return null;
  }

  const readableNamespaces = permissions.filter((p) => p.can_read);
  const writableNamespaces = permissions.filter((p) => p.can_write);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Partner Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {partner.organization_name}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>API Calls Today</CardDescription>
            <CardTitle className="text-2xl">{usage.todayCalls}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {partner.rate_limit_per_day - usage.todayCalls} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Month</CardDescription>
            <CardTitle className="text-2xl">{usage.monthCalls}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {usage.successRate}%
              {usage.successRate >= 95 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : usage.successRate >= 80 ? (
                <Clock className="h-5 w-5 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Keys</CardDescription>
            <CardTitle className="text-2xl">{apiKeyCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/partner/keys">
              <Button variant="link" className="h-auto p-0 text-xs">
                Manage keys
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/partner/keys">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">API Keys</h3>
                <p className="text-sm text-muted-foreground">Create & manage</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/usage">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Usage Stats</h3>
                <p className="text-sm text-muted-foreground">View analytics</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/search">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Test Search</h3>
                <p className="text-sm text-muted-foreground">Try the API</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/docs/api">
          <Card className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-primary/10 p-2">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">API Docs</h3>
                <p className="text-sm text-muted-foreground">Read the docs</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Namespace Access */}
      <Card>
        <CardHeader>
          <CardTitle>Namespace Access</CardTitle>
          <CardDescription>
            Your permissions for each content namespace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No namespaces assigned. Contact your administrator.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div>
                    <h4 className="font-medium text-foreground">
                      {perm.pinecone_namespaces.display_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {perm.pinecone_namespaces.slug}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {perm.can_read && (
                      <Badge variant="secondary">Read</Badge>
                    )}
                    {perm.can_write && (
                      <Badge variant="default">Write</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limits</CardTitle>
          <CardDescription>Your API request limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h4 className="font-medium text-foreground">Per Minute</h4>
              <p className="text-2xl font-bold text-foreground">
                {partner.rate_limit_per_minute}
              </p>
              <p className="text-xs text-muted-foreground">requests/minute</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h4 className="font-medium text-foreground">Per Day</h4>
              <p className="text-2xl font-bold text-foreground">
                {partner.rate_limit_per_day.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">requests/day</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
