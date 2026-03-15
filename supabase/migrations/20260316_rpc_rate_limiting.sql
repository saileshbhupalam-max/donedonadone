-- LOW-3: RPC rate limiting
--
-- WHY: Without rate limiting, a malicious client can spam RPCs. Per-action caps
-- exist in user_award_credits (amount allowlist, daily caps) but a determined
-- attacker can still hammer the RPC 1000x/second, wasting DB resources and
-- potentially exploiting race conditions we haven't anticipated.
-- General-purpose rate limiting caps the blast radius of any abuse pattern.

-- ─── Rate limit tracking table ───────────────────────────
CREATE TABLE IF NOT EXISTS rpc_rate_limits (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid        NOT NULL,
  rpc_name    text        NOT NULL,
  called_at   timestamptz NOT NULL DEFAULT now()
);

-- WHY this index: check_rate_limit() queries by (user_id, rpc_name) filtered on
-- called_at within a recent window. The composite index makes that a fast range scan.
CREATE INDEX idx_rpc_rate_limits_lookup
  ON rpc_rate_limits (user_id, rpc_name, called_at DESC);

-- Enable RLS (convention: all tables use RLS)
ALTER TABLE rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct client access — only SECURITY DEFINER functions touch this table
-- (no SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated roles)

COMMENT ON TABLE rpc_rate_limits IS
  'Tracks per-user RPC call timestamps for rate limiting. Rows older than 1 hour are periodically cleaned up.';

-- ─── Helper function ─────────────────────────────────────
-- Returns TRUE if the call is allowed, FALSE if rate-limited.
-- Also records the call if allowed (atomic check-and-record).
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id       uuid,
  p_rpc_name      text,
  p_max_calls     integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  SELECT count(*)::integer INTO v_count
  FROM rpc_rate_limits
  WHERE user_id = p_user_id
    AND rpc_name = p_rpc_name
    AND called_at >= v_window_start;

  IF v_count >= p_max_calls THEN
    RETURN false;  -- Rate limited
  END IF;

  -- Record this call
  INSERT INTO rpc_rate_limits (user_id, rpc_name)
  VALUES (p_user_id, p_rpc_name);

  RETURN true;  -- Allowed
END;
$$;

COMMENT ON FUNCTION check_rate_limit IS
  'Atomic check-and-record rate limiter. Returns false if user exceeded p_max_calls within p_window_seconds.';

-- ─── Wire into user_award_credits (max 60 calls/minute) ──
-- WHY 60/min: Normal usage is ~5-10 credit awards per session (complete, rate,
-- review, photo). 60/min is 6x headroom for power users while stopping brute-force.
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
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Rate limit: 60 calls per 60 seconds
  SELECT check_rate_limit(auth.uid(), 'user_award_credits', 60, 60) INTO v_allowed;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'rate_limited');
  END IF;

  -- CRITICAL-2: Reject non-positive amounts
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'invalid_amount');
  END IF;

  -- CRITICAL-1: Per-action max amount allowlist
  v_max_amount := CASE p_action
    WHEN 'session_complete'        THEN 25
    WHEN 'rate_group'              THEN 12
    WHEN 'rate_venue'              THEN 12
    WHEN 'write_review'            THEN 35
    WHEN 'upload_photo'            THEN 12
    WHEN 'report_venue_info'       THEN 25
    WHEN 'health_check'            THEN 25
    WHEN 'nominate_venue'          THEN 35
    WHEN 'vouch_venue'             THEN 20
    WHEN 'referral_signup'         THEN 55
    WHEN 'referral_first_session'  THEN 105
    WHEN 'streak_bonus'            THEN 55
    WHEN 'welcome_bonus'           THEN 55
    ELSE 0
  END;

  IF v_max_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'unknown_action');
  END IF;

  IF p_amount > v_max_amount THEN
    p_amount := v_max_amount;
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM focus_credits
      WHERE user_id = auth.uid() AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'awarded', 0, 'reason', 'duplicate');
    END IF;
  END IF;

  INSERT INTO focus_credits (user_id, amount, action, metadata, idempotency_key)
  VALUES (auth.uid(), p_amount, p_action, p_metadata, p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'awarded', p_amount);
END;
$$;

-- ─── Wire into user_rsvp_to_event (max 10 calls/minute) ──
-- WHY 10/min: A user RSVPs to one event at a time. 10/min allows rapid
-- RSVP/cancel toggling but stops automated spam-booking of all sessions.
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
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- Rate limit: 10 calls per 60 seconds
  SELECT check_rate_limit(auth.uid(), 'user_rsvp_to_event', 10, 60) INTO v_allowed;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many requests. Please wait a moment.');
  END IF;

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
    RETURN jsonb_build_object('success', true, 'action', 'cancelled');
  END IF;

  SELECT count(*) INTO v_current_count
  FROM event_rsvps WHERE event_id = p_event_id AND status = 'going';

  IF v_max_spots IS NOT NULL AND v_current_count >= v_max_spots THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is full');
  END IF;

  INSERT INTO event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, auth.uid(), 'going')
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

  RETURN jsonb_build_object('success', true, 'action', 'rsvped');
END;
$$;

-- ─── Periodic cleanup ────────────────────────────────────
-- WHY 1 hour: Rate windows are max 60 seconds, so anything older than 1 hour
-- is dead weight. Cleanup keeps the table small and index scans fast.
CREATE OR REPLACE FUNCTION cleanup_rpc_rate_limits()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rpc_rate_limits WHERE called_at < now() - interval '1 hour';
$$;

COMMENT ON FUNCTION cleanup_rpc_rate_limits IS
  'Purge stale rate limit records. Call via pg_cron every 15-30 minutes.';

-- Schedule cleanup via pg_cron (runs every 15 minutes)
-- WHY 15 min: Frequent enough to keep the table under ~50k rows at peak,
-- infrequent enough to not add meaningful DB load.
SELECT cron.schedule(
  'cleanup-rpc-rate-limits',
  '*/15 * * * *',
  $$SELECT cleanup_rpc_rate_limits()$$
);
