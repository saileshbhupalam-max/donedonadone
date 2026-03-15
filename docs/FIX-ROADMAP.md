# DanaDone Fix Roadmap: From Fragile to Antifragile

> Derived from SYSTEMS-REVIEW.md. Organized by leverage — each fix is ranked by
> how many failure modes it addresses simultaneously.
>
> **Principle:** Via negativa — remove fragility before adding features.
> The best thing you can do for the product right now is NOT build new features.
> It's to make what exists reliable, trustworthy, and survivable.

---

## Phase 0: Pre-Launch Survival (Before first real user)

### 0.1 ✅ ARCHITECT: Move Business Logic to Server Side
**Fixes: F-04, F-07, F-14, F-15, F-25, F-29 | Leverage: HIGHEST | DONE 2026-03-15**

This is the single highest-leverage change. Every security and integrity failure
traces back to running business logic on the client with the anon key.

**What to do:**

1. **Create Edge Function: `award-credits`**
   - Move `awardCredits()` logic from `focusCredits.ts` to an Edge Function
   - Server-side daily cap enforcement, diminishing returns, idempotency
   - Client calls the Edge Function, never inserts into `focus_credits` directly
   - Add RLS: DENY INSERT on `focus_credits` for anon role (only service_role can write)
   - Add idempotency key (action + user_id + metadata hash + date) to prevent duplicates

2. **Create Edge Function: `create-auto-session`**
   - Move `onNewSessionRequest()` to Edge Function
   - Atomic: check cluster size + create event + RSVP users in a single transaction
   - Eliminates TOCTOU race condition (F-29)
   - Client submits session_request, Edge Function handles the rest

3. **Create RPC: `activate-venue`**
   - Move `activateVenue()` to a SECURITY DEFINER function
   - Only callable after `check_nomination_activation()` returns true
   - Client can't bypass the vouch threshold

4. **Create RPC: `evaluate-venue-health`**
   - Move `evaluateVenueHealth()` to server-side
   - Deactivation decision should not be client-controllable

5. **Standardize timezone handling**
   - All "today" / "this month" boundaries computed server-side using venue timezone
   - Client sends UTC timestamps, server interprets

**Implementation approach:**
- Phase in gradually: add Edge Functions, then add restrictive RLS, then remove client-side logic
- Keep client functions as thin wrappers that call the Edge Function
- Test by trying to exploit from browser console — if you can, it's not done

---

### 0.2 ✅ BOOTSTRAP: Solve the Empty Room Problem
**Fixes: F-01, F-02, F-18 | Leverage: HIGH | DONE 2026-03-15**

The product cannot launch with zero sessions. The auto-session system is for steady state, not cold start.

**What to do:**

1. **Admin-seeded sessions (immediate)**
   - Admin dashboard already has event creation
   - Create 2-3 sessions per day at seeded HSR Layout venues for the first 4 weeks
   - Mark as `admin_seeded: true` (add column) — never show "auto-created" label for these
   - Gradually reduce admin seeding as organic demand grows

2. **Guaranteed minimum sessions**
   - Add a `guaranteed: boolean` flag to events
   - Guaranteed sessions run even with 1 attendee (the admin/community manager attends)
   - This is the "loss leader" — the platform absorbs the cost of running near-empty sessions to build habit

3. **Lower the barrier for first session**
   - New user signs up → immediately show the next available session with "2 spots left" (social proof, even if admin-seeded)
   - Skip the "request a session" flow for new users — show them concrete, bookable sessions
   - The first-value gap should be: signup → see session → RSVP → attend tomorrow

4. **Neighborhood bootstrap override**
   - For the launch neighborhood (HSR Layout), skip the 10-member gate entirely
   - `getNeighborhoodReadiness()` should have a "bootstrap mode" where seeded neighborhoods are always unlocked
   - Add `is_bootstrapped: boolean` to `neighborhood_stats`

---

### 0.3 ✅ SAFETY NET: No-Show Consequences
**Fixes: F-09, F-12 | Leverage: HIGH | DONE 2026-03-15**

**What to do:**

1. **No-show FC penalty**
   - No-show without cancellation 2+ hours before: -20 FC
   - Late cancellation (< 2 hours): -10 FC
   - Call `spendCredits(userId, 'no_show_penalty', 20)` from the post-session Edge Function
   - If balance goes negative, user gets a warning. 3 negative sessions = account restriction

2. **Cancellation cascade**
   - When someone cancels and session drops below 3 attendees:
     a. Promote from waitlist immediately
     b. If still below 3 with 24h to go: notify remaining members "Session may be cancelled"
     c. If still below 3 with 2h to go: cancel session, notify everyone, remove from calendar
   - Add `minimum_attendees: int DEFAULT 3` to events table

3. **No-show visibility**
   - Show reliability score on member cards: "97% show-up rate" (green) or "60% show-up rate" (amber)
   - Poor reliability (< 70%) = lower priority in matching, not selected as captain
   - This creates social pressure without being punitive

