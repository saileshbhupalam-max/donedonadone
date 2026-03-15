-- F-10: Validate events.start_time and end_time format
--
-- WHY NOT ALTER TO TIME TYPE:
-- The codebase concatenates date + "T" + start_time to build ISO datetime strings:
--   new Date(`${event.date}T${event.start_time}`)  -- EventDetail.tsx:316, SpaceInsights.tsx:332
-- PostgreSQL TIME type returns "HH:MM:SS" (with seconds), which would:
--   1. Change display from "09:00" to "09:00:00" across all UI components
--   2. Still work for Date parsing but break visual expectations
-- Additionally, autoSession.ts and the auto-sessions Edge Function insert values
-- like '09:00', '09:30', '14:00' as plain strings.
--
-- DECISION: Keep as TEXT but add CHECK constraints to enforce HH:MM format.
-- This prevents garbage data while preserving the string concatenation pattern.
--
-- WHY THIS MATTERS: Time comparisons on TEXT are lexicographic, not temporal.
-- "09:00" < "14:00" works correctly by accident (HH:MM zero-padded strings sort
-- correctly), but "9:00" < "14:00" would fail. The CHECK constraint enforces
-- zero-padded HH:MM, making lexicographic ordering equivalent to temporal ordering.

-- Validate start_time: must be HH:MM with valid hour (00-23) and minute (00-59)
-- Allows NULL values (not all events have explicit times)
ALTER TABLE events
  ADD CONSTRAINT events_start_time_format
  CHECK (
    start_time IS NULL
    OR start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'
  );

COMMENT ON CONSTRAINT events_start_time_format ON events IS
  'Enforces HH:MM format (24h, zero-padded). Keeps TEXT type for JS date concatenation compatibility.';

-- Validate end_time with the same pattern
ALTER TABLE events
  ADD CONSTRAINT events_end_time_format
  CHECK (
    end_time IS NULL
    OR end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'
  );

COMMENT ON CONSTRAINT events_end_time_format ON events IS
  'Enforces HH:MM format (24h, zero-padded). Matches start_time constraint.';

-- Also validate that end_time > start_time when both are present.
-- WHY: Because these are zero-padded HH:MM strings, lexicographic comparison
-- is equivalent to temporal comparison, so a simple > works correctly.
ALTER TABLE events
  ADD CONSTRAINT events_end_after_start
  CHECK (
    start_time IS NULL
    OR end_time IS NULL
    OR end_time > start_time
  );

COMMENT ON CONSTRAINT events_end_after_start ON events IS
  'Prevents sessions where end_time is before or equal to start_time. Works because HH:MM strings sort temporally.';
