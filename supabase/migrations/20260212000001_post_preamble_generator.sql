-- Post Preamble Generator: prompt set + active version
-- Generates a preamble (hook + summary + bullet list + CTA) to prepend to posts
-- that have a companion prompt kit. Uses Sonnet 4.5 (already in ai_models).

-- ==============================================================================
-- 1. Insert post_preamble_generator prompt set
-- ==============================================================================
INSERT INTO prompt_sets (slug, name, prompt_type, description)
VALUES (
  'post_preamble_generator',
  'Post Preamble Generator',
  'generation',
  'Generates a preamble with hook, summary, and prompt kit CTA to prepend to posts'
)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 2. Insert active prompt version with Sonnet 4.5
-- ==============================================================================
INSERT INTO prompt_versions (prompt_set_id, version, prompt_content, model_id, status, api_config)
SELECT
  ps.id,
  1,
  E'You are a newsletter preamble writer. Your job is to write a short, compelling preamble that goes at the TOP of a newsletter post to hook readers and point them to the companion prompt kit.\n\n## WHAT YOU''RE WRITING\n\nA preamble that:\n1. Opens with a hook (1-2 sentences that make the reader want to keep going)\n2. Summarizes what this post covers (1-2 short paragraphs)\n3. Lists what''s inside with a \"Here''s what''s inside:\" bullet list (4-8 items)\n4. Ends with a CTA link to the prompt kit\n\n## RULES\n\n- 150-300 words total\n- Second person (\"you\", \"your\")\n- Direct, practical tone — no corporate hedging\n- The hook should create curiosity or identify a pain point\n- Bullet items should be specific and benefit-oriented, not vague\n- End with this EXACT line on its own: [Grab the prompts]({{prompt_kit_link}})\n- Do NOT include any heading above the preamble (no \"# Preamble\" or similar)\n- Do NOT include the horizontal rule (---) at the end — the system adds that\n\n## OUTPUT FORMAT\n\nReturn ONLY the preamble text in markdown. No code blocks, no meta-commentary.\n\nExample structure:\n\n[Hook sentence(s)]\n\n[Summary paragraph(s)]\n\nHere''s what''s inside:\n\n- [Specific benefit/topic 1]\n- [Specific benefit/topic 2]\n- [Specific benefit/topic 3]\n- [Specific benefit/topic 4]\n\n[Grab the prompts]({{prompt_kit_link}})\n\n## THE POST\n\n{{content}}',
  (SELECT id FROM ai_models WHERE model_id = 'anthropic/claude-sonnet-4-5-20250929' LIMIT 1),
  'active',
  '{"temperature": 0.7, "max_tokens": 1500}'::jsonb
FROM prompt_sets ps
WHERE ps.slug = 'post_preamble_generator'
AND NOT EXISTS (
  SELECT 1 FROM prompt_versions pv WHERE pv.prompt_set_id = ps.id
);

-- ==============================================================================
-- 3. Wire up current_version_id on the prompt set
-- ==============================================================================
UPDATE prompt_sets SET current_version_id = (
  SELECT id FROM prompt_versions
  WHERE prompt_versions.prompt_set_id = prompt_sets.id
  AND status = 'active'
  ORDER BY version DESC
  LIMIT 1
)
WHERE slug = 'post_preamble_generator'
AND current_version_id IS NULL;
