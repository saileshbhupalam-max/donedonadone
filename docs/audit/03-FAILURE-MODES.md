# Audit 03 — Race Conditions, Edge Cases & Silent Failures

**Auditor:** Claude Opus 4.6
**Date:** 2026-03-15
**Scope:** All files in `src/lib/`, `src/hooks/`, `src/contexts/`, `supabase/functions/`, and critical SQL RPCs in `supabase/migrations/`.

---

## Summary

The codebase has a generally sound architecture: critical financial operations (FC award/spend) are server-side RPCs, auto-session creation uses an atomic DB function, and the RSVP toggle has both a double-click guard and optimistic-update rollback. However, the audit found **22 real issues** spanning TOCTOU race conditions, silent failures, missing atomicity, stale-state bugs, and network-failure hazards.

---

## Findings (ranked by severity)

### F-01 [CRITICAL] — `server_spend_credits` has a TOCTOU race: double-spend is possible

**Location:** `supabase/migrations/20260315_fc_economy.sql`, `server_spend_credits` function (lines 168-192 of `20260315_server_side_business_logic.sql`, overridden in `20260315_fc_economy.sql`)

**Scenario:** Two concurrent requests to spend credits (e.g., user opens two browser tabs and redeems a free session in both). Both calls `SELECT SUM(amount) INTO v_balance` at the same time, both see sufficient balance, and both proceed to INSERT a negative ledger entry. The user spends more credits than they have.

**Root cause:** The function reads the balance, then inserts, without holding an exclusive lock. PostgreSQL's default `READ COMMITTED` isolation allows this interleaving.

**Evidence:** No `FOR UPDATE`, no advisory lock, no explicit serialization.

**Fix:** Add `PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));` at the top of `server_spend_credits`, or use `SELECT ... FOR UPDATE` on a row that serializes per-user credit operations. Alternatively, use a CHECK constraint or a trigger that enforces `SUM(amount) >= 0` at the row level, though advisory locks are simpler.

---

### F-02 [CRITICAL] — `checkAndAwardStreak` has a client-side TOCTOU: double streak bonus

**Location:** `src/lib/focusCredits.ts` lines 224-265