---

### 0.4 IDENTITY: Add Email/Phone Auth
**Fixes: F-17 | Leverage: MEDIUM**

**What to do:**
- Enable Supabase email magic link (already supported, just needs enabling)
- Enable Supabase phone OTP (more relevant for Indian market)
- Update `AuthContext.tsx` to handle multiple auth providers
- Update onboarding to handle users without Google profile data

---

## Phase 1: First Week of Launch

### 1.1 DISTRIBUTION: WhatsApp Integration (MVP)
**Fixes: F-24 (partially) | Leverage: HIGH**

Don't build full WhatsApp automation. Start with:

1. **Pre-filled WhatsApp share links**
   - Every session detail page has a "Share on WhatsApp" button
   - Pre-filled message: "I'm coworking at [Venue] tomorrow at [Time]. Join me! [link]"
   - Already partially built in `sharing.ts` — just needs WhatsApp deep link

2. **WhatsApp group per session**
   - After groups are formed (24h before session), auto-generate a WhatsApp group invite link
   - Use `https://chat.whatsapp.com/` link format
   - Store in event metadata, show to group members
   - Manual for MVP: admin creates the group, pastes the link

3. **Post-session WhatsApp story card**
   - `ScrapbookCard` already generates shareable images
   - Add "Share to WhatsApp Status" button (uses WhatsApp share intent)

---

### 1.2 TRUST: Privacy Controls
**Fixes: F-20 | Leverage: MEDIUM**

**What to do:**
- Add `profile_visibility` enum to profiles: 'public' | 'session_only' | 'minimal'
  - `public`: anyone can see full profile
  - `session_only`: only people in your current/past sessions can see full profile
  - `minimal`: only display_name and work_vibe visible
- Default for women: `session_only`
- Add "Hide my neighborhood" toggle
- Add "Hide social links from non-connections" toggle
- These are simple RLS policy changes + UI toggles

---

### 1.3 ✅ RESILIENCE: Session Graceful Degradation
**Fixes: F-03, F-19 | Leverage: MEDIUM | DONE 2026-03-15**

**What to do:**

1. **Auto-captain fallback**
   - If designated captain doesn't check in by session start + 5 min, auto-promote the member with highest `events_attended`
   - Show "You've been promoted to captain for this session!" notification
   - The captain nudges should be shown to whoever is captain, not a pre-assigned person

2. **Late arrival handling**
   - "Current phase" indicator that shows what's happening NOW, not what was scheduled
   - Late arrivals join the current phase, not the beginning
   - Quick 30-second intro card for late arrivals: "Here's your group. They just finished [phase]."

3. **Small group mode**
   - If session has 2-3 people, automatically switch to "Focus Only" format
   - Skip icebreaker (awkward with 2), keep deep work blocks
   - Show a "Small group today — focused session!" message instead of pretending it's a full session

---

## Phase 2: Weeks 2-4

### 2.1 ✅ ECONOMY: Fix the FC System
**Fixes: F-08, F-21 | Leverage: HIGH | DONE 2026-03-15**

**What to do:**

1. **Wire FC redemptions to actual fulfillment**
   - "Free session" (100 FC) → creates a day_pass with status 'active', no payment needed
   - "Priority matching" (30 FC) → sets `priority_matching: true` on next RSVP
   - "Gift session" (100 FC) → generates a single-use invite link
   - Each redemption should produce a tangible, trackable result

2. **Tighten faucets**
   - Referral rewards: only award when referred user attends first session (not just signs up)
   - Cap all earning (not just contributions) at 75 FC/day total
   - Streak bonus: only once per month, require 5 sessions with check-in verified
   - taste_answer: cap at 6 FC/day (3 questions × 2 FC, currently uncapped)

3. **Add natural sinks**
   - Session boost: 15 FC to move up 1 spot in matching priority
   - "Buy a round" (virtual): 20 FC to give +5 FC to all group members after a session
   - Venue tip: 10 FC that converts to real-world benefit (venue gives free coffee, etc.)
   - These are social sinks — spending benefits others, creating positive feedback loops

4. **Monthly FC statement**
   - Show users their FC in/out balance
   - "You earned 320 FC this month. You spent 100 on a free session."
   - Makes the economy feel real and managed

---

### 2.2 MATCHING: Add Serendipity
**Fixes: F-23 | Leverage: MEDIUM**

