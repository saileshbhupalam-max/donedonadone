-- Critical fixes from cross-audit synthesis (top 30 failure points)
-- #2: notifications missing data column
-- #5: server_spend_credits double-spend via advisory lock
-- #6: server_activate_venue non-existent columns
-- #7: check_block_escalation wrong column names

-- ─── #2: ADD data COLUMN TO notifications ───
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- ─── #5: FIX server_spend_credits WITH ADVISORY LOCK ───
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
  -- Advisory lock prevents concurrent double-spend for same user
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM focus_credits
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now());

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'awarded', 0, 'reason', 'insufficient_balance');
  END IF;

  INSERT INTO focus_credits (user_id, amount, action, metadata)
  VALUES (p_user_id, -p_amount, p_action, p_metadata);

  RETURN jsonb_build_object('success', true, 'awarded', p_amount);
END;
$$;

-- ─── #6: FIX server_activate_venue — remove non-existent columns ───
CREATE OR REPLACE FUNCTION server_activate_venue(p_nomination_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  UPDATE venue_nominations
  SET location_id = v_location_id, status = 'active', activated_at = now()
  WHERE id = p_nomination_id;

  -- Update neighborhood stats
  PERFORM update_neighborhood_stats(v_nomination.neighborhood);

  -- Award bonus FC to nominator
  PERFORM server_award_credits(v_nomination.nominated_by, 'add_new_venue', 30,
    jsonb_build_object('venue_id', v_location_id, 'activation_bonus', true));

  RETURN jsonb_build_object('success', true, 'location_id', v_location_id);
END;
$$;

-- ─── #7: FIX check_block_escalation — correct column names ───
-- Make session_id nullable for system-generated flags
ALTER TABLE member_flags ALTER COLUMN session_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION check_block_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_block_count integer;
  v_unique_blockers integer;
BEGIN
  -- Count how many unique people have blocked this user
  SELECT COUNT(DISTINCT blocker_id) INTO v_unique_blockers
  FROM member_blocks
  WHERE blocked_id = NEW.blocked_id;

  -- 3+ unique blockers = auto-escalate
  IF v_unique_blockers >= 3 THEN
    -- Check if already flagged by system
    SELECT COUNT(*) INTO v_block_count
    FROM member_flags
    WHERE flagged_user = NEW.blocked_id
      AND reason = 'auto_block_escalation';

    IF v_block_count = 0 THEN
      INSERT INTO member_flags (flagged_user, flagged_by, reason, notes)
      VALUES (NEW.blocked_id, NEW.blocker_id,
              'auto_block_escalation',
              v_unique_blockers || ' unique users have blocked this member');

      -- Suspend user
      UPDATE profiles SET suspended_until = now() + interval '7 days'
      WHERE id = NEW.blocked_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
