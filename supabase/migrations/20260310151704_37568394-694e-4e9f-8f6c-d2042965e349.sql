
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  one_liner TEXT,
  stage TEXT CHECK (stage IN ('idea', 'pre_seed', 'seed', 'series_a', 'series_b_plus', 'bootstrapped', 'profitable', 'agency', 'freelancer')),
  team_size INT DEFAULT 1,
  industry_tags TEXT[] DEFAULT '{}',
  website TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('founder', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX idx_company_members_user ON company_members(user_id);
CREATE INDEX idx_company_members_company ON company_members(company_id);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read companies" ON companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Creator can insert company" ON companies
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Company admins can update" ON companies
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = id AND cm.user_id = auth.uid() AND cm.role IN ('founder', 'admin'))
  );

CREATE POLICY "Authenticated can read company members" ON company_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join companies" ON company_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave or founders can remove" ON company_members
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = company_members.company_id AND cm.user_id = auth.uid() AND cm.role = 'founder')
  );

CREATE OR REPLACE FUNCTION trg_add_company_founder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'founder')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_add_founder ON companies;
CREATE TRIGGER trg_company_add_founder
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trg_add_company_founder();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
