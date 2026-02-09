-- Referral Program: organic growth via referral codes
-- Referrer gets Rs 50 credit, referred gets first session free

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  credit_amount INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)  -- Each user can only be referred once
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_id);

-- RLS
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referral code" ON referral_codes;
CREATE POLICY "Users view own referral code" ON referral_codes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own referral events" ON referral_events;
CREATE POLICY "Users view own referral events" ON referral_events
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Auto-generate referral code on profile creation
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate a short unique code from display_name + random chars
  v_code := upper(
    left(regexp_replace(NEW.display_name, '[^a-zA-Z]', '', 'g'), 4) ||
    lpad(floor(random() * 10000)::TEXT, 4, '0')
  );

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM referral_codes WHERE code = v_code) LOOP
    v_code := upper(
      left(regexp_replace(NEW.display_name, '[^a-zA-Z]', '', 'g'), 4) ||
      lpad(floor(random() * 10000)::TEXT, 4, '0')
    );
  END LOOP;

  INSERT INTO referral_codes (user_id, code)
  VALUES (NEW.id, v_code)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_create_referral ON profiles;
CREATE TRIGGER on_profile_create_referral
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();
