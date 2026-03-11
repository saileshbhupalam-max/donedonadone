
-- Fix 1: Make taste_graph_public view SECURITY INVOKER (it defaults to SECURITY DEFINER)
DROP VIEW IF EXISTS public.taste_graph_public;
CREATE VIEW public.taste_graph_public
WITH (security_invoker = true)
AS
SELECT
  user_id,
  industries,
  role_type,
  skills,
  current_project,
  project_stage,
  hobbies,
  topics,
  "values",
  work_profile_complete,
  play_profile_complete,
  CASE WHEN company_visible THEN company_name ELSE NULL END AS company_name
FROM public.taste_graph;

GRANT SELECT ON public.taste_graph_public TO authenticated;

-- Fix 2: Add a restrictive policy on behavioral_signals so the "RLS enabled no policy" warning goes away
-- Admin can read all signals for analytics
CREATE POLICY "Admin can read signals" ON public.behavioral_signals
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));
