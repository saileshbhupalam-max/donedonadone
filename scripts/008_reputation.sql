-- Reputation System: composite Coworker Score (0-5 scale)
-- Components:
--   Attendance reliability (0.25) — checked_in / total bookings
--   Would cowork again rate (0.25) — true ratings / total ratings received
--   Avg energy_match (0.15) — avg from member_ratings
--   Total sessions (0.15) — normalized: min(sessions/50, 1) * 5
--   Streak consistency (0.10) — min(current_streak/10, 1) * 5
--   Feedback quality (0.10) — has left feedback / total past sessions

CREATE OR REPLACE FUNCTION compute_coworker_score(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_bookings INTEGER;
  v_checked_in INTEGER;
  v_attendance NUMERIC;
  v_total_ratings INTEGER;
  v_positive_ratings INTEGER;
  v_cowork_again_rate NUMERIC;
  v_avg_energy NUMERIC;
  v_sessions_completed INTEGER;
  v_session_score NUMERIC;
  v_current_streak INTEGER;
  v_streak_score NUMERIC;
  v_feedback_given INTEGER;
  v_past_sessions INTEGER;
  v_feedback_score NUMERIC;
  v_composite NUMERIC;
BEGIN
  -- Attendance reliability: checked_in / total non-cancelled bookings
  SELECT count(*), count(*) FILTER (WHERE checked_in = TRUE)
  INTO v_total_bookings, v_checked_in
  FROM bookings
  WHERE user_id = p_user_id
    AND payment_status IN ('paid', 'confirmed');

  v_attendance := CASE WHEN v_total_bookings > 0
    THEN (v_checked_in::NUMERIC / v_total_bookings) * 5
    ELSE 0 END;

  -- Would cowork again rate
  SELECT count(*), count(*) FILTER (WHERE would_cowork_again = TRUE)
  INTO v_total_ratings, v_positive_ratings
  FROM member_ratings
  WHERE to_user = p_user_id;

  v_cowork_again_rate := CASE WHEN v_total_ratings > 0
    THEN (v_positive_ratings::NUMERIC / v_total_ratings) * 5
    ELSE 0 END;

  -- Average energy match
  SELECT coalesce(avg(energy_match), 0) INTO v_avg_energy
  FROM member_ratings
  WHERE to_user = p_user_id AND energy_match IS NOT NULL;

  -- Total sessions (normalized: 50 sessions = max)
  v_sessions_completed := v_checked_in;
  v_session_score := LEAST(v_sessions_completed::NUMERIC / 50, 1) * 5;

  -- Streak consistency
  SELECT coalesce(current_streak, 0) INTO v_current_streak
  FROM user_streaks WHERE user_id = p_user_id;

  v_streak_score := LEAST(v_current_streak::NUMERIC / 10, 1) * 5;

  -- Feedback quality (has left feedback / total past sessions)
  SELECT count(*) INTO v_feedback_given
  FROM session_feedback WHERE user_id = p_user_id;

  SELECT count(*) INTO v_past_sessions
  FROM bookings b JOIN sessions s ON s.id = b.session_id
  WHERE b.user_id = p_user_id
    AND b.checked_in = TRUE
    AND s.date < CURRENT_DATE;

  v_feedback_score := CASE WHEN v_past_sessions > 0
    THEN LEAST(v_feedback_given::NUMERIC / v_past_sessions, 1) * 5
    ELSE 0 END;

  -- Weighted composite
  v_composite := (
    v_attendance * 0.25 +
    v_cowork_again_rate * 0.25 +
    v_avg_energy * 0.15 +
    v_session_score * 0.15 +
    v_streak_score * 0.10 +
    v_feedback_score * 0.10
  );

  RETURN jsonb_build_object(
    'score', round(v_composite, 1),
    'attendance', round(v_attendance, 1),
    'cowork_again_rate', round(v_cowork_again_rate, 1),
    'avg_energy', round(v_avg_energy, 1),
    'session_score', round(v_session_score, 1),
    'streak_score', round(v_streak_score, 1),
    'feedback_score', round(v_feedback_score, 1),
    'total_ratings', v_total_ratings,
    'sessions_completed', v_sessions_completed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
