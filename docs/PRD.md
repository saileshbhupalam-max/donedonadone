# FocusClub — Product Requirements Document

> Version: 1.0 (derived from codebase audit, March 2026)
> Status: Living document — reflects what IS built + what SHOULD be built

---

## 1. Product Overview

### What is FocusClub?
FocusClub matches solo workers into groups of 3-5 at partner cafes and coworking spaces. Users RSVP to structured or casual sessions, get grouped with compatible people, cowork together, and build relationships over time.

### Value Proposition
- **For coworkers:** Accountability, community, and structure for solo workers who want the energy of a team without the commitment of an office.
- **For venue partners:** Predictable foot traffic, recurring customers, and community marketing.
- **For the platform:** Per-session revenue (platform fee) + subscription tiers.

### Target Market
- **Geography:** HSR Layout, Bangalore (launch market)
- **Users:** Freelancers, remote workers, startup founders, students, creators
- **Scale target:** 1,000 bookings/day

### Revenue Model
- Per-session pricing: Platform takes Rs.100 (2hr) / Rs.150 (4hr). Venue sets their price.
- Subscription tiers: Free, Plus (Rs.299/mo), Pro (Rs.599/mo), Max (Rs.999/mo)
- Session Boost: Rs.99 for 24-hour tier upgrade

---

## 2. User Types

| Type | Description | Implementation Status |
|------|-------------|----------------------|
| **Coworker** | Primary user. Books sessions, coworks, gives props. | Fully implemented |
| **Venue Partner** | Cafe/coworking space owner. Lists venue, hosts sessions. | Partially implemented (no self-serve, no dashboard) |
| **Admin** | Community manager. Creates events, manages groups/prompts. | Partially implemented (basic admin, no moderation tools) |

---

## 3. Core User Flows

### 3.1 Signup & Onboarding

**Current implementation:**
- Google OAuth only (via Supabase Auth)
- 4-step onboarding: Identity → Work Preferences → Give & Get → Confirmation
- Profile completion tracked (0-100%)
- Referral processing on signup

**What's built:**
- [x] Google OAuth sign-in
- [x] 4-step onboarding wizard with progress persistence (localStorage)
- [x] Profile fields: name, avatar, tagline, what I do, work vibe, communication style, noise preference, looking for, can offer
- [x] Referral code processing and badge award
- [x] Redirect logic: new user → onboarding, returning → home

**What's missing:**
- [ ] Email/password auth option
- [ ] Apple sign-in
- [ ] Neighborhood selection during onboarding
- [ ] Session format/duration explanation during onboarding
- [ ] "How it works" content (what a session looks like)

### 3.2 Session Discovery & Booking

**Current implementation:**
- Events page with Upcoming/Past tabs
- Filters: All, Neighborhood (dynamic), Women Only (conditional)
- Event cards with social proof (avatars, circle members, attendance progress)
- RSVP/cancel/waitlist flow
- Intention setting at RSVP time (structured sessions)
- Add to calendar (Google/ICS)
- Session request form for underserved areas

**What's built:**
- [x] Event listing with date filtering
- [x] Neighborhood filtering (dynamic from DB)
- [x] Women-only filter (conditional on user gender)
- [x] RSVP with optimistic UI and realtime count
- [x] Waitlist with position tracking
- [x] Low attendance warning with nearby session suggestions
- [x] Session request form (neighborhood, days, times)
- [x] Map view with distance sorting
- [x] Popularity labels ("Almost full", "Filling fast", etc.)

**What's missing:**
- [ ] Session format/duration filter
- [ ] Neighborhood default from user profile
- [ ] Pre-session reminders (push notification 24hr, 1hr)
- [ ] Price display on session cards
- [ ] Women-only RSVP enforcement (server-side)
- [ ] Booking limits enforcement (per subscription tier)

### 3.3 Session Experience (Structured Format)

**Current implementation:**
- Pre-start: GroupReveal + CheckIn (geo or PIN) + phase preview
- During: Phase timer + traffic light status + icebreakers + captain nudges
- Social break: Energy check, photo moment, skill swap suggestions
- Wrap-up: Intention accomplishment → props → cowork-again → venue rating → scrapbook

**What's built:**
- [x] Two structured formats: 4hr (5 phases, 240min) and 2hr (5 phases, 120min)
- [x] Casual format (no phases, free-form)
- [x] Group reveal (tablemate cards)
- [x] Geolocation check-in with PIN fallback
- [x] Phase-by-phase timer with auto-advance
- [x] Traffic light status sync (realtime)
- [x] Icebreaker engine (4 round types, adaptive depth)
- [x] Energy check (battery level, group average)
- [x] Photo moment capture + storage
- [x] Captain nudges per phase
- [x] Session wrap-up flow (5 sequential components)

**What's missing:**
- [ ] Skip mechanism for wrap-up flow ("quick rate and go")
- [ ] DND/focus mode (persist through phases)
- [ ] Captain tools (announce, extend/skip phase)
- [ ] First-timer session explainer
- [ ] Check-in PIN visibility for attendees
- [ ] Group notification when groups are formed

