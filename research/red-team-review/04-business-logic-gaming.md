# Red Team Report 04: Business Logic, Anti-Gaming & Platform Integrity

**Auditor:** Red Team Security Research
**Date:** 2026-02-09
**Scope:** Grouping algorithm, streaks, reputation, favorites, goals, venue scoring, disintermediation
**Codebase:** donedonadone @ branch `app-foundation-build`

---

## Severity / Effort / Impact / Remediation Rating Key

| Rating | Severity | Effort (Attacker) | Impact | Remediation |
|--------|----------|-------------------|--------|-------------|
| **C** | Critical | Trivial | Platform-breaking | Urgent |
| **H** | High | Low | Significant revenue/trust loss | High priority |
| **M** | Medium | Moderate | Degraded experience | Scheduled |
| **L** | Low | High | Minor annoyance | Backlog |

---

## 1. Grouping Algorithm Manipulation

**Primary file:** `scripts/004_auto_assign_groups.sql` (lines 1-241)
**Supporting:** `scripts/006b_group_history.sql`, `scripts/008b_favorites.sql`, `app/api/onboarding/route.ts`

The `auto_assign_groups` function is a greedy compatibility-scored algorithm. It picks the first unassigned user as seed (line 91), then scores every remaining candidate against the seed only (line 111-188). Scores combine: work_vibe (3pts), noise (2pts), comm_style (2pts), social_goals overlap (1pt each), introvert_extrovert proximity (1pt), anti-repetition (-5pts per recent co-group), favorite (+1pt), would_cowork_again (+2pts), streak affinity (+1pt), industry diversity (+1pt).

### 1.1 Preference Gaming to Target Specific People

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 1 | **Preference mirroring:** User A discovers User B's preferences (work_vibe, noise, comm_style) via profile page or social engineering. A changes their own preferences to exactly match B's. This yields 3+2+2 = 7 base points, nearly guaranteeing grouping. The onboarding route (`app/api/onboarding/route.ts` line 37-54) allows unlimited preference updates via upsert with no cooldown. | H | Low | Targeted grouping | Rate-limit preference changes to 1/week; hide exact preferences from non-group members |
| 2 | **Social goals flooding:** The algorithm awards 1pt per overlapping social goal (line 147-149). A user can set all available social_goals to maximize overlap with any target. The `social_goals` field is `TEXT[]` with no cardinality constraint in `001_schema.sql` line 70. | M | Trivial | Inflated compatibility scores | Cap social_goals array to 3 items; normalize overlap score |
| 3 | **Introvert-extrovert slider manipulation:** The algorithm gives +1pt when IE scores are within 1 of each other (line 138). A user can adjust their slider after seeing a target's profile to always be within 1 point. Profile page (`app/dashboard/profile/page.tsx` line 396-417) exposes the exact IE score. | M | Low | Targeted grouping | Show descriptive label only, not numeric value; add jitter to matching |
| 4 | **Work vibe copying:** Work vibe is the highest-weighted factor (3pts). Since profiles are publicly readable (`001_schema.sql` line 250: "Profiles are viewable by everyone"), an attacker can look up a target's work_vibe and switch theirs to match. | H | Trivial | Guaranteed 3pt boost | Add randomized weighting variance per session |
| 5 | **Industry field manipulation:** The diversity bonus gives +1pt for different industries (line 152-156). A user targeting a specific person can set their industry to something different to gain the bonus. Since the industry field is freetext (`profiles.industry TEXT`, line 57), this is trivially manipulated. | L | Trivial | +1pt bonus gaming | Use enumerated industry values; prevent frequent changes |
| 6 | **Communication style copying:** +2pts for matching comm_style. Freely changeable via onboarding endpoint. | M | Trivial | +2pt bonus | Same as #1 |
| 7 | **Noise preference copying:** +2pts for matching noise_preference. Freely changeable. | M | Trivial | +2pt bonus | Same as #1 |
| 8 | **Preference oscillation:** User changes preferences between sessions to alternate between targeting different people, evading pattern detection. No change history is kept. | M | Low | Serial targeting | Log preference change history; flag frequent changers |
| 9 | **Profile data harvesting for preference mirroring:** `profiles` table has RLS `FOR SELECT USING (true)` (line 250). Any authenticated user can query all profiles including display_name, work_type, industry. Combined with `group_members` + `coworker_preferences` (visible to group via goals RLS), an attacker can reconstruct anyone's full preference profile after a single co-session. | H | Low | Full preference discovery | Restrict profile fields visible to non-group members |
| 10 | **Preference inference from group reveal:** The group reveal endpoint (`app/api/session/[id]/group/route.ts` line 40) returns `coworker_preferences(work_vibe, noise_preference, communication_style, bio, social_goals, introvert_extrovert)` after check-in. This exposes all matching-relevant fields. | H | Trivial | Complete preference exposure | Only expose work_vibe post-checkin; keep other fields hidden |

### 1.2 Collusion Attacks

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 11 | **Friend group coordination:** 3-5 friends set identical preferences and book the same session/time. With max compatibility scores, the greedy algorithm groups them together since the seed picks the highest-scoring candidate. | H | Low | Friends bypass randomization | Detect preference clusters; add randomization factor |
| 12 | **Favorite ring amplification:** Friends mutually favorite each other (each gets +1pt in `favorite_coworkers`). Combined with identical preferences (7pts) and mutual would_cowork_again (+2pts), total bonus is 10pts per pair, overwhelming anti-repetition (-5pts). | H | Low | Permanent friend-group lock | Cap total bonus from social signals; diminish favorite bonus after repeated co-grouping |
| 13 | **Would-cowork-again circle:** After a coordinated session, friends all rate each other `would_cowork_again = true`. The algorithm gives +2pts (line 177-180). Since `member_ratings` only requires a unique `(from_user, to_user, session_id)` constraint (line 174), one positive rating per session permanently boosts future matching. | H | Low | Permanent +2pt collusion bonus | Decay would_cowork_again bonus over time; require minimum session count |
| 14 | **Booking timing coordination:** If friends know the session has few bookings, they can book together at a low-attendance slot where the algorithm has fewer candidates to choose from, increasing the probability of being grouped. Session spots_filled is publicly visible. | M | Low | Higher grouping probability at low-attendance sessions | Hide exact spots_filled; show ranges instead |
| 15 | **Anti-repetition window exploit:** The anti-repetition penalty checks `group_history` for last 30 days (line 160-166), but uses `LIMIT 3` which limits the COUNT query incorrectly -- it limits rows returned but `count(*)` operates before LIMIT in PostgreSQL. However, the penalty is only -5 per co-grouping. With 10+ collusion bonus, the penalty is overcome after just 2 sessions. | H | Low | Anti-repetition defeated | Make anti-repetition penalty exponential; increase base penalty |
| 16 | **Cross-session preference synchronization:** A group of colluders changes all preferences in sync before each session to always match, while normal users vary. | M | Moderate | Persistent collusion | Detect synchronized preference changes across user clusters |
| 17 | **Colluder preference uniqueness attack:** Colluders set rare preference combinations (e.g., deep_focus + lively + chatty) that few legitimate users would have, ensuring they only match each other. | M | Moderate | Self-selecting group isolation | Monitor for rare preference combinations booking same sessions |
| 18 | **Split-booking attack:** Colluders book multiple sessions and cancel selectively to ensure they end up at the same session with minimal other participants. | M | Moderate | Session manipulation | Limit cancellations; add cancellation cooldown |

### 1.3 Seed Selection Manipulation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 19 | **First-booker seed advantage:** The seed is the "first unassigned user" from `v_users` (line 91), which is `array_agg(user_id)` from bookings (line 48). The order of `array_agg` without `ORDER BY` is non-deterministic but typically insertion order. The first booker likely becomes the seed, and the entire group is built around the seed's compatibility. | H | Low | Seed position advantage | Randomize user array before grouping; use random seed selection |
| 20 | **Seed-biased scoring:** All candidates are scored against the seed only (line 114), not against all current group members. This means member 3 is chosen for compatibility with the seed, not member 2. A colluder who becomes seed controls who enters their group. | H | N/A (design) | Seed controls group composition | Score against centroid of current group, not just seed |
| 21 | **Early booking for seed position:** Since `array_agg` likely preserves insertion order and the seed is "first unassigned," booking immediately when a session opens increases chance of being seed. | M | Trivial | Seed selection gaming | Shuffle array before processing |
| 22 | **Seed rotation absence:** There is no mechanism to ensure different users are seeds across sessions. A power user who always books first always controls their group composition. | M | Low | Persistent seed advantage | Track seed history; rotate seed selection |

