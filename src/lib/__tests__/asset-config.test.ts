import { describe, it, expect, vi } from "vitest";
import {
  parseAssetConfig,
  resolveAssetLabel,
  buildAssetId,
  getActiveTypes,
  getActivePlatforms,
  FALLBACK_CONFIG,
  type AssetConfig,
} from "@/lib/asset-config";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/** Simulates the rows returned from app_settings where category = 'assets' */
function makeRows(overrides?: {
  types?: unknown;
  platforms?: unknown;
  defaults?: unknown;
}) {
  const rows = [];
  if (overrides?.types !== undefined) {
    rows.push({ key: "asset_types", value: { value: overrides.types } });
  }
  if (overrides?.platforms !== undefined) {
    rows.push({ key: "asset_platforms", value: { value: overrides.platforms } });
  }
  if (overrides?.defaults !== undefined) {
    rows.push({ key: "asset_defaults", value: { value: overrides.defaults } });
  }
  return rows;
}

const VALID_TYPES = [
  {
    key: "post",
    label: "Post",
    short_label: "Post",
    is_active: true,
    is_default: true,
    supports_platform: true,
    default_platform: "substack",
    default_variant: "main",
    compound_short_labels: { substack: "Substack", linkedin: "LinkedIn" },
  },
  {
    key: "transcript",
    label: "Transcript",
    short_label: "Script",
    is_active: true,
    supports_platform: true,
    default_platform: "youtube",
    default_variant: "main",
    compound_short_labels: { youtube: "YT Script", tiktok: "TT Script" },
  },
  {
    key: "promptkit",
    label: "Prompt Kit",
    short_label: "Prompt Kit",
    is_active: true,
    supports_platform: false,
    default_variant: "1",
  },
  {
    key: "guide",
    label: "Guide",
    short_label: "Guide",
    is_active: false,
    supports_platform: false,
    default_variant: "main",
  },
];

const VALID_PLATFORMS = [
  { key: "substack", label: "Substack", short_label: "Substack", is_active: true, is_default: true },
  { key: "youtube", label: "YouTube", short_label: "YouTube", is_active: true },
  { key: "tiktok", label: "TikTok", short_label: "TikTok", is_active: false },
];

const VALID_DEFAULTS = {
  new_project: { asset_type: "post", platform: "substack", variant: "main" },
  add_asset_dialog: { asset_type: "post", platform: "substack", variant: "main" },
};

function validConfig(): AssetConfig {
  return parseAssetConfig(
    makeRows({ types: VALID_TYPES, platforms: VALID_PLATFORMS, defaults: VALID_DEFAULTS })
  );
}

// ---------------------------------------------------------------------------
// parseAssetConfig
// ---------------------------------------------------------------------------

describe("parseAssetConfig", () => {
  it("parses valid rows into typed config", () => {
    const config = validConfig();
    expect(config.types).toHaveLength(4);
    expect(config.types[0].key).toBe("post");
    expect(config.platforms).toHaveLength(3);
    expect(config.defaults.new_project.asset_type).toBe("post");
  });

  it("returns fallback when rows are empty", () => {
    const config = parseAssetConfig([]);
    expect(config).toEqual(FALLBACK_CONFIG);
  });

  it("falls back types when asset_types is malformed (not array)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = parseAssetConfig(
      makeRows({ types: "not-an-array", platforms: VALID_PLATFORMS, defaults: VALID_DEFAULTS })
    );
    expect(config.types).toEqual(FALLBACK_CONFIG.types);
    expect(config.platforms).toEqual(VALID_PLATFORMS); // platforms should still parse
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("asset_types malformed"));
    warnSpy.mockRestore();
  });

  it("falls back platforms when asset_platforms is empty array", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = parseAssetConfig(
      makeRows({ types: VALID_TYPES, platforms: [], defaults: VALID_DEFAULTS })
    );
    expect(config.platforms).toEqual(FALLBACK_CONFIG.platforms);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("asset_platforms malformed"));
    warnSpy.mockRestore();
  });

  it("falls back defaults when asset_defaults is missing required keys", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = parseAssetConfig(
      makeRows({ types: VALID_TYPES, platforms: VALID_PLATFORMS, defaults: { foo: "bar" } })
    );
    expect(config.defaults).toEqual(FALLBACK_CONFIG.defaults);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("asset_defaults malformed"));
    warnSpy.mockRestore();
  });

  it("handles rows with null value gracefully", () => {
    const rows = [{ key: "asset_types", value: null }];
    const config = parseAssetConfig(rows as any);
    expect(config).toEqual(FALLBACK_CONFIG);
  });
});

