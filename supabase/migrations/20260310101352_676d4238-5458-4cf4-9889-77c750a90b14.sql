
-- Part 1: get_public_profile RPC
CREATE OR REPLACE FUNCTION public.get_public_profile(p_viewer_id UUID, p_profile_id UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  work_type TEXT,
  events_attended INT,
  member_since TIMESTAMPTZ,
  role_type TEXT,
  skills TEXT[],
  looking_for TEXT[],
  can_offer TEXT[],
  topics TEXT[],
  "values" TEXT[],
  work_style JSONB,
  company TEXT,
  company_visible BOOLEAN,
  taste_match_score INT,
  connection_type TEXT,
  connection_strength FLOAT,
  mutual_sessions INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conn RECORD;
  v_mutual INT := 0;
BEGIN
  -- Get connection info
  SELECT c.connection_type, c.strength::float
  INTO v_conn
  FROM connections c
  WHERE (c.user_a = LEAST(p_viewer_id, p_profile_id) AND c.user_b = GREATEST(p_viewer_id, p_profile_id))
  ORDER BY c.strength DESC NULLS LAST
  LIMIT 1;

  -- Count mutual sessions from event_feedback
  SELECT COUNT(DISTINCT ef1.event_id)::int INTO v_mutual
  FROM event_feedback ef1
  JOIN event_feedback ef2 ON ef1.event_id = ef2.event_id
  WHERE ef1.user_id = p_viewer_id AND ef1.attended = true
    AND ef2.user_id = p_profile_id AND ef2.attended = true;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.what_i_do AS work_type,
    COALESCE(p.events_attended, 0)::int AS events_attended,
    p.created_at AS member_since,
    tg.role_type,
    tg.skills,
    COALESCE(p.looking_for, tg.work_looking_for) AS looking_for,
    COALESCE(p.can_offer, tg.work_can_offer) AS can_offer,
    tg.topics,
    tg."values",
    jsonb_build_object(
      'group_size_pref', tg.group_size_pref,
      'conversation_depth', tg.conversation_depth,
      'session_length_pref', tg.session_length_pref,
      'noise_preference', p.noise_preference,
      'communication_style', p.communication_style
    ) AS work_style,
    tg.current_project AS company,
    COALESCE(tg.company_visible, false) AS company_visible,
    CASE WHEN p_viewer_id = p_profile_id THEN 0
         ELSE COALESCE(calculate_taste_match(p_viewer_id, p_profile_id)::int, 0)
    END AS taste_match_score,
    v_conn.connection_type,
    v_conn.strength,
    v_mutual AS mutual_sessions
  FROM profiles p
  LEFT JOIN taste_graph tg ON tg.user_id = p.id
  WHERE p.id = p_profile_id
    AND (p.suspended_until IS NULL OR p.suspended_until < now());
END;
$$;

-- Part 2: Update notification triggers

-- 2a: Trigger for micro-request claimed
CREATE OR REPLACE FUNCTION public.trg_micro_request_claimed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claimer_name TEXT;
BEGIN
  -- When status changes to 'claimed' and claimed_by is set
  IF OLD.status = 'open' AND NEW.status = 'claimed' AND NEW.claimed_by IS NOT NULL THEN
    SELECT display_name INTO v_claimer_name FROM profiles WHERE id = NEW.claimed_by;
    
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'request_claimed',
      'Someone can help!',
      COALESCE(v_claimer_name, 'Someone') || ' offered to help with: ' || NEW.title,
      '/profile/' || NEW.claimed_by::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_micro_request_claimed ON micro_requests;
CREATE TRIGGER trg_micro_request_claimed
  AFTER UPDATE ON micro_requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_micro_request_claimed();

-- 2b: Update existing trg_micro_request_completed to also notify
CREATE OR REPLACE FUNCTION public.trg_micro_request_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requester_name TEXT;
  v_helper_name TEXT;
BEGIN
  IF OLD.status = 'claimed' AND NEW.status = 'completed' AND NEW.claimed_by IS NOT NULL THEN
    -- Existing behavioral signals
    PERFORM record_behavioral_signal(NEW.user_id, 'micro_request_completed', NEW.claimed_by, NULL, NEW.location_id, 'work', '{}');
    PERFORM record_behavioral_signal(NEW.claimed_by, 'micro_request_helped', NEW.user_id, NULL, NEW.location_id, 'work', '{}');
    PERFORM upsert_connection(NEW.user_id, NEW.claimed_by, 'helped', 'work', '{}');

    -- Notifications
    SELECT display_name INTO v_requester_name FROM profiles WHERE id = NEW.user_id;
    SELECT display_name INTO v_helper_name FROM profiles WHERE id = NEW.claimed_by;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.claimed_by,
      'request_completed',
      'Request completed! 🎉',
      COALESCE(v_requester_name, 'Someone') || ' marked "' || NEW.title || '" as complete. Thanks for helping!',
      '/profile/' || NEW.user_id::text
    );

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'request_completed',
      'Your request is done!',
      '"' || NEW.title || '" was completed with help from ' || COALESCE(v_helper_name, 'someone') || '.',
      '/profile/' || NEW.claimed_by::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Re-create trigger for completed (function replaced above)
DROP TRIGGER IF EXISTS trg_micro_request_completed ON micro_requests;
CREATE TRIGGER trg_micro_request_completed
  AFTER UPDATE ON micro_requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_micro_request_completed();

-- 2c: Coffee roulette match notification trigger
CREATE OR REPLACE FUNCTION public.trg_coffee_roulette_matched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matched_name TEXT;
BEGIN
  IF OLD.status = 'waiting' AND NEW.status = 'matched' AND NEW.matched_with IS NOT NULL THEN
    SELECT display_name INTO v_matched_name FROM profiles WHERE id = NEW.matched_with;
    
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'coffee_match',
      'Coffee match found! ☕',
      'You''ve been matched with ' || COALESCE(v_matched_name, 'someone') || ' for a quick chat. Say hi!',
      '/profile/' || NEW.matched_with::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coffee_roulette_matched ON coffee_roulette_queue;
CREATE TRIGGER trg_coffee_roulette_matched
  AFTER UPDATE ON coffee_roulette_queue
  FOR EACH ROW
  EXECUTE FUNCTION trg_coffee_roulette_matched();

-- 2d: Props received notification trigger
CREATE OR REPLACE FUNCTION public.trg_prop_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_name TEXT;
BEGIN
  IF NEW.anonymous = false THEN
    SELECT display_name INTO v_from_name FROM profiles WHERE id = NEW.from_user;
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.to_user,
      'props_received',
      'You received props! 🔥',
      COALESCE(v_from_name, 'Someone') || ' gave you a "' || NEW.prop_type || '" prop!',
      '/profile/' || NEW.from_user::text
    );
  ELSE
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.to_user,
      'props_received',
      'You received anonymous props! 🔥',
      'Someone gave you a "' || NEW.prop_type || '" prop!',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prop_notification ON peer_props;
CREATE TRIGGER trg_prop_notification
  AFTER INSERT ON peer_props
  FOR EACH ROW
  EXECUTE FUNCTION trg_prop_notification();

-- Index for fast unread notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications (user_id, read, created_at DESC);