### 1.4 Anti-Repetition Bypass

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 23 | **30-day window expiry:** Anti-repetition only checks last 30 days (line 165: `s.date >= (CURRENT_DATE - INTERVAL '30 days')`). After 30 days, the penalty resets to 0. Colluders can alternate: meet for 3 sessions, skip 30 days, repeat. | M | Low | Periodic repetition bypass | Extend window to 90 days; use exponential decay instead of hard cutoff |
| 24 | **LIMIT 3 misuse in anti-repetition query:** Line 166 has `LIMIT 3` on the count query. In PostgreSQL, `SELECT count(*) ... LIMIT 3` still returns the full count (LIMIT applies to result rows, and count returns 1 row). However, the comment says "last 3 sessions" but the query counts ALL co-groupings in 30 days. This is actually stricter than intended. | L | N/A | Code/comment mismatch | Fix comment to match actual behavior |
| 25 | **Overwhelm penalty with positive signals:** Anti-repetition is -5 per co-grouping. With max positive signals (work_vibe=3, noise=2, comm=2, goals=~3, ie=1, favorite=1, cowork_again=2, streak=1, diversity=1) = ~16pts, even 3 co-groupings (-15pts) still yields net +1. | H | Low | Anti-repetition ineffective against high-compatibility pairs | Make anti-repetition a hard cap after N co-groupings, not just a penalty |
| 26 | **New account fresh history:** Creating a new account resets group_history. A colluder can create a fresh account to bypass anti-repetition penalties with their established friend. | H | Moderate | Anti-repetition bypass via account cycling | Link accounts by device fingerprint; require minimum sessions before full algorithm participation |
| 27 | **Group history population timing:** `populate_group_history` (line 237) runs after group assignment. If the function fails silently, history may not be recorded, allowing repeat groupings without penalty. | M | N/A (bug) | Missing history | Add error handling to populate_group_history; verify insertion count |

### 1.5 Group Size Exploitation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 28 | **Remainder merge exploit:** Lines 202-211 merge remaining users (< group_size) into the last group. If 4 colluders book with 2 legitimate users (total 6, group_size=4), the algorithm creates one group of 4 and merges remaining 2 into it, creating a group of 6. Colluders get a larger group they control. | M | Moderate | Oversized groups with colluder majority | Cap merged group size; create undersized group instead of merging |
| 29 | **Minimum group gaming:** With group_size=4 and exactly 5 bookings, the algorithm creates one group of 4 and merges the last 1 into it (group of 5). If 4 colluders book together, the 5th person is forced into their group. | M | Low | Forced grouping with colluders | Allow standalone assignment; create minimum 2-person remainder groups |
| 30 | **Group size parameter observation:** Sessions expose `group_size` (3-5, `001_schema.sql` line 112). Attackers can choose sessions with group_size=3 (fewest members needed to control a full group). | M | Trivial | Easier group control | Don't expose group_size to users |
| 31 | **Exact-fill booking attack:** If colluders know max_spots and can coordinate booking exactly group_size people, they fill one complete group. For group_size=3, only 3 colluders are needed. | M | Low | Complete group control with 3 accounts | Add randomization even for exact-fill scenarios |

### 1.6 Targeting Specific Venues/Times

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 32 | **Low-attendance session targeting:** Sessions with few bookings (visible via `spots_filled`) mean fewer candidates for the algorithm. In the extreme, if only colluders book, they are guaranteed to be grouped together. | H | Low | Guaranteed group control | Hide exact attendance; require minimum bookings before group assignment |
| 33 | **Off-peak time exploitation:** Booking unpopular time slots (early morning, late evening) where few legitimate users book, ensuring colluders dominate the session. | M | Low | Higher control probability | Implement minimum viable group threshold |
| 34 | **Venue selection for predictability:** Choosing less popular venues reduces the pool of legitimate bookers, increasing colluder concentration. | M | Low | Higher control probability | Cross-venue pooling for group assignment |
| 35 | **New venue first-session attack:** A newly added venue's first session likely has low attendance. Colluders target these for near-guaranteed grouping. | M | Low | New venue exploitation | Delay group assignment until minimum bookings reached |
| 36 | **Session information leakage:** The sessions endpoint returns full details including spots_filled, max_spots, venue, and timing. This gives colluders perfect information for targeting. | M | Trivial | Strategic session selection | Show attendance as percentage ranges |
| 37 | **Partner collusion for session creation:** A malicious partner could create sessions at unusual times specifically for colluder friends to book. `002_partner_session_rls.sql` allows partners to create sessions freely. | H | Moderate | Manufactured low-attendance sessions | Require admin approval for unusual session times |

### 1.7 Sybil Attacks

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 38 | **Multi-account group control:** Create 3-5 accounts with identical preferences. Book the same session. Algorithm groups them together. Cost: 3-5 session fees. | C | Moderate | Complete group composition control | Phone number verification; device fingerprinting; behavioral analysis |
| 39 | **Sybil accounts for rating manipulation:** Create fake accounts, get grouped with target (via preference matching), then submit negative ratings. `member_ratings` has no verification that both users were actually in the same group beyond the session_id check. | C | Moderate | Reputation destruction | Verify group membership before allowing ratings |
| 40 | **Sybil accounts for favorite boosting:** Create multiple accounts, attend sessions with target, then favorite them. This increases their matching bonus across sessions. | H | Moderate | Artificial favorite inflation | Require minimum sessions together before allowing favorites |
| 41 | **Cheap Sybil via self-confirmation payment:** The payment route (`app/api/bookings/[id]/payment/route.ts` lines 51-92) allows users to self-confirm payment via PATCH. There is no server-side payment verification -- users just submit a `upi_ref` and status becomes "paid". This makes Sybil attacks nearly free. | C | Trivial | Zero-cost Sybil accounts | Implement server-side payment verification; admin payment confirmation |
| 42 | **Email-only signup:** If Supabase auth only requires email (no phone verification), creating multiple accounts is trivial with disposable email services. | H | Trivial | Unlimited account creation | Require phone OTP verification; limit 1 account per phone |
| 43 | **Sybil referral farming:** Each new account auto-generates a referral code (`010_referrals.sql` line 38-69). Sybil accounts can refer each other for credits, reducing the cost of the attack further. | H | Trivial | Free credits via self-referral | Verify referral chains; require session completion before credit |
| 44 | **Bot-driven booking:** No CAPTCHA or rate limiting on the booking endpoint (`app/api/bookings/route.ts`). Automated scripts can create bookings across sessions. | M | Low | Automated session manipulation | Add rate limiting; CAPTCHA for booking |

### 1.8 Algorithm Timing Attacks

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 45 | **Late booking to observe pool:** Users can wait until close to session time, observe who has booked (via spots_filled or social channels), then book only when favorable targets are present. | M | Low | Strategic booking | Lock bookings N hours before session; hide real-time attendance |
| 46 | **Last-minute cancel/rebook:** Book early for seed advantage, cancel, wait to see the pool, rebook. The booking route checks for existing booking (`app/api/bookings/route.ts` line 48-54) but uses `neq("status", "cancelled")`, so cancelled bookings don't block rebooking. | M | Low | Information-advantaged rebooking | Add rebooking cooldown; limit cancellations per user |
| 47 | **Group assignment timing observation:** The `auto_assign_groups` function can be called multiple times (it DELETEs existing groups first, lines 80-83). If an admin re-runs assignment, users who know the timing can adjust bookings. | L | High | Requires admin timing knowledge | Log and audit all group assignment runs |
| 48 | **Race condition in booking:** `book_session` RPC (line 189-210) uses `UPDATE ... WHERE spots_filled < max_spots` which is atomic. However, the pre-check in `app/api/bookings/route.ts` (lines 48-61) for existing bookings is separate from the RPC call, creating a TOCTOU window. | L | High | Potential double booking | Move duplicate check into the RPC |

