-- Profile Stats: computed user statistics for non-portable value
-- Returns: sessions_completed, unique_coworkers, venues_visited, avg_rating_received,
--          current_streak, longest_streak, member_since

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sessions_completed INTEGER;
  v_unique_coworkers INTEGER;
  v_venues_visited INTEGER;
  v_avg_rating NUMERIC;
  v_member_since TIMESTAMPTZ;
  v_hours_focused NUMERIC;
BEGIN
  -- Sessions completed (checked in)
  SELECT count(*) INTO v_sessions_completed
  FROM bookings
  WHERE user_id = p_user_id
    AND checked_in = TRUE
    AND payment_status IN ('paid', 'confirmed');

  -- Unique coworkers met (via group_members in same groups)
  SELECT count(DISTINCT gm2.user_id) INTO v_unique_coworkers
  FROM bookings b
  JOIN group_members gm1 ON gm1.group_id = b.group_id AND gm1.user_id = p_user_id
  JOIN group_members gm2 ON gm2.group_id = b.group_id AND gm2.user_id != p_user_id
  WHERE b.user_id = p_user_id
    AND b.checked_in = TRUE;

  -- Venues visited
  SELECT count(DISTINCT s.venue_id) INTO v_venues_visited
  FROM bookings b
  JOIN sessions s ON s.id = b.session_id
  WHERE b.user_id = p_user_id
    AND b.checked_in = TRUE;

  -- Average rating received from peers
  SELECT avg(
    CASE WHEN would_cowork_again THEN 5.0 ELSE 2.0 END
  ) INTO v_avg_rating
  FROM member_ratings
  WHERE to_user = p_user_id;

  -- Hours focused
  SELECT coalesce(sum(s.duration_hours), 0) INTO v_hours_focused
  FROM bookings b
  JOIN sessions s ON s.id = b.session_id
  WHERE b.user_id = p_user_id
    AND b.checked_in = TRUE;

  -- Member since
  SELECT created_at INTO v_member_since
  FROM profiles
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'sessions_completed', coalesce(v_sessions_completed, 0),
    'unique_coworkers', coalesce(v_unique_coworkers, 0),
    'venues_visited', coalesce(v_venues_visited, 0),
    'avg_rating_received', coalesce(round(v_avg_rating, 1), 0),
    'hours_focused', coalesce(v_hours_focused, 0),
    'member_since', v_member_since
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
