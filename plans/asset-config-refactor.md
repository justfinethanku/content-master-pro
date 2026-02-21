# Asset Type & Platform Config Refactor

## Status: In Progress

## Goal

Move hardcoded asset type and platform values into `app_settings` as the single source of truth, then add an "Add Asset" button to the project detail page. No breaking changes.

## Locked Decisions

1. **Compound labels** via `compound_short_labels` map on asset types (e.g., `transcript` has `{ "youtube": "YT Script", "tiktok": "TT Script" }`). Also on `post` (e.g., `{ "substack": "Substack", "linkedin": "LinkedIn" }`) to preserve calendar badge behavior.
2. **File separation**: pure types/parser/utils in `src/lib/asset-config.ts`; fetch-only hook in `src/hooks/use-asset-config.ts`.
3. **Dialog component**: Use `Dialog` (not `AlertDialog`) for Add Asset in PR 3.
4. **Collision strategy**: Insert → catch Postgres 23505 → increment variant → retry.
5. **`useCreateProject` defaults**: Caller (UI) passes defaults; mutation has no config awareness.
6. **Business logic checks stay hardcoded**: `=== "promptkit"` and `=== "thumbnail"` in their respective pages.

---

## PR 1: Migration + Shared Config Modules + Tests

### 1.1 Migration: `app_settings` rows

Create `supabase/migrations/YYYYMMDD_asset_config.sql`:

```sql
INSERT INTO app_settings (category, key, value, description) VALUES
(
  'assets',
  'asset_types',
  '{
    "value": [
      {
        "key": "post",
        "label": "Post",
        "short_label": "Post",
        "is_active": true,
        "is_default": true,
        "supports_platform": true,
        "default_platform": "substack",
        "default_variant": "main",
        "compound_short_labels": { "substack": "Substack", "linkedin": "LinkedIn" }
      },
      {
        "key": "transcript",
        "label": "Transcript",
        "short_label": "Script",
        "is_active": true,
        "supports_platform": true,
        "default_platform": "youtube",
        "default_variant": "main",
        "compound_short_labels": { "youtube": "YT Script", "tiktok": "TT Script" }
      },
      {
        "key": "description",
        "label": "Description",
        "short_label": "Description",
        "is_active": true,
        "supports_platform": true,
        "default_platform": "youtube",
        "default_variant": "main",
        "compound_short_labels": { "youtube": "YT Desc", "tiktok": "TT Desc" }
      },
      {
        "key": "thumbnail",
        "label": "Thumbnail",
        "short_label": "Thumbnail",
        "is_active": true,
        "supports_platform": false,
        "default_variant": "16x9"
      },
      {
        "key": "promptkit",
        "label": "Prompt Kit",
        "short_label": "Prompt Kit",
        "is_active": true,
        "supports_platform": false,
        "default_variant": "1"
      },
      {
        "key": "guide",
        "label": "Guide",
        "short_label": "Guide",
        "is_active": true,
        "supports_platform": false,
        "default_variant": "main"
      }
    ]
  }'::jsonb,
  'Configurable asset types with labels, platform support, and compound display labels'
),
(
  'assets',
  'asset_platforms',
  '{
    "value": [
      { "key": "substack", "label": "Substack", "short_label": "Substack", "is_active": true, "is_default": true },
      { "key": "youtube", "label": "YouTube", "short_label": "YouTube", "is_active": true },
      { "key": "tiktok", "label": "TikTok", "short_label": "TikTok", "is_active": true },
      { "key": "linkedin", "label": "LinkedIn", "short_label": "LinkedIn", "is_active": true },
      { "key": "twitter", "label": "Twitter/X", "short_label": "Twitter", "is_active": true }
    ]
  }'::jsonb,
  'Configurable asset platforms for creation and display'
),
(
  'assets',
  'asset_defaults',
  '{
    "value": {
      "new_project": { "asset_type": "post", "platform": "substack", "variant": "main" },
      "add_asset_dialog": { "asset_type": "post", "platform": "substack", "variant": "main" }
    }
  }'::jsonb,
  'Default selections for project creation and Add Asset dialog'
)
ON CONFLICT (category, key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();
```

### 1.2 Shared module: `src/lib/asset-config.ts` (new file)

Pure types, parser, and utility functions. No React, no hooks, no Supabase imports.

**Types:**
```typescript
export interface AssetTypeConfig {
  key: string;
  label: string;
  short_label: string;
  is_active: boolean;
  is_default?: boolean;
  supports_platform: boolean;
  default_platform?: string;
  default_variant?: string;
  compound_short_labels?: Record<string, string>;  // platform → short label
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
```

**Parser:**
```typescript
// Parse raw app_settings rows into typed AssetConfig.
// Falls back to FALLBACK_CONFIG if rows missing/malformed (logs warning).
export function parseAssetConfig(rows: Array<{ key: string; value: any }>): AssetConfig;
```

**Utilities:**
```typescript
// Resolve display label for an asset type + optional platform.
// Priority: compound_short_labels[platform] → short_label → raw key.
// Also handles legacy compound asset_type keys (e.g., "transcript_youtube")
// by splitting on "_" and attempting to match type + platform.
export function resolveAssetLabel(config: AssetConfig, assetType: string, platform?: string | null): string;

// Build asset_id: "{projectId}_{type}_{platform}_{variant}" (omits null segments)
export function buildAssetId(projectId: string, assetType: string, platform?: string | null, variant?: string | null): string;

// Filter helpers for dropdowns
export function getActiveTypes(config: AssetConfig): AssetTypeConfig[];
export function getActivePlatforms(config: AssetConfig): AssetPlatformConfig[];
```

