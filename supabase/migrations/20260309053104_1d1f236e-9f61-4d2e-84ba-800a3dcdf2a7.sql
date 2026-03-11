
-- ============================================================
-- SECURITY LOCKDOWN MIGRATION
-- ============================================================

-- 0. Add user_type column to profiles for admin checks
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'member';

-- ============================================================
-- 1. PERSONALITY_CONFIG — admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can manage personality config" ON personality_config;
DROP POLICY IF EXISTS "Authenticated can manage personality" ON personality_config;
DROP POLICY IF EXISTS "Authenticated users can manage personality_config" ON personality_config;
DROP POLICY IF EXISTS "Authenticated can read personality config" ON personality_config;

CREATE POLICY "Anyone can read personality config"
  ON personality_config FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage personality config"
  ON personality_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- ============================================================
-- 2. VENUE_PARTNERS — admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can manage partners" ON venue_partners;
DROP POLICY IF EXISTS "Authenticated can read active partners" ON venue_partners;

CREATE POLICY "Anyone can read venue partners"
  ON venue_partners FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert venue partners"
  ON venue_partners FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin can update venue partners"
  ON venue_partners FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Admin can delete venue partners"
  ON venue_partners FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- ============================================================
-- 3. ICEBREAKER_QUESTIONS — admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert icebreakers" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated can update times_used" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated users can insert icebreaker_questions" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated users can update icebreaker_questions" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated can read active icebreakers" ON icebreaker_questions;

CREATE POLICY "Anyone can read active icebreakers"
  ON icebreaker_questions FOR SELECT
  USING (active = true);

CREATE POLICY "Admin can manage icebreakers"
  ON icebreaker_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- ============================================================
-- 4. PROFILES — protect system columns via trigger
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION prevent_system_column_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  ) THEN
    NEW.user_type := OLD.user_type;
    NEW.reliability_status := OLD.reliability_status;
    NEW.no_show_count := OLD.no_show_count;
    NEW.sessions_rsvpd := OLD.sessions_rsvpd;
    NEW.sessions_showed_up := OLD.sessions_showed_up;
    NEW.captain_sessions := OLD.captain_sessions;
    NEW.focus_hours := OLD.focus_hours;
    NEW.is_table_captain := OLD.is_table_captain;
    NEW.current_streak := OLD.current_streak;
    NEW.events_attended := OLD.events_attended;
    NEW.events_no_show := OLD.events_no_show;
    NEW.focus_rank := OLD.focus_rank;
    NEW.profile_completion := OLD.profile_completion;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_system_columns ON profiles;
CREATE TRIGGER protect_system_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_column_changes();

-- ============================================================
-- 5. NOTIFICATIONS — lock down cross-user inserts
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION create_system_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text DEFAULT 'system',
  p_link text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (p_user_id, p_title, p_body, p_type, p_link);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. MEMBER_FLAGS — admin-only reads, prevent self-flagging
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read flags" ON member_flags;
DROP POLICY IF EXISTS "Users can insert own flags" ON member_flags;

CREATE POLICY "Admin can read all flags"
  ON member_flags FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Users can read own flags"
  ON member_flags FOR SELECT
  USING (flagged_by = auth.uid());

CREATE POLICY "Users can flag other members"
  ON member_flags FOR INSERT
  WITH CHECK (flagged_by = auth.uid() AND flagged_user != auth.uid());

-- ============================================================
-- 7. ANALYTICS_EVENTS — admin-only reads, validate user_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read analytics" ON analytics_events;
DROP POLICY IF EXISTS "Authenticated can insert analytics" ON analytics_events;

CREATE POLICY "Admin can read analytics"
  ON analytics_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Users can insert own analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- 8. SESSION_WAITLIST — proper ownership
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read waitlist" ON session_waitlist;
DROP POLICY IF EXISTS "Users can manage own waitlist" ON session_waitlist;
DROP POLICY IF EXISTS "Authenticated can manage waitlist" ON session_waitlist;

CREATE POLICY "Users can read own waitlist entries"
  ON session_waitlist FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can join waitlist"
  ON session_waitlist FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave waitlist"
  ON session_waitlist FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all waitlist"
  ON session_waitlist FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- ============================================================
-- 9. EVENT_RSVPS — prevent captain self-assignment
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_captain_self_assign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_captain = true AND NOT (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  ) THEN
    NEW.is_captain := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_captain_assignment ON event_rsvps;
CREATE TRIGGER protect_captain_assignment
  BEFORE INSERT OR UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION prevent_captain_self_assign();

-- ============================================================
-- 10. BADGES / ACHIEVEMENTS / TITLES — admin-only inserts + RPC
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own badges" ON member_badges;
DROP POLICY IF EXISTS "Authenticated users can insert member_badges" ON member_badges;

CREATE POLICY "Admin can award badges"
  ON member_badges FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Users can insert own achievements" ON exclusive_achievements;
DROP POLICY IF EXISTS "Authenticated can insert achievements" ON exclusive_achievements;
DROP POLICY IF EXISTS "Authenticated users can insert exclusive_achievements" ON exclusive_achievements;

CREATE POLICY "Admin can award achievements"
  ON exclusive_achievements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Users can insert own titles" ON monthly_titles;
DROP POLICY IF EXISTS "Authenticated can insert titles" ON monthly_titles;
DROP POLICY IF EXISTS "Authenticated users can insert monthly_titles" ON monthly_titles;

CREATE POLICY "Admin can award titles"
  ON monthly_titles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- RPC functions for awarding from client code
