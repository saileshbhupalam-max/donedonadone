-- Fix 1: Allow any authenticated user to INSERT notifications for any user
-- This is needed for:
--   - Admin sending batch notifications when active prompt changes
--   - Referral notifications (user A creates notification for user B)
--   - Badge award notifications triggered by other users' actions (fire reactions)
-- Risk is low: notifications are read-only by the recipient via their own SELECT policy

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;

CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix 2: Restrict app_settings UPDATE to admin emails only
-- Uses a subquery against profiles to check if the current user's email is admin
DROP POLICY IF EXISTS "Authenticated can update settings" ON public.app_settings;

CREATE POLICY "Only admins can update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND email IN ('saileshbhupalam@gmail.com')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND email IN ('saileshbhupalam@gmail.com')
    )
  );

-- Fix 3: Enforce women_only event creation at DB level
-- Only women can create women_only events
DROP POLICY IF EXISTS "Users can create events" ON public.events;

CREATE POLICY "Users can create events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      women_only = false
      OR (women_only = true AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gender = 'woman'
      ))
    )
  );
