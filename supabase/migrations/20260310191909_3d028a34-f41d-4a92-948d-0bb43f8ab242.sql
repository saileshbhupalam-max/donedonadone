
-- Cross-space connections table
CREATE TABLE IF NOT EXISTS public.cross_space_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  discovered_user_id UUID NOT NULL REFERENCES public.profiles(id),
  discovered_at_venue_id UUID REFERENCES public.venue_partners(id),
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, discovered_user_id)
);

ALTER TABLE public.cross_space_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own cross-space connections" ON public.cross_space_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin full access cross_space" ON public.cross_space_connections
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- RPC: get_cross_space_people
CREATE OR REPLACE FUNCTION public.get_cross_space_people()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSON;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Find people at venues the user hasn't been to
  SELECT json_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT DISTINCT ON (p.id)
      p.id AS user_id,
      p.display_name,
      p.avatar_url,
      p.tagline,
      p.work_vibe,
      vp.venue_name,
      vp.neighborhood AS venue_area
    FROM event_rsvps er
    JOIN events e ON e.id = er.event_id
    JOIN venue_partners vp ON vp.id = e.venue_partner_id
    JOIN profiles p ON p.id = er.user_id
    WHERE e.venue_partner_id IS NOT NULL
      AND er.user_id != v_user_id
      AND e.venue_partner_id NOT IN (
        SELECT DISTINCT e2.venue_partner_id
        FROM event_rsvps er2
        JOIN events e2 ON e2.id = er2.event_id
        WHERE er2.user_id = v_user_id
          AND e2.venue_partner_id IS NOT NULL
      )
    ORDER BY p.id, e.date DESC
    LIMIT 20
  ) t;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- RPC: get_company_analytics
CREATE OR REPLACE FUNCTION public.get_company_analytics(p_company_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSON;
  v_is_member BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN RAISE EXCEPTION 'Not a member of this company'; END IF;

  WITH member_ids AS (
    SELECT user_id FROM company_members WHERE company_id = p_company_id
  ),
  session_stats AS (
    SELECT COUNT(*) AS total_sessions
    FROM event_rsvps er
    WHERE er.user_id IN (SELECT user_id FROM member_ids)
      AND er.status = 'confirmed'
  ),
  connection_stats AS (
    SELECT COUNT(*) AS total_connections
    FROM connections c
    WHERE c.user_a IN (SELECT user_id FROM member_ids)
       OR c.user_b IN (SELECT user_id FROM member_ids)
  ),
  intro_sent AS (
    SELECT COUNT(*) AS cnt FROM company_intros WHERE from_company_id = p_company_id
  ),
  intro_received AS (
    SELECT COUNT(*) AS cnt FROM company_intros WHERE to_company_id = p_company_id
  ),
  top_industries AS (
    SELECT unnest(c.industry_tags) AS industry, COUNT(*) AS cnt
    FROM company_intros ci
    JOIN companies c ON c.id = CASE
      WHEN ci.from_company_id = p_company_id THEN ci.to_company_id
      ELSE ci.from_company_id
    END
    WHERE ci.from_company_id = p_company_id OR ci.to_company_id = p_company_id
    GROUP BY industry
    ORDER BY cnt DESC
    LIMIT 5
  ),
  monthly AS (
    SELECT to_char(date_trunc('month', e.date::timestamp), 'YYYY-MM') AS month,
           COUNT(DISTINCT er.id) AS sessions,
           COUNT(DISTINCT ci.id) AS intros
    FROM generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      '1 month'
    ) AS m(month_start)
    LEFT JOIN events e ON date_trunc('month', e.date::timestamp) = m.month_start
    LEFT JOIN event_rsvps er ON er.event_id = e.id
      AND er.user_id IN (SELECT user_id FROM member_ids)
      AND er.status = 'confirmed'
    LEFT JOIN company_intros ci ON (ci.from_company_id = p_company_id OR ci.to_company_id = p_company_id)
      AND date_trunc('month', ci.created_at) = m.month_start
    GROUP BY month
    ORDER BY month
  )
  SELECT json_build_object(
    'total_member_sessions', (SELECT total_sessions FROM session_stats),
    'total_connections_formed', (SELECT total_connections FROM connection_stats),
    'total_intros_sent', (SELECT cnt FROM intro_sent),
    'total_intros_received', (SELECT cnt FROM intro_received),
    'top_industries_connected', (SELECT COALESCE(json_agg(json_build_object('industry', industry, 'count', cnt)), '[]'::json) FROM top_industries),
    'monthly_activity', (SELECT COALESCE(json_agg(json_build_object('month', month, 'sessions', sessions, 'intros', intros)), '[]'::json) FROM monthly)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Seed tier_features for Max tier
INSERT INTO public.tier_features (feature_key, label, description, category, min_tier_id, sort_order, is_active)
VALUES
  ('cross_space_network', 'Cross-Space Network', 'Discover matched professionals at venues you haven''t visited', 'discovery', 'max', 60, true),
  ('ai_intro_drafts', 'AI Intro Drafts', 'Get AI-drafted intro messages for company introductions', 'ai', 'max', 61, true),
  ('company_analytics', 'Company Analytics', 'View engagement analytics for your company', 'company', 'max', 62, true)
ON CONFLICT (feature_key) DO NOTHING;

-- Seed ai_task_config for intro_draft
INSERT INTO public.ai_task_config (task_type, provider_id, model, temperature, max_tokens, system_prompt, is_active, fallback_to_template)
VALUES (
  'intro_draft', 'openai', 'gpt-4o-mini', 0.7, 200,
  'Write a brief, professional intro message from one company to another for a coworking platform. Be warm and specific about potential synergies. 2-3 sentences max.',
  true, true
)
ON CONFLICT (task_type) DO NOTHING;
