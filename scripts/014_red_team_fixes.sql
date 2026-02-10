-- =============================================================================
-- 014_red_team_fixes.sql
-- Red Team Remediation: Quick Wins + P0 + P1 database fixes
-- All changes are idempotent (safe to re-run)
-- =============================================================================

-- =============================================
-- PHASE 1: QUICK WINS — Constraints & Policies
-- =============================================

-- QW-10: Payment reference uniqueness (prevent reuse of same UPI ref)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_ref_unique
  ON bookings(payment_reference)
  WHERE payment_reference IS NOT NULL AND payment_status != 'cancelled';

-- QW-11: Minimum payment amount (prevent zero-cost bookings)
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_amount_positive CHECK (payment_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- QW-13: Platform fee constraint (prevent negative fees)
DO $$ BEGIN
  ALTER TABLE sessions ADD CONSTRAINT sessions_platform_fee_valid CHECK (platform_fee >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- QW-12: Drop permissive subscription user UPDATE policy
DROP POLICY IF EXISTS "Users update own subscriptions" ON user_subscriptions;

-- QW-18: Subscription plans — admin-only write access
DROP POLICY IF EXISTS "Only admins can modify plans" ON subscription_plans;
CREATE POLICY "Only admins can modify plans" ON subscription_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- QW-19: matching_outcomes — admin-only read access
DROP POLICY IF EXISTS "Users view own matching outcomes" ON matching_outcomes;
DROP POLICY IF EXISTS "Admins view all matching outcomes" ON matching_outcomes;
CREATE POLICY "Admins view all matching outcomes" ON matching_outcomes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- QW-20: Statement timeout on auto_assign_groups to prevent DoS
CREATE OR REPLACE FUNCTION auto_assign_groups(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_session sessions;
  v_group_size INTEGER;
  v_bookings RECORD;
  v_users UUID[];
  v_prefs JSONB := '{}';
  v_assigned UUID[] := '{}';
  v_group_num INTEGER := 1;
  v_current_group UUID[];
  v_seed UUID;
  v_best_user UUID;
  v_best_score INTEGER;
  v_score INTEGER;
  v_user UUID;
  v_candidate UUID;
  v_pref_a JSONB;
  v_pref_b JSONB;
  v_group_id UUID;
  v_result JSONB := '[]';
  v_overlap INTEGER;
  v_goals_a TEXT[];
  v_goals_b TEXT[];
  v_g TEXT;
  v_history_penalty INTEGER;
  v_favorite_bonus INTEGER;
  v_streak_bonus INTEGER;
  v_diversity_bonus INTEGER;
  v_cowork_again_bonus INTEGER;
BEGIN
  -- QW-20: Prevent long-running queries
  SET LOCAL statement_timeout = '30s';

  -- Get session details
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  v_group_size := v_session.group_size;

  -- Get all confirmed/paid booking user IDs
  SELECT array_agg(user_id) INTO v_users
  FROM bookings
  WHERE session_id = p_session_id
    AND payment_status IN ('paid', 'confirmed')
    AND cancelled_at IS NULL;

  IF v_users IS NULL OR array_length(v_users, 1) < 2 THEN
    RETURN '{"error": "Not enough users to form groups"}'::JSONB;
  END IF;

  -- Load all preferences into a JSONB map (including industry for diversity)
  FOR v_bookings IN
    SELECT cp.user_id, cp.work_vibe, cp.noise_preference, cp.communication_style,
           cp.social_goals, cp.introvert_extrovert, p.industry
    FROM coworker_preferences cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE cp.user_id = ANY(v_users)
  LOOP
    v_prefs := v_prefs || jsonb_build_object(
      v_bookings.user_id::TEXT,
      jsonb_build_object(
        'work_vibe', v_bookings.work_vibe,
        'noise', v_bookings.noise_preference,
        'comm', v_bookings.communication_style,
        'goals', to_jsonb(v_bookings.social_goals),
        'ie', v_bookings.introvert_extrovert,
        'industry', v_bookings.industry
      )
    );
  END LOOP;

  -- Delete existing groups for this session
  DELETE FROM group_members WHERE group_id IN (
    SELECT id FROM groups WHERE session_id = p_session_id
  );
  DELETE FROM groups WHERE session_id = p_session_id;

  -- Greedy grouping loop
  WHILE array_length(v_users, 1) - array_length(v_assigned, 1) > 0 LOOP
    v_current_group := '{}';

    -- Pick seed: first unassigned user
    v_seed := NULL;
    FOREACH v_user IN ARRAY v_users LOOP
      IF NOT (v_user = ANY(v_assigned)) THEN
        v_seed := v_user;
        EXIT;
      END IF;
    END LOOP;

    IF v_seed IS NULL THEN EXIT; END IF;

    v_current_group := array_append(v_current_group, v_seed);
    v_assigned := array_append(v_assigned, v_seed);

    -- Fill group to group_size
    WHILE array_length(v_current_group, 1) < v_group_size
      AND array_length(v_assigned, 1) < array_length(v_users, 1) LOOP

      v_best_user := NULL;
      v_best_score := -999;

      -- Score each unassigned candidate against seed
      FOREACH v_candidate IN ARRAY v_users LOOP
        IF v_candidate = ANY(v_assigned) THEN CONTINUE; END IF;

        v_pref_a := v_prefs -> v_seed::TEXT;
        v_pref_b := v_prefs -> v_candidate::TEXT;
        v_score := 0;
        v_history_penalty := 0;
        v_favorite_bonus := 0;
        v_streak_bonus := 0;
        v_diversity_bonus := 0;
        v_cowork_again_bonus := 0;

        -- work_vibe match = 3pts
        IF v_pref_a IS NOT NULL AND v_pref_b IS NOT NULL THEN
          IF (v_pref_a ->> 'work_vibe') = (v_pref_b ->> 'work_vibe') THEN
            v_score := v_score + 3;
          END IF;
          -- noise match = 2pts
          IF (v_pref_a ->> 'noise') = (v_pref_b ->> 'noise') THEN
            v_score := v_score + 2;
          END IF;
          -- comm_style match = 2pts
          IF (v_pref_a ->> 'comm') = (v_pref_b ->> 'comm') THEN
            v_score := v_score + 2;
          END IF;
          -- introvert_extrovert within 1 = 1pt
          IF (v_pref_a ->> 'ie') IS NOT NULL AND (v_pref_b ->> 'ie') IS NOT NULL THEN
            IF ABS((v_pref_a ->> 'ie')::INT - (v_pref_b ->> 'ie')::INT) <= 1 THEN
              v_score := v_score + 1;
            END IF;
          END IF;
          -- social_goals overlap = 1pt each
          IF v_pref_a -> 'goals' IS NOT NULL AND v_pref_b -> 'goals' IS NOT NULL THEN
            SELECT array_agg(g) INTO v_goals_a FROM jsonb_array_elements_text(v_pref_a -> 'goals') AS g;
            SELECT array_agg(g) INTO v_goals_b FROM jsonb_array_elements_text(v_pref_b -> 'goals') AS g;
            IF v_goals_a IS NOT NULL AND v_goals_b IS NOT NULL THEN
              SELECT count(*) INTO v_overlap FROM unnest(v_goals_a) g WHERE g = ANY(v_goals_b);
              v_score := v_score + v_overlap;
            END IF;
          END IF;

          -- Industry diversity bonus = +1pt if different industries
          IF (v_pref_a ->> 'industry') IS NOT NULL AND (v_pref_b ->> 'industry') IS NOT NULL
             AND (v_pref_a ->> 'industry') != (v_pref_b ->> 'industry') THEN
            v_diversity_bonus := 1;
          END IF;
        END IF;

        -- Anti-repetition penalty: -5 per co-grouping in last 3 sessions
        SELECT count(*) INTO v_history_penalty
        FROM group_history gh
        JOIN sessions s ON s.id = gh.session_id
        WHERE gh.user_id = v_seed
          AND gh.co_member_id = v_candidate
          AND s.date >= (CURRENT_DATE - INTERVAL '30 days')
        LIMIT 3;
        v_history_penalty := v_history_penalty * (-5);

        -- Favorite bonus: +1 if seed has favorited candidate
        SELECT count(*) INTO v_favorite_bonus
        FROM favorite_coworkers
        WHERE user_id = v_seed AND favorite_user_id = v_candidate;

        -- Would cowork again bonus: +2 if either rated the other positively
        SELECT count(*) INTO v_cowork_again_bonus
        FROM member_ratings
        WHERE ((from_user = v_seed AND to_user = v_candidate)
           OR (from_user = v_candidate AND to_user = v_seed))
          AND would_cowork_again = TRUE;
        IF v_cowork_again_bonus > 0 THEN v_cowork_again_bonus := 2; END IF;

        -- Streak affinity: +1 if both are active streakers
        IF EXISTS (SELECT 1 FROM user_streaks WHERE user_id = v_seed AND current_streak > 0)
           AND EXISTS (SELECT 1 FROM user_streaks WHERE user_id = v_candidate AND current_streak > 0) THEN
          v_streak_bonus := 1;
        END IF;

        v_score := v_score + v_history_penalty + v_favorite_bonus + v_cowork_again_bonus + v_streak_bonus + v_diversity_bonus;

        IF v_score > v_best_score THEN
          v_best_score := v_score;
          v_best_user := v_candidate;
        END IF;
      END LOOP;

      IF v_best_user IS NULL THEN EXIT; END IF;

      v_current_group := array_append(v_current_group, v_best_user);
      v_assigned := array_append(v_assigned, v_best_user);
    END LOOP;

    -- If remaining users < group_size, merge into this group
    IF array_length(v_users, 1) - array_length(v_assigned, 1) > 0
       AND array_length(v_users, 1) - array_length(v_assigned, 1) < v_group_size THEN
      FOREACH v_candidate IN ARRAY v_users LOOP
        IF NOT (v_candidate = ANY(v_assigned)) THEN
          v_current_group := array_append(v_current_group, v_candidate);
          v_assigned := array_append(v_assigned, v_candidate);
        END IF;
      END LOOP;
    END IF;

    -- Create group in DB
    INSERT INTO groups (session_id, group_number)
    VALUES (p_session_id, v_group_num)
    RETURNING id INTO v_group_id;

    -- Insert members and log matching outcomes
    FOREACH v_user IN ARRAY v_current_group LOOP
      INSERT INTO group_members (group_id, user_id) VALUES (v_group_id, v_user);
      -- Update booking with group_id
      UPDATE bookings SET group_id = v_group_id
      WHERE session_id = p_session_id AND user_id = v_user;
    END LOOP;

    v_result := v_result || jsonb_build_object(
      'group_number', v_group_num,
      'group_id', v_group_id,
      'members', to_jsonb(v_current_group),
      'size', array_length(v_current_group, 1)
    );

    v_group_num := v_group_num + 1;
  END LOOP;

  -- Populate group history for rotation tracking
  PERFORM populate_group_history(p_session_id);

  RETURN jsonb_build_object('groups', v_result, 'total_groups', v_group_num - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- PHASE 2: P0 — Critical Security Fixes
-- =============================================

-- P0-01: Prevent user_type self-escalation via trigger
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
    RAISE EXCEPTION 'Cannot change user_type directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_role_change ON profiles;
CREATE TRIGGER prevent_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- P0-02: Remove permissive booking UPDATE policy (all mutations via RPCs)
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

-- P0-05: Add auth.uid() check to book_session RPC
CREATE OR REPLACE FUNCTION book_session(p_session_id UUID, p_user_id UUID)
RETURNS bookings AS $$
DECLARE
  v_booking bookings;
  v_session sessions;
BEGIN
  -- P0-05: Prevent booking on behalf of other users
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: cannot book for another user';
  END IF;

  UPDATE sessions
  SET spots_filled = spots_filled + 1, updated_at = NOW()
  WHERE id = p_session_id AND spots_filled < max_spots AND status = 'upcoming'
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session is full or unavailable';
  END IF;

  INSERT INTO bookings (user_id, session_id, payment_amount, payment_status, expires_at)
  VALUES (p_user_id, p_session_id, v_session.total_price, 'pending', NOW() + INTERVAL '15 minutes')
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P0-08: Booking expiry column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- P0-08b: Decrement spots RPC for expiry cleanup
CREATE OR REPLACE FUNCTION decrement_spots(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sessions SET spots_filled = GREATEST(spots_filled - 1, 0)
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P0-12: Cancel booking RPC with auth check
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID)
RETURNS void AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Booking already cancelled';
  END IF;

  UPDATE bookings SET cancelled_at = NOW(), payment_status = 'cancelled'
    WHERE id = p_booking_id;

  UPDATE sessions SET spots_filled = GREATEST(spots_filled - 1, 0)
    WHERE id = v_booking.session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P0-13: Safety reporting tables
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) NOT NULL,
  reported_user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('harassment', 'safety', 'fraud', 'spam', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reports" ON user_reports;
CREATE POLICY "Users can create reports" ON user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON user_reports;
CREATE POLICY "Users can view own reports" ON user_reports
  FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins manage reports" ON user_reports;
CREATE POLICY "Admins manage reports" ON user_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- P0-13b: Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  blocked_user_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, blocked_user_id),
  CHECK (user_id != blocked_user_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own blocks" ON blocked_users;
CREATE POLICY "Users manage own blocks" ON blocked_users
  FOR ALL USING (auth.uid() = user_id);

-- P0-15: Restrict profiles SELECT to own profile only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- P0-15b: RPC to get limited profile for other users (used in group reveal, etc.)
CREATE OR REPLACE FUNCTION get_limited_profile(p_user_id UUID)
RETURNS TABLE(id UUID, display_name TEXT, avatar_url TEXT, work_type TEXT) AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, p.work_type
    FROM profiles p WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P0-15c: RPC to get group member profiles for session participants
CREATE OR REPLACE FUNCTION get_group_profiles(p_session_id UUID)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  work_type TEXT,
  work_vibe TEXT,
  industry TEXT,
  bio TEXT,
  noise_preference TEXT,
  communication_style TEXT,
  social_goals TEXT[]
) AS $$
BEGIN
  -- Only return data if the caller has a booking for this session
  IF NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE session_id = p_session_id
      AND bookings.user_id = auth.uid()
      AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a participant of this session';
  END IF;

  RETURN QUERY
    SELECT
      p.id AS user_id,
      p.display_name,
      p.avatar_url,
      p.work_type,
      cp.work_vibe,
      p.industry,
      p.bio,
      cp.noise_preference,
      cp.communication_style,
      cp.social_goals
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN profiles p ON p.id = gm.user_id
    LEFT JOIN coworker_preferences cp ON cp.user_id = gm.user_id
    WHERE g.session_id = p_session_id
      AND gm.group_id = (
        SELECT gm2.group_id FROM group_members gm2
        JOIN groups g2 ON g2.id = gm2.group_id
        WHERE g2.session_id = p_session_id AND gm2.user_id = auth.uid()
        LIMIT 1
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P0-16: Restrict groups and group_members to session participants
DROP POLICY IF EXISTS "Groups viewable by all" ON groups;
CREATE POLICY "Groups viewable by session participants" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.session_id = groups.session_id
        AND b.user_id = auth.uid()
        AND b.cancelled_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Group members viewable by all" ON group_members;
CREATE POLICY "Group members viewable by session participants" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN bookings b ON b.session_id = g.session_id
      WHERE g.id = group_members.group_id
        AND b.user_id = auth.uid()
        AND b.cancelled_at IS NULL
    )
  );

-- P0-18: Venues INSERT restricted to partner user_type
DROP POLICY IF EXISTS "Partners can insert own venues" ON venues;
CREATE POLICY "Partners can insert own venues" ON venues
  FOR INSERT WITH CHECK (
    auth.uid() = partner_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'partner')
  );


-- =============================================
-- PHASE 3: P1 — First Month Fixes
-- =============================================

-- P1-05: Check-in only for confirmed payments (not self-attested 'paid')
CREATE OR REPLACE FUNCTION check_in_user(p_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_booking bookings;
  v_session sessions;
BEGIN
  SELECT * INTO v_booking FROM bookings
  WHERE id = p_booking_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN '{"error": "Booking not found"}'::JSONB;
  END IF;

  IF v_booking.checked_in THEN
    RETURN '{"error": "Already checked in"}'::JSONB;
  END IF;

  -- P1-05: Only allow confirmed (admin-verified) payments
  IF v_booking.payment_status != 'confirmed' THEN
    RETURN '{"error": "Payment not yet verified"}'::JSONB;
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = v_booking.session_id;

  IF NOT FOUND THEN
    RETURN '{"error": "Session not found"}'::JSONB;
  END IF;

  IF v_session.date != CURRENT_DATE THEN
    RETURN '{"error": "Session is not today"}'::JSONB;
  END IF;

  IF CURRENT_TIME < (v_session.start_time - interval '30 minutes') THEN
    RETURN '{"error": "Too early to check in"}'::JSONB;
  END IF;

  IF CURRENT_TIME > v_session.end_time THEN
    RETURN '{"error": "Session has ended"}'::JSONB;
  END IF;

  UPDATE bookings
  SET checked_in = TRUE, checked_in_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'checked_in_at', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P1-19: Payment state machine — prevent backward status transitions
CREATE OR REPLACE FUNCTION enforce_payment_state_machine()
RETURNS TRIGGER AS $$
BEGIN
  -- Cannot change from confirmed except to refunded
  IF OLD.payment_status = 'confirmed' AND NEW.payment_status NOT IN ('confirmed', 'refunded') THEN
    RAISE EXCEPTION 'Cannot change from confirmed except to refunded';
  END IF;
  -- Cannot change status of cancelled booking
  IF OLD.payment_status = 'cancelled' AND NEW.payment_status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of cancelled booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_state_check ON bookings;
CREATE TRIGGER payment_state_check
  BEFORE UPDATE OF payment_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_payment_state_machine();

-- P1-27: Restrict get_user_stats to own user only
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE(
  sessions_completed BIGINT,
  unique_coworkers BIGINT,
  venues_visited BIGINT,
  avg_rating_received NUMERIC,
  hours_focused NUMERIC,
  member_since TIMESTAMPTZ
) AS $$
BEGIN
  -- P1-27: Only allow viewing own stats
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot view other users stats';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.user_id = p_user_id AND b.checked_in = true AND b.cancelled_at IS NULL
    ) AS sessions_completed,
    (SELECT count(DISTINCT gm2.user_id) FROM group_members gm1
     JOIN group_members gm2 ON gm1.group_id = gm2.group_id AND gm1.user_id != gm2.user_id
     WHERE gm1.user_id = p_user_id
    ) AS unique_coworkers,
    (SELECT count(DISTINCT s.venue_id) FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.user_id = p_user_id AND b.checked_in = true
    ) AS venues_visited,
    (SELECT COALESCE(avg(CASE WHEN mr.would_cowork_again THEN 5.0 ELSE 2.0 END), 0)
     FROM member_ratings mr WHERE mr.to_user = p_user_id
    ) AS avg_rating_received,
    (SELECT COALESCE(sum(s.duration_hours), 0) FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     WHERE b.user_id = p_user_id AND b.checked_in = true
    ) AS hours_focused,
    (SELECT p.created_at FROM profiles p WHERE p.id = p_user_id
    ) AS member_since;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P1-27b: Restrict compute_coworker_score to own user only
CREATE OR REPLACE FUNCTION compute_coworker_score(p_user_id UUID)
RETURNS TABLE(
  score NUMERIC,
  attendance NUMERIC,
  cowork_again_rate NUMERIC,
  avg_energy NUMERIC,
  session_score NUMERIC,
  streak_score NUMERIC,
  feedback_score NUMERIC,
  total_ratings BIGINT,
  sessions_completed BIGINT
) AS $$
DECLARE
  v_attendance NUMERIC := 0;
  v_cowork NUMERIC := 0;
  v_energy NUMERIC := 0;
  v_sessions NUMERIC := 0;
  v_streak NUMERIC := 0;
  v_feedback NUMERIC := 0;
  v_total_ratings BIGINT := 0;
  v_sessions_count BIGINT := 0;
  v_total_bookings BIGINT := 0;
  v_checked_in BIGINT := 0;
  v_cowork_yes BIGINT := 0;
  v_cowork_total BIGINT := 0;
  v_avg_energy_val NUMERIC := 0;
  v_current_streak INTEGER := 0;
  v_feedback_count BIGINT := 0;
BEGIN
  -- P1-27b: Only allow viewing own score
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot view other users score';
  END IF;

  -- Attendance reliability (weight: 0.25)
  SELECT count(*), count(*) FILTER (WHERE checked_in = true)
  INTO v_total_bookings, v_checked_in
  FROM bookings WHERE user_id = p_user_id AND cancelled_at IS NULL AND payment_status = 'confirmed';

  IF v_total_bookings > 0 THEN
    v_attendance := (v_checked_in::NUMERIC / v_total_bookings) * 5.0;
  END IF;

  -- Would cowork again rate (weight: 0.25)
  SELECT count(*), count(*) FILTER (WHERE would_cowork_again = true)
  INTO v_cowork_total, v_cowork_yes
  FROM member_ratings WHERE to_user = p_user_id;
  v_total_ratings := v_cowork_total;

  IF v_cowork_total > 0 THEN
    v_cowork := (v_cowork_yes::NUMERIC / v_cowork_total) * 5.0;
  END IF;

  -- Average energy match (weight: 0.15)
  SELECT COALESCE(avg(energy_match), 0)
  INTO v_avg_energy_val
  FROM member_ratings WHERE to_user = p_user_id AND energy_match IS NOT NULL;
  v_energy := v_avg_energy_val;

  -- Sessions completed score (weight: 0.15, capped at 50)
  v_sessions_count := v_checked_in;
  v_sessions := LEAST(v_sessions_count::NUMERIC / 50.0, 1.0) * 5.0;

  -- Streak consistency (weight: 0.10, capped at 10 weeks)
  SELECT COALESCE(current_streak, 0) INTO v_current_streak
  FROM user_streaks WHERE user_id = p_user_id;
  v_streak := LEAST(v_current_streak::NUMERIC / 10.0, 1.0) * 5.0;

  -- Feedback quality (weight: 0.10)
  SELECT count(*) INTO v_feedback_count
  FROM session_feedback WHERE user_id = p_user_id AND comment IS NOT NULL AND comment != '';
  v_feedback := LEAST(v_feedback_count::NUMERIC / 10.0, 1.0) * 5.0;

  -- Compute weighted score
  score := (v_attendance * 0.25) + (v_cowork * 0.25) + (v_energy * 0.15) +
           (v_sessions * 0.15) + (v_streak * 0.10) + (v_feedback * 0.10);

  RETURN QUERY SELECT
    score,
    v_attendance AS attendance,
    v_cowork AS cowork_again_rate,
    v_energy AS avg_energy,
    v_sessions AS session_score,
    v_streak AS streak_score,
    v_feedback AS feedback_score,
    v_total_ratings AS total_ratings,
    v_sessions_count AS sessions_completed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P1-17b: Referral max_uses column
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 20;
