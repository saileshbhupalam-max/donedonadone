-- Add granular notification category columns to notification_preferences.
-- WHY individual columns instead of relying solely on channels JSONB:
--   1. Explicit columns are self-documenting in the schema
--   2. They can have NOT NULL + DEFAULT constraints enforced at DB level
--   3. Queries like "all users with session_reminders=true" don't need JSONB operators
--   4. The channels JSONB remains for extensible/custom categories added later
--
-- WHY these specific categories (from Leanplum 2023 retention research):
--   session_reminders: 24h + 1h before — highest engagement of any notification type
--   social_updates: "someone joined your session" — triggers FOMO, drives rebooking
--   fc_updates: credits earned/expiring — loss aversion drives action
--   marketing: product updates, tips — opt-out by default to respect attention

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS session_reminders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS social_updates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fc_updates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketing BOOLEAN NOT NULL DEFAULT false;

-- Store the full Web Push API subscription object for convenience.
-- WHY: While push_subscriptions table holds individual subscriptions,
-- this JSONB field caches the latest subscription data alongside preferences
-- so the settings UI can display subscription state without a join.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_subscription JSONB DEFAULT NULL;

-- Update the channels JSONB default to include follow_rsvp (added in UI already)
-- WHY: New users created via the trigger should get the full default set
ALTER TABLE public.notification_preferences
  ALTER COLUMN channels SET DEFAULT '{"session_reminders": true, "streak_warnings": true, "weekly_digest": true, "connection_updates": true, "community_updates": true, "follow_rsvp": true, "upgrade_prompts": false}'::jsonb;
