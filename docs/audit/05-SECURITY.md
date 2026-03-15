# 05 — SECURITY, RLS & CLIENT TRUST BOUNDARIES

**Audit date:** 2026-03-15
**Scope:** All Supabase migrations (70+), Edge Functions (6), client lib files, hooks, integrations
**Methodology:** Manual code review of every migration file, Edge Function, RPC grant, RLS policy, and client-side auth boundary

---

## Severity Key

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Data breach, impersonation, or financial manipulation possible with a single authenticated request |
| **HIGH** | Privilege escalation or unauthorized mutation of another user's data |
| **MEDIUM** | Information leak or defense-in-depth gap that amplifies other attacks |
| **LOW** | Hardening opportunity; not directly exploitable but increases attack surface |

---

## CRITICAL-1: SECURITY DEFINER RPCs Accept Client-Supplied `p_user_id` Instead of `auth.uid()`

**Severity:** CRITICAL
**Location:** `supabase/migrations/20260315_server_side_business_logic.sql`
**Affected functions:**
- `server_award_credits(p_user_id uuid, p_action text, p_amount integer, ...)`
- `server_spend_credits(p_user_id uuid, p_amount integer, p_reason text)`
- `server_activate_venue(p_nomination_id uuid, p_user_id uuid)`
- `server_check_demand_cluster(p_neighborhood text, p_preferred_time text)`

All are `SECURITY DEFINER` (bypass RLS) and `GRANT EXECUTE ... TO authenticated`.

**Exploitation scenario:**
Any authenticated user can call `server_award_credits('any-victim-uuid', 'session_attended', 50, ...)` from the browser console:
```js
supabase.rpc('server_award_credits', {
  p_user_id: 'TARGET_UUID',
  p_action: 'session_attended',
  p_amount: 50,
  p_description: 'free money'
})
```
This mints focus credits for any account. The function enforces daily caps per action but never verifies the caller is the beneficiary. An attacker can also drain credits from any user via `server_spend_credits`.

**Fix:**
Remove the `p_user_id` parameter from every RPC that acts on the caller's own data. Replace with `auth.uid()` inside the function body:
```sql
CREATE OR REPLACE FUNCTION server_award_credits(
  p_action text,
  p_amount integer,
  p_description text DEFAULT NULL
) ...
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- use v_user_id everywhere
```
For RPCs that legitimately act on behalf of others (admin actions, cron jobs), restrict the grant to `service_role` only or add an internal admin check.

---

## CRITICAL-2: Any Authenticated User Can Check In As Any Other User

**Severity:** CRITICAL
**Location:** `supabase/migrations/20260309070000_add_venue_coordinates.sql`
**Affected functions:**
- `checkin_with_location(p_event_id uuid, p_user_id uuid, p_latitude float8, p_longitude float8)`
- `checkin_with_pin(p_event_id uuid, p_user_id uuid, p_pin text)`

Both are `SECURITY DEFINER` and granted to `authenticated`.

**Exploitation scenario:**
An attacker calls `checkin_with_location` passing any user's UUID. The function updates `event_rsvps.checked_in = true` for the victim, awards them attendance credit, and modifies their event history. This enables:
1. Fabricating attendance records for users who never showed up
2. Triggering attendance-based rewards for any user
3. Corrupting the reliability scoring system

**Fix:**
Replace `p_user_id` with `auth.uid()` inside the function body. Remove the parameter entirely.

---

## CRITICAL-3: Any User Can Cancel Another User's RSVP and Trigger No-Show Penalties

**Severity:** CRITICAL
**Location:** `supabase/migrations/20260315_empty_room_noshow_penalties.sql`
**Affected functions:**
- `server_cancel_rsvp(p_event_id uuid, p_user_id uuid)` — cancels RSVP for any user
- `server_process_no_shows(p_event_id uuid)` — marks all non-checked-in attendees as no-shows and applies reliability penalties

Both are `SECURITY DEFINER` and granted to `authenticated`.

