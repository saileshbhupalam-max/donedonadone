-- Streak Tracking: weekly session streaks for retention
-- A streak increments when user completes 1+ sessions in a calendar week

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_session_week DATE,  -- Monday of the last active week
  streak_frozen BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own streak" ON user_streaks;
CREATE POLICY "Users view own streak" ON user_streaks
  FOR SELECT USING (auth.uid() = user_id);

-- Function to compute the Monday of a given date's week
CREATE OR REPLACE FUNCTION week_start(p_date DATE)
RETURNS DATE AS $$
BEGIN
  RETURN p_date - (EXTRACT(ISODOW FROM p_date)::INTEGER - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update streak after check-in
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_current_week DATE;
  v_streak user_streaks;
BEGIN
  v_current_week := week_start(CURRENT_DATE);

  -- Get or create streak record
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_session_week, updated_at)
    VALUES (p_user_id, 1, 1, v_current_week, NOW());
    RETURN;
  END IF;

  -- Already counted this week
  IF v_streak.last_session_week = v_current_week THEN
    RETURN;
  END IF;

  -- Check if last active week was the previous week (streak continues)
  IF v_streak.last_session_week = v_current_week - INTERVAL '7 days' THEN
    UPDATE user_streaks SET
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_session_week = v_current_week,
      streak_frozen = FALSE,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  -- Missed more than 1 week: streak resets
  ELSE
    UPDATE user_streaks SET
      current_streak = 1,
      last_session_week = v_current_week,
      streak_frozen = FALSE,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-update streak when a user checks in
CREATE OR REPLACE FUNCTION trigger_update_streak()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checked_in = TRUE AND (OLD.checked_in IS NULL OR OLD.checked_in = FALSE) THEN
    PERFORM update_streak(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_checkin_update_streak ON bookings;
CREATE TRIGGER on_checkin_update_streak
  AFTER UPDATE OF checked_in ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_streak();
