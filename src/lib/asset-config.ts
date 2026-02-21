/**
 * Asset configuration types, parser, and utilities.
 *
 * Pure module — no React, no hooks, no Supabase imports.
 * Used by both client hook (use-asset-config.ts) and server loader (asset-config.server.ts).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssetTypeConfig {
  key: string;
  label: string;
  short_label: string;
  is_active: boolean;
  is_default?: boolean;
  supports_platform: boolean;
  default_platform?: string;
  default_variant?: string;
  /** Platform-specific short labels for compound display (e.g., { "youtube": "YT Script" }) */
  compound_short_labels?: Record<string, string>;
}

export interface AssetPlatformConfig {
  key: string;
  label: string;
  short_label: string;
  is_active: boolean;
  is_default?: boolean;
}

export interface AssetDefaults {
  new_project: { asset_type: string; platform: string; variant: string };
  add_asset_dialog: { asset_type: string; platform: string; variant: string };
}

export interface AssetConfig {
  types: AssetTypeConfig[];
  platforms: AssetPlatformConfig[];
  defaults: AssetDefaults;
}

// ---------------------------------------------------------------------------
// Fallback config (used when DB rows are missing or malformed)
// ---------------------------------------------------------------------------

export const FALLBACK_ASSET_TYPES: AssetTypeConfig[] = [
  { key: "post", label: "Post", short_label: "Post", is_active: true, is_default: true, supports_platform: true, default_platform: "substack", default_variant: "main", compound_short_labels: { substack: "Substack", linkedin: "LinkedIn" } },
  { key: "transcript", label: "Transcript", short_label: "Script", is_active: true, supports_platform: true, default_platform: "youtube", default_variant: "main", compound_short_labels: { youtube: "YT Script", tiktok: "TT Script" } },
  { key: "description", label: "Description", short_label: "Description", is_active: true, supports_platform: true, default_platform: "youtube", default_variant: "main", compound_short_labels: { youtube: "YT Desc", tiktok: "TT Desc" } },
  { key: "thumbnail", label: "Thumbnail", short_label: "Thumbnail", is_active: true, supports_platform: false, default_variant: "16x9" },
  { key: "promptkit", label: "Prompt Kit", short_label: "Prompt Kit", is_active: true, supports_platform: false, default_variant: "1" },
  { key: "guide", label: "Guide", short_label: "Guide", is_active: true, supports_platform: false, default_variant: "main" },
];

export const FALLBACK_ASSET_PLATFORMS: AssetPlatformConfig[] = [
  { key: "substack", label: "Substack", short_label: "Substack", is_active: true, is_default: true },
  { key: "youtube", label: "YouTube", short_label: "YouTube", is_active: true },
  { key: "tiktok", label: "TikTok", short_label: "TikTok", is_active: true },
  { key: "linkedin", label: "LinkedIn", short_label: "LinkedIn", is_active: true },
  { key: "twitter", label: "Twitter/X", short_label: "Twitter", is_active: true },
];

export const FALLBACK_ASSET_DEFAULTS: AssetDefaults = {
  new_project: { asset_type: "post", platform: "substack", variant: "main" },
  add_asset_dialog: { asset_type: "post", platform: "substack", variant: "main" },
};

export const FALLBACK_CONFIG: AssetConfig = {
  types: FALLBACK_ASSET_TYPES,
  platforms: FALLBACK_ASSET_PLATFORMS,
  defaults: FALLBACK_ASSET_DEFAULTS,
};

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

interface AppSettingsRow {
  key: string;
  value: { value: unknown } | null;
}

/**
 * Parse raw app_settings rows (category = 'assets') into typed AssetConfig.
 * Falls back to FALLBACK_CONFIG for any missing or malformed rows.
 */
