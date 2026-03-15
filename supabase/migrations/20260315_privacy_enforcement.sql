-- Fix 1.2b + ProfileView privacy enforcement
-- Updates get_public_profile to respect profiles.profile_visibility, hide_neighborhood, hide_social_links
-- Added in Fix 0.1 migration (20260315_server_side_business_logic.sql)
--
-- Visibility levels:
--   'public'       → Full profile visible to everyone (default)
--   'session_only' → Full profile only for people who shared a session or are connected
--   'minimal'      → Only display_name, avatar, events_attended visible

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
  v_shared_session BOOLEAN := false;
BEGIN
  -- Self-view always returns full profile
  IF p_viewer_id = p_profile_id THEN
    v_visibility := 'public';
  ELSE
    -- Read privacy setting from profiles table (added in Fix 0.1)
    SELECT COALESCE(p.profile_visibility, 'public')
    INTO v_visibility
    FROM profiles p WHERE p.id = p_profile_id;
    v_visibility := COALESCE(v_visibility, 'public');
  END IF;

  -- Count mutual sessions (needed for session_only check AND for display)
  SELECT COUNT(DISTINCT ef1.event_id)::int INTO v_mutual
  FROM event_feedback ef1
  JOIN event_feedback ef2 ON ef1.event_id = ef2.event_id
  WHERE ef1.user_id = p_viewer_id AND ef1.attended = true
    AND ef2.user_id = p_profile_id AND ef2.attended = true;
  v_shared_session := v_mutual > 0;

  -- Check connection
  SELECT EXISTS(
    SELECT 1 FROM connections c
    WHERE (c.user_a = p_viewer_id AND c.user_b = p_profile_id)
       OR (c.user_a = p_profile_id AND c.user_b = p_viewer_id)
  ) INTO v_is_connected;

  -- 'minimal' visibility: only basic info, regardless of connection
  IF v_visibility = 'minimal' THEN
    RETURN QUERY
    SELECT
      p.id AS user_id, p.display_name, p.avatar_url,
      NULL::text AS bio, NULL::text AS work_type,
      COALESCE(p.events_attended, 0)::int AS events_attended,
      p.created_at AS member_since,
      NULL::text AS role_type, NULL::text[] AS skills,
      NULL::text[] AS looking_for, NULL::text[] AS can_offer,
      NULL::text[] AS topics, NULL::text[] AS "values",
      NULL::jsonb AS work_style, NULL::text AS company, false AS company_visible,
      0 AS taste_match_score,
      NULL::text AS connection_type, NULL::double precision AS connection_strength,
      v_mutual AS mutual_sessions
    FROM profiles p
    WHERE p.id = p_profile_id
      AND (p.suspended_until IS NULL OR p.suspended_until < now());
    RETURN;
  END IF;

  -- 'session_only' visibility: full profile only if shared session or connected
  IF v_visibility = 'session_only' AND NOT v_shared_session AND NOT v_is_connected THEN
    RETURN QUERY
    SELECT
      p.id AS user_id, p.display_name, p.avatar_url,
      NULL::text AS bio, NULL::text AS work_type,
      COALESCE(p.events_attended, 0)::int AS events_attended,
      p.created_at AS member_since,
      NULL::text AS role_type, NULL::text[] AS skills,
      NULL::text[] AS looking_for, NULL::text[] AS can_offer,
      NULL::text[] AS topics, NULL::text[] AS "values",
      NULL::jsonb AS work_style, NULL::text AS company, false AS company_visible,
      0 AS taste_match_score,
      NULL::text AS connection_type, NULL::double precision AS connection_strength,
      v_mutual AS mutual_sessions
    FROM profiles p
    WHERE p.id = p_profile_id
      AND (p.suspended_until IS NULL OR p.suspended_until < now());
    RETURN;
  END IF;

  -- Full profile: 'public' OR 'session_only' with shared session/connection
  SELECT c.connection_type, c.strength::float
  INTO v_conn
  FROM connections c
  WHERE (c.user_a = LEAST(p_viewer_id, p_profile_id) AND c.user_b = GREATEST(p_viewer_id, p_profile_id))
  ORDER BY c.strength DESC NULLS LAST
  LIMIT 1;

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