**Fallback config:** Baked-in constant matching the migration values. Used when DB rows are missing.

### 1.3 Client hook: `src/hooks/use-asset-config.ts` (new file)

Fetch-only. Imports types and parser from `src/lib/asset-config.ts`.

```typescript
export const assetConfigKeys = {
  all: ["asset-config"] as const,
};

export function useAssetConfig(): {
  config: AssetConfig;
  isLoading: boolean;
}
```

- Single query: `.from("app_settings").select("*").eq("category", "assets")`
- Delegates to `parseAssetConfig()` for parsing
- `staleTime: 60_000` (1 minute)
- Returns fallback config while loading (never undefined)

### 1.4 Server helper: `src/lib/asset-config.server.ts` (new file)

For MCP routes (server-side, not React):

```typescript
// 60-second in-memory cache (same pattern as pinecone namespaces)
export async function loadAssetConfig(supabase: SupabaseClient): Promise<AssetConfig>;
```

Imports parser from `src/lib/asset-config.ts`. Caches parsed result for 60s.

### 1.5 Tests: `src/lib/__tests__/asset-config.test.ts` (new file)

- `parseAssetConfig` — valid rows, missing rows (fallback), malformed JSON
- `resolveAssetLabel` — base types, with platform, compound labels, legacy compound keys, unknown fallback
- `buildAssetId` — with/without platform, with/without variant, edge cases
- `getActiveTypes` / `getActivePlatforms` — filters inactive entries correctly

---

## PR 2: Replace Hardcoded Consumers

### 2.1 `src/lib/mcp/server.ts`

**Lines 69-70** (instructions string):
- Load config via `loadAssetConfig()`
- Generate type/platform lists from config, interpolate into instructions

**Line 462** (add_asset schema description):
- Build description from active config types

### 2.2 `src/hooks/use-deliverables.ts`

**Line 263** (`useCreateProject` — initial asset):
- Mutation takes defaults from caller (the UI page passes them in)
- Replace hardcoded `post_substack_main` with `buildAssetId()`
- Replace hardcoded `asset_type: "post"` with caller-supplied default
- Add `platform` field (currently not set explicitly)

### 2.3 `src/components/calendar/project-card.tsx`

**Lines 53-65** (ASSET_TYPE_LABELS constant):
- Delete hardcoded map
- Use `useAssetConfig()` hook + `resolveAssetLabel()` utility

### 2.4 `src/app/(dashboard)/settings/page.tsx`

**Line 72** (`default_output_formats`):
- Remove hardcoded `["substack", "youtube", "tiktok"]`

### 2.5 `src/app/(dashboard)/deliverables/page.tsx`

**Lines 201-203** (asset type badges):
- Use `resolveAssetLabel()` for display instead of raw type key

### 2.6 `src/hooks/use-assets.ts`

**Lines 98-101** (`useCreateAsset` onSuccess):
- Add invalidation for `deliverableKeys.detail(data.project_id)` and `deliverableKeys.lists()`

### 2.7 `mcp-server/src/tools/write.ts` (optional)

**Lines 146, 153** — Update hardcoded descriptions if package is actively deployed.

### Files NOT changed (intentional)

| File | Why |
|------|-----|
| `deliverables/[id]/assets/[assetId]/page.tsx` | `=== "promptkit"` is business logic |
| `thumbnails/page.tsx` | `=== "thumbnail"` is business logic |
| `subscriber-server.ts` | Queries for `"promptkit"` — correct as-is |
| `use-deliverables.ts` (lines 199, 320, 329) | Prompt kit hooks — business logic |

---

## PR 3: Add Asset Dialog

### 3.1 Component: `Dialog` (not AlertDialog)

Standard form dialog. AlertDialog is for destructive confirmations.

### 3.2 Placement

Project detail page (`deliverables/[id]/page.tsx`), next to "Assets (N)" heading.

### 3.3 Fields

| Field | Type | Required | Source |
|-------|------|----------|--------|
| Name | Text input | Yes | Prefilled from type label, editable |
| Asset Type | Select | Yes | `getActiveTypes(config)` |
| Platform | Select | Conditional | Shown when `supports_platform: true` |
| Variant | Text input | No | Prefilled from type's `default_variant` |
| Content | Textarea | No | Optional |

Defaults from `config.defaults.add_asset_dialog`. Asset ID preview below fields.

### 3.4 Collision handling

Insert → catch Postgres unique violation (23505) → increment variant → retry. No pre-check query. Race-safe.

### 3.5 `useCreateProject` change

Caller (UI at `/deliverables/new`) reads defaults from `useAssetConfig()` and passes them into the mutation. Mutation has no config awareness — it just uses what it receives.

---

## Manual Testing Checklist

- [ ] Create new project — initial asset is still post/substack/main
- [ ] Open project detail — asset cards render with correct labels
- [ ] Calendar view — badges: YT Script, TT Script, Substack, LinkedIn, etc.
- [ ] Deliverables list — type badges display correctly
- [ ] Prompt kit actions (convert/regenerate/add/preamble) all still work
- [ ] Thumbnail save flow still creates correct asset
- [ ] MCP `add_asset` tool — description shows current types/platforms
- [ ] MCP instructions — lists current types/platforms
- [ ] Add Asset dialog — dropdowns populated from DB
- [ ] Add Asset — collision retry works (23505 → increment variant)
- [ ] Edit `app_settings` asset_platforms — new platform appears after cache expires
- [ ] Missing `app_settings` rows — fallback defaults, no crashes
