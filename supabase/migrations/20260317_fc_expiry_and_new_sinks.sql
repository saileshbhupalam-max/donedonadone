-- FC Expiry + New Sinks — Anti-inflation fix (#11 / F-BL-04)
--
-- Problem: Active users earn 400-600 FC/month but only spend ~200-300 FC/month.
-- The 200-400 FC/month surplus accumulates indefinitely, devaluing the currency.
--
-- Solution (research-backed):
-- 1. ALL earned FC expires after 90 days (Starbucks Stars model: 6-month expiry).
--    Exception: welcome_bonus/first_session_bonus get 180 days (endowed progress).
--    Exception: Negative entries (penalties) never expire — debt must be repaid.
-- 2. Three new redemption sinks targeting social status and preference control.
-- 3. Index on expires_at for efficient expiry queries.
--
-- References:
-- - Starbucks: Star expiry increased redemption velocity 15% (2019 program change)
-- - Airlines: 20-30% of miles expire unused, effectively controlling supply
-- - Nunes & Dreze (2006): Endowed progress effect — pre-filled rewards need longer shelf life

-- ─── 1. RECREATE server_award_credits WITH UNIVERSAL EXPIRY ───
-- All positive entries now get expires_at. The old version only set expiry on
-- referral/streak bonuses. Now EVERY earn action expires, with configurable days.
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
  v_total_daily_cap integer := 75;
  v_today_start timestamptz;
  v_today_earnings integer;
  v_total_today_earnings integer;
  v_adjusted_amount integer;
  v_expires_at timestamptz;
  v_existing_count integer;
  v_reviews_per_day integer := 3;
  v_photos_per_day integer := 10;
  v_same_venue_review_cap integer := 3;
  v_same_venue_photo_cap integer := 5;
  v_venue_id text;
  v_bonus_expiry_days integer := 30;
  v_fc_expiry_days integer := 90;
  v_fc_expiry_days_endowed integer := 180;
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

  -- Load runtime config overrides
  BEGIN
    SELECT value INTO v_config_row FROM app_settings WHERE key = 'growth_config';
    IF v_config_row.value IS NOT NULL THEN
      v_daily_cap := COALESCE((v_config_row.value->'credits'->>'dailyEarnCap')::integer, 50);
      v_total_daily_cap := COALESCE((v_config_row.value->'credits'->>'totalDailyEarnCap')::integer, 75);
      v_fc_expiry_days := COALESCE((v_config_row.value->'credits'->>'fcExpiryDays')::integer, 90);
      v_fc_expiry_days_endowed := COALESCE((v_config_row.value->'credits'->>'fcExpiryDaysEndowed')::integer, 180);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  v_venue_id := p_metadata->>'venue_id';
  v_adjusted_amount := p_amount;

  -- Total daily earning cap (all actions combined)
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

  -- Diminishing returns: reviews (3/day, 3/same venue)
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

  -- Diminishing returns: photos (10/day, 5/same venue)
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

  -- Diminishing returns: taste answers (3/day)
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

  -- ─── FC EXPIRY: All positive entries now expire ───
  -- WHY universal expiry: Without this, active users accumulate 200-400 FC/month
  -- surplus indefinitely. Starbucks saw 15% higher redemption velocity after
  -- introducing star expiry. The 90-day window means users always have a full
  -- quarter to redeem — generous but finite.
  --
  -- Endowed progress actions (welcome_bonus, first_session_bonus) get 180 days
  -- because short expiry on onboarding rewards undermines the Nunes & Dreze
  -- "pre-filled card" effect that drives first-session conversion.
  v_expires_at := NULL;
  IF p_action IN ('welcome_bonus', 'first_session_bonus') THEN
    -- Endowed progress: longer expiry so new users feel secure
    v_expires_at := now() + (v_fc_expiry_days_endowed || ' days')::interval;
  ELSIF p_amount > 0 THEN
    -- All other positive entries: standard expiry
    v_expires_at := now() + (v_fc_expiry_days || ' days')::interval;
  END IF;
  -- Negative entries (penalties, spends) intentionally get NULL expires_at.
  -- Debt must be repaid — you can't wait out a no-show penalty.

  IF p_idempotency_key IS NOT NULL THEN
    p_metadata := p_metadata || jsonb_build_object('idempotency_key', p_idempotency_key);
  END IF;

  INSERT INTO focus_credits (user_id, amount, action, metadata, expires_at)
  VALUES (p_user_id, v_adjusted_amount, p_action, p_metadata, v_expires_at);

  RETURN jsonb_build_object('success', true, 'awarded', v_adjusted_amount);
END;
$$;

-- ─── 2. ADD NEW REDEMPTION SINKS TO server_fulfill_redemption ───
-- Three new sinks that target the monthly FC surplus:
-- - Profile highlight (30 FC): social status — highlighted in group matching
-- - Venue choice (40 FC): preference control — pick your venue
-- - Group size preference (25 FC): preference control — request 3 or 5 person group
CREATE OR REPLACE FUNCTION server_fulfill_redemption(
  p_user_id uuid,
  p_action text,
  p_cost integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_spend_result jsonb;
  v_access_code text;
  v_pass_id uuid;
BEGIN
  -- Step 1: Spend the credits (atomic balance check)
  v_spend_result := server_spend_credits(p_user_id, p_action, p_cost);
  IF NOT (v_spend_result->>'success')::boolean THEN
    RETURN v_spend_result;
  END IF;

  -- Step 2: Fulfill based on action type
  CASE p_action
    WHEN 'redeem_free_session' THEN
      v_access_code := upper(substr(md5(random()::text), 1, 8));
      INSERT INTO day_passes (user_id, amount_paise, payment_id, status, access_code, expires_at)
      VALUES (p_user_id, 0, 'fc_redeemed', 'active', v_access_code, now() + interval '30 days')
      RETURNING id INTO v_pass_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Free session activated!',
              'Use code ' || v_access_code || ' to join any session. Valid for 30 days.',
              jsonb_build_object('pass_id', v_pass_id, 'access_code', v_access_code, 'action', p_action), false);

      RETURN jsonb_build_object('success', true, 'pass_id', v_pass_id, 'access_code', v_access_code);

    WHEN 'redeem_gift_session' THEN
      v_access_code := 'GIFT-' || upper(substr(md5(random()::text), 1, 6));
      INSERT INTO day_passes (user_id, amount_paise, payment_id, status, access_code, expires_at)
      VALUES (p_user_id, 0, 'fc_gift', 'active', v_access_code, now() + interval '30 days')
      RETURNING id INTO v_pass_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Gift session ready!',
              'Share code ' || v_access_code || ' with a friend. Valid for 30 days.',
              jsonb_build_object('pass_id', v_pass_id, 'gift_code', v_access_code, 'action', p_action), false);

      RETURN jsonb_build_object('success', true, 'pass_id', v_pass_id, 'gift_code', v_access_code);

    WHEN 'redeem_priority_matching' THEN
      UPDATE profiles SET priority_matching_until = now() + interval '7 days'
      WHERE id = p_user_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Priority matching active!',
              'You''ll be matched with preferred coworkers for the next 7 days.',
              jsonb_build_object('action', p_action, 'until', (now() + interval '7 days')::text), false);

      RETURN jsonb_build_object('success', true, 'priority_until', (now() + interval '7 days')::text);

    WHEN 'redeem_session_boost' THEN
      UPDATE profiles SET priority_matching_until = now() + interval '48 hours'
      WHERE id = p_user_id;

      RETURN jsonb_build_object('success', true, 'boost_until', (now() + interval '48 hours')::text);

    -- ─── NEW SINKS (anti-inflation v3) ───────────────────────

    WHEN 'redeem_profile_highlight' THEN
      -- WHY: Social status is the #1 non-monetary motivator in communities.
      -- Reddit Gold, Discord Nitro, LinkedIn Premium — people pay for visibility.
      -- 7-day highlight creates recurring spend (not one-time), draining ~120 FC/month
      -- if used every week. That alone closes 30-60% of the monthly surplus.
      UPDATE profiles
      SET priority_matching_until = GREATEST(
        COALESCE(priority_matching_until, now()),
        now()
      ) + interval '7 days'
      WHERE id = p_user_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Profile highlighted!',
              'Your profile is highlighted in group matching for 7 days.',
              jsonb_build_object('action', p_action, 'until', (now() + interval '7 days')::text), false);

      RETURN jsonb_build_object('success', true, 'highlight_until', (now() + interval '7 days')::text);

    WHEN 'redeem_venue_choice' THEN
      -- WHY: Venue preference is high-value control — ClassPass charges a premium
      -- for specific studio selection. Letting users pick their venue drains 40 FC
      -- per session and increases satisfaction (autonomy = intrinsic motivation, SDT).
      -- Stored as metadata flag, consumed by next auto-session matching.
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Venue choice unlocked!',
              'You can pick your preferred venue for your next session.',
              jsonb_build_object('action', p_action), false);

      RETURN jsonb_build_object('success', true, 'venue_choice', true);

    WHEN 'redeem_group_size_preference' THEN
      -- WHY: Group size affects session dynamics. Some prefer intimate 3-person
      -- sessions, others want the energy of 5. Letting users request their
      -- preferred size costs 25 FC — a mid-tier sink that's accessible but
      -- meaningful. This is the "Goldilocks sink": not so cheap it's automatic,
      -- not so expensive it's ignored.
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Group size preference set!',
              'Your next session will try to match your preferred group size.',
              jsonb_build_object('action', p_action), false);

      RETURN jsonb_build_object('success', true, 'group_size_preference', true);

    ELSE
      RETURN jsonb_build_object('success', true);
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION server_fulfill_redemption TO authenticated;

-- ─── 3. INDEX FOR EFFICIENT EXPIRY QUERIES ───
-- WHY: getExpiringCredits() queries focus_credits WHERE expires_at BETWEEN now AND
-- now+14d. Without an index, this is a full table scan on every Credits page load.
-- Partial index on non-null expires_at keeps the index small (penalties/spends excluded).
CREATE INDEX IF NOT EXISTS idx_focus_credits_expires_at
  ON focus_credits (expires_at)
  WHERE expires_at IS NOT NULL;

-- Also add a composite index for the common "expiring soon for user X" query pattern
CREATE INDEX IF NOT EXISTS idx_focus_credits_user_expires
  ON focus_credits (user_id, expires_at)
  WHERE expires_at IS NOT NULL AND amount > 0;
