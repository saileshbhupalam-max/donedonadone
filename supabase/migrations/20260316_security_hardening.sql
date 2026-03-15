-- Security hardening from incremental audit on 2026-03-16
--
-- CRITICAL-1: user_award_credits accepts arbitrary p_amount — add per-action max
-- CRITICAL-2: server_award_credits does not reject negative p_amount
-- CRITICAL-3: 4 server_ RPCs still callable by authenticated — revoke
-- HIGH-4: Missing SET search_path on SECURITY DEFINER functions
-- MEDIUM-7: Suspended users can RSVP — add check
-- MEDIUM-8: user_join_waitlist lacks duplicate-join protection

-- ═══════════════════════════════════════════════════════════
-- CRITICAL-3: Revoke dangerous server RPCs from authenticated
-- ═══════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION server_activate_venue FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION server_evaluate_venue_health FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION server_check_demand_cluster FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION server_process_no_shows FROM authenticated, anon;

-- ═══════════════════════════════════════════════════════════
-- CRITICAL-1 + CRITICAL-2: Harden user_award_credits
-- Add per-action max amount allowlist + reject negative/zero amounts
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_award_credits(
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_amount integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- CRITICAL-2: Reject non-positive amounts
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'invalid_amount');
  END IF;

  -- CRITICAL-1: Per-action max amount allowlist
  -- Values are generous (2x base config) to allow tier+streak multipliers (max 1.95x)
  v_max_amount := CASE p_action
    WHEN 'session_complete'        THEN 25  -- base 10, max multiplied ~20
    WHEN 'rate_group'              THEN 12
    WHEN 'rate_venue'              THEN 12
    WHEN 'write_review'            THEN 35  -- base 15
    WHEN 'upload_photo'            THEN 12
    WHEN 'report_venue_info'       THEN 25
    WHEN 'referral_complete'       THEN 50  -- flat, no multiplier
    WHEN 'referral_milestone_3'    THEN 25
    WHEN 'streak_bonus'            THEN 50  -- base 25
    WHEN 'great_groupmate'         THEN 25
    WHEN 'add_new_venue'           THEN 60  -- base 30
    WHEN 'verify_venue_info'       THEN 8
    WHEN 'check_in_photo'          THEN 12
    WHEN 'report_company_presence' THEN 25
    WHEN 'report_seating_capacity' THEN 25
    WHEN 'report_floor_count'      THEN 12
    WHEN 'report_amenities'        THEN 12
    WHEN 'comeback_bonus'          THEN 30
    WHEN 'taste_answer'            THEN 12
    -- Gamification v2
    WHEN 'welcome_bonus'           THEN 25
    WHEN 'first_session_bonus'     THEN 15
    WHEN 'mystery_double'          THEN 25  -- mirrors session_complete max
    WHEN 'group_chemistry_bonus'   THEN 10
    WHEN 'golden_session'          THEN 75  -- 3x session_complete max
    WHEN 'group_streak_bonus'      THEN 15
    WHEN 'reliability_bonus'       THEN 30
    WHEN 'venue_variety_bonus'     THEN 15
    WHEN 'streak_milestone'        THEN 150 -- 52-week milestone
    ELSE NULL  -- unknown action → reject
  END;

  IF v_max_amount IS NULL THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'unknown_action');
  END IF;

  IF p_amount > v_max_amount THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'amount_exceeds_maximum');
  END IF;

  RETURN server_award_credits(auth.uid(), p_action, p_amount, p_metadata, p_idempotency_key);
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- HIGH-4: Add SET search_path to other user_ wrappers
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_spend_credits(
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'invalid_amount');
  END IF;
  RETURN server_spend_credits(auth.uid(), p_action, p_amount, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION user_fulfill_redemption(
  p_action text,
  p_cost integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN server_fulfill_redemption(auth.uid(), p_action, p_cost);
END;
$$;

CREATE OR REPLACE FUNCTION user_cancel_rsvp(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  RETURN server_cancel_rsvp(p_event_id, auth.uid());
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- HIGH-4 + MEDIUM-7: Harden user_rsvp_to_event
-- Add SET search_path + suspension check
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_rsvp_to_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_spots integer;
  v_current_count integer;
  v_existing_status text;
  v_suspended_until timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- MEDIUM-7: Check suspension
  SELECT suspended_until INTO v_suspended_until
  FROM profiles WHERE id = auth.uid();
  IF v_suspended_until IS NOT NULL AND v_suspended_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your account is suspended');
  END IF;

  SELECT max_spots INTO v_max_spots
  FROM events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  SELECT status INTO v_existing_status
  FROM event_rsvps WHERE event_id = p_event_id AND user_id = auth.uid();

  IF v_existing_status = 'going' THEN
    DELETE FROM event_rsvps WHERE event_id = p_event_id AND user_id = auth.uid();
    UPDATE events SET rsvp_count = GREATEST(0, COALESCE(rsvp_count, 0) - 1) WHERE id = p_event_id;
    RETURN jsonb_build_object('success', true, 'action', 'cancelled');
  END IF;

  IF v_max_spots IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM event_rsvps WHERE event_id = p_event_id AND status = 'going';
    IF v_current_count >= v_max_spots THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session is full', 'full', true);
    END IF;
  END IF;

  INSERT INTO event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, auth.uid(), 'going')
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

  UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE id = p_event_id;
  RETURN jsonb_build_object('success', true, 'action', 'going');
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- HIGH-4 + MEDIUM-8: Harden user_join_waitlist
-- Add SET search_path + duplicate protection
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_join_waitlist(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_position integer;
  v_existing integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- MEDIUM-8: Check for existing waitlist entry
  SELECT position INTO v_existing
  FROM session_waitlist WHERE event_id = p_event_id AND user_id = auth.uid();
  IF v_existing IS NOT NULL THEN
    RETURN v_existing; -- already on waitlist, return existing position
  END IF;

  PERFORM 1 FROM session_waitlist WHERE event_id = p_event_id FOR UPDATE;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM session_waitlist WHERE event_id = p_event_id;

  INSERT INTO session_waitlist (event_id, user_id, position)
  VALUES (p_event_id, auth.uid(), v_position);

  RETURN v_position;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- HIGH-4: Harden follow/unfollow with SET search_path
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_follow_user(p_followed_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_follows integer;
  v_today_follows integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF auth.uid() = p_followed_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot follow yourself');
  END IF;

  SELECT COUNT(*) INTO v_total_follows
  FROM member_follows WHERE follower_id = auth.uid();
  IF v_total_follows >= 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum follows reached. Unfollow someone first.');
  END IF;

  SELECT COUNT(*) INTO v_today_follows
  FROM member_follows WHERE follower_id = auth.uid() AND created_at > now() - interval '24 hours';
  IF v_today_follows >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily follow limit reached. Try again tomorrow.');
  END IF;

  INSERT INTO member_follows (follower_id, followed_id) VALUES (auth.uid(), p_followed_id);
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already following this person.');
END;
$$;

CREATE OR REPLACE FUNCTION user_unfollow_user(p_followed_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  DELETE FROM member_follows WHERE follower_id = auth.uid() AND followed_id = p_followed_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