### 1.9 Additional Grouping Vectors

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 49 | **Missing preference fallback:** If a user has no `coworker_preferences` record, `v_prefs -> user_id::TEXT` returns NULL. The algorithm skips scoring (line 124: `IF v_pref_a IS NOT NULL AND v_pref_b IS NOT NULL`), defaulting to 0 base score. A user without preferences gets grouped by non-preference signals only (favorites, cowork_again, streak), which may be more manipulable. | M | Trivial | Unpredictable grouping for pref-less users | Require onboarding completion before booking |
| 50 | **Favorite asymmetry exploitation:** The favorite bonus only checks if the SEED favorited the candidate (line 170-172: `WHERE user_id = v_seed`). If a non-seed user has favorited someone, it has no effect unless they become seed. This creates an asymmetric advantage for seeds. | M | N/A (design) | Seed-biased favorite matching | Check bidirectional favorites |
| 51 | **Streak affinity gaming:** The streak bonus (+1pt) applies when both users have `current_streak > 0` (line 183-185). Maintaining a streak is easy (1 session/week). All active users get this bonus with each other, making it a non-discriminating factor that slightly inflates all scores equally. | L | Trivial | Meaningless bonus inflation | Make streak bonus tiered (higher streaks = more bonus) |
| 52 | **Algorithm determinism:** The greedy algorithm is deterministic given the same input. If a user can predict the booking list, they can predict exact group assignments. Since bookings are queryable and the algorithm code is open, this is feasible. | H | Moderate | Complete group prediction | Add cryptographic randomness to scoring |
| 53 | **Cross-group information leakage via goals:** Session goals RLS (`007b_session_goals.sql` line 22-30) allows viewing goals for anyone with a paid booking in the same SESSION (not just the same group). Users can see goals of people in other groups, leaking information. | M | Trivial | Cross-group data exposure | Restrict goal visibility to same group_id |
| 54 | **Preference field injection:** The `social_goals` field is `TEXT[]` with no validation of individual values. Users can insert arbitrary strings. While this doesn't directly affect security, custom social goals like "looking for dating" could game the matching (the algorithm does string equality for overlap). | L | Trivial | Nonsensical goal matching | Validate against allowed social_goals list |
| 55 | **Bio field in matching:** The bio field (`char_length(bio) <= 200`) is stored but not used in matching. However, it is exposed post-checkin (`app/api/session/[id]/group/route.ts` line 40), potentially containing contact information for disintermediation. | M | Trivial | Off-platform contact via bio | Filter bio for phone numbers, emails, social handles |
| 56 | **Industry diversity exploit for avoidance:** Setting industry to match an unwanted person eliminates the +1 diversity bonus, potentially lowering their score relative to others. | L | Moderate | Minor avoidance | No action needed (low impact) |
| 57 | **Score tie-breaking exploit:** When scores tie, the algorithm picks the first candidate in array order (line 190: `IF v_score > v_best_score` -- strictly greater, so first candidate wins ties). This gives earlier-booked users a tie-breaking advantage. | L | Low | Slight booking order advantage | Use `>=` with random tie-breaking |
| 58 | **Group_members viewable by all:** RLS on `group_members` is `FOR SELECT USING (true)` (line 292). Anyone can query which users are in which groups across all sessions, enabling comprehensive social network mapping. | H | Trivial | Full group history exposure | Restrict to own group or session participants |
| 59 | **Matching outcomes viewable by user:** `matching_outcomes` table RLS allows users to view their own outcomes (line 33-34). This exposes the exact compatibility_score, history_penalty, favorite_bonus etc. that the algorithm computed. Users can reverse-engineer exactly how to manipulate scores. | H | Trivial | Algorithm reverse-engineering | Remove user access to matching_outcomes; admin-only |
| 60 | **Group history self-query:** `group_history` RLS (`006b_group_history.sql` line 20) lets users see their own history, including `co_member_id`. Combined with public profiles, users can build a complete map of who they were grouped with and when. | M | Trivial | Social network mapping | Acceptable for user experience; monitor for scraping |
| 61 | **No booking payment verification for grouping:** The algorithm includes users with `payment_status IN ('paid', 'confirmed')` (line 51). But "paid" status is self-reported (payment route PATCH). Unpaid users can enter groups. | C | Trivial | Free session participation | Require admin-verified payment before group inclusion |
| 62 | **Preference update timing:** No restriction on when preferences can be changed. Users can update preferences after booking but before group assignment. | M | Trivial | Last-minute preference manipulation | Lock preferences after booking for that session |
| 63 | **Multi-venue same-time booking:** No check prevents booking multiple sessions at overlapping times. A user could book multiple sessions, see which group assignments are favorable, and cancel the rest. | M | Low | Session shopping | Check for time conflicts at booking time |
| 64 | **Subscription priority matching not implemented:** The `Regular` and `Pro` plans have `"priority_matching": true` in features (`009_subscriptions.sql` line 50-52), but the `auto_assign_groups` function never checks subscription status. The feature is marketed but not enforced. | M | N/A (design gap) | Misleading feature promise | Implement priority matching or remove claim |

