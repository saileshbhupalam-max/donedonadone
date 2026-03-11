-- Add latitude/longitude to venue_partners for geofencing
ALTER TABLE venue_partners 
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add coordinates to events (copied from venue or manually set)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_latitude double precision,
  ADD COLUMN IF NOT EXISTS venue_longitude double precision,
  ADD COLUMN IF NOT EXISTS checkin_radius_meters integer DEFAULT 200;

-- Add checkin verification columns to event_rsvps
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS checked_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_latitude double precision,
  ADD COLUMN IF NOT EXISTS checkin_longitude double precision,
  ADD COLUMN IF NOT EXISTS checkin_method text DEFAULT 'none';

-- CHECK constraint for checkin method
ALTER TABLE event_rsvps
  ADD CONSTRAINT chk_checkin_method CHECK (checkin_method IN ('none', 'geolocation', 'pin', 'manual'));

-- Index for check-in queries
CREATE INDEX IF NOT EXISTS idx_event_rsvps_checkin ON event_rsvps(event_id, checked_in);

-- RPC function to verify and record check-in
CREATE OR REPLACE FUNCTION checkin_with_location(
  p_event_id uuid,
  p_user_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
RETURNS jsonb AS $$
DECLARE
  v_event RECORD;
  v_distance double precision;
  v_radius integer;
BEGIN
  -- Get event venue coordinates
  SELECT venue_latitude, venue_longitude, checkin_radius_meters
  INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.venue_latitude IS NULL OR v_event.venue_longitude IS NULL THEN
    -- No coordinates set, allow check-in (fallback for venues without coords)
    UPDATE event_rsvps 
    SET checked_in = true, checked_in_at = now(), 
        checkin_latitude = p_latitude, checkin_longitude = p_longitude,
        checkin_method = 'manual'
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going';
    
    RETURN jsonb_build_object('success', true, 'method', 'manual', 'message', 'Checked in (no venue coordinates set)');
  END IF;
  
  -- Calculate distance using Haversine formula
  v_distance := 6371000 * 2 * asin(sqrt(
    sin(radians((p_latitude - v_event.venue_latitude) / 2)) ^ 2 +
    cos(radians(v_event.venue_latitude)) * cos(radians(p_latitude)) *
    sin(radians((p_longitude - v_event.venue_longitude) / 2)) ^ 2
  ));
  
  v_radius := COALESCE(v_event.checkin_radius_meters, 200);
  
  IF v_distance <= v_radius THEN
    UPDATE event_rsvps 
    SET checked_in = true, checked_in_at = now(),
        checkin_latitude = p_latitude, checkin_longitude = p_longitude,
        checkin_method = 'geolocation'
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going';
    
    RETURN jsonb_build_object('success', true, 'method', 'geolocation', 'distance_meters', round(v_distance::numeric, 1));
  ELSE
    RETURN jsonb_build_object('success', false, 'method', 'geolocation', 'distance_meters', round(v_distance::numeric, 1), 'radius', v_radius, 'message', 'Too far from venue');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC for PIN-based check-in (fallback)
CREATE OR REPLACE FUNCTION checkin_with_pin(
  p_event_id uuid,
  p_user_id uuid,
  p_pin text
)
RETURNS jsonb AS $$
DECLARE
  v_event RECORD;
BEGIN
  SELECT checkin_pin INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event.checkin_pin IS NULL OR v_event.checkin_pin = p_pin THEN
    UPDATE event_rsvps
    SET checked_in = true, checked_in_at = now(), checkin_method = 'pin'
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'going';
    
    RETURN jsonb_build_object('success', true, 'method', 'pin');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid PIN');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add checkin_pin to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_pin text;
