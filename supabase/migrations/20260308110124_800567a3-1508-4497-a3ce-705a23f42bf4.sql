-- Create profiles table for FocusClub users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  tagline VARCHAR(140),
  bio TEXT CHECK (char_length(bio) <= 500),
  what_i_do TEXT,
  looking_for TEXT[],
  can_offer TEXT[],
  interests TEXT[],
  linkedin_url TEXT,
  instagram_handle TEXT,
  twitter_handle TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('woman', 'man', 'non_binary', 'prefer_not_to_say')),
  women_only_interest BOOLEAN DEFAULT false,
  work_vibe TEXT CHECK (work_vibe IN ('deep_focus', 'casual_social', 'balanced')),
  noise_preference TEXT CHECK (noise_preference IN ('silent', 'low_hum', 'dont_care')),
  communication_style TEXT CHECK (communication_style IN ('minimal', 'moderate', 'chatty')),
  neighborhood TEXT,
  profile_completion INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for directory queries
CREATE INDEX idx_profiles_directory ON public.profiles (onboarding_completed, last_active_at DESC);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read completed profiles OR their own profile
CREATE POLICY "Users can read completed profiles or their own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (onboarding_completed = true OR auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();