**Scenario:** Two browser sessions (or a fast double-invocation) call `checkAndAwardStreak`. Both check for an existing `streak_bonus` in `focus_credits`, find none (the award hasn't been written yet), and both proceed to call `awardCredits`. The server-side RPC does have idempotency, but only when an `idempotency_key` is provided. In this code path, no idempotency key is passed (metadata is `{ sessions_this_month }`, not `{ idempotency_key }`).

**Fix:** Pass an idempotency key to `awardCredits`, e.g., `idempotency_key: \`streak_bonus_${userId}_${monthKey}\``.

---

### F-03 [CRITICAL] — `venueContributions.submitVenueContribution` has reversed operation order: credits awarded before contribution recorded

**Location:** `src/lib/venueContributions.ts` lines 186-209

**Scenario:** `awardCredits` is called first (line 187), then the contribution is inserted into `venue_contributions` (line 193). If the contribution INSERT fails (e.g., unique constraint, network error), the user has already been awarded FC with no corresponding contribution record. This creates phantom credits that are unaccounted for.

**Fix:** Insert the contribution first, then award credits. Or wrap both in a single server-side RPC.

---

### F-04 [CRITICAL] — `activateVenue` is called from the client AND from `check_nomination_activation` RPC — double activation possible

**Location:** `src/lib/venueNomination.ts` lines 252-303 (client-side `activateVenue`) and `supabase/migrations/20260315_server_side_business_logic.sql` line 265 (`check_nomination_activation` calls `server_activate_venue`)

**Scenario:** `vouchForVenue` at line 237 calls `check_nomination_activation` RPC, which internally calls `server_activate_venue`. The `server_activate_venue` RPC checks `IF v_nomination.location_id IS NOT NULL THEN RETURN` and is safe against double calls. However, the client-side `activateVenue` function at line 252 is a dead code path that does the same work WITHOUT atomicity: it reads, creates a location, then updates the nomination in separate non-transactional calls. If this function is ever invoked (e.g., by admin or a leftover code path), it can race with the RPC and create duplicate location entries.

**Fix:** Remove the client-side `activateVenue` function entirely. All activation must go through `server_activate_venue` RPC.

---

### F-05 [HIGH] — `joinWaitlist` has a TOCTOU race: duplicate or gapped positions

**Location:** `src/lib/antifragile.ts` lines 239-246

**Scenario:** Two users join the waitlist concurrently. Both `SELECT max(position)` and get the same value (e.g., 3). Both insert with `position = 4`. This either causes a unique constraint violation (if there is one on `(event_id, position)`) or creates duplicate positions (if there is not).

**Fix:** Replace with a server-side RPC that uses `INSERT INTO session_waitlist (event_id, user_id, position) SELECT p_event_id, p_user_id, COALESCE(MAX(position), 0) + 1 FROM session_waitlist WHERE event_id = p_event_id` in a single atomic statement.

---

### F-06 [HIGH] — RSVP toggle `rsvp_count` update is not atomic and races with concurrent RSVPs

**Location:** `src/hooks/useEvents.ts` lines 206-224

**Scenario:** When a user RSVPs, the code reads `event.rsvp_count` from local React state (line 220-221) and then does `UPDATE events SET rsvp_count = (event?.rsvp_count || 0) + 1`. If another user RSVPs between the read (which used stale state) and the write, the count is incorrect. Two simultaneous RSVPs to the same event can result in `rsvp_count` being incremented by only 1 instead of 2.

**Fix:** Use `UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = $1` (server-side atomic increment) instead of reading from client state and writing back. Or better, derive `rsvp_count` from `COUNT(*) FROM event_rsvps WHERE status = 'going'` via a computed column or trigger.

---

### F-07 [HIGH] — `checkDemandAndCreateSessions` client-side function has a race with the server-side RPC

**Location:** `src/lib/autoSession.ts` lines 282-345

**Scenario:** The `checkDemandAndCreateSessions` function runs client-side (used as a sweep) while `onNewSessionRequest` calls the server-side `server_check_demand_cluster` RPC. Both can be active simultaneously. The client function checks `events.demand_cluster_key` for existing sessions (line 290-297) but does not lock or coordinate with the RPC. Between checking and creating, the RPC might also create a session for the same cluster, resulting in a duplicate.

**Impact:** Duplicate auto-sessions for the same demand cluster.

**Fix:** Remove the client-side `checkDemandAndCreateSessions` entirely. The Edge Function `auto-sessions/index.ts` already handles sweeps server-side. All demand-cluster creation should go through the server.

---

### F-08 [HIGH] — `followUser` rate limit is client-side only: trivially bypassable

**Location:** `src/lib/memberFollows.ts` lines 36-56

**Scenario:** The `MAX_DAILY_CHANGES` rate limit is enforced via `localStorage`. A malicious user can clear localStorage, use an incognito window, or directly call the Supabase API to bypass it. The server has no corresponding rate limit.

**Impact:** A user can follow/unfollow hundreds of times per day, potentially for harassment or to game the system.

**Fix:** Add a server-side RPC for follow/unfollow that checks `SELECT COUNT(*) FROM member_follows WHERE follower_id = p_user_id AND created_at >= now() - interval '1 day'` and rejects if count exceeds the threshold.

---

### F-09 [HIGH] — `blockUser` cap check has a TOCTOU race: can exceed 25 blocks

**Location:** `src/lib/memberBlocks.ts` lines 40-73

**Scenario:** Two rapid `blockUser` calls: both `SELECT count` at 24, both pass the `< MAX_BLOCKS` check, both insert. Result: 26 blocks.

**Fix:** Add a unique partial index or trigger-based enforcement at the database level. Or use an RPC with `SELECT FOR UPDATE` / advisory lock.

---

### F-10 [HIGH] — Notification `markAsRead` optimistic update has no rollback on failure

**Location:** `src/hooks/useNotifications.ts` lines 65-68

**Scenario:** `setNotifications` optimistically marks the notification as read (line 66), then the Supabase UPDATE is fired. If the UPDATE fails (network error, RLS violation), the UI shows "read" but the server still has "unread". The user never sees the notification badge again, losing the notification.

**Fix:** Add error handling that reverts the optimistic state on failure, similar to the RSVP toggle's snapshot/rollback pattern in `useEvents.ts`.

---

### F-11 [HIGH] — `submitHealthCheck` duplicate check is client-side TOCTOU: can submit multiple health checks

**Location:** `src/lib/venueHealthCheck.ts` lines 56-69

**Scenario:** Two health check submissions arrive concurrently. Both `SELECT` for recent checks, find none, and both proceed to INSERT. User earns double FC and the venue deactivation threshold may be triggered prematurely.

**Fix:** Add a unique constraint on `(location_id, user_id, date_trunc('week', checked_at))` or use a server-side RPC with a `NOT EXISTS` check inside the INSERT.

---

### F-12 [HIGH] — `checkContributionMilestone` reads `focus_credits` with `action = 'contribution_milestone'` but `CreditAction` type does not include `'contribution_milestone'`

**Location:** `src/lib/venueContributions.ts` lines 294-332

**Scenario:** The function calls `server_award_credits` with `p_action: 'contribution_milestone'` (line 323). However, the `CreditAction` type union in `focusCredits.ts` (lines 23-51) does not include `'contribution_milestone'`. The code uses `as any` to bypass type safety. If the server-side function or future code validates against known actions, this will silently fail.

**Impact:** The milestone check at line 316 queries `focus_credits` with `.eq('action', 'contribution_milestone' as any)` -- the `as any` masks a potential type mismatch. If the server rejects unknown actions, milestones are never awarded but the function returns `false` (success = no milestone), hiding the error.

**Fix:** Add `'contribution_milestone'` to the `CreditAction` union type and ensure the server accepts it.

---

### F-13 [HIGH] — `checkReferralMilestones` awards credits then records the milestone record — reverse order causes double-award on retry

**Location:** `src/lib/referralEngine.ts` lines 82-129

**Scenario:** `awardCredits` succeeds (line 108), then the `referral_rewards.insert` at line 119 fails (e.g., network timeout). On retry, the dedup check at line 90-98 finds no milestone record (because the insert failed), so it awards again. Double credit payout.

**Fix:** Wrap both operations in a single server-side RPC that atomically checks, awards, and records the milestone.

---

### F-14 [MEDIUM] — `venueNomination.nominateVenue` delete-then-insert is not atomic: orphan FC possible

**Location:** `src/lib/venueNomination.ts` lines 127-162

**Scenario:** For re-nomination of deactivated venues, the code deletes the old nomination (line 127), then inserts a new one (line 131). If the DELETE succeeds but the INSERT fails, the old nomination is gone with no replacement. The user also already received FC for the original nomination.

**Fix:** Use a server-side RPC that performs both operations in a single transaction, or use `UPDATE` to reactivate instead of delete-then-insert.

---

### F-15 [MEDIUM] — `useEvents.toggleRsvp` captures stale `events` array in closure

**Location:** `src/hooks/useEvents.ts` line 234

**Scenario:** `toggleRsvp` is a `useCallback` that depends on `events` (line 234). When it reads `events.find(e => e.id === eventId)` at lines 206 and 220, it uses the `events` array from the closure's capture time. If a concurrent `fetchEvents` updated the state between the callback's creation and its execution, the data (e.g., `rsvp_count`) is stale. This leads to incorrect `rsvp_count` calculations in the `UPDATE events` call.

**Fix:** Either read fresh state from the server (use Supabase atomic increment as noted in F-06), or use `setEvents` callback form to access the latest state during the optimistic update.

---

### F-16 [MEDIUM] — Edge Function `auto-sessions` proximity notifications are fire-and-forget with no error aggregation

**Location:** `supabase/functions/auto-sessions/index.ts` lines 185-197

**Scenario:** The loop at line 185 sends push notifications via `supabase.functions.invoke("send-notification")` inside an `await` with `.catch(() => {})`. If the send-notification function is down or slow, each notification blocks the loop sequentially, and failures are silently swallowed. With large clusters, this can cause the Edge Function to timeout.

**Fix:** Use `Promise.allSettled` to send notifications in parallel, and log any failures to `notification_log` for debugging. Add a timeout guard for the entire proximity section.

---

### F-17 [MEDIUM] — `server_spend_credits` allows spending against expired bonus credits

**Location:** `supabase/migrations/20260315_fc_economy.sql`, `server_spend_credits` function

**Scenario:** The balance check correctly excludes expired credits (`WHERE expires_at IS NULL OR expires_at > now()`). However, the deduction INSERT does NOT target specific expired credit entries. The ledger is append-only, so negative entries reduce the total balance. But if a user earns 100 FC (50 permanent + 50 bonus), spends 80 FC, then the bonus expires, their balance becomes `50 + 50(expired) - 80 = 20` from permanent credits. However, `getBalance()` in the client recalculates excluding expired, yielding `50 - 80 = -30`. The client would show a negative balance that the user cannot fix.

**Fix:** The `getBalance()` client function should match the server logic: `SUM(amount) WHERE (expires_at IS NULL OR expires_at > now())`. Currently it does (line 96-98 of `focusCredits.ts`), but the negative entry has `expires_at = NULL` so it always counts. This is actually correct -- the real issue is more subtle: if all positive credits expire, the balance goes permanently negative with no recovery path. Add a floor of 0 in `getBalance`.

---

### F-18 [MEDIUM] — `daily-health-check` Edge Function queries admin users with `role = 'admin'` but profiles table uses `user_type` column

**Location:** `supabase/functions/daily-health-check/index.ts` line 139

**Scenario:** The function queries `.eq("role", "admin")` but the profiles table likely uses `user_type` as the column name (based on CLAUDE.md mentioning "3 user types: Coworker, Venue Partner, Admin" and the AuthContext reading `profile.user_type`). If the column name is wrong, no admins are found, and health alerts are never delivered -- silently.

**Fix:** Verify the column name. It should be `.eq("user_type", "admin")`.

---

### F-19 [MEDIUM] — `send-session-reminders` Edge Function has no deduplication: cron re-runs send duplicate reminders

**Location:** `supabase/functions/send-session-reminders/index.ts`

**Scenario:** If the cron fires twice (e.g., pg_cron retry, manual trigger, overlap), all reminders are sent again. There is no check against `notification_log` to see if reminders were already sent for tomorrow's events.

**Fix:** Before sending each reminder, check `notification_log` for an existing entry with `category = 'session_reminder'` and `user_id` + `event_id` combination for today.

---

### F-20 [MEDIUM] — `growth.checkReEngagement` writes `last_active_at` unconditionally, defeating inactivity detection

**Location:** `src/lib/growth.ts` line 263

**Scenario:** The function checks how long a user has been inactive (line 259-260), then immediately updates `last_active_at` to now (line 263). This means the first time the function runs after inactivity, it correctly identifies the user as inactive and sends a re-engagement notification. But the next run (tomorrow, after the localStorage throttle resets) sees `last_active_at` as yesterday (when this function ran), so `daysSinceActive` is 1, and no notification is sent. The user appears "active" even though they are not actually using the app -- the re-engagement check itself is marking them active.

**Fix:** Only update `last_active_at` when the user performs a real action (RSVP, session completion, page visit), not when the re-engagement checker runs. Move this update to a separate "heartbeat" function called from actual user interactions.

---

### F-21 [MEDIUM] — `useSubscription` loads four queries in parallel but does not gate on all succeeding

**Location:** `src/hooks/useSubscription.tsx` lines 89-99

**Scenario:** The four parallel queries (`get_effective_tier`, `subscription_tiers`, `tier_features`, `tier_limits`) all proceed independently. If `get_effective_tier` fails but the others succeed, the user gets `tier = "free"` (default) even if they are actually Pro. The `captureSupabaseError` calls log the error, but `setLoading(false)` is still called, so the UI renders with incorrect tier data. No user-visible error is shown.

**Impact:** A Pro user could lose access to paid features during a transient Supabase error, with no indication that anything is wrong.

**Fix:** If `get_effective_tier` fails, either retry or show an error state instead of silently defaulting to free tier.

---

### F-22 [LOW] — `useFocusCredits` has duplicate fetch logic in `refresh` and `useEffect`

**Location:** `src/hooks/useFocusCredits.ts` lines 11-29

**Scenario:** Both the `refresh` callback (line 11-17) and the `useEffect` (line 22-29) call `getBalance` and `getTodayEarnings`. On mount, both fire: `useEffect` fires immediately, and if any parent component calls `refresh`, it fires again. This is a minor double-fetch, not a bug, but the `refresh` callback does not set `loading = true` before fetching, so the UI may flash stale data during refresh.

**Fix:** Remove the inline fetch logic from `useEffect` and delegate to `refresh()` directly. Add `setLoading(true)` at the start of `refresh`.

---

## Network Failure Analysis

### What happens when the network drops mid-operation?

| Operation | Current behavior | Risk |
|---|---|---|
| RSVP toggle | Optimistic update reverts on error (good) | Stale `rsvp_count` can persist server-side if only the count UPDATE fails but the RSVP insert succeeds |
| FC award/spend | RPC returns error, client returns `{ success: false }` | Callers mostly log errors but some (e.g., `submitVenueContribution`) still record the contribution even if credits failed |
| Venue nomination | Multi-step (insert nomination, then award credits) | Nomination succeeds but credit award may silently fail -- user gets no FC but nomination is recorded |
| Health check | Insert + award + evaluate in sequence | Partial completion: check recorded but evaluation skipped; or check recorded but FC not awarded |
| Waitlist join | Single insert, no rollback | If insert fails after position read, position gap is left; no user feedback |
| Notification mark-as-read | Optimistic, no rollback | Notification appears read but server still has unread |

### What happens when Supabase is slow/down?

1. **Auth context**: Loading spinner persists. Safety timeout at 10 seconds prevents infinite spinner (good).
2. **Events list**: Falls back to IndexedDB cache (good). Stale cache could show cancelled events as active.
3. **Subscription tier**: Defaults to "free" silently (F-21). Pro users lose features.
4. **Notifications**: Fetch fails silently, shows empty list. No offline fallback.
5. **FC balance**: Returns 0 on error (line 93 of `focusCredits.ts`). User sees zero balance instead of an error.
6. **Personality config**: Falls back to hardcoded defaults (good).

---

## Top 5 Fixes by Impact

1. **F-01**: Add advisory lock to `server_spend_credits` -- prevents real money loss via double-spend
2. **F-06 + F-15**: Replace client-side `rsvp_count` read-modify-write with server-side atomic increment
3. **F-07 + F-04**: Remove dead client-side `checkDemandAndCreateSessions` and `activateVenue` functions
4. **F-05**: Move `joinWaitlist` to a server-side RPC with atomic position assignment
5. **F-13**: Combine referral milestone award + record into a single atomic RPC
