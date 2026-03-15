-- Add silent_days column to notification_preferences
-- Array of day numbers (0=Sun, 6=Sat) where no push/email/whatsapp notifications are sent
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS silent_days INT[] DEFAULT '{}'::INT[];
