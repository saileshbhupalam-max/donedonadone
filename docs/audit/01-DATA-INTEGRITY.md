# Audit 01: Data Integrity & Schema Coherence

**Auditor:** Claude Opus 4.6
**Date:** 2026-03-15
**Scope:** All 70 migration files in `supabase/migrations/`, all TypeScript code in `src/`
**Methodology:** Full schema catalog from migrations, cross-referenced with every `.from("table")` call in TypeScript, RLS policy review, constraint analysis, naming consistency check.

---

## Summary

The database has **39 tables**, **12+ RPC functions**, and **~90 RLS policies** across 70 migration files. The schema evolved rapidly with multiple fix-up migrations patching earlier mistakes. This audit found **19 failure points** spanning column name mismatches in SQL functions, missing foreign keys, missing `data` column on notifications, inconsistent neighborhood slug formats in seed data, dual suspension mechanisms that conflict, and several tables with no write path or unused columns.

---

## F-01: `check_block_escalation()` uses wrong column names for `member_flags`

**Severity:** CRITICAL
**Category:** Data corruption / runtime failure

The `check_block_escalation()` trigger function (in `20260315_block_auto_escalation.sql`) inserts into `member_flags` using column names that do not exist on the table.

**Evidence:**
- `20260315_block_auto_escalation.sql:44` — `WHERE flagged_user_id = NEW.blocked_id` — column is actually `flagged_user` (not `flagged_user_id`)
- `20260315_block_auto_escalation.sql:48` — `INSERT INTO member_flags (flagged_user_id, flagged_by, reason, details)` — column is `flagged_user` (not `flagged_user_id`), and column `details` does not exist (the column is `notes`)
- The actual `member_flags` schema (from `20260309053104`): `flagged_user uuid`, `flagged_by uuid`, `session_id uuid NOT NULL`, `reason text NOT NULL`, `notes text`

**Impact:** When 3+ people block a user, the trigger fires and will crash with `ERROR: column "flagged_user_id" of relation "member_flags" does not exist`. The auto-escalation safety system is completely non-functional. Additionally, `session_id` is `NOT NULL` but the INSERT does not provide it, so even with fixed column names the INSERT would fail.

**Fix:** Replace `flagged_user_id` with `flagged_user`, `details` with `notes`, and provide a value for `session_id` (or make `session_id` nullable for system-generated flags).

---

## F-02: `notifications` table missing `data` column used by 17+ SQL functions

**Severity:** CRITICAL
**Category:** Runtime failure across multiple subsystems

The `notifications` table (created in `20260308120559`) has columns: `id, user_id, type, title, body, link, read, created_at`. There is no `data` column. However, at least 17 SQL functions across 6 migrations insert into `notifications` using a `data` column:

**Evidence:**
- `20260315_server_side_business_logic.sql:307,331,441` — `INSERT INTO notifications (user_id, type, title, body, data, read)`
- `20260315_empty_room_noshow_penalties.sql:108,193,219,228,293` — same pattern
- `20260315_data_expiry.sql:138` — same pattern
- `20260315_fc_economy.sql:189,203,215` — same pattern
- `20260315_member_follows_and_blocks.sql:98,116,133` — same pattern
- `20260315_block_auto_escalation.sql:33,55` — same pattern

**Impact:** Every call to `server_cancel_rsvp()`, `server_process_no_shows()`, `server_check_demand_cluster()`, `server_evaluate_venue_health()`, `server_fulfill_redemption()`, `notify_rsvp_followers_and_blockers()`, and `check_block_escalation()` will fail with `ERROR: column "data" of relation "notifications" does not exist`. This breaks the cancellation cascade, no-show penalties, auto-session creation, FC redemptions, and follow/block alerts.

**Fix:** Add migration: `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;`

---

## F-03: `autoSession.ts` writes to non-existent table `rsvps` instead of `event_rsvps`

**Severity:** CRITICAL
**Category:** Data loss — auto-session RSVPs silently fail

**Evidence:**
- `src/lib/autoSession.ts:263` — `await supabase.from("rsvps").upsert(rsvps, { onConflict: "event_id,user_id" });`
- The actual table name is `event_rsvps` (created in `20260308115655`)
- No table named `rsvps` exists anywhere in the schema

**Impact:** When the client-side auto-session code creates a session and tries to auto-RSVP all requesters, the upsert silently fails (Supabase returns an error but the code does not appear to halt on it). Users who triggered the demand cluster get a notification saying a session was created but are not actually RSVP'd.

