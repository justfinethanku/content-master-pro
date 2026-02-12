"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Partner } from "@/lib/types";
import { BarChart3, CheckCircle, XCircle, Clock } from "lucide-react";

interface UsageRecord {
  id: string;
  endpoint: string;
  method: string;
  namespace_slug: string | null;
  status_code: number;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface DailyUsage {
  date: string;
  count: number;
  errors: number;
}

export default function PartnerUsagePage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [recentCalls, setRecentCalls] = useState<UsageRecord[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [stats, setStats] = useState({
    totalCalls: 0,
    successfulCalls: 0,
    errorCalls: 0,
    avgResponseTime: 0,
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
    await loadUsageData(partnerData.id);
  }

  async function loadUsageData(partnerId: string) {
    const supabase = createClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get recent calls
    const { data: recent } = await supabase
      .from("partner_api_usage")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(50);

    setRecentCalls((recent as UsageRecord[]) || []);

    // Get all usage for stats
    const { data: allUsage } = await supabase
      .from("partner_api_usage")
      .select("status_code, response_time_ms, created_at")
      .eq("partner_id", partnerId)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (allUsage) {
      const successful = allUsage.filter(
        (u) => u.status_code >= 200 && u.status_code < 300
      ).length;
      const errors = allUsage.filter((u) => u.status_code >= 400).length;
      const responseTimes = allUsage
        .filter((u) => u.response_time_ms != null)
        .map((u) => u.response_time_ms as number);
      const avgTime =
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            )
          : 0;

      setStats({
        totalCalls: allUsage.length,
        successfulCalls: successful,
        errorCalls: errors,
        avgResponseTime: avgTime,
      });

      // Calculate daily usage
      const dailyMap = new Map<string, { count: number; errors: number }>();
      for (const record of allUsage) {
        const date = record.created_at.split("T")[0];
        const existing = dailyMap.get(date) || { count: 0, errors: 0 };
        existing.count++;
        if (record.status_code >= 400) {
          existing.errors++;
        }
        dailyMap.set(date, existing);
      }

      const daily = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          errors: data.errors,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyUsage(daily);
    }

    setLoading(false);
  }

  function getStatusBadge(statusCode: number) {
    if (statusCode >= 200 && statusCode < 300) {
      return (
        <Badge variant="default" className="bg-green-500">
          {statusCode}
        </Badge>
      );
    } else if (statusCode === 429) {
      return (
        <Badge variant="secondary">
          {statusCode}
        </Badge>
      );
    } else if (statusCode >= 400) {
      return (
        <Badge variant="destructive">
          {statusCode}
        </Badge>
      );
    }
    return <Badge variant="outline">{statusCode}</Badge>;
  }

  if (loading || !partner) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const maxDailyCount = Math.max(...dailyUsage.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Usage</h1>
        <p className="text-muted-foreground">
          Monitor your API usage over the last 30 days
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Calls</CardDescription>
            <CardTitle className="text-2xl">
              {stats.totalCalls.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {stats.successfulCalls.toLocaleString()}
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {stats.errorCalls.toLocaleString()}
              {stats.errorCalls > 0 && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Response Time</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {stats.avgResponseTime}ms
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Simple Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage</CardTitle>
          <CardDescription>API calls per day</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyUsage.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No usage data yet</p>
            </div>
          ) : (
            <div className="flex h-48 items-end gap-1">
              {dailyUsage.map((day) => (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center"
                >
                  <div
                    className="w-full rounded-t bg-primary transition-all group-hover:bg-primary/80"
                    style={{
                      height: `${(day.count / maxDailyCount) * 100}%`,
                      minHeight: day.count > 0 ? "4px" : "0",
                    }}
                  />
                  <div className="absolute bottom-full mb-1 hidden rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                    {day.date}: {day.count} calls
                    {day.errors > 0 && `, ${day.errors} errors`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Calls</CardTitle>
          <CardDescription>Last 50 API requests</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API calls yet</p>
          ) : (
            <div className="space-y-2">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded border border-border p-3"
                >
                  <div className="flex items-center gap-4">
                    {getStatusBadge(call.status_code)}
                    <div>
                      <span className="font-mono text-sm text-foreground">
                        {call.method} {call.endpoint}
                      </span>
                      {call.namespace_slug && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({call.namespace_slug})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {call.response_time_ms}ms
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(call.created_at).toLocaleString()}
                    </p>
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
