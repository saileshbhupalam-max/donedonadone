
-- PART 1: Autopilot columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS autopilot_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopilot_days text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS autopilot_times text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS autopilot_max_per_week integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS autopilot_prefer_circle boolean DEFAULT true;

-- PART 2: Streak insurance columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_insurance_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS streak_saves_total integer DEFAULT 0;

-- PART 4: Venue vibes table
CREATE TABLE IF NOT EXISTS venue_vibes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  venue_name text NOT NULL,
  event_id uuid REFERENCES events(id),
  noise_level integer,
  wifi_quality integer,
  power_outlets integer,
  coffee_quality integer,
  seating_comfort integer,
  overall_vibe text,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE venue_vibes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own venue vibes" ON venue_vibes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own venue vibes" ON venue_vibes
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated can read venue vibes" ON venue_vibes
  FOR SELECT USING (true);
