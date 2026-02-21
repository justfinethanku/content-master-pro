/**
 * Server-side asset configuration loader with in-memory cache.
 *
 * For use in MCP routes and other server-side code (not React components).
 * Matches the caching pattern from pinecone/namespaces.ts.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { type AssetConfig, FALLBACK_CONFIG, parseAssetConfig } from "@/lib/asset-config";

interface ConfigCache {
  data: AssetConfig;
  timestamp: number;
}

let configCache: ConfigCache | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Load asset configuration from app_settings (category = 'assets').
 * Results are cached in memory for 60 seconds.
 */
export async function loadAssetConfig(
  supabase: SupabaseClient
): Promise<AssetConfig> {
  if (configCache && Date.now() - configCache.timestamp < CACHE_TTL_MS) {
    return configCache.data;
  }

  const { data: rows, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("category", "assets");

  if (error) {
    console.warn("[asset-config.server] Failed to load, using fallback:", error.message);
    return FALLBACK_CONFIG;
  }

  const config = parseAssetConfig(rows || []);

  configCache = { data: config, timestamp: Date.now() };
  return config;
}
