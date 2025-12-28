-- Brand Guidelines System
-- Database-driven brand guidelines with per-prompt defaults and runtime overrides

-- Table: brand_guidelines
-- Stores individual guideline items by category (voice, image, tone, etc.)
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,  -- 'voice', 'image', 'tone', etc.
  slug TEXT NOT NULL,      -- 'lej_uniform', 'anti_corporate', etc.
  name TEXT NOT NULL,      -- Display name
  content TEXT NOT NULL,   -- The actual guideline text
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Enable RLS
ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own guidelines
CREATE POLICY "Users can view own brand guidelines"
  ON brand_guidelines FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create brand guidelines"
  ON brand_guidelines FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own brand guidelines"
  ON brand_guidelines FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own brand guidelines"
  ON brand_guidelines FOR DELETE
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_brand_guidelines_user ON brand_guidelines(user_id);
CREATE INDEX idx_brand_guidelines_category ON brand_guidelines(user_id, category);
CREATE INDEX idx_brand_guidelines_slug ON brand_guidelines(user_id, slug);

-- Trigger for updated_at
CREATE TRIGGER update_brand_guidelines_updated_at
  BEFORE UPDATE ON brand_guidelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table: prompt_guidelines (junction)
-- Links prompts to their default guidelines
CREATE TABLE IF NOT EXISTS prompt_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_set_id UUID REFERENCES prompt_sets(id) ON DELETE CASCADE NOT NULL,
  guideline_id UUID REFERENCES brand_guidelines(id) ON DELETE CASCADE NOT NULL,
  is_default BOOLEAN DEFAULT true,  -- Include by default when using this prompt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prompt_set_id, guideline_id)
);

-- Enable RLS
ALTER TABLE prompt_guidelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to manage prompt guidelines
-- (Guidelines are linked to prompts, which are shared)
CREATE POLICY "Authenticated users can view prompt guidelines"
  ON prompt_guidelines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create prompt guidelines"
  ON prompt_guidelines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update prompt guidelines"
  ON prompt_guidelines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete prompt guidelines"
  ON prompt_guidelines FOR DELETE
  TO authenticated
  USING (true);

-- Index for faster lookups
CREATE INDEX idx_prompt_guidelines_prompt_set ON prompt_guidelines(prompt_set_id);
CREATE INDEX idx_prompt_guidelines_guideline ON prompt_guidelines(guideline_id);
