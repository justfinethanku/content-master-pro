-- Preamble v2: replace {{prompt_kit_link}} with {{resources_cta}}
-- Supports prompt kits, guides, or both in the CTA line.

BEGIN;

-- 1. Upsert v2 prompt version
INSERT INTO prompt_versions (prompt_set_id, version, prompt_content, model_id, status, api_config)
SELECT
  ps.id,
  2,
  E'You are a newsletter preamble writer. Your job is to write a short, compelling preamble that goes at the TOP of a newsletter post to hook readers and point them to companion resources (prompt kits and/or guides).\n\n## WHAT YOU''RE WRITING\n\nA preamble that:\n1. Opens with a hook (1-2 sentences that make the reader want to keep going)\n2. Summarizes what this post covers (1-2 short paragraphs)\n3. Lists what''s inside with a \"Here''s what''s inside:\" bullet list (4-8 items)\n4. Ends with the resource CTA line\n\n## RULES\n\n- 150-300 words total\n- Second person (\"you\", \"your\")\n- Direct, practical tone — no corporate hedging\n- The hook should create curiosity or identify a pain point\n- Bullet items should be specific and benefit-oriented, not vague\n- End with this EXACT line on its own: {{resources_cta}}\n- Do NOT include any heading above the preamble (no \"# Preamble\" or similar)\n- Do NOT include the horizontal rule (---) at the end — the system adds that\n\n## OUTPUT FORMAT\n\nReturn ONLY the preamble text in markdown. No code blocks, no meta-commentary.\n\nExample structure:\n\n[Hook sentence(s)]\n\n[Summary paragraph(s)]\n\nHere''s what''s inside:\n\n- [Specific benefit/topic 1]\n- [Specific benefit/topic 2]\n- [Specific benefit/topic 3]\n- [Specific benefit/topic 4]\n\n{{resources_cta}}\n\n## THE POST\n\n{{content}}',
  (SELECT id FROM ai_models WHERE model_id = 'anthropic/claude-sonnet-4-5-20250929' LIMIT 1),
  'active',
  '{"temperature": 0.7, "max_tokens": 1500}'::jsonb
FROM prompt_sets ps
WHERE ps.slug = 'post_preamble_generator'
ON CONFLICT (prompt_set_id, version) DO NOTHING;

-- 2. Ensure v2 is active (in case a prior run archived it)
UPDATE prompt_versions
SET status = 'active'
WHERE prompt_set_id = (SELECT id FROM prompt_sets WHERE slug = 'post_preamble_generator')
  AND version = 2;

-- 3. Archive other active versions (but not v2 itself)
UPDATE prompt_versions
SET status = 'archived'
WHERE prompt_set_id = (SELECT id FROM prompt_sets WHERE slug = 'post_preamble_generator')
  AND status = 'active'
  AND version <> 2;

-- 4. Repoint current_version_id to v2
UPDATE prompt_sets
SET current_version_id = (
  SELECT id FROM prompt_versions
  WHERE prompt_set_id = prompt_sets.id
    AND version = 2
  LIMIT 1
)
WHERE slug = 'post_preamble_generator';

-- 5. Update prompt set description
UPDATE prompt_sets
SET description = 'Generates a preamble with hook, summary, and resource CTA (prompt kits and/or guides) to prepend to posts'
WHERE slug = 'post_preamble_generator';

COMMIT;
