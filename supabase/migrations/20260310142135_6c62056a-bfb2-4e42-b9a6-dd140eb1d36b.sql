
-- 1. Prevent bidirectional duplicate connection requests
CREATE OR REPLACE FUNCTION prevent_duplicate_connection_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM connection_requests
    WHERE from_user = NEW.to_user AND to_user = NEW.from_user
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A pending request already exists between these users'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_connection_request ON connection_requests;
CREATE TRIGGER trg_prevent_duplicate_connection_request
  BEFORE INSERT ON connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_connection_request();

-- 2. Seed additional missing feature flags
INSERT INTO feature_flags (flag_name, enabled, description) VALUES
  ('push_notifications', true, 'Web push notification opt-in'),
  ('partner_applications', true, 'Partner venue application flow'),
  ('streaks', true, 'Check-in streak tracking')
ON CONFLICT (flag_name) DO NOTHING;
