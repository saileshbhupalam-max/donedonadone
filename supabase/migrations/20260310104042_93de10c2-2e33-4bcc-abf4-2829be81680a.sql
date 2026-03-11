
-- ═══ user_settings table ═══
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  notify_connection_requests BOOLEAN NOT NULL DEFAULT true,
  notify_micro_requests BOOLEAN NOT NULL DEFAULT true,
  notify_coffee_matches BOOLEAN NOT NULL DEFAULT true,
  notify_props BOOLEAN NOT NULL DEFAULT true,
  notify_system BOOLEAN NOT NULL DEFAULT true,
  weekly_goal INT NOT NULL DEFAULT 3,
  visibility TEXT NOT NULL DEFAULT 'everyone',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for weekly_goal and visibility
CREATE OR REPLACE FUNCTION public.trg_validate_user_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.weekly_goal < 1 OR NEW.weekly_goal > 7 THEN
    RAISE EXCEPTION 'weekly_goal must be between 1 and 7';
  END IF;
  IF NEW.visibility NOT IN ('everyone', 'connections_only', 'hidden') THEN
    RAISE EXCEPTION 'visibility must be everyone, connections_only, or hidden';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_user_settings
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_user_settings();

-- RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-create user_settings when profile is inserted
CREATE OR REPLACE FUNCTION public.trg_create_user_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_create_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_create_user_settings();

-- Sync weekly_goal to user_streaks
CREATE OR REPLACE FUNCTION public.trg_sync_weekly_goal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.weekly_goal IS DISTINCT FROM NEW.weekly_goal THEN
    UPDATE user_streaks SET weekly_goal = NEW.weekly_goal WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_settings_sync_weekly_goal
  AFTER UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_weekly_goal();

-- ═══ Update notification triggers to respect user_settings ═══

-- Connection request notify
CREATE OR REPLACE FUNCTION public.trg_connection_request_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from_name TEXT;
  v_notify BOOLEAN;
BEGIN
  SELECT notify_connection_requests INTO v_notify FROM user_settings WHERE user_id = NEW.to_user;
  IF v_notify IS DISTINCT FROM false THEN
    SELECT display_name INTO v_from_name FROM profiles WHERE id = NEW.from_user;
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.to_user, 'connection_formed',
      COALESCE(v_from_name, 'Someone') || ' wants to connect',
      CASE WHEN NEW.message IS NOT NULL AND NEW.message != '' THEN '"' || left(NEW.message, 100) || '"' ELSE 'Tap to view their profile' END,
      '/profile/' || NEW.from_user::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Micro-request claimed
CREATE OR REPLACE FUNCTION public.trg_micro_request_claimed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_claimer_name TEXT;
  v_notify BOOLEAN;
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'claimed' AND NEW.claimed_by IS NOT NULL THEN
    SELECT notify_micro_requests INTO v_notify FROM user_settings WHERE user_id = NEW.user_id;
    IF v_notify IS DISTINCT FROM false THEN
      SELECT display_name INTO v_claimer_name FROM profiles WHERE id = NEW.claimed_by;
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'request_claimed', 'Someone can help!',
        COALESCE(v_claimer_name, 'Someone') || ' offered to help with: ' || NEW.title,
        '/profile/' || NEW.claimed_by::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Micro-request completed
CREATE OR REPLACE FUNCTION public.trg_micro_request_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_requester_name TEXT;
  v_helper_name TEXT;
  v_notify_helper BOOLEAN;
  v_notify_requester BOOLEAN;
BEGIN
  IF OLD.status = 'claimed' AND NEW.status = 'completed' AND NEW.claimed_by IS NOT NULL THEN
    PERFORM record_behavioral_signal(NEW.user_id, 'micro_request_completed', NEW.claimed_by, NULL, NEW.location_id, 'work', '{}');
    PERFORM record_behavioral_signal(NEW.claimed_by, 'micro_request_helped', NEW.user_id, NULL, NEW.location_id, 'work', '{}');
    PERFORM upsert_connection(NEW.user_id, NEW.claimed_by, 'helped', 'work', '{}');

    SELECT display_name INTO v_requester_name FROM profiles WHERE id = NEW.user_id;
    SELECT display_name INTO v_helper_name FROM profiles WHERE id = NEW.claimed_by;

    SELECT notify_micro_requests INTO v_notify_helper FROM user_settings WHERE user_id = NEW.claimed_by;
    IF v_notify_helper IS DISTINCT FROM false THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.claimed_by, 'request_completed', 'Request completed! 🎉',
        COALESCE(v_requester_name, 'Someone') || ' marked "' || NEW.title || '" as complete. Thanks for helping!',
        '/profile/' || NEW.user_id::text);
    END IF;

    SELECT notify_micro_requests INTO v_notify_requester FROM user_settings WHERE user_id = NEW.user_id;
    IF v_notify_requester IS DISTINCT FROM false THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'request_completed', 'Your request is done!',
        '"' || NEW.title || '" was completed with help from ' || COALESCE(v_helper_name, 'someone') || '.',
        '/profile/' || NEW.claimed_by::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Coffee roulette matched
CREATE OR REPLACE FUNCTION public.trg_coffee_roulette_matched()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_matched_name TEXT;
  v_notify BOOLEAN;
BEGIN
  IF OLD.status = 'waiting' AND NEW.status = 'matched' AND NEW.matched_with IS NOT NULL THEN
    SELECT notify_coffee_matches INTO v_notify FROM user_settings WHERE user_id = NEW.user_id;
    IF v_notify IS DISTINCT FROM false THEN
      SELECT display_name INTO v_matched_name FROM profiles WHERE id = NEW.matched_with;
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'coffee_match', 'Coffee match found! ☕',
        'You''ve been matched with ' || COALESCE(v_matched_name, 'someone') || ' for a quick chat. Say hi!',
        '/profile/' || NEW.matched_with::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Props notification
CREATE OR REPLACE FUNCTION public.trg_prop_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from_name TEXT;
  v_notify BOOLEAN;
BEGIN
  SELECT notify_props INTO v_notify FROM user_settings WHERE user_id = NEW.to_user;
  IF v_notify IS DISTINCT FROM false THEN
    IF NEW.anonymous = false THEN
      SELECT display_name INTO v_from_name FROM profiles WHERE id = NEW.from_user;
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.to_user, 'props_received', 'You received props! 🔥',
        COALESCE(v_from_name, 'Someone') || ' gave you a "' || NEW.prop_type || '" prop!',
        '/profile/' || NEW.from_user::text);
    ELSE
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (NEW.to_user, 'props_received', 'You received anonymous props! 🔥',
        'Someone gave you a "' || NEW.prop_type || '" prop!', NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create settings for existing profiles that don't have one
INSERT INTO public.user_settings (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT (user_id) DO NOTHING;
