-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
DO $$ BEGIN
  CREATE TYPE user_type AS ENUM ('coworker', 'partner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_type AS ENUM ('freelancer', 'startup_founder', 'remote_employee', 'student', 'creator', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_vibe AS ENUM ('deep_focus', 'casual_social', 'balanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE noise_pref AS ENUM ('silent', 'ambient', 'lively');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE break_freq AS ENUM ('pomodoro', 'hourly', 'deep_stretch', 'flexible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE comm_style AS ENUM ('minimal', 'moderate', 'chatty');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE venue_type AS ENUM ('cafe', 'coworking_space', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE venue_status AS ENUM ('pending', 'active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('upcoming', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'payment_pending', 'paid', 'confirmed', 'refunded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  user_type user_type DEFAULT 'coworker',
  work_type work_type,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coworker Preferences (quiz answers)
CREATE TABLE IF NOT EXISTS coworker_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  work_vibe work_vibe,
  noise_preference noise_pref,
  break_frequency break_freq,
  productive_times TEXT[] DEFAULT '{}',
  social_goals TEXT[] DEFAULT '{}',
  introvert_extrovert INTEGER CHECK (introvert_extrovert BETWEEN 1 AND 5),
  communication_style comm_style,
  bio TEXT CHECK (char_length(bio) <= 200),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venues
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'HSR Layout',
  lat DECIMAL,
  lng DECIMAL,
  venue_type venue_type DEFAULT 'cafe',
  amenities TEXT[] DEFAULT '{}',
  included_in_cover TEXT,
  venue_rules TEXT,
  max_capacity INTEGER NOT NULL DEFAULT 20,
  photos TEXT[] DEFAULT '{}',
  status venue_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (time slots at venues)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours INTEGER NOT NULL CHECK (duration_hours IN (2, 4)),
  platform_fee INTEGER NOT NULL,
  venue_price INTEGER NOT NULL,
  total_price INTEGER GENERATED ALWAYS AS (platform_fee + venue_price) STORED,
  max_spots INTEGER NOT NULL DEFAULT 20,
  spots_filled INTEGER NOT NULL DEFAULT 0,
  group_size INTEGER NOT NULL DEFAULT 4 CHECK (group_size BETWEEN 3 AND 5),
  status session_status DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_date_status ON sessions(date, status);
CREATE INDEX IF NOT EXISTS idx_sessions_venue ON sessions(venue_id, date);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  table_assignment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, group_number)
);

-- Group Members
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  group_id UUID REFERENCES groups(id),
  payment_amount INTEGER NOT NULL,
  payment_status booking_status DEFAULT 'pending',
  payment_reference TEXT,
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Session Feedback
CREATE TABLE IF NOT EXISTS session_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE REFERENCES bookings(id),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member Ratings
CREATE TABLE IF NOT EXISTS member_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user UUID REFERENCES profiles(id),
  to_user UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  would_cowork_again BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user, to_user, session_id)
);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  position INTEGER NOT NULL,
  status waitlist_status DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Atomic booking function (prevents overbooking)
CREATE OR REPLACE FUNCTION book_session(p_session_id UUID, p_user_id UUID)
RETURNS bookings AS $$
DECLARE
  v_booking bookings;
  v_session sessions;
BEGIN
  UPDATE sessions
  SET spots_filled = spots_filled + 1, updated_at = NOW()
  WHERE id = p_session_id AND spots_filled < max_spots AND status = 'upcoming'
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session is full or unavailable';
  END IF;

  INSERT INTO bookings (user_id, session_id, payment_amount, payment_status)
  VALUES (p_user_id, p_session_id, v_session.total_price, 'pending')
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coworker_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Profiles: read all, update own
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Preferences: own only
DROP POLICY IF EXISTS "Users can view own preferences" ON coworker_preferences;
CREATE POLICY "Users can view own preferences" ON coworker_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own preferences" ON coworker_preferences;
CREATE POLICY "Users can insert own preferences" ON coworker_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own preferences" ON coworker_preferences;
CREATE POLICY "Users can update own preferences" ON coworker_preferences FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own preferences" ON coworker_preferences;
CREATE POLICY "Users can delete own preferences" ON coworker_preferences FOR DELETE USING (auth.uid() = user_id);

-- Venues: read active, partners manage own
DROP POLICY IF EXISTS "Active venues viewable by all" ON venues;
CREATE POLICY "Active venues viewable by all" ON venues FOR SELECT USING (status = 'active' OR partner_id = auth.uid());
DROP POLICY IF EXISTS "Partners can insert own venues" ON venues;
CREATE POLICY "Partners can insert own venues" ON venues FOR INSERT WITH CHECK (partner_id = auth.uid());
DROP POLICY IF EXISTS "Partners can update own venues" ON venues;
CREATE POLICY "Partners can update own venues" ON venues FOR UPDATE USING (partner_id = auth.uid());
DROP POLICY IF EXISTS "Partners can delete own venues" ON venues;
CREATE POLICY "Partners can delete own venues" ON venues FOR DELETE USING (partner_id = auth.uid());

-- Sessions: read all
DROP POLICY IF EXISTS "Upcoming sessions viewable by all" ON sessions;
CREATE POLICY "Upcoming sessions viewable by all" ON sessions FOR SELECT USING (true);

-- Bookings: own only
DROP POLICY IF EXISTS "Users view own bookings" ON bookings;
CREATE POLICY "Users view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create own bookings" ON bookings;
CREATE POLICY "Users create own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Groups: viewable by members
DROP POLICY IF EXISTS "Groups viewable by all" ON groups;
CREATE POLICY "Groups viewable by all" ON groups FOR SELECT USING (true);

-- Group Members: viewable by all
DROP POLICY IF EXISTS "Group members viewable by all" ON group_members;
CREATE POLICY "Group members viewable by all" ON group_members FOR SELECT USING (true);

-- Session Feedback: own only
DROP POLICY IF EXISTS "Users view own feedback" ON session_feedback;
CREATE POLICY "Users view own feedback" ON session_feedback FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create own feedback" ON session_feedback;
CREATE POLICY "Users create own feedback" ON session_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Member Ratings: own only
DROP POLICY IF EXISTS "Users view own ratings" ON member_ratings;
CREATE POLICY "Users view own ratings" ON member_ratings FOR SELECT USING (auth.uid() = from_user);
DROP POLICY IF EXISTS "Users create own ratings" ON member_ratings;
CREATE POLICY "Users create own ratings" ON member_ratings FOR INSERT WITH CHECK (auth.uid() = from_user);

-- Waitlist: own only
DROP POLICY IF EXISTS "Users view own waitlist" ON waitlist;
CREATE POLICY "Users view own waitlist" ON waitlist FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create own waitlist" ON waitlist;
CREATE POLICY "Users create own waitlist" ON waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
