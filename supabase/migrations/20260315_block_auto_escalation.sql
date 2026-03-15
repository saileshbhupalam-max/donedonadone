-- Auto-escalation when a user accumulates blocks from multiple people.
-- 3+ unique blockers → auto-flag for admin review (member_flags)
-- 5+ unique blockers → auto-suspend account (profiles.is_suspended)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_suspended BOOLEAN DEFAULT false;
  END IF;
END $$;

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
BEGIN
  SELECT COUNT(DISTINCT blocker_id) INTO v_block_count
  FROM member_blocks WHERE blocked_id = NEW.blocked_id;

  SELECT display_name INTO v_display_name
  FROM profiles WHERE id = NEW.blocked_id;

  IF v_block_count >= 5 THEN
    UPDATE profiles SET is_suspended = true WHERE id = NEW.blocked_id;
    INSERT INTO notifications (user_id, type, title, body, data, read)
    SELECT p.id, 'admin_alert',
      'Account auto-suspended',
      'Member "' || COALESCE(v_display_name, 'Unknown') || '" was blocked by ' || v_block_count || ' different people and has been auto-suspended.',
      jsonb_build_object('blocked_user_id', NEW.blocked_id, 'block_count', v_block_count), false
    FROM profiles p
    WHERE p.email IN (
      SELECT jsonb_array_elements_text(value::jsonb) FROM app_settings WHERE key = 'admin_emails'
    );
  ELSIF v_block_count >= 3 THEN
    SELECT EXISTS (
      SELECT 1 FROM member_flags WHERE flagged_user_id = NEW.blocked_id
      AND reason = 'auto_block_escalation' AND resolved_at IS NULL
    ) INTO v_already_flagged;
    IF NOT v_already_flagged THEN
      INSERT INTO member_flags (flagged_user_id, flagged_by, reason, details)
      VALUES (
        NEW.blocked_id, NEW.blocker_id, 'auto_block_escalation',
        'Blocked by ' || v_block_count || ' different members. Reasons: ' || (
          SELECT string_agg(DISTINCT reason, ', ') FROM member_blocks WHERE blocked_id = NEW.blocked_id AND reason IS NOT NULL
        )
      );
      INSERT INTO notifications (user_id, type, title, body, data, read)
      SELECT p.id, 'admin_alert',
        'Member flagged: multiple blocks',
        'Member "' || COALESCE(v_display_name, 'Unknown') || '" has been blocked by ' || v_block_count || ' different people. Review recommended.',
        jsonb_build_object('blocked_user_id', NEW.blocked_id, 'block_count', v_block_count), false
      FROM profiles p
      WHERE p.email IN (
        SELECT jsonb_array_elements_text(value::jsonb) FROM app_settings WHERE key = 'admin_emails'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_escalation ON public.member_blocks;
CREATE TRIGGER trg_block_escalation
  AFTER INSERT ON public.member_blocks
  FOR EACH ROW EXECUTE FUNCTION public.check_block_escalation();
