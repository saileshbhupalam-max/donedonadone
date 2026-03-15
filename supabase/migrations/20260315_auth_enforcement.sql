-- Audit Fix #1: Enforce auth.uid() on all user-facing RPCs
-- Audit Fix #16: Documented Edge Function auth (applied separately in code)
--
-- Strategy:
-- 1. Create user_* wrapper functions that enforce auth.uid() for client calls
-- 2. Revoke EXECUTE on server_* from authenticated/anon (service_role only)
-- 3. Add auth.uid() enforcement to read RPCs (get_my_circle, get_whos_here, etc.)
--
-- Why wrappers instead of modifying server_*:
--   server_* RPCs are called internally by other SECURITY DEFINER functions
--   (e.g., server_activate_venue calls server_award_credits for the nominator,
--   where auth.uid() is the voucher, not the nominator). Hardcoding auth.uid()
--   in server_* would break these internal flows.

-- ═══════════════════════════════════════════════════════════
-- PART 1: USER-FACING WRAPPERS FOR WRITE RPCs
-- ═══════════════════════════════════════════════════════════

-- user_award_credits: client-safe wrapper that enforces auth.uid()
CREATE OR REPLACE FUNCTION user_award_credits(
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  RETURN server_award_credits(auth.uid(), p_action, p_amount, p_metadata, p_idempotency_key);
END;
$$;

-- user_spend_credits: client-safe wrapper that enforces auth.uid()
CREATE OR REPLACE FUNCTION user_spend_credits(
  p_action text,
  p_amount integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  RETURN server_spend_credits(auth.uid(), p_action, p_amount, p_metadata);
END;
$$;

-- user_fulfill_redemption: client-safe wrapper that enforces auth.uid()
CREATE OR REPLACE FUNCTION user_fulfill_redemption(
  p_action text,
  p_cost integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  RETURN server_fulfill_redemption(auth.uid(), p_action, p_cost);
END;
$$;

-- user_cancel_rsvp: client-safe wrapper that enforces auth.uid()
CREATE OR REPLACE FUNCTION user_cancel_rsvp(
  p_event_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  RETURN server_cancel_rsvp(p_event_id, auth.uid());
END;
$$;

-- Grant user_* to authenticated, revoke server_* from authenticated+anon
GRANT EXECUTE ON FUNCTION user_award_credits TO authenticated;
GRANT EXECUTE ON FUNCTION user_spend_credits TO authenticated;
GRANT EXECUTE ON FUNCTION user_fulfill_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION user_cancel_rsvp TO authenticated;

REVOKE EXECUTE ON FUNCTION server_award_credits FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION server_spend_credits FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION server_fulfill_redemption FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION server_cancel_rsvp FROM authenticated, anon;

-- Also revoke trigger-only function that shouldn't be callable
REVOKE EXECUTE ON FUNCTION update_user_streak FROM authenticated, anon;

-- ═══════════════════════════════════════════════════════════
-- PART 2: AUTH ENFORCEMENT ON READ RPCs
-- ═══════════════════════════════════════════════════════════

-- get_my_circle: enforce p_user_id = auth.uid()
CREATE OR REPLACE FUNCTION get_my_circle(p_user_id uuid)
RETURNS TABLE (
  circle_user_id uuid,
  display_name text,
  avatar_url text,
  tagline varchar,
  cowork_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: cannot access other users data';
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN cp.user_id = p_user_id THEN cp.preferred_user_id ELSE cp.user_id END as circle_user_id,
    p.display_name,
    p.avatar_url,
    p.tagline,
    COUNT(*) as cowork_count
  FROM cowork_preferences cp
  JOIN cowork_preferences cp2 ON cp.user_id = cp2.preferred_user_id
    AND cp.preferred_user_id = cp2.user_id
  JOIN profiles p ON p.id = CASE WHEN cp.user_id = p_user_id THEN cp.preferred_user_id ELSE cp.user_id END
  WHERE (cp.user_id = p_user_id OR cp.preferred_user_id = p_user_id)
    AND cp.user_id < cp.preferred_user_id
  GROUP BY circle_user_id, p.display_name, p.avatar_url, p.tagline
  ORDER BY cowork_count DESC;
END;
$$;

-- get_public_profile: enforce p_viewer_id = auth.uid()
-- (full function body in 20260315_privacy_enforcement.sql — we just add the auth check)
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
  -- AUTH ENFORCEMENT: viewer must be the authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_viewer_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: viewer_id must match authenticated user';
  END IF;

  -- Self-view always returns full profile
  IF p_viewer_id = p_profile_id THEN
    v_visibility := 'public';
  ELSE
    SELECT COALESCE(p.profile_visibility, 'public')
    INTO v_visibility
    FROM profiles p WHERE p.id = p_profile_id;
    v_visibility := COALESCE(v_visibility, 'public');
  END IF;

  SELECT COUNT(DISTINCT ef1.event_id)::int INTO v_mutual
  FROM event_feedback ef1
  JOIN event_feedback ef2 ON ef1.event_id = ef2.event_id
  WHERE ef1.user_id = p_viewer_id AND ef1.attended = true
    AND ef2.user_id = p_profile_id AND ef2.attended = true;
  v_shared_session := v_mutual > 0;

  SELECT EXISTS(
    SELECT 1 FROM connections c
    WHERE (c.user_a = p_viewer_id AND c.user_b = p_profile_id)
       OR (c.user_a = p_profile_id AND c.user_b = p_viewer_id)
  ) INTO v_is_connected;

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

-- get_whos_here: enforce p_user_id = auth.uid()
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
  -- AUTH ENFORCEMENT
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: cannot query as another user';
  END IF;

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

-- get_location_activity: enforce p_user_id = auth.uid()
CREATE OR REPLACE FUNCTION get_location_activity(p_user_id uuid)
RETURNS TABLE(
  location_id uuid, location_name text, location_type text,
  neighborhood text, active_count bigint, top_roles text[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- AUTH ENFORCEMENT
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: cannot query as another user';
  END IF;

  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.name AS location_name,
    l.location_type,
    l.neighborhood,
    COUNT(ci.id)::bigint AS active_count,
    ARRAY(
      SELECT DISTINCT tg.role_type
      FROM check_ins ci2
      JOIN taste_graph tg ON tg.user_id = ci2.user_id
      LEFT JOIN user_settings us2 ON us2.user_id = ci2.user_id
      WHERE ci2.location_id = l.id AND ci2.checked_out_at IS NULL
        AND COALESCE(us2.visibility, 'everyone') != 'hidden'
        AND (
          COALESCE(us2.visibility, 'everyone') = 'everyone'
          OR EXISTS (
            SELECT 1 FROM connections c
            WHERE (c.user_a = p_user_id AND c.user_b = ci2.user_id)
               OR (c.user_a = ci2.user_id AND c.user_b = p_user_id)
          )
        )
        AND tg.role_type IS NOT NULL
      LIMIT 5
    ) AS top_roles
  FROM locations l
  JOIN check_ins ci ON ci.location_id = l.id AND ci.checked_out_at IS NULL
  JOIN profiles p ON p.id = ci.user_id
  LEFT JOIN user_settings us ON us.user_id = ci.user_id
  WHERE (p.suspended_until IS NULL OR p.suspended_until < now())
    AND COALESCE(us.visibility, 'everyone') != 'hidden'
    AND (
      COALESCE(us.visibility, 'everyone') = 'everyone'
      OR EXISTS (
        SELECT 1 FROM connections c
        WHERE (c.user_a = p_user_id AND c.user_b = ci.user_id)
           OR (c.user_a = ci.user_id AND c.user_b = p_user_id)
      )
    )
  GROUP BY l.id, l.name, l.location_type, l.neighborhood
  HAVING COUNT(ci.id) > 0
  ORDER BY active_count DESC;
END;
$$;
