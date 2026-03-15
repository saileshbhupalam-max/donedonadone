-- Schedule notification Edge Functions via pg_cron + pg_net
-- These functions have verify_jwt = false in config.toml so they can be called
-- by pg_cron without needing the service role key in the URL.
--
-- All times are UTC. IST = UTC + 5:30.

-- Session reminders: run at 12:30 UTC (6:00 PM IST) daily
-- Sends reminders for tomorrow's sessions
SELECT cron.schedule(
  'send-session-reminders',
  '30 12 * * *',
  $$
  SELECT extensions.http_post(
    'https://cdybdawcyptgqmjlmrpx.supabase.co/functions/v1/send-session-reminders',
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Streak warnings: run at 3:30 UTC (9:00 AM IST) daily
-- Nudges users at risk of losing streaks
SELECT cron.schedule(
  'send-streak-warnings',
  '30 3 * * *',
  $$
  SELECT extensions.http_post(
    'https://cdybdawcyptgqmjlmrpx.supabase.co/functions/v1/send-streak-warnings',
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Match nudges: run at 4:00 UTC (9:30 AM IST) daily
-- Sends top 3 compatible match suggestions per user
SELECT cron.schedule(
  'match-nudges',
  '0 4 * * *',
  $$
  SELECT extensions.http_post(
    'https://cdybdawcyptgqmjlmrpx.supabase.co/functions/v1/match-nudges',
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Weekly digest: run at 1:30 UTC (7:00 AM IST) every Monday
-- Computes weekly stats and sends digest
SELECT cron.schedule(
  'compute-weekly-digest',
  '30 1 * * 1',
  $$
  SELECT extensions.http_post(
    'https://cdybdawcyptgqmjlmrpx.supabase.co/functions/v1/compute-weekly-digest',
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- AI community manager: run at 5:00 UTC (10:30 AM IST) daily
-- Churn prediction, auto-welcome, community prompt suggestions
SELECT cron.schedule(
  'ai-community-manager',
  '0 5 * * *',
  $$
  SELECT extensions.http_post(
    'https://cdybdawcyptgqmjlmrpx.supabase.co/functions/v1/ai-community-manager',
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Seed admin_emails setting for dynamic admin list
-- Hardcoded fallback in useAdminCheck.ts works without this,
-- but this enables adding/removing admins without redeploying
INSERT INTO public.app_settings (key, value)
VALUES ('admin_emails', '{"emails": ["saileshbhupalam@gmail.com"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