// ---------------------------------------------------------------------------
// resolveAssetLabel
// ---------------------------------------------------------------------------

describe("resolveAssetLabel", () => {
  it("returns compound label when type + platform match", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "post", "substack")).toBe("Substack");
    expect(resolveAssetLabel(config, "post", "linkedin")).toBe("LinkedIn");
    expect(resolveAssetLabel(config, "transcript", "youtube")).toBe("YT Script");
    expect(resolveAssetLabel(config, "transcript", "tiktok")).toBe("TT Script");
  });

  it("returns short_label when type matches but platform has no compound", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "post", "twitter")).toBe("Post");
    expect(resolveAssetLabel(config, "transcript", "linkedin")).toBe("Script");
  });

  it("returns short_label when no platform provided", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "post")).toBe("Post");
    expect(resolveAssetLabel(config, "promptkit")).toBe("Prompt Kit");
  });

  it("returns short_label with null platform", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "transcript", null)).toBe("Script");
  });

  it("resolves legacy compound keys by splitting on underscore", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "transcript_youtube")).toBe("YT Script");
    expect(resolveAssetLabel(config, "transcript_tiktok")).toBe("TT Script");
    expect(resolveAssetLabel(config, "post_substack")).toBe("Substack");
    expect(resolveAssetLabel(config, "post_linkedin")).toBe("LinkedIn");
  });

  it("falls back to short_label for legacy compound key with unknown platform", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "transcript_instagram")).toBe("Script");
  });

  it("returns raw key for completely unknown type", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "newsletter")).toBe("newsletter");
  });

  it("returns raw key for unknown compound type", () => {
    const config = validConfig();
    expect(resolveAssetLabel(config, "newsletter_email")).toBe("newsletter_email");
  });
});

// ---------------------------------------------------------------------------
// buildAssetId
// ---------------------------------------------------------------------------

describe("buildAssetId", () => {
  it("builds full ID with all parts", () => {
    expect(buildAssetId("20260214_701", "post", "substack", "main")).toBe(
      "20260214_701_post_substack_main"
    );
  });

  it("omits platform when null", () => {
    expect(buildAssetId("20260214_701", "promptkit", null, "1")).toBe(
      "20260214_701_promptkit_1"
    );
  });

  it("omits variant when null", () => {
    expect(buildAssetId("20260214_701", "post", "substack", null)).toBe(
      "20260214_701_post_substack"
    );
  });

  it("omits both platform and variant when null", () => {
    expect(buildAssetId("20260214_701", "guide", null, null)).toBe(
      "20260214_701_guide"
    );
  });

  it("omits platform when empty string", () => {
    expect(buildAssetId("20260214_701", "thumbnail", "", "16x9")).toBe(
      "20260214_701_thumbnail_16x9"
    );
  });
});

// ---------------------------------------------------------------------------
// getActiveTypes / getActivePlatforms
// ---------------------------------------------------------------------------

describe("getActiveTypes", () => {
  it("filters out inactive types", () => {
    const config = validConfig();
    const active = getActiveTypes(config);
    expect(active.every((t) => t.is_active)).toBe(true);
    expect(active.find((t) => t.key === "guide")).toBeUndefined();
  });

  it("returns all when all active", () => {
    const config = { ...FALLBACK_CONFIG };
    const active = getActiveTypes(config);
    expect(active).toHaveLength(config.types.length);
  });
});

describe("getActivePlatforms", () => {
  it("filters out inactive platforms", () => {
    const config = validConfig();
    const active = getActivePlatforms(config);
    expect(active.every((p) => p.is_active)).toBe(true);
    expect(active.find((p) => p.key === "tiktok")).toBeUndefined();
  });
});
