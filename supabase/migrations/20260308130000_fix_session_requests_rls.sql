-- Fix: admin needs to read all session_requests, not just their own
-- Drop the restrictive policy and replace with one that allows all authenticated reads
DROP POLICY IF EXISTS "Users can read own requests" ON public.session_requests;

CREATE POLICY "Authenticated can read all requests" ON public.session_requests
  FOR SELECT TO authenticated USING (true);
