# DanaDone Systems Review: 30 Failure Modes

> **Framework:** Talebian thinking (fragility/antifragility, fat tails, skin in the game, via negativa) + Systems thinking (feedback loops, leverage points, phase transitions, emergent behavior).
>
> **Date:** March 2026
> **Status:** Pre-launch audit
>
> Each failure is rated on:
> - **Fragility class:** Fragile (breaks under stress) / Robust (survives) / Antifragile (improves)
> - **Tail risk:** Thin (predictable impact) / Fat (catastrophic, non-linear impact)
> - **Probability:** P1 (near-certain) / P2 (likely) / P3 (possible) / P4 (unlikely)
> - **Systemic reach:** How many other systems cascade when this fails

---

## Category A: Cold-Start Death Spirals

### F-01: The Empty Room Problem (Supply-Demand Chicken & Egg)
**Fragility: FRAGILE | Tail: FAT | Probability: P1 | Systemic reach: TOTAL**

The entire platform depends on a minimum viable density: 3+ people wanting to cowork at the same place, same time, same neighborhood. At launch with ~0 users, the probability of 3 strangers independently requesting the same slot approaches zero.

**The death spiral:** User signs up -> sees no sessions -> leaves -> fewer users -> even less likely to form a session -> repeat. This is the #1 killer of marketplace startups. The auto-session system (`MIN_CLUSTER_SIZE = 3`) is well-designed but assumes demand exists. With 0-50 users, it won't trigger.

**What the code does wrong:** `autoSession.ts` only creates sessions from organic demand clusters. There is NO mechanism for admin-seeded sessions, demo sessions, or "guaranteed minimum" sessions that run regardless of demand.

**Systemic cascade:** If sessions don't happen, the entire gamification stack (streaks, badges, ranks, FC economy) is inert. The venue nomination system can't activate (needs `events_attended >= 1` to vouch). The matching engine has no signal. Everything downstream dies.

---

### F-02: Venue Cold Start — The 10-Member Unlock Gate is a Trap
**Fragility: FRAGILE | Tail: FAT | Probability: P1 | Systemic reach: HIGH**

The permissionless growth system requires 10 members in a neighborhood before venues can be nominated. But members need a reason to sign up, and "there's nothing here yet" is the opposite of a reason.

**The trap:** 10 is too high for a new neighborhood (nobody will wait) and too low for abuse prevention (a single person with 10 accounts could unlock any area). The threshold serves neither purpose well.

**What the code does:** `venueNomination.ts:88-95` checks `getNeighborhoodReadiness()` and rejects nominations in locked neighborhoods. But `growthConfig.neighborhoodLaunchThreshold` is 10 — meaning the first 9 members in HSR Layout literally can't do anything except wait.

**The bootstrap paradox:** The README says "launching in HSR Layout" but there's no mechanism to pre-seed venues. The migration `20260315_seed_hsr_venues.sql` exists but it inserts into `locations` directly, bypassing the nomination system. This creates two classes of venues: seeded (unverified by community) and nominated (community-verified). The code never distinguishes between them.

---

### F-03: The Captain Dependency — Single Point of Human Failure
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

Every session depends on a table captain. `pickTableCaptain()` in `autoSession.ts` selects one. But:
1. What if the captain doesn't show up?
2. What if the captain is bad at facilitating?
3. What if there are no captains (new neighborhood, all beginners)?

`antifragile.ts` has `CAPTAIN_NUDGES` for guidance but no fallback if the captain is absent. The icebreaker phase, social break facilitation, and wrap-up all assume someone is steering.

**What should be antifragile:** The session experience should degrade gracefully without a captain, not collapse. Currently the UI shows nudges to a person who may not be there.

---

## Category B: Security & Trust Failures

### F-04: Focus Credits Economy Runs on Client-Side Trust
**Fragility: FRAGILE | Tail: FAT | Probability: P2 | Systemic reach: HIGH**

**This is the single most dangerous architectural flaw.** The entire FC economy — awarding, spending, balance checks, diminishing returns, daily caps — runs through `focusCredits.ts` on the **client side** using the **anon key**.

A technically competent user can:
- Call `supabase.from('focus_credits').insert(...)` directly from browser console
- Award themselves unlimited credits
- Bypass all caps and diminishing returns (those are JS logic, not DB constraints)
- Redeem "free sessions" or "priority matching" that cost real FC

