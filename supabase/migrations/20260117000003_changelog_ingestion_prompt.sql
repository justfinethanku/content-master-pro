-- Changelog ingestion prompt for daily news curation
-- Used by the ingestion script to parse official changelogs

-- Insert prompt set
INSERT INTO prompt_sets (slug, name, prompt_type, description) VALUES
  ('changelog_ingestion', 'Changelog Ingestion', 'utility', 'Parse official changelogs from AI/dev tool sources and extract structured updates')
ON CONFLICT (slug) DO NOTHING;

-- Insert initial prompt version
INSERT INTO prompt_versions (prompt_set_id, version, prompt_content, model_id, status, api_config)
SELECT
  ps.id,
  1,
  'You are analyzing the official changelog/release notes for {{source_name}}.

Source URL: {{source_url}}
Date range: {{date_range}}

For each update found, extract:
1. Headline (concise title, max 100 chars)
2. Summary (2-3 sentences explaining the change and its significance)
3. Impact level: "minor" (bug fix, small improvement), "major" (new feature, significant change), or "breaking" (API changes, deprecations)
4. Published date (if available)

Return as JSON array:
[
  {
    "headline": "...",
    "summary": "...",
    "impact_level": "minor|major|breaking",
    "published_at": "YYYY-MM-DD" or null
  }
]

Only include updates from the last 7 days. If no recent updates found, return empty array [].
Focus on changes that would matter to developers and AI practitioners. Skip minor documentation typo fixes.',
  (SELECT id FROM ai_models WHERE model_id = 'perplexity/sonar-pro' LIMIT 1),
  'active',
  '{"temperature": 0.3, "max_tokens": 4000}'::jsonb
FROM prompt_sets ps WHERE ps.slug = 'changelog_ingestion';

-- Update current_version_id
UPDATE prompt_sets SET current_version_id = (
  SELECT id FROM prompt_versions
  WHERE prompt_versions.prompt_set_id = prompt_sets.id
  AND status = 'active'
  ORDER BY version DESC
  LIMIT 1
) WHERE slug = 'changelog_ingestion';
