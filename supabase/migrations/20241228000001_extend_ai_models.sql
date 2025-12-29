-- Extend ai_models table with model type classification and configuration
-- Part of Meta Prompt Assembly System Refactor

-- Add model type classification
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS
  model_type TEXT NOT NULL DEFAULT 'text'
    CHECK (model_type IN ('text', 'image', 'research'));

-- Add prompting guidance columns (for text/research models)
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS system_prompt_tips TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS preferred_format TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS format_instructions TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS quirks JSONB DEFAULT '[]';

-- Add image generation config (for image models)
-- Structure: {
--   "provider_options_key": "google" | "bfl" | "openai",
--   "dimension_mode": "aspect_ratio" | "pixels" | "size",
--   "supported_aspect_ratios": ["1:1", "16:9", "9:16"],
--   "default_aspect_ratio": "16:9",
--   "default_dimensions": {"width": 1024, "height": 1024},
--   "supported_sizes": ["1024x1024", "1792x1024"],
--   "supports_negative_prompt": false,
--   "max_prompt_length": 4000,
--   "quality_options": ["standard", "hd"]
-- }
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS image_config JSONB;

-- Add research config (for research models like Perplexity)
-- Structure: {
--   "returns_citations": true,
--   "search_recency_options": ["day", "week", "month", "year"],
--   "default_recency": "month"
-- }
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS research_config JSONB;

-- Add API specifics
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS api_endpoint_override TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS api_notes TEXT;

-- Add default parameters
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS default_temperature NUMERIC(3,2) DEFAULT 0.7;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS default_max_tokens INTEGER DEFAULT 4096;

-- Create index for model_type queries
CREATE INDEX IF NOT EXISTS idx_ai_models_type ON ai_models(model_type);

-- Add comment explaining the model_type values
COMMENT ON COLUMN ai_models.model_type IS 'text = standard LLM (Claude, GPT, Gemini text), image = image generation (DALL-E, Imagen, Flux), research = web search with citations (Perplexity)';
