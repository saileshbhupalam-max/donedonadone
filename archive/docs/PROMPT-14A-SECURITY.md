# Prompt 14A — Security Hardening (RLS + Constraints + Indexes)

A deep system audit found 14 critical security holes in the database. Any authenticated user can currently: modify admin-only tables, self-promote to admin, self-award badges/milestones, fabricate analytics, send fake notifications to other users, and read sensitive moderation data. All of these need to be locked down in a single migration.

---

## Create a new migration that does ALL of the following:

### 1. Lock down `personality_config` — admin-only writes

```sql
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated can manage personality" ON personality_config;
DROP POLICY IF EXISTS "Authenticated users can manage personality_config" ON personality_config;

-- Keep read access for all (PersonalityProvider needs it)
CREATE POLICY "Anyone can read personality config"
  ON personality_config FOR SELECT
  USING (true);

-- Only admin can write
CREATE POLICY "Admin can manage personality config"
  ON personality_config FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
```

### 2. Lock down `venue_partners` — admin-only writes

```sql
DROP POLICY IF EXISTS "Authenticated can manage partners" ON venue_partners;

CREATE POLICY "Anyone can read venue partners"
  ON venue_partners FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage venue partners"
  ON venue_partners FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Admin can update venue partners"
  ON venue_partners FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Admin can delete venue partners"
  ON venue_partners FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
```

### 3. Lock down `icebreaker_questions` — admin-only writes

```sql
DROP POLICY IF EXISTS "Authenticated can insert icebreakers" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated can update times_used" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated users can insert icebreaker_questions" ON icebreaker_questions;
DROP POLICY IF EXISTS "Authenticated users can update icebreaker_questions" ON icebreaker_questions;

CREATE POLICY "Anyone can read icebreakers"
  ON icebreaker_questions FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage icebreakers"
  ON icebreaker_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
```

### 4. Protect system-managed profile columns

Users can currently UPDATE their own `user_type`, `reliability_status`, `no_show_count`, `sessions_rsvpd`, `sessions_showed_up`, `captain_sessions`, `focus_hours`, `is_table_captain`, `current_streak`, `longest_streak`, `events_attended`, `events_no_show`. These are all system-managed.

Create a SECURITY DEFINER function for safe profile updates, and tighten the UPDATE policy:

```sql
-- Drop the existing overly permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- New update policy: users can only update their own row
-- The actual column restriction is enforced via a trigger
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to prevent users from modifying system columns
CREATE OR REPLACE FUNCTION prevent_system_column_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- If the caller is not service_role or admin, block system column changes
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
    NEW.longest_streak := OLD.longest_streak;
    NEW.events_attended := OLD.events_attended;
    NEW.events_no_show := OLD.events_no_show;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_system_columns ON profiles;
CREATE TRIGGER protect_system_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_column_changes();
```

### 5. Lock down `notifications` INSERT

Any user can currently send fake notifications to any other user.

