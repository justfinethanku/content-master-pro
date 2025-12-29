-- Seed initial destinations
-- Part of Meta Prompt Assembly System Refactor

INSERT INTO destinations (slug, name, category, specs, prompt_instructions, tone_modifiers, sort_order)
VALUES
  -- Newsletter platforms
  (
    'substack',
    'Substack',
    'newsletter',
    '{
      "text": {
        "supports_markdown": true,
        "supports_html": true,
        "max_characters": null,
        "header_image_size": "1200x630"
      }
    }'::jsonb,
    'Write for reading, not listening. Use headers (##) to break up sections. Include pull quotes for emphasis. Optimize the first paragraph for email preview - it should hook the reader. Use sentence case for headlines.',
    '["thoughtful", "personal", "long-form"]'::jsonb,
    1
  ),

  -- Long-form video
  (
    'youtube',
    'YouTube',
    'video',
    '{
      "video": {
        "aspect_ratio": "16:9",
        "max_duration_seconds": 600,
        "thumbnail_size": "1280x720"
      }
    }'::jsonb,
    'Write for spoken delivery - read it aloud to check flow. Include [B-ROLL: description] markers for visual breaks. Include [VISUAL CUE: description] for on-screen text or graphics. Hook in the first 30 seconds - no long intros. End with a clear call to action.',
    '["conversational", "hook-driven", "visual"]'::jsonb,
    2
  ),

  -- Short-form video
  (
    'tiktok',
    'TikTok',
    'video',
    '{
      "video": {
        "aspect_ratio": "9:16",
        "max_duration_seconds": 60
      }
    }'::jsonb,
    'Hook immediately - first 2 seconds determine if they stay. Fast-paced delivery, no filler words. End with a question or CTA to drive engagement. Pattern interrupts every 5-7 seconds.',
    '["punchy", "immediate", "trend-aware"]'::jsonb,
    3
  ),

  (
    'youtube_shorts',
    'YouTube Shorts',
    'video',
    '{
      "video": {
        "aspect_ratio": "9:16",
        "max_duration_seconds": 60
      }
    }'::jsonb,
    'Vertical format, immediate hook, no intro. Straight to the value proposition. Use text overlays for emphasis. Loop-friendly endings when possible.',
    '["punchy", "immediate", "loop-friendly"]'::jsonb,
    4
  ),

  (
    'instagram_reels',
    'Instagram Reels',
    'video',
    '{
      "video": {
        "aspect_ratio": "9:16",
        "max_duration_seconds": 90
      }
    }'::jsonb,
    'Visual-first platform - describe what''s happening on screen. Text overlays encouraged for silent viewing. End with engagement prompt (save this, share with someone who needs this).',
    '["aesthetic", "visual-first", "shareable"]'::jsonb,
    5
  ),

  -- Social platforms
  (
    'linkedin',
    'LinkedIn',
    'social',
    '{
      "text": {
        "max_characters": 3000,
        "supports_markdown": false,
        "supports_line_breaks": true
      }
    }'::jsonb,
    'Professional but not corporate. Lead with a surprising insight or contrarian take. Use line breaks for readability (single sentences as paragraphs). End with a question to drive comments.',
    '["professional", "insightful", "engagement-focused"]'::jsonb,
    6
  ),

  (
    'twitter',
    'Twitter/X',
    'social',
    '{
      "text": {
        "max_characters": 280,
        "supports_threads": true
      }
    }'::jsonb,
    'Punchy and quotable. Hook in the first line - that''s what shows in the timeline. For threads: each tweet should stand alone but also build on the previous. End threads with a summary or CTA.',
    '["sharp", "quotable", "thread-friendly"]'::jsonb,
    7
  ),

  (
    'facebook',
    'Facebook',
    'social',
    '{
      "text": {
        "max_characters": 63206,
        "supports_markdown": false,
        "optimal_length": 80
      }
    }'::jsonb,
    'Conversational and relatable. First 2-3 lines are crucial (before "See more"). Stories and personal experiences perform well. Ask questions to drive comments.',
    '["personal", "relatable", "story-driven"]'::jsonb,
    8
  )

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  specs = EXCLUDED.specs,
  prompt_instructions = EXCLUDED.prompt_instructions,
  tone_modifiers = EXCLUDED.tone_modifiers,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