### 3.4 Post-Session & Retention

**Current implementation:**
- Feedback card (emoji rating + comment)
- Props system (6 types, anonymous option, echo delay mechanic)
- Cowork-again selections (builds circle for matching)
- Venue vibe rating (5 categories)
- Scrapbook auto-generation
- Weekly digest (Mondays)
- Community rituals (Monday Focus, Friday Wins)
- Gratitude echoes (delayed prop delivery)
- Streak tracking with warning cards
- Badge system (17 badges)
- Rank system (6 tiers based on focus hours)
- Milestone celebrations (22 milestones)
- Re-engagement notifications (7/10/14 day thresholds)

**What's built:**
- [x] Full feedback + props + venue rating flow
- [x] Cowork-again → circle formation
- [x] Session scrapbook with sharing
- [x] 17 badge definitions with auto-award
- [x] 6-rank system with rank-up notifications
- [x] 22 milestones with share messages
- [x] Weekly digest on Mondays
- [x] Community rituals (Monday/Friday)
- [x] Gratitude echo (30% props delayed)
- [x] Re-engagement at 7/10/14 days

**What's missing:**
- [ ] Streak insurance (DB field exists, no UI to use it)
- [ ] Email digest delivery
- [ ] WhatsApp re-engagement messages
- [ ] Post-session email summary
- [ ] Shortened feedback path option

### 3.5 Social & Discovery

**Current implementation:**
- Discover page: People (active locations, suggested connections, your connections) + Companies
- Profile viewing with match scoring
- Connection requests
- Prompt-of-the-week with fire reactions
- Circle (mutual cowork-again picks)
- Referral system with code sharing

**What's built:**
- [x] Match scoring algorithm (work vibe, neighborhood, skills, interests, noise, comm style)
- [x] Suggested connections sorted by match score
- [x] Active locations (who's working where)
- [x] Connection request/accept flow
- [x] Community prompts with answers and fire reactions
- [x] Profile completion nudges (progressive, milestone-gated)
- [x] Referral code generation and tracking
- [x] Company directory with matching

**What's missing:**
- [ ] Direct messaging between members
- [ ] Buddy pre-introduction messaging
- [ ] "People in your neighborhood" section on Home
- [ ] Prompt scheduling (admin queues future prompts)

### 3.6 Subscription & Payments

**Current implementation:**
- 4 tiers defined in DB: Free, Plus, Pro, Max
- Feature gating infrastructure (tier_features, tier_limits tables)
- Subscription hook with realtime updates
- Pricing page with tier comparison
- Session Boost concept (24hr upgrade)

**What's built:**
- [x] Subscription DB schema (tiers, features, limits, user_subscriptions)
- [x] `useSubscription` hook with `hasFeature()` and `getLimit()`
- [x] Pricing page UI with all 4 tiers
- [x] Session Boost UI concept
- [x] Tier badge display in TopBar
- [x] RPC `get_effective_tier()` with boost logic

**What's NOT built:**
- [ ] Payment processor integration (UPI QR, Razorpay, or Stripe)
- [ ] Actual feature enforcement at RSVP/action level
- [ ] Subscription management (cancel, downgrade)
- [ ] Invoice/receipt generation
- [ ] Venue partner revenue share
- [ ] Session pricing display and collection

### 3.7 Venue Partner Experience

**Current implementation:**
- Partners page (read-only showcase)
- Contact via WhatsApp CTA
- Venue vibe crowdsourcing (post-session)

**What's built:**
- [x] Partner venue display with ratings
- [x] Venue fields on events (name, address, coords, partner link)
- [x] Venue vibe rating collection
- [x] Venue vibe summary display

**What's NOT built:**
- [ ] Venue partner self-serve registration
- [ ] Venue dashboard (upcoming sessions, headcount, revenue)
- [ ] Session approval/reject by venue
- [ ] Capacity and blackout date management
- [ ] Revenue reporting for venues

### 3.8 Admin & Operations

**Current implementation:**
- Admin page with tabs: Overview, Members, Events, Prompts, Settings (+13 more)
- Smart group creation algorithm
- Manual settings key-value editor
- CSV member export

**What's built:**
- [x] Admin gate by email allowlist
- [x] Member search, sort, CSV export
- [x] Event management + smart group creation
- [x] Prompt management (create, activate, notify)
- [x] Key-value app settings editor
- [x] Overview stats (members, events, prompts)

**What's NOT built:**
- [ ] Flag review and moderation UI
- [ ] Member suspension/ban tools
- [ ] Group preview/edit before saving
- [ ] Prompt scheduling queue
- [ ] Settings with labels and documentation
- [ ] Admin access via DB role (currently hardcoded email list)
- [ ] Operational analytics (conversion funnel, retention cohorts)

---

## 4. Technical Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite SPA + TypeScript |
| UI | shadcn/ui + Tailwind CSS + Framer Motion |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions, Realtime) |
| Hosting | Vercel (static SPA) |
| Maps | Leaflet + React Leaflet |
| State | React Context (Auth, Subscription, FeatureFlags, Personality) |

