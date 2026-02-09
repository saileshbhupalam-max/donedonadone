-- Session Goals: accountability hook — users set goals before sessions
-- Goals visible to group during session, checked off after session

CREATE TABLE IF NOT EXISTS session_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  goal_text TEXT NOT NULL CHECK (char_length(goal_text) <= 200),
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_goals_booking ON session_goals(booking_id);
CREATE INDEX IF NOT EXISTS idx_session_goals_session_user ON session_goals(session_id, user_id);

-- RLS
ALTER TABLE session_goals ENABLE ROW LEVEL SECURITY;

-- Users can view goals of their group members for the same session
DROP POLICY IF EXISTS "Users view session goals for their groups" ON session_goals;
CREATE POLICY "Users view session goals for their groups" ON session_goals
  FOR SELECT USING (
    auth.uid() = user_id
    OR session_id IN (
      SELECT b.session_id FROM bookings b
      WHERE b.user_id = auth.uid()
        AND b.payment_status IN ('paid', 'confirmed')
        AND b.session_id = session_goals.session_id
    )
  );

DROP POLICY IF EXISTS "Users create own goals" ON session_goals;
CREATE POLICY "Users create own goals" ON session_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own goals" ON session_goals;
CREATE POLICY "Users update own goals" ON session_goals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own goals" ON session_goals;
CREATE POLICY "Users delete own goals" ON session_goals
  FOR DELETE USING (auth.uid() = user_id);
