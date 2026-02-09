-- Matching Outcomes: log every match decision for algorithm iteration
-- Records the scores that led to each grouping decision

CREATE TABLE IF NOT EXISTS matching_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seed_user_id UUID REFERENCES profiles(id),
  compatibility_score INTEGER,
  history_penalty INTEGER DEFAULT 0,
  favorite_bonus INTEGER DEFAULT 0,
  streak_bonus INTEGER DEFAULT 0,
  diversity_bonus INTEGER DEFAULT 0,
  final_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matching_outcomes_session ON matching_outcomes(session_id);
CREATE INDEX IF NOT EXISTS idx_matching_outcomes_user ON matching_outcomes(user_id);

-- RLS
ALTER TABLE matching_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Matching outcomes viewable by admins" ON matching_outcomes;
CREATE POLICY "Matching outcomes viewable by admins" ON matching_outcomes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Users can see their own matching outcomes
DROP POLICY IF EXISTS "Users view own matching outcomes" ON matching_outcomes;
CREATE POLICY "Users view own matching outcomes" ON matching_outcomes
  FOR SELECT USING (auth.uid() = user_id);