**Fix:** Change `"rsvps"` to `"event_rsvps"` in `src/lib/autoSession.ts:263`.

---

## F-04: `server_activate_venue()` inserts into `locations` with columns that do not exist

**Severity:** HIGH
**Category:** Runtime failure on venue activation

**Evidence:**
- `20260315_server_side_business_logic.sql:213` — `INSERT INTO locations (name, address, neighborhood, latitude, longitude, location_type, wifi_available, photo_url, google_maps_url)`
- The `locations` table (created in `20260310092800`) has no `address`, `wifi_available`, `photo_url`, or `google_maps_url` columns
- The actual columns are: `id, name, location_type, parent_location_id, latitude, longitude, radius_meters, neighborhood, city, is_partner, venue_partner_id, member_count, verified, photo_url, created_at, updated_at`
- `photo_url` does exist, but `address`, `wifi_available`, and `google_maps_url` do not

**Impact:** The `server_activate_venue()` RPC will fail when trying to promote a verified venue nomination to an active location. The entire permissionless venue activation pipeline is broken at the final step.

**Fix:** Remove non-existent columns from the INSERT, or add the missing columns to `locations`.

---

## F-05: `server_check_demand_cluster()` in `data_expiry.sql` uses non-existent column `max_attendees`

**Severity:** HIGH
**Category:** Runtime failure on auto-session creation

**Evidence:**
- `20260315_data_expiry.sql:98` — `INSERT INTO events (..., max_attendees, ...)` — the column is `max_spots`
- The fix migration `20260315_empty_room_noshow_penalties.sql` explicitly acknowledges this bug at line 3: "Also fixes: server_check_demand_cluster using wrong column names (max_attendees -> max_spots)"
- However, the `data_expiry.sql` migration runs AFTER `empty_room_noshow_penalties.sql` (alphabetical sort order within same date prefix), meaning the last-applied version of `server_check_demand_cluster` is the one from `data_expiry.sql` which RE-INTRODUCES the `max_attendees` bug

**Impact:** The final version of `server_check_demand_cluster()` that is active in the database uses `max_attendees` which does not exist. All server-side auto-session creation from demand clusters fails.

**Fix:** Change `max_attendees` to `max_spots` in `20260315_data_expiry.sql:98`.

---

## F-06: Seed data uses `hsr_layout` (underscore) while system normalizes to `hsr-layout` (hyphen)

**Severity:** HIGH
**Category:** Data inconsistency — neighborhoods never match

**Evidence:**
- `20260308115655` (events seed): `'hsr_layout'` — underscore format
- `20260315_seed_hsr_venues.sql`: `'hsr-layout'` — hyphen format
- `20260315_server_side_business_logic.sql:468`: `'hsr-layout'` — hyphen format (neighborhood_stats bootstrap)
- `src/lib/neighborhoods.ts` normalizes to `hsr-layout` (hyphen)
- `20260310100233` (locations seed): `'HSR Layout'` — raw display name, not normalized at all

**Impact:** The seeded events and the seeded locations use different neighborhood formats. Queries that join on `neighborhood` between `events`, `locations`, `neighborhood_stats`, and `venue_nominations` will return empty results for any neighborhood that has mixed formats. The auto-session demand clustering (which groups by `neighborhood`) will fail to cluster requests from the underscore-format events with the hyphen-format session_requests.

**Fix:** Standardize all seed data to use `hsr-layout`. Add a CHECK constraint or trigger on all tables with `neighborhood` columns to enforce the normalized slug format.

---

## F-07: Dual suspension mechanisms — `suspended_until` vs `is_suspended`

**Severity:** HIGH
**Category:** Schema incoherence — suspension checks inconsistent

**Evidence:**
- `20260310052519` adds `profiles.suspended_until` (timestamptz) and `profiles.suspension_reason` — used by `check_flag_auto_escalation()`
- `20260315_block_auto_escalation.sql:10` adds `profiles.is_suspended` (boolean) — used by `check_block_escalation()`
- SQL functions like `get_public_profile()`, `get_whos_here()`, `match_coffee_roulette()` check `suspended_until IS NULL OR suspended_until < now()` but NEVER check `is_suspended`
- The `prevent_system_column_changes()` trigger protects `suspended_until` and `suspension_reason` but does NOT protect `is_suspended`

