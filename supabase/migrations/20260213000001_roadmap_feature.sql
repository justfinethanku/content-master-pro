-- Roadmap collaborative wishlist tables

-- Items submitted by users
CREATE TABLE roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments on roadmap items
CREATE TABLE roadmap_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes (one per user per item)
CREATE TABLE roadmap_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

-- Indexes
CREATE INDEX idx_roadmap_items_sort ON roadmap_items(sort_order);
CREATE INDEX idx_roadmap_comments_item ON roadmap_comments(item_id);
CREATE INDEX idx_roadmap_votes_item ON roadmap_votes(item_id);
CREATE INDEX idx_roadmap_votes_user ON roadmap_votes(user_id);

-- Updated_at trigger for items
CREATE TRIGGER roadmap_items_updated_at
  BEFORE UPDATE ON roadmap_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_votes ENABLE ROW LEVEL SECURITY;

-- RLS: roadmap_items
CREATE POLICY "Authenticated users can read roadmap items"
  ON roadmap_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert roadmap items"
  ON roadmap_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Authenticated users can update roadmap items"
  ON roadmap_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete own roadmap items"
  ON roadmap_items FOR DELETE
  TO authenticated
  USING (auth.uid() = submitted_by);

-- RLS: roadmap_comments
CREATE POLICY "Authenticated users can read roadmap comments"
  ON roadmap_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert roadmap comments"
  ON roadmap_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own roadmap comments"
  ON roadmap_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: roadmap_votes
CREATE POLICY "Authenticated users can read roadmap votes"
  ON roadmap_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert roadmap votes"
  ON roadmap_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own roadmap votes"
  ON roadmap_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to read other users' profiles (for displaying names)
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
