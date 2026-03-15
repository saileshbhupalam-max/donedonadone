-- Fix 4 remaining HIGH-priority issues from the audit
--
-- H3: Streak freeze permanent block — purchaseStreakFreeze() counts ALL historical
--     freeze purchases, so after 2 lifetime purchases the user can never buy again.
-- H4: Zero-balance penalty evasion — spendCredits() rejects when balance < amount,
--     so users with 0 FC are immune to no-show/late-cancel penalties.
-- H5: Idempotency TOCTOU — server_award_credits checks idempotency_key with
--     SELECT COUNT then INSERT; two concurrent requests can both pass the check.
-- H8: Double 30 FC on venue nomination + activation — nominator gets 30 FC at
--     nomination time AND 30 FC again when venue activates.

-- ═══════════════════════════════════════════════════════════
-- H3: STREAK FREEZE PERMANENT BLOCK
-- ═══════════════════════════════════════════════════════════
-- BUG: purchaseStreakFreeze() in focusCredits.ts queries ALL streak_freeze_purchase
-- entries ever created for the user. Since the maxFreezes cap is 2, once a user
-- has bought 2 freezes across their entire account lifetime, the check
-- `currentFreezes >= config.maxFreezes` permanently blocks further purchases.
-- Freezes are never "consumed" or removed from the ledger — they're just negative
-- FC entries with action='streak_freeze_purchase'.
--
-- FIX: Create an RPC that only counts freezes purchased in the last 7 days.
-- This gives a rolling window of "one freeze purchase per week" — once a week
-- passes, old freezes no longer count against the cap and the user can buy again.
-- The client should call this RPC instead of doing the raw SELECT.
--
-- WHY 7 DAYS: Weekly cadence matches the streak system (weekly streaks, not daily).
-- A freeze protects one missed week, so capping at 2 per week is generous enough.
--
-- WHAT BREAKS IF REVERTED: Users who have ever bought 2 freezes in their lifetime
-- will be permanently locked out of buying more, even months later. This defeats
-- the purpose of streak freezes as an ongoing retention tool.

