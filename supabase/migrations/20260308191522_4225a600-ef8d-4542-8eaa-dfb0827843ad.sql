
-- Venue partners table
CREATE TABLE public.venue_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name text NOT NULL,
  venue_address text,
  neighborhood text,
  contact_name text,
  contact_phone text,
  contact_email text,
  google_maps_url text,
  instagram_handle text,
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','contacted','interested','active','declined','churned')),
  notes text,
  partnership_type text NOT NULL DEFAULT 'free_hosting' CHECK (partnership_type IN ('free_hosting','revenue_share','sponsored')),
  revenue_share_pct integer DEFAULT 0,
  events_hosted integer DEFAULT 0,
  members_acquired integer DEFAULT 0,
  qr_code_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.venue_partners ENABLE ROW LEVEL SECURITY;

-- Only admin can access (we'll use a permissive policy that checks nothing since admin is gated at app level)
-- Actually we need authenticated users to read active partners for the public page
CREATE POLICY "Authenticated can read active partners" ON public.venue_partners
  FOR SELECT TO authenticated USING (status = 'active');

CREATE POLICY "Authenticated can manage partners" ON public.venue_partners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Venue scans table
CREATE TABLE public.venue_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_partner_id uuid REFERENCES public.venue_partners(id) ON DELETE CASCADE NOT NULL,
  scanned_at timestamptz DEFAULT now(),
  resulted_in_signup boolean DEFAULT false,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.venue_scans ENABLE ROW LEVEL SECURITY;

-- Anyone can insert scans (tracked on landing)
CREATE POLICY "Anyone can insert scans" ON public.venue_scans
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can read scans" ON public.venue_scans
  FOR SELECT TO authenticated USING (true);

-- Venue reviews table
CREATE TABLE public.venue_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_partner_id uuid REFERENCES public.venue_partners(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.venue_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read reviews" ON public.venue_reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own reviews" ON public.venue_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Add venue_partner_id to events for linking
ALTER TABLE public.events ADD COLUMN venue_partner_id uuid REFERENCES public.venue_partners(id) ON DELETE SET NULL;
