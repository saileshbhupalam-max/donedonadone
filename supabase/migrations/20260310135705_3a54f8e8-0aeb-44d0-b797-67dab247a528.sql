
-- Drop functions with return type changes first
DROP FUNCTION IF EXISTS create_system_notification(UUID, TEXT, TEXT, TEXT, TEXT);

-- 1d. create_system_notification
CREATE FUNCTION create_system_notification(
  p_user_id UUID, p_title TEXT, p_body TEXT,
  p_type TEXT DEFAULT 'system', p_action_url TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_caller_type TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
    IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  END IF;
  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (p_user_id, p_title, p_body, p_type, p_action_url)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 1e. award_badge
CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_badge_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller_type TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
    IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  END IF;
  INSERT INTO member_badges (user_id, badge_type)
  VALUES (p_user_id, p_badge_type)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 1f. award_milestone
CREATE OR REPLACE FUNCTION award_milestone(p_user_id UUID, p_milestone_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller_type TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
    IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  END IF;
  INSERT INTO member_milestones (user_id, milestone_type)
  VALUES (p_user_id, p_milestone_type)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 1g. update_reliability
CREATE OR REPLACE FUNCTION update_reliability(p_user_id UUID, p_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_type TEXT;
  v_count INT;
BEGIN
  SELECT user_type INTO v_caller_type FROM profiles WHERE id = auth.uid();
  IF v_caller_type != 'admin' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_type = 'no_show' THEN
    UPDATE profiles SET no_show_count = COALESCE(no_show_count, 0) + 1 WHERE id = p_user_id;
    SELECT no_show_count INTO v_count FROM profiles WHERE id = p_user_id;
    IF v_count >= 3 THEN
      UPDATE profiles SET reliability_status = 'restricted' WHERE id = p_user_id;
      PERFORM create_system_notification(p_user_id, 'Account restricted', 'Multiple no-shows detected.', 'warning');
    ELSIF v_count >= 2 THEN
      PERFORM create_system_notification(p_user_id, 'No-show warning', 'One more no-show may restrict your account.', 'warning');
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- PART 2: Revoke EXECUTE on internal-only functions
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_behavioral_signal') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION record_behavioral_signal FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION record_behavioral_signal FROM public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_connection') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION upsert_connection FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION upsert_connection FROM public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_streak') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION update_user_streak FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION update_user_streak FROM public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_location_member_count') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION increment_location_member_count FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION increment_location_member_count FROM public';
  END IF;
END $$;

-- ============================================================
-- PART 3: Fix RLS policy gaps
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'venue_partners' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "Anyone can read venue partners" ON venue_partners;
    EXECUTE 'CREATE POLICY "Authenticated can read venue partners" ON venue_partners FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can read personality config" ON personality_config;
CREATE POLICY "Authenticated can read personality config" ON personality_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can update settings" ON app_settings;
CREATE POLICY "Admin can update settings" ON app_settings
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- ============================================================
-- PART 4: Add partner_user_id to locations
-- ============================================================
ALTER TABLE locations ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES profiles(id);

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
    status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_application_id;
  UPDATE profiles SET user_type = 'partner' WHERE id = v_app.user_id;
  INSERT INTO locations (name, location_type, neighborhood, city, latitude, longitude, radius_meters, verified, is_partner, partner_user_id)
  VALUES (
    v_app.venue_name, v_app.venue_type, v_app.neighborhood, v_app.city,
    COALESCE(v_app.latitude, 0)::numeric, COALESCE(v_app.longitude, 0)::numeric,
    200, true, true, v_app.user_id
  )
  RETURNING id INTO v_location_id;
  PERFORM create_system_notification(
    v_app.user_id,
    'Application Approved!',
    'Your venue "' || v_app.venue_name || '" has been approved. Welcome to FocusClub as a partner!',
    'partner_approved', '/partner'
  );
  RETURN v_location_id;
END;
$$;
