-- Asset type, platform, and defaults configuration (single source of truth)
-- Replaces hardcoded lists scattered across MCP server, hooks, calendar, and settings UI

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
        "is_default": false,
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
        "is_default": false,
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
        "is_default": false,
        "supports_platform": false,
        "default_variant": "16x9"
      },
      {
        "key": "promptkit",
        "label": "Prompt Kit",
        "short_label": "Prompt Kit",
        "is_active": true,
        "is_default": false,
        "supports_platform": false,
        "default_variant": "1"
      },
      {
        "key": "guide",
        "label": "Guide",
        "short_label": "Guide",
        "is_active": true,
        "is_default": false,
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
      { "key": "youtube", "label": "YouTube", "short_label": "YouTube", "is_active": true, "is_default": false },
      { "key": "tiktok", "label": "TikTok", "short_label": "TikTok", "is_active": true, "is_default": false },
      { "key": "linkedin", "label": "LinkedIn", "short_label": "LinkedIn", "is_active": true, "is_default": false },
      { "key": "twitter", "label": "Twitter/X", "short_label": "Twitter", "is_active": true, "is_default": false }
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
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
