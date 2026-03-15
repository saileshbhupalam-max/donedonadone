# Audit 02: Business Logic Coherence & System Synergy

> Auditor: Claude Opus 4.6 | Date: 2026-03-15
> Scope: All 42 files in `src/lib/` — business logic, matching, FC economy, growth engine, session management
> Method: Deep cross-file analysis of assumptions, data flows, hardcoded values, feedback loops, and subsystem interactions

---

## System Interaction Map

```
                    +-------------------+
                    |  GROWTH CONFIG    |  <-- Single source of truth (growthConfig.ts)
                    |  (thresholds,     |      BUT modules hardcode values anyway
                    |   FC amounts,     |
                    |   caps)           |
                    +--------+----------+
                             |
            +----------------+----------------+
            |                |                |
   +--------v------+  +-----v--------+  +----v-----------+
   | FC ECONOMY    |  | VENUE GROWTH |  | REFERRAL       |
   | focusCredits  |  | nomination   |  | referralEngine |
   | venueContrib  |  | healthCheck  |  | aiGrowthNudges |
   +--------+------+  | autoSession  |  +--------+-------+
            |          +------+-------+           |
            |                 |                   |
            |     +-----------v----------+        |
            +---->| SESSION SYSTEM       |<-------+
                  | sessionMatch         |
                  | sessionPhases        |
                  | antifragile (groups)  |
                  | sessionSafety        |
                  +----------+-----------+
                             |
                  +----------v-----------+
                  | MATCHING / SOCIAL    |
                  | matchUtils           |
                  | matchNudges          |
                  | mentorMatch          |
                  | smartIntros          |
                  | needsMatch           |
                  +----------+-----------+
                             |
                  +----------v-----------+
                  | PROGRESSION          |
                  | ranks.ts             |
                  | badges.ts            |
                  | growth.ts            |
                  | engagementScore.ts   |
                  +----------------------+
```

---

## Failure Points (Ranked by Severity)

### F-BL-01: Auto-Session Creates Phantom Session Formats
**Severity: CRITICAL** | **Subsystems: autoSession.ts <-> sessionPhases.ts**

The auto-session engine in `autoSession.ts:66-70` creates events with session_format values of `"morning_2hr"`, `"afternoon_2hr"`, and `"evening_2hr"`:

```typescript
const TIME_SLOT_MAP: Record<string, { start: string; format: string }> = {
  morning: { start: "09:00", format: "morning_2hr" },
  afternoon: { start: "14:00", format: "afternoon_2hr" },
  evening: { start: "18:00", format: "evening_2hr" },
};
```

But `sessionPhases.ts:77-83` only recognizes `structured_4hr`, `structured_2hr`, `focus_only_2hr`, `focus_only_4hr`, and `casual`:

```typescript
export function getFormatPhases(format: string): PhaseTemplate[] {
  if (format === "structured_4hr") return STRUCTURED_4HR_PHASES;
  if (format === "structured_2hr") return STRUCTURED_2HR_PHASES;
  // ... no "morning_2hr", "afternoon_2hr", "evening_2hr"
  return [];
}
```

Additionally, `sessionMatch.ts:71-76` maps work vibes to formats and has no knowledge of these time-slot formats. The `ranks.ts:106-111` `calculateSessionHours()` function also cannot derive focus hours from `morning_2hr`/`afternoon_2hr`/`evening_2hr` -- it falls through to the title-based parsing and ultimately returns a default of 2 hours.

**Impact:** Every auto-created session has no phases (empty array from `getFormatPhases()`), cannot be matched by vibe in `sessionMatch`, and gives incorrect focus hour credit. The entire auto-session pipeline produces structurally broken events.

**Fix:** Change `TIME_SLOT_MAP` to use valid format keys (`structured_2hr` or `focus_only_2hr`), or add these format strings to all downstream consumers.

---

### F-BL-02: Neighborhood Unlock Threshold Defined in Two Places with Different Source-of-Truth Patterns
**Severity: HIGH** | **Subsystems: venueNomination.ts <-> growthConfig.ts <-> aiGrowthNudges.ts**

The neighborhood launch threshold is defined:

1. **`growthConfig.ts:185`** -- `neighborhoodLaunchThreshold: 10` (the documented single source of truth)
2. **`venueNomination.ts:347`** -- `const THRESHOLD = 10;` (hardcoded local constant)
3. **`aiGrowthNudges.ts:243`** -- `const threshold = config.growth.neighborhoodLaunchThreshold;` (reads from config)

