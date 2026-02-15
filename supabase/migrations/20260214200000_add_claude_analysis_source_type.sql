-- Add "claude_analysis" as a valid source_type for slack_ideas
-- Used by the MCP server when Claude generates ideas from trend analysis

ALTER TABLE slack_ideas DROP CONSTRAINT IF EXISTS slack_ideas_source_type_check;
ALTER TABLE slack_ideas ADD CONSTRAINT slack_ideas_source_type_check
  CHECK (source_type IN ('slack', 'recording', 'manual', 'x_share', 'granola', 'substack', 'claude_analysis'));
