
-- Fix overly permissive INSERT policy on notification_log
DROP POLICY "Service role inserts notification logs" ON public.notification_log;

CREATE POLICY "Users insert own notification logs"
  ON public.notification_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
