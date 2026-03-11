
-- connection_requests table
CREATE TABLE public.connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT no_self_request CHECK (from_user != to_user),
  CONSTRAINT unique_request UNIQUE (from_user, to_user)
);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can see own requests"
  ON public.connection_requests FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "Users can send requests"
  ON public.connection_requests FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid());

CREATE POLICY "Recipients can update requests"
  ON public.connection_requests FOR UPDATE TO authenticated
  USING (to_user = auth.uid())
  WITH CHECK (to_user = auth.uid());

-- Index for fast pending queries
CREATE INDEX idx_connection_requests_to_status ON public.connection_requests (to_user, status);

-- Accept connection request RPC
CREATE OR REPLACE FUNCTION public.accept_connection_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req RECORD;
  v_from_name TEXT;
  v_to_name TEXT;
BEGIN
  SELECT * INTO v_req FROM connection_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.to_user != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Request already responded to'; END IF;

  UPDATE connection_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;

  PERFORM upsert_connection(v_req.from_user, v_req.to_user, 'direct', 'work', '{}');

  SELECT display_name INTO v_from_name FROM profiles WHERE id = v_req.from_user;
  SELECT display_name INTO v_to_name FROM profiles WHERE id = v_req.to_user;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_req.from_user,
    'connection_formed',
    'Connection accepted! 🎉',
    COALESCE(v_to_name, 'Someone') || ' accepted your connection request.',
    '/profile/' || v_req.to_user::text
  );

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_req.to_user,
    'connection_formed',
    'You''re now connected!',
    'You and ' || COALESCE(v_from_name, 'someone') || ' are now connected.',
    '/profile/' || v_req.from_user::text
  );
END;
$$;

-- Trigger for request notifications
CREATE OR REPLACE FUNCTION public.trg_connection_request_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_name TEXT;
BEGIN
  SELECT display_name INTO v_from_name FROM profiles WHERE id = NEW.from_user;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    NEW.to_user,
    'connection_formed',
    COALESCE(v_from_name, 'Someone') || ' wants to connect',
    CASE WHEN NEW.message IS NOT NULL AND NEW.message != ''
      THEN '"' || left(NEW.message, 100) || '"'
      ELSE 'Tap to view their profile'
    END,
    '/profile/' || NEW.from_user::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_connection_request_created
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_connection_request_notify();

-- get_location_activity RPC
CREATE OR REPLACE FUNCTION public.get_location_activity(p_user_id UUID)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  location_type TEXT,
  neighborhood TEXT,
  active_count BIGINT,
  top_roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.name AS location_name,
    l.location_type,
    l.neighborhood,
    COUNT(DISTINCT ci.user_id) AS active_count,
    COALESCE(
      (SELECT array_agg(DISTINCT tg.role_type)
       FROM check_ins ci2
       JOIN taste_graph tg ON tg.user_id = ci2.user_id
       WHERE ci2.location_id = l.id
         AND ci2.checked_out_at IS NULL
         AND ci2.user_id != p_user_id
         AND tg.role_type IS NOT NULL
         AND tg.role_type != ''
       LIMIT 3),
      '{}'::text[]
    ) AS top_roles
  FROM check_ins ci
  JOIN profiles p ON p.id = ci.user_id
  JOIN locations l ON l.id = ci.location_id
  WHERE ci.checked_out_at IS NULL
    AND ci.user_id != p_user_id
    AND (p.suspended_until IS NULL OR p.suspended_until < now())
    AND ci.location_id IS NOT NULL
  GROUP BY l.id, l.name, l.location_type, l.neighborhood
  HAVING COUNT(DISTINCT ci.user_id) >= 1
  ORDER BY COUNT(DISTINCT ci.user_id) DESC;
END;
$$;

-- Enable realtime for connection_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_requests;
