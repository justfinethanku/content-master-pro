"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, AlertTriangle, CheckCircle } from "lucide-react";

interface UsageStats {
  partnerId: string;
  organizationName: string;
  totalCalls: number;
  successfulCalls: number;
  errorCalls: number;
  rateLimitViolations: number;
}

export default function AdminUsagePage() {
  const router = useRouter();
  const [stats, setStats] = useState<UsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadStats();
  }, []);

  async function checkAdminAndLoadStats() {
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
    await loadStats();
  }

  async function loadStats() {
    setLoading(true);
    const supabase = createClient();

    try {
      // Get all partners
      const { data: partners } = await supabase
        .from("partners")
        .select("id, organization_name");

      if (!partners) {
        setLoading(false);
        return;
      }

      // Get usage stats for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: usage } = await supabase
        .from("partner_api_usage")
        .select("partner_id, status_code")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Calculate stats per partner
      const statsMap = new Map<
        string,
        { total: number; success: number; error: number; rateLimit: number }
      >();

      for (const record of usage || []) {
        const current = statsMap.get(record.partner_id) || {
          total: 0,
          success: 0,
          error: 0,
          rateLimit: 0,
        };
        current.total++;
        if (record.status_code >= 200 && record.status_code < 300) {
          current.success++;
        } else if (record.status_code === 429) {
          current.rateLimit++;
        } else if (record.status_code >= 400) {
          current.error++;
        }
        statsMap.set(record.partner_id, current);
      }

      // Combine with partner info
      const combinedStats: UsageStats[] = partners.map((partner) => {
        const usage = statsMap.get(partner.id) || {
          total: 0,
          success: 0,
          error: 0,
          rateLimit: 0,
        };
        return {
          partnerId: partner.id,
          organizationName: partner.organization_name,
          totalCalls: usage.total,
          successfulCalls: usage.success,
          errorCalls: usage.error,
          rateLimitViolations: usage.rateLimit,
        };
      });

      // Sort by total calls descending
      combinedStats.sort((a, b) => b.totalCalls - a.totalCalls);

      setStats(combinedStats);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const totalCalls = stats.reduce((sum, s) => sum + s.totalCalls, 0);
  const totalErrors = stats.reduce((sum, s) => sum + s.errorCalls, 0);
  const totalRateLimits = stats.reduce((sum, s) => sum + s.rateLimitViolations, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Usage</h1>
        <p className="text-muted-foreground">
          Monitor partner API usage (last 30 days)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total API Calls</CardDescription>
            <CardTitle className="text-3xl">{totalCalls.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Error Rate</CardDescription>
            <CardTitle className="text-3xl">
              {totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(1) : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rate Limit Violations</CardDescription>
            <CardTitle className="text-3xl">{totalRateLimits.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Per-Partner Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Partner</CardTitle>
          <CardDescription>
            API calls, errors, and rate limit violations per partner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : stats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No usage data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.map((stat) => (
                <div
                  key={stat.partnerId}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div className="space-y-1">
                    <span className="font-medium text-foreground">
                      {stat.organizationName}
                    </span>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{stat.totalCalls.toLocaleString()} calls</span>
                      {stat.successfulCalls > 0 && (
                        <span className="flex items-center gap-1 text-green-500">
                          <CheckCircle className="h-3 w-3" />
                          {stat.successfulCalls}
                        </span>
                      )}
                      {stat.errorCalls > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="h-3 w-3" />
                          {stat.errorCalls} errors
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stat.rateLimitViolations > 0 && (
                      <Badge variant="destructive">
                        {stat.rateLimitViolations} rate limits
                      </Badge>
                    )}
                    {stat.totalCalls === 0 && (
                      <Badge variant="outline">No activity</Badge>
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
