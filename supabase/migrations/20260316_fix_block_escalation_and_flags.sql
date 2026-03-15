-- Fix block auto-escalation trigger + make member_flags compatible with auto-escalation inserts
--
-- Problems fixed:
-- 1. Trigger used wrong column names (flagged_user_id → flagged_user)
-- 2. Trigger set is_suspended instead of suspended_until (which ProtectedRoute actually checks)
-- 3. member_flags.session_id is NOT NULL but auto-escalation has no session
-- 4. member_flags.reason CHECK constraint doesn't allow 'auto_block_escalation'
-- 5. Trigger didn't skip [personal] blocks

-- Step 1: Make session_id nullable on member_flags (auto-escalation flags aren't tied to a session)
ALTER TABLE public.member_flags ALTER COLUMN session_id DROP NOT NULL;

-- Step 2: Drop the restrictive CHECK on reason and allow 'auto_block_escalation'
ALTER TABLE public.member_flags DROP CONSTRAINT IF EXISTS member_flags_reason_check;
ALTER TABLE public.member_flags ADD CONSTRAINT member_flags_reason_check
  CHECK (reason IN ('uncomfortable', 'disruptive', 'inappropriate', 'no_show_pattern', 'other', 'auto_block_escalation'));

-- Step 3: Fix the escalation trigger function
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

    -- Notify admins
    INSERT INTO notifications (user_id, type, title, body, data, read)
    SELECT p.id, 'admin_alert',
      'Account auto-suspended',
      'Member "' || COALESCE(v_display_name, 'Unknown') || '" blocked by '
        || v_block_count || ' people. Reasons: ' || COALESCE(v_reasons, 'none specified')
        || '. Auto-suspended.',
      jsonb_build_object('blocked_user_id', NEW.blocked_id, 'block_count', v_block_count),
      false
    FROM profiles p
    WHERE p.is_admin = true;

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

      -- Notify admins
      INSERT INTO notifications (user_id, type, title, body, data, read)
      SELECT p.id, 'admin_alert',
        'Member flagged: multiple safety blocks',
        'Member "' || COALESCE(v_display_name, 'Unknown') || '" blocked by '
          || v_block_count || ' people. Reasons: ' || COALESCE(v_reasons, 'none specified')
          || '. Review recommended.',
        jsonb_build_object('blocked_user_id', NEW.blocked_id, 'block_count', v_block_count),
        false
      FROM profiles p
      WHERE p.is_admin = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger (no change needed, just ensure it exists)
DROP TRIGGER IF EXISTS trg_block_escalation ON public.member_blocks;
CREATE TRIGGER trg_block_escalation
  AFTER INSERT ON public.member_blocks
  FOR EACH ROW EXECUTE FUNCTION public.check_block_escalation();