### Database (Key Tables)
```
profiles          — User profiles with all preferences
events            — Session listings
event_rsvps       — RSVP + waitlist
session_phases    — Structured session phase definitions
member_statuses   — Realtime traffic light state
peer_props        — Props between members (with echo delay)
cowork_preferences — "Cowork again" selections
venue_vibes       — Crowdsourced venue ratings
session_scrapbook — Auto-generated session memories
prompts           — Community questions
prompt_responses  — Answers with fire reactions
user_subscriptions — Tier + billing
subscription_tiers — Tier definitions
tier_features     — Feature-to-tier mapping
tier_limits       — Per-tier numeric limits
feature_flags     — Server-side feature toggles
notifications     — In-app notifications
push_subscriptions — Web Push endpoints
analytics_events  — Conversion tracking
member_flags      — Safety reports
```

### Key Algorithms
1. **Smart Grouping** (`createSmartGroups`): Captain distribution → experienced member balancing → newbie spreading → gender balancing (10 iterations)
2. **Match Scoring** (`calculateMatch`): Work vibe (20) + neighborhood (15) + skill exchange (25) + interests (15) + noise (5) + comm style (5) = max 100
3. **Session Matching** (`sessionMatchScore`): Day preference + time preference + format preference + neighborhood proximity
4. **Icebreaker Selection** (`selectIcebreakerRounds`): Least-used questions, depth adapted to group experience level
5. **Focus Hours** (`calculateSessionHours`): Format-based (4hr→3h, 2hr→1.33h) with time-parsing fallback

---

## 5. Feature Flag vs Subscription Gating

> **Architecture issue:** Two separate gating systems exist and need unification.

| System | Source | Used By | Purpose |
|--------|--------|---------|---------|
| Feature Flags | `feature_flags` table | `FeatureGate` component, `useFeatureFlags` | Kill switches, A/B tests, rollout control |
| Subscription | `tier_features` table | `useSubscription.hasFeature()` | Tier-based access |

**Recommendation:** Feature flags should control rollout (on/off for everyone). Subscription should control access (free vs paid). Currently mixed in UI.

---

## 6. Content & Personality System

The app uses a centralized personality system (`src/lib/personality.ts`) for all user-facing copy:
- Contextual greetings (time of day, context-aware)
- Loading messages (rotating witty copy)
- Error states (branded, humorous)
- Confirmations (warm, personal)
- Celebrations (streak, rank, milestone)
- Community language mappings ("session" not "event", "table" not "group")

---

## 7. Gamification System

| System | Mechanic | Current State |
|--------|----------|---------------|
| **Ranks** | 6 tiers (0-150+ focus hours) | Implemented, visual badges |
| **Badges** | 17 types, auto-awarded | Implemented |
| **Streaks** | Weekly session attendance | Implemented (insurance not functional) |
| **Milestones** | 22 achievement types | Implemented with celebrations |
| **Monthly Titles** | 6 competitive titles per month | Defined, award logic exists |
| **Exclusive Achievements** | 11 one-time/seasonal | Defined, partially implemented |
| **Props** | 6 peer recognition types | Implemented with echo delay |
| **Leaderboard** | Focus hours ranking | Component exists |

---

## 8. What Needs to Be Built (Prioritized)

### P0 — Launch Blockers

| Feature | Why | Effort |
|---------|-----|--------|
| Payment integration (UPI QR → Razorpay) | No revenue without it | High |
| Transactional notifications (email + WhatsApp) | Users won't know about sessions, groups, or reminders | Medium |
| Women-only RSVP enforcement | Trust & safety requirement | Low |
| Admin flag review + moderation | Cannot operate safely without it | Medium |
| Pre-session push reminders (24hr + 1hr) | Attendance rates will be terrible without reminders | Low |

### P1 — First Month After Launch

| Feature | Why |
|---------|-----|
| Session format/duration filter | Usability (busy users need to filter by time) |
| Neighborhood default from profile | Reduces friction on every visit |
| Quick post-session feedback path | Retains casual users who hate long forms |
| First-session explainer | Reduces anxiety for new users |
| Venue partner self-serve registration | Cannot scale supply side manually |
| Booking limits enforcement | Subscription revenue depends on it |
| Streak insurance UI | DB field exists, just needs frontend |

### P2 — Growth & Retention

| Feature | Why |
|---------|-----|
| Landing page social proof | Higher conversion from ads |
| Captain dashboard | Retain power users who drive community |
| Admin UX redesign | Operations team efficiency |
| Unified gating system | Architecture hygiene |
| Home page prioritization | Information overload hurts engagement |
| Direct messaging | Enable pre-session buddy intros |
| Email weekly digest | Reach users who didn't enable push |

### P3 — Expansion

| Feature | Why |
|---------|-----|
| Focus-only session format | Expand TAM to deep focus users |
| Offline resilience (service worker) | Indian cafe WiFi is unreliable |
| Venue intelligence on event cards | Better session selection |
| Prompt scheduling | Admin efficiency |
| Multi-city expansion prep | Beyond HSR Layout |