**Exploitation scenario:**
1. Attacker calls `server_cancel_rsvp('event-id', 'victim-uuid')` to silently remove someone from an event they RSVP'd to
2. Attacker calls `server_process_no_shows('event-id')` before an event ends, penalizing all attendees who haven't checked in yet
3. Combined: cancel a user's RSVP, then trigger no-show processing to damage their reliability score

**Fix:**
- `server_cancel_rsvp`: Replace `p_user_id` with `auth.uid()` so users can only cancel their own RSVPs
- `server_process_no_shows`: Restrict grant to `service_role` only (this is a system/admin operation, not a user action)

---

## CRITICAL-4: Edge Function `send-notification` Has No Auth Validation

**Severity:** CRITICAL
**Location:** `supabase/functions/send-notification/index.ts`
**Config:** `verify_jwt = false` (in `supabase/functions/send-notification/config.toml` or function metadata)

**Exploitation scenario:**
The function accepts a POST with `{ user_id, title, body, type, data }` and inserts a notification using the service_role client. Since JWT verification is disabled and there is no manual auth check, anyone with the Supabase project URL can:
1. Send phishing-style notifications to any user: `"Your account requires verification — click here"`
2. Spam all users by iterating UUIDs
3. Inject malicious data payloads into the notification `data` JSONB field

**Fix:**
Either:
- Enable `verify_jwt = true` and validate `Authorization` header, OR
- Add a shared secret header (`X-Cron-Secret`) that only pg_cron/internal callers know, and reject requests without it

---

## CRITICAL-5: Edge Function `session-debrief` Has No Auth Validation

**Severity:** CRITICAL
**Location:** `supabase/functions/session-debrief/index.ts`

**Exploitation scenario:**
Accepts `{ event_id, user_id? }` with no auth check. An attacker can:
1. Generate AI debriefs for any event, consuming OpenAI API credits
2. Read attendee information from any event by inspecting the debrief output
3. Pass arbitrary `user_id` to generate personalized debriefs containing private session data

**Fix:**
Add auth validation. Verify the caller's JWT and confirm they are an attendee of the specified event before generating the debrief.

---

## HIGH-1: `award_badge()` and `award_milestone()` RPCs Lack Authorization

**Severity:** HIGH
**Location:** `supabase/migrations/20260309053104_1d1f236e...sql` (Security Lockdown migration)

**Affected functions:**
- `award_badge(p_user_id uuid, p_badge_key text)`
- `award_milestone(p_user_id uuid, p_milestone_key text)`

Both are `SECURITY DEFINER` with no internal check that the caller is authorized to award badges/milestones.

**Exploitation scenario:**
Any authenticated user can award themselves (or anyone) any badge or milestone:
```js
supabase.rpc('award_badge', { p_user_id: 'my-uuid', p_badge_key: 'super_contributor' })
```
This corrupts the achievement system and any UI that displays badges as trust signals.

**Fix:**
Either restrict grant to `service_role` only, or add an internal admin check:
```sql
IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
) THEN
  RAISE EXCEPTION 'Unauthorized';
END IF;
```

---

## HIGH-2: `promote_waitlist()` and `update_reliability()` RPCs Lack Authorization

**Severity:** HIGH
**Location:** `supabase/migrations/20260309053104_1d1f236e...sql`

**Affected functions:**
- `promote_waitlist(p_user_id uuid)` — moves a user off the waitlist
- `update_reliability(p_user_id uuid, p_delta integer)` — adjusts any user's reliability score

Both are `SECURITY DEFINER` with no internal auth check.

**Exploitation scenario:**
1. Any user can promote themselves off the waitlist: `supabase.rpc('promote_waitlist', { p_user_id: 'my-uuid' })`
2. Any user can boost their reliability score or tank a rival's: `supabase.rpc('update_reliability', { p_user_id: 'victim', p_delta: -100 })`

**Fix:**
Restrict both to `service_role` or add admin-only authorization inside the function body.

---

## HIGH-3: `server_activate_venue()` Lets Any User Activate Venues

**Severity:** HIGH
**Location:** `supabase/migrations/20260315_server_side_business_logic.sql`

