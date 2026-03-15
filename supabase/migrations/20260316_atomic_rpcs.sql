-- Audit fixes: #21 (waitlist TOCTOU), #22 (follow rate limit), #26 (RSVP capacity race)
--
-- #21: joinWaitlist reads max position then inserts — two concurrent joins get same slot.
--      Fix: atomic RPC with FOR UPDATE lock on position query.
--
-- #22: Follow rate limit is localStorage-only — trivially bypassable.
--      Fix: server-side RPC enforces cap (20) and daily rate limit (5/day).
--
-- #26: RSVP from stale React state — two concurrent RSVPs can exceed max_attendees.
--      Fix: atomic RPC checks capacity and inserts RSVP in one transaction.

-- ─── #21: ATOMIC WAITLIST JOIN ───
CREATE OR REPLACE FUNCTION user_join_waitlist(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_position integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- Lock the waitlist rows for this event to prevent concurrent position assignment
  PERFORM 1 FROM session_waitlist WHERE event_id = p_event_id FOR UPDATE;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM session_waitlist
  WHERE event_id = p_event_id;

  INSERT INTO session_waitlist (event_id, user_id, position)
  VALUES (p_event_id, auth.uid(), v_position);

  RETURN v_position;
END;
$$;

GRANT EXECUTE ON FUNCTION user_join_waitlist TO authenticated;

-- ─── #22: SERVER-SIDE FOLLOW WITH RATE LIMIT ───
CREATE OR REPLACE FUNCTION user_follow_user(p_followed_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_follows integer;
  v_today_follows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF auth.uid() = p_followed_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot follow yourself');
  END IF;

  -- Cap check: max 20 follows
  SELECT COUNT(*) INTO v_total_follows
  FROM member_follows WHERE follower_id = auth.uid();
  IF v_total_follows >= 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum follows reached. Unfollow someone first.');
  END IF;

  -- Rate limit: max 5 new follows per 24 hours
  SELECT COUNT(*) INTO v_today_follows
  FROM member_follows
  WHERE follower_id = auth.uid()
    AND created_at > now() - interval '24 hours';
  IF v_today_follows >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily follow limit reached. Try again tomorrow.');
  END IF;

  INSERT INTO member_follows (follower_id, followed_id)
  VALUES (auth.uid(), p_followed_id);

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already following this person.');
END;
$$;

GRANT EXECUTE ON FUNCTION user_follow_user TO authenticated;

CREATE OR REPLACE FUNCTION user_unfollow_user(p_followed_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  DELETE FROM member_follows
  WHERE follower_id = auth.uid() AND followed_id = p_followed_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION user_unfollow_user TO authenticated;

-- ─── #26: ATOMIC RSVP WITH CAPACITY CHECK ───
CREATE OR REPLACE FUNCTION user_rsvp_to_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_max_spots integer;
  v_current_count integer;
  v_existing_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- Lock the event row to prevent concurrent capacity checks
  SELECT max_spots INTO v_max_spots
  FROM events WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Check if user already has an RSVP
  SELECT status INTO v_existing_status
  FROM event_rsvps
  WHERE event_id = p_event_id AND user_id = auth.uid();

  IF v_existing_status = 'going' THEN
    -- Toggle off: delete RSVP
    DELETE FROM event_rsvps WHERE event_id = p_event_id AND user_id = auth.uid();
    UPDATE events SET rsvp_count = GREATEST(0, COALESCE(rsvp_count, 0) - 1) WHERE id = p_event_id;
    RETURN jsonb_build_object('success', true, 'action', 'cancelled');
  END IF;

  -- Check capacity
  IF v_max_spots IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM event_rsvps
    WHERE event_id = p_event_id AND status = 'going';

    IF v_current_count >= v_max_spots THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session is full', 'full', true);
    END IF;
  END IF;

  -- Upsert RSVP
  INSERT INTO event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, auth.uid(), 'going')
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

  -- Increment rsvp_count atomically
  UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'action', 'going');
END;
$$;

GRANT EXECUTE ON FUNCTION user_rsvp_to_event TO authenticated;
