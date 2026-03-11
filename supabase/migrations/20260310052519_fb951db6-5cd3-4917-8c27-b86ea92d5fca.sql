
-- Part 1: Add resolution columns to member_flags
ALTER TABLE public.member_flags ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.member_flags ADD COLUMN IF NOT EXISTS resolution text;

-- Part 2: Add suspension columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_until timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Part 3: RLS - Only admins can update resolved_at/resolution on member_flags
CREATE POLICY "Admin can update flags"
ON public.member_flags
FOR UPDATE
TO public
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));

-- Part 4: Update prevent_system_column_changes to also protect suspension columns
CREATE OR REPLACE FUNCTION public.prevent_system_column_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  ) THEN
    NEW.user_type := OLD.user_type;
    NEW.reliability_status := OLD.reliability_status;
    NEW.no_show_count := OLD.no_show_count;
    NEW.sessions_rsvpd := OLD.sessions_rsvpd;
    NEW.sessions_showed_up := OLD.sessions_showed_up;
    NEW.captain_sessions := OLD.captain_sessions;
    NEW.focus_hours := OLD.focus_hours;
    NEW.is_table_captain := OLD.is_table_captain;
    NEW.current_streak := OLD.current_streak;
    NEW.events_attended := OLD.events_attended;
    NEW.events_no_show := OLD.events_no_show;
    NEW.focus_rank := OLD.focus_rank;
    NEW.profile_completion := OLD.profile_completion;
    NEW.suspended_until := OLD.suspended_until;
    NEW.suspension_reason := OLD.suspension_reason;
  END IF;
  RETURN NEW;
END;
$function$;

-- Part 5: Auto-escalation trigger function
CREATE OR REPLACE FUNCTION public.check_flag_auto_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unique_flaggers integer;
  v_unique_sessions integer;
  v_display_name text;
  v_admin RECORD;
BEGIN
  -- Count distinct flaggers and sessions for unresolved flags
  SELECT COUNT(DISTINCT flagged_by), COUNT(DISTINCT session_id)
  INTO v_unique_flaggers, v_unique_sessions
  FROM member_flags
  WHERE flagged_user = NEW.flagged_user AND resolved_at IS NULL;

  -- Get display name
  SELECT display_name INTO v_display_name FROM profiles WHERE id = NEW.flagged_user;

  -- Auto-suspend: 3+ unique flaggers OR 3+ sessions
  IF v_unique_flaggers >= 3 OR v_unique_sessions >= 3 THEN
    UPDATE profiles SET
      suspended_until = now() + interval '7 days',
      suspension_reason = 'Auto-suspended due to multiple community reports'
    WHERE id = NEW.flagged_user AND (suspended_until IS NULL OR suspended_until < now());

    -- Mark all unresolved flags as suspended
    UPDATE member_flags SET resolved_at = now(), resolution = 'suspended'
    WHERE flagged_user = NEW.flagged_user AND resolved_at IS NULL;

    -- Notify the flagged user
    PERFORM create_system_notification(
      NEW.flagged_user,
      'Account temporarily suspended',
      'Your account has been temporarily suspended pending review due to multiple community reports.',
      'suspension',
      NULL
    );

    -- Notify admins
    FOR v_admin IN SELECT id FROM profiles WHERE user_type = 'admin' LOOP
      PERFORM create_system_notification(
        v_admin.id,
        '🚨 Auto-suspension: ' || COALESCE(v_display_name, 'Unknown'),
        COALESCE(v_display_name, 'A member') || ' was auto-suspended (' || v_unique_flaggers || ' flaggers, ' || v_unique_sessions || ' sessions)',
        'admin_alert',
        NULL
      );
    END LOOP;

  -- Escalation alert: 2+ flaggers across 2+ sessions
  ELSIF v_unique_flaggers >= 2 AND v_unique_sessions >= 2 THEN
    FOR v_admin IN SELECT id FROM profiles WHERE user_type = 'admin' LOOP
      PERFORM create_system_notification(
        v_admin.id,
        '⚠️ Escalated flag: ' || COALESCE(v_display_name, 'Unknown'),
        COALESCE(v_display_name, 'A member') || ' has been flagged by ' || v_unique_flaggers || ' members across ' || v_unique_sessions || ' sessions',
        'admin_alert',
        NULL
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Part 6: Create the trigger
CREATE TRIGGER on_flag_inserted
  AFTER INSERT ON public.member_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.check_flag_auto_escalation();