The function `server_activate_venue(p_nomination_id uuid, p_user_id uuid)` is `SECURITY DEFINER` and granted to `authenticated`. It creates a row in `locations`, updates `venue_nominations` to `'active'`, and awards credits. No check that the caller is an admin or the nomination has reached the required vouch threshold.

**Exploitation scenario:**
Any user can activate any venue nomination, bypassing the 3-vouch requirement:
```js
supabase.rpc('server_activate_venue', {
  p_nomination_id: 'nomination-uuid',
  p_user_id: 'my-uuid'
})
```

**Fix:**
Add internal validation:
1. Verify the nomination has `vouch_count >= 3` and `status = 'verified'`
2. Replace `p_user_id` with `auth.uid()` for credit attribution
3. Or restrict grant to `service_role`

---

## HIGH-4: `notify_rsvp_followers_and_blockers()` Accepts Arbitrary User ID

**Severity:** HIGH
**Location:** `supabase/migrations/20260315_member_follows_and_blocks.sql`

Function signature: `notify_rsvp_followers_and_blockers(p_event_id uuid, p_rsvp_user_id uuid)` granted to `authenticated`.

**Exploitation scenario:**
An attacker can trigger follow/block notifications for any user's RSVP to any event, flooding followers' and blockers' notification feeds with false alerts. This leaks the existence of follow and block relationships (the attacker can infer who follows/blocks whom by observing side effects).

**Fix:**
Replace `p_rsvp_user_id` with `auth.uid()`. The function should only generate notifications for the caller's own RSVP action.

---

## MEDIUM-1: Admin Role Case Mismatch — `'Admin'` vs `'admin'`

**Severity:** MEDIUM
**Location:**
- `supabase/migrations/20260313_growth_system.sql` — `focus_credits` admin SELECT policy uses `user_type = 'Admin'` (capital A)
- `supabase/migrations/20260309053104_...sql` — Security lockdown uses `user_type = 'admin'` (lowercase)
- `supabase/functions/daily-health-check/index.ts` — Queries `profiles.role = 'admin'` (wrong column name entirely; column is `user_type`)

**Exploitation scenario:**
Not directly exploitable, but the inconsistency means:
1. The `focus_credits` admin policy never matches if profiles store `'admin'` (lowercase), so admins cannot see all credit transactions
2. The daily health check Edge Function fails silently when querying a non-existent column, meaning admin alerts never fire

**Fix:**
1. Standardize on `user_type = 'admin'` (lowercase) everywhere
2. Fix the daily-health-check Edge Function to use `user_type` column
3. Add a CHECK constraint: `CHECK (user_type IN ('member', 'admin', 'venue_partner'))`

---

## MEDIUM-2: `session_requests` SELECT Policy Exposes All Users' Preferences

**Severity:** MEDIUM
**Location:** `supabase/migrations/20260308130000_fix_session_requests_rls.sql`

Changed SELECT from `auth.uid() = user_id` to `USING (true)` for all authenticated users.

**Exploitation scenario:**
Any logged-in user can query `session_requests` and see every user's neighborhood, preferred time, and request history. This leaks:
- Where other users work
- When they prefer to work
- How often they request sessions

While some of this data feeds the demand clustering system (which needs cross-user visibility), the full table exposure is broader than necessary.

**Fix:**
Create a `SECURITY DEFINER` RPC for demand clustering that returns aggregate counts only (e.g., "5 requests for hsr-layout morning") without exposing individual user IDs. Then revert the SELECT policy to own-only.

---

## MEDIUM-3: `server_fulfill_redemption()` Accepts Client-Supplied User ID

**Severity:** MEDIUM
**Location:** `supabase/migrations/20260315_fc_economy.sql`

Function `server_fulfill_redemption(p_user_id uuid, p_action text, p_cost integer)` is `SECURITY DEFINER` and granted to `authenticated`.

**Exploitation scenario:**
An attacker can spend another user's focus credits on redemptions:
```js
supabase.rpc('server_fulfill_redemption', {
  p_user_id: 'victim-uuid',
  p_action: 'premium_feature',
  p_cost: 100
})
```

