-- Migration: AI SDK Image Generation
-- Date: 2026-02-19
--
-- Ensures Gemini model has supports_image_input: true in its image_config,
-- which is required for the AI SDK migration to pass reference images via prompt.images[].
--
-- Also adds generation_method field to ImageConfig type documentation
-- ("image_api" for BFL/OpenAI, "chat_completions" for Gemini multimodal LLMs).

-- Update Gemini model to have supports_image_input: true
UPDATE ai_models
SET image_config = jsonb_set(
  COALESCE(image_config, '{}'::jsonb),
  '{supports_image_input}',
  'true'::jsonb
)
WHERE model_id = 'google/gemini-3-pro-image'
  AND (image_config->>'supports_image_input' IS NULL OR image_config->>'supports_image_input' = 'false');

-- Fix Imagen models: they do NOT support image input (editing fails in practice)
UPDATE ai_models
SET image_config = jsonb_set(
  COALESCE(image_config, '{}'::jsonb),
  '{supports_image_input}',
  'false'::jsonb
)
WHERE model_id LIKE 'google/imagen-%'
  AND image_config->>'supports_image_input' = 'true';
