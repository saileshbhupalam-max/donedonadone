-- Session templates: allow venue partners and admins to create custom session formats
CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  venue_partner_id UUID REFERENCES venue_partners(id) ON DELETE SET NULL,
  total_duration_minutes INTEGER NOT NULL,
  phases JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read active templates
CREATE POLICY "Anyone can view active templates" ON session_templates
  FOR SELECT USING (is_active = true);

-- Admins and venue partners can manage templates
CREATE POLICY "Admins and venue partners can manage templates" ON session_templates
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE user_type IN ('Admin', 'Venue Partner')
    )
  );

-- Index for venue partner lookups
CREATE INDEX IF NOT EXISTS idx_session_templates_venue_partner ON session_templates(venue_partner_id) WHERE is_active = true;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_templates_updated_at
  BEFORE UPDATE ON session_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_session_templates_updated_at();
