# Audit 04 -- Growth Engine & User Journey Integrity

**Auditor:** Claude Opus 4.6
**Date:** 2026-03-15
**Scope:** Complete user journey from signup to retention, all growth loops, FC economy, referral system, permissionless venue pipeline, auto-session creation.

---

## Executive Summary

The DanaDone codebase has a well-designed growth engine architecture with sophisticated permissionless mechanics. However, the audit found **14 failure points** ranging from data-destroying bugs to silent growth loop breaks. The most critical: auto-sessions silently fail because they write RSVPs to a nonexistent table (`rsvps` instead of `event_rsvps`), and the referral reward functions are defined but never called -- meaning the entire referral-to-FC loop is broken. Multiple redemptions in the FC economy are phantom features (UI shows them, spending FC succeeds, but nothing tangible happens). Together, these break the three core growth loops: "attend session -> earn FC -> redeem value", "refer friend -> earn reward", and "demand signal -> auto-session -> more users".

---

## Failure Points (Ranked by Severity)

### F-01: Auto-Session RSVPs Write to Wrong Table (CRITICAL / DATA LOSS)

**Severity:** P0 -- Auto-sessions appear to create but attendees are never RSVPed
**Location:** `src/lib/autoSession.ts`, line 263
**Evidence:**

```typescript
await supabase.from("rsvps").upsert(rsvps, { onConflict: "event_id,user_id" });
```

Every other file in the codebase uses `"event_rsvps"` (confirmed across 40+ references). The table `rsvps` does not exist in the schema. This means:
1. When 3+ session requests cluster and auto-create an event, the RSVP insertion silently fails.
2. The created event has 0 attendees -- nobody is RSVPed.
3. Users receive a notification "Session created from your request!" but when they open the event detail, they are not listed as going.
4. The event shows 0 going / empty spots. Users think nobody else is attending and do not show up.

**Systemic Impact:** The entire auto-session growth loop is broken. The core permissionless mechanism ("demand clusters -> auto-sessions -> more users join") never completes. This directly blocks the "1000 bookings/day" target since auto-sessions are the scalable path.

**Fix:** Change `"rsvps"` to `"event_rsvps"` on line 263 of `autoSession.ts`.

---

### F-02: Auto-Session Format Strings Unrecognized by Session Phase System (CRITICAL)

**Severity:** P0 -- Auto-sessions have no phase structure
**Location:** `src/lib/autoSession.ts`, lines 66-69 vs `src/lib/sessionPhases.ts`, lines 77-83
**Evidence:**

autoSession.ts defines:
```typescript
const TIME_SLOT_MAP: Record<string, { start: string; format: string }> = {
  morning: { start: "09:00", format: "morning_2hr" },
  afternoon: { start: "14:00", format: "afternoon_2hr" },
  evening: { start: "18:00", format: "evening_2hr" },
};
```

sessionPhases.ts only recognizes:
```typescript
if (format === "structured_4hr") return STRUCTURED_4HR_PHASES;
if (format === "structured_2hr") return STRUCTURED_2HR_PHASES;
if (format === "focus_only_2hr") return FOCUS_ONLY_2HR_PHASES;
if (format === "focus_only_4hr") return FOCUS_ONLY_4HR_PHASES;
return [];
```

The format strings `morning_2hr`, `afternoon_2hr`, `evening_2hr` are not recognized. `getFormatPhases()` returns `[]`. `createSessionPhases()` is never called in `autoSession.ts` at all. When a user navigates to `/session/:eventId` for an auto-created event, the Session page checks `phases.length === 0` and renders "This session doesn't have a structured format" with a "Go back" button. The user sees a dead end.

**Systemic Impact:** Even if F-01 were fixed, auto-sessions would still be unusable because there is no session phase experience. The entire demand-driven session flow produces hollow events.

**Fix:** Either (a) use recognized format strings in autoSession.ts (e.g., `"structured_2hr"`) and call `createSessionPhases()` after event creation, or (b) add the `morning_2hr` etc. formats to sessionPhases.ts.

---

### F-03: Auto-Session Uses Non-Existent `events` Columns (CRITICAL)

**Severity:** P0 -- Event insertion may silently fail or produce malformed events
**Location:** `src/lib/autoSession.ts`, line 222-234
**Evidence:**

The `createAutoEvent()` function inserts with:
- `location_id`: The events table UI code references `venue_id` (e.g., `event.venue_id` in Session/index.tsx lines 568, 581, 593). The auto-session uses `location_id`.
- `max_attendees`: The events listing and detail pages reference `max_spots` (e.g., EventDetail.tsx line 389: `event.max_spots`). The auto-session uses `max_attendees`.
- `status: "upcoming"`: No other code references a `status` column on events. Events appear to be filtered by date comparison, not status.

If the DB schema uses `max_spots` and `venue_id`, the auto-session insert will either fail (column not found) or succeed but write to wrong columns. Post-session venue health checks, contribution prompts, and data collection all depend on `event.venue_id` -- which would be null for auto-sessions even if other issues were fixed.

**Systemic Impact:** Post-session venue health checks, FC contributions, and venue data collection all break for auto-created sessions because `venue_id` is never set.

**Fix:** Audit the actual DB schema columns and align `autoSession.ts` with the correct column names. Ensure `venue_id` is populated from the location lookup.

---

### F-04: Referral Reward Functions Never Called (HIGH)

**Severity:** P1 -- Referral loop produces zero FC for referrers
**Location:** `src/lib/referralEngine.ts` (functions defined), entire codebase (never invoked)
**Evidence:**

`trackReferralSignup()` -- defined at line 43, never imported or called anywhere.
`checkReferralMilestones()` -- defined at line 82, never imported or called anywhere.

The onboarding flow (Onboarding.tsx lines 157-181) handles referral attribution correctly: it reads `fc_ref` from localStorage, looks up the referrer profile, sets `referred_by` on the new user, and sends a notification. However, it never calls `trackReferralSignup()` which would create the `referral_rewards` row needed for the referral dashboard to show data.

The referral dashboard (`ReferralDashboard.tsx`) calls `getReferralStats()` which queries the `referral_rewards` table. Since `trackReferralSignup()` is never called, this table is always empty. The dashboard always shows: 0 Invited, 0 1st session, 0 3+ sessions, 0 FC earned.

Furthermore, `checkReferralMilestones()` is never called after a referred user completes their 1st or 3rd session. The referrer never receives the 50 FC (`referral_complete`) or 25 FC (`referral_milestone_3`) promised in `growthConfig.ts`.

**Systemic Impact:** The entire referral growth loop is broken. Referrers see zero progress, earn zero FC, and have no incentive to refer more people. The ReferralDashboard exists as a permanently empty shell. The product vision targets "2+ referrals per active member" but the mechanism to reward this behavior is unwired.

**Fix:**
1. Call `trackReferralSignup(referrer.id, user.id)` in Onboarding.tsx after setting `referred_by`.
2. Wire `checkReferralMilestones()` to fire after the 1st and 3rd session completion (likely in the session wrap-up or focus hours tracking flow).

---

### F-05: Three FC Redemptions Are Phantom Features (HIGH)

**Severity:** P1 -- Users spend FC and get nothing
**Location:** `supabase/migrations/20260315_fc_economy.sql`, lines 229-232; `src/pages/Credits.tsx`
**Evidence:**

The redemption RPC `server_fulfill_redemption` handles:
- `redeem_free_session` -- WORKS (creates a day_pass with access code)
- `redeem_gift_session` -- WORKS (creates a transferable day_pass)
- `redeem_priority_matching` -- WORKS (sets `priority_matching_until` flag)
- `redeem_session_boost` -- WORKS (reuses priority_matching_until column)
- `redeem_venue_upgrade` -- PHANTOM (FC spent, returns success, does nothing)
- `redeem_pick_seat` -- PHANTOM (FC spent, returns success, does nothing)
- `redeem_exclusive_session` -- PHANTOM (FC spent, returns success, does nothing)

The SQL ELSE branch at line 229-232 reads:
```sql
ELSE
  -- For other redemptions (venue_upgrade, pick_seat, exclusive_session)
  -- FC already spent; feature fulfillment wired as features are built
  RETURN jsonb_build_object('success', true);
```

