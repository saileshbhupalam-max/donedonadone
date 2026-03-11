
-- Session Scrapbook: auto-generated memory cards per session
CREATE TABLE IF NOT EXISTS session_scrapbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  event_id uuid REFERENCES events(id) NOT NULL,
  session_date date NOT NULL,
  venue_name text,
  venue_neighborhood text,
  group_members jsonb DEFAULT '[]'::jsonb,
  cowork_again_picks uuid[] DEFAULT '{}',
  intention text,
  intention_accomplished text,
  props_received jsonb DEFAULT '[]'::jsonb,
  photo_url text,
  focus_hours numeric(4,2),
  personal_note text,
  highlight text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE session_scrapbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scrapbook" ON session_scrapbook
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own scrapbook" ON session_scrapbook
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own scrapbook" ON session_scrapbook
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Community Rituals: Monday Focus + Friday Wins
CREATE TABLE IF NOT EXISTS community_rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  ritual_type text NOT NULL,
  content text NOT NULL,
  week_of date NOT NULL,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, ritual_type, week_of)
);

ALTER TABLE community_rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own rituals" ON community_rituals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rituals" ON community_rituals
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated can read rituals" ON community_rituals
  FOR SELECT USING (true);

-- Ritual Likes
CREATE TABLE IF NOT EXISTS ritual_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  ritual_id uuid REFERENCES community_rituals(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, ritual_id)
);

ALTER TABLE ritual_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own likes" ON ritual_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes" ON ritual_likes
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Authenticated can read likes" ON ritual_likes
  FOR SELECT USING (true);

-- Gratitude Echoes: extend peer_props
ALTER TABLE peer_props
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_echo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS echo_deliver_at timestamptz;

-- Weekly intentions on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS weekly_intention text,
  ADD COLUMN IF NOT EXISTS weekly_intention_set_at timestamptz;
