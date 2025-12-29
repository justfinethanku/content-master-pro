-- Fix RLS policies for content tables
-- The original policies used FOR ALL USING() without WITH CHECK
-- This breaks INSERT operations because PostgreSQL can't verify the row ownership
-- before the row exists

-- ===========================================
-- content_sessions
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own sessions" ON content_sessions;

CREATE POLICY "Users can view own sessions" ON content_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON content_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON content_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON content_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- content_brain_dumps
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own brain_dumps" ON content_brain_dumps;

CREATE POLICY "Users can view own brain_dumps" ON content_brain_dumps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create brain_dumps" ON content_brain_dumps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own brain_dumps" ON content_brain_dumps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own brain_dumps" ON content_brain_dumps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_research
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own research" ON content_research;

CREATE POLICY "Users can view own research" ON content_research
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create research" ON content_research
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own research" ON content_research
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own research" ON content_research
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_outlines
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own outlines" ON content_outlines;

CREATE POLICY "Users can view own outlines" ON content_outlines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create outlines" ON content_outlines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own outlines" ON content_outlines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own outlines" ON content_outlines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_drafts
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own drafts" ON content_drafts;

CREATE POLICY "Users can view own drafts" ON content_drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create drafts" ON content_drafts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own drafts" ON content_drafts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own drafts" ON content_drafts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_outputs
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own outputs" ON content_outputs;

CREATE POLICY "Users can view own outputs" ON content_outputs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create outputs" ON content_outputs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own outputs" ON content_outputs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own outputs" ON content_outputs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );
