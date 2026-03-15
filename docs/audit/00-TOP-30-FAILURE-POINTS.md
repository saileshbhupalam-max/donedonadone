# Top 30 Failure Points — Cross-Audit Synthesis

> Synthesized from 6 parallel audits on 2026-03-15.
> Sources: 01-DATA-INTEGRITY, 02-BUSINESS-LOGIC, 03-FAILURE-MODES, 04-GROWTH-ENGINE, 05-SECURITY, 06-UX-FRONTEND
> Total issues found: ~110. This document ranks the top 30 by blast radius.

---

## Tier 1: CRITICAL — System is broken or exploitable NOW

### 1. RPCs accept client-supplied `p_user_id` — anyone can mint/drain FC, impersonate others
**Source:** 05-SECURITY CRITICAL-1, CRITICAL-2 | **Blast radius:** ALL subsystems
`server_award_credits`, `server_spend_credits`, `checkin_with_location`, `checkin_with_pin` are SECURITY DEFINER + granted to `authenticated` but accept `p_user_id` as a parameter. Any logged-in user can call `supabase.rpc('server_award_credits', { p_user_id: 'victim', ... })` from the browser console to mint credits for anyone, drain anyone's balance, or check in as someone else.
**Fix:** Replace `p_user_id` parameter with `auth.uid()` inside the function body for all user-facing RPCs. Keep `p_user_id` only on RPCs granted exclusively to `service_role`.

### 2. `notifications` table missing `data` column — 17+ SQL functions crash on INSERT
**Source:** 01-DATA-INTEGRITY F-02 | **Blast radius:** Cancellation cascade, no-show penalties, auto-sessions, FC redemptions, follow/block alerts
The table has no `data` column, but every RPC from the Fix 0.1-0.3 wave inserts `(user_id, type, title, body, data, read)`. All of these RPCs silently fail.
**Fix:** `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;`

### 3. `autoSession.ts` writes RSVPs to non-existent table `"rsvps"` instead of `"event_rsvps"`
**Source:** 01-DATA-INTEGRITY F-03, 04-GROWTH-ENGINE F-01 | **Blast radius:** Entire auto-session growth loop
Client-side auto-session code creates the event but the RSVP upsert silently fails. Users get notified but are never actually RSVPed. Auto-sessions always show 0 attendees.
**Fix:** Change `"rsvps"` to `"event_rsvps"` in `src/lib/autoSession.ts:263`.

### 4. Auto-session formats (`morning_2hr`, etc.) unrecognized by session phase system
**Source:** 02-BUSINESS-LOGIC F-BL-01, 04-GROWTH-ENGINE F-02 | **Blast radius:** Every auto-created session
`autoSession.ts` creates events with `morning_2hr`/`afternoon_2hr`/`evening_2hr` but `sessionPhases.ts` only knows `structured_4hr`, `structured_2hr`, `focus_only_2hr`, `focus_only_4hr`, `casual`. Auto-sessions have no phases, no timer, no captain nudges.
**Fix:** Map auto-session formats to recognized formats (e.g., `morning_2hr` -> `structured_2hr`).

### 5. `server_spend_credits` has no row-level locking — double-spend possible
**Source:** 03-FAILURE-MODES F-01 | **Blast radius:** FC economy integrity
Two concurrent spend requests both read sufficient balance and both succeed. User ends up with negative balance.
**Fix:** Add `PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));` at top of `server_spend_credits`.

### 6. `server_activate_venue` inserts into `locations` with non-existent columns
**Source:** 01-DATA-INTEGRITY F-04 | **Blast radius:** Venue activation pipeline
Inserts `address`, `wifi_available`, `google_maps_url` which don't exist on `locations`. Every server-side venue activation crashes.
**Fix:** Remove non-existent columns from the INSERT, or add them to the locations table.

### 7. `check_block_escalation()` trigger uses wrong column names — safety system non-functional
**Source:** 01-DATA-INTEGRITY F-01 | **Blast radius:** Community safety
Uses `flagged_user_id` (should be `flagged_user`), `details` (should be `notes`), and omits required `session_id`. The auto-escalation trigger always crashes.
**Fix:** Fix column names and make `session_id` nullable for system-generated flags.

---

## Tier 2: HIGH — Broken growth loops, exploitable gaps, data corruption risks

### 8. Referral engine functions defined but never called
**Source:** 04-GROWTH-ENGINE F-04 | **Blast radius:** Referral growth loop
`trackReferralSignup()` and `checkReferralMilestones()` in `referralEngine.ts` exist but are never invoked. Referral dashboard is permanently empty. Referrers earn 0 FC.
**Fix:** Call `trackReferralSignup()` after successful signup when `fc_ref` localStorage key exists.

