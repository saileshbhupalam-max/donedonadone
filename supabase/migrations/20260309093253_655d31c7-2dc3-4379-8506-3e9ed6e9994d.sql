
-- Buddy system columns
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS is_first_session boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS buddy_user_id uuid REFERENCES profiles(id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_welcome_buddy boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rsvps_buddy ON event_rsvps(buddy_user_id) WHERE buddy_user_id IS NOT NULL;

-- Cowork preferences table
CREATE TABLE IF NOT EXISTS cowork_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  preferred_user_id uuid REFERENCES profiles(id) NOT NULL,
  event_id uuid REFERENCES events(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, preferred_user_id, event_id)
);

ALTER TABLE cowork_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own cowork preferences" ON cowork_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own cowork preferences" ON cowork_preferences
  FOR SELECT USING (user_id = auth.uid() OR preferred_user_id = auth.uid());

-- RPC to get user's circle
CREATE OR REPLACE FUNCTION get_my_circle(p_user_id uuid)
RETURNS TABLE (
  circle_user_id uuid,
  display_name text,
  avatar_url text,
  tagline varchar,
  cowork_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN cp.user_id = p_user_id THEN cp.preferred_user_id ELSE cp.user_id END as circle_user_id,
    p.display_name,
    p.avatar_url,
    p.tagline,
    COUNT(*) as cowork_count
  FROM cowork_preferences cp
  JOIN cowork_preferences cp2 ON cp.user_id = cp2.preferred_user_id
    AND cp.preferred_user_id = cp2.user_id
  JOIN profiles p ON p.id = CASE WHEN cp.user_id = p_user_id THEN cp.preferred_user_id ELSE cp.user_id END
  WHERE (cp.user_id = p_user_id OR cp.preferred_user_id = p_user_id)
    AND cp.user_id < cp.preferred_user_id
  GROUP BY circle_user_id, p.display_name, p.avatar_url, p.tagline
  ORDER BY cowork_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