`venueNomination.ts` is the module that actually *gates* nominations -- the most critical consumer of this value -- yet it ignores growthConfig entirely and hardcodes its own `THRESHOLD = 10`. If an admin changes the threshold via the `app_settings` table (which `loadGrowthConfig()` supports), nominations will still use the old hardcoded value of 10.

**Impact:** Runtime A/B testing of the neighborhood threshold is silently broken. The UI (aiGrowthNudges) shows one threshold while the actual gate (venueNomination) enforces another.

**Fix:** `getNeighborhoodReadiness()` at `venueNomination.ts:347` must read from `getGrowthConfig().growth.neighborhoodLaunchThreshold` instead of its local constant.

---

### F-BL-03: Matching Engine Ignores Reliability -- Unreliable Members Get Equal Treatment
**Severity: HIGH** | **Subsystems: antifragile.ts <-> matchUtils.ts <-> matchNudges.ts <-> sessionMatch.ts**

`antifragile.ts:26-27` defines `no_show_count` and `reliability_status` on the `MatchAttendee` interface and uses them in `createSmartGroups()`. However, the actual group formation algorithm at `antifragile.ts:35-158` **never reads or considers** these fields. The fields are on the interface but unused in the sorting, distribution, or swap logic.

Furthermore:
- `matchUtils.ts` (`calculateMatch()`) has zero reliability awareness
- `matchNudges.ts` (`generateMatchNudges()`) never filters by reliability
- `sessionMatch.ts` (`sessionMatchScore()`) has no reliability factor
- `autoSession.ts` (`pickTableCaptain()`) picks captains by `events_attended` but does not check `reliability_status` or `no_show_count`

**Impact:** A member with 50% no-show rate can be selected as table captain, gets the same match score as a 100% reliable member, and appears in match nudges. This contradicts the FIX-ROADMAP.md 0.3 design which specifies "Poor reliability (< 70%) = lower priority in matching, not selected as captain."

**Fix:** Add reliability checks to (1) `pickTableCaptain()` to exclude members with reliability_status != "good", (2) `createSmartGroups()` to penalize groups with multiple unreliable members, (3) `calculateMatch()` to factor reliability into score.

---

### F-BL-04: FC Economy Faucet/Sink Imbalance -- Earning Vastly Outpaces Spending Opportunities
**Severity: HIGH** | **Subsystems: focusCredits.ts <-> growthConfig.ts <-> venueContributions.ts**

Analyzing the FC flows:

**Faucets (earning per action):**
- Session complete: 10 FC
- Rate group + venue: 10 FC
- Write review: 15 FC (with 2x first-mover bonus = 30 FC)
- Upload photo: 5 FC (2x = 10 FC)
- Venue info reports: 5-10 FC each, 7+ types
- Referral complete: 50 FC
- Streak bonus: 25 FC/month
- Great groupmate: 10 FC
- Add new venue: 30 FC (plus another 30 FC activation bonus)
- Comeback bonus: 15 FC
- Taste answers: 2 FC each (uncapped per growthConfig, only daily cap of 50 total)

**Daily cap:** 50 FC (`growthConfig.ts:153`)

**Sinks (spending):**
- Free session: 100 FC
- Priority matching: 30 FC
- Venue upgrade: 50 FC
- Pick seat: 20 FC
- Gift session: 100 FC
- Exclusive session: 40 FC
- Session boost: 15 FC (`FIX-ROADMAP.md` mentions this)

**Problem:** A diligent user earns 50 FC/day = 1500 FC/month. The only meaningful sink is free sessions at 100 FC each. But sessions require people to show up at venues -- you can accumulate FC far faster than you can redeem them. After 2 months, a user has 3000+ FC with nothing to spend on.

Additionally, `venueContributions.ts:147` applies a `FIRST_MOVER_BONUS = 2` multiplier, which can push a single `add_new_venue` contribution to 60 FC -- exceeding the daily cap of 50 in a single action. The daily cap is enforced server-side, but the first-mover logic doubles the amount *before* sending to the server, meaning the server either awards 50 (confusing the user who expected 60) or awards 60 (breaking the cap).

**Impact:** FC inflation makes the currency meaningless. Users accumulate thousands of FC with no outlet, destroying the scarcity that makes FC valuable.

