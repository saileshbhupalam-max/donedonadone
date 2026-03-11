
-- ═══════════════════════════════════════════════════════════
-- PART 1: Feature Flags
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read flags" ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert flags" ON public.feature_flags
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin can update flags" ON public.feature_flags
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin can delete flags" ON public.feature_flags
  FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- RPC to check flag
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_flag_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT enabled FROM feature_flags WHERE flag_name = p_flag_name), false);
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Locations
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('tech_park', 'business_district', 'coworking_space', 'cafe', 'campus', 'neighborhood', 'other')),
  parent_location_id uuid REFERENCES public.locations(id),
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  radius_meters integer NOT NULL DEFAULT 100,
  neighborhood text,
  city text NOT NULL DEFAULT 'Bangalore',
  is_partner boolean DEFAULT false,
  venue_partner_id uuid REFERENCES public.venue_partners(id),
  member_count integer DEFAULT 0,
  verified boolean DEFAULT false,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_locations_coords ON public.locations (latitude, longitude);
CREATE INDEX idx_locations_type ON public.locations (location_type);
CREATE INDEX idx_locations_neighborhood ON public.locations (neighborhood);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read locations" ON public.locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert locations" ON public.locations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin can update locations" ON public.locations
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin can delete locations" ON public.locations
  FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- RPC: resolve check-in location
CREATE OR REPLACE FUNCTION public.resolve_check_in_location(p_latitude numeric, p_longitude numeric)
RETURNS TABLE(location_id uuid, name text, location_type text, distance_meters numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.name,
    l.location_type,
    (2 * 6371000 * asin(sqrt(
      sin(radians((p_latitude - l.latitude)::double precision) / 2) ^ 2 +
      cos(radians(p_latitude::double precision)) * cos(radians(l.latitude::double precision)) *
      sin(radians((p_longitude - l.longitude)::double precision) / 2) ^ 2
    )))::numeric AS distance_meters
  FROM locations l
  WHERE (2 * 6371000 * asin(sqrt(
      sin(radians((p_latitude - l.latitude)::double precision) / 2) ^ 2 +
      cos(radians(p_latitude::double precision)) * cos(radians(l.latitude::double precision)) *
      sin(radians((p_longitude - l.longitude)::double precision) / 2) ^ 2
    ))) < l.radius_meters
  ORDER BY l.radius_meters ASC
  LIMIT 1;
END;
$$;

-- RPC: increment location member count
CREATE OR REPLACE FUNCTION public.increment_location_member_count(p_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE locations SET member_count = member_count + 1 WHERE id = p_location_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Check-Ins
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  location_id uuid REFERENCES public.locations(id),
  latitude numeric(9,6),
  longitude numeric(9,6),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'deep_work', 'in_session', 'busy')),
  mode text NOT NULL DEFAULT 'work' CHECK (mode IN ('work', 'play', 'open')),
  note text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  auto_detected boolean DEFAULT false,
  CONSTRAINT note_length CHECK (length(note) <= 100)
);

