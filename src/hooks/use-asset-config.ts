"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  type AssetConfig,
  FALLBACK_CONFIG,
  parseAssetConfig,
} from "@/lib/asset-config";

export const assetConfigKeys = {
  all: ["asset-config"] as const,
};

/**
 * Fetch asset configuration from app_settings (category = 'assets').
 * Returns fallback config while loading — never undefined.
 */
export function useAssetConfig(): {
  config: AssetConfig;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: assetConfigKeys.all,
    queryFn: async (): Promise<AssetConfig> => {
      const supabase = createClient();

      const { data: rows, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("category", "assets");

      if (error) {
        console.warn("[use-asset-config] Failed to load, using fallback:", error.message);
        return FALLBACK_CONFIG;
      }

      return parseAssetConfig(rows || []);
    },
    staleTime: 60_000,
  });

  return {
    config: data ?? FALLBACK_CONFIG,
    isLoading,
  };
}
