-- Focus Credits Growth System
-- Creates tables for the event-sourced credits ledger, venue contributions,
-- and referral reward tracking with proper RLS and indexes.

-- ─── Focus Credits Ledger ───────────────────────────────

CREATE TABLE IF NOT EXISTS focus_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = earn, negative = spend
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_focus_credits_user_created ON focus_credits (user_id, created_at);
CREATE INDEX idx_focus_credits_user_action ON focus_credits (user_id, action);
CREATE INDEX idx_focus_credits_expires ON focus_credits (expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE focus_credits ENABLE ROW LEVEL SECURITY;

-- Users can read their own credit history
CREATE POLICY "Users can view own credits"
  ON focus_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (Edge Functions) inserts credits; no direct user inserts
-- Admins can view all
CREATE POLICY "Admins can view all credits"
  ON focus_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Admin'
    )
  );

-- Allow inserts from authenticated users (application layer enforces rules)
CREATE POLICY "Authenticated users can insert own credits"
  ON focus_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ─── Venue Contributions ───────────────────────────────

CREATE TABLE IF NOT EXISTS venue_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id UUID, -- nullable for venue suggestions
  contribution_type TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  credits_awarded INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_venue_contributions_venue ON venue_contributions (venue_id, contribution_type);
CREATE INDEX idx_venue_contributions_user ON venue_contributions (user_id, created_at);

-- RLS
ALTER TABLE venue_contributions ENABLE ROW LEVEL SECURITY;

-- Users can view their own contributions
CREATE POLICY "Users can view own contributions"
  ON venue_contributions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own contributions
CREATE POLICY "Users can insert own contributions"
  ON venue_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all contributions
CREATE POLICY "Admins can view all contributions"
  ON venue_contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Admin'
    )
  );


-- ─── Referral Rewards ───────────────────────────────

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL, -- 'signup', 'first_session', 'third_session'
  credits_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_referral_rewards_referrer ON referral_rewards (referrer_id);
CREATE INDEX idx_referral_rewards_referee ON referral_rewards (referee_id);

-- Unique constraint: each milestone can only be awarded once per referrer-referee pair
CREATE UNIQUE INDEX idx_referral_rewards_unique
  ON referral_rewards (referrer_id, referee_id, milestone);

-- RLS
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view where they are referrer or referee
CREATE POLICY "Users can view own referral rewards (as referrer)"
  ON referral_rewards FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referral rewards (as referee)"
  ON referral_rewards FOR SELECT
  USING (auth.uid() = referee_id);

-- Allow inserts from authenticated users
CREATE POLICY "Authenticated users can insert referral rewards"
  ON referral_rewards FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- Admins can view all
CREATE POLICY "Admins can view all referral rewards"
  ON referral_rewards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Admin'
    )
  );
