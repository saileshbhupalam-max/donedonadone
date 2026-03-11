# Database Schema & Migrations Audit

**Audited:** 2026-03-09 | **Codebase:** focusclub-find-your-people

## CRITICAL Issues (14)

### 1. RLS: `profiles` INSERT too permissive
Any authenticated user can insert a profile with any `user_type` (including `admin`). Should restrict to `auth.uid() = id` AND `user_type = 'coworker'` on INSERT.

### 2. RLS: `profiles` UPDATE too permissive
Users can UPDATE their own `user_type`, `reliability_status`, `no_show_count`, `sessions_rsvpd`, `sessions_showed_up`, `captain_sessions` — all system-managed columns. UPDATE policy should exclude these columns or use a function-based approach.

### 3. RLS: `personality_config` writable by any authenticated user
INSERT/UPDATE/DELETE policies allow any authenticated user to modify personality config. Should be admin-only.

### 4. RLS: `member_milestones` writable by any authenticated user
Any user can insert milestones for themselves (or others). Should be system-only (service role or RPC).

### 5. RLS: `analytics_events` writable by any authenticated user
Any user can insert analytics events with arbitrary data. Should validate `user_id = auth.uid()`.

### 6. RLS: `member_flags` — no protection against self-flagging
Users can flag themselves. Should add `flagged_user != auth.uid()` constraint.

### 7. RLS: `session_waitlist` — no validation
Any user can add anyone to any waitlist. Should restrict to `user_id = auth.uid()`.

### 8. RLS: `venue_partners` writable by any authenticated user
Any user can create/modify venue partner records. Should be admin-only.

### 9. RLS: `event_rsvps` — `is_captain` self-assignable
Users can set themselves as captain when RSVPing. Should be system-managed.

### 10. RLS: `notifications` — any user can insert notifications for ANY user
INSERT policy uses `WITH CHECK (true)`, meaning any user can create fake system notifications targeting any other user. Enables spam and phishing.

### 11. RLS: `member_flags` SELECT exposes all flags to all users
Any authenticated user can read ALL flags including who flagged whom. A flagged user could see who reported them, creating retaliation risk.

### 12. RLS: `member_badges` / `exclusive_achievements` / `monthly_titles` — users can self-award
INSERT policies let any user insert any badge_type/achievement for themselves. No validation that it was earned.

### 13. RLS: `icebreaker_questions` — any user can INSERT and UPDATE all columns
The UPDATE policy named "can update times_used" actually allows updating ALL columns.

### 14. RLS: `venue_scans` — any user can fabricate scan records
INSERT `WITH CHECK (true)` lets users insert scans with `resulted_in_signup = true` for any venue, corrupting metrics.

## MEDIUM Issues (20)

**Additional findings:**

1. No unique constraint on `(event_id, user_id)` in `event_feedback` — double-count risk for focus hours
2. No unique constraint on `(user_id, session_id)` in `session_waitlist` — duplicate waitlist entries possible
3. No unique constraint on `(flagged_user, flagging_user, session_id)` in `member_flags` — duplicate flags possible
4. Missing index on `event_rsvps.user_id` — slow lookups for user's RSVPs
5. Missing index on `event_rsvps.event_id` — slow lookups for event attendees
6. Missing index on `session_feedback.session_id` — slow aggregation queries
7. Missing index on `member_ratings.to_user` — slow reputation queries
8. Missing index on `session_waitlist.session_id` — slow waitlist lookups
9. Missing index on `member_flags.flagged_user` — slow flag aggregation
10. Missing index on `analytics_events.event_type` — slow analytics queries
11. Missing index on `member_milestones.user_id` — slow milestone lookups
12. No CHECK constraint on `profiles.reliability_status` — accepts garbage values
13. No CHECK constraint on `event_rsvps.status` — accepts garbage values
14. No CHECK constraint on `sessions.status` — accepts garbage values
15. `energy_checks.energy_level` has no range constraint — should be 1-5 or 1-10
16. `session_photos` has no size/type validation at DB level
17. `events.start_time` and `end_time` are TEXT not TIME — prevents DB-level time comparisons
18. `events.created_by` has no ON DELETE behavior — deleting user who created events will fail
19. Missing index on `events.date` — queried for upcoming/past views
20. Missing index on `notifications(user_id, read)` — high-traffic query pattern

## LOW Issues (11)

1. `icebreaker_questions.category` has no CHECK constraint
2. `venue_reviews` has no unique constraint on `(venue_partner_id, reviewer_id)`
3. `venue_scans.scanned_at` defaults to `now()` but no index for time-range queries
4. No foreign key from `event_feedback.session_id` to `sessions.id` (if applicable)
5. `personality_config.tokens` is text[] but not validated
6. `member_milestones.milestone_type` has no CHECK constraint
7. `analytics_events.metadata` is jsonb with no schema validation
8. No cascade delete rules documented — orphan risk on user deletion
9. `profiles.focus_hours` can be manually set to any value
10. No audit trail / updated_at triggers on sensitive tables
11. `venue_partners.pipeline_status` has no CHECK constraint
