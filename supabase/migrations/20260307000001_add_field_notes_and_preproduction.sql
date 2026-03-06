-- Add "field_notes" asset type and "pre-production" platform to asset config

UPDATE app_settings
SET value = jsonb_set(
  value,
  '{value}',
  value->'value' || '[
    {
      "key": "field_notes",
      "label": "Field Notes",
      "short_label": "Notes",
      "is_active": true,
      "is_default": false,
      "supports_platform": false,
      "default_variant": "main"
    }
  ]'::jsonb
),
updated_at = NOW()
WHERE category = 'assets' AND key = 'asset_types';

UPDATE app_settings
SET value = jsonb_set(
  value,
  '{value}',
  value->'value' || '[
    {
      "key": "pre-production",
      "label": "Pre-production",
      "short_label": "Pre-prod",
      "is_active": true,
      "is_default": false
    }
  ]'::jsonb
),
updated_at = NOW()
WHERE category = 'assets' AND key = 'asset_platforms';
