-- Fix check_block_escalation() to use user_type = 'admin' instead of is_admin = true
--
-- The profiles table has no is_admin column. Admin status is stored as
-- user_type = 'admin'. The original migration 20260316_fix_block_escalation_and_flags.sql
-- used p.is_admin = true which would silently return no rows, meaning admins
-- never received block-escalation notifications.

CREATE OR REPLACE FUNCTION public.check_block_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block_count INT;
  v_display_name TEXT;
  v_already_flagged BOOLEAN;
  v_reasons TEXT;
BEGIN
  -- Skip personal preference blocks — they don't count toward escalation
  IF NEW.reason LIKE '[personal]%' THEN
    RETURN NEW;
  END IF;

  -- Count only safety blocks (exclude personal preference)
  SELECT COUNT(DISTINCT blocker_id) INTO v_block_count
  FROM member_blocks
  WHERE blocked_id = NEW.blocked_id
    AND (reason IS NULL OR reason NOT LIKE '[personal]%');

  SELECT display_name INTO v_display_name
  FROM profiles WHERE id = NEW.blocked_id;

  -- Aggregate safety block reasons for admin context
  SELECT string_agg(DISTINCT reason, ', ')
  INTO v_reasons
  FROM member_blocks
  WHERE blocked_id = NEW.blocked_id
    AND reason IS NOT NULL
    AND reason NOT LIKE '[personal]%';

  -- 5+ unique safety blockers → auto-suspend
  IF v_block_count >= 5 THEN
    UPDATE profiles
    SET suspended_until = '2099-12-31T23:59:59Z'::timestamptz,
        suspension_reason = 'Auto-suspended: blocked by ' || v_block_count || ' members for safety concerns'
    WHERE id = NEW.blocked_id
      AND (suspended_until IS NULL OR suspended_until < now());

    -- Notify admins (use user_type, not is_admin)
    INSERT INTO notifications (user_id, type, title, body, data, read)
    SELECT p.id, 'admin_alert',
      'Account auto-suspended',
      'Member "' || COALESCE(v_display_name, 'Unknown') || '" blocked by '
        || v_block_count || ' people. Reasons: ' || COALESCE(v_reasons, 'none specified')
        || '. Auto-suspended.',
      jsonb_build_object('blocked_user_id', NEW.blocked_id, 'block_count', v_block_count),
      false
    FROM profiles p
    WHERE p.user_type = 'admin';

    -- Also resolve any pending flags
    UPDATE member_flags
    SET resolved_at = now(), resolution = 'suspended'
    WHERE flagged_user = NEW.blocked_id AND resolved_at IS NULL;

  -- 3+ unique safety blockers → flag for admin review
  ELSIF v_block_count >= 3 THEN
    SELECT EXISTS (
      SELECT 1 FROM member_flags
      WHERE flagged_user = NEW.blocked_id
        AND reason = 'auto_block_escalation'
        AND resolved_at IS NULL
    ) INTO v_already_flagged;

    IF NOT v_already_flagged THEN
      INSERT INTO member_flags (flagged_user, flagged_by, reason, notes)
      VALUES (
        NEW.blocked_id,
        NEW.blocker_id,
        'auto_block_escalation',
        'Blocked by ' || v_block_count || ' members. Reasons: ' || COALESCE(v_reasons, 'none specified')
      );

      -- Notify admins (use user_type, not is_admin)
      INSERT INTO notifications (user_id, type, title, body, data, read)
      SELECT p.id, 'admin_alert',
        'Member flagged: multiple safety blocks',
        'Member "' || COALESCE(v_display_name, 'Unknown') || '" blocked by '
          || v_block_count || ' people. Reasons: ' || COALESCE(v_reasons, 'none specified')
          || '. Review recommended.',
        jsonb_build_object('blocked_user_id', NEW.blocked_id, 'block_count', v_block_count),
        false
      FROM profiles p
      WHERE p.user_type = 'admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
