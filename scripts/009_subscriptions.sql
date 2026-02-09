-- Subscription Tiers: Explorer, Regular, Pro
-- Sunk cost reduces per-session bypass incentive

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  price INTEGER NOT NULL,
  sessions_per_month INTEGER,  -- NULL = unlimited
  features JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  sessions_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id, status);

-- RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans viewable by all" ON subscription_plans;
CREATE POLICY "Plans viewable by all" ON subscription_plans
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users view own subscriptions" ON user_subscriptions;
CREATE POLICY "Users view own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own subscriptions" ON user_subscriptions;
CREATE POLICY "Users create own subscriptions" ON user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own subscriptions" ON user_subscriptions;
CREATE POLICY "Users update own subscriptions" ON user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Seed subscription plans
INSERT INTO subscription_plans (name, price, sessions_per_month, features) VALUES
  ('Explorer', 350, 4, '{"priority_matching": false, "streak_freezes": 0, "exclusive_venues": false}'::JSONB),
  ('Regular', 600, 8, '{"priority_matching": true, "streak_freezes": 1, "exclusive_venues": false}'::JSONB),
  ('Pro', 999, NULL, '{"priority_matching": true, "streak_freezes": 2, "exclusive_venues": true}'::JSONB)
ON CONFLICT (name) DO NOTHING;