**Fix:** (1) Add more meaningful sinks (the "buy a round" social sink from FIX-ROADMAP 2.1 is not implemented). (2) Resolve the first-mover bonus vs. daily cap interaction. (3) Consider FC decay or seasonal resets.

---

### F-BL-05: `contribution_milestone` Action Not in CreditAction Type -- Type Safety Bypass
**Severity: HIGH** | **Subsystems: venueContributions.ts <-> focusCredits.ts**

`venueContributions.ts:316-325` awards credits with action `'contribution_milestone'`:

```typescript
const { data: existing } = await supabase
  .from('focus_credits')
  .select('id')
  .eq('user_id', userId)
  .eq('action', 'contribution_milestone' as any)  // <-- forced type cast
  ...

await supabase.rpc('server_award_credits', {
  p_user_id: userId,
  p_action: 'contribution_milestone',  // not in CreditAction union type
  p_amount: 0,
  ...
```

The `CreditAction` type in `focusCredits.ts:23-51` does not include `'contribution_milestone'`. The code uses `as any` to bypass TypeScript's type checker. Similarly, `growth.ts:276` casts `'comeback_bonus' as any`.

**Impact:** The server RPC may reject or mishandle actions not in its own action enum. The `p_amount: 0` on the contribution_milestone call means the award itself does nothing -- the only "reward" is the `premium_days` in metadata, but nothing reads that metadata to actually grant premium days. The milestone feature is structurally incomplete.

**Fix:** (1) Add `contribution_milestone` and `comeback_bonus` to the `CreditAction` type union. (2) Wire `premium_days` metadata to actually grant a subscription tier boost (it currently goes nowhere).

---

### F-BL-06: Venue Nominator Gets Double FC Award (60 FC Total) Without Idempotency
**Severity: MEDIUM-HIGH** | **Subsystems: venueNomination.ts**

When a venue is nominated, the nominator gets 30 FC at `venueNomination.ts:154`. When the venue is later activated, the nominator gets *another* 30 FC at `venueNomination.ts:297`:

```typescript
// Line 154: Initial nomination award
const creditResult = await awardCredits(userId, "add_new_venue", 30, {
  venue_id: nomination.id,
});

// Line 297: Activation bonus award
await awardCredits(nomination.nominated_by, "add_new_venue", 30, {
  venue_id: location.id,       // different venue_id (location vs nomination)
  activation_bonus: true,
} as any);
```

Both use the same action `"add_new_venue"` with different `venue_id` values (one is the nomination ID, the other is the location ID). The idempotency key (if enforced server-side by action + venue_id) would see these as different operations and allow both. Combined with the 2x first-mover bonus from `venueContributions.ts`, a nominator could earn up to 120 FC (60 FC nomination + 60 FC activation if first-mover applies).

**Impact:** Venue nomination becomes the most rewarding FC action in the system (potentially 120 FC vs. 10 FC for completing a session), creating a perverse incentive to nominate venues rather than attend sessions.

**Fix:** Either (1) reduce the activation bonus or (2) use a single `add_new_venue` action for nomination and a separate `venue_activated` action for the activation bonus, with appropriate amounts.

---

### F-BL-07: Smart Group Formation Has No Awareness of Session Format
**Severity: MEDIUM-HIGH** | **Subsystems: antifragile.ts <-> sessionPhases.ts**

`createSmartGroups()` in `antifragile.ts:35` forms groups identically regardless of session format. It does not know whether the session is `structured_4hr` (with icebreakers and social breaks) or `focus_only_2hr` (silent, minimal interaction).

For focus-only sessions, the algorithm still optimizes for:
- Gender balance (irrelevant when there is no social interaction)
- Work vibe compatibility (irrelevant in silent mode)
- Serendipity swaps (counterproductive -- focus-only users chose silence)
- Captain distribution (captains have minimal role in focus-only)

For structured 4hr sessions with 30-minute networking breaks, the algorithm does not weight `looking_for`/`can_offer` complementarity highly enough relative to vibe matching, despite the session being designed for networking.

**Impact:** Focus-only sessions waste computation on irrelevant optimizations. Structured sessions under-optimize for the networking value that is the product's core differentiator.

**Fix:** Accept `session_format` as a parameter to `createSmartGroups()` and adjust weights: for focus-only, minimize group optimization (just balance size); for structured, maximize complementarity scoring.

