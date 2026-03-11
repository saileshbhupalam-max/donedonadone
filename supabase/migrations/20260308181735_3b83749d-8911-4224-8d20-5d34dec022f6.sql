
-- Add gamification columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS focus_hours numeric(7,1) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS focus_rank text DEFAULT 'Newcomer';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_linkedin boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_instagram boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_twitter boolean DEFAULT true;

-- Monthly titles table
CREATE TABLE IF NOT EXISTS public.monthly_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title_type text NOT NULL,
  month text NOT NULL,
  value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(title_type, month)
);

ALTER TABLE public.monthly_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read monthly titles"
  ON public.monthly_titles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own titles"
  ON public.monthly_titles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Exclusive achievements table
CREATE TABLE IF NOT EXISTS public.exclusive_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_type text NOT NULL,
  achieved_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_type)
);

ALTER TABLE public.exclusive_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read achievements"
  ON public.exclusive_achievements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own achievements"
  ON public.exclusive_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Profile views table
CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at date DEFAULT CURRENT_DATE,
  UNIQUE(viewer_id, viewed_id, viewed_at)
);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert profile views"
  ON public.profile_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can read own views received"
  ON public.profile_views FOR SELECT
  TO authenticated
  USING (viewed_id = auth.uid());
