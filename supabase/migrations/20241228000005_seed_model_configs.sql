-- Seed model configurations with type-specific settings
-- Part of Meta Prompt Assembly System Refactor
--
-- This migration categorizes all ai_models by type (text/image/research)
-- and adds appropriate prompting tips and configuration for each.

-- ==============================================================================
-- TEXT MODELS: Anthropic Claude
-- ==============================================================================
UPDATE ai_models SET
  model_type = 'text',
  system_prompt_tips = 'Claude responds exceptionally well to XML-structured prompts. Use semantic tags like <context>, <instructions>, <examples>, <constraints>. Be explicit about desired output format. Claude follows system prompts closely - put your most important instructions there.',
  preferred_format = 'xml',
  format_instructions = 'Wrap major sections in descriptive XML tags. Use <thinking> for chain-of-thought when reasoning is needed. Structure output with clear headers and logical flow.',
  quirks = '["Excellent at following complex multi-step instructions", "May be overly verbose without explicit length constraints", "Responds well to roleplay/persona framing"]'::jsonb,
  default_temperature = 0.7,
  default_max_tokens = 4096,
  api_notes = 'Uses Vercel AI Gateway OpenAI-compatible format. Response in choices[0].message.content.'
WHERE provider = 'anthropic';

-- ==============================================================================
-- TEXT MODELS: Google Gemini (text-only versions)
-- ==============================================================================
UPDATE ai_models SET
  model_type = 'text',
  system_prompt_tips = 'Gemini works well with clear, direct instructions. Use markdown for structure. Gemini 2.5 Pro has exceptional long-context reasoning. Be specific about what you want - it can handle nuanced requests.',
  preferred_format = 'markdown',
  format_instructions = 'Use markdown headers, lists, and code blocks for structure. Gemini handles JSON output well when requested explicitly.',
  quirks = '["Massive context window (1M-2M tokens)", "Strong at code and technical content", "May need explicit formatting requests for consistent output"]'::jsonb,
  default_temperature = 0.7,
  default_max_tokens = 8192,
  api_notes = 'Uses Vercel AI Gateway OpenAI-compatible format.'
WHERE provider = 'google' AND model_id IN ('google/gemini-2.0-flash', 'google/gemini-2.5-pro');

-- ==============================================================================
-- RESEARCH MODELS: Perplexity
-- ==============================================================================
UPDATE ai_models SET
  model_type = 'research',
  system_prompt_tips = 'Perplexity will automatically search the web for current information. Be specific about what information you need and the recency requirements. Ask for sources when accuracy is critical.',
  preferred_format = 'markdown',
  format_instructions = 'Request citations inline or at the end. Ask for structured summaries of findings. Specify if you want bullet points vs prose.',
  quirks = '["Returns citations[] array with sources", "Best for current events and recent data", "May include more sources than strictly necessary"]'::jsonb,
  research_config = '{
    "returns_citations": true,
    "search_recency_options": ["day", "week", "month", "year"],
    "default_recency": "month"
  }'::jsonb,
  default_temperature = 0.3,
  default_max_tokens = 4096,
  api_notes = 'Response includes citations[] array alongside content. Lower temperature recommended for factual accuracy.'
WHERE provider = 'perplexity';

-- ==============================================================================
-- IMAGE MODELS: Google Imagen
-- ==============================================================================
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'Be descriptive about composition, lighting, mood, and style. Imagen 4 excels at photorealistic images. Avoid requesting text in images - it struggles with accurate text rendering.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "google",
    "dimension_mode": "aspect_ratio",
    "supported_aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4"],
    "default_aspect_ratio": "16:9",
    "supports_negative_prompt": false,
    "max_prompt_length": 4000,
    "quality_options": ["standard"]
  }'::jsonb,
  default_temperature = NULL,
  default_max_tokens = NULL,
  api_notes = 'Uses Vercel AI SDK generateText() with providerOptions.google.imageConfig.aspectRatio'
WHERE model_id IN ('google/imagen-4.0-generate', 'google/imagen-4.0-fast-generate', 'google/imagen-4.0-ultra-generate');

-- Imagen 4.0 Ultra has additional quality options
UPDATE ai_models SET
  image_config = '{
    "provider_options_key": "google",
    "dimension_mode": "aspect_ratio",
    "supported_aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4"],
    "default_aspect_ratio": "16:9",
    "supports_negative_prompt": false,
    "max_prompt_length": 4000,
    "quality_options": ["standard", "hd"]
  }'::jsonb
WHERE model_id = 'google/imagen-4.0-ultra-generate';

-- ==============================================================================
-- IMAGE MODELS: Google Gemini Nano Banana Pro (gemini-3-pro-image if exists)
-- This is the advanced image model mentioned in project docs
-- ==============================================================================
-- First, add it if it doesn't exist
INSERT INTO ai_models (model_id, provider, display_name, context_window, max_output_tokens, supports_images, supports_streaming)
VALUES ('google/gemini-3-pro-image', 'google', 'Nano Banana Pro (Gemini 3 Pro Image)', NULL, NULL, TRUE, FALSE)
ON CONFLICT (model_id) DO NOTHING;