CREATE INDEX idx_check_ins_user_active ON public.check_ins (user_id) WHERE checked_out_at IS NULL;
CREATE INDEX idx_check_ins_location_active ON public.check_ins (location_id) WHERE checked_out_at IS NULL;
CREATE INDEX idx_check_ins_checked_in_at ON public.check_ins (checked_in_at);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own check-ins" ON public.check_ins
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own check-ins" ON public.check_ins
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own check-ins" ON public.check_ins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Authenticated can read active check-ins" ON public.check_ins
  FOR SELECT TO authenticated USING (checked_out_at IS NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.check_ins;

-- RPC: auto-expire check-ins
CREATE OR REPLACE FUNCTION public.auto_expire_check_ins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE check_ins
  SET checked_out_at = now()
  WHERE checked_out_at IS NULL
    AND checked_in_at < now() - interval '8 hours';
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Taste Graph
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.taste_graph (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Work dimensions
  industries text[] DEFAULT '{}',
  role_type text,
  skills text[] DEFAULT '{}',
  experience_years integer,
  current_project text,
  project_stage text,
  work_looking_for text[] DEFAULT '{}',
  work_can_offer text[] DEFAULT '{}',
  company_name text,
  company_visible boolean DEFAULT false,
  -- Play dimensions
  hobbies text[] DEFAULT '{}',
  play_looking_for text[] DEFAULT '{}',
  play_can_offer text[] DEFAULT '{}',
  weekend_availability text,
  social_energy text,
  food_preferences text[] DEFAULT '{}',
  -- Shared dimensions
  peak_hours text[] DEFAULT '{}',
  session_length_pref text,
  group_size_pref text,
  conversation_depth text,
  openness_to_new integer CHECK (openness_to_new IS NULL OR (openness_to_new >= 1 AND openness_to_new <= 5)),
  topics text[] DEFAULT '{}',
  "values" text[] DEFAULT '{}',
  -- Behavioral scores
  consistency_score numeric(5,2) DEFAULT 0,
  connector_score numeric(5,2) DEFAULT 0,
  responsiveness_score numeric(5,2) DEFAULT 0,
  exploration_score numeric(5,2) DEFAULT 0,
  work_profile_complete numeric(5,2) DEFAULT 0,
  play_profile_complete numeric(5,2) DEFAULT 0,
  last_enriched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_taste_graph_user ON public.taste_graph (user_id);
CREATE INDEX idx_taste_graph_skills ON public.taste_graph USING GIN (skills);
CREATE INDEX idx_taste_graph_industries ON public.taste_graph USING GIN (industries);
CREATE INDEX idx_taste_graph_topics ON public.taste_graph USING GIN (topics);
CREATE INDEX idx_taste_graph_hobbies ON public.taste_graph USING GIN (hobbies);
CREATE INDEX idx_taste_graph_work_looking_for ON public.taste_graph USING GIN (work_looking_for);
CREATE INDEX idx_taste_graph_work_can_offer ON public.taste_graph USING GIN (work_can_offer);

ALTER TABLE public.taste_graph ENABLE ROW LEVEL SECURITY;

-- Owner can read/update everything
CREATE POLICY "Users can read own taste graph" ON public.taste_graph
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own taste graph" ON public.taste_graph
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin can read all
CREATE POLICY "Admin can read all taste graphs" ON public.taste_graph
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- System can insert (for auto-create trigger)
CREATE POLICY "System can insert taste graph" ON public.taste_graph
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Public view for other users (limited fields)
CREATE OR REPLACE VIEW public.taste_graph_public AS
SELECT
  user_id,
  industries,
  role_type,
  skills,
  current_project,
  project_stage,
  hobbies,
  topics,
  "values",
  work_profile_complete,
  play_profile_complete,
  CASE WHEN company_visible THEN company_name ELSE NULL END AS company_name
FROM public.taste_graph;

GRANT SELECT ON public.taste_graph_public TO authenticated;

-- Trigger: recalculate profile completeness on update
CREATE OR REPLACE FUNCTION public.trg_taste_graph_completeness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_work_filled integer := 0;
  v_work_total integer := 14;
  v_play_filled integer := 0;
  v_play_total integer := 6;
BEGIN
  -- Work fields
  IF NEW.role_type IS NOT NULL AND NEW.role_type != '' THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW.industries, 1) IS NOT NULL AND array_length(NEW.industries, 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW.skills, 1) IS NOT NULL AND array_length(NEW.skills, 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;
  IF NEW.current_project IS NOT NULL AND NEW.current_project != '' THEN v_work_filled := v_work_filled + 1; END IF;
  IF NEW.project_stage IS NOT NULL AND NEW.project_stage != '' THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW.work_looking_for, 1) IS NOT NULL AND array_length(NEW.work_looking_for, 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW.work_can_offer, 1) IS NOT NULL AND array_length(NEW.work_can_offer, 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;
  IF NEW.experience_years IS NOT NULL THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW.peak_hours, 1) IS NOT NULL AND array_length(NEW.peak_hours, 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;
  IF NEW.session_length_pref IS NOT NULL AND NEW.session_length_pref != '' THEN v_work_filled := v_work_filled + 1; END IF;
  IF NEW.group_size_pref IS NOT NULL AND NEW.group_size_pref != '' THEN v_work_filled := v_work_filled + 1; END IF;
  IF NEW.conversation_depth IS NOT NULL AND NEW.conversation_depth != '' THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW.topics, 1) IS NOT NULL AND array_length(NEW.topics, 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;
  IF array_length(NEW."values", 1) IS NOT NULL AND array_length(NEW."values", 1) > 0 THEN v_work_filled := v_work_filled + 1; END IF;

  -- Play fields
  IF array_length(NEW.hobbies, 1) IS NOT NULL AND array_length(NEW.hobbies, 1) > 0 THEN v_play_filled := v_play_filled + 1; END IF;
  IF array_length(NEW.play_looking_for, 1) IS NOT NULL AND array_length(NEW.play_looking_for, 1) > 0 THEN v_play_filled := v_play_filled + 1; END IF;
  IF array_length(NEW.play_can_offer, 1) IS NOT NULL AND array_length(NEW.play_can_offer, 1) > 0 THEN v_play_filled := v_play_filled + 1; END IF;
  IF NEW.weekend_availability IS NOT NULL AND NEW.weekend_availability != '' THEN v_play_filled := v_play_filled + 1; END IF;
  IF NEW.social_energy IS NOT NULL AND NEW.social_energy != '' THEN v_play_filled := v_play_filled + 1; END IF;
  IF array_length(NEW.food_preferences, 1) IS NOT NULL AND array_length(NEW.food_preferences, 1) > 0 THEN v_play_filled := v_play_filled + 1; END IF;

  NEW.work_profile_complete := round((v_work_filled::numeric / v_work_total) * 100, 2);
  NEW.play_profile_complete := round((v_play_filled::numeric / v_play_total) * 100, 2);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER taste_graph_completeness_trigger
  BEFORE UPDATE ON public.taste_graph
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_taste_graph_completeness();

-- Auto-create taste_graph on profile insert
CREATE OR REPLACE FUNCTION public.trg_create_taste_graph()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO taste_graph (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_taste_graph_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_taste_graph();

-- ═══════════════════════════════════════════════════════════
-- PART 5: Connections
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_b uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('coworked', 'coffee_chat', 'skill_swap', 'activity_partner', 'introduced')),
  context text NOT NULL DEFAULT 'work' CHECK (context IN ('work', 'play', 'both')),
  strength numeric(5,2) DEFAULT 10,
  interaction_count integer DEFAULT 1,
  first_interaction_at timestamptz DEFAULT now(),
  last_interaction_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_order CHECK (user_a < user_b),
  UNIQUE(user_a, user_b, connection_type)
);

CREATE INDEX idx_connections_user_a ON public.connections (user_a);
CREATE INDEX idx_connections_user_b ON public.connections (user_b);
CREATE INDEX idx_connections_strength ON public.connections (strength DESC);
CREATE INDEX idx_connections_last_interaction ON public.connections (last_interaction_at);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own connections" ON public.connections
  FOR SELECT TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid());

