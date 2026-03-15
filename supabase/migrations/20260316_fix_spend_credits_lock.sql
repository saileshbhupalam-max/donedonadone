-- Fix: Re-apply advisory lock to server_spend_credits
--
-- The advisory lock was added in 20260315_critical_fixes.sql to prevent
-- double-spend race conditions. However, 20260315_server_side_business_logic.sql
-- (which sorts AFTER critical_fixes alphabetically) does CREATE OR REPLACE on
-- the same function WITHOUT the lock, silently overwriting the fix.
--
-- This migration re-applies the advisory lock while preserving the full
-- function body from server_side_business_logic.sql.

CREATE OR REPLACE FUNCTION server_spend_credits(
  p_user_id uuid,
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Advisory lock prevents concurrent double-spend for same user
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

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
