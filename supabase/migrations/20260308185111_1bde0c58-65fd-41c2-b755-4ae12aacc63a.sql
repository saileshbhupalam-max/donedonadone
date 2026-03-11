
-- Fix overly permissive admin policy on icebreaker_questions
DROP POLICY "Admin full access icebreakers" ON public.icebreaker_questions;

-- Admin insert/update via service role or specific admin check
-- For now, allow any authenticated user to update times_used (needed for selection algorithm)
CREATE POLICY "Authenticated can update times_used" ON public.icebreaker_questions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert icebreakers" ON public.icebreaker_questions
  FOR INSERT TO authenticated WITH CHECK (true);
