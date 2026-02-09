-- Notifications: automated session lifecycle notifications
-- Types: booking_confirmed, reminder_24h, group_reveal, checkin_reminder,
--        feedback_prompt, streak_at_risk

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'booking_confirmed', 'reminder_24h', 'group_reveal', 'checkin_reminder',
    'feedback_prompt', 'streak_at_risk', 'referral_used', 'subscription_expiring'
  )),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'whatsapp', 'email')),
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications(sent_at) WHERE sent_at IS NULL;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
