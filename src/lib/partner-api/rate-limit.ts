/**
 * Database-based Rate Limiting for Partner API
 *
 * Uses sliding window algorithm:
 * - Per-minute limit (default: 60 requests)
 * - Per-day limit (default: 5000 requests)
 *
 * Queries the partner_api_usage table to count recent requests.
 * Can be migrated to Redis/Vercel KV later for better performance.
 */

import { createServiceClient } from "@/lib/supabase/admin";
import { Partner, RateLimitInfo } from "@/lib/types";

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  retryAfter?: number; // seconds until rate limit resets
}

/**
 * Check if a request is allowed under rate limits
 */
export async function checkRateLimit(
  partnerId: string,
  partner: Partner
): Promise<RateLimitResult> {
  const supabase = createServiceClient();
  const now = new Date();

  // Calculate time windows
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Get minute count
  const { count: minuteCount, error: minuteError } = await supabase
    .from("partner_api_usage")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .gte("created_at", oneMinuteAgo.toISOString());

  if (minuteError) {
    console.error("Rate limit minute check error:", minuteError);
    // On error, allow the request but log it
    return {
      allowed: true,
      info: createDefaultRateLimitInfo(partner, now),
    };
  }

  // Get daily count
  const { count: dailyCount, error: dailyError } = await supabase
    .from("partner_api_usage")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .gte("created_at", startOfDay.toISOString());

  if (dailyError) {
    console.error("Rate limit daily check error:", dailyError);
    // On error, allow the request but log it
    return {
      allowed: true,
      info: createDefaultRateLimitInfo(partner, now),
    };
  }

  const currentMinuteCount = minuteCount ?? 0;
  const currentDailyCount = dailyCount ?? 0;

  // Calculate remaining
  const minuteRemaining = Math.max(
    0,
    partner.rate_limit_per_minute - currentMinuteCount
  );
  const dailyRemaining = Math.max(
    0,
    partner.rate_limit_per_day - currentDailyCount
  );

  // Calculate reset times
  const minuteResetAt = new Date(now.getTime() + 60 * 1000);
  const dailyResetAt = new Date(startOfDay);
  dailyResetAt.setDate(dailyResetAt.getDate() + 1);

  const info: RateLimitInfo = {
    limit: partner.rate_limit_per_minute,
    remaining: minuteRemaining,
    resetAt: minuteResetAt.toISOString(),
    dailyLimit: partner.rate_limit_per_day,
    dailyRemaining: dailyRemaining,
    dailyResetAt: dailyResetAt.toISOString(),
  };

  // Check if rate limited
  if (currentMinuteCount >= partner.rate_limit_per_minute) {
    // Minute limit exceeded
    const retryAfter = Math.ceil(
      (minuteResetAt.getTime() - now.getTime()) / 1000
    );
    return {
      allowed: false,
      info,
      retryAfter,
    };
  }

  if (currentDailyCount >= partner.rate_limit_per_day) {
    // Daily limit exceeded
    const retryAfter = Math.ceil(
      (dailyResetAt.getTime() - now.getTime()) / 1000
    );
    return {
      allowed: false,
      info,
      retryAfter,
    };
  }

  return {
    allowed: true,
    info: {
      limit: partner.rate_limit_per_minute,
      // Subtract 1 since this request will be logged after the check
      remaining: minuteRemaining - 1,
      resetAt: minuteResetAt.toISOString(),
      dailyLimit: partner.rate_limit_per_day,
      dailyRemaining: dailyRemaining - 1,
      dailyResetAt: dailyResetAt.toISOString(),
    },
  };
}

/**
 * Create default rate limit info when we can't query the database
 */
function createDefaultRateLimitInfo(partner: Partner, now: Date): RateLimitInfo {
  const minuteResetAt = new Date(now.getTime() + 60 * 1000);
  const dailyResetAt = new Date(now);
  dailyResetAt.setHours(0, 0, 0, 0);
  dailyResetAt.setDate(dailyResetAt.getDate() + 1);

  return {
    limit: partner.rate_limit_per_minute,
    remaining: partner.rate_limit_per_minute,
    resetAt: minuteResetAt.toISOString(),
    dailyLimit: partner.rate_limit_per_day,
    dailyRemaining: partner.rate_limit_per_day,
    dailyResetAt: dailyResetAt.toISOString(),
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    "X-RateLimit-Limit": info.limit.toString(),
    "X-RateLimit-Remaining": info.remaining.toString(),
    "X-RateLimit-Reset": info.resetAt,
    "X-RateLimit-Daily-Limit": info.dailyLimit.toString(),
    "X-RateLimit-Daily-Remaining": info.dailyRemaining.toString(),
    "X-RateLimit-Daily-Reset": info.dailyResetAt,
  };
}

/**
 * Get headers for rate limit exceeded response
 */
export function getRateLimitExceededHeaders(
  info: RateLimitInfo,
  retryAfter: number
): Record<string, string> {
  return {
    ...getRateLimitHeaders(info),
    "Retry-After": retryAfter.toString(),
  };
}