**What to do:**
- `createSmartGroups()` currently optimizes for compatibility
- Add a "serendipity score" — bonus points for putting different-but-complementary people together
- Example: designer + founder (not same work_vibe, but founder's `looking_for` includes "design feedback")
- Add controlled randomness: 20% of group slots filled randomly, 80% by algorithm
- Track which "serendipitous" matches lead to connection requests — use this to improve the randomness

---

### 2.3 MONITORING: Basic Health Checks
**Fixes: F-27 | Leverage: MEDIUM**

**What to do:**
- Simple uptime check: Vercel cron that pings the app URL every 5 minutes
- Business metric alerts via Edge Function cron (daily):
  - Zero sessions created today → alert
  - Zero check-ins today → alert
  - Edge Function error rate > 5% → alert
- Send alerts to a Slack channel or admin email
- This doesn't need to be fancy — a daily summary email to founders is enough for launch

---

### 2.4 DATA: Expire and Clean Up
**Fixes: F-13, F-22 | Leverage: LOW**

**What to do:**
- Add `expires_at` to `session_requests` (default: 14 days from creation)
- `findDemandClusters()` filters to `expires_at > now()`
- Add venue reactivation: deactivated venues can be re-nominated after 90 days
- Add data retention policy: old analytics_events older than 1 year get archived

---

## Phase 3: Months 2-3 (Before Scaling)

### 3.1 VENUE: Partner Alignment
**Fixes: F-11 | Leverage: MEDIUM**

**What to do:**
- Partner agreement (even informal): venue commits to reserving N seats during session times
- Venue blocklist: venue can mark times as "no sessions" (e.g., Sunday brunch rush)
- Revenue sharing data: track how many new customers DanaDone sent, show in partner dashboard
- Venue feedback loop: post-session, venue rates the group (1-5, took too much space, too loud, etc.)

---

### 3.2 DATA: Privacy Compliance (DPDP Act)
**Fixes: F-30 (partially) | Leverage: MEDIUM**

**What to do:**
- User data export: "Download my data" button in profile settings
- Account deletion: "Delete my account" that cascades properly
- Consent management: record what the user agreed to and when
- Data retention policy documented
- These are legal requirements for operating in India

---

### 3.3 SCHEMA: Consolidation Sprint
**Fixes: F-16 | Leverage: LOW**

**What to do:**
- Audit all 78 tables. Identify unused tables (from Lovable era or abandoned features)
- Drop unused tables
- Add missing foreign key constraints (venue_health_checks.location_id → locations.id)
- Squash the 63 migration files into a single baseline migration
- Document every table's purpose in a schema dictionary
- This is unglamorous but prevents the "only the original developer understands the schema" trap

---

## The Meta-Principle: Build for the Barbell

Taleb's barbell strategy: be extremely conservative on the downside (don't lose users, don't break trust, don't run out of money) and extremely aggressive on the upside (the matching engine, the community rituals, the serendipity).

**What this means practically:**
- Phase 0 is all downside protection (security, bootstrapping, reliability)
- Phase 1 is minimum viable distribution (WhatsApp, privacy, resilience)
- Phase 2 is minimum viable economy (FC that works, matching that delights)
- Phase 3 is cleanup (before technical debt compounds)

**What NOT to build yet:**
- AI community manager (Phase 4 in current plan) — you don't have the data yet
- LLM-powered search — you don't have the users yet
- Cross-space network — you don't have multiple spaces yet
- Configurable session formats — one format is fine for launch
- Needs board / mentor matching — prove the core session works first

**The convex path:** Each session that happens successfully is a data point for matching, a data point for venue quality, a relationship formed, a story to share. Focus maniacally on making sessions happen and making them good. Everything else is premature optimization.

---

## Implementation Priority (Strict Order)

| Order | Item | Time Est. | Fixes |
|-------|------|-----------|-------|
| **0.1** | Move FC + auto-session to Edge Functions | 3-4 days | F-04, F-07, F-14, F-15, F-25, F-29 |
| **0.2** | Admin-seed sessions + bootstrap mode | 1 day | F-01, F-02, F-18 |
| **0.3** | No-show penalties + cancellation cascade | 2 days | F-09, F-12 |
| **0.4** | Email/phone auth | 1 day | F-17 |
| **1.1** | WhatsApp share links + group links | 1 day | F-24 |
| **1.2** | Profile privacy controls | 1 day | F-20 |
| **1.3** | Session graceful degradation | 2 days | F-03, F-19 |
| **2.1** | FC redemption fulfillment + tighter caps | 2-3 days | F-08, F-21 |
| **2.2** | Serendipity in matching | 1 day | F-23 |
| **2.3** | Basic monitoring + alerts | 1 day | F-27 |
| **2.4** | Data expiry + venue reactivation | 0.5 day | F-13, F-22 |
| **3.1** | Venue partner alignment tools | 2 days | F-11 |
| **3.2** | DPDP Act compliance | 2 days | F-30 |
| **3.3** | Schema consolidation | 2-3 days | F-16 |

**Total: ~20-22 days of focused work to go from fragile to robust.**

The goal is not to be antifragile on Day 1 — that's impossible. The goal is to be robust enough that the system survives contact with real users, and to have the feedback loops in place so that every failure makes the system stronger, not weaker.