---

### F-BL-08: Engagement Score Ignores Core Product Actions
**Severity: MEDIUM** | **Subsystems: engagementScore.ts <-> ranks.ts <-> growth.ts <-> badges.ts**

The engagement score in `engagementScore.ts:17-18` is computed from only three inputs:

```typescript
const rawScore = (input.sessionsLast30d * 15) + (input.connectionsLast30d * 10) + (input.streakDays * 5);
```

This ignores:
- Venue contributions (the spatial data moat described in PRODUCT-VISION.md)
- Props given/received (community warmth metric)
- Prompt answers (taste graph enrichment)
- Referrals (growth engine)
- FC earned/spent (economic activity)
- Health checks (venue quality)
- Needs board activity (B2B matching)

Meanwhile, `badges.ts`, `growth.ts`, and `ranks.ts` each have their own independent progression systems that track many of these signals. The engagement score -- the metric used for churn prediction -- is blind to most of what makes a member valuable.

**Impact:** Churn risk assessment is unreliable. A member who contributes 50 venue photos and answers every prompt but hasn't attended a session in 2 weeks shows as "high churn risk." A member who attends sessions but does nothing else shows as "low risk." The engagement score cannot distinguish between a valuable contributor and a warm body.

**Fix:** Expand `EngagementInput` to include contributions, props, prompts, and referrals. Weight them appropriately so diverse engagement is recognized.

---

### F-BL-09: The Growth Flywheel Has a Cold-Start Deadlock
**Severity: MEDIUM** | **Subsystems: venueNomination.ts <-> autoSession.ts <-> neighborhoods.ts**

The intended flywheel is:
1. Members join a neighborhood (10+ unlocks it)
2. Members nominate venues (requires unlocked neighborhood)
3. Venues get 3 vouches (vouchers must have attended 1+ session)
4. Auto-sessions trigger when 3+ requests cluster
5. Sessions create new members (via referral, word of mouth)

The deadlock: In step 3, vouchers must have `events_attended >= 1`. But in step 4, sessions require active venues. If no venue is active yet (because none have 3 vouches), there are no sessions for vouchers to attend.

The bootstrap mode (admin-seeded sessions, mentioned in FIX-ROADMAP 0.2) partially addresses this, but the code in `venueNomination.ts:88-95` still gates nominations on `readiness.isUnlocked`, and `vouchForVenue()` at line 182 still requires `events_attended >= 1`. The partner application exemption (`venueNomination.ts:188-195`) is the only escape valve, and it requires an approved partner -- which itself requires admin action.

**Impact:** New neighborhoods without admin intervention are permanently stuck. The "permissionless growth" promise from CLAUDE.md is false in practice -- every new neighborhood requires admin bootstrapping.

**Fix:** (1) Allow the first 3 vouches in a bootstrapping neighborhood to come from members with `events_attended >= 0` (remove the session attendance requirement during bootstrap). (2) Or count attendance at sessions in ANY neighborhood, not just the nomination's neighborhood.

---

### F-BL-10: Match Scoring Dimensions Are Inconsistent Across Modules
**Severity: MEDIUM** | **Subsystems: matchUtils.ts <-> mentorMatch.ts <-> needsMatch.ts <-> matchTemplates.ts <-> smartIntros.ts**

Five separate modules compute compatibility scores with different dimensions, weights, and scales:

| Module | Scale | Dimensions | Weights |
|--------|-------|-----------|---------|
| `matchUtils.ts` | 0-100 | work_vibe(20), neighborhood(15), looking/offers(15+10), interests(5ea), noise(5), comm(5) | Static |
| `mentorMatch.ts` | 0-100 | skills(30), industry(20), experience_gap(20), values(15), neighborhood(10), comm(5) | Static |
| `needsMatch.ts` | 0-100 | category_match(40), keywords(30), neighborhood(15), engagement(15) | Static |
| `matchTemplates.ts` | Fixed 65 | Hardcoded score of 65 for ALL template matches (`matchTemplates.ts:113`) | None |
| `smartIntros.ts` | Uses matchUtils | Delegates to calculateMatch but then sorts by its score | Inherited |

The 65 hardcoded score in `matchTemplates.ts:113` means every template-based match explanation carries the same weight regardless of actual compatibility. This is used by the Edge Function to generate match explanations shown to users.