export function parseAssetConfig(rows: AppSettingsRow[]): AssetConfig {
  const rowMap = new Map<string, unknown>();
  for (const row of rows) {
    if (row.value && typeof row.value === "object" && "value" in row.value) {
      rowMap.set(row.key, row.value.value);
    }
  }

  let types = FALLBACK_ASSET_TYPES;
  const rawTypes = rowMap.get("asset_types");
  if (Array.isArray(rawTypes) && rawTypes.length > 0) {
    types = rawTypes as AssetTypeConfig[];
  } else if (rawTypes !== undefined) {
    console.warn("[asset-config] asset_types malformed, using fallback");
  }

  let platforms = FALLBACK_ASSET_PLATFORMS;
  const rawPlatforms = rowMap.get("asset_platforms");
  if (Array.isArray(rawPlatforms) && rawPlatforms.length > 0) {
    platforms = rawPlatforms as AssetPlatformConfig[];
  } else if (rawPlatforms !== undefined) {
    console.warn("[asset-config] asset_platforms malformed, using fallback");
  }

  let defaults = FALLBACK_ASSET_DEFAULTS;
  const rawDefaults = rowMap.get("asset_defaults");
  if (
    rawDefaults &&
    typeof rawDefaults === "object" &&
    "new_project" in (rawDefaults as Record<string, unknown>) &&
    "add_asset_dialog" in (rawDefaults as Record<string, unknown>)
  ) {
    defaults = rawDefaults as AssetDefaults;
  } else if (rawDefaults !== undefined) {
    console.warn("[asset-config] asset_defaults malformed, using fallback");
  }

  return { types, platforms, defaults };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Resolve a human-readable display label for an asset type + optional platform.
 *
 * Priority:
 * 1. compound_short_labels[platform] on the matching type (e.g., transcript + youtube → "YT Script")
 * 2. Type's short_label (e.g., transcript → "Script")
 * 3. Legacy compound key split: if assetType contains "_", try splitting into type + platform
 * 4. Raw key as last resort
 */
export function resolveAssetLabel(
  config: AssetConfig,
  assetType: string,
  platform?: string | null
): string {
  const typeConfig = config.types.find((t) => t.key === assetType);

  // Direct match with platform compound label
  if (typeConfig && platform && typeConfig.compound_short_labels?.[platform]) {
    return typeConfig.compound_short_labels[platform];
  }

  // Direct match, no compound — use short_label
  if (typeConfig) {
    return typeConfig.short_label;
  }

  // Legacy compound key (e.g., "transcript_youtube", "post_linkedin", "image_substack")
  // Try splitting on "_" and matching type + platform
  const underscoreIdx = assetType.indexOf("_");
  if (underscoreIdx > 0) {
    const legacyType = assetType.substring(0, underscoreIdx);
    const legacyPlatform = assetType.substring(underscoreIdx + 1);
    const legacyTypeConfig = config.types.find((t) => t.key === legacyType);

    if (legacyTypeConfig?.compound_short_labels?.[legacyPlatform]) {
      return legacyTypeConfig.compound_short_labels[legacyPlatform];
    }
    if (legacyTypeConfig) {
      return legacyTypeConfig.short_label;
    }
  }

  // Last resort: return raw key
  return assetType;
}

/**
 * Build an asset_id from parts.
 * Format: "{projectId}_{type}_{platform}_{variant}" — omits null/empty segments.
 * Examples:
 *   buildAssetId("20260214_701", "post", "substack", "main") → "20260214_701_post_substack_main"
 *   buildAssetId("20260214_701", "promptkit", null, "1") → "20260214_701_promptkit_1"
 *   buildAssetId("20260214_701", "thumbnail", null, "16x9") → "20260214_701_thumbnail_16x9"
 */
export function buildAssetId(
  projectId: string,
  assetType: string,
  platform?: string | null,
  variant?: string | null
): string {
  const parts = [projectId, assetType];
  if (platform) parts.push(platform);
  if (variant) parts.push(variant);
  return parts.join("_");
}

/**
 * Get active asset types (for dropdowns).
 */
export function getActiveTypes(config: AssetConfig): AssetTypeConfig[] {
  return config.types.filter((t) => t.is_active);
}

/**
 * Get active asset platforms (for dropdowns).
 */
export function getActivePlatforms(config: AssetConfig): AssetPlatformConfig[] {
  return config.platforms.filter((p) => p.is_active);
}