**Impact:** A user suspended via block escalation (`is_suspended = true`) will still appear in discovery, coffee roulette, and public profiles because those queries only check `suspended_until`. A regular user could also set `is_suspended = false` on their own profile since it is not protected by the system column trigger.

**Fix:** Consolidate to one mechanism. Either (a) have `check_block_escalation()` set `suspended_until` instead of `is_suspended`, or (b) update all RPC functions to also check `is_suspended`, and add `is_suspended` to the `prevent_system_column_changes()` trigger.

---

## F-08: `venue_health_checks.location_id` has no foreign key constraint

**Severity:** HIGH
**Category:** Missing referential integrity

**Evidence:**
- `20260313_permissionless_growth.sql:51` — `location_id uuid NOT NULL` — no `REFERENCES locations(id)` clause
- Comment says "references locations table" but the FK is missing

**Impact:** Health checks can be submitted for non-existent location IDs. The `server_evaluate_venue_health()` function will silently process invalid location IDs. Orphan health check records accumulate with no way to join them back to actual venues.

**Fix:** `ALTER TABLE venue_health_checks ADD CONSTRAINT fk_health_checks_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;`

---

## F-09: `day_passes.payment_id` references `payments(id)` as UUID but `server_fulfill_redemption()` inserts a text string

**Severity:** HIGH
**Category:** Type mismatch — runtime failure

**Evidence:**
- `20260315_day_passes.sql:9` — `payment_id uuid references public.payments(id)`
- `20260315_fc_economy.sql:184` — `INSERT INTO day_passes (... payment_id ...) VALUES (... 'fc_redeemed' ...)`
- `20260315_fc_economy.sql:198` — `VALUES (... 'fc_gift' ...)`
- `'fc_redeemed'` and `'fc_gift'` are text strings, not UUIDs

**Impact:** Every FC-redeemed free session and gift session will fail at INSERT time with `ERROR: invalid input syntax for type uuid: "fc_redeemed"`. The entire redemption system is broken.

**Fix:** Either change `payment_id` to `TEXT`, or use NULL for FC-redeemed passes and add a separate `source` column.

---

## F-10: `events.start_time` is `TEXT` not `TIME` — no validation, breaks time arithmetic

**Severity:** HIGH
**Category:** Missing constraints — silent data corruption

**Evidence:**
- `20260308115655` — `start_time text, end_time text`
- Seed data uses `'10:00 AM'`, `'3:00 PM'` (12-hour with AM/PM)
- Server functions use `v_event.start_time::time` cast (e.g., `20260315_empty_room_noshow_penalties.sql:155`)
- Auto-session creation inserts `'09:00'`, `'14:00'` (24-hour without AM/PM)

**Impact:** The `server_cancel_rsvp()` function casts `start_time` to `time` type. If a user or admin enters `'3:00 PM'`, the cast `'3:00 PM'::time` actually works in Postgres, but `'10:00 AM'` does too. However, there is no validation — a value like `'soon'` or `'afternoon'` would crash the server-side cancellation logic. The mix of 12-hour and 24-hour formats in the same column creates confusion.

**Fix:** Migrate `start_time` and `end_time` to `TIME` type, or add a CHECK constraint ensuring the format is valid. Standardize all existing data to 24-hour format.

---

## F-11: `session_format` CHECK constraint does not include auto-session format values

**Severity:** MEDIUM
**Category:** Missing CHECK values — auto-session creation fails

**Evidence:**
- `20260308183815:119` — `CHECK (session_format IN ('structured_4hr','structured_2hr','casual'))`
- Auto-session RPCs insert `'morning_2hr'`, `'afternoon_2hr'`, `'evening_2hr'` (e.g., `20260315_empty_room_noshow_penalties.sql:91-92`)

**Impact:** `server_check_demand_cluster()` will fail with a CHECK constraint violation when creating auto-sessions with format values not in the allowed set.

**Fix:** `ALTER TABLE events DROP CONSTRAINT events_session_format_check; ALTER TABLE events ADD CONSTRAINT events_session_format_check CHECK (session_format IN ('structured_4hr','structured_2hr','casual','morning_2hr','afternoon_2hr','evening_2hr'));`

---

## F-12: `events.rsvp_count` is client-managed with race conditions

**Severity:** MEDIUM
**Category:** Race condition — counter drift

