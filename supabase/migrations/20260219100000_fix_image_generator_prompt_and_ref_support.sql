-- Fix image_generator prompt (previous migration's DO block may have silently skipped
-- the prompt_version insert if no image model existed at migration time)
-- Also expand reference image support flags for Google Imagen 4 models.

-- 1. Ensure the prompt set exists
INSERT INTO prompt_sets (slug, name, prompt_type, description)
VALUES ('image_generator', 'Image Generator', 'image_generation', 'Direct image generation using AI image models')
ON CONFLICT (slug) DO NOTHING;

-- 2. Ensure an active prompt version exists (the critical missing piece)
-- Uses a CTE to get IDs, then inserts only if the version doesn't already exist
WITH prompt_info AS (
  SELECT ps.id AS prompt_set_id, am.id AS model_id
  FROM prompt_sets ps
  CROSS JOIN (
    SELECT id FROM ai_models
    WHERE model_id = 'google/imagen-4.0-generate'
    UNION ALL
    SELECT id FROM ai_models
    WHERE model_type = 'image'
    LIMIT 1
  ) am
  WHERE ps.slug = 'image_generator'
  LIMIT 1
)
INSERT INTO prompt_versions (prompt_set_id, version, status, model_id, prompt_content, api_config)
SELECT
  pi.prompt_set_id,
  1,
  'active',
  pi.model_id,
  '{{content}}',
  '{"quality": "hd"}'::jsonb
FROM prompt_info pi
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_versions pv
  WHERE pv.prompt_set_id = pi.prompt_set_id
  AND pv.status = 'active'
);

-- 3. Update current_version_id on prompt_sets (for Prompt Studio display)
UPDATE prompt_sets ps SET
  current_version_id = pv.id
FROM prompt_versions pv
WHERE pv.prompt_set_id = ps.id
  AND pv.status = 'active'
  AND ps.slug = 'image_generator'
  AND ps.current_version_id IS NULL;

-- 4. Set model_type_filter so Prompt Studio shows image models in the dropdown
UPDATE prompt_sets
SET model_type_filter = 'image'
WHERE slug = 'image_generator'
  AND (model_type_filter IS NULL OR model_type_filter = 'text');

-- 5. Mark Google Imagen 4 models as supporting reference images
-- Uses JSONB merge to preserve existing image_config fields
UPDATE ai_models SET
  image_config = image_config || '{"supports_image_input": true}'::jsonb
WHERE model_id IN (
  'google/imagen-4.0-generate',
  'google/imagen-4.0-fast-generate',
  'google/imagen-4.0-ultra-generate'
)
AND image_config IS NOT NULL;
