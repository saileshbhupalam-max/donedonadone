-- Server-Side Business Logic Migration
-- Fixes: F-04 (client-side FC), F-07 (client-side auto-session), F-14 (timezone),
--        F-15 (idempotency), F-25 (client-side logic), F-29 (race condition)
--
-- This migration:
-- 1. Creates server_award_credits() RPC with full cap/diminishing enforcement
-- 2. Creates server_spend_credits() RPC with balance validation
-- 3. Creates server_activate_venue() RPC for atomic venue activation
-- 4. Creates server_evaluate_venue_health() RPC for server-side health eval
-- 5. Creates server_check_demand_cluster() RPC for atomic auto-session creation
-- 6. Locks down focus_credits INSERT to prevent client-side minting
-- 7. Adds bootstrap mode + no-show penalty support to neighborhoods/events

-- ─────────────────────────────────────────────────────────────
-- 1. SERVER_AWARD_CREDITS: Replaces client-side awardCredits()
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION server_award_credits(
  p_user_id uuid,
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_daily_cap integer := 50;
  v_total_daily_cap integer := 150;
  v_today_start timestamptz;
  v_today_earnings integer;
  v_total_today_earnings integer;
  v_remaining integer;
  v_adjusted_amount integer;
  v_expires_at timestamptz;
  v_existing_count integer;
  v_reviews_per_day integer := 3;
  v_photos_per_day integer := 10;
  v_same_venue_review_cap integer := 3;
  v_same_venue_photo_cap integer := 5;
  v_venue_id text;
  v_bonus_expiry_days integer := 30;
  v_is_contribution boolean;
  v_config_row record;
BEGIN
  -- Idempotency: reject duplicate requests
  IF p_idempotency_key IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_count
    FROM focus_credits
    WHERE user_id = p_user_id
      AND action = p_action
      AND metadata->>'idempotency_key' = p_idempotency_key;

    IF v_existing_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'duplicate_request');
    END IF;
  END IF;

  -- Try to load runtime config overrides
  BEGIN
    SELECT value INTO v_config_row FROM app_settings WHERE key = 'growth_config';
    IF v_config_row.value IS NOT NULL THEN
      v_daily_cap := COALESCE((v_config_row.value->'credits'->>'dailyEarnCap')::integer, 50);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  v_venue_id := p_metadata->>'venue_id';
  v_adjusted_amount := p_amount;

  -- Check total daily earning cap (all actions, prevents unlimited minting)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_today_earnings
  FROM focus_credits
  WHERE user_id = p_user_id AND amount > 0 AND created_at >= v_today_start;

  IF v_total_today_earnings >= v_total_daily_cap THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'total_daily_cap_reached');
  END IF;
  v_adjusted_amount := LEAST(v_adjusted_amount, v_total_daily_cap - v_total_today_earnings);

  -- Contribution-specific daily cap (stricter subset)
  v_is_contribution := p_action IN (
    'write_review', 'upload_photo', 'report_venue_info', 'verify_venue_info',
    'check_in_photo', 'report_company_presence', 'report_seating_capacity',
    'report_floor_count', 'report_amenities', 'add_new_venue'
  );

  IF v_is_contribution THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_today_earnings
    FROM focus_credits
    WHERE user_id = p_user_id AND amount > 0 AND created_at >= v_today_start
      AND action IN ('write_review','upload_photo','report_venue_info','verify_venue_info',
                     'check_in_photo','report_company_presence','report_seating_capacity',
                     'report_floor_count','report_amenities','add_new_venue');

    IF v_today_earnings >= v_daily_cap THEN
      RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'daily_cap_reached');
    END IF;
    v_adjusted_amount := LEAST(v_adjusted_amount, v_daily_cap - v_today_earnings);
  END IF;

  -- Diminishing returns: reviews
  IF p_action = 'write_review' THEN
    SELECT COUNT(*) INTO v_existing_count FROM focus_credits
    WHERE user_id = p_user_id AND action = 'write_review' AND created_at >= v_today_start;
    IF v_existing_count >= v_reviews_per_day THEN
      RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'diminishing_returns');
    END IF;
    IF v_venue_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count FROM focus_credits
      WHERE user_id = p_user_id AND action = 'write_review' AND metadata->>'venue_id' = v_venue_id;
      IF v_existing_count >= v_same_venue_review_cap THEN
        RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'diminishing_returns');
      END IF;
    END IF;
  END IF;

  -- Diminishing returns: photos
  IF p_action IN ('upload_photo', 'check_in_photo') THEN
    SELECT COUNT(*) INTO v_existing_count FROM focus_credits
    WHERE user_id = p_user_id AND action IN ('upload_photo','check_in_photo') AND created_at >= v_today_start;
    IF v_existing_count >= v_photos_per_day THEN
      RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'diminishing_returns');
    END IF;
    IF v_venue_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count FROM focus_credits
      WHERE user_id = p_user_id AND action IN ('upload_photo','check_in_photo') AND metadata->>'venue_id' = v_venue_id;
      IF v_existing_count >= v_same_venue_photo_cap THEN
        RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'diminishing_returns');
      END IF;
    END IF;
  END IF;

  -- Diminishing returns: taste answers (cap at 6 FC/day = 3 answers x 2 FC)
  IF p_action = 'taste_answer' THEN
    SELECT COUNT(*) INTO v_existing_count FROM focus_credits
    WHERE user_id = p_user_id AND action = 'taste_answer' AND created_at >= v_today_start;
    IF v_existing_count >= 3 THEN
      RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'diminishing_returns');
    END IF;
  END IF;

  IF v_adjusted_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'zero_amount');
  END IF;

  -- Bonus credit expiry
  v_expires_at := NULL;
  IF p_action IN ('referral_complete', 'referral_milestone_3', 'streak_bonus') AND v_bonus_expiry_days > 0 THEN
    v_expires_at := now() + (v_bonus_expiry_days || ' days')::interval;
  END IF;

  -- Embed idempotency key in metadata
  IF p_idempotency_key IS NOT NULL THEN
    p_metadata := p_metadata || jsonb_build_object('idempotency_key', p_idempotency_key);
  END IF;

  -- Insert ledger entry
  INSERT INTO focus_credits (user_id, amount, action, metadata, expires_at)
  VALUES (p_user_id, v_adjusted_amount, p_action, p_metadata, v_expires_at);

  RETURN jsonb_build_object('success', true, 'awarded', v_adjusted_amount);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. SERVER_SPEND_CREDITS: Replaces client-side spendCredits()
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION server_spend_credits(
  p_user_id uuid,
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Calculate balance excluding expired
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM focus_credits
  WHERE user_id = p_user_id AND (expires_at IS NULL OR expires_at > now());

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'insufficient_balance');
  END IF;

  INSERT INTO focus_credits (user_id, amount, action, metadata, expires_at)
  VALUES (p_user_id, -p_amount, p_action, p_metadata, NULL);

  RETURN jsonb_build_object('success', true, 'awarded', p_amount);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. SERVER_ACTIVATE_VENUE: Atomic venue activation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION server_activate_venue(p_nomination_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nomination record;
  v_location_id uuid;
BEGIN
  SELECT * INTO v_nomination FROM venue_nominations WHERE id = p_nomination_id;
  IF v_nomination IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nomination_not_found');
  END IF;
  IF v_nomination.location_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_activated');
  END IF;

  -- Create location entry
  INSERT INTO locations (name, address, neighborhood, latitude, longitude, location_type, wifi_available, photo_url, google_maps_url)
  VALUES (v_nomination.venue_name, v_nomination.address, v_nomination.neighborhood,
          v_nomination.latitude, v_nomination.longitude, 'cafe',
          v_nomination.wifi_available, v_nomination.photo_url, v_nomination.google_maps_url)
  RETURNING id INTO v_location_id;

  -- Link and activate nomination
  UPDATE venue_nominations SET
    location_id = v_location_id,
    status = 'active',
    activated_at = now()
  WHERE id = p_nomination_id;

  -- Refresh neighborhood stats
  PERFORM update_neighborhood_stats(v_nomination.neighborhood);

  -- Award activation bonus to nominator (30 FC)
  PERFORM server_award_credits(
    v_nomination.nominated_by, 'add_new_venue', 30,
    jsonb_build_object('venue_id', v_location_id::text, 'activation_bonus', true)
  );

  RETURN jsonb_build_object('success', true, 'location_id', v_location_id);
END;
$$;

-- Update check_nomination_activation to call server_activate_venue internally
CREATE OR REPLACE FUNCTION check_nomination_activation(p_nomination_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nomination venue_nominations%ROWTYPE;
  v_vouch_count int;
  v_neighborhood_unlocked boolean;
  v_required_vouches int := 3;
  v_activation_result jsonb;
BEGIN
  SELECT * INTO v_nomination FROM venue_nominations WHERE id = p_nomination_id;
  IF v_nomination IS NULL OR v_nomination.status != 'nominated' THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_vouch_count FROM venue_vouches WHERE nomination_id = p_nomination_id;

  SELECT is_unlocked INTO v_neighborhood_unlocked
  FROM neighborhood_stats WHERE neighborhood = v_nomination.neighborhood;

  IF v_vouch_count >= v_required_vouches AND COALESCE(v_neighborhood_unlocked, false) THEN
    UPDATE venue_nominations SET
      status = 'verified',
      vouch_count = v_vouch_count,
      activated_at = now()
    WHERE id = p_nomination_id;

    -- Auto-activate server-side (no client round-trip needed)
    v_activation_result := server_activate_venue(p_nomination_id);
    RETURN true;
  ELSE
    UPDATE venue_nominations SET vouch_count = v_vouch_count WHERE id = p_nomination_id;
    RETURN false;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. SERVER_EVALUATE_VENUE_HEALTH: Server-side health eval
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION server_evaluate_venue_health(p_location_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bad_threshold integer := 3;
  v_closed_count integer;
  v_bad_count integer;
  v_nomination record;
  v_total_checks integer;
BEGIN
  -- Count total recent checks
  SELECT COUNT(*) INTO v_total_checks
  FROM venue_health_checks WHERE location_id = p_location_id;
  IF v_total_checks < v_bad_threshold THEN
    RETURN jsonb_build_object('deactivated', false, 'reason', 'insufficient_data');
  END IF;

  -- Check closed reports
  SELECT COUNT(*) INTO v_closed_count
  FROM (SELECT still_open FROM venue_health_checks
        WHERE location_id = p_location_id ORDER BY checked_at DESC LIMIT v_bad_threshold) recent
  WHERE NOT still_open;

  IF v_closed_count >= v_bad_threshold THEN
    SELECT * INTO v_nomination FROM venue_nominations
    WHERE location_id = p_location_id AND status = 'active' LIMIT 1;
    IF v_nomination IS NOT NULL THEN
      UPDATE venue_nominations SET status = 'deactivated', deactivated_at = now(),
        deactivation_reason = 'Reported as closed by multiple members'
      WHERE id = v_nomination.id;
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (v_nomination.nominated_by, 'venue_deactivated',
              v_nomination.venue_name || ' has been deactivated',
              'Reported as closed by multiple members',
              jsonb_build_object('nomination_id', v_nomination.id), false);
    END IF;
    RETURN jsonb_build_object('deactivated', true, 'reason', 'closed');
  END IF;

  -- Check consistently bad conditions
  SELECT COUNT(*) INTO v_bad_count
  FROM (SELECT wifi_ok, noise_ok, seating_ok FROM venue_health_checks
        WHERE location_id = p_location_id ORDER BY checked_at DESC LIMIT v_bad_threshold) recent
  WHERE (CASE WHEN NOT wifi_ok THEN 1 ELSE 0 END +
         CASE WHEN NOT noise_ok THEN 1 ELSE 0 END +
         CASE WHEN NOT seating_ok THEN 1 ELSE 0 END) >= 2;

  IF v_bad_count >= v_bad_threshold THEN
    SELECT * INTO v_nomination FROM venue_nominations
    WHERE location_id = p_location_id AND status = 'active' LIMIT 1;
    IF v_nomination IS NOT NULL THEN
      UPDATE venue_nominations SET status = 'deactivated', deactivated_at = now(),
        deactivation_reason = 'Consistently poor conditions reported by members'
      WHERE id = v_nomination.id;
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (v_nomination.nominated_by, 'venue_deactivated',
              v_nomination.venue_name || ' has been deactivated',
              'Consistently poor conditions reported by members',
              jsonb_build_object('nomination_id', v_nomination.id), false);
    END IF;
    RETURN jsonb_build_object('deactivated', true, 'reason', 'poor_conditions');
  END IF;

  RETURN jsonb_build_object('deactivated', false);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. SERVER_CHECK_DEMAND_CLUSTER: Atomic auto-session creation
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION server_check_demand_cluster(
  p_neighborhood text,
  p_preferred_time text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cluster_key text;
  v_request_count integer;
  v_existing_event_id uuid;
  v_requests record[];
  v_user_ids uuid[];
  v_venue record;
  v_captain_id uuid;
  v_event_id uuid;
  v_time_slot record;
  v_session_date date;
  v_req record;
BEGIN
  v_cluster_key := p_neighborhood || '__' || p_preferred_time;

  -- Count pending requests for this cluster
  SELECT COUNT(*) INTO v_request_count
  FROM session_requests
  WHERE status = 'pending' AND neighborhood = p_neighborhood AND preferred_time = p_preferred_time;

  IF v_request_count < 3 THEN
    RETURN jsonb_build_object('created', false, 'reason', 'insufficient_demand', 'count', v_request_count);
  END IF;

  -- Check if already created for this cluster
  SELECT id INTO v_existing_event_id FROM events
  WHERE demand_cluster_key = v_cluster_key AND auto_created = true LIMIT 1;

  IF v_existing_event_id IS NOT NULL THEN
    RETURN jsonb_build_object('created', false, 'reason', 'already_exists', 'event_id', v_existing_event_id);
  END IF;

  -- Collect user IDs
  SELECT array_agg(user_id) INTO v_user_ids
  FROM session_requests
  WHERE status = 'pending' AND neighborhood = p_neighborhood AND preferred_time = p_preferred_time;

  -- Find best venue in neighborhood
  SELECT l.id, l.name INTO v_venue
  FROM locations l
  WHERE l.neighborhood = p_neighborhood
  ORDER BY (SELECT COUNT(*) FROM check_ins ci WHERE ci.location_id = l.id) DESC
  LIMIT 1;

  IF v_venue.id IS NULL THEN
    RETURN jsonb_build_object('created', false, 'reason', 'no_venue');
  END IF;

  -- Pick captain: prefer is_table_captain, then most events_attended
  SELECT id INTO v_captain_id FROM profiles
  WHERE id = ANY(v_user_ids)
  ORDER BY is_table_captain DESC NULLS LAST, events_attended DESC NULLS LAST
  LIMIT 1;

  IF v_captain_id IS NULL THEN
    v_captain_id := v_user_ids[1];
  END IF;

  -- Schedule for next weekday
  v_session_date := CURRENT_DATE + 1;
  WHILE EXTRACT(DOW FROM v_session_date) IN (0, 6) LOOP
    v_session_date := v_session_date + 1;
  END LOOP;

  -- Create event
  INSERT INTO events (title, date, start_time, session_format, location_id, neighborhood,
                      max_attendees, auto_created, demand_cluster_key, created_by, status)
  VALUES ('Auto-Session at ' || v_venue.name,
          v_session_date,
          CASE p_preferred_time WHEN 'morning' THEN '09:00' WHEN 'afternoon' THEN '14:00' ELSE '18:00' END,
          CASE p_preferred_time WHEN 'morning' THEN 'morning_2hr' WHEN 'afternoon' THEN 'afternoon_2hr' ELSE 'evening_2hr' END,
          v_venue.id, p_neighborhood,
          LEAST(array_length(v_user_ids, 1) + 2, 8),
          true, v_cluster_key, v_captain_id, 'upcoming')
  RETURNING id INTO v_event_id;

  -- Fulfill requests
  UPDATE session_requests SET status = 'fulfilled'
  WHERE status = 'pending' AND neighborhood = p_neighborhood AND preferred_time = p_preferred_time;

  -- Auto-RSVP all requesters
  FOR v_req IN SELECT unnest(v_user_ids) AS uid LOOP
    INSERT INTO event_rsvps (event_id, user_id, status)
    VALUES (v_event_id, v_req.uid, 'going')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END LOOP;

  -- Notify all requesters
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
-- 6. LOCK DOWN focus_credits INSERT
-- ─────────────────────────────────────────────────────────────
-- Remove the permissive client-side INSERT policy.
-- SECURITY DEFINER functions (server_award_credits, server_spend_credits) bypass RLS.
-- Edge Functions use service_role which also bypasses RLS.
DROP POLICY IF EXISTS "Authenticated users can insert own credits" ON focus_credits;

-- ─────────────────────────────────────────────────────────────
-- 7. BOOTSTRAP MODE for neighborhoods + session expiry
-- ─────────────────────────────────────────────────────────────
-- Add bootstrap flag so launch neighborhoods skip the 10-member gate
ALTER TABLE neighborhood_stats ADD COLUMN IF NOT EXISTS is_bootstrapped boolean DEFAULT false;

-- Bootstrap HSR Layout (launch neighborhood)
INSERT INTO neighborhood_stats (neighborhood, member_count, active_venues, is_unlocked, is_bootstrapped, last_updated)
VALUES ('hsr-layout', 0, 0, true, true, now())
ON CONFLICT (neighborhood) DO UPDATE SET is_bootstrapped = true, is_unlocked = true;

-- Update the neighborhood unlock check to respect bootstrap
CREATE OR REPLACE FUNCTION update_neighborhood_stats(p_neighborhood text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member_count int;
  v_active_venues int;
  v_threshold int := 10;
  v_is_bootstrapped boolean;
BEGIN
  SELECT COUNT(DISTINCT id) INTO v_member_count
  FROM profiles WHERE neighborhood = p_neighborhood;

  SELECT COUNT(*) INTO v_active_venues
  FROM venue_nominations WHERE neighborhood = p_neighborhood AND status = 'active';

  -- Check if bootstrapped (always unlocked regardless of count)
  SELECT COALESCE(is_bootstrapped, false) INTO v_is_bootstrapped
  FROM neighborhood_stats WHERE neighborhood = p_neighborhood;

  INSERT INTO neighborhood_stats (neighborhood, member_count, active_venues, is_unlocked, unlocked_at, last_updated)
  VALUES (
    p_neighborhood, v_member_count, v_active_venues,
    v_member_count >= v_threshold OR COALESCE(v_is_bootstrapped, false),
    CASE WHEN v_member_count >= v_threshold OR COALESCE(v_is_bootstrapped, false) THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (neighborhood) DO UPDATE SET
    member_count = v_member_count,
    active_venues = v_active_venues,
    is_unlocked = v_member_count >= v_threshold OR COALESCE(neighborhood_stats.is_bootstrapped, false),
    unlocked_at = CASE
      WHEN neighborhood_stats.is_unlocked = false AND (v_member_count >= v_threshold OR COALESCE(neighborhood_stats.is_bootstrapped, false)) THEN now()
      ELSE neighborhood_stats.unlocked_at
    END,
    last_updated = now();
END;
$$;

-- Add expires_at to session_requests (stale requests expire after 14 days)
ALTER TABLE session_requests ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '14 days');

-- Add no-show penalty tracking
ALTER TABLE events ADD COLUMN IF NOT EXISTS minimum_attendees integer DEFAULT 3;

-- Add admin_seeded flag for bootstrapped sessions
ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_seeded boolean DEFAULT false;

-- Add profile visibility controls (F-20 privacy fix)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_visibility text DEFAULT 'public'
  CHECK (profile_visibility IN ('public', 'session_only', 'minimal'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_neighborhood boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_social_links boolean DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 8. GRANT EXECUTE on new RPCs
-- ─────────────────────────────────────────────────────────────
-- These RPCs are SECURITY DEFINER so they bypass RLS.
-- Grant to authenticated users (they still can't exceed server-enforced caps).
GRANT EXECUTE ON FUNCTION server_award_credits TO authenticated;
GRANT EXECUTE ON FUNCTION server_spend_credits TO authenticated;
GRANT EXECUTE ON FUNCTION server_activate_venue TO authenticated;
GRANT EXECUTE ON FUNCTION server_evaluate_venue_health TO authenticated;
GRANT EXECUTE ON FUNCTION server_check_demand_cluster TO authenticated;