**Evidence:**
- `src/hooks/useEvents.ts:209` — `await supabase.from("events").update({ rsvp_count: Math.max(0, (event?.rsvp_count || 0) + delta) })` — read-then-write, not atomic
- `src/hooks/useEvents.ts:221` — same pattern for inserts
- `20260315_empty_room_noshow_penalties.sql:168` — `UPDATE events SET rsvp_count = GREATEST(0, COALESCE(rsvp_count, 0) - 1)` — server-side cancel also modifies count
- No trigger keeps `rsvp_count` in sync with actual `SELECT COUNT(*) FROM event_rsvps WHERE status = 'going'`

**Impact:** Two users RSVPing simultaneously can both read `rsvp_count = 3`, both write `4`, losing one increment. Over time, `rsvp_count` drifts from reality. Sessions may appear to have open spots when full, or vice versa.

**Fix:** Replace with a computed column or a trigger that sets `rsvp_count = (SELECT COUNT(*) FROM event_rsvps WHERE event_id = NEW.event_id AND status = 'going')` on every `event_rsvps` INSERT/UPDATE/DELETE.

---

## F-13: `session_templates` RLS checks `user_type IN ('Admin', 'Venue Partner')` but `user_type` values are lowercase

**Severity:** MEDIUM
**Category:** RLS policy mismatch — feature inaccessible

**Evidence:**
- `20260313_session_templates.sql:26` — `WHERE user_type IN ('Admin', 'Venue Partner')`
- `20260309053104:7` — `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'member'`
- `20260309060000` — `SET user_type = 'admin'` (lowercase)
- The `focus_credits` admin policy uses `user_type = 'Admin'` (capitalized) in `20260313_growth_system.sql:38`

**Impact:** Admins cannot manage session templates because their `user_type` is `'admin'` (lowercase) but the policy checks for `'Admin'` (capitalized). Same issue with `'Venue Partner'` — no code ever sets this value. The admin policies in `focus_credits` and `referral_rewards` also use `'Admin'` (capitalized) and will similarly fail.

**Fix:** Standardize all policies to use lowercase `'admin'`. Add a CHECK constraint on `profiles.user_type` to prevent case inconsistencies.

---

## F-14: `app_settings` has no INSERT policy — admin cannot add new settings

**Severity:** MEDIUM
**Category:** Missing RLS policy

**Evidence:**
- `20260308121247` — creates table with UPDATE policy only
- `20260308140000` — replaces UPDATE policy with admin-only, but no INSERT policy ever created
- The seed data is inserted in the migration itself (bypasses RLS), but no runtime INSERT is possible

**Impact:** Admin cannot add new settings (e.g., new `growth_config` overrides) at runtime. The `admin_emails` setting can never be updated to add new admins via the UI — it can only be changed via direct DB migration.

**Fix:** Add: `CREATE POLICY "Admin can insert settings" ON app_settings FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));`

---

## F-15: `cowork_preferences` and `community_rituals` missing `ON DELETE CASCADE` on `event_id` FK

**Severity:** MEDIUM
**Category:** Missing CASCADE — orphan records

**Evidence:**
- `20260309093253:17` — `event_id uuid REFERENCES events(id) NOT NULL` — no `ON DELETE CASCADE`
- `20260309101439:36` — `community_rituals` has no FK to events, but `session_scrapbook` at line 5 has `event_id uuid REFERENCES events(id) NOT NULL` without CASCADE

**Impact:** If an event is deleted, `cowork_preferences` and `session_scrapbook` rows referencing it will cause a FK violation error, preventing the delete. Admin cannot clean up test or cancelled events.

**Fix:** Add `ON DELETE CASCADE` to both FKs.

---

## F-16: `venue_contributions.venue_id` has no foreign key — nullable with no referential integrity

**Severity:** MEDIUM
**Category:** Missing FK

**Evidence:**
- `20260313_growth_system.sql:53` — `venue_id UUID` — nullable, no REFERENCES clause
- Comment says "nullable for venue suggestions" but even when non-null, there is no FK

**Impact:** Venue contribution data can reference non-existent venue IDs. Aggregation queries joining `venue_contributions` to `locations` or `venue_partners` may silently drop rows or return incorrect counts.

**Fix:** Add FK: `ALTER TABLE venue_contributions ADD CONSTRAINT fk_venue_contributions_location FOREIGN KEY (venue_id) REFERENCES locations(id) ON DELETE SET NULL;`

---

## F-17: `events` table has no index on `neighborhood` column

