-- Audit fixes: #18 (payment_id type mismatch), #27 (unify suspension mechanism)
--
-- #18: day_passes.payment_id is UUID FK but server_fulfill_redemption inserts
--      text strings ('fc_redeemed', 'fc_gift') — crashes at runtime.
--      Fix: make payment_id nullable, use NULL for FC-redeemed passes.
--
-- #27: is_suspended column is legacy — all suspension now goes through suspended_until.
--      The block escalation trigger was already fixed to use suspended_until.
--      Migrate any is_suspended=true rows, then drop the column.

-- ─── #18: FIX payment_id — make nullable for FC-redeemed passes ───
ALTER TABLE day_passes ALTER COLUMN payment_id DROP NOT NULL;

-- Fix server_fulfill_redemption to use NULL instead of text strings for payment_id
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
      INSERT INTO day_passes (user_id, amount_paise, status, access_code, expires_at)
      VALUES (p_user_id, 0, 'active', v_access_code, now() + interval '30 days')
      RETURNING id INTO v_pass_id;

      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (p_user_id, 'redemption', 'Free session activated!',
              'Use code ' || v_access_code || ' to join any session. Valid for 30 days.',
              jsonb_build_object('pass_id', v_pass_id, 'access_code', v_access_code, 'action', p_action), false);

      RETURN jsonb_build_object('success', true, 'pass_id', v_pass_id, 'access_code', v_access_code);

    WHEN 'redeem_gift_session' THEN
      v_access_code := 'GIFT-' || upper(substr(md5(random()::text), 1, 6));
      INSERT INTO day_passes (user_id, amount_paise, status, access_code, expires_at)
      VALUES (p_user_id, 0, 'active', v_access_code, now() + interval '30 days')
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

    ELSE
      RETURN jsonb_build_object('success', true);
  END CASE;
END;
$$;

-- ─── #27: UNIFY SUSPENSION — migrate is_suspended to suspended_until ───
-- Any user with is_suspended=true but no suspended_until gets a far-future date
UPDATE profiles
SET suspended_until = '2099-12-31T23:59:59Z'::timestamptz,
    suspension_reason = COALESCE(suspension_reason, 'Auto-suspended: blocked by multiple members')
WHERE is_suspended = true
  AND (suspended_until IS NULL OR suspended_until < now());

-- Drop the legacy column — all code now uses suspended_until
ALTER TABLE profiles DROP COLUMN IF EXISTS is_suspended;
