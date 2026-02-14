-- Slack Messages: Raw verbatim messages from Slack channels
-- Separate from slack_ideas (which has AI-processed fields)
-- No user_id FK — workspace-level data, not tied to app auth users
-- Scraper runs with service role so RLS is bypassed

CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Channel info
  channel_id TEXT NOT NULL,                -- Slack channel ID (e.g., C0AB4V6DTDM)
  channel_name TEXT NOT NULL,              -- Human-readable channel name

  -- Message identity
  message_ts TEXT NOT NULL,                -- Slack's unique message timestamp ID
  thread_ts TEXT,                          -- Parent message_ts for threaded replies (NULL = top-level)

  -- Author
  user_slack_id TEXT NOT NULL,             -- Slack user ID
  user_display_name TEXT,                  -- Resolved display name

  -- Content (100% verbatim)
  text TEXT NOT NULL,                      -- Raw message text

  -- Structured metadata
  links JSONB DEFAULT '[]',               -- Extracted URLs [{url, title}]
  attachments JSONB DEFAULT '[]',         -- Slack attachments (files, unfurls)
  reactions JSONB DEFAULT '[]',           -- [{name, count, users}]

  -- Thread structure
  is_thread_parent BOOLEAN DEFAULT false,  -- Has replies
  reply_count INTEGER DEFAULT 0,           -- Number of thread replies

  -- Timestamps
  posted_at TIMESTAMPTZ NOT NULL,          -- When the message was posted in Slack
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one row per message per channel
CREATE UNIQUE INDEX idx_slack_messages_channel_ts
  ON slack_messages(channel_id, message_ts);

-- Common query patterns
CREATE INDEX idx_slack_messages_channel ON slack_messages(channel_id);
CREATE INDEX idx_slack_messages_posted ON slack_messages(posted_at DESC);
CREATE INDEX idx_slack_messages_thread ON slack_messages(thread_ts) WHERE thread_ts IS NOT NULL;
CREATE INDEX idx_slack_messages_user ON slack_messages(user_slack_id);

-- Full-text search on message content
CREATE INDEX idx_slack_messages_text_fts
  ON slack_messages USING GIN (to_tsvector('english', text));

-- Enable RLS (service role bypasses, but good practice)
ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all messages (workspace-level data)
CREATE POLICY "Authenticated users can read slack messages"
  ON slack_messages FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete (via scraper script)
-- No INSERT/UPDATE/DELETE policies for authenticated — service role bypasses RLS

-- Updated_at trigger
CREATE TRIGGER update_slack_messages_updated_at
  BEFORE UPDATE ON slack_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE slack_messages IS 'Raw verbatim Slack messages scraped from workspace channels';
COMMENT ON COLUMN slack_messages.message_ts IS 'Slack unique message timestamp (used as message ID)';
COMMENT ON COLUMN slack_messages.thread_ts IS 'Parent message_ts for threaded replies (NULL = top-level message)';
COMMENT ON COLUMN slack_messages.channel_name IS 'Human-readable channel name, supports multi-channel scraping';
