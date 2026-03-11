
-- Icebreaker questions table
CREATE TABLE public.icebreaker_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  category text NOT NULL CHECK (category IN ('quick_fire','pair_share','group_challenge','intention_set')),
  depth text NOT NULL CHECK (depth IN ('light','medium','deep')),
  emoji text DEFAULT '💬',
  active boolean DEFAULT true,
  times_used int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.icebreaker_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active icebreakers" ON public.icebreaker_questions
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Admin full access icebreakers" ON public.icebreaker_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Energy checks table
CREATE TABLE public.energy_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  energy_level int NOT NULL CHECK (energy_level >= 1 AND energy_level <= 5),
  phase text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id, phase)
);

ALTER TABLE public.energy_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own energy checks" ON public.energy_checks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read energy checks" ON public.energy_checks
  FOR SELECT TO authenticated USING (true);

-- Session photos table
CREATE TABLE public.session_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.session_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own photos" ON public.session_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read photos" ON public.session_photos
  FOR SELECT TO authenticated USING (true);

-- Session photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('session-photos', 'session-photos', true);

CREATE POLICY "Users can upload session photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'session-photos');

CREATE POLICY "Anyone can read session photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'session-photos');

-- Seed icebreaker questions
INSERT INTO public.icebreaker_questions (question, category, depth, emoji) VALUES
-- Quick Fire Light
('Coffee order that describes your personality?', 'quick_fire', 'light', '☕'),
('If your work style was weather, what would it be?', 'quick_fire', 'light', '🌤️'),
('Song that matches your current project''s energy?', 'quick_fire', 'light', '🎵'),
('Favorite spot in HSR Layout to think?', 'quick_fire', 'light', '🏠'),
('App you couldn''t live without for work?', 'quick_fire', 'light', '📱'),
('Controversial food opinion?', 'quick_fire', 'light', '🍕'),
('Next place you want to visit and why?', 'quick_fire', 'light', '✈️'),
('Movie that describes your startup journey?', 'quick_fire', 'light', '🎬'),
('What animal matches your work style?', 'quick_fire', 'light', '🐾'),
('Are you a morning person or night owl, genuinely?', 'quick_fire', 'light', '🌙'),
-- Quick Fire Medium
('One thing you''re working on that genuinely excites you?', 'quick_fire', 'medium', '🔥'),
('What would you spend all day doing if money wasn''t a factor?', 'quick_fire', 'medium', '💭'),
('Book or podcast that changed how you think about work?', 'quick_fire', 'medium', '📚'),
('One skill you wish you could instantly master?', 'quick_fire', 'medium', '🎯'),
('Something you started doing recently that''s changed your routine?', 'quick_fire', 'medium', '🌱'),
-- Pair & Share Medium
('What''s a problem you''re stuck on that someone here might help with?', 'pair_share', 'medium', '🧩'),
('What''s something you learned this week that surprised you?', 'pair_share', 'medium', '💡'),
('If you had to start a completely different career tomorrow, what would it be?', 'pair_share', 'medium', '🚀'),
('What''s the most useful piece of advice someone gave you about work?', 'pair_share', 'medium', '🤝'),
('What does a perfect work day look like for you?', 'pair_share', 'medium', '🎯'),
('What''s a risk you took that paid off?', 'pair_share', 'medium', '🌊'),
('How do you explain what you do to your parents?', 'pair_share', 'medium', '💬'),
-- Pair & Share Deep
('What would you build if you had unlimited time and zero fear of failure?', 'pair_share', 'deep', '🏗️'),
('Where do you honestly see yourself in 3 years?', 'pair_share', 'deep', '🔮'),
('What''s something you''re really good at that most people don''t know about?', 'pair_share', 'deep', '💎'),
('What''s a moment this year when you felt genuinely proud of your work?', 'pair_share', 'deep', '🌟'),
-- Group Challenge Light
('Find 3 things ALL of you have in common that aren''t obvious', 'group_challenge', 'light', '🔍'),
('Each person shares one skill. Now pitch a fake startup using everyone''s skills.', 'group_challenge', 'light', '🚀'),
('Two truths and a dream — share two true things and one thing you wish were true', 'group_challenge', 'light', '🎭'),
('If your group was a band, what would your band name be and what genre?', 'group_challenge', 'light', '📸'),
('Plan a dream team trip — each person picks one activity, build the itinerary', 'group_challenge', 'light', '🗺️'),
('What''s one thing each person at this table could teach the others?', 'group_challenge', 'light', '🏆'),
-- Group Challenge Medium
('Share your biggest current challenge. Group has 60 seconds per person to brainstorm solutions.', 'group_challenge', 'medium', '💡'),
('Everyone writes their #1 goal for this month. Take turns — others suggest one action step.', 'group_challenge', 'medium', '🎯'),
('Debate: Is remote work better than office? Each person argues the OPPOSITE of their real opinion.', 'group_challenge', 'medium', '🤔'),
-- Intention Set
('In the next 90 minutes, I will ___. Share with your table and write it in the app.', 'intention_set', 'medium', '⏰'),
('What''s the ONE thing that if you finish today, everything else gets easier?', 'intention_set', 'medium', '🎯'),
('By the end of this session, I''ll feel good if I ___.', 'intention_set', 'medium', '🏁');
