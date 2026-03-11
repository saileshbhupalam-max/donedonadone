
-- Partner applications table
CREATE TABLE partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  venue_type TEXT NOT NULL,
  address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bangalore',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_phone TEXT,
  contact_email TEXT,
  description TEXT,
  amenities TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  wifi_available BOOLEAN DEFAULT true,
  seating_capacity INT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Validation trigger instead of CHECK constraints
CREATE OR REPLACE FUNCTION trg_validate_partner_application()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.venue_type NOT IN ('cafe', 'coworking_space', 'tech_park', 'neighborhood', 'other') THEN
    RAISE EXCEPTION 'venue_type must be cafe, coworking_space, tech_park, neighborhood, or other';
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'status must be pending, approved, or rejected';
  END IF;
  IF NEW.description IS NOT NULL AND length(NEW.description) > 500 THEN
    RAISE EXCEPTION 'description must be 500 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_partner_application
  BEFORE INSERT OR UPDATE ON partner_applications
  FOR EACH ROW EXECUTE FUNCTION trg_validate_partner_application();

-- RLS
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own application"
  ON partner_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can see all applications"
  ON partner_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Users can create own application"
  ON partner_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update applications"
  ON partner_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- Index for admin queries
CREATE INDEX idx_partner_applications_status ON partner_applications(status);

-- Approve partner application RPC
CREATE OR REPLACE FUNCTION approve_partner_application(p_application_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app RECORD;
  v_location_id UUID;
  v_caller_type TEXT;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM partner_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status != 'pending' THEN RAISE EXCEPTION 'Application already reviewed'; END IF;

  UPDATE partner_applications SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_application_id;

  INSERT INTO locations (name, location_type, neighborhood, city, latitude, longitude, radius_meters, verified, is_partner)
  VALUES (
    v_app.venue_name,
    v_app.venue_type,
    v_app.neighborhood,
    v_app.city,
    COALESCE(v_app.latitude, 0)::numeric,
    COALESCE(v_app.longitude, 0)::numeric,
    200,
    true,
    true
  )
  RETURNING id INTO v_location_id;

  PERFORM create_system_notification(
    v_app.user_id,
    'Your venue has been approved! 🎉',
    v_app.venue_name || ' is now a FocusClub partner venue. Welcome aboard!',
    'partner_approved',
    '/partner'
  );

  RETURN v_location_id;
END;
$$;

-- Reject partner application RPC
CREATE OR REPLACE FUNCTION reject_partner_application(p_application_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app RECORD;
  v_caller_type TEXT;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_app FROM partner_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;

  UPDATE partner_applications SET
    status = 'rejected',
    rejection_reason = p_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = p_application_id;

  PERFORM create_system_notification(
    v_app.user_id,
    'Your venue application needs changes',
    CASE WHEN p_reason IS NOT NULL THEN 'Reason: ' || p_reason ELSE 'Please contact us for more details.' END,
    'partner_rejected',
    '/partner/apply'
  );
END;
$$;

-- Get partner stats RPC
CREATE OR REPLACE FUNCTION get_partner_stats(p_location_id UUID)
RETURNS TABLE (
  total_checkins BIGINT,
  unique_visitors BIGINT,
  avg_session_minutes NUMERIC,
  checkins_today BIGINT,
  checkins_this_week BIGINT,
  top_times TEXT[],
  repeat_rate NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total BIGINT;
  v_unique BIGINT;
  v_avg NUMERIC;
  v_today BIGINT;
  v_week BIGINT;
  v_top TEXT[];
  v_repeat NUMERIC;
  v_repeat_visitors BIGINT;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT ci.user_id)
  INTO v_total, v_unique
  FROM check_ins ci WHERE ci.location_id = p_location_id;

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ci.checked_out_at - ci.checked_in_at)) / 60), 0)
  INTO v_avg
  FROM check_ins ci
  WHERE ci.location_id = p_location_id AND ci.checked_out_at IS NOT NULL;

  SELECT COUNT(*) INTO v_today
  FROM check_ins ci WHERE ci.location_id = p_location_id AND ci.checked_in_at::date = CURRENT_DATE;

  SELECT COUNT(*) INTO v_week
  FROM check_ins ci WHERE ci.location_id = p_location_id AND ci.checked_in_at >= (CURRENT_DATE - interval '7 days');

  SELECT COALESCE(array_agg(hour_label ORDER BY cnt DESC), '{}'::text[])
  INTO v_top
  FROM (
    SELECT to_char(ci.checked_in_at, 'HH12-') || to_char(ci.checked_in_at + interval '1 hour', 'HH12 AM') AS hour_label,
           COUNT(*) AS cnt
    FROM check_ins ci WHERE ci.location_id = p_location_id
    GROUP BY hour_label ORDER BY cnt DESC LIMIT 3
  ) sub;

  SELECT COUNT(*) INTO v_repeat_visitors
  FROM (
    SELECT ci.user_id FROM check_ins ci WHERE ci.location_id = p_location_id
    GROUP BY ci.user_id HAVING COUNT(*) > 1
  ) sub;

  IF v_unique > 0 THEN
    v_repeat := round((v_repeat_visitors::numeric / v_unique) * 100, 1);
  ELSE
    v_repeat := 0;
  END IF;

  RETURN QUERY SELECT v_total, v_unique, round(v_avg, 0), v_today, v_week, v_top, v_repeat;
END;
$$;
