
-- get_whos_here RPC
CREATE OR REPLACE FUNCTION public.get_whos_here(
  p_user_id UUID,
  p_location_id UUID DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters INT DEFAULT 500
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT,
  mode TEXT,
  note TEXT,
  checked_in_at TIMESTAMPTZ,
  location_name TEXT,
  location_type TEXT,
  role_type TEXT,
  looking_for TEXT[],
  skills TEXT[],
  taste_match_score INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.user_id,
    p.display_name,
    p.avatar_url,
    ci.status,
    ci.mode,
    ci.note,
    ci.checked_in_at,
    l.name AS location_name,
    l.location_type,
    tg.role_type,
    tg.work_looking_for AS looking_for,
    tg.skills,
    COALESCE(public.calculate_taste_match(p_user_id, ci.user_id)::int, 0) AS taste_match_score
  FROM check_ins ci
  JOIN profiles p ON p.id = ci.user_id
  LEFT JOIN locations l ON l.id = ci.location_id
  LEFT JOIN taste_graph tg ON tg.user_id = ci.user_id
  WHERE ci.checked_out_at IS NULL
    AND ci.user_id != p_user_id
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND (
      (p_location_id IS NOT NULL AND ci.location_id = p_location_id)
      OR (p_latitude IS NOT NULL AND p_longitude IS NOT NULL AND ci.latitude IS NOT NULL AND ci.longitude IS NOT NULL AND
        (2 * 6371000 * asin(sqrt(
          sin(radians((p_latitude - ci.latitude::double precision) / 2)) ^ 2 +
          cos(radians(p_latitude)) * cos(radians(ci.latitude::double precision)) *
          sin(radians((p_longitude - ci.longitude::double precision) / 2)) ^ 2
        ))) < p_radius_meters)
      OR (p_location_id IS NULL AND p_latitude IS NULL)
    )
  ORDER BY COALESCE(public.calculate_taste_match(p_user_id, ci.user_id)::int, 0) DESC, ci.checked_in_at DESC;
END;
$$;