**Severity:** MEDIUM
**Category:** Missing index — slow queries at scale

**Evidence:**
- `events.neighborhood` is queried by: `server_check_demand_cluster()`, `find_nearby_sessions()`, event listing filters in `useEvents.ts`, auto-session matching
- No index exists on `events.neighborhood` (only `idx_events_date` on `date`)
- `session_requests.neighborhood` also has no index, yet is the primary grouping key for demand clustering

**Impact:** As events and session_requests grow, demand cluster queries will perform full table scans. At the target of 1000 bookings/day, this becomes a performance bottleneck within weeks.

**Fix:** `CREATE INDEX idx_events_neighborhood ON events(neighborhood); CREATE INDEX idx_session_requests_neighborhood ON session_requests(neighborhood, preferred_time) WHERE status = 'pending';`

---

## F-18: `prompts.response_count` is a denormalized counter with no update mechanism

**Severity:** LOW
**Category:** Stale data — counter never updated

**Evidence:**
- `20260308113628:10` — `response_count integer DEFAULT 0`
- No trigger or RPC updates this counter when `prompt_responses` rows are inserted
- `src/hooks/usePrompts.ts` never updates `prompts.response_count`

**Impact:** The `response_count` column on `prompts` is always 0. If any UI displays it, it will be misleading.

**Fix:** Either remove the column (use `COUNT(*) FROM prompt_responses` instead) or add an AFTER INSERT trigger on `prompt_responses` that increments the counter.

---

## F-19: `taste_answers` references `auth.users(id)` instead of `profiles(id)` — inconsistent FK pattern

**Severity:** LOW
**Category:** Inconsistent FK pattern

**Evidence:**
- `20260315_taste_engine.sql:27` — `user_id UUID NOT NULL REFERENCES auth.users(id)` — references auth.users directly
- `venue_nominations` and `venue_vouches` also reference `auth.users(id)` directly
- Every other user-linked table (40+) references `profiles(id)` with `ON DELETE CASCADE`

**Impact:** If a profile is deleted but the auth.users row persists (or vice versa), `taste_answers`, `venue_nominations`, and `venue_vouches` will have inconsistent cascade behavior compared to all other tables. The `ON DELETE CASCADE` from `profiles` will not cascade to these tables.

**Fix:** Change to `REFERENCES profiles(id) ON DELETE CASCADE` for consistency.

---

## Appendix: Tables Catalog

