/**
 * Rate Limiting for Subscriber MCP
 *
 * Sliding window: 120 requests/minute, 2,000 requests/day.
 * Queries subscriber_mcp_usage table. Fail-open on DB errors.
 */

import { AnySupabase } from "./server";

const MINUTE_LIMIT = 120;
const DAY_LIMIT = 2000;

export interface SubscriberRateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
  dailyLimit: number;
  dailyRemaining: number;
  dailyResetAt: string;
}

export interface SubscriberRateLimitResult {
  allowed: boolean;
  info: SubscriberRateLimitInfo;
  retryAfter?: number;
}

/**
 * Check if a subscriber request is allowed under rate limits.
 */
export async function checkSubscriberRateLimit(
  supabase: AnySupabase,
  subscriberId: string
): Promise<SubscriberRateLimitResult> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const minuteResetAt = new Date(now.getTime() + 60 * 1000);
  const dailyResetAt = new Date(startOfDay);
  dailyResetAt.setDate(dailyResetAt.getDate() + 1);

  // Get minute count
  const { count: minuteCount, error: minuteError } = await supabase
    .from("subscriber_mcp_usage")
    .select("*", { count: "exact", head: true })
    .eq("subscriber_id", subscriberId)
    .gte("created_at", oneMinuteAgo.toISOString());

  if (minuteError) {
    console.error("Subscriber rate limit minute check error:", minuteError);
    return { allowed: true, info: defaultInfo(now) };
  }

  // Get daily count
  const { count: dailyCount, error: dailyError } = await supabase
    .from("subscriber_mcp_usage")
    .select("*", { count: "exact", head: true })
    .eq("subscriber_id", subscriberId)
    .gte("created_at", startOfDay.toISOString());

  if (dailyError) {
    console.error("Subscriber rate limit daily check error:", dailyError);
    return { allowed: true, info: defaultInfo(now) };
  }

  const currentMinute = minuteCount ?? 0;
  const currentDaily = dailyCount ?? 0;

  const minuteRemaining = Math.max(0, MINUTE_LIMIT - currentMinute);
  const dailyRemaining = Math.max(0, DAY_LIMIT - currentDaily);

  const info: SubscriberRateLimitInfo = {
    limit: MINUTE_LIMIT,
    remaining: minuteRemaining,
    resetAt: minuteResetAt.toISOString(),
    dailyLimit: DAY_LIMIT,
    dailyRemaining: dailyRemaining,
    dailyResetAt: dailyResetAt.toISOString(),
  };

  if (currentMinute >= MINUTE_LIMIT) {
    return {
      allowed: false,
      info,
      retryAfter: Math.ceil(
        (minuteResetAt.getTime() - now.getTime()) / 1000
      ),
    };
  }

  if (currentDaily >= DAY_LIMIT) {
    return {
      allowed: false,
      info,
      retryAfter: Math.ceil(
        (dailyResetAt.getTime() - now.getTime()) / 1000
      ),
    };
  }

  return {
    allowed: true,
    info: {
      ...info,
      remaining: minuteRemaining - 1,
      dailyRemaining: dailyRemaining - 1,
    },
  };
}

function defaultInfo(now: Date): SubscriberRateLimitInfo {
  const minuteResetAt = new Date(now.getTime() + 60 * 1000);
  const dailyResetAt = new Date(now);
  dailyResetAt.setHours(0, 0, 0, 0);
  dailyResetAt.setDate(dailyResetAt.getDate() + 1);

  return {
    limit: MINUTE_LIMIT,
    remaining: MINUTE_LIMIT,
    resetAt: minuteResetAt.toISOString(),
    dailyLimit: DAY_LIMIT,
    dailyRemaining: DAY_LIMIT,
    dailyResetAt: dailyResetAt.toISOString(),
  };
}

/**
 * Get rate limit headers for response.
 */
export function getSubscriberRateLimitHeaders(
  info: SubscriberRateLimitInfo
): Record<string, string> {
  return {
    "X-RateLimit-Limit": info.limit.toString(),
    "X-RateLimit-Remaining": info.remaining.toString(),
    "X-RateLimit-Reset": info.resetAt,
    "X-RateLimit-Daily-Limit": info.dailyLimit.toString(),
    "X-RateLimit-Daily-Remaining": info.dailyRemaining.toString(),
    "X-RateLimit-Daily-Reset": info.dailyResetAt,
  };
}
