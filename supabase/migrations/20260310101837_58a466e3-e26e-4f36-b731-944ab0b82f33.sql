
-- Fix 1: Optimize get_whos_here to call calculate_taste_match once per row
CREATE OR REPLACE FUNCTION public.get_whos_here(p_user_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_radius_meters integer DEFAULT 500)
RETURNS TABLE (user_id uuid, display_name text, avatar_url text, status text, mode text, note text, checked_in_at timestamp with time zone, location_name text, location_type text, role_type text, looking_for text[], skills text[], taste_match_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT s.user_id, s.display_name, s.avatar_url, s.status, s.mode, s.note, s.checked_in_at, s.location_name, s.location_type, s.role_type, s.looking_for, s.skills, s.taste_match_score
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
  ) s
  ORDER BY s.taste_match_score DESC, s.checked_in_at DESC;
END;
$$;

-- Fix 2: Optimize match_coffee_roulette to call calculate_taste_match once per row
CREATE OR REPLACE FUNCTION public.match_coffee_roulette(p_user_id uuid)
RETURNS TABLE (matched_user_id uuid, matched_display_name text, matched_avatar_url text, matched_role_type text, taste_match integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_my_entry RECORD;
  v_match RECORD;
BEGIN
  SELECT * INTO v_my_entry FROM coffee_roulette_queue
    WHERE coffee_roulette_queue.user_id = p_user_id AND coffee_roulette_queue.status = 'waiting'
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT sub.id, sub.user_id, sub.display_name, sub.avatar_url, sub.role_type, sub.score
  INTO v_match
  FROM (
    SELECT crq.id, crq.user_id, p.display_name, p.avatar_url, tg.role_type,
      COALESCE(calculate_taste_match(p_user_id, crq.user_id)::int, 0) AS score
    FROM coffee_roulette_queue crq
    JOIN profiles p ON p.id = crq.user_id
    LEFT JOIN taste_graph tg ON tg.user_id = crq.user_id
    WHERE crq.status = 'waiting'
      AND crq.user_id != p_user_id
      AND (p.suspended_until IS NULL OR p.suspended_until < now())
  ) sub
  ORDER BY sub.score DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE coffee_roulette_queue SET status = 'matched', matched_with = v_match.user_id, matched_at = now()
    WHERE id = v_my_entry.id;
  UPDATE coffee_roulette_queue SET status = 'matched', matched_with = p_user_id, matched_at = now()
    WHERE id = v_match.id;

  PERFORM upsert_connection(p_user_id, v_match.user_id, 'roulette', 'work', '{}');
  PERFORM record_behavioral_signal(p_user_id, 'coffee_roulette_matched', v_match.user_id, NULL, NULL, 'work', '{}');
  PERFORM record_behavioral_signal(v_match.user_id, 'coffee_roulette_matched', p_user_id, NULL, NULL, 'work', '{}');

  matched_user_id := v_match.user_id;
  matched_display_name := v_match.display_name;
  matched_avatar_url := v_match.avatar_url;
  matched_role_type := v_match.role_type;
  taste_match := v_match.score;
  RETURN NEXT;
END;
$$;

-- Fix 3: Schedule pg_cron jobs
SELECT cron.schedule('expire-checkins', '*/30 * * * *', 'SELECT public.auto_expire_check_ins()');
SELECT cron.schedule('recalc-behavioral-scores', '0 3 * * *', 'SELECT public.recalculate_behavioral_scores()');
SELECT cron.schedule('recalc-connection-strength', '0 4 * * 0', 'SELECT public.recalculate_connection_strength()');

-- Fix 4: Add notification UPDATE policy (if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.notifications
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Fix 5: Enable Realtime on micro_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.micro_requests;

-- Fix 6: Index for notification queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);