| # | Table | RLS | Policies | FKs | Notes |
|---|-------|-----|----------|-----|-------|
| 1 | profiles | Yes | 3 | 1 (auth.users) | Core table, 40+ columns across migrations |
| 2 | prompts | Yes | 1 | 0 | `response_count` stale (F-18) |
| 3 | prompt_responses | Yes | 3 | 2 | OK |
| 4 | prompt_reactions | Yes | 3 | 2 | OK |
| 5 | events | Yes | 4 | 2 | `start_time` text (F-10), `session_format` CHECK too narrow (F-11) |
| 6 | event_rsvps | Yes | 4 | 2 | `rsvp_count` race (F-12) |
| 7 | member_badges | Yes | 2 | 1 | OK |
| 8 | notifications | Yes | 4 | 1 | Missing `data` column (F-02) |
| 9 | app_settings | Yes | 2 | 0 | No INSERT policy (F-14) |
| 10 | event_feedback | Yes | 3 | 2 | OK |
| 11 | session_requests | Yes | 2 | 1 | OK |
| 12 | monthly_titles | Yes | 2 | 1 | OK |
| 13 | exclusive_achievements | Yes | 2 | 1 | OK |
| 14 | profile_views | Yes | 2 | 2 | OK |
| 15 | peer_props | Yes | 2 | 3 | OK |
| 16 | session_phases | Yes | 3 | 1 | OK |
| 17 | session_intentions | Yes | 3 | 2 | OK |
| 18 | member_status | Yes | 4 | 2 | OK, Realtime enabled |
| 19 | icebreaker_questions | Yes | 2 | 0 | OK |
| 20 | energy_checks | Yes | 2 | 2 | OK |
| 21 | session_photos | Yes | 2 | 2 | OK |
| 22 | venue_partners | Yes | 4 | 0 | OK |
| 23 | venue_scans | Yes | 2 | 2 | OK |
| 24 | venue_reviews | Yes | 2 | 3 | OK |
| 25 | personality_config | Yes | 2 | 0 | OK |
| 26 | member_flags | Yes | 4 | 3 | Target of broken `check_block_escalation` (F-01) |
| 27 | session_waitlist | Yes | 4 | 2 | OK |
| 28 | member_milestones | Yes | 3 | 1 | OK |
| 29 | analytics_events | Yes | 2 | 1 | OK |
| 30 | feature_flags | Yes | 4 | 0 | OK |
| 31 | locations | Yes | 4 | 2 | OK |
| 32 | check_ins | Yes | 4 | 2 | OK, Realtime enabled |
| 33 | taste_graph | Yes | 4 | 1 | OK, has view + triggers |
| 34 | connections | Yes | 1 (SELECT) | 2 | No direct INSERT/UPDATE — via RPCs only |
| 35 | behavioral_signals | Yes | 1 (admin SELECT) | 4 | No user access — via RPCs only |
| 36 | cowork_preferences | Yes | 2 | 3 | Missing CASCADE on events FK (F-15) |
| 37 | session_scrapbook | Yes | 3 | 2 | Missing CASCADE on events FK (F-15) |
| 38 | community_rituals | Yes | 3 | 1 | OK |
| 39 | ritual_likes | Yes | 3 | 2 | OK |
| 40 | venue_vibes | Yes | 3 | 2 | OK |
| 41 | micro_requests | Yes | 3 | 3 | OK, Realtime enabled |
| 42 | coffee_roulette_queue | Yes | 4 | 2 | OK |
| 43 | connection_requests | Yes | 3 | 2 | OK, Realtime enabled |
| 44 | user_streaks | Yes | 1 (SELECT) | 1 | OK — writes via RPC only |
| 45 | user_settings | Yes | 3 | 1 | OK |
| 46 | subscription_tiers | Yes | 2 | 0 | OK |
| 47 | tier_features | Yes | 2 | 1 | OK |
| 48 | tier_limits | Yes | 2 | 1 | OK |
| 49 | user_subscriptions | Yes | 2 | 2 | OK |
| 50 | session_boosts | Yes | 2 | 2 | OK |
| 51 | intro_credits | Yes | 1 (SELECT) | 1 | No INSERT policy — writes via admin/RPC only |
| 52 | payments | Yes | 1 (SELECT) | 1 | No INSERT policy — writes via service role |
| 53 | push_subscriptions | Yes | 3 | 1 | OK |
| 54 | focus_credits | Yes | 2 (SELECT) | 1 | INSERT locked down — via RPCs only |
| 55 | venue_contributions | Yes | 3 | 1 | Missing FK on venue_id (F-16) |
| 56 | referral_rewards | Yes | 4 | 2 | Admin policy uses `'Admin'` not `'admin'` (F-13) |
| 57 | venue_nominations | Yes | 3 | 1 (auth.users) | FK inconsistency (F-19) |
| 58 | venue_vouches | Yes | 2 | 2 (auth.users + nominations) | FK inconsistency (F-19) |
| 59 | venue_health_checks | Yes | 2 | 1 (auth.users) | Missing FK on location_id (F-08) |
| 60 | neighborhood_stats | Yes | 1 (SELECT) | 0 | OK — writes via RPCs only |
| 61 | session_templates | Yes | 2 | 2 | User_type case mismatch (F-13) |
| 62 | taste_questions | Yes | 1 | 0 | No admin write policy |
| 63 | taste_answers | Yes | 3 | 2 (auth.users) | FK inconsistency (F-19) |
| 64 | day_passes | Yes | 3 | 2 | payment_id type mismatch (F-09) |
| 65 | member_follows | Yes | 3 | 2 | OK |
| 66 | member_blocks | Yes | 4 | 2 | OK |

---

## Priority Fix Order

1. **F-02** (notifications.data column) — blocks 6+ server RPCs
2. **F-01** (check_block_escalation column names) — safety system broken
3. **F-03** (autoSession.ts wrong table name) — auto-RSVPs lost
4. **F-04** (server_activate_venue wrong columns) — venue activation broken
5. **F-05** (server_check_demand_cluster max_attendees) — demand clustering broken
6. **F-09** (day_passes.payment_id type mismatch) — FC redemption broken
7. **F-11** (session_format CHECK) — auto-session creation blocked
8. **F-13** (user_type case mismatch) — admin features inaccessible
9. **F-07** (dual suspension) — safety bypass
10. **F-06** (neighborhood slug inconsistency) — matching failures
