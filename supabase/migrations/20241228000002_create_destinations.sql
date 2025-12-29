-- Create destinations table for platform-specific output configuration
-- Part of Meta Prompt Assembly System Refactor

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic identification
  slug TEXT UNIQUE NOT NULL,              -- 'youtube', 'tiktok', 'substack'
  name TEXT NOT NULL,                     -- 'YouTube'
  category TEXT NOT NULL,                 -- 'video', 'social', 'newsletter'

  -- Platform constraints and specifications
  -- Structure varies by category:
  -- video: { "aspect_ratio": "16:9", "max_duration_seconds": 600, "thumbnail_size": "1280x720" }
  -- text: { "max_characters": 3000, "supports_markdown": true, "supports_html": false }
  -- social: { "max_characters": 280, "supports_threads": true }
  specs JSONB NOT NULL DEFAULT '{}',

  -- Prompt adjustments for this platform
  prompt_instructions TEXT,               -- "Write for spoken delivery. Include [VISUAL CUE] markers."

  -- Tone modifiers to apply when generating for this platform
  tone_modifiers JSONB DEFAULT '[]',      -- ["conversational", "hook-driven", "visual"]

  -- Status and ordering
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_destinations_slug ON destinations(slug);
CREATE INDEX IF NOT EXISTS idx_destinations_category ON destinations(category);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

-- Destinations are global (not user-specific), so authenticated users can read
CREATE POLICY "Authenticated users can read destinations"
  ON destinations FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can modify destinations (admin operation)
CREATE POLICY "Service role can manage destinations"
  ON destinations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER destinations_updated_at
  BEFORE UPDATE ON destinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE destinations IS 'Platform-specific configuration for content output (YouTube, TikTok, Substack, etc.)';
COMMENT ON COLUMN destinations.specs IS 'Platform constraints like aspect ratio, duration limits, character counts';
COMMENT ON COLUMN destinations.prompt_instructions IS 'Instructions injected into prompts when generating for this platform';
COMMENT ON COLUMN destinations.tone_modifiers IS 'Array of tone descriptors to influence generation style';
