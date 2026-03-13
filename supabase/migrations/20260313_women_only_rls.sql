-- TD-002: Enforce women-only session restriction at DB level
-- This prevents direct API bypasses of the client-side check
--
-- IMPORTANT: Before applying, check existing policies:
--   SELECT * FROM pg_policies WHERE tablename = 'event_rsvps';
--   Drop conflicting policies if needed before applying.
--
-- This migration replaces the existing INSERT policy on event_rsvps
-- ("Users can insert own rsvps") with one that also enforces women-only
-- session restrictions. The SELECT, UPDATE, and DELETE policies from
-- migration 20260308115655 remain unchanged.

-- Drop the existing INSERT policy that lacks women-only enforcement
DROP POLICY IF EXISTS "Users can insert own rsvps" ON public.event_rsvps;

-- Policy: Allow INSERT only if:
--   1) The authenticated user is inserting for themselves (auth.uid() = user_id), AND
--   2) Either the event is NOT women-only, OR the user's profile gender is 'woman' or 'female'
CREATE POLICY "Users can insert own rsvps" ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE events.id = event_rsvps.event_id
        AND events.women_only = true
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.gender = 'woman' OR profiles.gender = 'female')
      )
    )
  );
