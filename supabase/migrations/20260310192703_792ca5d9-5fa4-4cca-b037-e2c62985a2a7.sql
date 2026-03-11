
-- Table: user_engagement_scores
CREATE TABLE IF NOT EXISTS public.user_engagement_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  score INTEGER DEFAULT 0,
  sessions_last_30d INTEGER DEFAULT 0,
  connections_last_30d INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  streak_days INTEGER DEFAULT 0,
  churn_risk TEXT DEFAULT 'low',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_engagement_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own engagement score" ON public.user_engagement_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin sees all engagement scores" ON public.user_engagement_scores
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- Table: conversion_events
CREATE TABLE IF NOT EXISTS public.conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads conversion events" ON public.conversion_events
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Authenticated insert conversion events" ON public.conversion_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Table: weekly_digest_data
CREATE TABLE IF NOT EXISTS public.weekly_digest_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  week_start DATE NOT NULL,
  sessions_attended INTEGER DEFAULT 0,
  connections_made INTEGER DEFAULT 0,
  props_received INTEGER DEFAULT 0,
  rank_progress TEXT,
  highlight TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_digest_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own digest" ON public.weekly_digest_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin sees all digests" ON public.weekly_digest_data
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- RPC: compute_engagement_score
CREATE OR REPLACE FUNCTION public.compute_engagement_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin BOOLEAN;
  v_sessions INTEGER;
  v_connections INTEGER;
  v_last_active TIMESTAMPTZ;
  v_streak INTEGER;
  v_score INTEGER;
  v_risk TEXT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin') INTO v_admin;
  IF NOT v_admin THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT COUNT(*) INTO v_sessions
  FROM event_rsvps
  WHERE user_id = p_user_id AND status = 'confirmed'
    AND created_at >= now() - interval '30 days';

  SELECT COUNT(*) INTO v_connections
  FROM connections
  WHERE (user_a = p_user_id OR user_b = p_user_id)
    AND created_at >= now() - interval '30 days';

  SELECT GREATEST(
    (SELECT MAX(created_at) FROM event_rsvps WHERE user_id = p_user_id),
    (SELECT MAX(created_at) FROM connections WHERE user_a = p_user_id OR user_b = p_user_id)
  ) INTO v_last_active;

  SELECT COUNT(DISTINCT d) INTO v_streak
  FROM (
    SELECT DATE(created_at) AS d FROM event_rsvps WHERE user_id = p_user_id AND created_at >= now() - interval '14 days'
    UNION
    SELECT DATE(created_at) FROM connections WHERE (user_a = p_user_id OR user_b = p_user_id) AND created_at >= now() - interval '14 days'
  ) active_days;

  v_score := LEAST(100, (v_sessions * 15) + (v_connections * 10) + (v_streak * 5));

  IF v_score < 20 THEN v_risk := 'high';
  ELSIF v_score < 50 THEN v_risk := 'medium';
  ELSE v_risk := 'low';
  END IF;

  INSERT INTO user_engagement_scores (user_id, score, sessions_last_30d, connections_last_30d, last_active_at, streak_days, churn_risk, updated_at)
  VALUES (p_user_id, v_score, v_sessions, v_connections, v_last_active, v_streak, v_risk, now())
  ON CONFLICT (user_id) DO UPDATE SET
    score = EXCLUDED.score,
    sessions_last_30d = EXCLUDED.sessions_last_30d,
    connections_last_30d = EXCLUDED.connections_last_30d,
    last_active_at = EXCLUDED.last_active_at,
    streak_days = EXCLUDED.streak_days,
    churn_risk = EXCLUDED.churn_risk,
    updated_at = now();

  RETURN v_score;
END;
$$;

-- RPC: compute_all_engagement_scores
CREATE OR REPLACE FUNCTION public.compute_all_engagement_scores()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin BOOLEAN;
  v_count INTEGER := 0;
  v_uid UUID;
BEGIN
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin') INTO v_admin;
  IF NOT v_admin THEN RAISE EXCEPTION 'Admin only'; END IF;

  FOR v_uid IN SELECT DISTINCT user_id FROM event_rsvps LOOP
    PERFORM compute_engagement_score(v_uid);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- RPC: get_weekly_digest
CREATE OR REPLACE FUNCTION public.get_weekly_digest(p_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_user_id != auth.uid() AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT user_id, week_start, sessions_attended, connections_made, props_received, rank_progress, highlight
    FROM weekly_digest_data
    WHERE user_id = v_user_id
    ORDER BY week_start DESC
    LIMIT 1
  ) t;

  RETURN v_result;
END;
$$;