The Credits page shows all 7 redemption options with costs (20-50 FC) and descriptions like "Choose your table and group before others". A user clicks "Confirm Redemption", their FC is deducted, they see "Redeemed: Venue Upgrade!" toast, but nothing actually happens. No notification, no flag, no tangible result.

**Systemic Impact:** Users who discover this lose trust in the entire FC economy. They spent hard-earned credits on a promise that was never delivered. This poisons the earning motivation -- why earn FC if redemptions are fake?

**Fix:** Either (a) remove the 3 phantom options from Credits.tsx until they are implemented, or (b) implement minimum viable versions (e.g., `pick_seat` could let you choose your table in the RSVP flow, `exclusive_session` could auto-RSVP to a premium event).

---

### F-06: EventDetail Neighborhood Display Uses Stale Hardcoded Map (MEDIUM)

**Severity:** P2 -- Neighborhood names display as raw slugs for non-hardcoded neighborhoods
**Location:** `src/pages/EventDetail.tsx`, lines 154-157
**Evidence:**

```typescript
const NEIGHBORHOODS: Record<string, string> = {
  hsr_layout: "HSR Layout", koramangala: "Koramangala", indiranagar: "Indiranagar",
  jayanagar: "Jayanagar", whitefield: "Whitefield", electronic_city: "Electronic City",
};
```

This uses underscore-separated keys (`hsr_layout`) while the normalized slug format uses hyphens (`hsr-layout`). The DB stores `hsr-layout`. The lookup `NEIGHBORHOODS[event.neighborhood]` will always fail for normalized neighborhoods, falling through to show the raw slug.

Furthermore, only 6 neighborhoods are hardcoded. The system supports 10 seed neighborhoods plus any user-entered ones. New neighborhoods show as raw slugs (e.g., `sarjapur-road` instead of "Sarjapur Road").

The correct utility `displayNeighborhood()` from `src/lib/neighborhoods.ts` already exists and handles all cases, but EventDetail does not use it.

**Systemic Impact:** Users see ugly raw slugs where they expect readable neighborhood names. This damages the premium feel of the product and makes sessions in user-generated neighborhoods look broken.

**Fix:** Replace the hardcoded `NEIGHBORHOODS` map with `displayNeighborhood()` from `src/lib/neighborhoods.ts`.

---

### F-07: No Outbound Notifications for Any Growth-Critical Event (HIGH)

**Severity:** P1 -- Users never learn about sessions, referrals, or milestones unless they open the app
**Location:** `src/lib/pushNotifications.ts`, `src/lib/notificationLogic.ts`, docs/TECH-DEBT.md (TD-003)
**Evidence:**

Push notification infrastructure exists:
- `pushNotifications.ts` can request permission and store tokens
- `notificationLogic.ts` has quiet-hours and channel routing logic
- `notification_prefs` system supports push/email/WhatsApp channels

But there is no Edge Function or backend service that actually sends push notifications or emails. The `send-notification` Edge Function referenced in notificationLogic.ts is pure logic -- no actual sending code exists in the codebase.

All "notifications" are in-app only -- rows in the `notifications` table rendered in the TopBar dropdown. This means:
- "Session created from your request!" -- user never sees it unless they open the app
- "Your group is waiting" (social pressure nudge) -- never delivered
- "Your regular slot is filling up" (loss aversion) -- never delivered
- Session reminders -- never delivered
- Referral success notifications -- only visible if referrer opens app

**Systemic Impact:** The product vision lists 14 behavioral loops that depend on timely notifications. Zero of them work. Without push/email, the platform relies entirely on users proactively opening the app. For a product in early traction, this is fatal -- users forget about it within days. TD-003 has been open since the initial CLAUDE.md.

**Fix:** Deploy a `send-notification` Edge Function that processes the notification queue and dispatches to push (Web Push API) and WhatsApp (whatsapp-web.js or Twilio). Start with session reminders (24h and 1h before) and "your group is waiting" as highest-ROI notifications.

---

### F-08: Onboarding Does Not Collect Neighborhood (HIGH)

**Severity:** P1 -- Users complete onboarding with no neighborhood, breaking growth loop
**Location:** `src/pages/Onboarding.tsx`, `src/components/onboarding/Step2WorkVibe.tsx`
**Evidence:**

The onboarding flow has 4 steps:
1. Step1Identity -- name, avatar
2. Step2WorkVibe -- work vibe, gender
3. Step3GiveGet -- looking_for, can_offer
4. Step4Done -- confirmation

The `neighborhood` field is in the data model (`OnboardingData` line 63) and initialized from the profile. But none of the 4 onboarding steps include a neighborhood input. The `calculateCompletion()` function (line 123-131) checks for `data.neighborhood` but it starts empty.

The `handleComplete()` function saves `neighborhood: data.neighborhood` to the profile, which is typically `""` (empty string). This means:
- `neighborhood_stats.member_count` does not increment for this user
- The user does not contribute to the neighborhood unlock threshold (10 members)
- Auto-session demand clustering by neighborhood cannot match them
- The Events page defaults to "all" instead of their neighborhood

**Systemic Impact:** The permissionless growth loop starts with "users sign up -> neighborhood member count increases -> 10 members unlocks nominations". Without neighborhood collection at onboarding, neighborhoods never reach the unlock threshold organically. The entire venue nomination pipeline is blocked.

**Fix:** Add neighborhood selection to Step2WorkVibe (natural fit with work preferences). Use the existing `NeighborhoodInput` component with autocomplete.

---

### F-09: Daily FC Earning Cap (50 FC) Too Low for Meaningful Session Reward (MEDIUM)

**Severity:** P2 -- Users hit the cap immediately after attending a session
**Location:** `src/lib/growthConfig.ts` line 153, `supabase/migrations/20260315_fc_economy.sql` line 19
**Evidence:**

The config sets `dailyEarnCap: 50`. A single session day looks like:
- Session complete: 10 FC
- Rate group: 5 FC
- Rate venue: 5 FC
- Write review: 15 FC
- Upload photo: 5 FC
- Report venue info: 10 FC
- **Total: 50 FC** (exactly at cap)

After doing the minimum post-session tasks, the user hits the daily cap. Any additional contributions (venue data collection, health checks, answering Quick Questions) earn 0 FC. The migration also adds a `v_total_daily_cap` of 75 FC, but this still leaves very little room.

The Credits page shows "Daily earning cap: 50 FC" which sets an explicit psychological ceiling. Users who see they have already earned 50 FC for the day will not bother with additional venue contributions.

**Systemic Impact:** The venue data collection and health check systems rely on post-session FC rewards. If users hit the cap from basic session activities, these advanced contribution behaviors never get reinforced. The "spatial data moat" vision requires heavy venue contribution, which is economically impossible under the current cap.

**Fix:** Either (a) raise the daily cap to 100-150 FC, or (b) exempt certain contribution types (venue data, health checks) from the daily cap since they have their own per-venue diminishing returns, or (c) make the "daily cap" only apply to repetitive actions, not first-time venue contributions.

---

### F-10: EventDetail RSVP Cancellation Bypasses `cancelRsvp()` Safety Cascade (MEDIUM)

**Severity:** P2 -- Late cancellations on EventDetail skip FC penalty and waitlist promotion
**Location:** `src/pages/EventDetail.tsx`, lines 248-252
**Evidence:**

When a user un-RSVPs from EventDetail, the code does:
```typescript
if (existing?.status === status) {
  await supabase.from("event_rsvps").delete()
    .eq("event_id", event.id).eq("user_id", user.id);
  // ...
  if (status === "going") promoteWaitlist(event.id).catch(() => {});
}
```

This directly deletes the RSVP and calls `promoteWaitlist()`. But it bypasses the `cancelRsvp()` function from `sessionSafety.ts` which is the proper cancellation path used by `useEvents.ts`. The safety cascade (lines 38-83 of sessionSafety.ts) atomically:
1. Deletes RSVP + decrements rsvp_count
2. Applies -10 FC penalty if < 2 hours before start
3. Tracks late_cancel in reliability system
4. Promotes waitlist atomically
5. Checks if session is at risk or should be cancelled

By bypassing this, EventDetail cancellations:
- Never apply FC penalty for late cancels
- Never update reliability scores
- Never trigger "session at risk" notifications to remaining attendees
- Do not atomically decrement rsvp_count (stale count)

**Systemic Impact:** Users who cancel late from EventDetail face no consequences, creating a free-rider problem. The reliability system shows artificially high scores. Sessions can silently drop below minimum attendees without warning remaining users.

**Fix:** Replace the direct delete with `cancelRsvp(event.id, user.id)` from `sessionSafety.ts`, mirroring the pattern used in `useEvents.ts`.

---

### F-11: No Session Request UI for Non-Admin Users (MEDIUM)

**Severity:** P2 -- Users cannot submit demand signals to trigger auto-sessions
**Location:** `src/pages/Events/SessionRequestSheet.tsx` (exists but wiring is unclear)
**Evidence:**

The auto-session system depends on `session_requests` being submitted by users. The `onNewSessionRequest()` function is the event-based trigger. But from the user's perspective:
- The Events page imports `SessionRequestSheet` but it is only shown contextually
- There is no prominent "Request a session" CTA for when no sessions are available in a user's neighborhood
- The empty state on Events does not guide users toward requesting a session

For the auto-session growth loop to work, users in neighborhoods without upcoming sessions must be able to easily submit a demand signal. Without this, the demand clustering never reaches the 3-request threshold.

**Systemic Impact:** The auto-session system is demand-starved. Even if F-01/F-02/F-03 were fixed, auto-sessions would not trigger because users have no obvious way to submit demand signals.

**Fix:** Add a prominent "No sessions in your area? Request one" card to the Events page empty/filtered-empty state. The card should collect neighborhood + preferred_time and call the existing session request insertion flow.

---

### F-12: Venue Health Checks Never Triggered Post-Session (MEDIUM)

**Severity:** P2 -- Health check system exists but is never invoked
**Location:** `src/pages/Session/index.tsx`, lines 566-576
**Evidence:**

The VenueHealthCheckPrompt component is rendered in the wrap-up phase:
```typescript
{user && event.venue_id && event.venue_name && (
  <VenueHealthCheckPrompt ... />
)}
```

This depends on `event.venue_id` being set. For admin-created events, `venue_id` may or may not be set (depends on how the event was created). For auto-created events, `venue_id` is never set (see F-03 -- auto-sessions use `location_id`).

Additionally, the `getVenuesDueForCheck()` function identifies stale venues but nothing calls it on a schedule. No Edge Function cron job runs this. The "assign random member to check a venue" flow (`getRandomCheckAssignment()`) is pure library code that is never invoked from any UI or background process.

**Systemic Impact:** The self-correcting venue quality system is completely inert. Bad venues never get deactivated. The promise of "3+ bad checks -> auto-deactivate" is architecture without execution. Over time, this means venue quality degrades unchecked.

**Fix:**
1. Ensure events created by admin and auto-session both populate `venue_id`.
2. Deploy an Edge Function cron (weekly) that calls `getVenuesDueForCheck()` and assigns health checks to active members via notification.

---

### F-13: Payment Verification Is Fully Manual With No SLA (LOW-MEDIUM)

**Severity:** P2-P3 -- Users pay via UPI, then wait indefinitely for manual admin verification
**Location:** `src/components/payment/PaymentModal.tsx`, `src/components/admin/PendingPayments.tsx`
**Evidence:**

The payment flow is:
1. User scans UPI QR -> pays externally -> enters UTR number
2. System stores payment as `pending_verification` in `payments` table
3. "Usually verified within 30 minutes" message displayed
4. Admin must manually go to the PendingPayments tab and verify each UTR

There is no automated UTR verification, no webhook from any payment provider, and no escalation if an admin does not verify within the SLA. A user who buys a Day Pass for an event starting in 1 hour could miss the session entirely because their payment is stuck in verification.

**Systemic Impact:** Payment friction blocks the revenue loop. In the GTM strategy, day passes are the primary revenue driver for spaces. Manual verification does not scale to "1000 bookings/day".

**Fix:** Short-term: add a scheduled check (every 5 minutes) that auto-approves payments where the UTR matches a Supabase-side UPI transaction lookup. Long-term: integrate Razorpay for real-time payment confirmation (aligns with TD-001).

---

### F-14: First-Session User Journey Has No Guided Path After Onboarding (LOW)

