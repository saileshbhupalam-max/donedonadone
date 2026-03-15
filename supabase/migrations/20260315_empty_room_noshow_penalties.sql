-- Fix 0.2: Empty Room Problem — guaranteed sessions, admin seeding support
-- Fix 0.3: No-Show Penalties — cancellation cascade, FC deductions
-- Also fixes: server_check_demand_cluster using wrong column names (max_attendees → max_spots)

-- ─────────────────────────────────────────────────────────────
-- 1. ADD MISSING COLUMNS TO EVENTS
-- ─────────────────────────────────────────────────────────────

-- Link events to locations (used by auto-created sessions from demand clusters)
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

-- Event lifecycle: upcoming → in_progress → completed → cancelled
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text DEFAULT 'upcoming';

-- Guaranteed sessions run even with 1 attendee (loss-leader for cold start)
ALTER TABLE events ADD COLUMN IF NOT EXISTS guaranteed boolean DEFAULT false;

-- Performance index for RSVP cascade queries
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status ON event_rsvps(event_id, status);

-- ─────────────────────────────────────────────────────────────
-- 2. FIX server_check_demand_cluster (wrong column names)
-- ─────────────────────────────────────────────────────────────
-- Previous version used max_attendees (column doesn't exist → max_spots)
CREATE OR REPLACE FUNCTION server_check_demand_cluster(
  p_neighborhood text,
  p_preferred_time text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cluster_key text;
  v_request_count integer;
  v_existing_event_id uuid;
  v_user_ids uuid[];
  v_venue record;
  v_captain_id uuid;
  v_event_id uuid;
  v_session_date date;
  v_req record;
BEGIN
  v_cluster_key := p_neighborhood || '__' || p_preferred_time;

  SELECT COUNT(*) INTO v_request_count
  FROM session_requests
  WHERE status = 'pending' AND neighborhood = p_neighborhood AND preferred_time = p_preferred_time;

  IF v_request_count < 3 THEN
    RETURN jsonb_build_object('created', false, 'reason', 'insufficient_demand', 'count', v_request_count);
  END IF;

  SELECT id INTO v_existing_event_id FROM events
  WHERE demand_cluster_key = v_cluster_key AND auto_created = true LIMIT 1;

  IF v_existing_event_id IS NOT NULL THEN
    RETURN jsonb_build_object('created', false, 'reason', 'already_exists', 'event_id', v_existing_event_id);
  END IF;

  SELECT array_agg(user_id) INTO v_user_ids
  FROM session_requests
  WHERE status = 'pending' AND neighborhood = p_neighborhood AND preferred_time = p_preferred_time;

  SELECT l.id, l.name INTO v_venue
  FROM locations l
  WHERE l.neighborhood = p_neighborhood
  ORDER BY (SELECT COUNT(*) FROM check_ins ci WHERE ci.location_id = l.id) DESC
  LIMIT 1;

  IF v_venue.id IS NULL THEN
    RETURN jsonb_build_object('created', false, 'reason', 'no_venue');
  END IF;

  SELECT id INTO v_captain_id FROM profiles
  WHERE id = ANY(v_user_ids)
  ORDER BY is_table_captain DESC NULLS LAST, events_attended DESC NULLS LAST
  LIMIT 1;

  IF v_captain_id IS NULL THEN
    v_captain_id := v_user_ids[1];
  END IF;

  v_session_date := CURRENT_DATE + 1;
  WHILE EXTRACT(DOW FROM v_session_date) IN (0, 6) LOOP
    v_session_date := v_session_date + 1;
  END LOOP;

  -- FIXED: use max_spots (not max_attendees), include location_id + status
  INSERT INTO events (title, date, start_time, session_format, location_id, neighborhood,
                      max_spots, auto_created, demand_cluster_key, created_by, status)
  VALUES ('Auto-Session at ' || v_venue.name,
          v_session_date,
          CASE p_preferred_time WHEN 'morning' THEN '09:00' WHEN 'afternoon' THEN '14:00' ELSE '18:00' END,
          CASE p_preferred_time WHEN 'morning' THEN 'morning_2hr' WHEN 'afternoon' THEN 'afternoon_2hr' ELSE 'evening_2hr' END,
          v_venue.id, p_neighborhood,
          LEAST(array_length(v_user_ids, 1) + 2, 8),
          true, v_cluster_key, v_captain_id, 'upcoming')
  RETURNING id INTO v_event_id;

  UPDATE session_requests SET status = 'fulfilled'
  WHERE status = 'pending' AND neighborhood = p_neighborhood AND preferred_time = p_preferred_time;

  FOR v_req IN SELECT unnest(v_user_ids) AS uid LOOP
    INSERT INTO event_rsvps (event_id, user_id, status)
    VALUES (v_event_id, v_req.uid, 'going')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END LOOP;

  FOR v_req IN SELECT unnest(v_user_ids) AS uid LOOP
    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (v_req.uid, 'session_auto_created',
            'Session created from your request!',
            'Enough people want to work together — we auto-created a session for you.',
            jsonb_build_object('event_id', v_event_id), false);
  END LOOP;

  RETURN jsonb_build_object('created', true, 'event_id', v_event_id, 'attendees', array_length(v_user_ids, 1));
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. server_cancel_rsvp: Cancellation with cascade
-- ─────────────────────────────────────────────────────────────
-- Handles: FC penalty for late cancel, waitlist promotion,
-- at-risk notifications, auto-cancel if below minimum near start time.
-- Guaranteed sessions never auto-cancel.
CREATE OR REPLACE FUNCTION server_cancel_rsvp(
  p_event_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event record;
  v_rsvp record;
  v_hours_until_start numeric;
  v_penalty_amount integer := 0;
  v_penalty_action text := NULL;
  v_going_count integer;
  v_promoted_user_id uuid;
  v_at_risk boolean := false;
  v_cancelled boolean := false;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_found');
  END IF;

  -- Only process "going" RSVPs (not "interested")
  SELECT * INTO v_rsvp FROM event_rsvps
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going';
  IF v_rsvp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_rsvp');
  END IF;

  -- Hours until event start (event.date + start_time, default 09:00)
  v_hours_until_start := EXTRACT(EPOCH FROM (
    (v_event.date + COALESCE(v_event.start_time, '09:00')::time) - now()
  )) / 3600.0;

  -- Late cancellation penalty: < 2 hours before start → -10 FC
  IF v_hours_until_start >= 0 AND v_hours_until_start < 2 THEN
    v_penalty_amount := 10;
    v_penalty_action := 'late_cancel_penalty';
  END IF;

  -- Delete the RSVP
  DELETE FROM event_rsvps WHERE event_id = p_event_id AND user_id = p_user_id;

  -- Decrement rsvp_count
  UPDATE events SET rsvp_count = GREATEST(0, COALESCE(rsvp_count, 0) - 1)
  WHERE id = p_event_id;

  -- Track reliability (late_cancel if < 24h before)
  IF v_hours_until_start >= 0 AND v_hours_until_start < 24 THEN
    PERFORM update_reliability(p_user_id, 'late_cancel');
  END IF;

  -- Apply FC penalty
  IF v_penalty_amount > 0 THEN
    PERFORM server_spend_credits(p_user_id, v_penalty_action, v_penalty_amount,
      jsonb_build_object('event_id', p_event_id::text, 'hours_before', round(v_hours_until_start::numeric, 1)));
  END IF;

  -- Promote from waitlist (safe: function returns NULL if no waitlist)
  BEGIN
    v_promoted_user_id := promote_waitlist(p_event_id);
    -- If promoted, also add RSVP and update count
    IF v_promoted_user_id IS NOT NULL THEN
      INSERT INTO event_rsvps (event_id, user_id, status)
      VALUES (p_event_id, v_promoted_user_id, 'going')
      ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

      UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE id = p_event_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (v_promoted_user_id, 'waitlist_promoted',
        'You''re in! ' || v_event.title,
        'A spot opened up and you''ve been promoted from the waitlist.',
        jsonb_build_object('event_id', p_event_id), false);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_promoted_user_id := NULL;
  END;

  -- Cascade check: is session below minimum?
  SELECT COUNT(*) INTO v_going_count FROM event_rsvps
  WHERE event_id = p_event_id AND status = 'going';

  -- Skip cascade for guaranteed sessions — they run regardless
  IF v_going_count < COALESCE(v_event.minimum_attendees, 3)
     AND NOT COALESCE(v_event.guaranteed, false)
     AND v_hours_until_start > 0 THEN
    v_at_risk := true;

    IF v_hours_until_start < 2 THEN
      -- Auto-cancel: too close to start with too few people
      UPDATE events SET status = 'cancelled' WHERE id = p_event_id;
      v_cancelled := true;

      -- Notify remaining attendees (no penalty for them)
      INSERT INTO notifications (user_id, type, title, body, data, read)
      SELECT er.user_id, 'session_cancelled',
        v_event.title || ' has been cancelled',
        'Not enough people confirmed. No penalty for remaining attendees.',
        jsonb_build_object('event_id', p_event_id), false
      FROM event_rsvps er WHERE er.event_id = p_event_id AND er.status = 'going';

    ELSIF v_hours_until_start < 24 THEN
      -- Warn: session is at risk, invite friends
      INSERT INTO notifications (user_id, type, title, body, data, read)
      SELECT er.user_id, 'session_at_risk',
        v_event.title || ' needs more people!',
        'Someone just cancelled. Invite a friend to keep the session alive!',
        jsonb_build_object('event_id', p_event_id, 'going_count', v_going_count), false
      FROM event_rsvps er WHERE er.event_id = p_event_id AND er.status = 'going';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'penalty_amount', v_penalty_amount,
    'promoted_from_waitlist', v_promoted_user_id IS NOT NULL,
    'session_at_risk', v_at_risk,
    'session_cancelled', v_cancelled,
    'going_count', v_going_count
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. server_process_no_shows: Post-session no-show detection + penalties
-- ─────────────────────────────────────────────────────────────
-- Called by Edge Function cron or admin after session end time.
-- Ghost no-show = RSVPed "going" but submitted no feedback at all.
-- Self-reported no-shows ("I wasn't there" button) are NOT penalized again
-- here — honesty is rewarded with a lighter treatment (no FC deduction,
-- just the profile counter that FeedbackCard already increments).
CREATE OR REPLACE FUNCTION server_process_no_shows(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event record;
  v_no_show_count integer := 0;
  v_penalty_amount integer := 20;
  v_rsvp record;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_not_found');
  END IF;

  IF v_event.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_was_cancelled');
  END IF;

  -- Ghost no-shows: RSVPed "going" but never submitted any feedback
  FOR v_rsvp IN
    SELECT er.user_id FROM event_rsvps er
    WHERE er.event_id = p_event_id AND er.status = 'going'
    AND NOT EXISTS (
      SELECT 1 FROM event_feedback ef
      WHERE ef.event_id = p_event_id AND ef.user_id = er.user_id
    )
  LOOP
    PERFORM server_spend_credits(v_rsvp.user_id, 'no_show_penalty', v_penalty_amount,
      jsonb_build_object('event_id', p_event_id::text, 'type', 'ghost'));

    PERFORM update_reliability(v_rsvp.user_id, 'no_show');

    UPDATE profiles SET
      no_show_count = COALESCE(no_show_count, 0) + 1,
      events_no_show = COALESCE(events_no_show, 0) + 1
    WHERE id = v_rsvp.user_id;

    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (v_rsvp.user_id, 'no_show_penalty',
      'Missed: ' || v_event.title,
      'You didn''t show up or leave feedback. -' || v_penalty_amount || ' FC. Please cancel ahead of time.',
      jsonb_build_object('event_id', p_event_id, 'penalty', v_penalty_amount), false);

    v_no_show_count := v_no_show_count + 1;
  END LOOP;

  -- Mark event as completed
  UPDATE events SET status = 'completed'
  WHERE id = p_event_id AND status NOT IN ('cancelled', 'completed');

  RETURN jsonb_build_object('success', true, 'no_shows_processed', v_no_show_count);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. GRANTS
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION server_cancel_rsvp TO authenticated;
GRANT EXECUTE ON FUNCTION server_process_no_shows TO authenticated;
