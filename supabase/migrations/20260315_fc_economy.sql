-- Fix 2.1: FC Economy — tighter caps, wired redemptions, new sinks
--
-- 1. Lower total daily earning cap: 150 → 75 FC (configurable via app_settings)
-- 2. Add priority_matching_until column to profiles
-- 3. Create server_fulfill_redemption RPC (free session → day_pass, gift → code, priority → flag)
-- 4. Ensure day_passes.event_id is nullable (FC-redeemed passes aren't tied to a specific event)

-- ─── 1. TIGHTER CAPS: Recreate server_award_credits with lower total cap ───
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

  -- Load runtime config overrides (both caps now configurable)
  BEGIN
    SELECT value INTO v_config_row FROM app_settings WHERE key = 'growth_config';
    IF v_config_row.value IS NOT NULL THEN
      v_daily_cap := COALESCE((v_config_row.value->'credits'->>'dailyEarnCap')::integer, 50);
      v_total_daily_cap := COALESCE((v_config_row.value->'credits'->>'totalDailyEarnCap')::integer, 75);
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

  -- Diminishing returns: taste answers (3 answers/day = 6 FC/day at 2 FC each)
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

  -- Bonus credit expiry (referral + streak bonuses expire after 30 days)
  v_expires_at := NULL;
  IF p_action IN ('referral_complete', 'referral_milestone_3', 'streak_bonus') AND v_bonus_expiry_days > 0 THEN
    v_expires_at := now() + (v_bonus_expiry_days || ' days')::interval;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    p_metadata := p_metadata || jsonb_build_object('idempotency_key', p_idempotency_key);
  END IF;

  INSERT INTO focus_credits (user_id, amount, action, metadata, expires_at)
  VALUES (p_user_id, v_adjusted_amount, p_action, p_metadata, v_expires_at);

  RETURN jsonb_build_object('success', true, 'awarded', v_adjusted_amount);
END;
$$;

-- ─── 2. PRIORITY MATCHING COLUMN ───
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS priority_matching_until timestamptz;

-- ─── 3. ENSURE day_passes.event_id IS NULLABLE ───
-- FC-redeemed passes aren't tied to a specific event until the user RSVPs
ALTER TABLE day_passes ALTER COLUMN event_id DROP NOT NULL;

-- ─── 4. FULFILL REDEMPTION RPC ───
-- Atomically: spend FC + create the tangible result
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
      -- Create a day pass: user can use on any future session
      v_access_code := upper(substr(md5(random()::text), 1, 8));
      INSERT INTO day_passes (user_id, amount_paise, payment_id, status, access_code, expires_at)
      VALUES (p_user_id, 0, 'fc_redeemed', 'active', v_access_code, now() + interval '30 days')
      RETURNING id INTO v_pass_id;

      -- Notify user
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Free session activated!',
              'Use code ' || v_access_code || ' to join any session. Valid for 30 days.',
              jsonb_build_object('pass_id', v_pass_id, 'access_code', v_access_code, 'action', p_action), false);

      RETURN jsonb_build_object('success', true, 'pass_id', v_pass_id, 'access_code', v_access_code);

    WHEN 'redeem_gift_session' THEN
      -- Create a transferable gift pass
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
      -- Set priority matching flag for 7 days
      UPDATE profiles SET priority_matching_until = now() + interval '7 days'
      WHERE id = p_user_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Priority matching active!',
              'You''ll be matched with preferred coworkers for the next 7 days.',
              jsonb_build_object('action', p_action, 'until', (now() + interval '7 days')::text), false);

      RETURN jsonb_build_object('success', true, 'priority_until', (now() + interval '7 days')::text);

    WHEN 'redeem_session_boost' THEN
      -- Boost next RSVP priority (simple flag, cleared after next session)
      UPDATE profiles SET priority_matching_until = now() + interval '48 hours'
      WHERE id = p_user_id;

      RETURN jsonb_build_object('success', true, 'boost_until', (now() + interval '48 hours')::text);

    ELSE
      -- For other redemptions (venue_upgrade, pick_seat, exclusive_session)
      -- FC already spent; feature fulfillment wired as features are built
      RETURN jsonb_build_object('success', true);
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION server_fulfill_redemption TO authenticated;
