
-- Event feedback table
CREATE TABLE public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer,
  comment text,
  attended boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read feedback" ON public.event_feedback
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own feedback" ON public.event_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON public.event_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Session requests table
CREATE TABLE public.session_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  request_type text DEFAULT 'general',
  preferred_days text[],
  preferred_time text,
  neighborhood text,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.session_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own requests" ON public.session_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests" ON public.session_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add attendance tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS events_attended integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS events_no_show integer DEFAULT 0;
