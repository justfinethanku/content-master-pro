-- Add search_chat prompt set for RAG-powered chat in /search
-- Rule 3: Database-Driven Prompt Management

-- Insert prompt set
INSERT INTO prompt_sets (slug, name, prompt_type, description) VALUES
  ('search_chat', 'Search Chat', 'chat', 'RAG-powered chat for searching newsletter content')
ON CONFLICT (slug) DO NOTHING;

-- Insert active prompt version
INSERT INTO prompt_versions (prompt_set_id, version, prompt_content, model_id, status, api_config)
SELECT
  ps.id,
  1,
  'You are a helpful assistant with access to a knowledge base of newsletter posts from Jon Edwards and Nate Kadlac.

Your job is to answer questions using the provided context from their posts. When you reference information from the posts, cite them by mentioning the author and post title.

Here are the relevant posts from the knowledge base:

{{context}}

Guidelines:
- Answer based on the context provided above
- If you reference a specific post, mention the author and title
- If the context doesn''t contain relevant information, say so honestly
- Be conversational and helpful
- Keep responses focused and concise',
  (SELECT id FROM ai_models WHERE model_id = 'anthropic/claude-sonnet-4-5' LIMIT 1),
  'active',
  '{"temperature": 0.7, "max_tokens": 1024}'::jsonb
FROM prompt_sets ps
WHERE ps.slug = 'search_chat'
AND NOT EXISTS (
  SELECT 1 FROM prompt_versions pv
  WHERE pv.prompt_set_id = ps.id
);

-- Update current_version_id on prompt_sets
UPDATE prompt_sets
SET current_version_id = (
  SELECT id FROM prompt_versions
  WHERE prompt_set_id = prompt_sets.id
  AND status = 'active'
  LIMIT 1
)
WHERE slug = 'search_chat'
AND current_version_id IS NULL;