**Fix:**
Replace `p_user_id` with `auth.uid()` inside the function.

---

## MEDIUM-4: Client-Side Admin Gate Has No Server-Side Enforcement

**Severity:** MEDIUM
**Location:** `src/hooks/useAdminCheck.ts`

Admin pages are gated by a client-side React hook that checks `profile.user_type`, a hardcoded `ADMIN_EMAILS` array, and `app_settings`. The routing in `App.tsx` conditionally renders admin pages based on this hook.

**Exploitation scenario:**
An attacker can bypass client-side routing entirely by calling admin-targeted RPCs directly. The actual data protection comes from RLS policies on individual tables, which are mostly correct. However, any admin RPC that lacks its own internal auth check (see HIGH-1, HIGH-2) is fully exposed.

**Fix:**
This is defense-in-depth. The primary fix is securing every admin-only RPC with internal authorization checks (as recommended in the CRITICAL and HIGH findings above). The client-side gate is a UX convenience, not a security boundary.

---

## MEDIUM-5: Block Escalation Trigger Notifies Admins via Email Lookup in `app_settings`

**Severity:** MEDIUM
**Location:** `supabase/migrations/20260315_block_auto_escalation.sql`

The `check_block_escalation()` trigger identifies admins by matching `profiles.email` against emails stored in `app_settings` as a JSON array. This pattern has two issues:
1. `app_settings` UPDATE was historically open to all authenticated users (later patched in security lockdown, but the initial migration was permissive)
2. If someone gains write access to `app_settings`, they can add their email to the admin list and receive all block-escalation admin alerts

**Exploitation scenario:**
If CRITICAL-1 or similar allows writing to `app_settings`, an attacker could register as an admin notification recipient and see all block-related alerts (which expose who is being blocked and why).

**Fix:**
Use a dedicated `admin_users` table with proper RLS rather than a JSON array in a general settings table. Alternatively, check `profiles.user_type = 'admin'` directly.

---

## LOW-1: Cron Jobs Call Edge Functions Without Authentication Headers

**Severity:** LOW
**Location:** `supabase/migrations/20260315_notification_crons_and_admin_seed.sql`

Cron jobs invoke Edge Functions via `net.http_post()` without passing any `Authorization` header. The Edge Functions have `verify_jwt = false` to accommodate this.

**Exploitation scenario:**
Because JWT verification is disabled, these endpoints are callable by anyone who knows the function URL (which follows a predictable pattern: `https://<project-ref>.supabase.co/functions/v1/<function-name>`). See CRITICAL-4 and CRITICAL-5.

**Fix:**
Use a shared secret approach:
1. Store a `CRON_SECRET` in Supabase Vault or environment
2. Cron jobs pass it as `X-Cron-Secret` header
3. Edge Functions validate the secret before proceeding

---

## LOW-2: `prevent_system_column_changes()` Trigger Only Fires on UPDATE

**Severity:** LOW
**Location:** `supabase/migrations/20260309053104_...sql`

The trigger prevents users from modifying protected columns (`is_table_captain`, `events_attended`, `subscription_tier`, etc.) via direct UPDATE. However, a user's own profile INSERT (on signup) could theoretically set these columns to arbitrary values if the signup flow allows it.

**Exploitation scenario:**
If any code path inserts a profile row with `subscription_tier = 'max'` or `is_table_captain = true`, the trigger would not catch it since it only fires `BEFORE UPDATE`.

**Fix:**
Add a `BEFORE INSERT` trigger that enforces default values for protected columns, or ensure the profile creation path (typically handled by a Supabase auth trigger) sets these columns server-side.

---

## LOW-3: No Rate Limiting on RPC Calls

**Severity:** LOW
**Location:** All `GRANT EXECUTE ... TO authenticated` RPCs

**Exploitation scenario:**
An attacker can call any granted RPC at high frequency. Combined with CRITICAL-1, this enables rapid credit minting, mass notification spam, or denial-of-service via database load.

