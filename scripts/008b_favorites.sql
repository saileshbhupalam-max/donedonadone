-- Favorite Coworkers: social bond hook
-- Favorites get a soft boost (+1 pt) in matching algorithm

CREATE TABLE IF NOT EXISTS favorite_coworkers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  favorite_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, favorite_user_id),
  CHECK (user_id != favorite_user_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorite_coworkers(user_id);

-- RLS
ALTER TABLE favorite_coworkers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own favorites" ON favorite_coworkers;
CREATE POLICY "Users view own favorites" ON favorite_coworkers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own favorites" ON favorite_coworkers;
CREATE POLICY "Users create own favorites" ON favorite_coworkers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own favorites" ON favorite_coworkers;
CREATE POLICY "Users delete own favorites" ON favorite_coworkers
  FOR DELETE USING (auth.uid() = user_id);
