
-- Subscription tiers definition
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly INT NOT NULL DEFAULT 0,
  price_yearly INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  badge_color TEXT DEFAULT 'gray',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalized feature registry
CREATE TABLE IF NOT EXISTS tier_features (
  feature_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  min_tier_id TEXT NOT NULL REFERENCES subscription_tiers(id),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Normalized limits per tier
CREATE TABLE IF NOT EXISTS tier_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id TEXT NOT NULL REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  limit_value INT NOT NULL,
  label TEXT,
  UNIQUE(tier_id, limit_key)
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL REFERENCES subscription_tiers(id) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'paused')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  payment_provider TEXT CHECK (payment_provider IN ('razorpay', 'upi', 'manual', 'system')),
  payment_id TEXT,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_active
  ON user_subscriptions(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS session_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  boost_tier TEXT NOT NULL REFERENCES subscription_tiers(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  amount_paise INT NOT NULL DEFAULT 9900,
  payment_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_session_boosts_user ON session_boosts(user_id);

CREATE TABLE IF NOT EXISTS intro_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credits_remaining INT NOT NULL DEFAULT 0,
  credits_purchased INT NOT NULL DEFAULT 0,
  last_purchased_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intro_credits_user ON intro_credits(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_paise INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'boost', 'credits', 'spotlight')),
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('razorpay', 'upi', 'manual', 'system')),
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

-- RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intro_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tiers" ON subscription_tiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manages tiers" ON subscription_tiers
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Anyone can read tier features" ON tier_features
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manages tier features" ON tier_features
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Anyone can read tier limits" ON tier_limits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manages tier limits" ON tier_limits
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Users read own subscription" ON user_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin manages subscriptions" ON user_subscriptions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "Users read own boosts" ON session_boosts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users purchase boosts" ON session_boosts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own credits" ON intro_credits
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users read own payments" ON payments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RPCs
CREATE OR REPLACE FUNCTION get_effective_tier(p_user_id UUID)
RETURNS TABLE(
  tier_id TEXT,
  tier_name TEXT,
  tier_sort_order INT,
  badge_color TEXT,
  is_boosted BOOLEAN,
  boost_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sub_tier TEXT;
  v_sub_order INT;
  v_boost_tier TEXT;
  v_boost_order INT;
  v_boost_exp TIMESTAMPTZ;
  v_effective TEXT;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT us.tier_id, st.sort_order INTO v_sub_tier, v_sub_order
  FROM user_subscriptions us
  JOIN subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  AND (us.expires_at IS NULL OR us.expires_at > now())
  LIMIT 1;

  v_sub_tier := COALESCE(v_sub_tier, 'free');
  v_sub_order := COALESCE(v_sub_order, 0);

  SELECT sb.boost_tier, st.sort_order, sb.expires_at
  INTO v_boost_tier, v_boost_order, v_boost_exp
  FROM session_boosts sb
  JOIN subscription_tiers st ON st.id = sb.boost_tier
  WHERE sb.user_id = p_user_id AND sb.expires_at > now()
  ORDER BY st.sort_order DESC LIMIT 1;

  IF v_boost_tier IS NOT NULL AND v_boost_order > v_sub_order THEN
    v_effective := v_boost_tier;
  ELSE
    v_effective := v_sub_tier;
  END IF;

  RETURN QUERY
  SELECT st.id, st.name, st.sort_order, st.badge_color,
    (v_boost_tier IS NOT NULL AND v_boost_order > v_sub_order),
    v_boost_exp
  FROM subscription_tiers st WHERE st.id = v_effective;
END;
$$;

CREATE OR REPLACE FUNCTION user_has_feature(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_order INT;
  v_feature_order INT;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT tier_sort_order INTO v_user_order FROM get_effective_tier(p_user_id);
  v_user_order := COALESCE(v_user_order, 0);

  SELECT st.sort_order INTO v_feature_order
  FROM tier_features tf JOIN subscription_tiers st ON st.id = tf.min_tier_id
  WHERE tf.feature_key = p_feature_key AND tf.is_active = true;

  IF v_feature_order IS NULL THEN RETURN false; END IF;
  RETURN v_user_order >= v_feature_order;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_limit(p_user_id UUID, p_limit_key TEXT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_effective_tier TEXT;
  v_limit INT;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT tier_id INTO v_effective_tier FROM get_effective_tier(p_user_id);
  v_effective_tier := COALESCE(v_effective_tier, 'free');

  SELECT tl.limit_value INTO v_limit
  FROM tier_limits tl WHERE tl.tier_id = v_effective_tier AND tl.limit_key = p_limit_key;

  RETURN COALESCE(v_limit, 0);
END;
$$;

-- Seed tiers
INSERT INTO subscription_tiers (id, name, description, price_monthly, price_yearly, sort_order, badge_color) VALUES
  ('free', 'Explorer', 'Get started with FocusClub', 0, 0, 0, 'gray'),
  ('plus', 'Plus', 'Full profiles and unlimited connections', 19900, 179900, 1, 'blue'),
  ('pro', 'Pro', 'AI matching and company features', 49900, 449900, 2, 'purple'),
  ('max', 'Max', 'Full B2B engine with AI intelligence', 149900, 1299900, 3, 'gold')
ON CONFLICT (id) DO NOTHING;

-- Seed features
INSERT INTO tier_features (feature_key, label, category, min_tier_id, sort_order) VALUES
  ('discovery_basic',       'See who''s here (names + taglines)',   'discovery',    'free', 10),
  ('connections',           'Send connection requests',             'connections',  'free', 20),
  ('roulette',              'Coffee roulette matching',             'connections',  'free', 30),
  ('match_score',           'See match compatibility scores',       'matching',     'free', 40),
  ('prompts',               'Answer community prompts',             'community',    'free', 50),
  ('props',                 'Give & receive props',                 'community',    'free', 60),
  ('streaks',               'Build attendance streaks',             'gamification', 'free', 70),
  ('badges',                'Earn badges & milestones',             'gamification', 'free', 80),
  ('ranks',                 'Rank progression system',              'gamification', 'free', 90),
  ('micro_requests',        'Post help requests',                   'community',    'free', 100),
  ('profile_views_count',   'See profile view count',               'analytics',    'free', 110),
  ('basic_analytics',       'Focus hours & streak stats',           'analytics',    'free', 120),
  ('company_directory_basic','Browse company names',                'company',      'free', 130),
  ('discovery_full',        'Full member profiles',                 'discovery',    'plus', 200),
  ('connections_unlimited', 'Unlimited connection requests',        'connections',  'plus', 210),
  ('roulette_unlimited',    'Unlimited roulette matches',           'connections',  'plus', 220),
  ('match_reasons',         'See why you matched',                  'matching',     'plus', 230),
  ('profile_views_names',   'See who viewed your profile',          'analytics',    'plus', 240),
  ('skill_swap',            'Skill swap suggestions',               'matching',     'plus', 250),
  ('weekly_analytics',      'Weekly focus summary',                 'analytics',    'plus', 260),
  ('priority_matching',     'Priority in group placement',          'matching',     'plus', 270),
  ('ai_matching',           'AI-powered match explanations',        'ai',           'pro', 300),
  ('ai_icebreakers',        'Personalized conversation starters',   'ai',           'pro', 310),
  ('company_create',        'Create company profile',               'company',      'pro', 320),
  ('company_directory_full','Full company directory access',        'company',      'pro', 330),
  ('company_matching',      'Business need/offer matching',         'company',      'pro', 340),
  ('company_intros',        'Send company introductions',           'company',      'pro', 350),
  ('monthly_analytics',     'Monthly impact report',                'analytics',    'pro', 360),
  ('network_map',           'Visual connection network',            'analytics',    'pro', 370),
  ('session_insights',      'Post-session AI summary',              'ai',           'pro', 380),
  ('boosted_visibility',    'Appear higher in discovery',           'discovery',    'pro', 390),
  ('ai_deep_matching',      'Semantic AI company matching',         'ai',           'max', 400),
  ('ai_intro_drafting',     'AI-written intro messages',            'ai',           'max', 410),
  ('ai_deal_intelligence',  'AI collaboration opportunities',       'ai',           'max', 420),
  ('company_intros_unlimited','Unlimited company intros',           'company',      'max', 430),
  ('cross_space_matching',  'Match across all venues',              'company',      'max', 440),
  ('company_analytics',     'Company view & match analytics',       'analytics',    'max', 450),
  ('intro_tracking',        'Intro success pipeline tracking',      'company',      'max', 460),
  ('broker_mode',           'Introduce other companies',            'company',      'max', 470),
  ('priority_placement',    'Featured in Companies Here',           'company',      'max', 480),
  ('multi_company',         'Manage up to 3 companies',             'company',      'max', 490),
  ('team_seats',            '3 team members get Pro access',        'company',      'max', 500),
  ('concierge',             'Monthly curated match list',           'company',      'max', 510)
ON CONFLICT (feature_key) DO NOTHING;

-- Seed limits
INSERT INTO tier_limits (tier_id, limit_key, limit_value, label) VALUES
  ('free',  'connections_per_week',      3,  'Connection requests per week'),
  ('free',  'roulette_per_week',         1,  'Coffee roulette per week'),
  ('free',  'micro_requests_active',     1,  'Active micro requests'),
  ('free',  'company_intros_per_month',  0,  'Company intros per month'),
  ('plus',  'connections_per_week',     -1,  'Connection requests per week'),
  ('plus',  'roulette_per_week',        -1,  'Coffee roulette per week'),
  ('plus',  'micro_requests_active',     3,  'Active micro requests'),
  ('plus',  'company_intros_per_month',  0,  'Company intros per month'),
  ('pro',   'connections_per_week',     -1,  'Connection requests per week'),
  ('pro',   'roulette_per_week',        -1,  'Coffee roulette per week'),
  ('pro',   'micro_requests_active',     5,  'Active micro requests'),
  ('pro',   'company_intros_per_month',  5,  'Company intros per month'),
  ('max',   'connections_per_week',     -1,  'Connection requests per week'),
  ('max',   'roulette_per_week',        -1,  'Coffee roulette per week'),
  ('max',   'micro_requests_active',    10,  'Active micro requests'),
  ('max',   'company_intros_per_month', -1,  'Company intros per month')
ON CONFLICT (tier_id, limit_key) DO NOTHING;

-- Triggers
CREATE OR REPLACE FUNCTION trg_create_free_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, tier_id, status, billing_cycle, payment_provider)
  VALUES (NEW.id, 'free', 'active', 'lifetime', 'system')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_free_subscription ON profiles;
CREATE TRIGGER trg_auto_free_subscription
  AFTER INSERT ON profiles FOR EACH ROW
  EXECUTE FUNCTION trg_create_free_subscription();

CREATE OR REPLACE FUNCTION trg_sync_profile_tier()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE profiles SET subscription_tier = NEW.tier_id WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_subscription_change ON user_subscriptions;
CREATE TRIGGER trg_on_subscription_change
  AFTER INSERT OR UPDATE ON user_subscriptions FOR EACH ROW
  EXECUTE FUNCTION trg_sync_profile_tier();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
