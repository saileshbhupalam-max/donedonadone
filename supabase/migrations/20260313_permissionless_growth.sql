-- Permissionless Growth: Venue Nominations, Vouches, Health Checks, Auto-Sessions
-- This migration enables member-driven venue discovery and automated session creation.

-- ─── Venue Nominations (member-driven venue discovery) ───────────────
CREATE TABLE IF NOT EXISTS venue_nominations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nominated_by uuid REFERENCES auth.users(id) NOT NULL,
  venue_name text NOT NULL,
  address text,
  neighborhood text NOT NULL,
  latitude double precision,
  longitude double precision,
  photo_url text,
  photo_gps_lat double precision,
  photo_gps_lng double precision,
  google_maps_url text,
  wifi_available boolean DEFAULT false,
  status text DEFAULT 'nominated' CHECK (status IN ('nominated', 'verified', 'active', 'deactivated')),
  vouch_count int DEFAULT 0,
  location_id uuid, -- linked once promoted to locations table
  created_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  deactivated_at timestamptz,
  deactivation_reason text
);

CREATE INDEX idx_nominations_neighborhood ON venue_nominations(neighborhood, status);
CREATE INDEX idx_nominations_status ON venue_nominations(status);
CREATE INDEX idx_nominations_nominated_by ON venue_nominations(nominated_by);

-- ─── Venue Vouches (peer verification) ───────────────────────────────
CREATE TABLE IF NOT EXISTS venue_vouches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nomination_id uuid REFERENCES venue_nominations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  photo_proof_url text,
  wifi_works boolean,
  has_power_outlets boolean,
  has_adequate_seating boolean,
  noise_level text CHECK (noise_level IN ('quiet', 'moderate', 'lively')),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(nomination_id, user_id) -- one vouch per user per venue
);

CREATE INDEX idx_vouches_nomination ON venue_vouches(nomination_id);

-- ─── Venue Health Checks (monthly re-verification) ──────────────────
CREATE TABLE IF NOT EXISTS venue_health_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL, -- references locations table
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  wifi_ok boolean DEFAULT true,
  noise_ok boolean DEFAULT true,
  still_open boolean DEFAULT true,
  seating_ok boolean DEFAULT true,
  comment text,
  checked_at timestamptz DEFAULT now()
);

CREATE INDEX idx_health_checks_location ON venue_health_checks(location_id, checked_at DESC);

-- ─── Neighborhood member counts (materialized for fast lookup) ──────
CREATE TABLE IF NOT EXISTS neighborhood_stats (
  neighborhood text PRIMARY KEY,
  member_count int DEFAULT 0,
  active_venues int DEFAULT 0,
  is_unlocked boolean DEFAULT false,
  unlocked_at timestamptz,
  last_updated timestamptz DEFAULT now()
);

-- ─── Auto-session tracking ──────────────────────────────────────────
-- Add venue_preference to session_requests if not exists
DO $$ BEGIN
  ALTER TABLE session_requests ADD COLUMN venue_preference uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Track auto-created sessions
DO $$ BEGIN
  ALTER TABLE events ADD COLUMN auto_created boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD COLUMN demand_cluster_key text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── RLS Policies ───────────────────────────────────────────────────

ALTER TABLE venue_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_stats ENABLE ROW LEVEL SECURITY;

-- Nominations: anyone can read, authenticated can create
CREATE POLICY "Anyone can read nominations" ON venue_nominations FOR SELECT USING (true);
CREATE POLICY "Auth users can nominate" ON venue_nominations FOR INSERT WITH CHECK (auth.uid() = nominated_by);
CREATE POLICY "Nominator can update own" ON venue_nominations FOR UPDATE USING (auth.uid() = nominated_by);

-- Vouches: anyone can read, auth users can vouch (but not for own nomination)
CREATE POLICY "Anyone can read vouches" ON venue_vouches FOR SELECT USING (true);
CREATE POLICY "Auth users can vouch" ON venue_vouches FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() != (SELECT nominated_by FROM venue_nominations WHERE id = nomination_id)
);

-- Health checks: anyone can read, auth users can submit
CREATE POLICY "Anyone can read health checks" ON venue_health_checks FOR SELECT USING (true);
CREATE POLICY "Auth users can submit health checks" ON venue_health_checks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Neighborhood stats: public read
CREATE POLICY "Anyone can read neighborhood stats" ON neighborhood_stats FOR SELECT USING (true);

-- ─── Helper function: update neighborhood stats ─────────────────────
CREATE OR REPLACE FUNCTION update_neighborhood_stats(p_neighborhood text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member_count int;
  v_active_venues int;
  v_threshold int := 10;
BEGIN
  SELECT COUNT(DISTINCT id) INTO v_member_count
  FROM profiles WHERE neighborhood = p_neighborhood;

  SELECT COUNT(*) INTO v_active_venues
  FROM venue_nominations WHERE neighborhood = p_neighborhood AND status = 'active';

  INSERT INTO neighborhood_stats (neighborhood, member_count, active_venues, is_unlocked, unlocked_at, last_updated)
  VALUES (
    p_neighborhood, v_member_count, v_active_venues,
    v_member_count >= v_threshold,
    CASE WHEN v_member_count >= v_threshold THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (neighborhood) DO UPDATE SET
    member_count = v_member_count,
    active_venues = v_active_venues,
    is_unlocked = v_member_count >= v_threshold,
    unlocked_at = CASE
      WHEN neighborhood_stats.is_unlocked = false AND v_member_count >= v_threshold THEN now()
      ELSE neighborhood_stats.unlocked_at
    END,
    last_updated = now();
END;
$$;

-- ─── Helper function: check and activate nomination ─────────────────
CREATE OR REPLACE FUNCTION check_nomination_activation(p_nomination_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_nomination venue_nominations%ROWTYPE;
  v_vouch_count int;
  v_neighborhood_unlocked boolean;
  v_required_vouches int := 3;
BEGIN
  SELECT * INTO v_nomination FROM venue_nominations WHERE id = p_nomination_id;
  IF v_nomination IS NULL OR v_nomination.status != 'nominated' THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_vouch_count FROM venue_vouches WHERE nomination_id = p_nomination_id;

  SELECT is_unlocked INTO v_neighborhood_unlocked
  FROM neighborhood_stats WHERE neighborhood = v_nomination.neighborhood;

  IF v_vouch_count >= v_required_vouches AND COALESCE(v_neighborhood_unlocked, false) THEN
    UPDATE venue_nominations SET
      status = 'verified',
      vouch_count = v_vouch_count,
      activated_at = now()
    WHERE id = p_nomination_id;
    RETURN true;
  ELSE
    UPDATE venue_nominations SET vouch_count = v_vouch_count WHERE id = p_nomination_id;
    RETURN false;
  END IF;
END;
$$;
