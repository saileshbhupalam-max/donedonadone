-- Fix session_format CHECK constraint to include all formats used by auto-sessions.
--
-- The original constraint (from 20260308183815) only allowed:
--   structured_4hr, structured_2hr, casual
--
-- But auto-session code (autoSession.ts, Edge Function, and server-side RPCs)
-- inserts these additional formats:
--   morning_2hr, afternoon_2hr, evening_2hr, focus_only_2hr, focus_only_4hr
--
-- This caused INSERT failures whenever auto-sessions tried to create events.

-- Drop the auto-generated CHECK constraint.
-- PostgreSQL names inline CHECK constraints as {table}_{column}_check.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_session_format_check;

-- Add new constraint with all valid session formats.
ALTER TABLE public.events ADD CONSTRAINT events_session_format_check
  CHECK (session_format IN (
    'casual',
    'structured_2hr',
    'structured_4hr',
    'focus_only_2hr',
    'focus_only_4hr',
    'morning_2hr',
    'afternoon_2hr',
    'evening_2hr'
  ));