-- No direct INSERT/UPDATE/DELETE for users — only via RPCs

-- RPC: upsert connection
CREATE OR REPLACE FUNCTION public.upsert_connection(
  p_user_a uuid, p_user_b uuid, p_type text, p_context text DEFAULT 'work', p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_id uuid;
BEGIN
  IF p_user_a = p_user_b THEN RETURN NULL; END IF;
  
  -- Normalize order
  IF p_user_a < p_user_b THEN
    v_a := p_user_a; v_b := p_user_b;
  ELSE
    v_a := p_user_b; v_b := p_user_a;
  END IF;

  INSERT INTO connections (user_a, user_b, connection_type, context, metadata)
  VALUES (v_a, v_b, p_type, p_context, p_metadata)
  ON CONFLICT (user_a, user_b, connection_type) DO UPDATE SET
    interaction_count = connections.interaction_count + 1,
    last_interaction_at = now(),
    metadata = connections.metadata || p_metadata
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 6: Behavioral Signals
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.behavioral_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('prop_given', 'cowork_again', 'session_attended', 'check_in', 'profile_viewed', 'request_posted', 'request_responded', 'intro_made', 'coffee_chat_completed', 'event_rsvp', 'event_cancelled')),
  target_user_id uuid REFERENCES public.profiles(id),
  event_id uuid REFERENCES public.events(id),
  location_id uuid REFERENCES public.locations(id),
  context text DEFAULT 'work',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_signals_user_type_date ON public.behavioral_signals (user_id, signal_type, created_at);
CREATE INDEX idx_signals_target ON public.behavioral_signals (target_user_id, signal_type) WHERE target_user_id IS NOT NULL;
CREATE INDEX idx_signals_created ON public.behavioral_signals (created_at);

ALTER TABLE public.behavioral_signals ENABLE ROW LEVEL SECURITY;
-- No policies = no direct access. All via SECURITY DEFINER functions.

