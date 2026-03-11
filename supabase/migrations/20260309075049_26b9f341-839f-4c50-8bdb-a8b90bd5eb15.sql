
-- Location columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_latitude double precision,
  ADD COLUMN IF NOT EXISTS preferred_longitude double precision,
  ADD COLUMN IF NOT EXISTS preferred_radius_km integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS preferred_neighborhoods text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_days text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_times text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_session_duration integer DEFAULT 2;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(preferred_latitude, preferred_longitude);

-- Add lat/lng to events if not present
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_latitude double precision,
  ADD COLUMN IF NOT EXISTS venue_longitude double precision;

-- Add lat/lng to venue_partners if not present
ALTER TABLE venue_partners
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- RPC function to find nearby sessions
CREATE OR REPLACE FUNCTION find_nearby_sessions(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km integer DEFAULT 5,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  event_id uuid,
  title text,
  date date,
  start_time text,
  end_time text,
  venue_name text,
  venue_address text,
  neighborhood text,
  venue_latitude double precision,
  venue_longitude double precision,
  max_spots integer,
  rsvp_count integer,
  distance_km double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as event_id,
    e.title,
    e.date,
    e.start_time,
    e.end_time,
    e.venue_name,
    e.venue_address,
    e.neighborhood,
    e.venue_latitude,
    e.venue_longitude,
    e.max_spots,
    e.rsvp_count,
    (6371 * 2 * asin(sqrt(
      sin(radians((e.venue_latitude - p_latitude) / 2)) ^ 2 +
      cos(radians(p_latitude)) * cos(radians(e.venue_latitude)) *
      sin(radians((e.venue_longitude - p_longitude) / 2)) ^ 2
    ))) as distance_km
  FROM events e
  WHERE e.date >= CURRENT_DATE
    AND e.venue_latitude IS NOT NULL
    AND e.venue_longitude IS NOT NULL
    AND (6371 * 2 * asin(sqrt(
      sin(radians((e.venue_latitude - p_latitude) / 2)) ^ 2 +
      cos(radians(p_latitude)) * cos(radians(e.venue_latitude)) *
      sin(radians((e.venue_longitude - p_longitude) / 2)) ^ 2
    ))) <= p_radius_km
  ORDER BY distance_km
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
