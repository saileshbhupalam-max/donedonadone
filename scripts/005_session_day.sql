-- Session Day: check-in RPC + update policy for bookings.

-- Allow users to update their own bookings (for check-in)
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
CREATE POLICY "Users can update own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- Check-in RPC: sets checked_in = true and checked_in_at = now()
-- Only works if: booking exists, session is today, session is within time window.
CREATE OR REPLACE FUNCTION check_in_user(p_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_booking bookings;
  v_session sessions;
BEGIN
  -- Get booking
  SELECT * INTO v_booking FROM bookings
  WHERE id = p_booking_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN '{"error": "Booking not found"}'::JSONB;
  END IF;

  IF v_booking.checked_in THEN
    RETURN '{"error": "Already checked in"}'::JSONB;
  END IF;

  IF v_booking.payment_status NOT IN ('paid', 'confirmed') THEN
    RETURN '{"error": "Booking not confirmed"}'::JSONB;
  END IF;

  -- Get session
  SELECT * INTO v_session FROM sessions WHERE id = v_booking.session_id;

  IF NOT FOUND THEN
    RETURN '{"error": "Session not found"}'::JSONB;
  END IF;

  -- Check date is today
  IF v_session.date != CURRENT_DATE THEN
    RETURN '{"error": "Session is not today"}'::JSONB;
  END IF;

  -- Check within time window: from 30 min before start to end
  IF CURRENT_TIME < (v_session.start_time - interval '30 minutes') THEN
    RETURN '{"error": "Too early to check in"}'::JSONB;
  END IF;

  IF CURRENT_TIME > v_session.end_time THEN
    RETURN '{"error": "Session has ended"}'::JSONB;
  END IF;

  -- Perform check-in
  UPDATE bookings
  SET checked_in = TRUE, checked_in_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'checked_in_at', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
