-- Add image_generator prompt set for direct image generation
-- This is a passthrough prompt that uses the user's prompt directly

-- Create the prompt set
INSERT INTO prompt_sets (slug, name, prompt_type, description) VALUES
  ('image_generator', 'Image Generator', 'image_generation', 'Direct image generation using AI image models')
ON CONFLICT (slug) DO NOTHING;

-- Get the default image model
DO $$
DECLARE
  v_prompt_set_id uuid;
  v_model_id uuid;
BEGIN
  -- Get the prompt set ID
  SELECT id INTO v_prompt_set_id FROM prompt_sets WHERE slug = 'image_generator';

  -- Get the Imagen model ID (or fall back to any image model)
  SELECT id INTO v_model_id FROM ai_models
  WHERE model_id = 'google/imagen-4.0-generate'
  OR model_type = 'image'
  LIMIT 1;

  -- Only insert if we have both IDs
  IF v_prompt_set_id IS NOT NULL AND v_model_id IS NOT NULL THEN
    -- Create the prompt version
    INSERT INTO prompt_versions (
      prompt_set_id,
      version,
      status,
      model_id,
      prompt_content,
      api_config
    ) VALUES (
      v_prompt_set_id,
      1,
      'active',
      v_model_id,
      '{{content}}',
      '{"quality": "hd"}'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
