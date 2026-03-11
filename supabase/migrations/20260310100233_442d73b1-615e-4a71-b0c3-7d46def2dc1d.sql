
-- Seed feature flags
INSERT INTO feature_flags (flag_name, description, enabled) VALUES
  ('play_mode', 'Enable Play mode alongside Work mode', false),
  ('coffee_roulette', 'Enable random coffee matching', false),
  ('micro_requests', 'Enable micro-request board', false),
  ('whos_here', 'Enable Who''s Here feed', true),
  ('taste_matching', 'Enable taste-graph-based matching', true),
  ('community_feed', 'Enable community activity feed', false)
ON CONFLICT (flag_name) DO NOTHING;

-- Seed locations
INSERT INTO locations (name, location_type, neighborhood, latitude, longitude, radius_meters, city, verified) VALUES
  ('HSR Layout Sector 1', 'neighborhood', 'HSR Layout', 12.9116, 77.6389, 500, 'Bangalore', true),
  ('HSR Layout Sector 2', 'neighborhood', 'HSR Layout', 12.9140, 77.6410, 500, 'Bangalore', true),
  ('HSR Layout Sector 3', 'neighborhood', 'HSR Layout', 12.9170, 77.6350, 500, 'Bangalore', true),
  ('HSR Layout Sector 4', 'neighborhood', 'HSR Layout', 12.9090, 77.6420, 500, 'Bangalore', true),
  ('HSR Layout Sector 5', 'neighborhood', 'HSR Layout', 12.9060, 77.6380, 500, 'Bangalore', true),
  ('HSR Layout Sector 6', 'neighborhood', 'HSR Layout', 12.9130, 77.6360, 500, 'Bangalore', true),
  ('HSR Layout Sector 7', 'neighborhood', 'HSR Layout', 12.9100, 77.6350, 500, 'Bangalore', true),
  ('Koramangala', 'neighborhood', 'Koramangala', 12.9279, 77.6271, 800, 'Bangalore', true),
  ('Indiranagar', 'neighborhood', 'Indiranagar', 12.9784, 77.6408, 800, 'Bangalore', true),
  ('Whitefield', 'tech_park', 'Whitefield', 12.9698, 77.7500, 1000, 'Bangalore', true),
  ('Electronic City', 'tech_park', 'Electronic City', 12.8399, 77.6770, 1000, 'Bangalore', true),
  ('Manyata Tech Park', 'tech_park', 'Hebbal', 13.0467, 77.6210, 800, 'Bangalore', true),
  ('RMZ Ecoworld', 'tech_park', 'Bellandur', 12.9260, 77.6830, 600, 'Bangalore', true),
  ('WeWork HSR', 'coworking_space', 'HSR Layout', 12.9120, 77.6395, 100, 'Bangalore', true),
  ('91springboard HSR', 'coworking_space', 'HSR Layout', 12.9135, 77.6405, 100, 'Bangalore', true),
  ('Third Wave Coffee HSR', 'cafe', 'HSR Layout', 12.9118, 77.6392, 50, 'Bangalore', true),
  ('Starbucks HSR', 'cafe', 'HSR Layout', 12.9125, 77.6400, 50, 'Bangalore', true)
ON CONFLICT DO NOTHING;

-- micro_requests table
CREATE TABLE IF NOT EXISTS public.micro_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('skill_help', 'coffee_chat', 'feedback', 'collaboration', 'other')),
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'expired')),
  claimed_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.micro_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_micro_requests_open ON public.micro_requests (status, location_id) WHERE status = 'open';
CREATE INDEX idx_micro_requests_user ON public.micro_requests (user_id);

CREATE POLICY "Anyone can see open or own or claimed requests" ON public.micro_requests
  FOR SELECT TO authenticated
  USING (status = 'open' OR user_id = auth.uid() OR claimed_by = auth.uid());

CREATE POLICY "Users can create own requests" ON public.micro_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or claimed requests" ON public.micro_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR claimed_by = auth.uid())
  WITH CHECK (user_id = auth.uid() OR claimed_by = auth.uid());

-- Trigger for micro_request completion signals
CREATE OR REPLACE FUNCTION public.trg_micro_request_completed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'claimed' AND NEW.status = 'completed' AND NEW.claimed_by IS NOT NULL THEN
    PERFORM record_behavioral_signal(NEW.user_id, 'micro_request_completed', NEW.claimed_by, NULL, NEW.location_id, 'work', '{}');
    PERFORM record_behavioral_signal(NEW.claimed_by, 'micro_request_helped', NEW.user_id, NULL, NEW.location_id, 'work', '{}');
    PERFORM upsert_connection(NEW.user_id, NEW.claimed_by, 'helped', 'work', '{}');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_micro_request_completed
  AFTER UPDATE ON public.micro_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_micro_request_completed();

-- coffee_roulette_queue table
CREATE TABLE IF NOT EXISTS public.coffee_roulette_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  mode TEXT NOT NULL DEFAULT 'work' CHECK (mode IN ('work', 'play', 'open')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_with UUID REFERENCES public.profiles(id),
  matched_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'expired')),
  UNIQUE (user_id, status)
);

ALTER TABLE public.coffee_roulette_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own or matched entries" ON public.coffee_roulette_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR matched_with = auth.uid());

CREATE POLICY "Users can join queue" ON public.coffee_roulette_queue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own or matched entries" ON public.coffee_roulette_queue
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR matched_with = auth.uid())
  WITH CHECK (user_id = auth.uid() OR matched_with = auth.uid());

CREATE POLICY "Users can delete own waiting entries" ON public.coffee_roulette_queue
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'waiting');

-- match_coffee_roulette RPC
CREATE OR REPLACE FUNCTION public.match_coffee_roulette(p_user_id UUID)
RETURNS TABLE (
  matched_user_id UUID,
  matched_display_name TEXT,
  matched_avatar_url TEXT,
  matched_role_type TEXT,
  taste_match INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_my_entry RECORD;
  v_match RECORD;
  v_score INT;
BEGIN
  -- Find my waiting entry
  SELECT * INTO v_my_entry FROM coffee_roulette_queue
    WHERE coffee_roulette_queue.user_id = p_user_id AND coffee_roulette_queue.status = 'waiting'
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  -- Find best match
  SELECT crq.id, crq.user_id, p.display_name, p.avatar_url, tg.role_type,
    COALESCE(calculate_taste_match(p_user_id, crq.user_id)::int, 0) AS score
  INTO v_match
  FROM coffee_roulette_queue crq
  JOIN profiles p ON p.id = crq.user_id
  LEFT JOIN taste_graph tg ON tg.user_id = crq.user_id
  WHERE crq.status = 'waiting'
    AND crq.user_id != p_user_id
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
  ORDER BY COALESCE(calculate_taste_match(p_user_id, crq.user_id)::int, 0) DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  -- Update both entries
  UPDATE coffee_roulette_queue SET status = 'matched', matched_with = v_match.user_id, matched_at = now()
    WHERE id = v_my_entry.id;
  UPDATE coffee_roulette_queue SET status = 'matched', matched_with = p_user_id, matched_at = now()
    WHERE id = v_match.id;

  -- Record signals and connection
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
