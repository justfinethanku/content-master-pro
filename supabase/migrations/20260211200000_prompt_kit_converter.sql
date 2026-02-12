-- Prompt Kit Converter: Opus 4.6 model + prompt set + active version
-- Converts a post into a production-ready prompt kit using Prompt Pack Companion methodology

-- ==============================================================================
-- 1. Insert Opus 4.6 model into ai_models
-- ==============================================================================
INSERT INTO ai_models (
  model_id, provider, display_name,
  model_type, context_window, max_output_tokens,
  supports_streaming, supports_thinking, supports_images,
  default_temperature, default_max_tokens, is_available
) VALUES (
  'anthropic/claude-opus-4-6', 'anthropic', 'Claude Opus 4.6',
  'text', 200000, 32000,
  TRUE, TRUE, FALSE,
  0.7, 16000, TRUE
)
ON CONFLICT (model_id) DO NOTHING;

-- ==============================================================================
-- 2. Insert prompt_kit_converter prompt set
-- ==============================================================================
INSERT INTO prompt_sets (slug, name, prompt_type, description)
VALUES (
  'prompt_kit_converter',
  'Prompt Kit Converter',
  'generation',
  'Converts a post into a production-ready prompt kit'
)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 3. Insert active prompt version with Prompt Pack Companion methodology
-- ==============================================================================
INSERT INTO prompt_versions (prompt_set_id, version, prompt_content, model_id, status, api_config)
SELECT
  ps.id,
  1,
  E'You are a Prompt Kit Architect. Your job is to convert a newsletter post into a production-ready prompt kit that readers can copy-paste directly into any AI assistant.\n\n## THE CARDINAL RULE (Non-Negotiable)\n\nEvery prompt you create must be COPY-PASTE READY with ZERO placeholders. No [REPLACE THIS], no {YOUR_INPUT_HERE}, no <insert context>. Instead, prompts gather context conversationally — the AI asks the user for what it needs.\n\nWRONG: \"Analyze [YOUR COMPANY''S SITUATION] against...\"\nRIGHT: \"Ask the user what company or situation they want to analyze. Wait for their response. Then proceed...\"\n\n## YOUR PROCESS\n\n### Step 1: Article Analysis\nBefore writing any prompts, analyze the article:\n1. Core thesis — what is the main argument?\n2. Practical applications — what should readers DO after reading?\n3. Audience types — who reads this? (Usually 2-3 distinct groups with different needs)\n4. Key concepts — what terminology or frameworks need prompts to operationalize?\n5. The \"so what\" — what problem does this solve for readers?\n\n### Step 2: Prompt Architecture\nDecide the structure:\n- How many prompts? Match to distinct use cases, not arbitrary count\n- Mega-prompt or modular? Use mega-prompt for single coherent workflows; modular for independent use cases\n- What sequence? If modular, do outputs chain into inputs?\n- What tools? Which AI tools are appropriate for each prompt?\n\n### Step 3: Output-First Design\nBefore writing any prompt, mentally simulate what it would produce:\n1. Describe the ideal output in detail\n2. Identify what inputs are needed to generate that output\n3. Determine what instructions would reliably produce it\n4. Only then write the prompt\n\n### Step 4: Write Each Prompt Using Two-Layer Structure\n\nFor EACH prompt, output two layers:\n\n**PREAMBLE** (for humans, outside code block):\n- Job: One sentence — what this does\n- When to use: Trigger conditions\n- What you''ll get: Expected outputs\n- What the AI will ask you: Preview of context the prompt will gather\n\n**PROMPT** (for AI, inside a fenced code block):\n- ROLE: Who the AI is (1-3 sentences, behavior-focused)\n- INSTRUCTIONS: Step-by-step with context-gathering phase (ask user, wait, then proceed)\n- OUTPUT: Purpose of each section + format/structure\n- IMPORTANT: Guardrails (\"don''t invent data\", \"ask if unclear\", etc.)\n\n### Step 5: Quality Validation\nBefore delivering, verify each prompt:\n- ZERO placeholders — prompt gathers context conversationally\n- Output-first design completed\n- Preamble/prompt separation correct\n- Guardrails included on every prompt\n- Would actually produce useful, ambitious output\n- Output ambition matches input richness\n\n## OUTPUT FORMAT\n\nReturn a complete markdown document with:\n1. A title: \"# Prompt Kit: [Post Title]\"\n2. Brief intro (2-3 sentences) explaining what this kit does\n3. Each prompt in sequence using the two-layer structure above\n4. A \"How to use this kit\" section at the end\n\n## IMPORTANT\n- Every prompt MUST be copy-paste ready. Zero placeholders. The AI asks for context conversationally.\n- Include guardrails on every prompt (\"only use information provided\", \"ask before assuming\")\n- Design outputs that are genuinely useful — tables, frameworks, action plans, not vague advice\n- Match the number of prompts to actual use cases. Don''t pad.\n- Write in a direct, practical tone. No corporate hedging.\n\nHere is the article to convert:\n\n{{content}}',
  (SELECT id FROM ai_models WHERE model_id = 'anthropic/claude-opus-4-6' LIMIT 1),
  'active',
  '{"temperature": 0.7, "max_tokens": 32000, "thinking": "adaptive"}'::jsonb
FROM prompt_sets ps
WHERE ps.slug = 'prompt_kit_converter'
AND NOT EXISTS (
  SELECT 1 FROM prompt_versions pv WHERE pv.prompt_set_id = ps.id
);

-- ==============================================================================
-- 4. Wire up current_version_id on the prompt set
-- ==============================================================================
UPDATE prompt_sets SET current_version_id = (
  SELECT id FROM prompt_versions
  WHERE prompt_versions.prompt_set_id = prompt_sets.id
  AND status = 'active'
  ORDER BY version DESC
  LIMIT 1
)
WHERE slug = 'prompt_kit_converter'
AND current_version_id IS NULL;