Additionally, `matchUtils.ts` and `mentorMatch.ts` can produce unbounded raw scores (the `15 * N` for looking_for matches in `matchUtils.ts:49` could produce 15 * 20 = 300 before capping to 100), meaning a user with many looking_for tags gets a 100 score with almost anyone who has any matching can_offer.

**Impact:** Users see inconsistent match scores across different features. The match explanation system shows "65% match" for everyone. Profiles with many looking_for/can_offer tags are over-scored.

**Fix:** (1) Extract a shared scoring core that all modules call. (2) Replace the hardcoded 65 in matchTemplates with actual computed scores. (3) Normalize the looking_for/can_offer contribution to prevent saturation.

---

### F-BL-11: Re-engagement Updates `last_active_at` Unconditionally -- Defeats Its Own Purpose
**Severity: MEDIUM** | **Subsystems: growth.ts**

`growth.ts:263` updates `last_active_at` every time `checkReEngagement()` runs:

```typescript
// Line 263
await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId);
```

This happens BEFORE the day-since-active check at line 265 completes its side effects. Since `checkReEngagement()` is called when the user opens the app, and it immediately sets `last_active_at` to now, the next time the function runs, `daysSinceActive` will be 0 or 1 -- meaning the user will NEVER trigger the 7/10/14-day re-engagement flows again after their first return.

The comeback FC bonus at line 269 runs correctly (it checks `daysSinceActive >= 7` before the update completes, due to `await` ordering), but all subsequent visits will show `daysSinceActive < 6` because `last_active_at` was updated.

**Impact:** The 7-day, 10-day, and 14-day re-engagement notifications can only fire once ever, on the user's first return. The system was designed for graduated escalation but only delivers a single nudge.

**Fix:** Move the `last_active_at` update to the end of the function, after all notifications have been evaluated and sent.

---

### F-BL-12: Streak Bonus Check Uses FC Ledger as Proxy for Session Count -- Fragile Assumption
**Severity: MEDIUM** | **Subsystems: focusCredits.ts**

`checkAndAwardStreak()` at `focusCredits.ts:244-251` counts sessions by querying the `focus_credits` table:

```typescript
const { data: monthSessions } = await supabase
  .from('focus_credits')
  .select('id')
  .eq('user_id', userId)
  .eq('action', 'session_complete')
  .gte('created_at', monthStartDate);
```

This assumes every completed session produces exactly one `session_complete` credit entry. But if the server-side award fails (network error, daily cap hit, idempotency rejection), the session happened without an FC entry. Conversely, if there is a bug that creates duplicate entries, the count inflates.

The `profiles.events_attended` column tracks the same information authoritatively. Using the FC ledger as a proxy for session count couples two subsystems that should be independent.

**Impact:** Users may not receive streak bonuses they earned (if FC award failed), or may receive them prematurely (if duplicates exist). The streak system's reliability is tethered to the FC system's reliability.

**Fix:** Query `profiles.events_attended` or `event_rsvps` with status `attended`/`going` + past date, instead of the FC ledger.

---

### F-BL-13: `getTodayEarnings()` Uses Client Timezone -- Server Uses IST
**Severity: MEDIUM** | **Subsystems: focusCredits.ts**

`focusCredits.ts:109-111` computes "today's start" using the client's local timezone:

```typescript
const d = new Date();
d.setHours(0, 0, 0, 0);
const todayStart = d.toISOString();
```

The FIX-ROADMAP 0.1 explicitly states: "All 'today' / 'this month' boundaries computed server-side using venue timezone." The server RPCs enforce IST (Asia/Kolkata). A user in a different timezone (e.g., UTC+0) viewing their "today's earnings" at 11pm local time would see earnings starting from their midnight, while the server cap resets at IST midnight (5.5 hours offset).

Similarly, `checkAndAwardStreak()` at line 226 computes `monthStartDate` using client timezone.

**Impact:** The daily cap display is inaccurate for users outside IST. Users may think they have room to earn when the server has already capped them, or vice versa.

**Fix:** Either fetch the server's "today boundary" from an RPC, or compute IST explicitly on the client (offset by +5:30).

---

### F-BL-14: Venue Health Check Deactivation Does Not Cancel Upcoming Sessions
**Severity: MEDIUM** | **Subsystems: venueHealthCheck.ts <-> autoSession.ts**