### 9. Client-side `activateVenue()` can race with server RPC — duplicate locations
**Source:** 03-FAILURE-MODES F-04 | **Blast radius:** Venue data integrity
Dead client-side function does the same work as `server_activate_venue` RPC without atomicity. If ever called, creates duplicate location entries.
**Fix:** Delete `activateVenue()` from `venueNomination.ts`. All activation goes through the RPC.

### 10. `checkAndAwardStreak` has no idempotency key — double streak bonus
**Source:** 03-FAILURE-MODES F-02 | **Blast radius:** FC inflation
Two simultaneous calls both see no existing streak_bonus and both award 25 FC.
**Fix:** Pass idempotency key: `streak_bonus_${userId}_${year}-${month}`.

### 11. FC earning vastly outpaces spending — economy inflation
**Source:** 02-BUSINESS-LOGIC F-BL-04 | **Blast radius:** FC economy credibility
50 FC/day earning cap, but meaningful sinks top out at ~200 FC/month. After 2 months users accumulate 3000+ FC with nothing to spend on. The economy feels fake.
**Fix:** Add more sinks, reduce earning rate, or add expiry to non-bonus credits.

### 12. Three FC redemptions are phantom features (spend FC, get nothing)
**Source:** 04-GROWTH-ENGINE F-05 | **Blast radius:** User trust
`redeem_venue_upgrade`, `redeem_pick_seat`, `redeem_exclusive_session` deduct FC but `server_fulfill_redemption` just returns `{ success: true }` with no tangible result.
**Fix:** Either wire fulfillment or remove from the UI until they're real.

### 13. Neighborhood threshold hardcoded in `venueNomination.ts` instead of reading growthConfig
**Source:** 02-BUSINESS-LOGIC F-BL-02 | **Blast radius:** Runtime configurability
`const THRESHOLD = 10` bypasses the configurable `growthConfig.neighborhoodLaunchThreshold`.
**Fix:** Import and use `getGrowthConfig().neighborhoodLaunchThreshold`.

### 14. `reliability_status` and `no_show_count` accepted by matching but never used
**Source:** 02-BUSINESS-LOGIC F-BL-03 | **Blast radius:** Session quality
`createSmartGroups()` accepts these fields but ignores them. Unreliable members get equal treatment and can become captain.
**Fix:** Add reliability filtering: deprioritize unreliable members for captain, prefer reliable members in groups.

### 15. `venueContributions.submitVenueContribution` awards credits before recording contribution
**Source:** 03-FAILURE-MODES F-03 | **Blast radius:** FC integrity
If the contribution INSERT fails after `awardCredits` succeeds, phantom credits exist with no matching record.
**Fix:** Insert contribution first, then award credits. Or wrap in a single RPC.

### 16. Unauthenticated Edge Functions — `send-notification`, `session-debrief` have no auth check
**Source:** 05-SECURITY CRITICAL-3 | **Blast radius:** Spam, resource abuse
Anyone who knows the function URL can call these without authentication.
**Fix:** Add `Authorization` header check or verify Supabase JWT in the function body.

### 17. Admin route renders all tab components before redirect fires
**Source:** 06-UX-FRONTEND P1-04 | **Blast radius:** Information leak
Non-admin users see admin UI skeleton and admin components mount + fire queries before the useEffect redirect.
**Fix:** Gate admin render behind `if (!isAdmin) return null` before JSX, not in a useEffect.

---

## Tier 3: MEDIUM — Correctness issues, UX gaps, operational risks

### 18. `day_passes.payment_id` is UUID but FC redemption inserts text strings
**Source:** 01-DATA-INTEGRITY F-09 | **Blast radius:** FC redemption
`server_fulfill_redemption` inserts `'fc_redeemed'` and `'fc_gift'` into a UUID column.
**Fix:** Change `payment_id` to TEXT, or use a separate column for redemption source.

### 19. Seed data uses inconsistent neighborhood formats
**Source:** 01-DATA-INTEGRITY F-06 | **Blast radius:** Demand clustering
`hsr_layout` vs `hsr-layout` vs `HSR Layout` in seed data. Requests may never cluster if formats don't match.
**Fix:** Normalize all seed data through `normalizeNeighborhood()`.

### 20. Re-engagement logic updates `last_active_at` before evaluating thresholds
**Source:** 02-BUSINESS-LOGIC F-BL-11, 03-FAILURE-MODES F-20 | **Blast radius:** Retention notifications
The function updates the timestamp to "now" then checks day-since-active thresholds, so the 7/10/14-day notifications can only fire once.
**Fix:** Read `last_active_at` before updating it.

### 21. `joinWaitlist` has TOCTOU on position assignment
**Source:** 03-FAILURE-MODES F-05 | **Blast radius:** Waitlist ordering
Two concurrent joins can read the same max position and both get the same slot.
**Fix:** Use a server-side RPC with `SELECT MAX(position) ... FOR UPDATE`.

