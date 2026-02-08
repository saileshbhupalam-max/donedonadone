-- Admin RLS policies: admin users can SELECT all tables, UPDATE bookings/venues, INSERT/DELETE groups.

-- Helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: admin can view all (already allowed by existing policy)

-- Coworker Preferences: admin can view all
DROP POLICY IF EXISTS "Admins can view all preferences" ON coworker_preferences;
CREATE POLICY "Admins can view all preferences" ON coworker_preferences
  FOR SELECT USING (is_admin());

-- Venues: admin can view all + update any
DROP POLICY IF EXISTS "Admins can view all venues" ON venues;
CREATE POLICY "Admins can view all venues" ON venues
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update any venue" ON venues;
CREATE POLICY "Admins can update any venue" ON venues
  FOR UPDATE USING (is_admin());

-- Sessions: admin can view all (already allowed) + update any
DROP POLICY IF EXISTS "Admins can update any session" ON sessions;
CREATE POLICY "Admins can update any session" ON sessions
  FOR UPDATE USING (is_admin());

-- Bookings: admin can view all + update any
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update any booking" ON bookings;
CREATE POLICY "Admins can update any booking" ON bookings
  FOR UPDATE USING (is_admin());

-- Groups: admin can view all (already allowed) + insert + delete
DROP POLICY IF EXISTS "Admins can insert groups" ON groups;
CREATE POLICY "Admins can insert groups" ON groups
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete groups" ON groups;
CREATE POLICY "Admins can delete groups" ON groups
  FOR DELETE USING (is_admin());

-- Group Members: admin can view all (already allowed) + insert + delete
DROP POLICY IF EXISTS "Admins can insert group members" ON group_members;
CREATE POLICY "Admins can insert group members" ON group_members
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete group members" ON group_members;
CREATE POLICY "Admins can delete group members" ON group_members
  FOR DELETE USING (is_admin());

-- Session Feedback: admin can view all
DROP POLICY IF EXISTS "Admins can view all feedback" ON session_feedback;
CREATE POLICY "Admins can view all feedback" ON session_feedback
  FOR SELECT USING (is_admin());

-- Member Ratings: admin can view all
DROP POLICY IF EXISTS "Admins can view all member ratings" ON member_ratings;
CREATE POLICY "Admins can view all member ratings" ON member_ratings
  FOR SELECT USING (is_admin());

-- Waitlist: admin can view all
DROP POLICY IF EXISTS "Admins can view all waitlist" ON waitlist;
CREATE POLICY "Admins can view all waitlist" ON waitlist
  FOR SELECT USING (is_admin());
