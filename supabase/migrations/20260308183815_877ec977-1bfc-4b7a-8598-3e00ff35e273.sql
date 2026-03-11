
-- Peer Props table
CREATE TABLE public.peer_props (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  prop_type text NOT NULL CHECK (prop_type IN ('energy','helpful','focused','inspiring','fun','kind')),
  anonymous boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user, to_user, event_id, prop_type)
);

ALTER TABLE public.peer_props ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert props for events they RSVPed going" ON public.peer_props
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND from_user != to_user
    AND EXISTS (
      SELECT 1 FROM public.event_rsvps
      WHERE event_rsvps.event_id = peer_props.event_id
        AND event_rsvps.user_id = auth.uid()
        AND event_rsvps.status = 'going'
    )
  );

CREATE POLICY "Users can read props received" ON public.peer_props
  FOR SELECT TO authenticated
  USING (to_user = auth.uid() OR from_user = auth.uid());

-- Session phases table
CREATE TABLE public.session_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  phase_order int NOT NULL,
  phase_type text NOT NULL CHECK (phase_type IN ('icebreaker','deep_work','mini_break','social_break','wrap_up')),
  phase_label text NOT NULL,
  duration_minutes int NOT NULL,
  started_at timestamptz,
  ended_at timestamptz
);

ALTER TABLE public.session_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read session phases" ON public.session_phases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Event creator can manage phases" ON public.session_phases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = session_phases.event_id AND events.created_by = auth.uid())
  );

CREATE POLICY "Event creator can update phases" ON public.session_phases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = session_phases.event_id AND events.created_by = auth.uid())
  );

-- Session intentions table
CREATE TABLE public.session_intentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  intention text NOT NULL,
  accomplished text CHECK (accomplished IN ('yes','partially','no')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.session_intentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read intentions for their events" ON public.session_intentions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own intentions" ON public.session_intentions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intentions" ON public.session_intentions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Member status (traffic light) table
CREATE TABLE public.member_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'green' CHECK (status IN ('red','amber','green')),
  until_time timestamptz,
  topic text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.member_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can update own status" ON public.member_status
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own status" ON public.member_status
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read statuses" ON public.member_status
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can delete own status" ON public.member_status
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for member_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_status;

-- Add session_format and vibe_soundtrack to events
ALTER TABLE public.events ADD COLUMN session_format text DEFAULT 'casual' CHECK (session_format IN ('structured_4hr','structured_2hr','casual'));
ALTER TABLE public.events ADD COLUMN vibe_soundtrack text;

-- Add intentions_completed and current_streak to profiles
ALTER TABLE public.profiles ADD COLUMN intentions_completed int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN current_streak int DEFAULT 0;
