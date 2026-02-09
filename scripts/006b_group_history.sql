-- Group History: tracks who was grouped with whom for rotation enforcement
-- Populated automatically when groups are assigned

CREATE TABLE IF NOT EXISTS group_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  co_member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  grouped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, co_member_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_group_history_user ON group_history(user_id, grouped_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_history_pair ON group_history(user_id, co_member_id);

-- RLS
ALTER TABLE group_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own group history" ON group_history;
CREATE POLICY "Users view own group history" ON group_history
  FOR SELECT USING (auth.uid() = user_id);

-- Function to populate group_history after groups are assigned
CREATE OR REPLACE FUNCTION populate_group_history(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO group_history (user_id, co_member_id, session_id)
  SELECT gm1.user_id, gm2.user_id, p_session_id
  FROM group_members gm1
  JOIN group_members gm2 ON gm1.group_id = gm2.group_id AND gm1.user_id != gm2.user_id
  JOIN groups g ON g.id = gm1.group_id
  WHERE g.session_id = p_session_id
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