### 1.10 Grouping Vectors (65-82)

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 65 | **Partner viewing all bookings:** Partners can view all bookings for their venue sessions (`002_partner_session_rls.sql` line 24-33). A colluding partner can leak booker identities to friends for targeted grouping. | H | Low | Information leak via partner | Limit partner view to aggregate data, not individual user IDs |
| 66 | **Admin group manipulation:** Admin can insert/delete groups and group_members (`003_admin_rls.sql` lines 44-57). A rogue admin can manually place friends together. | H | Low (insider) | Direct group control | Audit log all admin group changes; require dual approval |
| 67 | **Cancelled booking ghost data:** When a user cancels, `cancelled_at` is set but the booking row persists. The grouping algorithm filters `cancelled_at IS NULL` (line 52), which is correct. However, cancelled users' preference data remains in the prefs map, wasting computation. | L | N/A | Minor inefficiency | Filter in preference loading query |
| 68 | **No check-in verification for group assignment:** Groups are assigned before check-in. Users who never show up still occupy group slots, potentially displacing legitimate users from better groups. | M | Low | Ghost group members | Allow re-assignment at check-in time |
| 69 | **Artificial attendance scarcity:** Colluders book a session to fill it up, preventing legitimate users from booking. Then some cancel at the last minute, leaving a small colluder-controlled pool. | M | Moderate | Session manipulation | Rolling waitlist; backfill from waitlist on cancellation |
| 70 | **Booking for another user:** The `book_session` RPC accepts `p_user_id` directly. While the API route passes `user.id`, a direct Supabase RPC call (if the function's RLS allows it) could book on behalf of another user. The function is `SECURITY DEFINER`, bypassing RLS. | H | Moderate | Booking impersonation | Add `auth.uid()` check inside RPC |
| 71 | **Group size varies by session:** Different sessions can have different `group_size` (3-5). Colluders can target group_size=3 sessions where fewer accounts are needed for full group control. | M | Low | Easier Sybil with small groups | Standardize group sizes; or require more diversity in small groups |
| 72 | **Work vibe enum limitation:** Only 3 work_vibe values exist (deep_focus, casual_social, balanced). With ~33% of users sharing each vibe, the +3 bonus is easily obtained by a large fraction of pairs. This reduces its discriminating power. | L | N/A (design) | Low matching specificity | Add more vibe categories or make matching multi-dimensional |
| 73 | **Scoring only against seed, not group:** As noted in #20, candidates are scored only against the seed. The 3rd and 4th members may be incompatible with each other but both compatible with the seed. Colluders can exploit this by having one person be seed and others designed to match only the seed. | M | Moderate | Inhomogeneous groups | Score against group centroid or all current members |
| 74 | **No diversity enforcement in groups:** Beyond industry diversity (+1pt), there is no enforcement of demographic, gender, or other diversity. This allows self-selecting homogeneous groups. | L | N/A (design) | Potential exclusion patterns | Add diversity constraints |
| 75 | **Group reveal timing:** Group reveals happen via API before check-in (with limited info) or after check-in (full info). The timing of group reveal relative to cancellation deadline creates an information asymmetry that can be exploited. | M | Low | Cancel after unfavorable group reveal | Prevent cancellation after group reveal |
| 76 | **Preference-free matching for new users:** Users who skip onboarding have no preferences. They receive 0 base score with everyone, making their placement essentially random. Colluders can exploit this predictability. | L | Moderate | Unpredictable but exploitable edge case | Require onboarding before booking |
| 77 | **Waitlist to group jump:** If a waitlisted user gets offered a spot, they enter the booking pool. If groups have already been assigned, the new user may not be included unless the algorithm is re-run. | M | Low | Orphaned group members | Re-run algorithm on waitlist promotion |
| 78 | **Multiple sessions same venue same day:** If a venue has multiple session slots on the same day, users can book both. The anti-repetition penalty applies across sessions, but within the same day, the `date >= CURRENT_DATE - 30 days` check includes both sessions, so the penalty does apply. | L | Low | Expected behavior | No action needed |
| 79 | **Favourite + would_cowork_again stacking:** A user who both favorites someone AND rates them would_cowork_again gets +1 +2 = +3 bonus on top of any preference matching. This is a significant persistent boost. | M | Low | Persistent score inflation for known contacts | Cap combined social bonus |
| 80 | **Algorithm does not consider negative ratings:** The algorithm checks `would_cowork_again = TRUE` for a bonus but never penalizes `would_cowork_again = FALSE`. Negative ratings have zero effect on future grouping. | H | N/A (design) | Toxic users not penalized in matching | Add penalty for negative would_cowork_again ratings |
| 81 | **Booking_status check inconsistency:** The booking route checks `neq("status", "cancelled")` (line 53) but the field is `payment_status`, not `status`. This may mean cancelled bookings aren't detected properly, depending on the actual column name. | M | N/A (bug) | Potential double-booking | Fix column name reference |
| 82 | **Session with 0 bookings still assignable:** If `auto_assign_groups` is called on a session with 0 confirmed bookings, it returns an error (line 54-56). However, with exactly 1 booking, the function also returns error (< 2). A single colluder can't be grouped but their booking persists. | L | N/A | Edge case handling | Expected behavior; no action needed |

---

## 2. Streak System Abuse

**Primary file:** `scripts/007_streaks.sql`
**Supporting:** `scripts/005_session_day.sql` (check-in), `app/api/session/[id]/checkin/route.ts`

The streak system increments when a user checks in to 1+ sessions per calendar week (ISO week, Monday start). Streaks reset if a user misses more than 1 week.

### 2.1 Fake Check-in for Streak Maintenance

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 83 | **Self-confirmed payment + remote check-in:** The check-in RPC (`005_session_day.sql` line 10-60) validates: booking exists, payment is paid/confirmed, session is today, and current time is within the session window (30 min before start to end). However, there is NO location verification. A user can book, self-confirm payment, and check in remotely without attending. | C | Trivial | Fake attendance; illegitimate streak maintenance | Add geolocation verification; QR code check-in at venue |
| 84 | **Timezone exploitation for check-in window:** The check-in uses `CURRENT_DATE` and `CURRENT_TIME` which are based on the PostgreSQL server timezone. If the server is in UTC but sessions are in IST (UTC+5:30), the time window calculations may be off by 5.5 hours. | H | Low | Extended check-in window | Use session timezone explicitly in calculations |
| 85 | **Multiple bookings per week for streak safety:** Book multiple sessions per week. Only need to check in to one. If one session is inconvenient, cancel and check in to another. Streak maintained with minimal effort. | L | Low | Easy streak maintenance | Expected behavior; no action needed |
| 86 | **Check-in automation:** No CAPTCHA or human verification on the check-in API endpoint. A script can POST to `/api/session/[id]/checkin` to auto-check-in. | H | Low | Automated streak maintenance | Add human verification; venue QR code |
| 87 | **Booking extremely cheap sessions:** If a venue sets `venue_price = 0` and platform_fee is 100, the total is 100. With self-confirmed payment (no actual payment needed), a user can maintain streaks for free. | H | Trivial | Free streak maintenance | Enforce minimum payment verification |
| 88 | **Partner creates fake sessions for streak maintenance:** A colluding partner creates sessions that never actually happen. Users book and "check in" to maintain streaks. | H | Moderate | Systemic fake sessions | Admin approval for session creation; venue presence verification |

### 2.2 Streak Freeze Exploitation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 89 | **Streak freeze field exists but is never set:** The `streak_frozen` column exists (line 9) but the `update_streak` function never checks it. The freeze is mentioned in subscription features (`009_subscriptions.sql` line 50-52: `"streak_freezes": 0/1/2`) but there is no code to activate or consume a freeze. | M | N/A (unimplemented) | Freeze feature is non-functional | Implement streak freeze logic |
| 90 | **Manual streak freeze manipulation:** Since `user_streaks` has no UPDATE policy for regular users (only SELECT in RLS, line 17), the streak_frozen field cannot be directly manipulated by users through RLS. However, `update_streak` is SECURITY DEFINER and resets `streak_frozen = FALSE` on every update (lines 57, 66). | L | High | Cannot exploit directly | Implement freeze properly when building the feature |
| 91 | **Subscription streak freeze bypass:** Even if implemented, the freeze count in subscription `features` JSONB is not enforced at the database level. A direct Supabase call could potentially activate more freezes than allowed. | M | Moderate | Unlimited freezes if feature is naively implemented | Enforce freeze count server-side with transaction |
| 92 | **Freeze timing manipulation:** If freezes are ever implemented, users could strategically freeze on weeks they know they can't attend, then unfreeze. Without a cooldown, this could be done repeatedly. | M | Low (if implemented) | Streak never breaks | Limit freeze activation to 1 per 30 days |

### 2.3 Week Boundary Edge Cases

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 93 | **ISO week boundary confusion:** `week_start` function (line 21-26) uses `EXTRACT(ISODOW FROM p_date)` which follows ISO 8601 (Monday = 1). This is correct for ISO weeks but may confuse users who think of Sunday as week start. A user might miss a Monday thinking they have until Sunday. | L | N/A | User confusion, not exploitable | Document clearly; use IST week convention |
| 94 | **End-of-week session for double-week credit:** Check in on Sunday evening. `week_start(CURRENT_DATE)` returns the Monday of that week. Streak is updated for that week. The following Monday (1 day later), check in again -- new week, streak increments. Two check-ins in 2 calendar days counts as 2 weeks of streak. | L | Low | Accelerated streak building | Expected behavior (valid attendance) |
| 95 | **Cross-midnight check-in:** If a session runs from 9 PM to 11 PM and the check-in happens at 11:55 PM (within end_time), `CURRENT_DATE` might be the next day if the session spans midnight. The check `v_session.date != CURRENT_DATE` (line 40) would fail. | M | Low | Denied check-in for late evening sessions | Allow check-in for sessions ending within +1 day |
| 96 | **Week boundary at session assignment:** Group assignment could happen on Sunday for a Monday session. The streak bonus in the grouping algorithm checks `current_streak > 0`, which could change over the weekend if a user's streak expires at week transition. | L | N/A | Minor inconsistency in streak-based matching | Recompute streaks at assignment time |
| 97 | **New Year week transition:** ISO weeks can have week 52/53 to week 1 transitions that might confuse date arithmetic. The `INTERVAL '7 days'` check (line 52) handles this correctly since it operates on dates not week numbers. | L | N/A | No issue | No action needed |

### 2.4 Streak Restoration and Manipulation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 98 | **No admin override audit:** Admin can update bookings (`003_admin_rls.sql` line 38-39), including setting `checked_in = TRUE`. This fires the streak trigger, allowing an admin to retroactively grant check-ins and restore streaks. | H | Low (insider) | Insider streak manipulation | Audit log admin check-in overrides |
| 99 | **Retroactive check-in via admin booking update:** Since the trigger fires on `UPDATE OF checked_in ON bookings`, any admin update to checked_in triggers `update_streak`. The streak function uses `CURRENT_DATE`, so the streak is attributed to the current week, not the session date. | H | Low (insider) | Wrong week streak attribution | Use session date, not CURRENT_DATE, in streak calculation |
| 100 | **Longest streak never decreases:** The `longest_streak` field only increases via `GREATEST(longest_streak, current_streak + 1)` (line 55). Once set, it persists forever. A user who cheated early retains their longest streak badge permanently. | L | N/A | Historical badge integrity | Allow admin to reset longest_streak |
| 101 | **Streak reset only checks one week gap:** If `last_session_week = v_current_week - 7 days`, streak continues (line 52). Otherwise it resets to 1. There is no partial credit for attending every other week. | L | N/A | Strict but clear rules | Expected behavior |
| 102 | **Multiple check-ins same week don't stack:** The function returns early if `last_session_week = v_current_week` (line 47-48). This is correct -- multiple sessions per week don't multiply the streak. However, it also means the first check-in of the week is the only one that matters. | L | N/A | No exploit | Expected behavior |
| 103 | **Streak affinity creates two-tier system:** Users with streaks get +1pt matching with other streakers (line 183-185 in 004). This creates a self-reinforcing in-group where streakers are preferentially matched, making it harder for new users to break in. | M | N/A (design) | New user disadvantage | Reduce or remove streak affinity bonus |
| 104 | **Direct DB manipulation via SECURITY DEFINER:** `update_streak` is SECURITY DEFINER (line 70). It is called via trigger, not directly by users. However, the trigger fires on ANY update to `checked_in` on bookings, including admin updates. This is the correct behavior but should be audited. | L | N/A | Expected behavior | Add audit logging |

---

## 3. Reputation/Rating Gaming

**Primary files:** `scripts/008_reputation.sql`, `scripts/006c_enhanced_ratings.sql`, `scripts/006_profile_stats.sql`
**Supporting:** `app/api/session/[id]/feedback/route.ts`, `components/session/feedback-form.tsx`, `lib/config.ts`

### 3.1 Rating Manipulation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 105 | **No group membership verification for member ratings:** The feedback POST endpoint (`app/api/session/[id]/feedback/route.ts` lines 134-152) accepts member_ratings with arbitrary `to_user` UUIDs. It only verifies that the submitter has a confirmed booking for the session -- NOT that the rated user was in the same group. An attacker can rate any user who attended the same session. | C | Trivial | Rate anyone in any group at the session | Verify to_user was in the same group_id |
| 106 | **No limit on member ratings count:** The feedback endpoint maps all `member_ratings` from the request body and inserts them. There is no check that the number of ratings matches the group size. A user could submit ratings for users not in their group. | H | Trivial | Extra ratings for arbitrary users | Validate rated users against group_members |
| 107 | **Self-rating possible:** The feedback endpoint does not check that `to_user != user.id`. A user could include themselves in the `member_ratings` array with `would_cowork_again: true`. The UNIQUE constraint `(from_user, to_user, session_id)` would allow this since from_user and to_user are different fields. | H | Trivial | Self-inflated reputation | Add from_user != to_user check |
| 108 | **Duplicate session feedback override:** The feedback INSERT (`line 129`) will fail on `booking_id UNIQUE` constraint if feedback already exists. But the endpoint doesn't handle this error specifically -- it returns a generic 500. A user can't submit twice, but the error UX is poor. | L | N/A | UX issue, not exploitable | Return 409 for duplicate feedback |
| 109 | **Arbitrary tags injection:** The `tags` field in session_feedback accepts any string array (line 116-117). The `FEEDBACK_TAGS` in the frontend (`components/session/feedback-form.tsx` line 14-25) are cosmetic only. The API accepts any tags. | L | Trivial | Nonsensical tags in data | Validate tags against allowed list server-side |
| 110 | **Arbitrary member rating tags:** Similarly, `member_ratings.tags` accepts any TEXT[] (line 146). The `MEMBER_RATING_TAGS` from config are frontend-only. | L | Trivial | Data pollution | Validate against MEMBER_RATING_TAGS server-side |
| 111 | **Energy match value manipulation:** The `energy_match` field accepts 1-5 (CHECK constraint in DB, `006c_enhanced_ratings.sql` line 7). The API passes it through without validation (`line 147: mr.energy_match || null`). The DB constraint will reject invalid values, but the error handling is generic. | L | Low | DB-level protection exists | Add API-level validation for clearer errors |
| 112 | **Rating without check-in:** The feedback endpoint only verifies payment_status is paid/confirmed (line 96), NOT that the user checked in. A user who never attended can rate group members. | H | Trivial | Ghost raters affect reputation | Require checked_in = TRUE before feedback |
| 113 | **Rating after session date:** No time limit on when feedback can be submitted. A user could submit ratings weeks or months after a session. | M | Trivial | Delayed reputation attacks | Add feedback window (e.g., 7 days post-session) |
| 114 | **Cross-session rating via session_id manipulation:** The `member_ratings` table unique constraint is `(from_user, to_user, session_id)`. A user could potentially submit ratings with a different session_id than the one in the URL params. The endpoint binds `session_id: sessionId` from params, so this is correctly handled. | L | N/A | Properly prevented | No action needed |
| 115 | **Partner can see all feedback:** `002_partner_session_rls.sql` lines 36-45 allow partners to view feedback for their venue sessions. A malicious partner could use this data to discriminate against specific users. | M | Low | Privacy violation via partner access | Aggregate feedback for partner view; anonymize individual ratings |

### 3.2 "Would Cowork Again" Farming

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 116 | **Reciprocal rating ring:** Group of friends mutually rate each other `would_cowork_again: true` every session. With 4 group members, each member gets 3 positive ratings per session. Over 10 sessions, that is 30 positive ratings each. | H | Low | Inflated cowork_again_rate | Require minimum unique raters; diminish weight of repeated raters |
| 117 | **Sybil positive rating farm:** Create fake accounts, attend sessions via self-confirmed payment, and rate the target positively. The `cowork_again_rate` component of the coworker score is worth 25% (line 80 in 008_reputation.sql). | C | Moderate | Maxed cowork_again_rate with minimal real sessions | Require payment verification; rate-limit new account ratings |
| 118 | **No minimum rating threshold:** The cowork_again_rate is calculated as `positive / total` regardless of total count. With 1 session and 1 positive rating, the rate is 100% (5.0 score). A new user with one friend's positive rating has perfect reputation. | H | Trivial | Instant max reputation for new users | Require minimum 5 ratings before computing rate; Bayesian prior |
| 119 | **Would_cowork_again is binary:** The binary nature (true/false) means there is no nuance. "Would mildly prefer to cowork again" counts the same as "amazing coworker." This makes the metric easy to game -- just click thumbs-up for everyone. | L | N/A (design) | Binary metric is low-information | Consider a 1-5 scale instead |

### 3.3 Energy Match Score Inflation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 120 | **Energy match self-inflation via Sybil accounts:** Create accounts, attend sessions with target, rate them energy_match = 5. The `avg_energy` in reputation is a straight average (line 51-53: `avg(energy_match)`). | H | Moderate | Inflated energy score (15% of composite) | Weight by unique raters; require minimum ratings |
| 121 | **Energy match is optional:** The field uses `energy_match IS NOT NULL` filter (line 53). If most users don't bother rating energy, the average is based on a small sample and easily skewed by a single colluder's rating. | M | Low | Small sample vulnerability | Display confidence interval; require minimum sample |
| 122 | **Selective energy rating:** A malicious user rates targets they dislike with energy_match = 1, and targets they like with energy_match = 5. Since the metric is averaged across all raters, a few strategic low ratings can tank someone's score. | M | Low | Targeted reputation damage | Show energy match trends; flag anomalous ratings |

### 3.4 Reputation Score Formula Exploitation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 123 | **Attendance gaming via self-confirmed check-in:** Attendance = checked_in / total_bookings (25% weight). With remote check-in and self-confirmed payment, a user can achieve 100% attendance without ever attending. | C | Trivial | Maxed attendance component (25%) | Venue-verified check-in |
| 124 | **Session count inflation:** session_score = min(sessions/50, 1) * 5 (15% weight). With cheap/free sessions and auto-check-in, reaching 50 sessions is a matter of weeks. 50 sessions * 100 = 5000 minimum spend (without payment verification: free). | H | Low | Maxed session score | Require verified payments; increase normalization denominator |
| 125 | **Streak score maxing:** streak_score = min(streak/10, 1) * 5 (10% weight). A 10-week streak maxes this out. With auto-check-in, this is trivially achievable. | M | Low | Maxed streak component | Require verified attendance for streak |
| 126 | **Feedback quality gaming:** feedback_score = feedback_given / past_sessions (10% weight). A user who always submits feedback (even empty/low-effort) gets 100% feedback score. The score doesn't measure feedback quality. | M | Trivial | Maxed feedback component with zero-effort feedback | Require minimum feedback content; measure response quality |
| 127 | **Component weight exploitation:** The heaviest components are attendance (25%) and cowork_again_rate (25%). Both are trivially gameable. A colluder can reach 50% of max score from these two alone. | H | Low | Half the score is easily gameable | Increase weight of verified, hard-to-game metrics |
| 128 | **Score computed on-demand, not cached:** `compute_coworker_score` runs on every profile view (line 119 in `app/dashboard/profile/page.tsx`). This is a performance issue for popular profiles but also means the score reflects real-time data. No caching means no stale-data exploit. | L | N/A | Performance concern only | Cache with reasonable TTL |
| 129 | **Zero-session users get 0 score:** All components return 0 for users with no data. This is correct but creates a cold-start problem where new users appear low-reputation even if they are legitimate. | L | N/A (design) | New user disadvantage | Show "New Member" badge instead of 0 score |
| 130 | **SECURITY DEFINER on compute_coworker_score:** The function runs with elevated privileges, reading from multiple tables regardless of the caller's RLS. This is necessary for computation but means any authenticated user can compute any other user's score by calling the RPC with any p_user_id. | M | Trivial | Any user can view anyone's full reputation breakdown | Restrict to own user_id or admin |

### 3.5 Negative Rating Attacks

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 131 | **Targeted negative rating:** Rate a target `would_cowork_again: false` + `energy_match: 1` every session. Since matching does not penalize negative ratings (#80), the only impact is on reputation score. But the reputation impact is significant: 25% weight for cowork_again_rate. | H | Low | Reputation destruction | Detect anomalous rating patterns; allow users to dispute |
| 132 | **Coordinated negative rating brigade:** Multiple colluders attend sessions with a target and all rate negatively. With 4 colluders rating negatively per session, a target's cowork_again_rate drops rapidly. | H | Moderate | Severe reputation damage | Rate-limit negative ratings; require explanation for negative; flag coordinated patterns |
| 133 | **One-sided rating visibility:** RLS on `member_ratings` only allows `from_user` to see their own ratings (line 302-303). The target (to_user) cannot see who rated them negatively. This prevents defense/dispute. | H | N/A (design) | No recourse for targets | Allow to_user to see aggregate ratings (not individual); add appeal process |
| 134 | **No negative rating notification:** There is no notification when someone rates you negatively. You only discover it through your declining coworker score. | M | N/A | Silent reputation damage | Notify on significant score changes |
| 135 | **Negative rating without attendance:** As noted in #112, check-in is not required for feedback. A user who books but never shows can still submit negative ratings. | H | Trivial | Effortless reputation attacks | Require check-in for feedback |

### 3.6 Trust Tier Rushing

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 136 | **Trust tiers based solely on sessions_completed:** `getTrustTier` (`lib/config.ts` line 101-105) uses only session count. Tier thresholds: New (0-2), Rising (3-10), Trusted (11-25), Community Pillar (26-50), OG (51+). With self-confirmed payment + remote check-in, a user can reach OG in 51 sessions over ~13 weeks. | H | Low | Fake high-trust status | Base tiers on composite score, not just session count |
| 137 | **Speed-running tiers:** With multiple sessions per week available, a user could book 4+ sessions/week. At 4/week, they reach OG in ~13 weeks. With cheap/free sessions, cost is negligible. | M | Low | Rapid tier advancement | Add time-based minimum (e.g., must be member for N months) |
| 138 | **Tier benefits without quality:** Tiers are purely cosmetic currently. But if they ever gate features (e.g., priority matching for higher tiers), the gaming becomes high-impact. The subscription system already promises `priority_matching` for paid tiers. | M | N/A (future risk) | Future feature exploitation | Design tier benefits with anti-gaming in mind |
| 139 | **Trust tier persistence:** Once reached, a tier is never lost even if a user's behavior degrades. Sessions_completed only increases. | M | N/A (design) | Permanent unearned trust badges | Add active tier maintenance (e.g., must maintain minimum activity) |

### 3.7 Additional Reputation Vectors (140-185)

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 140 | **get_user_stats is SECURITY DEFINER and takes any user_id:** Any authenticated user can call `get_user_stats(p_user_id)` for any user, exposing sessions_completed, unique_coworkers, venues_visited, avg_rating, hours_focused. | M | Trivial | Full stats exposure for any user | Restrict to own user or admin |
| 141 | **Hours_focused inflation:** `get_user_stats` sums `duration_hours` for checked-in sessions (line 45-49). With fake check-ins to 4-hour sessions, hours_focused grows at 4x rate. | M | Low | Vanity metric inflation | Tied to #83 (fake check-in) |
| 142 | **Unique coworkers inflation:** Calculated from `group_members` in same groups (line 23-28). With Sybil accounts, a user's "unique coworkers" count includes their own fake accounts. | L | Moderate | Vanity metric inflation | No direct harm |
| 143 | **avg_rating_received simplified calculation:** `get_user_stats` converts would_cowork_again to a 5-point scale (TRUE=5.0, FALSE=2.0, line 38-42). This binary mapping inflates ratings since even a 50/50 split gives 3.5/5.0. | L | N/A (design) | Inflated average ratings | Use actual weighted scores |
| 144 | **Member rating tags not used in scoring:** The enhanced tags (helpful, focused, fun, great-conversation, good-energy) from `006c_enhanced_ratings.sql` are stored but never factored into reputation or matching. They are cosmetic data with no scoring impact. | L | N/A | Wasted data | Incorporate tags into reputation scoring |
| 145 | **Venue ratings don't affect user reputation:** Venue-specific ratings (wifi, ambiance, etc.) go to venue score, not user score. A user submitting all-1 venue ratings faces no consequence to their own reputation. | L | N/A (design) | Enables venue sabotage without personal cost | Track users who consistently give extreme ratings |
| 146 | **No rating recency weighting:** The coworker score averages ALL historical ratings equally. A user who improved their behavior is still dragged down by old negative ratings. Conversely, a user who degraded retains their good old ratings. | M | N/A (design) | Score doesn't reflect current behavior | Apply time-decay to ratings |
| 147 | **Bookings without sessions check_in count:** Attendance metric counts `checked_in / total bookings WHERE paid/confirmed`. A user who books many sessions and cancels some still has those bookings counted (cancelled_at IS NULL is not checked in the reputation function). Actually, the function does NOT filter by cancelled_at (line 30-34). Cancelled bookings still count against attendance if they have payment_status paid/confirmed. | M | N/A (bug) | Cancelled sessions reduce attendance score unfairly | Filter `cancelled_at IS NULL` in reputation function |
| 148 | **Feedback for sessions not yet occurred:** `session_feedback` has no date check. A user could submit feedback for a future session if they have a booking. The INSERT check is only `booking_id UNIQUE`. | M | Low | Pre-emptive feedback | Check session date < NOW() in feedback endpoint |
| 149 | **Multiple feedback via different booking IDs:** If a user somehow has two bookings for the same session (e.g., through a race condition), they could submit two feedback entries with different booking_ids. The UNIQUE is on booking_id, not (user_id, session_id). | L | High | Double feedback per session | Add UNIQUE(user_id, session_id) on session_feedback |
| 150 | **Comment field no length limit in API:** The session_feedback.comment is TEXT with no length limit in the schema. The feedback form has a textarea with no maxlength. Users could submit very long comments. | L | Trivial | Data size abuse | Add length limit to comment field |
| 151 | **Profile display_name change for anonymity:** A user can change their display_name via onboarding/profile update after receiving negative ratings. The display_name in group_members.profiles is a live join, not a snapshot. Others' memories of the "bad" coworker won't match the new name. | M | Low | Reputation evasion via name change | Snapshot display_name at session time; limit name changes |
| 152 | **Sybil reputation laundering:** Create a new account after destroying an old one's reputation. The new account starts fresh with 0 reputation. No linking between accounts. | H | Moderate | Complete reputation reset | Device fingerprinting; phone number uniqueness |
| 153 | **Rating timing asymmetry:** The first rater in a group sets the tone. If a colluder submits negative ratings before others, the target's visible score drops, potentially influencing other raters. Since ratings are private (RLS only shows from_user their own), this actually doesn't apply -- others can't see the colluder's rating. | L | N/A | Not exploitable due to RLS | No action needed |

---

## 4. Favorite Coworker Exploitation

**Primary file:** `scripts/008b_favorites.sql`
**Supporting:** `scripts/004_auto_assign_groups.sql` (favorite bonus), `app/api/session/[id]/feedback/route.ts` (favorite creation)

### 4.1 Favoriting for Guaranteed Matching

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 154 | **Unilateral favorite influence:** Favoriting gives +1pt in matching (line 170-172 in 004). This is one-directional: only the seed's favorites matter. If a user becomes seed and has favorited specific people, those people get a matching boost. | M | Low | Asymmetric matching influence | Require mutual favorites for bonus |
| 155 | **Mass favoriting:** No limit on how many users can be favorited. A user could favorite everyone they have ever been grouped with, maximizing the chance of the +1 bonus applying whenever they are seed. RLS allows unlimited INSERT. | M | Trivial | Diluted but broadly applied bonus | Cap favorites at 10-20; require mutual |
| 156 | **Favorite injection via feedback:** The feedback endpoint creates favorites via upsert (`app/api/session/[id]/feedback/route.ts` lines 155-165). The `favorites` array accepts arbitrary user IDs -- no verification that the favorited user was in the same group or session. | H | Trivial | Favorite anyone via API | Verify favorited user was in same group |
| 157 | **Favorite + preference combo attack:** Favorite a target (+1), copy their preferences (+7), rate them would_cowork_again (+2), maintain streak (+1). Total: +11 persistent bonus per session. With anti-repetition of -5, still +6 after first co-session. | H | Low | Persistent targeting despite anti-repetition | Cap total social signal bonus |
| 158 | **Unfavoriting has no penalty:** A user can favorite/unfavorite freely. Favorite before algorithm runs, unfavorite after. The algorithm reads favorites at execution time. | L | Low | Tactical favoriting | Snapshot favorites at booking time |
| 159 | **Favorite visibility privacy:** Only `user_id = auth.uid()` can see favorites (RLS line 20). A user cannot see who favorited them. This is a privacy choice but means users can't know if they're being targeted. | L | N/A (design) | No visibility into inbound favorites | Consider showing "X people favorited you" count |
| 160 | **Favorite data mining:** While users can't see who favorited them directly, the matching outcome reveals the `favorite_bonus` value. If the user sees a +1 favorite bonus in their matching_outcomes, they know someone in the group favorited them. | M | Low | Partial information leakage | Remove matching_outcomes user access (see #59) |
| 161 | **CHECK constraint bypass:** The table has `CHECK (user_id != favorite_user_id)` (line 11). This prevents self-favoriting at the DB level. The feedback endpoint doesn't filter the current user from the favorites array, but the DB constraint handles it. | L | N/A | Properly prevented by DB | Add API-level check for cleaner errors |
| 162 | **Favorite + negative rating combined attack:** Favorite a target (to get grouped with them more often), then rate them negatively every session. Systematic reputation destruction while ensuring proximity. | H | Low | Targeted, sustained reputation damage | Detect favorite + negative rating contradiction; auto-remove favorites after negative ratings |
| 163 | **Batch favorite creation via direct API:** A user could call the feedback POST endpoint with a large `favorites` array, favoriting many users at once without actually completing feedback. The endpoint doesn't require other feedback fields if they pass validation (it does require `overall_rating`, line 106). | M | Low | Circumvent UI-level limits | Validate favorites against group members |

---

## 5. Session Goals Abuse

**Primary files:** `scripts/007b_session_goals.sql`, `app/api/sessions/[id]/goals/route.ts`

### 5.1 Fake Goal Completion

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 164 | **Self-reported goal completion:** Goal completion is self-reported via PATCH or feedback endpoint. No verification that goals were actually completed. | L | Trivial | Inflated goal completion stats | Goals are accountability hooks, not enforceable -- accept this |
| 165 | **Goal completion before session:** The PATCH endpoint (`app/api/sessions/[id]/goals/route.ts` lines 85-108) has no date check. A user can mark goals complete before the session even occurs. | M | Low | Pre-session goal gaming | Check session date <= NOW() |
| 166 | **Goal completion without check-in:** No check that the user actually attended (checked_in). A no-show can mark their goals as completed. | M | Low | Phantom goal completion | Require check-in for goal completion |
| 167 | **Goal text as vanity metric:** Goal completion is currently not factored into reputation or matching. It is purely cosmetic. This limits the impact of gaming. | L | N/A | Low impact currently | Monitor if goals become scoring-relevant |
| 168 | **Toggle goal completion via feedback:** The feedback endpoint (`app/api/session/[id]/feedback/route.ts` lines 168-176) also updates goal completion. This creates two paths for the same update, potentially allowing double-updates or inconsistent state. | L | Low | State inconsistency | Consolidate goal completion to a single endpoint |

### 5.2 Goal Text Injection

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 169 | **Goal text XSS:** Goal text is user-supplied and rendered in the group reveal UI. The `goal_text` field has a 200-char limit (`CHECK (char_length(goal_text) <= 200)`) but no content validation. React's default escaping prevents XSS in JSX, but if goal_text is ever used in dangerouslySetInnerHTML, it becomes a vector. | L | Moderate | XSS if rendering changes | Sanitize goal text server-side |
| 170 | **Goal text for social engineering:** Goals are visible to group members (`007b_session_goals.sql` RLS line 22-30). A user could set goals like "Find my Insta: @handle" or "WhatsApp me: +91XXXXXXXXXX". | H | Trivial | Contact info sharing via goals | Filter goals for contact patterns (phone, email, social handles) |
| 171 | **Goal text profanity/harassment:** No content moderation on goal text. A user could set offensive or targeted harassment as their "session goal." | M | Trivial | Harassment vector | Add content moderation; profanity filter |
| 172 | **Goal text as hidden message:** Goals are visible to ALL session participants with paid bookings (line 22-30 RLS), not just group members. Users in other groups can read your goals. This expands the audience for injected content. | M | Trivial | Cross-group message broadcasting | Restrict to same group_id |

### 5.3 Goal Visibility and Data

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 173 | **Goal harvesting for profiling:** Goals reveal what someone is working on ("Finish client proposal," "Code review for startup X"). Group members and same-session participants can see all goals. Over time, this builds a work profile. | M | Low | Work activity surveillance | Only show goals to same group; redact after session |
| 174 | **Goal creation limit bypass:** The goals endpoint limits 3 goals per session (line 65-67). But this is checked per-request. A race condition with concurrent requests could create more than 3 goals before the count check resolves. | L | Moderate | Minor limit bypass | Use a DB-level constraint or transaction |
| 175 | **Goal deletion and recreation:** Users can DELETE goals (line 110-133) and POST new ones. This allows unlimited goal cycling within the 3-goal limit, potentially generating excessive DB activity. | L | Low | Minor resource abuse | Rate-limit goal creation |
| 176 | **No goal archival:** Deleted goals are permanently removed (CASCADE). There is no historical record of goals for analytics or abuse detection. | L | N/A | Missing audit trail | Soft-delete goals |
| 177 | **Goal visibility extends to cancelled bookings:** The RLS checks `payment_status IN ('paid', 'confirmed')` but doesn't check `cancelled_at IS NULL`. A user who cancels might still see others' goals if their booking record persists with paid status. | M | Low | Data exposure after cancellation | Add cancelled_at IS NULL to RLS |

---

## 6. Venue Score Manipulation

**Primary file:** `scripts/011_venue_scoring.sql`
**Supporting:** `app/api/session/[id]/feedback/route.ts`, `lib/config.ts`

### 6.1 Partner Self-Rating

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 178 | **Partner books own session:** No restriction prevents a partner from also having a coworker account and booking sessions at their own venue. They can then rate their venue 5/5 on all dimensions. | H | Low | Inflated venue score | Exclude venue partner's user_id from venue scoring |
| 179 | **Partner-affiliated account farm:** Partner creates multiple accounts for friends/employees who book sessions at their venue and rate highly. Since payment is self-confirmed, this costs nothing. | H | Moderate | Systematic venue score inflation | Detect rating clusters from accounts that only rate one venue |
| 180 | **Partner adjusts venue based on rating dimensions:** While not strictly gaming, a partner can see exactly which dimensions are weighted highest (WiFi 20%, Ambiance 20%, F&B 20%) via the config file. They can prioritize investments accordingly. This is actually intended behavior. | L | N/A | Working as designed | No action needed |

### 6.2 Competitor Negative Rating

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 181 | **Competitor books rival venue sessions and rates 1/5:** A venue partner creates a coworker account, books sessions at a competing venue, and rates all dimensions 1/5. Cost: session price (or free with self-confirmed payment). | H | Low | Competitor score destruction | Detect anomalous all-1 ratings; flag accounts that rate one venue very differently from others |
| 182 | **Coordinated competitor attack:** Multiple accounts from a competitor all rate 1/5. With the score being a simple average (line 29-42 in 011), a few low ratings heavily impact venues with few reviews. | H | Moderate | Severe score damage for new venues | Require minimum review count before showing score; use trimmed mean |
| 183 | **Rating dimension targeting:** A competitor could strategically rate the heaviest dimensions (WiFi, Ambiance, F&B = 60% combined) as 1, while rating lighter dimensions normally, to appear more legitimate while still tanking the score. | M | Moderate | Targeted dimension attack | Detect per-dimension anomalies |

### 6.3 Rating Brigading

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 184 | **Social media call to action:** A disgruntled user or competitor posts on social media asking people to book a session at a venue and rate it negatively. | M | High | Coordinated score attack | Detect sudden rating drops; require minimum session history for venue ratings |
| 185 | **Venue rating without attendance:** Same as #112 -- check-in is not required for feedback. Users who never attended a venue can still rate it. | H | Trivial | Ghost venue ratings | Require check-in for venue ratings |
| 186 | **Venue rating from wrong venue:** The feedback endpoint associates venue ratings with the session's venue. But if a user books at Venue A and rates, the rating goes to Venue A regardless of whether the session actually took place at Venue A (e.g., venue change). | L | N/A | Edge case | No significant issue |
| 187 | **Simple average susceptibility:** `compute_venue_score` uses `avg()` (lines 30-37). With few reviews (e.g., 3), a single 1/5 rating drops the score by 33%. New venues are especially vulnerable. | H | Low | New venue vulnerability | Use Bayesian average with platform-wide prior |
| 188 | **Cleanliness weight exploitation:** Cleanliness is only 5% weight. A venue with terrible cleanliness but good everything else still scores well. This incentivizes ignoring cleanliness. | L | N/A (design) | Misaligned incentives | Adjust weights or use minimum thresholds per dimension |
| 189 | **Score includes all-time ratings:** No recency weighting. A venue that was great a year ago but has declined retains old high ratings. Conversely, a venue that improved is dragged down by old low ratings. | M | N/A (design) | Stale scores | Add recency decay; show trending direction |
| 190 | **venue_wifi IS NOT NULL filter:** The `compute_venue_score` function only includes feedback where `venue_wifi IS NOT NULL` (line 42). This means users who provide overall_rating but skip venue dimensions are excluded. This creates a selection bias -- engaged users who bother rating dimensions may skew differently from casual raters. | L | N/A (design) | Potential selection bias | Consider including feedback with partial dimensions |
| 191 | **No minimum reviews displayed:** The score is computed and displayed even with 1 review. A single 5/5 rating shows the venue as perfect. | M | Trivial | Misleading scores with low sample | Show "Not enough reviews" below N reviews; display review count prominently |
| 192 | **SECURITY DEFINER allows any venue scoring:** `compute_venue_score` can be called with any venue_id by any authenticated user. This isn't a manipulation vector but exposes all venue scores. | L | Trivial | Public venue data | Intended behavior for discovery |

---

## 7. Disintermediation Vectors

This section examines how users can bypass the platform after meeting through it.

### 7.1 Post-Session Contact Formation

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 193 | **In-person contact exchange:** During a 2-4 hour coworking session, users sit at the same table. Nothing prevents exchanging phone numbers, WhatsApp, Instagram, or LinkedIn during the session. | C | Trivial | Direct disintermediation | Cannot prevent; focus on value-add that makes platform worth using anyway |
| 194 | **WhatsApp group creation during session:** Group members can create a WhatsApp group during the session. Even with group rotation (anti-repetition), the WhatsApp group persists and members can coordinate off-platform sessions. | C | Trivial | Permanent off-platform channel | Group rotation reduces value of fixed WhatsApp groups; focus on fresh matching value |
| 195 | **LinkedIn/Instagram discovery from name + industry:** The group reveal shows display_name, work_type, and industry after check-in. With first name + industry in a specific area (HSR Layout, Bangalore), finding someone on LinkedIn or Instagram is trivial. | H | Trivial | Off-platform contact discovery | Show only first names; randomize industry display; use avatars only |
| 196 | **Profile page exposes work_type and industry:** The profile page (`app/dashboard/profile/page.tsx`) shows full work details. Combined with display_name, this is enough to find most people online. | H | Trivial | Identity discovery | Limit what is shown to non-group members |
| 197 | **Bio field for contact info:** The bio field (200 chars) could contain "Find me on Twitter @handle" or a phone number. Bio is visible after check-in. | H | Trivial | Direct contact sharing | Scan bio for contact patterns; redact |
| 198 | **Goals for contact info:** As noted in #170, session goals can embed contact details visible to the entire session. | H | Trivial | Contact sharing via goals | Content filter on goal_text |
| 199 | **Repeat meetings despite rotation:** Anti-repetition is -5 per co-grouping but can be overcome by +10 from collusion signals. Friends who want to meet again can force re-grouping. | H | Low | Rotation bypass | Hard cap on co-grouping frequency |
| 200 | **Venue as off-platform coordinator:** A venue partner knows which sessions are running at their space. They could facilitate off-platform meetups for a cut, bypassing the platform. | M | Moderate | Venue-mediated disintermediation | Contractual exclusivity; venue reputation incentives |

### 7.2 Direct Booking Incentives

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 201 | **Venue offers direct cheaper rate:** Platform charges `platform_fee + venue_price`. If users book directly with the venue, they save the platform_fee (100-150). Venue earns the same. Both parties benefit from disintermediation. | C | Trivial | Core revenue threat | Make platform value exceed platform_fee: matching, accountability, streaks, reputation |
| 202 | **Group self-organizes after meeting:** After meeting through the platform, a group of 3-5 can coordinate via WhatsApp to meet weekly at the same or different venues without the platform. | H | Trivial | Organic disintermediation | Non-portable reputation, streaks, and stats create switching cost |
| 203 | **Venue promotes direct booking:** Partner could subtly encourage users to "come back directly" during sessions. | M | Low | Partner-driven disintermediation | Mystery shoppers; contractual penalties; venue score tied to retention |
| 204 | **Subscription as disintermediation hedge:** Users on subscription plans (Explorer/Regular/Pro) have sunk cost. Leaving the platform means losing their subscription value. | L | N/A (design) | Intended retention mechanism | Working as designed |
| 205 | **Referral code for re-acquisition:** Even if users leave, their friends' referral codes can bring them back. The referral system serves as a re-acquisition channel. | L | N/A | Intended | Working as designed |

### 7.3 Social Network Discovery

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 206 | **Full name derivation:** display_name is shown as-is. Many users use their full real name. Post-checkin, `app/api/session/[id]/group/route.ts` shows the full display_name. Pre-checkin, only first name is shown (line 53: `split(" ")[0]`). | M | Trivial | Post-checkin full name exposure | Consider showing first name + last initial only |
| 207 | **Avatar URL as identity vector:** Avatar URLs from Supabase storage or external providers may contain identifiable paths or be reverse-searchable. | L | Moderate | Minor identity leak | Use platform-generated avatars |
| 208 | **Industry + location + name = unique identifier:** In a small area like HSR Layout, the combination of first name + industry + work_type is likely unique enough to find someone on professional networks. | H | Low | High identification probability | Reduce exposed attributes |
| 209 | **Group history as social network map:** With access to `group_history` (own records) and public `group_members`, a user can build a map of who meets whom. This is valuable intelligence for social engineering. | M | Low | Social network intelligence | Restrict group_members visibility |
| 210 | **Notification payload data:** Notifications (`013_notifications.sql`) have a JSONB payload that could contain session details, group member info, etc. If group_reveal notifications include member names, this is another data exposure vector. | M | Low | Data in notification payloads | Minimize PII in notification payloads |
| 211 | **Referral code as identity linkage:** Referral codes are derived from display_name (first 4 chars + random digits, `010_referrals.sql` line 44). The code prefix reveals part of the name. Combined with other data, this aids identification. | L | Low | Minor identity hint | Use fully random codes |
| 212 | **Favorite list as social intelligence:** A user's favorite list reveals their social preferences. While only visible to the user themselves (RLS), a compromised account exposes the user's social graph on the platform. | M | Moderate | Social graph exposure on compromise | Standard account security |
| 213 | **Session feedback comments as contact channel:** The feedback comment field could be used to leave messages for group members. While only the submitter can see their own feedback (RLS), partners can see all feedback for their sessions. A user could leave "Hey [name], add me on WhatsApp" knowing the partner can relay the message. | L | High | Unlikely but possible | Content moderation on comments |

### 7.4 Platform Value Erosion

| # | Vector | Severity | Effort | Impact | Remediation |
|---|--------|----------|--------|--------|-------------|
| 214 | **"First session free" referral arbitrage:** Referred users get first session free. Create a loop: User A refers User B, B uses free session to meet people, leaves platform. A gets 50 credit, B got free networking. | M | Low | Referral exploitation for one-time use | Require N sessions before referral credit; delay credit until referred user's 3rd session |
| 215 | **Free trial riders:** If any promotional pricing or free sessions exist, users attend once, exchange contacts, and never return. | M | Trivial | Acquisition cost with no retention | Gate full profile reveal behind 2+ sessions |
| 216 | **Low-commitment booking abuse:** Book a session, don't pay (payment is self-confirmed), check in remotely, maintain streak and stats without ever attending or paying. | C | Trivial | Comprehensive system abuse | Server-side payment verification is critical |

---

## 8. Platform Integrity as Competitive Moat

This section analyzes how addressing the above vulnerabilities creates compounding trust and network effects that serve as a competitive moat.

### 8.1 Non-Portable Value Creates Switching Costs

The platform stores user-specific data that cannot be replicated elsewhere:

1. **Coworker Score (reputation):** Built over dozens of sessions and hundreds of ratings. Cannot be transferred to another platform or direct meetups. File: `scripts/008_reputation.sql`.

2. **Streak history:** A 20-week streak represents 20+ weeks of consistent attendance. Breaking the streak to try alternatives has real psychological cost. File: `scripts/007_streaks.sql`.

3. **Trust tier status:** Reaching "Community Pillar" or "OG" requires 26-51+ sessions. This social proof is platform-specific. File: `lib/config.ts` lines 93-105.

4. **Group history & unique coworkers count:** "Met 47 unique coworkers" is a compelling stat that keeps users engaged. File: `scripts/006_profile_stats.sql`.

5. **Favorite coworkers network:** A curated list of preferred coworking partners that feeds back into matching. File: `scripts/008b_favorites.sql`.

### 8.2 Anti-Gaming Creates Trust

Every anti-gaming measure reinforces the platform's core value proposition: **trustworthy matching**.

| Anti-Gaming Measure | Trust Signal | Network Effect |
|---------------------|-------------|----------------|
| Verified check-ins | "Attendance numbers are real" | Higher-quality users attract more users |
| Anti-repetition | "I meet new people every time" | Expands social graph, increasing switching cost |
| Preference integrity | "My group actually matches my style" | Satisfaction drives word-of-mouth |
| Rating authenticity | "Reputation scores mean something" | Trusted users attract others who value trust |
| Streak verification | "Streaks represent real commitment" | Committed users create better sessions |

### 8.3 Compounding Network Effects

1. **More users = Better matching:** The grouping algorithm improves with pool size. Anti-gaming ensures pool quality.

2. **More sessions = Better rotation:** Anti-repetition only works with enough users to rotate. Growth makes the feature more effective.

3. **More ratings = Better reputation signal:** With minimum rating thresholds and anti-gaming, reputation becomes more meaningful at scale.

4. **More venues = Better discovery:** Venue scores become more reliable with more verified reviews, making venue selection more valuable.

5. **Cross-session social graph:** Each session creates 3-4 new connections in the platform's social graph. Over time, this graph becomes uniquely valuable for matching and cannot be replicated.

### 8.4 Priority Remediation for Moat Building

The following remediations should be prioritized not just for security, but because they directly strengthen the competitive moat:

| Priority | Remediation | Moat Impact |
|----------|-------------|-------------|
| **P0** | Server-side payment verification (#41, #83, #216) | All metrics become trustworthy |
| **P0** | Venue-based check-in verification (QR code) (#83, #86, #123) | Streaks, attendance, and reputation gain credibility |
| **P1** | Group membership verification for ratings (#105, #106, #156) | Rating integrity makes reputation meaningful |
| **P1** | Preference change rate limiting (#1, #8, #62) | Matching quality improves, reducing frustration |
| **P1** | Remove user access to matching_outcomes (#59) | Algorithm becomes harder to game |
| **P2** | Require check-in for feedback (#112, #135, #185) | Only real attendees affect scores |
| **P2** | Restrict group_members visibility (#58) | Reduces social network mining for disintermediation |
| **P2** | Content filter on goals and bio (#170, #197) | Reduces in-platform contact sharing |
| **P3** | Randomize seed selection (#19, #21, #52) | Reduces deterministic group manipulation |
| **P3** | Hard cap on co-grouping frequency (#25, #199) | Enforces rotation, expanding social graphs |
| **P3** | Bayesian averaging for venue scores (#187) | Protects new venues from brigading |

### 8.5 The "Game Theory of Trust" Argument

The strongest moat is not preventing all gaming, but making honest participation more rewarding than gaming:

- **Honest users** build real reputation, meet genuinely compatible coworkers, and accumulate non-portable value.
- **Gaming users** spend effort manipulating a system that yields diminishing returns as anti-gaming improves.
- **The platform** becomes the trusted intermediary: "Your donedonadone score means something because we verify it."

As the platform grows, the cost of gaming increases (more diverse pool = harder to control) while the value of honest participation increases (better matches, more connections, stronger reputation). This creates a virtuous cycle where integrity IS the product.

---

## Summary Statistics

| Category | Vectors Found | Critical | High | Medium | Low |
|----------|:---:|:---:|:---:|:---:|:---:|
| Grouping Algorithm | 82 | 3 | 15 | 38 | 26 |
| Streak System | 22 | 1 | 5 | 8 | 8 |
| Reputation/Rating | 49 | 4 | 12 | 18 | 15 |
| Favorites | 10 | 0 | 3 | 4 | 3 |
| Session Goals | 14 | 0 | 1 | 6 | 7 |
| Venue Scoring | 15 | 0 | 4 | 5 | 6 |
| Disintermediation | 24 | 3 | 5 | 10 | 6 |
| **Total** | **216** | **11** | **45** | **89** | **71** |

### Top 5 Critical Findings

1. **#41 — Self-confirmed payment enables zero-cost Sybil attacks:** `app/api/bookings/[id]/payment/route.ts` lines 51-92 allow users to mark their own payment as "paid" without server-side verification. This is the foundational vulnerability that enables most other attacks.

2. **#83 — No location verification for check-in:** `scripts/005_session_day.sql` check_in_user function validates time window but not physical presence. Combined with #41, enables fake attendance.

3. **#105 — No group membership verification for ratings:** `app/api/session/[id]/feedback/route.ts` lines 134-152 accept member_ratings for any user_id at the session, not just group members.

4. **#193 — In-person contact exchange is unavoidable:** Fundamental disintermediation risk inherent to any in-person matching platform. Mitigation is through value creation, not prevention.

5. **#201 — Direct venue booking saves platform fee:** Core revenue model vulnerability. Users and venues both benefit from bypassing the platform. Mitigation through non-portable value and matching quality.

---

*End of Red Team Report 04. This report covers business logic, anti-gaming, and platform integrity vectors for the donedonadone coworking platform.*