```sql
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- Users can only create notifications for themselves (self-notifications)
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

Then create a SECURITY DEFINER function for system-originated notifications (used by props, referrals, milestones, etc.):

```sql
CREATE OR REPLACE FUNCTION create_system_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text DEFAULT 'system'
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (p_user_id, p_title, p_message, p_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Update all notification creation code to use `supabase.rpc('create_system_notification', { ... })` instead of direct inserts when the target user is not the current user. Key locations:
- `GivePropsFlow.tsx` — when sending props notification to another user
- `Onboarding.tsx` — when sending referral notification to the referrer
- `antifragile.ts` — waitlist promotion notifications, reliability warnings

### 6. Restrict `member_flags` SELECT + prevent self-flagging

```sql
DROP POLICY IF EXISTS "Authenticated can read flags" ON member_flags;
DROP POLICY IF EXISTS "Authenticated can insert flags" ON member_flags;

-- Only admin can read all flags
CREATE POLICY "Admin can read all flags"
  ON member_flags FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Users can also read flags they created (to prevent duplicate submissions)
CREATE POLICY "Users can read own flags"
  ON member_flags FOR SELECT
  USING (flagged_by = auth.uid());

-- Users can flag others but NOT themselves
CREATE POLICY "Users can flag other members"
  ON member_flags FOR INSERT
  WITH CHECK (
    flagged_by = auth.uid()
    AND flagged_user != auth.uid()
  );
```

### 7. Lock down `analytics_events` — validate user_id, admin-only reads

```sql
DROP POLICY IF EXISTS "Authenticated can read analytics" ON analytics_events;
DROP POLICY IF EXISTS "Authenticated can insert analytics" ON analytics_events;

-- Only admin can read all analytics
CREATE POLICY "Admin can read analytics"
  ON analytics_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- Users can only insert events for themselves
CREATE POLICY "Users can insert own analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

### 8. Validate `session_waitlist` ownership

```sql
DROP POLICY IF EXISTS "Authenticated can manage waitlist" ON session_waitlist;
DROP POLICY IF EXISTS "Authenticated users can manage session_waitlist" ON session_waitlist;

CREATE POLICY "Users can read own waitlist entries"
  ON session_waitlist FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can join waitlist for themselves"
  ON session_waitlist FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave waitlist"
  ON session_waitlist FOR DELETE
  USING (user_id = auth.uid());

-- Admin can manage all waitlist entries
CREATE POLICY "Admin can manage all waitlist"
  ON session_waitlist FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
```

### 9. Prevent `is_captain` self-assignment in `event_rsvps`

```sql
-- Add trigger to prevent non-admin from setting is_captain
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_captain_assignment ON event_rsvps;
CREATE TRIGGER protect_captain_assignment
  BEFORE INSERT OR UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION prevent_captain_self_assign();
```

### 10. Lock down badge/achievement/title self-award

```sql
-- member_badges
DROP POLICY IF EXISTS "Users can insert own badges" ON member_badges;
DROP POLICY IF EXISTS "Authenticated users can insert member_badges" ON member_badges;

CREATE POLICY "System can award badges"
  ON member_badges FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- exclusive_achievements
DROP POLICY IF EXISTS "Authenticated can insert achievements" ON exclusive_achievements;
DROP POLICY IF EXISTS "Authenticated users can insert exclusive_achievements" ON exclusive_achievements;

CREATE POLICY "System can award achievements"
  ON exclusive_achievements FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- monthly_titles
DROP POLICY IF EXISTS "Authenticated can insert titles" ON monthly_titles;
DROP POLICY IF EXISTS "Authenticated users can insert monthly_titles" ON monthly_titles;

CREATE POLICY "System can award titles"
  ON monthly_titles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
```

Then create SECURITY DEFINER functions for awarding these from client code:

```sql
CREATE OR REPLACE FUNCTION award_badge(p_user_id uuid, p_badge_type text)
RETURNS void AS $$
BEGIN
  INSERT INTO member_badges (user_id, badge_type)
  VALUES (p_user_id, p_badge_type)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION award_milestone(p_user_id uuid, p_milestone_type text, p_milestone_value integer DEFAULT 0)
RETURNS void AS $$
BEGIN
  INSERT INTO member_milestones (user_id, milestone_type, milestone_value)
  VALUES (p_user_id, p_milestone_type, p_milestone_value)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Update all client-side badge/milestone award code to use `supabase.rpc('award_badge', { ... })` and `supabase.rpc('award_milestone', { ... })` instead of direct inserts.

### 11. Lock down `venue_scans`

```sql
DROP POLICY IF EXISTS "Authenticated can insert scans" ON venue_scans;
DROP POLICY IF EXISTS "Authenticated users can insert venue_scans" ON venue_scans;

CREATE POLICY "Users can insert own scans"
  ON venue_scans FOR INSERT
  WITH CHECK (scanned_by = auth.uid());
```

### 12. Add unique constraints

```sql
ALTER TABLE event_feedback
  ADD CONSTRAINT uq_event_feedback_event_user UNIQUE (event_id, user_id);

ALTER TABLE session_waitlist
  ADD CONSTRAINT uq_session_waitlist_user_session UNIQUE (user_id, session_id);

ALTER TABLE member_flags
  ADD CONSTRAINT uq_member_flags_per_session UNIQUE (flagged_user, flagged_by, session_id);
```

### 13. Add indexes on high-traffic columns

```sql
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_session_id ON session_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_member_ratings_to_user ON member_ratings(to_user);
CREATE INDEX IF NOT EXISTS idx_session_waitlist_session_id ON session_waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_member_flags_flagged_user ON member_flags(flagged_user);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_member_milestones_user_id ON member_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_peer_props_to_user ON peer_props(to_user);
```

### 14. Add CHECK constraints on status columns

```sql
ALTER TABLE event_rsvps
  ADD CONSTRAINT chk_rsvp_status CHECK (status IN ('going', 'maybe', 'cancelled', 'waitlisted'));

ALTER TABLE event_feedback
  ADD CONSTRAINT chk_feedback_rating CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE profiles
  ADD CONSTRAINT chk_reliability_status CHECK (reliability_status IN ('good', 'WARNING', 'RESTRICTED'));

ALTER TABLE energy_checks
  ADD CONSTRAINT chk_energy_level CHECK (energy_level >= 1 AND energy_level <= 5);
```

---

## Important: Update client code for RPC calls

After the migration, update these files to use the new RPC functions instead of direct inserts:

1. **Badge awarding** (wherever `supabase.from('member_badges').insert(...)` appears):
   → Replace with `supabase.rpc('award_badge', { p_user_id: userId, p_badge_type: badgeType })`

2. **Milestone awarding** (wherever `supabase.from('member_milestones').insert(...)` appears):
   → Replace with `supabase.rpc('award_milestone', { p_user_id: userId, p_milestone_type: type, p_milestone_value: value })`

3. **Cross-user notifications** (in GivePropsFlow.tsx, Onboarding.tsx, antifragile.ts):
   → Replace `supabase.from('notifications').insert({ user_id: OTHER_USER, ... })` with `supabase.rpc('create_system_notification', { p_user_id: otherUserId, p_title: title, p_message: message, p_type: type })`

4. **Waitlist promotion** in `antifragile.ts` `promoteWaitlist()`:
   → The function deletes from waitlist and inserts RSVP + notification for another user. Wrap this in a SECURITY DEFINER RPC function too, or have the admin trigger it.

Put ALL the SQL above into a single new migration file. Make sure to check if each policy exists before dropping (use IF EXISTS). The client code changes (RPC calls) should be done in the same commit.