**What's missing:** No server-side validation. No DB-level constraints on FC inserts. No RLS policy that limits insert amounts. The `awardCredits()` function's caps are *aspirational* — they only work if everyone uses the function.

**Taleb would say:** This is a system where the downside is unbounded (infinite FC minting) and the upside is zero (correct behavior). Classic fragility.

---

### F-05: Check-In Geolocation is Spoofable
**Fragility: FRAGILE | Tail: THIN | Probability: P3 | Systemic reach: LOW**

`CheckInButton.tsx` sends client-reported lat/lng to `checkin_with_location` RPC. GPS coordinates can be spoofed trivially on Android (developer mode) or iOS (location simulation). The PIN fallback is also just a 4-6 digit code that could be shared.

**Impact:** Fake check-ins inflate venue stats, earn undeserved FC, and corrupt the "Who's Here" social proof.

**Why it matters less than F-04:** Check-in fraud is low-value (small FC amounts) and self-correcting (other members will notice someone isn't actually there). But at scale, it erodes trust in the venue contribution system.

---

### F-06: Nomination Ring Detection is Reactive, Not Preventive
**Fragility: ROBUST | Tail: THIN | Probability: P3 | Systemic reach: MEDIUM**

`venueNomination.ts` has `detectNominationRings()` — but it's a detection function, not a prevention function. It finds rings after they've already gamed the system. The 3-vouch threshold is low enough that 4 colluding accounts can activate any venue.

**The actual attack:** Create 4 accounts. User A nominates a venue, Users B/C/D vouch. User B nominates, Users A/C/D vouch. Four fake venues activated, each earning 60 FC (30 nominate + 30 activation) for the nominator.

**What's missing:** The `events_attended >= 1` quality gate on vouching is good, but:
1. It doesn't apply to the nominator
2. It doesn't check if the voucher actually visited the nominated venue
3. There's no rate limiting on nominations per user per time period

---

### F-07: Auto-Session Creation Uses anon Key — Privilege Escalation
**Fragility: FRAGILE | Tail: FAT | Probability: P2 | Systemic reach: HIGH**

`autoSession.ts` creates events, RSVPs, and notifications using the browser Supabase client (anon key). This means:
1. The user's browser is creating events on behalf of the system
2. RLS policies must allow authenticated users to create events (they shouldn't)
3. A user could craft requests to create arbitrary events

The Edge Function `auto-sessions/index.ts` correctly uses service_role_key, but the client-side `onNewSessionRequest()` duplicates this logic with the wrong privilege level.

---

## Category C: Economic & Incentive Failures

### F-08: FC Economy Has No Sink — Hyperinflation Inevitable
**Fragility: FRAGILE | Tail: FAT | Probability: P1 | Systemic reach: HIGH**

The FC economy has many faucets (session complete, rate group, rate venue, write review, upload photo, referral, streak bonus, great groupmate, venue nomination, verification, check-in photo, various venue data reports) and the sinks are theoretical (free session costs 100 FC, but `spendCredits` is only called from the Credits page UI — and those redemptions aren't wired to actual fulfillment).

**The math problem:**
- Active user earns ~50 FC/day (daily cap)
- Monthly earning: ~1,500 FC
- Free session costs 100 FC → user can "redeem" 15 free sessions/month
- But there's no actual fulfillment — the redeem button inserts a negative ledger entry but doesn't create a booking, doesn't generate a code, doesn't notify anyone

**Taleb's take:** A currency with infinite supply and no redemption mechanism is not a currency — it's a toy. Users will either ignore it entirely (making the whole gamification stack pointless) or be frustrated when they try to spend it and nothing happens.

**Daily cap of 50 FC is also easily gamed:** The cap only applies to `CONTRIBUTION_ACTIONS`. Session completion (10 FC), ratings (5+5 FC), streak bonuses (25 FC), referrals (50 FC), taste answers — all bypass the daily cap. A user could earn 100+ FC/day through non-contribution actions alone.

---

### F-09: No Penalty for No-Shows — The Tragedy of the Commons
**Fragility: FRAGILE | Tail: THIN | Probability: P1 | Systemic reach: HIGH**

`updateReliability()` tracks no-shows via RPC, but:
1. There's no consequence visible to the user
2. No-shows don't lose FC
3. No-shows aren't barred from future sessions
4. The `reliability_status` field on profiles is computed but never used for access control

**The systemic risk:** In a group of 4, one no-show ruins the session for 3 people. If 25% of RSVPs no-show (typical for free events), most sessions have at least one absent member. The session format (icebreaker → deep work) doesn't work with 2 people.

**What's antifragile:** A system where no-shows make the remaining group bond harder. But that requires the group to be big enough (4-5) that losing 1 is survivable. With groups of 3 (the minimum), 1 no-show kills the social dynamic.

---

### F-10: Free Tier is Too Generous — No Reason to Pay
**Fragility: FRAGILE | Tail: FAT | Probability: P1 | Systemic reach: TOTAL**

TD-001 (no payment integration) means everyone is free tier. But even when payment works, the free tier includes:
- Unlimited sessions (with monthly cap not enforced until payment exists)
- Full matching
- Full gamification
- Community features

**The pricing question nobody has answered:** What is the free tier? What's gated behind Plus/Pro/Max? If the core value (showing up to a cafe with 3 strangers) is free, what exactly are people paying for?

The `FeatureGate` component exists and checks subscription tiers, but the gates are on nice-to-haves (cross-space network, advanced matching), not on the core action (booking a session).

---

### F-11: Venue Partners Have No Skin in the Game
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

The "irresistible partner offer" is: everything free for Year 1. Venues provide the space, DanaDone provides the tech. But:
1. No contract or commitment
2. No data on whether sessions actually drive revenue for venues
3. No mechanism for venue to communicate preferences (quiet hours, max group size, no-go areas)
4. No way for venue to block sessions during busy periods

**Taleb's skin in the game:** If venues have zero downside from being listed, they have zero incentive to provide a good experience. A cafe that gets 4 noisy coworkers during their lunch rush will just stop cooperating — and there's no mechanism to detect or prevent this.

---

## Category D: Operational & Scaling Failures

### F-12: No Cancellation Cascade — Session With 2 People
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

When someone cancels RSVP, `toggleRsvp` updates their status but doesn't check if the session is now below minimum viable size. A 4-person session where 2 cancel becomes a 2-person "coworking session" — which is just two strangers awkwardly sitting together.

**What's needed:** A cancellation threshold that triggers: (a) waitlist promotion, (b) notification to remaining members, (c) potential session cancellation if below minimum 24h before.

---

### F-13: Stale Session Requests Never Expire
**Fragility: ROBUST | Tail: THIN | Probability: P2 | Systemic reach: LOW**

`session_requests` with status `pending` live forever. `findDemandClusters()` queries ALL pending requests regardless of age. A request from 3 months ago still counts toward a cluster.

**The failure mode:** 2 requests from January + 1 request today = cluster triggered. User from January gets auto-RSVP'd to a session they forgot they wanted.

**Missing:** No `expires_at` on session_requests, no age filter in `findDemandClusters()`.

---

### F-14: Timezone Blindness — Everything is Browser-Local
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

`focusCredits.ts` uses `new Date()` for `todayStart()` and `monthStart()` — these are browser-local time. The DB stores `timestamptz` (UTC). A user in IST (UTC+5:30) doing actions at 11:30 PM has their "today" counter reset differently than someone at 12:30 AM.

**The real issue:** Daily caps, streak calculations, and "this month" boundaries all use client-side date logic compared against server-side timestamps. This creates exploitable gaps where users in different timezones have different cap resets.

**For Bangalore-only launch:** Low risk. For international expansion (the stated plan): this breaks completely.

---

### F-15: No Idempotency on Critical Operations
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

`awardCredits()`, `nominateVenue()`, `vouchForVenue()` — none have idempotency guards. If a network hiccup causes a retry, the user gets double credits, double nominations, double vouches.

The `isTogglingRef` mutex on RSVP (TD-014 fix) only prevents client-side double-clicks. It doesn't prevent server-side duplicates from slow networks.

**Existing partial fix:** Vouch has a UNIQUE constraint `(nomination_id, user_id)`. But FC awards have no dedup — two identical insert calls both succeed.

---

### F-16: 78 Tables, 60+ Migrations — Schema Complexity is a Time Bomb
**Fragility: FRAGILE | Tail: FAT | Probability: P3 | Systemic reach: TOTAL**

The database has 78 tables and 63 migration files. Many migrations have UUID filenames with no indication of what they do. The schema is the product of rapid iteration, not deliberate design.

**Taleb's Lindy effect:** Complex systems with many interdependencies are fragile. A schema change to `profiles` (64 fields) cascades through virtually every feature. No foreign key from `venue_health_checks.location_id` to `locations.id` (it's just a uuid, no constraint). The `events` table uses both `venue_id` and `location_id` fields inconsistently.

**What's antifragile:** A schema that's simple enough to hold in one person's head. 78 tables for a pre-launch product is a maintenance liability.

---

## Category E: User Experience Failures

### F-17: Google OAuth is the Only Auth Method — Single Point of Failure
**Fragility: FRAGILE | Tail: FAT | Probability: P3 | Systemic reach: TOTAL**

`AuthContext.tsx` only handles Google OAuth (PKCE flow). If Google's OAuth service has an outage, or if Google changes their OAuth policies, or if a user doesn't have/want a Google account — the entire platform is inaccessible.

**India-specific risk:** Many potential users in Bangalore use phone numbers as primary identity, not Google accounts. WhatsApp login or phone OTP would reach more of the target market.

**Memory note:** `project_email_auth.md` lists email magic link as TODO. This should be prioritized as a safety net.

---

### F-18: Onboarding Asks Too Much, Delivers Too Little
**Fragility: FRAGILE | Tail: THIN | Probability: P1 | Systemic reach: HIGH**

A new user's journey: Sign up → 4-step onboarding → arrive at Home → see... what? If there are no upcoming sessions (F-01), no nearby venues (F-02), and no members to match with — the home page is empty.

**The first-value gap:** The time between signup and first moment of value is potentially infinite (waiting for a session to form). Compare to: Uber (value in 5 minutes), Instagram (value in 30 seconds of scrolling), WhatsApp (value when first friend joins).

**What Quick Questions do wrong:** They collect data but don't deliver value. Answering "Coffee or chai?" earns 2 FC but doesn't give the user anything they care about. Data collection should be a side effect of value delivery, not the main event.

---

### F-19: The "Session Day" Experience Assumes Perfect Conditions
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

The session flow (check-in → group reveal → icebreaker → deep work → break → deep work → wrap-up) assumes:
1. Everyone arrives on time
2. The venue has the right setup
3. The captain does their job
4. Nobody leaves early
5. WiFi works
6. The group size is exactly right

Real-world sessions will have: late arrivals (icebreaker already done), early leavers (wrap-up incomplete), venue problems (claimed table taken), group imbalances (2 people instead of 4).

**No graceful degradation:** The phase timer system doesn't handle a session that starts late. If check-in opens at 9:00 but the last person arrives at 9:20, do they miss the icebreaker? The UI doesn't handle this.

---

### F-20: Profile Data is Public by Default — Privacy Risk
**Fragility: FRAGILE | Tail: FAT | Probability: P3 | Systemic reach: HIGH**

Profiles are readable by any authenticated user (standard Supabase RLS for social apps). But the profile contains: `what_i_do`, `looking_for`, `can_offer`, `company_name`, `linkedin_url`, `instagram_handle`, `twitter_handle`, `neighborhood`.

**India-specific risk:** Women's safety is a major concern. Knowing that a specific woman coworks at a specific cafe at a specific time, combined with her social media handles, is a stalking vector. The `women_only` session flag exists but profile visibility doesn't consider gender-based risk.

**What's missing:** No profile visibility controls. No way to hide your neighborhood. No way to limit who sees your social links. No "appear offline" mode.

---

## Category F: Growth & Marketplace Failures

### F-21: The Referral System Rewards Quantity Over Quality
**Fragility: ROBUST | Tail: THIN | Probability: P2 | Systemic reach: LOW**

`referral.referrerCredits = 50 FC` for every referral. `maxReferralRewards = -1` (unlimited). There's no quality gate — the referred user doesn't need to attend a session, complete onboarding, or be a real person.

**The abuse case:** User refers 100 fake email accounts, earns 5,000 FC. Even with email verification, there's no check that the referred user is a real human who will actually attend sessions.

**What makes referrals antifragile:** Only reward when the referred user attends their first session. This aligns incentives: the referrer is motivated to ensure the referee actually shows up.

---

### F-22: Permissionless Growth System Has No Reactivation Path
**Fragility: FRAGILE | Tail: THIN | Probability: P3 | Systemic reach: LOW**

`evaluateVenueHealth()` can deactivate venues, but there's no reactivation flow. If a venue gets 3 bad health checks during a temporary issue (renovations, temporary closure), it's permanently deactivated.

**Missing:** A "re-nomination" path or cool-down period where deactivated venues can be reinstated.

---

### F-23: The Matching Algorithm Optimizes for Similarity, Not Serendipity
**Fragility: ROBUST | Tail: THIN | Probability: P2 | Systemic reach: MEDIUM**

`matchUtils.ts` scores match compatibility by awarding points for same work_vibe (20), same neighborhood (15), looking_for matching can_offer (15), same interests (5). This creates filter bubbles — you only meet people like you.

**The product vision says:** "Serendipity-preserving: Structured matching with enough randomness that unexpected connections happen." But the algorithm has zero randomness component.

**The antifragile approach:** Intentionally introduce cross-pollination. Put a designer with founders. Put a veteran with newcomers. The most valuable connections are often the least predicted ones.

---

### F-24: WhatsApp Integration is Manual — The Critical Distribution Gap
**Fragility: FRAGILE | Tail: FAT | Probability: P1 | Systemic reach: HIGH**

India runs on WhatsApp. The docs mention "manual first, then automation" but there's no WhatsApp integration at all. Session reminders, group formation, post-session sharing — all of this should have WhatsApp as the primary channel.

**The distribution gap:** If someone RSVPs and doesn't open the app before the session, they get zero reminders (TD-003). In India, the notification that will actually reach them is a WhatsApp message, not a push notification.

---

## Category G: Technical Architecture Failures

### F-25: Client-Side Business Logic — The Fundamental Architecture Problem
**Fragility: FRAGILE | Tail: FAT | Probability: P1 | Systemic reach: TOTAL**

This is the meta-failure that amplifies F-04, F-07, F-14, and F-15. Business-critical logic runs in the browser:
- FC awarding with caps and diminishing returns (`focusCredits.ts`)
- Auto-session creation (`autoSession.ts` `onNewSessionRequest()`)
- Venue activation (`venueNomination.ts` `activateVenue()`)
- Health check evaluation (`venueHealthCheck.ts` `evaluateVenueHealth()`)

All of this uses the anon key Supabase client. The only trust boundary is RLS policies, which gate row-level access but can't enforce business logic (daily caps, diminishing returns, cluster thresholds).

**Taleb's barbell strategy:** Move ALL business logic to Edge Functions (server-side, service_role). Keep the client thin — it should only read data and call RPCs. This is the single highest-leverage architectural change.

---

### F-26: No Rate Limiting on API Calls — DDoS by Enthusiasm
**Fragility: FRAGILE | Tail: THIN | Probability: P3 | Systemic reach: MEDIUM**

The Supabase client has no rate limiting beyond the `isTogglingRef` on RSVP. A misbehaving client (buggy infinite loop, or malicious) can hammer the DB with unlimited queries.

**Existing protection:** Supabase Pro has some built-in rate limiting, but it's at the project level, not per-user. A single bad actor can exhaust the rate limit for everyone.

---

### F-27: No Health Monitoring or Alerting
**Fragility: FRAGILE | Tail: FAT | Probability: P2 | Systemic reach: TOTAL**

Sentry captures errors, but there's no:
- Uptime monitoring (is the site up?)
- API latency tracking (are Supabase queries slow?)
- Business metric alerting (zero sessions created today? Zero check-ins?)
- Edge Function failure tracking
- Database connection pool monitoring

**The silent failure:** If the auto-session Edge Function cron stops running, nobody knows until users complain that sessions aren't being created. If Supabase has a partial outage affecting only writes, reads still work and the site appears functional.

---

### F-28: PWA Offline Mode Creates Stale State
**Fragility: FRAGILE | Tail: THIN | Probability: P2 | Systemic reach: LOW**

The PWA caches Supabase API responses (NetworkFirst, 5-min cache). But session state changes rapidly on session day (check-ins, phase transitions, props). A user on spotty WiFi at a cafe could see stale group assignments or miss the phase transition.

**The specific scenario:** User opens app, sees "Icebreaker Phase." WiFi drops. They're in cache mode. The group has moved to "Deep Work Block 1" but the user still sees icebreaker questions. When WiFi returns, the state jump is jarring.

---

## Category H: Data Integrity & Consistency Failures

### F-29: Race Condition in Demand Clustering
**Fragility: FRAGILE | Tail: THIN | Probability: P3 | Systemic reach: LOW**

`onNewSessionRequest()` is called from the client after inserting a session_request. If two users submit the 3rd and 4th requests simultaneously:
1. Both clients read `requests.length` as 3 (the minimum)
2. Both trigger session creation
3. Two identical auto-sessions get created for the same cluster

The `demand_cluster_key` uniqueness check (`existing` query at line 376) runs on the client with a gap between read and write — classic TOCTOU race condition.

**Fix:** The cluster check and event creation should be a single atomic DB transaction in an Edge Function or RPC, not client-side read-then-write.

---

### F-30: No Data Backup or Recovery Strategy
**Fragility: FRAGILE | Tail: FAT | Probability: P4 | Systemic reach: TOTAL**

Supabase Pro includes automatic daily backups, but there's no:
- Point-in-time recovery tested
- Backup verification (can we actually restore?)
- Cross-region backup
- Application-level data export
- User data portability (GDPR/India DPDP Act compliance)

**The fat tail:** A catastrophic data loss event (Supabase outage, accidental migration, database corruption) with no tested recovery process could destroy the business.

**India-specific:** The Digital Personal Data Protection Act 2023 requires data portability and erasure rights. There's no mechanism for a user to export their data or request deletion.

---

## Summary: The Fragility Map

### Catastrophic (address before launch):
| # | Failure | Why it's fatal |
|---|---------|---------------|
| F-01 | Empty room problem | No sessions = no product = no retention |
| F-04 | Client-side FC economy | Unlimited minting destroys all incentive systems |
| F-07 | Client-side auto-session | Privilege escalation, unauthorized event creation |
| F-09 | No no-show penalty | Ruins sessions for everyone, erodes trust |
| F-10 | No payment = no revenue | Business can't survive |
| F-25 | Client-side business logic | Amplifies all other security/trust failures |

### Serious (address within 2 weeks of launch):
| # | Failure | Why it matters |
|---|---------|---------------|
| F-02 | Venue cold start gate | Blocks permissionless growth in new neighborhoods |
| F-08 | FC hyperinflation | Gamification becomes meaningless |
| F-12 | No cancellation cascade | Sessions with 2 people = bad experience |
| F-17 | Google-only auth | Excludes users, single point of failure |
| F-18 | First-value gap | Users churn before experiencing the product |
| F-24 | No WhatsApp | Missing the #1 communication channel in India |

### Important (address within first month):
| # | Failure | Why it matters |
|---|---------|---------------|
| F-03 | Captain dependency | Session quality depends on one person |
| F-05 | Spoofable check-in | Erodes venue data integrity |
| F-06 | Ring detection reactive | Bad venues get activated before caught |
| F-13 | Stale session requests | Ghost demand creates bad sessions |
| F-14 | Timezone blindness | Breaks for international users |
| F-15 | No idempotency | Double-awards on network retry |
| F-20 | Privacy risk | Women's safety concern in Indian market |
| F-23 | No serendipity | Filter bubbles reduce value of connections |
| F-29 | Race condition in clustering | Duplicate auto-sessions |

### Background (address before scaling):
| # | Failure | Why it matters |
|---|---------|---------------|
| F-11 | Venues no skin in game | No incentive to provide good experience |
| F-16 | Schema complexity | Maintenance burden grows non-linearly |
| F-19 | Session assumes perfection | No graceful degradation for real-world chaos |
| F-21 | Referral quantity over quality | FC drain from fake referrals |
| F-22 | No venue reactivation | Permanent deactivation is too harsh |
| F-26 | No rate limiting | Vulnerable to abuse or bugs |
| F-27 | No monitoring | Silent failures until users complain |
| F-28 | PWA stale state | Confusing UX on session day |
| F-30 | No backup strategy | Catastrophic but unlikely |