CREATE OR REPLACE FUNCTION user_count_active_streak_freezes(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only count freezes purchased in the last 7 days (rolling window).
  -- Older freezes have already "expired" from the cap perspective —
  -- they protected a past week and should not block future purchases.
  SELECT COUNT(*) INTO v_count
  FROM focus_credits
  WHERE user_id = p_user_id
    AND action = 'streak_freeze_purchase'
    AND created_at >= now() - interval '7 days';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION user_count_active_streak_freezes TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- H4: ZERO-BALANCE PENALTY EVASION
-- ═══════════════════════════════════════════════════════════
-- BUG: penalizeNoShow() and penalizeLateCancel() call spendCredits(), which calls
-- server_spend_credits(). That function checks `IF v_balance < p_amount THEN
-- RETURN insufficient_balance`. A user with 0 FC balance gets 'insufficient_balance'
-- and the penalty silently fails. This means:
--   1. Users can no-show with impunity as long as they spend all their FC first.
--   2. Serial offenders who already hit 0 from previous penalties are immune.
--   3. The "Kahneman loss aversion" design is completely bypassed.
--
-- FIX: Create server_penalize_user() which inserts a negative FC entry WITHOUT
-- checking balance. The user's balance goes negative — they must earn FC back
-- before they can spend on anything (redemptions, freezes, etc). This is the
-- correct behavior: penalties are NOT voluntary purchases.
--
-- Only penalty actions are allowed (whitelist) to prevent abuse.
--
-- WHAT BREAKS IF REVERTED: Any user with 0 balance becomes immune to all
-- penalties. No-show and late-cancel consequences stop working entirely
-- for the most problematic users (who tend to have low/zero balances).

CREATE OR REPLACE FUNCTION server_penalize_user(
  p_user_id uuid,
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- Advisory lock prevents concurrent penalty insertion for same user
  -- (same pattern as server_spend_credits for consistency)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- WHITELIST: Only allow known penalty actions. This RPC bypasses balance
  -- checks, so we must ensure it can't be abused to drain arbitrary FC.
  IF p_action NOT IN ('no_show_penalty', 'late_cancel_penalty') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_penalty_action',
      'detail', 'Only no_show_penalty and late_cancel_penalty are allowed'
    );
  END IF;

  -- Reject non-positive amounts (sanity check)
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  -- Insert negative amount directly — NO balance check.
  -- This allows the user's balance to go negative. They must earn FC back
  -- before they can redeem or purchase anything (spend functions still check).
  INSERT INTO focus_credits (user_id, amount, action, metadata)
  VALUES (p_user_id, -p_amount, p_action, p_metadata);

  -- Return the new balance so the caller can inform the user
  SELECT COALESCE(SUM(amount), 0) INTO v_new_balance
  FROM focus_credits
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now());

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- user_penalize_self: client-callable wrapper that uses auth.uid()
-- The client calls this instead of server_penalize_user directly.
-- server_penalize_user is SECURITY DEFINER (no RLS) and should not
-- be directly exposed to authenticated users — only through this wrapper
-- which binds the penalty to the calling user's own account.
CREATE OR REPLACE FUNCTION user_penalize_self(
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Delegate to server function with the authenticated user's ID.
  -- The server function handles action whitelist + advisory lock.
  RETURN server_penalize_user(auth.uid(), p_action, p_amount, p_metadata);
END;
$$;

-- Only the wrapper is callable by authenticated users.
-- server_penalize_user stays internal (SECURITY DEFINER, no GRANT to authenticated).
GRANT EXECUTE ON FUNCTION user_penalize_self TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- H5: IDEMPOTENCY TOCTOU (Time-of-Check Time-of-Use)
-- ═══════════════════════════════════════════════════════════
-- BUG: server_award_credits() checks idempotency like this:
--   SELECT COUNT(*) ... WHERE metadata->>'idempotency_key' = p_idempotency_key
--   IF v_existing_count > 0 THEN RETURN 'duplicate_request'
--   ...
--   INSERT INTO focus_credits ...
--
-- Two concurrent requests with the same idempotency_key can BOTH pass the
-- SELECT COUNT (seeing 0) before either INSERT completes. Both inserts succeed,
-- awarding double FC. This is a classic TOCTOU race condition.
--
-- FIX: Add a unique partial index on (user_id, action, idempotency_key).
-- The INSERT will fail with unique_violation if a duplicate arrives concurrently.
-- The existing EXCEPTION handler in server_award_credits can catch this, and
-- even without explicit handling, Postgres will reject the duplicate INSERT
-- and the transaction will fail cleanly (no double-award).
--
-- We use a partial index (WHERE ... IS NOT NULL) because most FC entries
-- don't have an idempotency_key and we don't want to waste index space on NULLs.
--
-- WHAT BREAKS IF REVERTED: Under concurrent load, the same idempotency_key
-- can result in duplicate FC awards. Every session_complete, streak_bonus,
-- mystery_double, and venue nomination could potentially double-pay.

CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_credits_idempotency
  ON focus_credits (user_id, action, (metadata->>'idempotency_key'))
  WHERE metadata->>'idempotency_key' IS NOT NULL;


-- ═══════════════════════════════════════════════════════════
-- H8: DOUBLE 30 FC ON VENUE NOMINATION + ACTIVATION
-- ═══════════════════════════════════════════════════════════
-- BUG: The nominator receives 30 FC twice for the same venue:
--   1. At nomination time: venueNomination.ts:154 calls awardCredits('add_new_venue', 30)
--   2. At activation time: server_activate_venue() calls server_award_credits(
--      nominated_by, 'add_new_venue', 30, {activation_bonus: true})
--
-- This means every successful venue nomination awards 60 FC instead of 30.
-- The activation award was added assuming the nomination award didn't exist,
-- but both code paths survived across migrations.
--
-- FIX: Remove the server_award_credits call from server_activate_venue().
-- The nominator already got their 30 FC at nomination time — that's the correct
-- single point of award. The activation step should only handle location creation
-- and status updates.
--
-- NOTE: We use the critical_fixes version (20260315_critical_fixes.sql line 41)
-- as the base because it has the correct column list for INSERT INTO locations.
-- The server_side_business_logic version references columns (address, wifi_available,
-- google_maps_url) that may not exist on the locations table.
--
-- WHAT BREAKS IF REVERTED: Every venue activation double-awards 30 FC. Over time
-- this inflates the FC economy — nominators get 60 FC per venue instead of 30,
-- which undermines the carefully tuned daily caps and earning rates.

CREATE OR REPLACE FUNCTION server_activate_venue(p_nomination_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nomination record;
  v_location_id uuid;
BEGIN
  SELECT * INTO v_nomination FROM venue_nominations WHERE id = p_nomination_id;
  IF v_nomination IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'nomination_not_found');
  END IF;
  IF v_nomination.location_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_activated');
  END IF;

  -- Create the location entry from nomination data
  INSERT INTO locations (name, neighborhood, latitude, longitude, location_type, photo_url)
  VALUES (
    v_nomination.venue_name,
    v_nomination.neighborhood,
    v_nomination.latitude,
    v_nomination.longitude,
    'cafe',
    v_nomination.photo_url
  )
  RETURNING id INTO v_location_id;

  -- Link nomination to the new location and mark as active
  UPDATE venue_nominations
  SET location_id = v_location_id, status = 'active', activated_at = now()
  WHERE id = p_nomination_id;

  -- Refresh neighborhood stats (venue count, unlock status)
  PERFORM update_neighborhood_stats(v_nomination.neighborhood);

  -- REMOVED: The duplicate 30 FC award that was here.
  -- The nominator already received 30 FC at nomination time via
  -- venueNomination.ts → awardCredits('add_new_venue', 30).
  -- Awarding again here was double-counting — see H8 above.

  RETURN jsonb_build_object('success', true, 'location_id', v_location_id);
END;
$$;
