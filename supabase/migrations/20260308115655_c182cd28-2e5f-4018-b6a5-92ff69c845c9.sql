
-- Events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date date NOT NULL,
  start_time text,
  end_time text,
  venue_name text,
  venue_address text,
  neighborhood text,
  whatsapp_group_link text,
  max_spots integer,
  women_only boolean DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  rsvp_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events SELECT: women_only filtering
CREATE POLICY "Users can view events" ON public.events
  FOR SELECT TO authenticated
  USING (
    women_only = false
    OR (women_only = true AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gender = 'woman'
    ))
  );

CREATE POLICY "Users can create events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update events" ON public.events
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete events" ON public.events
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Event RSVPs table
CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read rsvps" ON public.event_rsvps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own rsvps" ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rsvps" ON public.event_rsvps
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rsvps" ON public.event_rsvps
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Seed events
INSERT INTO public.events (title, description, date, start_time, end_time, venue_name, venue_address, neighborhood, max_spots, women_only) VALUES
  ('Deep Focus Saturday', 'A quiet coworking session for those who want to get serious work done. Bring your laptop, headphones, and focus playlist.', (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7 + 1)::date, '10:00 AM', '1:00 PM', 'Third Wave Coffee', '27th Main, HSR Layout', 'hsr_layout', 15, false),
  ('Women in Tech Cowork', 'A cozy Sunday coworking session exclusively for women in the community. Great coffee, good vibes, and meaningful connections.', (CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7 + 1)::date, '11:00 AM', '2:00 PM', 'Dialogues Cafe', 'Koramangala 4th Block', 'koramangala', NULL, true),
  ('Casual Cowork & Coffee', 'Last week''s casual meetup at Starbucks. Great turnout and awesome conversations!', (CURRENT_DATE - 7)::date, '3:00 PM', '6:00 PM', 'Starbucks Reserve', 'Indiranagar 12th Main', 'indiranagar', 20, false);
