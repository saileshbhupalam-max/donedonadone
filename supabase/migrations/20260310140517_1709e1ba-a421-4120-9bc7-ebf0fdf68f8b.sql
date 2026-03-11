
-- ============================================================
-- PART 0: Remaining security fixes from previous prompt
-- ============================================================

-- 0a. checkin_with_location — enforce p_user_id = auth.uid()
CREATE OR REPLACE FUNCTION checkin_with_location(p_event_id UUID, p_user_id UUID, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event RECORD;
  v_distance DOUBLE PRECISION;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT venue_latitude, venue_longitude, checkin_radius_meters
    INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  v_distance := 6371000 * acos(
    cos(radians(p_latitude)) * cos(radians(v_event.venue_latitude)) *
    cos(radians(v_event.venue_longitude) - radians(p_longitude)) +
    sin(radians(p_latitude)) * sin(radians(v_event.venue_latitude))
  );
  IF v_distance > COALESCE(v_event.checkin_radius_meters, 200) THEN
    RETURN FALSE;
  END IF;
  UPDATE event_rsvps SET checked_in = true, checked_in_at = now()
    WHERE event_id = p_event_id AND user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- 0b. checkin_with_pin — enforce p_user_id = auth.uid()
CREATE OR REPLACE FUNCTION checkin_with_pin(p_event_id UUID, p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_pin TEXT;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT checkin_pin INTO v_event_pin FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_event_pin IS NOT NULL AND v_event_pin != p_pin THEN RETURN FALSE; END IF;
  UPDATE event_rsvps SET checked_in = true, checked_in_at = now()
    WHERE event_id = p_event_id AND user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- 0c. match_coffee_roulette — enforce p_user_id = auth.uid() + add visibility check
CREATE OR REPLACE FUNCTION match_coffee_roulette(p_user_id UUID)
RETURNS TABLE(matched_user_id UUID, matched_display_name TEXT, matched_avatar_url TEXT, matched_role_type TEXT, taste_match INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_my_entry RECORD;
  v_match RECORD;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_my_entry FROM coffee_roulette_queue
    WHERE coffee_roulette_queue.user_id = p_user_id AND coffee_roulette_queue.status = 'waiting'
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT sub.id, sub.user_id, sub.display_name, sub.avatar_url, sub.role_type, sub.score
  INTO v_match
  FROM (
    SELECT crq.id, crq.user_id, p.display_name, p.avatar_url, tg.role_type,
      COALESCE(calculate_taste_match(p_user_id, crq.user_id)::int, 0) AS score
    FROM coffee_roulette_queue crq
    JOIN profiles p ON p.id = crq.user_id
    LEFT JOIN taste_graph tg ON tg.user_id = crq.user_id
    LEFT JOIN user_settings us ON us.user_id = crq.user_id
    WHERE crq.status = 'waiting'
      AND crq.user_id != p_user_id
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
      AND COALESCE(us.visibility, 'everyone') != 'hidden'
  ) sub
  ORDER BY sub.score DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE coffee_roulette_queue SET status = 'matched', matched_with = v_match.user_id, matched_at = now()
    WHERE id = v_my_entry.id;
  UPDATE coffee_roulette_queue SET status = 'matched', matched_with = p_user_id, matched_at = now()
    WHERE id = v_match.id;

  PERFORM upsert_connection(p_user_id, v_match.user_id, 'roulette', 'work', '{}');
  PERFORM record_behavioral_signal(p_user_id, 'coffee_roulette_matched', v_match.user_id, NULL, NULL, 'work', '{}');
  PERFORM record_behavioral_signal(v_match.user_id, 'coffee_roulette_matched', p_user_id, NULL, NULL, 'work', '{}');

  matched_user_id := v_match.user_id;
  matched_display_name := v_match.display_name;
  matched_avatar_url := v_match.avatar_url;
  matched_role_type := v_match.role_type;
  taste_match := v_match.score;
  RETURN NEXT;
END;
$$;

-- 0d. promote_waitlist — add admin/event-creator check
CREATE OR REPLACE FUNCTION promote_waitlist(p_event_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry RECORD;
  v_event RECORD;
  v_caller_type TEXT;
  v_event_creator UUID;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  SELECT created_by INTO v_event_creator FROM events WHERE id = p_event_id;
  IF v_caller_type != 'admin' AND auth.uid() != v_event_creator THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_entry FROM session_waitlist
    WHERE event_id = p_event_id AND promoted_at IS NULL
    ORDER BY position LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, v_entry.user_id, 'going');

  UPDATE session_waitlist SET promoted_at = now() WHERE id = v_entry.id;

  SELECT title, venue_name INTO v_event FROM events WHERE id = p_event_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (v_entry.user_id,
    'A spot opened up!',
    'You''re in for ' || COALESCE(v_event.title, 'the session') || COALESCE(' at ' || v_event.venue_name, '') || '. Confirm by showing up!',
    'waitlist_promoted',
    '/events/' || p_event_id::text);

  RETURN v_entry.user_id;
END;
$$;

-- ============================================================
-- PART 1: Auto-checkout previous check-in when new one is created
-- ============================================================
CREATE OR REPLACE FUNCTION auto_checkout_previous()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE check_ins
    SET checked_out_at = now()
  WHERE user_id = NEW.user_id
    AND checked_out_at IS NULL
    AND id != NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_checkout_previous ON check_ins;
CREATE TRIGGER trg_auto_checkout_previous
  AFTER INSERT ON check_ins
  FOR EACH ROW
  EXECUTE FUNCTION auto_checkout_previous();

-- ============================================================
-- PART 3: Clean up stale coffee roulette entries before join
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_roulette(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM coffee_roulette_queue
    WHERE user_id = p_user_id
    AND status IN ('matched', 'expired');
END;
$$;
