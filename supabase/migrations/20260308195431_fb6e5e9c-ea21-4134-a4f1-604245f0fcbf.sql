
-- personality_config table for Chai voice system
CREATE TABLE public.personality_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text,
  value text NOT NULL,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.personality_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read personality config"
  ON public.personality_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage personality config"
  ON public.personality_config FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- member_flags table for community immune system
CREATE TABLE public.member_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_user uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  flagged_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL CHECK (reason IN ('uncomfortable', 'disruptive', 'inappropriate', 'no_show_pattern', 'other')),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(flagged_by, flagged_user, session_id)
);

ALTER TABLE public.member_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own flags"
  ON public.member_flags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = flagged_by);

CREATE POLICY "Authenticated can read flags"
  ON public.member_flags FOR SELECT TO authenticated
  USING (true);

-- session_waitlist table
CREATE TABLE public.session_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  promoted_at timestamptz,
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own waitlist"
  ON public.session_waitlist FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read waitlist"
  ON public.session_waitlist FOR SELECT TO authenticated
  USING (true);

-- Add captain and reliability columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_table_captain boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS captain_sessions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_rsvpd integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_showed_up integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_status text DEFAULT 'good';

-- Add is_captain to event_rsvps
ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS is_captain boolean DEFAULT false;
