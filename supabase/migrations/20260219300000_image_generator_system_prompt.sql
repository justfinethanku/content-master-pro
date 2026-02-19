-- Update image_generator prompt: template is now system instructions, not a passthrough.
-- The user's content (from the thumbnails page) is passed separately as the user message.
-- Any {{content}} in the template was previously causing prompt duplication.

UPDATE prompt_versions pv SET
  prompt_content = 'Generate a high-quality, visually striking image based on the user''s description.

{{model_instructions}}

{{destination_requirements}}'
FROM prompt_sets ps
WHERE pv.prompt_set_id = ps.id
  AND ps.slug = 'image_generator'
  AND pv.status = 'active';