-- RPC: record signal
CREATE OR REPLACE FUNCTION public.record_behavioral_signal(
  p_user_id uuid,
  p_signal_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_event_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_context text DEFAULT 'work',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO behavioral_signals (user_id, signal_type, target_user_id, event_id, location_id, context, metadata)
  VALUES (p_user_id, p_signal_type, p_target_user_id, p_event_id, p_location_id, p_context, p_metadata);
END;
$$;

-- Trigger: peer_props -> signal + connection
CREATE OR REPLACE FUNCTION public.trg_prop_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM record_behavioral_signal(NEW.from_user, 'prop_given', NEW.to_user, NEW.event_id, NULL, 'work', jsonb_build_object('prop_type', NEW.prop_type));
  PERFORM upsert_connection(NEW.from_user, NEW.to_user, 'coworked', 'work', jsonb_build_object('last_prop', NEW.prop_type));
  RETURN NEW;
END;
$$;

CREATE TRIGGER prop_signal_trigger
  AFTER INSERT ON public.peer_props
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prop_signal();

-- Trigger: cowork_preferences -> signal + connection
CREATE OR REPLACE FUNCTION public.trg_cowork_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM record_behavioral_signal(NEW.user_id, 'cowork_again', NEW.preferred_user_id, NEW.event_id, NULL, 'work', '{}');
  PERFORM upsert_connection(NEW.user_id, NEW.preferred_user_id, 'coworked', 'work', jsonb_build_object('cowork_again', true));
  RETURN NEW;
END;
$$;

CREATE TRIGGER cowork_signal_trigger
  AFTER INSERT ON public.cowork_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cowork_signal();

-- Trigger: event_feedback (attended=true) -> signal
CREATE OR REPLACE FUNCTION public.trg_feedback_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.attended = true THEN
    PERFORM record_behavioral_signal(NEW.user_id, 'session_attended', NULL, NEW.event_id, NULL, 'work', '{}');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feedback_signal_trigger
  AFTER INSERT ON public.event_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_feedback_signal();

-- Trigger: event_rsvps -> signal
CREATE OR REPLACE FUNCTION public.trg_rsvp_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM record_behavioral_signal(NEW.user_id, 'event_rsvp', NULL, NEW.event_id, NULL, 'work', '{}');
  RETURN NEW;
END;
$$;

CREATE TRIGGER rsvp_signal_trigger
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_rsvp_signal();

-- Trigger: check_ins -> signal
CREATE OR REPLACE FUNCTION public.trg_checkin_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM record_behavioral_signal(NEW.user_id, 'check_in', NULL, NULL, NEW.location_id, NEW.mode, jsonb_build_object('status', NEW.status));
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_signal_trigger
  AFTER INSERT ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_checkin_signal();

-- ═══════════════════════════════════════════════════════════
-- PART 7: Behavioral Score Recalculation (RPC, scheduled via pg_cron)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalculate_behavioral_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_consistency numeric;
  v_connector numeric;
  v_responsiveness numeric;
  v_exploration numeric;
  v_weeks_active integer;
  v_unique_people integer;
  v_total_sessions integer;
  v_rsvps integer;
  v_attended integer;
  v_unique_locations integer;
  v_new_people integer;
  v_streak integer;
  v_90_days_ago timestamptz := now() - interval '90 days';
BEGIN
  FOR v_rec IN SELECT tg.user_id, p.current_streak FROM taste_graph tg JOIN profiles p ON p.id = tg.user_id LOOP

    -- Consistency score
    SELECT COUNT(DISTINCT date_trunc('week', bs.created_at))::integer INTO v_weeks_active
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id
      AND bs.signal_type IN ('session_attended', 'check_in')
      AND bs.created_at >= v_90_days_ago;

    v_consistency := least((v_weeks_active::numeric / 13.0) * 100, 100);
    IF COALESCE(v_rec.current_streak, 0) > 4 THEN
      v_consistency := least(v_consistency + 10, 100);
    END IF;

    -- Connector score
    SELECT COUNT(DISTINCT bs.target_user_id)::integer INTO v_unique_people
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id
      AND bs.signal_type IN ('prop_given', 'cowork_again')
      AND bs.target_user_id IS NOT NULL
      AND bs.created_at >= v_90_days_ago;

    SELECT COUNT(*)::integer INTO v_total_sessions
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id
      AND bs.signal_type = 'session_attended'
      AND bs.created_at >= v_90_days_ago;

    IF v_total_sessions = 0 THEN
      v_connector := 0;
    ELSE
      v_connector := least((v_unique_people::numeric / v_total_sessions) * 50, 100);
      IF v_unique_people > 10 THEN v_connector := least(v_connector + 10, 100); END IF;
    END IF;

    -- Responsiveness score
    SELECT COUNT(*)::integer INTO v_rsvps
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id AND bs.signal_type = 'event_rsvp' AND bs.created_at >= v_90_days_ago;

    SELECT COUNT(*)::integer INTO v_attended
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id AND bs.signal_type = 'session_attended' AND bs.created_at >= v_90_days_ago;

    IF v_rsvps = 0 THEN
      v_responsiveness := 0;
    ELSE
      v_responsiveness := least((v_attended::numeric / v_rsvps) * 100, 100);
    END IF;

    -- Exploration score
    SELECT COUNT(DISTINCT bs.location_id)::integer INTO v_unique_locations
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id AND bs.signal_type = 'check_in' AND bs.location_id IS NOT NULL AND bs.created_at >= v_90_days_ago;

    SELECT COUNT(DISTINCT bs.target_user_id)::integer INTO v_new_people
    FROM behavioral_signals bs
    WHERE bs.user_id = v_rec.user_id
      AND bs.signal_type IN ('prop_given', 'cowork_again')
      AND bs.target_user_id IS NOT NULL
      AND bs.created_at >= v_90_days_ago
      AND bs.target_user_id NOT IN (
        SELECT CASE WHEN c.user_a = v_rec.user_id THEN c.user_b ELSE c.user_a END
        FROM connections c
        WHERE (c.user_a = v_rec.user_id OR c.user_b = v_rec.user_id)
        ORDER BY c.interaction_count DESC
        LIMIT 5
      );

    v_exploration := least(least(v_unique_locations * 10, 50) + least(v_new_people * 5, 50), 100);

    -- Update
    UPDATE taste_graph SET
      consistency_score = v_consistency,
      connector_score = v_connector,
      responsiveness_score = v_responsiveness,
      exploration_score = v_exploration,
      last_enriched_at = now()
    WHERE user_id = v_rec.user_id;

  END LOOP;
END;
$$;

-- Connection strength recalculation
CREATE OR REPLACE FUNCTION public.recalculate_connection_strength()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_days numeric;
  v_recency numeric;
  v_frequency numeric;
  v_strength numeric;
BEGIN
  FOR v_rec IN SELECT id, interaction_count, last_interaction_at FROM connections LOOP
    v_days := EXTRACT(EPOCH FROM (now() - v_rec.last_interaction_at)) / 86400.0;
    v_recency := exp(-0.693 * v_days / 60.0);
    v_frequency := least(ln(v_rec.interaction_count + 1) / ln(20) * 100, 100);
    v_strength := greatest((v_recency * 50 + v_frequency * 50) / 100.0 * 100, 1);

    UPDATE connections SET strength = round(v_strength::numeric, 2) WHERE id = v_rec.id;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 8: Taste-Based Match Scoring
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_taste_match(p_user_a uuid, p_user_b uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_a RECORD;
  v_b RECORD;
  v_score numeric := 0;
  v_overlaps integer;
  v_topic_overlaps integer;
  v_value_overlaps integer;
  v_conn_strength numeric;
  v_industry_overlap integer;
BEGIN
  SELECT * INTO v_a FROM taste_graph WHERE user_id = p_user_a;
  SELECT * INTO v_b FROM taste_graph WHERE user_id = p_user_b;

  -- If either doesn't exist or work profile < 30%, return 0 (caller should fall back)
  IF v_a IS NULL OR v_b IS NULL THEN RETURN 0; END IF;
  IF v_a.work_profile_complete < 30 OR v_b.work_profile_complete < 30 THEN RETURN 0; END IF;

  -- 1. Complementary skills (30 pts max)
  v_overlaps := 0;
  SELECT COUNT(*) INTO v_overlaps FROM unnest(v_a.work_looking_for) AS a_lf WHERE a_lf = ANY(v_b.skills);
  SELECT v_overlaps + COUNT(*) INTO v_overlaps FROM unnest(v_b.work_looking_for) AS b_lf WHERE b_lf = ANY(v_a.skills);
  v_score := v_score + least(v_overlaps * 10, 30);

  -- 2. Shared topics and values (20 pts max)
  SELECT COUNT(*) INTO v_topic_overlaps FROM unnest(v_a.topics) AS at WHERE at = ANY(v_b.topics);
  SELECT COUNT(*) INTO v_value_overlaps FROM unnest(v_a."values") AS av WHERE av = ANY(v_b."values");
  v_score := v_score + least(v_topic_overlaps * 3 + v_value_overlaps * 4, 20);

  -- 3. Work style compatibility (15 pts max)
  IF v_a.peak_hours && v_b.peak_hours THEN v_score := v_score + 5; END IF;
  IF v_a.session_length_pref IS NOT NULL AND v_a.session_length_pref = v_b.session_length_pref THEN v_score := v_score + 5; END IF;
  IF v_a.conversation_depth IS NOT NULL AND v_b.conversation_depth IS NOT NULL THEN
    IF v_a.conversation_depth = v_b.conversation_depth THEN v_score := v_score + 5;
    ELSIF abs(
      CASE v_a.conversation_depth WHEN 'light' THEN 1 WHEN 'medium' THEN 2 WHEN 'deep' THEN 3 ELSE 2 END -
      CASE v_b.conversation_depth WHEN 'light' THEN 1 WHEN 'medium' THEN 2 WHEN 'deep' THEN 3 ELSE 2 END
    ) = 1 THEN v_score := v_score + 3;
    END IF;
  END IF;

  -- 4. Social compatibility (15 pts max)
  IF v_a.group_size_pref IS NOT NULL AND v_b.group_size_pref IS NOT NULL THEN
    IF v_a.group_size_pref = v_b.group_size_pref OR v_a.group_size_pref = 'any' OR v_b.group_size_pref = 'any' THEN
      v_score := v_score + 5;
    END IF;
  END IF;
  IF v_a.openness_to_new IS NOT NULL AND v_b.openness_to_new IS NOT NULL THEN
    IF v_a.openness_to_new >= 4 AND v_b.openness_to_new >= 3 THEN v_score := v_score + 5;
    ELSIF v_b.openness_to_new >= 4 AND v_a.openness_to_new >= 3 THEN v_score := v_score + 5;
    END IF;
  END IF;
  -- Introvert/extrovert from profiles
  DECLARE
    v_pa RECORD; v_pb RECORD;
  BEGIN
    SELECT communication_style INTO v_pa FROM profiles WHERE id = p_user_a;
    SELECT communication_style INTO v_pb FROM profiles WHERE id = p_user_b;
    IF v_pa.communication_style IS NOT NULL AND v_pb.communication_style IS NOT NULL AND v_pa.communication_style = v_pb.communication_style THEN
      v_score := v_score + 5;
    END IF;
  END;

  -- 5. Behavioral affinity (20 pts max)
  SELECT MAX(c.strength) INTO v_conn_strength
  FROM connections c
  WHERE (c.user_a = LEAST(p_user_a, p_user_b) AND c.user_b = GREATEST(p_user_a, p_user_b));
  IF v_conn_strength IS NOT NULL THEN
    v_score := v_score + least(v_conn_strength * 0.1, 10);
  END IF;
  -- Prop distribution similarity simplified: shared prop types
  DECLARE
    v_a_types text[];
    v_b_types text[];
    v_shared_props integer;
  BEGIN
    SELECT array_agg(DISTINCT (bs.metadata->>'prop_type')) INTO v_a_types
    FROM behavioral_signals bs WHERE bs.user_id = p_user_a AND bs.signal_type = 'prop_given' AND bs.metadata->>'prop_type' IS NOT NULL;
    SELECT array_agg(DISTINCT (bs.metadata->>'prop_type')) INTO v_b_types
    FROM behavioral_signals bs WHERE bs.user_id = p_user_b AND bs.signal_type = 'prop_given' AND bs.metadata->>'prop_type' IS NOT NULL;
    IF v_a_types IS NOT NULL AND v_b_types IS NOT NULL THEN
      SELECT COUNT(*) INTO v_shared_props FROM unnest(v_a_types) AS ap WHERE ap = ANY(v_b_types);
      IF v_shared_props >= 3 THEN v_score := v_score + 10;
      ELSIF v_shared_props >= 2 THEN v_score := v_score + 5;
      END IF;
    END IF;
  END;

  -- 6. Serendipity bonus
  SELECT COUNT(*) INTO v_industry_overlap FROM unnest(v_a.industries) AS ai WHERE ai = ANY(v_b.industries);
  IF v_industry_overlap = 0 THEN
    IF (v_topic_overlaps + v_value_overlaps) >= 2 THEN v_score := v_score + 15;
    ELSIF (v_topic_overlaps + v_value_overlaps) >= 1 THEN v_score := v_score + 8;
    END IF;
  END IF;

  RETURN least(v_score, 100);
END;
$$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