When `deactivateVenue()` at `venueHealthCheck.ts:147` deactivates a venue, it:
1. Updates the nomination status to "deactivated"
2. Notifies the nominator

It does NOT:
1. Cancel upcoming events at that location
2. Notify users who have RSVP'd to sessions at that venue
3. Remove the location from `autoSession.ts`'s venue selection

The `pickBestVenue()` function at `autoSession.ts:148-153` queries the `locations` table directly, not through venue_nominations status. Deactivating a nomination does not remove its linked location from the `locations` table. Auto-sessions will continue to be created at deactivated venues.

**Impact:** Sessions will be scheduled at venues that the community has flagged as closed or having consistently poor conditions. Attendees show up to find a closed or unsuitable venue.

**Fix:** (1) `deactivateVenue()` must also soft-delete or flag the linked location. (2) Cancel or reassign upcoming events at that location. (3) `pickBestVenue()` must check venue health status.

---

### F-BL-15: Nomination Ring Detection Is Never Called
**Severity: MEDIUM** | **Subsystems: venueNomination.ts**

`detectNominationRings()` at `venueNomination.ts:445` is a sophisticated function that detects reciprocal vouch gaming (A nominates, B vouches; B nominates, A vouches). But a search of the entire codebase shows it is exported but never imported or called by any component, page, admin dashboard, or Edge Function.

**Impact:** The anti-gaming protection exists as dead code. Bad actors can freely engage in nomination rings to artificially activate venues without any detection or consequence.

**Fix:** Wire `detectNominationRings()` into the admin dashboard (e.g., FlagsTab) and/or call it from the `check_nomination_activation()` RPC to block activation when a ring is detected.

---

### F-BL-16: `evaluateVenueHealth()` Client-Side Function Duplicates Server Logic
**Severity: LOW-MEDIUM** | **Subsystems: venueHealthCheck.ts**

`venueHealthCheck.ts:112-142` contains a full client-side implementation of `evaluateVenueHealth()`. But `submitHealthCheck()` at line 95 calls the server RPC `server_evaluate_venue_health` instead. The client-side `evaluateVenueHealth()` function is exported but the actual evaluation path uses the server RPC.

If any component calls the client-side `evaluateVenueHealth()` directly, it could deactivate venues without server-side authorization -- the exact vulnerability the RPC was designed to prevent.

**Impact:** An attack surface exists where client code could trigger venue deactivation. The dual implementation also risks divergence if one is updated without the other.

**Fix:** Remove the client-side `evaluateVenueHealth()` function or mark it as `@internal` / unexport it. Only the server RPC should have deactivation authority.

---

### F-BL-17: Session Match Scoring Maps Vibes to Wrong Formats
**Severity: LOW-MEDIUM** | **Subsystems: sessionMatch.ts <-> sessionPhases.ts**

`sessionMatch.ts:71-76` maps work vibes to session formats:

```typescript
const vibeMap: Record<string, string[]> = {
  deep_focus: ['structured_2hr', 'structured_4hr'],
  casual_social: ['casual'],
  balanced: ['casual', 'structured_2hr'],
};
```

`deep_focus` users are matched to `structured_2hr`/`structured_4hr` but NOT to `focus_only_2hr`/`focus_only_4hr`, which are specifically designed for deep focus work (no icebreakers, no social breaks). Meanwhile, `balanced` users are matched to `casual` (no structure at all) rather than `structured_2hr` (which has both focus and social elements).

**Impact:** Session recommendations push deep-focus users toward social sessions and balanced users toward unstructured sessions -- the opposite of what the session formats were designed for.

**Fix:** Update the vibeMap: `deep_focus: ['focus_only_2hr', 'focus_only_4hr', 'structured_4hr']`, `balanced: ['structured_2hr', 'structured_4hr']`, `casual_social: ['casual', 'structured_2hr']`.

---

### F-BL-18: Rank-Up Notification Fan-Out Is O(N) With No Batching
**Severity: LOW-MEDIUM** | **Subsystems: ranks.ts**

`addFocusHours()` at `ranks.ts:155-169` notifies ALL onboarded members when someone ranks up:

```typescript
const { data: members } = await supabase.from("profiles")
  .select("id")
  .eq("onboarding_completed", true)
  .neq("id", userId);

if (members && members.length > 0) {
  for (const m of members) {
    await supabase.rpc("create_system_notification", { ... });
  }
}
```

