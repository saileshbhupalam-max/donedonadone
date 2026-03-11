
-- Member milestones table
CREATE TABLE public.member_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  milestone_type text NOT NULL CHECK (milestone_type IN (
    'first_event', 'events_3', 'events_5', 'events_10', 'events_25', 'events_50',
    'first_prop_given', 'first_prop_received', 'props_received_25', 'props_received_50',
    'first_prompt_answer', 'prompts_5', 'prompts_all',
    'streak_3', 'streak_5', 'streak_10',
    'referral_1', 'referral_3', 'referral_10',
    'member_1_month', 'member_3_months', 'member_6_months', 'member_1_year'
  )),
  achieved_at timestamptz DEFAULT now(),
  shared boolean DEFAULT false,
  UNIQUE(user_id, milestone_type)
);

ALTER TABLE public.member_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own milestones" ON public.member_milestones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones" ON public.member_milestones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestones" ON public.member_milestones
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Analytics events table
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'page_view', 'share_click', 'qr_scan', 'referral_visit',
    'signup', 'onboarding_complete', 'first_rsvp', 'first_feedback'
  )),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert analytics" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can read analytics" ON public.analytics_events
  FOR SELECT TO authenticated USING (true);
