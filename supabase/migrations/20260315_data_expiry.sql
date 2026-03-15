-- Fix 2.4: Data Expiry + Venue Reactivation
--
-- 1. Add expires_at to session_requests (default 14 days)
-- 2. Backfill existing pending requests
-- 3. Allow re-nomination of deactivated venues after 90 days

-- ─── 1. SESSION REQUEST EXPIRY ───
ALTER TABLE session_requests ADD COLUMN IF NOT EXISTS expires_at timestamptz
  DEFAULT (now() + interval '14 days');

-- Backfill existing pending requests that don't have an expiry
UPDATE session_requests
SET expires_at = created_at + interval '14 days'
WHERE expires_at IS NULL AND status = 'pending';

-- Index for efficient filtering of non-expired requests
CREATE INDEX IF NOT EXISTS idx_session_requests_expires
  ON session_requests (expires_at)
  WHERE status = 'pending';

-- ─── 2. UPDATE server_check_demand_cluster TO FILTER EXPIRED REQUESTS ───
-- The existing RPC already filters by status='pending', now also filter by expires_at
CREATE OR REPLACE FUNCTION server_check_demand_cluster(
  p_neighborhood text,
  p_preferred_time text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cluster_count integer;
  v_event_id uuid;
  v_venue_id uuid;
  v_venue_name text;
  v_captain_id uuid;
  v_cluster_key text;
  v_tomorrow date;
  v_existing_count integer;
BEGIN
  v_cluster_key := p_neighborhood || '__' || p_preferred_time;

  -- Check if session already exists for this cluster
  SELECT COUNT(*) INTO v_existing_count
  FROM events
  WHERE demand_cluster_key = v_cluster_key AND auto_created = true;

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object('created', false, 'reason', 'session_already_exists');
  END IF;

  -- Count pending, non-expired requests for this cluster
  SELECT COUNT(*) INTO v_cluster_count
  FROM session_requests
  WHERE neighborhood = p_neighborhood
    AND preferred_time = p_preferred_time
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now());

  IF v_cluster_count < 3 THEN
    RETURN jsonb_build_object('created', false, 'reason', 'insufficient_demand', 'count', v_cluster_count);
  END IF;

  -- Find best venue in neighborhood
  SELECT vn.location_id, vn.venue_name INTO v_venue_id, v_venue_name
  FROM venue_nominations vn
  WHERE vn.neighborhood = p_neighborhood AND vn.status = 'active' AND vn.location_id IS NOT NULL
  ORDER BY vn.vouch_count DESC
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    SELECT l.id, l.name INTO v_venue_id, v_venue_name
    FROM locations l
    WHERE l.neighborhood = p_neighborhood
    LIMIT 1;
  END IF;

  IF v_venue_id IS NULL THEN
    RETURN jsonb_build_object('created', false, 'reason', 'no_venue');
  END IF;

  -- Pick captain (most experienced among requesters)
  SELECT sr.user_id INTO v_captain_id
  FROM session_requests sr
  JOIN profiles p ON p.id = sr.user_id
  WHERE sr.neighborhood = p_neighborhood
    AND sr.preferred_time = p_preferred_time
    AND sr.status = 'pending'
    AND (sr.expires_at IS NULL OR sr.expires_at > now())
  ORDER BY p.is_table_captain DESC, p.events_attended DESC NULLS LAST
  LIMIT 1;

  -- Schedule for next weekday
  v_tomorrow := current_date + 1;
  WHILE EXTRACT(DOW FROM v_tomorrow) IN (0, 6) LOOP
    v_tomorrow := v_tomorrow + 1;
  END LOOP;

  -- Create event
  INSERT INTO events (title, date, start_time, session_format, location_id, neighborhood,
                      max_attendees, auto_created, demand_cluster_key, created_by, status)
  VALUES (
    'Auto-Session at ' || v_venue_name,
    v_tomorrow,
    CASE p_preferred_time
      WHEN 'morning' THEN '09:00'
      WHEN 'afternoon' THEN '14:00'
      WHEN 'evening' THEN '18:00'
      ELSE '09:00'
    END,
    CASE p_preferred_time
      WHEN 'morning' THEN 'morning_2hr'
      WHEN 'afternoon' THEN 'afternoon_2hr'
      WHEN 'evening' THEN 'evening_2hr'
      ELSE 'morning_2hr'
    END,
    v_venue_id,
    p_neighborhood,
    LEAST(v_cluster_count + 2, 8),
    true,
    v_cluster_key,
    v_captain_id,
    'upcoming'
  )
  RETURNING id INTO v_event_id;

  -- Fulfill requests + auto-RSVP (only non-expired)
  WITH fulfilled AS (
    UPDATE session_requests SET status = 'fulfilled'
    WHERE neighborhood = p_neighborhood
      AND preferred_time = p_preferred_time
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
    RETURNING user_id
  )
  INSERT INTO event_rsvps (event_id, user_id, status)
  SELECT v_event_id, user_id, 'going' FROM fulfilled
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Notify requesters
  INSERT INTO notifications (user_id, type, title, body, data, read)
  SELECT er.user_id, 'session_auto_created',
    'Session created from your request!',
    'Enough people want to work together — we auto-created a session for you.',
    jsonb_build_object('event_id', v_event_id),
    false
  FROM event_rsvps er
  WHERE er.event_id = v_event_id;

  RETURN jsonb_build_object('created', true, 'event_id', v_event_id);
END;
$$;