-- Then configure it
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'Nano Banana Pro excels at diagrams, infographics, UI mockups, and photorealistic content. Supports natural language prompting and JSON precision control. Best for LEJ branded images. Specify composition, lighting, and style in detail.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "google",
    "dimension_mode": "aspect_ratio",
    "supported_aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"],
    "default_aspect_ratio": "16:9",
    "supports_negative_prompt": false,
    "max_prompt_length": 8000,
    "quality_options": ["standard", "hd"],
    "special_capabilities": ["diagrams", "infographics", "ui_mockups", "web_search_integration"]
  }'::jsonb,
  api_notes = 'Advanced Google image model with web search integration for reference images. Uses natural language or JSON for precise control.'
WHERE model_id = 'google/gemini-3-pro-image';

-- ==============================================================================
-- IMAGE MODELS: OpenAI DALL-E
-- ==============================================================================
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'DALL-E 3 works best with detailed scene descriptions. Describe the subject, setting, mood, style, and artistic influences. Avoid complex text requests - it struggles with accurate lettering.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "openai",
    "dimension_mode": "size",
    "supported_sizes": ["1024x1024", "1792x1024", "1024x1792"],
    "default_size": "1024x1024",
    "quality_options": ["standard", "hd"],
    "supports_negative_prompt": false,
    "max_prompt_length": 4000
  }'::jsonb,
  api_notes = 'Uses Vercel AI SDK with providerOptions.openai.size and providerOptions.openai.quality'
WHERE model_id = 'openai/dall-e-3';

UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'DALL-E 2 is faster but lower quality than DALL-E 3. Good for quick iterations. Keep prompts simpler.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "openai",
    "dimension_mode": "size",
    "supported_sizes": ["256x256", "512x512", "1024x1024"],
    "default_size": "1024x1024",
    "quality_options": ["standard"],
    "supports_negative_prompt": false,
    "max_prompt_length": 1000
  }'::jsonb,
  api_notes = 'Legacy model, use DALL-E 3 for better quality.'
WHERE model_id = 'openai/dall-e-2';

-- ==============================================================================
-- IMAGE MODELS: Black Forest Labs FLUX
-- ==============================================================================

-- FLUX 2 Pro - Latest flagship
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX 2 Pro excels at photorealism and cinematic imagery. Be specific about lighting, composition, and atmosphere. Supports negative prompts for excluding unwanted elements.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 512, "height": 512},
      {"width": 768, "height": 768},
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920},
      {"width": 1280, "height": 720},
      {"width": 720, "height": 1280}
    ],
    "supports_negative_prompt": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Uses Vercel AI SDK with providerOptions.bfl.width and providerOptions.bfl.height. Supports negative_prompt parameter.'
WHERE model_id = 'bfl/flux-2-pro';

-- FLUX 2 Flex - Faster variant
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX 2 Flex is optimized for speed while maintaining good quality. Good for iterations and drafts.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 512, "height": 512},
      {"width": 768, "height": 768},
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920}
    ],
    "supports_negative_prompt": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Faster than FLUX 2 Pro with slightly lower quality. Good for quick iterations.'
WHERE model_id = 'bfl/flux-2-flex';

-- FLUX 1.1 Pro Ultra - High quality
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX 1.1 Pro Ultra produces highest quality images in the FLUX 1.x family. Use for final production assets.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920},
      {"width": 2048, "height": 2048}
    ],
    "supports_negative_prompt": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Highest quality FLUX 1.x model. Slower but produces production-ready images.'
WHERE model_id = 'bfl/flux-pro-1.1-ultra';

-- FLUX 1.1 Pro - Balanced
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX 1.1 Pro offers excellent balance of quality and speed. Good default choice for most use cases.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 512, "height": 512},
      {"width": 768, "height": 768},
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920}
    ],
    "supports_negative_prompt": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Balanced quality and speed. Good general-purpose choice.'
WHERE model_id = 'bfl/flux-pro-1.1';

-- FLUX 1.0 Fill Pro - Inpainting
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX Fill is specialized for inpainting and image editing. Provide the original image and mask for best results.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 512, "height": 512},
      {"width": 1024, "height": 1024}
    ],
    "supports_negative_prompt": true,
    "supports_inpainting": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Inpainting model. Requires image and mask inputs for editing operations.'
WHERE model_id = 'bfl/flux-pro-1.0-fill';

-- FLUX Kontext models - Context-aware editing
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX Kontext Max is specialized for context-aware image editing. Describe the changes you want relative to the input image.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920}
    ],
    "supports_negative_prompt": true,
    "supports_image_input": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Context-aware editing. Can modify existing images based on text instructions.'
WHERE model_id = 'bfl/flux-kontext-max';

UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX Kontext Pro offers context-aware editing at a lower cost than Max. Good for iterative editing workflows.',
  preferred_format = 'plain',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920}
    ],
    "supports_negative_prompt": true,
    "supports_image_input": true,
    "max_prompt_length": 2000
  }'::jsonb,
  api_notes = 'Context-aware editing, more cost-effective than Kontext Max.'
WHERE model_id = 'bfl/flux-kontext-pro';

-- ==============================================================================
-- Catch-all: Set any remaining models to 'text' type as default
-- ==============================================================================
UPDATE ai_models SET
  model_type = 'text'
WHERE model_type IS NULL OR model_type = '';

