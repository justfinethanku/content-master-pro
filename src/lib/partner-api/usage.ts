/**
 * Partner API Usage Logging
 *
 * Logs all API calls for audit trail and rate limiting.
 * Uses service role to bypass RLS.
 */

import { createServiceClient } from "@/lib/supabase/admin";
import { PartnerApiUsageInsert } from "@/lib/types";

/**
 * Log an API call
 * This should be called after processing each API request
 */
export async function logApiUsage(
  usage: PartnerApiUsageInsert
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("partner_api_usage").insert(usage);

  if (error) {
    console.error("Error logging API usage:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get usage stats for a partner
 */
export async function getPartnerUsageStats(
  partnerId: string,
  days = 30
): Promise<{
  totalCalls: number;
  successfulCalls: number;
  errorCalls: number;
  avgResponseTimeMs: number;
  endpointBreakdown: Record<string, number>;
  namespaceBreakdown: Record<string, number>;
}> {
  const supabase = createServiceClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all usage records for the period
  const { data, error } = await supabase
    .from("partner_api_usage")
    .select("*")
    .eq("partner_id", partnerId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching usage stats:", error);
    return {
      totalCalls: 0,
      successfulCalls: 0,
      errorCalls: 0,
      avgResponseTimeMs: 0,
      endpointBreakdown: {},
      namespaceBreakdown: {},
    };
  }

  const records = data as Array<{
    status_code: number;
    response_time_ms: number | null;
    endpoint: string;
    namespace_slug: string | null;
  }>;

  const totalCalls = records.length;
  const successfulCalls = records.filter(
    (r) => r.status_code >= 200 && r.status_code < 300
  ).length;
  const errorCalls = records.filter((r) => r.status_code >= 400).length;

  const responseTimes = records
    .filter((r) => r.response_time_ms != null)
    .map((r) => r.response_time_ms as number);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        )
      : 0;

  const endpointBreakdown: Record<string, number> = {};
  const namespaceBreakdown: Record<string, number> = {};

  for (const record of records) {
    endpointBreakdown[record.endpoint] =
      (endpointBreakdown[record.endpoint] || 0) + 1;
    if (record.namespace_slug) {
      namespaceBreakdown[record.namespace_slug] =
        (namespaceBreakdown[record.namespace_slug] || 0) + 1;
    }
  }

  return {
    totalCalls,
    successfulCalls,
    errorCalls,
    avgResponseTimeMs,
    endpointBreakdown,
    namespaceBreakdown,
  };
}

/**
 * Get daily usage for a partner (for charts)
 */
export async function getDailyUsage(
  partnerId: string,
  days = 30
): Promise<Array<{ date: string; count: number; errors: number }>> {
  const supabase = createServiceClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("partner_api_usage")
    .select("created_at, status_code")
    .eq("partner_id", partnerId)
    .gte("created_at", startDate.toISOString());

  if (error || !data) {
    console.error("Error fetching daily usage:", error);
    return [];
  }

  // Group by date
  const dailyMap = new Map<string, { count: number; errors: number }>();

  for (const record of data as Array<{
    created_at: string;
    status_code: number;
  }>) {
    const date = record.created_at.split("T")[0];
    const existing = dailyMap.get(date) || { count: 0, errors: 0 };
    existing.count++;
    if (record.status_code >= 400) {
      existing.errors++;
    }
    dailyMap.set(date, existing);
  }

  // Convert to array and sort
  return Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      count: stats.count,
      errors: stats.errors,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get recent API calls for a partner
 */
export async function getRecentCalls(
  partnerId: string,
  limit = 50
): Promise<
  Array<{
    id: string;
    endpoint: string;
    method: string;
    namespace_slug: string | null;
    status_code: number;
    response_time_ms: number | null;
    error_message: string | null;
    created_at: string;
  }>
> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("partner_api_usage")
    .select(
      "id, endpoint, method, namespace_slug, status_code, response_time_ms, error_message, created_at"
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent calls:", error);
    return [];
  }

  return (data as Array<{
    id: string;
    endpoint: string;
    method: string;
    namespace_slug: string | null;
    status_code: number;
    response_time_ms: number | null;
    error_message: string | null;
    created_at: string;
  }>) || [];
}

/**
 * Get usage counts for rate limiting check
 */
export async function getUsageCounts(
  partnerId: string
): Promise<{ minuteCount: number; dailyCount: number }> {
  const supabase = createServiceClient();
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Get minute count
  const { count: minuteCount } = await supabase
    .from("partner_api_usage")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .gte("created_at", oneMinuteAgo.toISOString());

  // Get daily count
  const { count: dailyCount } = await supabase
    .from("partner_api_usage")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .gte("created_at", startOfDay.toISOString());

  return {
    minuteCount: minuteCount ?? 0,
    dailyCount: dailyCount ?? 0,
  };
}