**Severity:** P3 -- New users complete onboarding but face a "what now?" dead end
**Location:** `src/pages/Onboarding.tsx` line 198, `src/pages/Home/index.tsx`
**Evidence:**

After onboarding completes, the user is navigated to `/events` (if they click "Find your first session") or `/home` (if they click "I'll explore first").

If they go to `/events`:
- The Events page defaults to filtering by their neighborhood (which may be empty per F-08)
- If no events exist in their area, they see an empty list with no guidance
- No "request a session" CTA, no "invite friends to unlock your area" prompt
- They may see events in other neighborhoods but not know to change the filter

If they go to `/home`:
- The Home page has rich features (Quick Questions, GrowthNudges, PrimaryActionCard)
- But PrimaryActionCard depends on upcoming RSVPed events -- which a brand-new user has none of
- Quick Questions requires taste graph setup

The product vision describes "the session is the gateway drug" but the path from onboarding to first session has too many potential dead ends, especially in neighborhoods without existing events.

**Systemic Impact:** Drop-off between onboarding completion and first RSVP is the highest-leverage churn point. Every user who completes onboarding but never attends a session is a permanently lost acquisition.

**Fix:** After onboarding, show a dedicated "Your first session" interstitial that: (a) shows the nearest upcoming session with social proof, (b) if none exist, prompts "Request a session in [neighborhood]" and "Invite 2 friends to unlock your area", (c) falls back to "Join the waitlist for [nearest neighborhood]".

---

## Growth Loop Completeness Assessment

### Loop 1: Signup -> Session -> Return
**Status: 60% complete.** Signup and onboarding work. Events listing works. RSVP works. Session experience works. But the gap between onboarding and first session is unguided, and without outbound notifications (F-07), there is nothing to bring users back.

### Loop 2: Demand Signal -> Auto-Session -> More Users
**Status: 0% complete.** Three compounding bugs (F-01, F-02, F-03) make auto-sessions completely non-functional. Even the demand signal submission path is unclear to users (F-11).

### Loop 3: User Joins -> Neighborhood Unlocks -> Venue Nominated -> Auto-Session
**Status: 40% complete.** Nomination and vouch system works. Activation works. But neighborhood never unlocks because onboarding does not collect neighborhood (F-08). Health checks never fire (F-12).

### Loop 4: Earn FC -> Accumulate -> Redeem -> Tangible Value
**Status: 50% complete.** Earning works well. Balance tracking works. 4 of 7 redemptions work (F-05). Daily cap is too restrictive (F-09). Referral FC never awarded (F-04).

### Loop 5: Refer Friend -> Both Rewarded -> Friend Refers
**Status: 20% complete.** Referral code generation works. Invite link works. Referee attribution works. But referrer never gets FC rewards (F-04), dashboard is always empty, milestones are never checked.

### Loop 6: Retention (Notifications, Streaks, Social)
**Status: 30% complete.** In-app notifications work. Streaks tracked. Props, echoes, community rituals all work. But no outbound notifications (F-07) means retention features only work for users who already open the app.

---

## Priority Fix Order

1. **F-01** (5 min fix): Change `"rsvps"` to `"event_rsvps"` in autoSession.ts
2. **F-02** (30 min fix): Fix auto-session format strings and add `createSessionPhases()` call
3. **F-03** (30 min fix): Align auto-session column names with actual schema
4. **F-04** (1 hr fix): Wire `trackReferralSignup()` in Onboarding and `checkReferralMilestones()` post-session
5. **F-08** (1 hr fix): Add neighborhood to onboarding Step 2
6. **F-05** (30 min fix): Remove phantom redemption options from Credits page
7. **F-10** (15 min fix): Use `cancelRsvp()` in EventDetail cancellation
8. **F-06** (10 min fix): Replace hardcoded NEIGHBORHOODS map with `displayNeighborhood()`
9. **F-07** (multi-day): Deploy push notification Edge Function
10. **F-11** (2 hr): Add session request CTA to Events empty state
11. **F-12** (4 hr): Wire health check cron and ensure venue_id propagation
12. **F-09** (15 min): Raise daily FC cap or exempt contribution actions
13. **F-13** (multi-day): Automate payment verification
14. **F-14** (4 hr): Build post-onboarding first-session interstitial
