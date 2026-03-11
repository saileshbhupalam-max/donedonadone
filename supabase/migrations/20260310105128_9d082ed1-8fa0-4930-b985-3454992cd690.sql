
-- Fix 1: Enforce visibility in get_whos_here
CREATE OR REPLACE FUNCTION get_whos_here(
  p_user_id uuid,
  p_location_id uuid DEFAULT NULL::uuid,
  p_latitude double precision DEFAULT NULL::double precision,
  p_longitude double precision DEFAULT NULL::double precision,
  p_radius_meters integer DEFAULT 500
)
RETURNS TABLE(
  user_id uuid, display_name text, avatar_url text, status text, mode text,
  note text, checked_in_at timestamptz, location_name text, location_type text,
  role_type text, looking_for text[], skills text[], taste_match_score integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, s.display_name, s.avatar_url, s.status, s.mode, s.note,
         s.checked_in_at, s.location_name, s.location_type, s.role_type,
         s.looking_for, s.skills, s.taste_match_score
  FROM (
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
    LEFT JOIN user_settings us ON us.user_id = ci.user_id
    WHERE ci.checked_out_at IS NULL
      AND ci.user_id != p_user_id
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
      -- Visibility enforcement
      AND COALESCE(us.visibility, 'everyone') != 'hidden'
      AND (
        COALESCE(us.visibility, 'everyone') = 'everyone'
        OR EXISTS (
          SELECT 1 FROM connections c
          WHERE (c.user_a = p_user_id AND c.user_b = ci.user_id)
             OR (c.user_a = ci.user_id AND c.user_b = p_user_id)
        )
      )
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
  ) s
  ORDER BY s.taste_match_score DESC, s.checked_in_at DESC;
END;
$$;

-- Fix 2: Enforce visibility in get_location_activity
CREATE OR REPLACE FUNCTION get_location_activity(p_user_id uuid)
RETURNS TABLE(
  location_id uuid, location_name text, location_type text,
  neighborhood text, active_count bigint, top_roles text[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.name AS location_name,
    l.location_type,
    l.neighborhood,
    COUNT(DISTINCT ci.user_id) AS active_count,
    COALESCE(
      (SELECT array_agg(DISTINCT tg.role_type)
       FROM check_ins ci2
       JOIN taste_graph tg ON tg.user_id = ci2.user_id
       LEFT JOIN user_settings us2 ON us2.user_id = ci2.user_id
       WHERE ci2.location_id = l.id
         AND ci2.checked_out_at IS NULL
         AND ci2.user_id != p_user_id
         AND tg.role_type IS NOT NULL
         AND tg.role_type != ''
         AND COALESCE(us2.visibility, 'everyone') != 'hidden'
       LIMIT 3),
      '{}'::text[]
    ) AS top_roles
  FROM check_ins ci
  JOIN profiles p ON p.id = ci.user_id
  JOIN locations l ON l.id = ci.location_id
  LEFT JOIN user_settings us ON us.user_id = ci.user_id
  WHERE ci.checked_out_at IS NULL
    AND ci.user_id != p_user_id
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND ci.location_id IS NOT NULL
    AND COALESCE(us.visibility, 'everyone') != 'hidden'
  GROUP BY l.id, l.name, l.location_type, l.neighborhood
  HAVING COUNT(DISTINCT ci.user_id) >= 1
  ORDER BY COUNT(DISTINCT ci.user_id) DESC;
END;
$$;

-- Fix 3: Enforce visibility in get_public_profile
CREATE OR REPLACE FUNCTION get_public_profile(p_viewer_id uuid, p_profile_id uuid)
RETURNS TABLE(
  user_id uuid, display_name text, avatar_url text, bio text, work_type text,
  events_attended integer, member_since timestamptz, role_type text, skills text[],
  looking_for text[], can_offer text[], topics text[], "values" text[],
  work_style jsonb, company text, company_visible boolean, taste_match_score integer,
  connection_type text, connection_strength double precision, mutual_sessions integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conn RECORD;
  v_mutual INT := 0;
  v_visibility TEXT;
  v_is_connected BOOLEAN := false;
BEGIN
  -- Check visibility
  SELECT COALESCE(us.visibility, 'everyone') INTO v_visibility
  FROM user_settings us WHERE us.user_id = p_profile_id;
  v_visibility := COALESCE(v_visibility, 'everyone');

  -- Check connection if needed
  IF p_viewer_id != p_profile_id AND v_visibility != 'everyone' THEN
    SELECT EXISTS(
      SELECT 1 FROM connections c
      WHERE (c.user_a = p_viewer_id AND c.user_b = p_profile_id)
         OR (c.user_a = p_profile_id AND c.user_b = p_viewer_id)
    ) INTO v_is_connected;

    IF v_visibility = 'hidden' AND NOT v_is_connected THEN
      RETURN; -- empty result
    END IF;
    IF v_visibility = 'connections_only' AND NOT v_is_connected THEN
      RETURN; -- empty result
    END IF;
  END IF;

  -- Get connection info
  SELECT c.connection_type, c.strength::float
  INTO v_conn
  FROM connections c
  WHERE (c.user_a = LEAST(p_viewer_id, p_profile_id) AND c.user_b = GREATEST(p_viewer_id, p_profile_id))
  ORDER BY c.strength DESC NULLS LAST
  LIMIT 1;

  -- Count mutual sessions
  SELECT COUNT(DISTINCT ef1.event_id)::int INTO v_mutual
  FROM event_feedback ef1
  JOIN event_feedback ef2 ON ef1.event_id = ef2.event_id
  WHERE ef1.user_id = p_viewer_id AND ef1.attended = true
    AND ef2.user_id = p_profile_id AND ef2.attended = true;

  RETURN QUERY
  SELECT
    p.id AS user_id, p.display_name, p.avatar_url, p.bio,
    p.what_i_do AS work_type,
    COALESCE(p.events_attended, 0)::int AS events_attended,
    p.created_at AS member_since,
    tg.role_type, tg.skills,
    COALESCE(p.looking_for, tg.work_looking_for) AS looking_for,
    COALESCE(p.can_offer, tg.work_can_offer) AS can_offer,
    tg.topics, tg."values",
    jsonb_build_object(
      'group_size_pref', tg.group_size_pref,
      'conversation_depth', tg.conversation_depth,
      'session_length_pref', tg.session_length_pref,
      'noise_preference', p.noise_preference,
      'communication_style', p.communication_style
    ) AS work_style,
    tg.current_project AS company,
    COALESCE(tg.company_visible, false) AS company_visible,
    CASE WHEN p_viewer_id = p_profile_id THEN 0
         ELSE COALESCE(calculate_taste_match(p_viewer_id, p_profile_id)::int, 0)
    END AS taste_match_score,
    v_conn.connection_type,
    v_conn.strength,
    v_mutual AS mutual_sessions
  FROM profiles p
  LEFT JOIN taste_graph tg ON tg.user_id = p.id
  WHERE p.id = p_profile_id
    AND (p.suspended_until IS NULL OR p.suspended_until < now());
END;
$$;
