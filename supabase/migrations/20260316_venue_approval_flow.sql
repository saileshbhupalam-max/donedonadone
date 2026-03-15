-- Venue approval flow for sessions that exceed auto_approve thresholds
--
-- When auto_approve = false or group size > auto_approve_max on a venue slot,
-- auto-sessions creates event with status = 'pending_venue_approval'.
-- The venue partner approves or rejects from their dashboard.

-- RPC: Partner approves a pending session at their venue
CREATE OR REPLACE FUNCTION public.approve_venue_session(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_is_partner BOOLEAN;
BEGIN
  -- Get event
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.status != 'pending_venue_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event is not pending approval');
  END IF;

  -- Verify caller is the venue partner
  SELECT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.id = v_event.location_id AND l.partner_user_id = auth.uid()
  ) INTO v_is_partner;

  IF NOT v_is_partner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Approve: change status to upcoming
  UPDATE events SET status = 'upcoming' WHERE id = p_event_id;

  -- Notify all RSVPd attendees that the session is confirmed
  INSERT INTO notifications (user_id, type, title, body, data, read)
  SELECT er.user_id, 'session_confirmed',
    'Session confirmed!',
    v_event.title || ' on ' || to_char(v_event.date, 'Mon DD') || ' has been confirmed by the venue.',
    jsonb_build_object('event_id', p_event_id),
    false
  FROM event_rsvps er
  WHERE er.event_id = p_event_id AND er.status = 'going';

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_venue_session(UUID) TO authenticated;

-- RPC: Partner rejects a pending session at their venue
CREATE OR REPLACE FUNCTION public.reject_venue_session(p_event_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_is_partner BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.status != 'pending_venue_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event is not pending approval');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM locations l
    WHERE l.id = v_event.location_id AND l.partner_user_id = auth.uid()
  ) INTO v_is_partner;

  IF NOT v_is_partner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Reject: cancel the event
  UPDATE events SET status = 'cancelled' WHERE id = p_event_id;

  -- Revert session_requests to pending so they can be matched elsewhere
  UPDATE session_requests SET status = 'pending'
  WHERE status = 'fulfilled'
    AND id IN (
      SELECT sr.id FROM session_requests sr
      WHERE sr.user_id IN (SELECT er.user_id FROM event_rsvps er WHERE er.event_id = p_event_id)
        AND sr.neighborhood = v_event.neighborhood
    );

  -- Notify attendees
  INSERT INTO notifications (user_id, type, title, body, data, read)
  SELECT er.user_id, 'session_cancelled',
    'Session not available',
    'The venue couldn''t accommodate ' || v_event.title || '.' ||
      CASE WHEN p_reason IS NOT NULL THEN ' Reason: ' || p_reason ELSE '' END ||
      ' We''ll try to find another spot.',
    jsonb_build_object('event_id', p_event_id),
    false
  FROM event_rsvps er
  WHERE er.event_id = p_event_id AND er.status = 'going';

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_venue_session(UUID, TEXT) TO authenticated;
