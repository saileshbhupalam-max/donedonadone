
-- get_platform_analytics RPC
CREATE OR REPLACE FUNCTION public.get_platform_analytics()
RETURNS TABLE (
  total_users BIGINT,
  users_this_week BIGINT,
  users_this_month BIGINT,
  total_checkins BIGINT,
  checkins_today BIGINT,
  checkins_this_week BIGINT,
  active_now BIGINT,
  total_connections BIGINT,
  connections_this_week BIGINT,
  total_requests BIGINT,
  requests_completed BIGINT,
  avg_taste_match NUMERIC,
  avg_dna_completion NUMERIC,
  total_locations BIGINT,
  active_locations BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_type TEXT;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles WHERE onboarding_completed = true)::BIGINT,
    (SELECT COUNT(*) FROM profiles WHERE onboarding_completed = true AND created_at >= (CURRENT_DATE - interval '7 days'))::BIGINT,
    (SELECT COUNT(*) FROM profiles WHERE onboarding_completed = true AND created_at >= date_trunc('month', CURRENT_DATE))::BIGINT,
    (SELECT COUNT(*) FROM check_ins)::BIGINT,
    (SELECT COUNT(*) FROM check_ins WHERE checked_in_at::date = CURRENT_DATE)::BIGINT,
    (SELECT COUNT(*) FROM check_ins WHERE checked_in_at >= (CURRENT_DATE - interval '7 days'))::BIGINT,
    (SELECT COUNT(*) FROM check_ins WHERE checked_out_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM connections)::BIGINT,
    (SELECT COUNT(*) FROM connections WHERE created_at >= (CURRENT_DATE - interval '7 days'))::BIGINT,
    (SELECT COUNT(*) FROM micro_requests)::BIGINT,
    (SELECT COUNT(*) FROM micro_requests WHERE status = 'completed')::BIGINT,
    COALESCE((SELECT AVG(strength) FROM connections WHERE strength IS NOT NULL), 0)::NUMERIC,
    COALESCE((SELECT AVG(work_profile_complete) FROM taste_graph WHERE work_profile_complete > 0), 0)::NUMERIC,
    (SELECT COUNT(*) FROM locations)::BIGINT,
    (SELECT COUNT(DISTINCT ci.location_id) FROM check_ins ci WHERE ci.checked_out_at IS NULL AND ci.location_id IS NOT NULL)::BIGINT;
END;
$$;

-- get_daily_metrics RPC
CREATE OR REPLACE FUNCTION public.get_daily_metrics(p_days INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  new_users BIGINT,
  checkins BIGINT,
  connections BIGINT,
  active_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_type TEXT;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
  SELECT
    d.date,
    COALESCE((SELECT COUNT(*) FROM profiles p WHERE p.created_at::date = d.date AND p.onboarding_completed = true), 0)::BIGINT AS new_users,
    COALESCE((SELECT COUNT(*) FROM check_ins ci WHERE ci.checked_in_at::date = d.date), 0)::BIGINT AS checkins,
    COALESCE((SELECT COUNT(*) FROM connections c WHERE c.created_at::date = d.date), 0)::BIGINT AS connections,
    COALESCE((SELECT COUNT(DISTINCT ci2.user_id) FROM check_ins ci2 WHERE ci2.checked_in_at::date = d.date), 0)::BIGINT AS active_users
  FROM generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, '1 day'::interval) AS d(date)
  ORDER BY d.date;
END;
$$;

-- get_top_locations RPC
CREATE OR REPLACE FUNCTION public.get_top_locations(p_days INT DEFAULT 7)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  location_type TEXT,
  checkin_count BIGINT,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_type TEXT;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.name AS location_name,
    l.location_type,
    COUNT(ci.id)::BIGINT AS checkin_count,
    COUNT(DISTINCT ci.user_id)::BIGINT AS unique_users
  FROM check_ins ci
  JOIN locations l ON l.id = ci.location_id
  WHERE ci.checked_in_at >= (CURRENT_DATE - (p_days || ' days')::interval)
  GROUP BY l.id, l.name, l.location_type
  ORDER BY checkin_count DESC
  LIMIT 10;
END;
$$;
