
CREATE TABLE IF NOT EXISTS company_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  need_type TEXT NOT NULL CHECK (need_type IN (
    'hiring', 'interns', 'investment', 'customers', 'partnerships',
    'collaborators', 'mentorship', 'shared_services', 'office_space', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, need_type, title)
);

CREATE TABLE IF NOT EXISTS company_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL CHECK (offer_type IN (
    'hiring', 'interns', 'investment', 'customers', 'partnerships',
    'collaborators', 'mentorship', 'shared_services', 'expertise', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, offer_type, title)
);

CREATE TABLE IF NOT EXISTS company_intros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  to_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT,
  need_id UUID REFERENCES company_needs(id),
  offer_id UUID REFERENCES company_offers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_company_id, to_company_id, need_id)
);

CREATE INDEX idx_company_needs_company ON company_needs(company_id);
CREATE INDEX idx_company_offers_company ON company_offers(company_id);
CREATE INDEX idx_company_intros_to ON company_intros(to_company_id);

ALTER TABLE company_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read needs" ON company_needs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read offers" ON company_offers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Company admins can insert needs" ON company_needs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Company admins can update needs" ON company_needs
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Company admins can delete needs" ON company_needs
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Company admins can insert offers" ON company_offers
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Company admins can update offers" ON company_offers
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Company admins can delete offers" ON company_offers
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Participants can read intros" ON company_intros
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id IN (from_company_id, to_company_id) AND cm.user_id = auth.uid())
  );

CREATE POLICY "Company members can send intros" ON company_intros
  FOR INSERT TO authenticated WITH CHECK (
    from_user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = from_company_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Receiver can update intro status" ON company_intros
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = to_company_id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE OR REPLACE FUNCTION get_company_matches(p_company_id UUID)
RETURNS TABLE(
  matched_company_id UUID,
  company_name TEXT,
  company_one_liner TEXT,
  company_stage TEXT,
  company_logo_url TEXT,
  match_type TEXT,
  your_need_title TEXT,
  their_offer_title TEXT,
  their_need_title TEXT,
  your_offer_title TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    c.id AS matched_company_id,
    c.name AS company_name,
    c.one_liner AS company_one_liner,
    c.stage AS company_stage,
    c.logo_url AS company_logo_url,
    'they_offer_you_need'::TEXT AS match_type,
    cn.title AS your_need_title,
    co.title AS their_offer_title,
    NULL::TEXT AS their_need_title,
    NULL::TEXT AS your_offer_title
  FROM company_needs cn
  JOIN company_offers co ON co.offer_type = cn.need_type AND co.company_id != p_company_id AND co.is_active = true
  JOIN companies c ON c.id = co.company_id
  WHERE cn.company_id = p_company_id AND cn.is_active = true

  UNION ALL

  SELECT DISTINCT
    c.id,
    c.name,
    c.one_liner,
    c.stage,
    c.logo_url,
    'you_offer_they_need'::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    cn.title,
    co.title
  FROM company_offers co
  JOIN company_needs cn ON cn.need_type = co.offer_type AND cn.company_id != p_company_id AND cn.is_active = true
  JOIN companies c ON c.id = cn.company_id
  WHERE co.company_id = p_company_id AND co.is_active = true

  ORDER BY company_name
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION trg_company_intro_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from_company TEXT;
  v_to_founders UUID[];
BEGIN
  SELECT name INTO v_from_company FROM companies WHERE id = NEW.from_company_id;
  SELECT array_agg(cm.user_id) INTO v_to_founders
    FROM company_members cm WHERE cm.company_id = NEW.to_company_id AND cm.role IN ('founder', 'admin');

  IF v_to_founders IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, link)
    SELECT
      unnest(v_to_founders),
      'New intro from ' || v_from_company,
      COALESCE(NEW.message, 'A company wants to connect with you'),
      'company_intro',
      '/company/' || NEW.to_company_id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_company_intro ON company_intros;
CREATE TRIGGER trg_on_company_intro
  AFTER INSERT ON company_intros
  FOR EACH ROW
  EXECUTE FUNCTION trg_company_intro_notify();
