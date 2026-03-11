
-- Prompts table
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  category text,
  emoji text,
  is_active boolean DEFAULT false,
  sort_order integer,
  response_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read prompts" ON public.prompts
  FOR SELECT TO authenticated USING (true);

-- Prompt responses table
CREATE TABLE public.prompt_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE NOT NULL,
  answer text,
  fire_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, prompt_id)
);

ALTER TABLE public.prompt_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read responses" ON public.prompt_responses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own responses" ON public.prompt_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own responses" ON public.prompt_responses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Prompt reactions table
CREATE TABLE public.prompt_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES public.prompt_responses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(response_id, user_id)
);

ALTER TABLE public.prompt_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read reactions" ON public.prompt_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own reactions" ON public.prompt_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.prompt_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed prompts
INSERT INTO public.prompts (question, category, emoji, is_active, sort_order) VALUES
  ('What''s one skill you''re actively learning right now?', 'interests', '🎯', true, 1),
  ('Describe your perfect coworking day in 3 sentences', 'work_style', '☕', false, 2),
  ('What side project would you start if you found the right cofounder?', 'reflection', '💡', false, 3),
  ('What''s something you wish more people in the community knew about you?', 'social', '🤝', false, 4),
  ('What''s your most unpopular work opinion?', 'icebreaker', '🎲', false, 5),
  ('What are you most excited about working on this month?', 'interests', '🔥', false, 6),
  ('What''s a problem you''d love help solving right now?', 'reflection', '🧩', false, 7),
  ('Best advice you''ve ever received about work or life?', 'social', '🌟', false, 8);
