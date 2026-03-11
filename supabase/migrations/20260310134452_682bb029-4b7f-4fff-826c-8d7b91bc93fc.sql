
-- 1. Widen behavioral_signals.signal_type CHECK to include types used by triggers
ALTER TABLE behavioral_signals DROP CONSTRAINT IF EXISTS behavioral_signals_signal_type_check;
ALTER TABLE behavioral_signals ADD CONSTRAINT behavioral_signals_signal_type_check
  CHECK (signal_type IN (
    'prop_given', 'cowork_again', 'session_attended', 'check_in', 'profile_viewed',
    'request_posted', 'request_responded', 'intro_made', 'coffee_chat_completed',
    'event_rsvp', 'event_cancelled',
    'micro_request_completed', 'micro_request_helped', 'coffee_roulette_matched'
  ));

-- 2. Widen connections.connection_type CHECK to include types used by RPCs
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_connection_type_check;
ALTER TABLE connections ADD CONSTRAINT connections_connection_type_check
  CHECK (connection_type IN (
    'coworked', 'coffee_chat', 'skill_swap', 'activity_partner', 'introduced',
    'helped', 'roulette', 'direct'
  ));

-- 3. Seed the missing 'check_in' feature flag
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES ('check_in', true, 'Check-in flow on Home page')
ON CONFLICT (flag_name) DO NOTHING;

-- 4. Create groups and group_members tables
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  group_number INT NOT NULL,
  table_assignment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on groups" ON groups FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Admin full access on group_members" ON group_members FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Users can read own groups" ON groups FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Users can read own group memberships" ON group_members FOR SELECT
  TO authenticated USING (user_id = auth.uid());
