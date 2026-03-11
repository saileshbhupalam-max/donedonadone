
-- user_streaks table
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_checkin_date DATE,
  weekly_checkins INT NOT NULL DEFAULT 0,
  weekly_goal INT NOT NULL DEFAULT 3,
  week_start DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streak"
  ON public.user_streaks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- update_user_streak RPC
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS TABLE (
  current_streak INT,
  longest_streak INT,
  weekly_checkins INT,
  weekly_goal INT,
  streak_extended BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_today DATE := CURRENT_DATE;
  v_extended BOOLEAN := false;
  v_new_streak INT;
  v_new_longest INT;
  v_new_weekly INT;
  v_new_week_start DATE;
BEGIN
  -- Upsert
  INSERT INTO user_streaks (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_rec FROM user_streaks WHERE user_streaks.user_id = p_user_id;

  -- Already checked in today
  IF v_rec.last_checkin_date = v_today THEN
    RETURN QUERY SELECT v_rec.current_streak, v_rec.longest_streak, v_rec.weekly_checkins, v_rec.weekly_goal, false;
    RETURN;
  END IF;

  -- Streak logic
  IF v_rec.last_checkin_date = v_today - 1 THEN
    v_new_streak := v_rec.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;
  v_extended := true;

  v_new_longest := GREATEST(v_rec.longest_streak, v_new_streak);

  -- Weekly logic
  IF v_rec.week_start IS NULL OR v_today - v_rec.week_start > 6 THEN
    v_new_weekly := 1;
    v_new_week_start := v_today;
  ELSE
    v_new_weekly := v_rec.weekly_checkins + 1;
    v_new_week_start := v_rec.week_start;
  END IF;

  UPDATE user_streaks SET
    current_streak = v_new_streak,
    longest_streak = v_new_longest,
    weekly_checkins = v_new_weekly,
    week_start = v_new_week_start,
    last_checkin_date = v_today,
    updated_at = now()
  WHERE user_streaks.user_id = p_user_id;

  RETURN QUERY SELECT v_new_streak, v_new_longest, v_new_weekly, v_rec.weekly_goal, v_extended;
END;
$$;

-- Auto-trigger on check-in
CREATE OR REPLACE FUNCTION public.trg_checkin_update_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM update_user_streak(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_checkin_update_streak ON public.check_ins;
CREATE TRIGGER on_checkin_update_streak
  AFTER INSERT ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.trg_checkin_update_streak();

-- get_activity_summary RPC
CREATE OR REPLACE FUNCTION public.get_activity_summary(p_user_id UUID)
RETURNS TABLE (
  total_checkins BIGINT,
  total_connections BIGINT,
  total_requests_helped BIGINT,
  current_streak INT,
  longest_streak INT,
  weekly_checkins INT,
  weekly_goal INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_checkins BIGINT;
  v_connections BIGINT;
  v_helped BIGINT;
  v_streak RECORD;
BEGIN
  SELECT COUNT(*) INTO v_checkins FROM check_ins WHERE check_ins.user_id = p_user_id;

  SELECT COUNT(*) INTO v_connections FROM connections
    WHERE connections.user_a = p_user_id OR connections.user_b = p_user_id;

  SELECT COUNT(*) INTO v_helped FROM micro_requests
    WHERE micro_requests.claimed_by = p_user_id AND micro_requests.status = 'completed';

  SELECT us.current_streak, us.longest_streak, us.weekly_checkins, us.weekly_goal
  INTO v_streak FROM user_streaks us WHERE us.user_id = p_user_id;

  RETURN QUERY SELECT
    v_checkins,
    v_connections,
    v_helped,
    COALESCE(v_streak.current_streak, 0),
    COALESCE(v_streak.longest_streak, 0),
    COALESCE(v_streak.weekly_checkins, 0),
    COALESCE(v_streak.weekly_goal, 3);
END;
$$;