CREATE OR REPLACE FUNCTION award_badge(p_user_id uuid, p_badge_type text)
RETURNS void AS $$
BEGIN
  INSERT INTO member_badges (user_id, badge_type)
  VALUES (p_user_id, p_badge_type)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION award_milestone(p_user_id uuid, p_milestone_type text)
RETURNS void AS $$
BEGIN
  INSERT INTO member_milestones (user_id, milestone_type)
  VALUES (p_user_id, p_milestone_type)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 11. VENUE_SCANS — validate ownership
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert scans" ON venue_scans;
DROP POLICY IF EXISTS "Authenticated can insert scans" ON venue_scans;
DROP POLICY IF EXISTS "Authenticated users can insert venue_scans" ON venue_scans;

CREATE POLICY "Users can insert own scans"
  ON venue_scans FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- 12. UNIQUE CONSTRAINTS
-- ============================================================
ALTER TABLE event_feedback
  DROP CONSTRAINT IF EXISTS uq_event_feedback_event_user;
ALTER TABLE event_feedback
  ADD CONSTRAINT uq_event_feedback_event_user UNIQUE (event_id, user_id);

ALTER TABLE member_flags
  DROP CONSTRAINT IF EXISTS uq_member_flags_per_session;
ALTER TABLE member_flags
  ADD CONSTRAINT uq_member_flags_per_session UNIQUE (flagged_user, flagged_by, session_id);

-- ============================================================
-- 13. INDEXES on high-traffic columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_event_id ON event_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_peer_props_to_user ON peer_props(to_user);
CREATE INDEX IF NOT EXISTS idx_session_waitlist_event_id ON session_waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_member_flags_flagged_user ON member_flags(flagged_user);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_member_milestones_user_id ON member_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_member_badges_user_id ON member_badges(user_id);

-- ============================================================
-- 14. CHECK CONSTRAINTS on status columns
-- ============================================================
ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS chk_rsvp_status;
ALTER TABLE event_rsvps
  ADD CONSTRAINT chk_rsvp_status CHECK (status IN ('going', 'maybe', 'cancelled', 'waitlisted'));

ALTER TABLE event_feedback DROP CONSTRAINT IF EXISTS chk_feedback_rating;
ALTER TABLE event_feedback
  ADD CONSTRAINT chk_feedback_rating CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_reliability_status;
ALTER TABLE profiles
  ADD CONSTRAINT chk_reliability_status CHECK (reliability_status IN ('good', 'warning', 'restricted'));

ALTER TABLE energy_checks DROP CONSTRAINT IF EXISTS chk_energy_level;
ALTER TABLE energy_checks
  ADD CONSTRAINT chk_energy_level CHECK (energy_level >= 1 AND energy_level <= 5);

-- ============================================================
-- WAITLIST PROMOTION RPC (admin/system use)
-- ============================================================
CREATE OR REPLACE FUNCTION promote_waitlist(p_event_id uuid)
RETURNS uuid AS $$
DECLARE
  v_entry RECORD;
  v_event RECORD;
BEGIN
  SELECT * INTO v_entry FROM session_waitlist
    WHERE event_id = p_event_id AND promoted_at IS NULL
    ORDER BY position LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, v_entry.user_id, 'going');

  UPDATE session_waitlist SET promoted_at = now() WHERE id = v_entry.id;

  SELECT title, venue_name INTO v_event FROM events WHERE id = p_event_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (v_entry.user_id,
    'A spot opened up!',
    'You''re in for ' || COALESCE(v_event.title, 'the session') || COALESCE(' at ' || v_event.venue_name, '') || '. Confirm by showing up!',
    'waitlist_promoted',
    '/events/' || p_event_id::text);

  RETURN v_entry.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RELIABILITY UPDATE RPC (system use)
-- ============================================================
CREATE OR REPLACE FUNCTION update_reliability(
  p_user_id uuid,
  p_type text
)
RETURNS void AS $$
DECLARE
  v_prof RECORD;
  v_new_count integer;
  v_title text;
  v_body text;
BEGIN
  SELECT sessions_rsvpd, sessions_showed_up, no_show_count, reliability_status
  INTO v_prof FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_type = 'rsvp' THEN
    UPDATE profiles SET sessions_rsvpd = COALESCE(sessions_rsvpd, 0) + 1 WHERE id = p_user_id;
  ELSIF p_type = 'show' THEN
    UPDATE profiles SET sessions_showed_up = COALESCE(sessions_showed_up, 0) + 1 WHERE id = p_user_id;
  ELSIF p_type = 'no_show' THEN
    v_new_count := COALESCE(v_prof.no_show_count, 0) + 1;
    UPDATE profiles SET
      no_show_count = v_new_count,
      reliability_status = CASE
        WHEN v_new_count >= 3 THEN 'restricted'
        WHEN v_new_count >= 2 THEN 'warning'
        ELSE COALESCE(reliability_status, 'good')
      END
    WHERE id = p_user_id;

    IF v_new_count = 1 THEN
      v_title := 'We missed you';
      v_body := 'Your table noticed. Life happens — just let us know next time.';
    ELSIF v_new_count = 2 THEN
      v_title := 'Two missed sessions';
      v_body := 'Cancelling early helps us fill your spot. Your reliability score may be affected.';
    ELSIF v_new_count >= 3 THEN
      v_title := 'Reliability update';
      v_body := 'For your next 3 sessions, you''ll need to confirm 2 hours before. We want you there — this just helps everyone plan.';
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, body, type, link)
      VALUES (p_user_id, v_title, v_body, 'reliability', '/events');
    END IF;
  ELSIF p_type = 'late_cancel' THEN
    UPDATE profiles SET no_show_count = COALESCE(no_show_count, 0) + 1 WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