At 1000 members (the target from CLAUDE.md), this creates 999 sequential RPC calls. The same pattern repeats at `ranks.ts:200-211` for first-to achievements. Each RPC call is an individual HTTP request.

**Impact:** At target scale, ranking up takes 999 * ~100ms = ~100 seconds of sequential awaits, blocking the user's post-session flow. The function that calls `addFocusHours()` will appear to hang.

**Fix:** Replace the loop with a single batch insert into `notifications` table, or move rank-up notification fan-out to a server-side Edge Function that runs asynchronously.

---

## Gestalt Failures -- Where the Whole Is Less Than the Sum of Parts

### G-1: The FC Economy and Session System Are Disconnected at the Incentive Level

The FC economy rewards *contributions about venues* (30 FC for nomination, 5-15 FC per info report, 2x first-mover bonus) far more than *attending sessions* (10 FC for completion). But the product's core value loop is sessions, not venue data. A rational FC-maximizer would spend all their time uploading photos and reporting amenities, never attending a session. The spatial data moat vision (PRODUCT-VISION.md) accidentally competes with the session flywheel.

### G-2: Four Progression Systems Run in Parallel Without Awareness of Each Other

- **Ranks** (focus hours) -- `ranks.ts`
- **Badges** (17 types) -- `badges.ts`
- **Milestones** (22 types) -- `growth.ts`
- **FC Balance** -- `focusCredits.ts`

None of these systems reference each other. Reaching "Elite" rank does not unlock any badge. Earning 10 badges does not affect your FC earning rate. Having 5000 FC does not affect your engagement score. The result is four parallel progress bars that a user must mentally track, with no synergy between them. Compared to a system where rank unlocks badges which unlock FC multipliers which unlock features -- the current design feels fragmented.

### G-3: The Matching Engine and the Needs Board Are Islands

`matchUtils.ts` scores member-to-member compatibility. `needsMatch.ts` scores need-to-member compatibility. Neither references the other. A user who posts a "need" for a React developer should have their match score with React developers boosted -- but the needs board does not feed into the matching algorithm. The "structured serendipity" promise from PRODUCT-VISION.md requires these systems to talk to each other, and they do not.

---

## Summary

| # | Issue | Severity | Fix Effort |
|---|-------|----------|------------|
| F-BL-01 | Auto-session phantom formats | CRITICAL | 30 min |
| F-BL-02 | Hardcoded neighborhood threshold | HIGH | 15 min |
| F-BL-03 | Matching ignores reliability | HIGH | 2-3 hours |
| F-BL-04 | FC economy faucet/sink imbalance | HIGH | 1-2 days |
| F-BL-05 | contribution_milestone type bypass | HIGH | 30 min |
| F-BL-06 | Double FC award for venue nomination | MEDIUM-HIGH | 30 min |
| F-BL-07 | Smart groups ignore session format | MEDIUM-HIGH | 2 hours |
| F-BL-08 | Engagement score ignores most actions | MEDIUM | 2 hours |
| F-BL-09 | Growth flywheel cold-start deadlock | MEDIUM | 1 hour |
| F-BL-10 | Inconsistent match scoring scales | MEDIUM | 3-4 hours |
| F-BL-11 | Re-engagement defeats itself | MEDIUM | 15 min |
| F-BL-12 | Streak uses FC ledger as proxy | MEDIUM | 30 min |
| F-BL-13 | Client vs server timezone mismatch | MEDIUM | 1 hour |
| F-BL-14 | Deactivation misses session cleanup | MEDIUM | 2 hours |
| F-BL-15 | Ring detection is dead code | MEDIUM | 1 hour |
| F-BL-16 | Duplicate client/server health eval | LOW-MEDIUM | 30 min |
| F-BL-17 | Vibe-to-format mapping is wrong | LOW-MEDIUM | 15 min |
| F-BL-18 | O(N) rank notification fan-out | LOW-MEDIUM | 1-2 hours |

**Total identified issues: 18 failure points + 3 gestalt failures.**

**Highest-leverage fix:** F-BL-01 (auto-session phantom formats) -- a 30-minute change that fixes the core product's primary automation pipeline.

**Highest-systemic-impact fix:** F-BL-03 (matching ignores reliability) -- threads reliability through the matching/grouping/captain system, which the FIX-ROADMAP already designed but the code does not implement.
