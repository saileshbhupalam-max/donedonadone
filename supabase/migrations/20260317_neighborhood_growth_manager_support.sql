-- Support columns for the neighborhood-growth-manager Edge Function.
-- This function runs daily and detects milestone crossings by comparing
-- current member_count against last_member_count_seen from the previous run.

-- Add last_member_count_seen to track the member count at last cron run.
-- WHY: milestone detection requires knowing what the count was LAST time we
-- checked. Without this column, we'd either re-notify on every run or need
-- a separate tracking table. A single integer column is simpler and faster.
ALTER TABLE neighborhood_stats
  ADD COLUMN IF NOT EXISTS last_member_count_seen integer DEFAULT 0;

-- Backfill: set last_member_count_seen to current member_count for existing
-- rows so the first run doesn't falsely detect milestone crossings.
-- WHY: without backfill, every existing neighborhood would appear to have
-- crossed all milestones below its current count on the first run.
UPDATE neighborhood_stats
  SET last_member_count_seen = COALESCE(member_count, 0)
  WHERE last_member_count_seen IS NULL OR last_member_count_seen = 0;