**Fix:**
Implement rate limiting at the API gateway level (Supabase does not natively rate-limit RPCs). Options:
1. Use a Supabase Edge Function as a proxy with rate limiting
2. Add a `last_action_at` check inside critical RPCs
3. Use pg_stat_statements monitoring to detect abuse patterns

---

## Summary Table

| # | Severity | Title | Root Cause |
|---|----------|-------|------------|
| C-1 | CRITICAL | RPCs accept `p_user_id` — credit minting for any user | No `auth.uid()` check in SECURITY DEFINER |
| C-2 | CRITICAL | Check in as any user | Same pattern — client-supplied user ID |
| C-3 | CRITICAL | Cancel any RSVP, trigger penalties on any event | Same pattern + system operation granted to users |
| C-4 | CRITICAL | `send-notification` has no auth | `verify_jwt = false`, no manual auth |
| C-5 | CRITICAL | `session-debrief` has no auth | Same — unauthenticated Edge Function |
| H-1 | HIGH | `award_badge/milestone` no authorization | SECURITY DEFINER without admin check |
| H-2 | HIGH | `promote_waitlist/update_reliability` no auth | Same pattern |
| H-3 | HIGH | Any user can activate venues | SECURITY DEFINER bypasses vouch threshold |
| H-4 | HIGH | Follow/block notification injection | Client-supplied user ID |
| M-1 | MEDIUM | Admin role case mismatch | `'Admin'` vs `'admin'` vs wrong column |
| M-2 | MEDIUM | Session requests expose all preferences | Over-permissive SELECT RLS |
| M-3 | MEDIUM | Spend another user's credits | Client-supplied user ID in redemption |
| M-4 | MEDIUM | Client-side admin gate only | No server-side route protection |
| M-5 | MEDIUM | Admin notification via mutable settings | `app_settings` as admin registry |
| L-1 | LOW | Cron calls Edge Functions without auth | `verify_jwt = false` for cron compatibility |
| L-2 | LOW | System column protection only on UPDATE | INSERT path unprotected |
| L-3 | LOW | No RPC rate limiting | No gateway-level throttling |

---

## Systemic Root Cause

**The dominant vulnerability pattern is a single architectural mistake repeated across 10+ RPCs:** SECURITY DEFINER functions accept `p_user_id` as a client-supplied parameter instead of using `auth.uid()` internally. This pattern exists because these RPCs were designed to also be callable by cron jobs and Edge Functions (which use the service_role and don't have an auth context).

**Recommended systemic fix:**
1. Split every dual-purpose RPC into two variants:
   - `user_<action>(...)` — uses `auth.uid()`, granted to `authenticated`
   - `server_<action>(p_user_id uuid, ...)` — granted to `service_role` only
2. Edge Functions and cron jobs use `server_*` variants via the service_role client
3. Client code uses `user_*` variants which enforce caller identity automatically

This one architectural change would resolve C-1, C-2, C-3, H-1, H-2, H-3, H-4, and M-3 simultaneously.

---

## What Passed Audit

For completeness, these areas were reviewed and found secure:

- **All tables have RLS enabled.** Confirmed across 70+ migration files — no table is missing `ENABLE ROW LEVEL SECURITY`.
- **Supabase client uses anon key only.** `src/integrations/supabase/client.ts` uses `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon key). No service_role key in client code.
- **No raw SQL construction in client code.** All queries use the Supabase JS SDK's query builder. No string interpolation into SQL.
- **PKCE auth flow.** Client uses `flowType: "pkce"` which is the most secure option for SPAs.
- **Smart Search Edge Function has excellent auth.** `supabase/functions/smart-search/index.ts` validates JWT, extracts `user.id`, and rejects requests where `body.user_id !== user.id`. This should be the template for all Edge Functions.
- **Member blocks and follows RLS is correct.** Users can only see/create/delete their own blocks and follows. Admin read policy for blocks is properly scoped.
- **Profile RLS prevents cross-user writes.** Users can only UPDATE their own profile, and the `prevent_system_column_changes()` trigger protects privileged columns.
