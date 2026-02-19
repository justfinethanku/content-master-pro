-- Enrich AI Models with Vercel AI Gateway data
-- Adds columns for rich metadata auto-populated from gateway API

-- ==============================================================================
-- 1. Add gateway metadata columns to ai_models
-- ==============================================================================

-- Model description from gateway
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS description TEXT;

-- Full pricing object (input/output/image/web_search/cache rates)
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS pricing JSONB;

-- Capability tags array (reasoning, vision, tool-use, etc.)
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- When model was released
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Raw gateway type (language/image/embedding) — preserved for reference
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS gateway_type TEXT;

-- ==============================================================================
-- 2. Change is_available default to FALSE (new synced models start hidden)
-- ==============================================================================
ALTER TABLE ai_models ALTER COLUMN is_available SET DEFAULT FALSE;

-- ==============================================================================
-- 3. Add model_type_filter to prompt_sets for type-filtered model dropdowns
-- ==============================================================================
ALTER TABLE prompt_sets ADD COLUMN IF NOT EXISTS model_type_filter TEXT
  DEFAULT 'text' CHECK (model_type_filter IN ('text', 'image', 'research'));

-- ==============================================================================
-- 4. Add composite index for filtered model queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_models_type_available ON ai_models(model_type, is_available);

-- ==============================================================================
-- 5. Comments
-- ==============================================================================
COMMENT ON COLUMN ai_models.description IS 'Model description auto-populated from Vercel AI Gateway';
COMMENT ON COLUMN ai_models.pricing IS 'Pricing object from gateway: {input, output, image, web_search, cache_creation_input, cache_read_input} — values are per-token strings';
COMMENT ON COLUMN ai_models.tags IS 'Capability tags from gateway: reasoning, vision, tool-use, file-input, image-generation, implicit-caching';
COMMENT ON COLUMN ai_models.released_at IS 'Model release date from gateway';
COMMENT ON COLUMN ai_models.gateway_type IS 'Raw type from gateway API: language, image, or embedding';
COMMENT ON COLUMN prompt_sets.model_type_filter IS 'Filters model dropdown in prompt editor: text, image, or research';