### 22. Follow rate limit is localStorage-only — trivially bypassable
**Source:** 03-FAILURE-MODES F-08 | **Blast radius:** Harassment vector
A user can follow/unfollow someone infinitely from incognito or by clearing localStorage.
**Fix:** Add server-side rate limiting in the follow RPC.

### 23. ErrorBoundary shows old brand "FocusClub" instead of "DanaDone"
**Source:** 06-UX-FRONTEND P0-01 | **Blast radius:** Brand trust at worst moment
The crash screen shows the old name. Users who hit a fatal error see a different brand.
**Fix:** Update `ErrorBoundary.tsx:38-39` to DanaDone branding.

### 24. OfflineBanner overlaps TopBar — navigation inaccessible offline
**Source:** 06-UX-FRONTEND P0-03 | **Blast radius:** PWA usability
Both use `fixed top-0` with different z-indexes. TopBar is hidden behind the offline banner.
**Fix:** OfflineBanner should push TopBar down or be inside it.

### 25. Four progression systems run in parallel without cross-referencing
**Source:** 02-BUSINESS-LOGIC Gestalt-2 | **Blast radius:** User confusion
`ranks.ts`, `badges.ts`, `growth.ts`, `engagementScore.ts` all track progress independently. A user can be "Gold rank" but have 0 badges. No system references the others.
**Fix:** Consolidate into a single progression engine, or at minimum have them reference each other.

### 26. `rsvp_count` updated from stale React state, not atomically on server
**Source:** 03-FAILURE-MODES F-06 | **Blast radius:** Event capacity enforcement
Client reads count, increments locally, updates. With concurrent RSVPs, events can exceed max_attendees.
**Fix:** Use a server-side atomic increment RPC.

### 27. Dual suspension mechanisms (`suspended_until` vs `is_suspended`)
**Source:** 01-DATA-INTEGRITY F-07 | **Blast radius:** Moderation
Block-based suspension sets `is_suspended` but profile queries only check `suspended_until`. Blocked users remain active.
**Fix:** Unify to a single mechanism. Prefer `suspended_until` with a far-future date for indefinite suspensions.

### 28. 16+ eslint-disable for exhaustive-deps — stale closure risks
**Source:** 06-UX-FRONTEND P1-05 | **Blast radius:** Subtle bugs in critical pages
EventDetail, Session, Profile pages all suppress the exhaustive-deps rule. These are the most important pages.
**Fix:** Audit each suppression. Most can be fixed with proper deps or useCallback.

### 29. Onboarding does not collect neighborhood
**Source:** 04-GROWTH-ENGINE F-06 | **Blast radius:** Neighborhood unlock threshold
Users complete onboarding without setting neighborhood. The 10-member unlock threshold can't be met if profiles don't have neighborhoods.
**Fix:** Add neighborhood selection step to onboarding flow.

### 30. Delete account button shows toast "Contact support" — deceptive UX
**Source:** 06-UX-FRONTEND P2-10 | **Blast radius:** User trust + DPDP compliance
User goes through confirmation dialog, clicks delete, gets a toast saying to email support. No actual deletion.
**Fix:** Either implement real deletion or remove the button. The confirmation dialog is misleading.

---

## Gestalt Failures (Systemic)

**G-1: FC economy incentivizes venue data over session attendance.** Venue contributions earn more FC/day (50 cap) than sessions (10 FC/session). Users are rewarded for submitting venue reports, not for actually coworking.

**G-2: Matching engine and needs board are isolated islands.** `needsMatch.ts` scores compatibility but `createSmartGroups()` never calls it. The needs board can't influence who gets grouped together.

**G-3: The "demand -> auto-session -> attendance -> growth" loop is broken at 3 points simultaneously.** Wrong table name (#3), unrecognized formats (#4), and missing notification data column (#2) mean the entire automated growth engine is non-functional.

---

## Recommended Fix Order

| Priority | Items | Est. Time | Impact |
|----------|-------|-----------|--------|
| **NOW** | #2 (notifications data column), #3 (rsvps table name), #4 (session formats), #6 (activate_venue columns), #7 (block trigger) | 30 min | Unblocks ALL server-side RPCs |
| **Day 1** | #1 (auth.uid in RPCs), #5 (advisory lock), #16 (Edge Function auth) | 2-3 hours | Closes all security exploits |
| **Day 2** | #8 (referral wiring), #10 (streak idempotency), #12 (phantom redemptions), #15 (contribution order) | 2 hours | Fixes growth loops + FC integrity |
| **Week 1** | #9, #11, #13, #14, #17-#30 | 3-4 days | Correctness, UX, operational health |

---

*Individual audit reports with full evidence and code locations: `docs/audit/01-06`*
