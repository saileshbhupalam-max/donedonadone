-- Partner session CRUD policies
-- Partners can create sessions at their own venues
DROP POLICY IF EXISTS "Partners can create sessions" ON sessions;
CREATE POLICY "Partners can create sessions" ON sessions
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE partner_id = auth.uid())
  );

-- Partners can update sessions at their own venues
DROP POLICY IF EXISTS "Partners can update own sessions" ON sessions;
CREATE POLICY "Partners can update own sessions" ON sessions
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE partner_id = auth.uid())
  );

-- Partners can delete sessions at their own venues
DROP POLICY IF EXISTS "Partners can delete own sessions" ON sessions;
CREATE POLICY "Partners can delete own sessions" ON sessions
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE partner_id = auth.uid())
  );

-- Partners can view bookings for sessions at their venues
DROP POLICY IF EXISTS "Partners view venue bookings" ON bookings;
CREATE POLICY "Partners view venue bookings" ON bookings
  FOR SELECT USING (
    auth.uid() = user_id
    OR session_id IN (
      SELECT s.id FROM sessions s
      JOIN venues v ON s.venue_id = v.id
      WHERE v.partner_id = auth.uid()
    )
  );

-- Partners can view feedback for sessions at their venues
DROP POLICY IF EXISTS "Partners view venue feedback" ON session_feedback;
CREATE POLICY "Partners view venue feedback" ON session_feedback
  FOR SELECT USING (
    auth.uid() = user_id
    OR session_id IN (
      SELECT s.id FROM sessions s
      JOIN venues v ON s.venue_id = v.id
      WHERE v.partner_id = auth.uid()
    )
  );
