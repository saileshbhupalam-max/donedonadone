-- Venue Availability Slots — partners declare coworking hours, seats, pricing

CREATE TABLE public.venue_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  max_cowork_seats INT NOT NULL DEFAULT 5 CHECK (max_cowork_seats > 0),
  price_member_paise INT NOT NULL DEFAULT 0 CHECK (price_member_paise >= 0),
  price_outsider_paise INT NOT NULL DEFAULT 0 CHECK (price_outsider_paise >= 0),
  platform_fee_paise INT NOT NULL DEFAULT 0 CHECK (platform_fee_paise >= 0),
  auto_approve BOOLEAN DEFAULT true, auto_approve_max INT DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, day_of_week, start_time)
);
ALTER TABLE public.venue_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_active_slots" ON public.venue_slots FOR SELECT USING (is_active = true);
CREATE POLICY "partner_manage_own_slots" ON public.venue_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id AND l.partner_user_id = auth.uid())
);
CREATE INDEX idx_venue_slots_location ON public.venue_slots(location_id, is_active);
CREATE INDEX idx_venue_slots_day ON public.venue_slots(day_of_week, is_active);

CREATE TABLE public.venue_slot_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES public.venue_slots(id) ON DELETE CASCADE NOT NULL,
  blackout_date DATE NOT NULL, reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slot_id, blackout_date)
);
ALTER TABLE public.venue_slot_blackouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_blackouts" ON public.venue_slot_blackouts FOR SELECT USING (true);
CREATE POLICY "partner_manage_blackouts" ON public.venue_slot_blackouts FOR ALL USING (
  EXISTS (SELECT 1 FROM venue_slots vs JOIN locations l ON l.id = vs.location_id WHERE vs.id = slot_id AND l.partner_user_id = auth.uid())
);

-- RPC for auto-sessions to find available venue slots
CREATE OR REPLACE FUNCTION public.find_available_venue_slots(
  p_neighborhood TEXT, p_date DATE, p_time_slot TEXT
) RETURNS TABLE (
  slot_id UUID, location_id UUID, location_name TEXT, max_cowork_seats INT,
  current_bookings BIGINT, available_seats BIGINT,
  price_member_paise INT, platform_fee_paise INT, auto_approve BOOLEAN, auto_approve_max INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day_of_week INT; v_start_time TIME; v_end_time TIME;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date)::INT;
  IF p_time_slot = 'morning' THEN v_start_time := '09:00'; v_end_time := '13:30';
  ELSIF p_time_slot = 'afternoon' THEN v_start_time := '14:00'; v_end_time := '18:00';
  ELSIF p_time_slot = 'evening' THEN v_start_time := '18:00'; v_end_time := '21:00';
  ELSE v_start_time := '09:00'; v_end_time := '21:00'; END IF;

  RETURN QUERY
  SELECT vs.id, vs.location_id, l.name, vs.max_cowork_seats,
    COALESCE(b.cnt, 0), (vs.max_cowork_seats - COALESCE(b.cnt, 0)),
    vs.price_member_paise, vs.platform_fee_paise, vs.auto_approve, vs.auto_approve_max
  FROM venue_slots vs
  JOIN locations l ON l.id = vs.location_id
  LEFT JOIN (
    SELECT e.location_id AS loc_id, COUNT(er.id) AS cnt
    FROM events e JOIN event_rsvps er ON er.event_id = e.id AND er.status = 'going'
    WHERE e.date = p_date AND e.start_time >= v_start_time::TEXT AND e.start_time < v_end_time::TEXT
    GROUP BY e.location_id
  ) b ON b.loc_id = vs.location_id
  WHERE vs.is_active = true AND vs.day_of_week = v_day_of_week
    AND vs.start_time >= v_start_time AND vs.start_time < v_end_time
    AND l.neighborhood = p_neighborhood
    AND NOT EXISTS (SELECT 1 FROM venue_slot_blackouts vsb WHERE vsb.slot_id = vs.id AND vsb.blackout_date = p_date)
    AND (vs.max_cowork_seats - COALESCE(b.cnt, 0)) > 0
  ORDER BY (vs.max_cowork_seats - COALESCE(b.cnt, 0)) DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.find_available_venue_slots(TEXT, DATE, TEXT) TO authenticated;
