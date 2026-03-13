# FocusClub — Product Requirements Document

> Version: 2.0 | March 2026 | Living document

---

## 1. Product Overview

### What is FocusClub?
FocusClub is the AI-native community layer for workspaces. Members sign up permissionlessly, build rich profiles of what they seek and offer, attend structured deep work sessions at coworking spaces and cafes, and get matched with the right people — customers, collaborators, mentors, investors, friends. The platform turns any shared workspace into a place where careers are built through structured serendipity.

### Vision
We increase the surface area of luck. We are the community operating system for every workspace on earth — permissionless, member-driven, AI-powered.

### Value Proposition

**For companies:** Find customers, investors, collaborators, pooled buying, cross-selling to each other's customers, employees, interns. The community makes them stay instead of leaving to standalone offices.

**For employees:** Find referrals, mentors, mentees, a community, a space to do deep work with accountability.

**For freelancers:** Find customers, collaborators, mentors, gigs, referrals, a community, structured deep work.

**For founders:** Find first customers, employees, interns, investors, co-founders.

**The human angle:** Over time the space becomes warm. Most people know each other. New members are welcomed by the community. Day pass holders interface with regulars daily. People stay because their friends are there — and they keep meeting new people along the way.

### Business Model
- **Revenue from members** via tiered subscriptions: Free (Explorer), Plus, Pro, Max
- **Session Boost:** Rs.99 for 24-hour tier upgrade
- **Day pass sessions:** Outsiders buy a pass for structured sessions, increasing revenue for the space
- **Permissionless:** Members sign up directly. Spaces may optionally get a free insights dashboard.

### Target Market
- **Geography:** HSR Layout, Bangalore (launch), then Bangalore-wide, then India
- **Primary venues:** Coworking spaces (initial GTM), then cafes
- **Users:** Freelancers, remote workers, startup founders, employees, students, creators
- **Scale target:** 1,000 bookings/day

---

## 2. User Types

| Type | Description | Status |
|------|-------------|--------|
| **Member** | Primary user. Signs up, builds profile, attends sessions, connects. Has role: founder/freelancer/employee/student/creative | Fully implemented |
| **Company** | Organization profile. Lists needs/offers, gets B2B matches, sends intros | Fully implemented |
| **Venue Partner** | Cafe/coworking owner. Applies, lists venue, hosts sessions | Partially implemented |
| **Admin** | Community manager. Creates events, manages groups/prompts/flags | Fully implemented |

---

## 3. Core Features — Built

### 3.1 Signup & Onboarding
- Google OAuth via Supabase Auth
- 4-step onboarding: Identity → Work Preferences → Give & Get → Confirmation
- Referral code processing and badge award
- Profile completion tracking (0-100%)
- Redirect logic: new → onboarding, returning → home

### 3.2 Taste Graph / Work DNA (7-step deep profile)
- Role type: founder, freelancer, employee, student, creative, figuring_it_out
- Current project + stage (Idea → Growing)
- Skills by category: Tech (16), Design (8), Business (9), Content (8), Domain (9)
- Industries (16 options)
- Work seeking/offering + Play seeking/offering
- Values (11 options), Topics (17 options)
- Peak hours, session preferences, group size, conversation depth
- Food preferences, weekend availability
- Stored in `taste_graph` table, completion % tracked

### 3.3 AI Matching Engine
**Person-to-person scoring (max 100):**
- Work vibe match: 20pts
- Neighborhood: 15pts
- Looking-for/can-offer exchange: 15pts per match
- Mutual seeking: 10pts per match
- Shared interests: 5pts per match
- Noise preference: 5pts
- Communication style: 5pts

**Company-to-company matching:**
- `get_company_matches(p_company_id)` RPC
- Matches company needs vs. other company offers and vice versa
- Introduction system with rate limiting and credits

**Match explanations:** AI-generated compatibility text stored in `ai_match_explanations`

### 3.4 Session Discovery & Booking
- Events page with Upcoming/Past tabs
- 5 session formats: Structured 4hr, Structured 2hr, Focus Only 4hr, Focus Only 2hr, Casual
- Filters: neighborhood (dynamic), women-only, session format
- Event cards with social proof (avatars, circle members, attendance progress)
- Venue intelligence badges (WiFi, Power, Coffee, Quiet, Spacious)
- RSVP/cancel/waitlist with optimistic UI
- Intention setting at RSVP time
- Add to calendar (Google/ICS)
- Session request form for underserved areas
- Map view with distance sorting
- Popularity labels ("Almost full", "Filling fast")

### 3.5 Structured Session Experience

**4-hour format:**
```
30 min — Icebreaker (AI-selected rounds: quick_fire, pair_share, group_challenge, intention_set)
90 min — Deep Work Block 1 (traffic light status: red/amber/green, realtime sync)
30 min — Social Break (energy check, photo moment, skill swap suggestions)
90 min — Deep Work Block 2
15 min — Wrap-up (props, venue rating, cowork-again, scrapbook)
```

**Focus Only format (no social elements):**
```
5 min  — Check-in
50/110 min — Deep Work Block 1
5/10 min  — Silent Break
50/110 min — Deep Work Block 2
10/5 min  — Quick Wrap
```

**Session features:**
- Smart group formation (captain distribution → experience balance → newbie spreading → gender balance, 10 iterations)
- Pre-session buddy introductions (YourTableCard)
- Phase-by-phase timer with auto-advance
- Traffic light status sync (Supabase Realtime)
- Icebreaker engine (adaptive depth based on group experience)
- Captain nudges per phase
- Energy check (battery level, group average)
- Photo moment capture + storage
- Skill swap suggestions during breaks
- Quick feedback (1-tap emoji) or detailed feedback path
- Geolocation check-in with PIN fallback

### 3.6 Post-Session & Retention
- Feedback (emoji rating + comment)
- Props system (6 types: energy/helpful/focused/inspiring/fun/kind, echo delay mechanic)
- Cowork-again selections → builds circle for future matching
- Venue vibe rating (5 categories)
- Scrapbook auto-generation
- Weekly digest (Mondays)
- Community rituals (Monday Focus Intention, Friday Wins)
- Gratitude echoes (30% of props delivered with delay)
- Re-engagement notifications (7/10/14 day thresholds)

### 3.7 Social & Discovery

**Discover page (People tab):**
- Best matches (top 8 by score)
- New members (last 2 weeks)
- In your area (same neighborhood)
- Can help you (offer what you need)
- Same vibe (matching work_vibe)
- Active this week
- Full directory with search, vibe filter, women-only filter, sorting

**Discover page (Companies tab):**
- Company directory with search & stage filters
- Company needs/offers matching
- Company intro system with rate limiting

**Active Locations:**
- "Who's here" at each venue (RPC: `get_location_activity`)
- Taste match scores for people at your location

**Connection system:**
- Connection requests with messages
- Accept/decline/block
- Connection types: colleague/mentor/friend/network
- Strength scoring

**Community features:**
- Coffee Roulette (random AI-matched 1:1s, weekly rate limit)
- Micro Request Board (skill_help, coffee_chat, feedback, collaboration)
- Community prompts with fire reactions
- Profile completion nudges (progressive, milestone-gated)
- Referral code generation and tracking

### 3.8 Company Features (B2B Layer)
- Company profiles: name, one-liner, stage (Idea → Series B+), industry tags, team size, logo, website
- Team management with roles (founder/admin/member)
- Needs board: what company needs (need_type, title, description)
- Offers board: what company can offer (offer_type, title, description)
- AI-powered company matching RPC
- Introduction system with monthly limits + credit system
- AI-generated intro drafts
- Company analytics

### 3.9 Gamification Stack
| System | Detail | Status |
|--------|--------|--------|
| Ranks | 6 tiers: Newcomer → Grandmaster (0-150+ focus hours) | Implemented |
| Badges | 17 types, auto-awarded | Implemented |
| Streaks | Weekly attendance, insurance (1/month) | Implemented |
| Milestones | 22 achievement types with celebrations | Implemented |
| Monthly Titles | 6 competitive titles per month | Defined |
| Props | 6 peer recognition types with echo delay | Implemented |
| Leaderboard | Focus hours ranking | Implemented |

### 3.10 Subscription & Payments
- 4 tiers: Free (Explorer) / Plus / Pro / Max
- Feature gating via `tier_features` table (min_tier per feature)
- Limit gating via `tier_limits` table (per-tier numeric caps, -1 = unlimited)
- `useSubscription` hook with `hasFeature()` and `getLimit()`
- `FeatureGate` component supporting: feature flags, required tier, min level, check-in, DNA completion
- Session Boost (Rs.99 for 24hr upgrade) — UI built, payment pending
- Pricing page with tier comparison matrix, 8 feature categories
- `get_effective_tier()` RPC with boost logic
- **Payment integration: NOT BUILT** — upgrade button shows toast

### 3.11 Venue Partner Experience
- Partner application form (multi-step)
- Partner dashboard (stats, sessions hosted, members acquired)
- Venue vibe crowdsourcing (post-session ratings)
- Venue intelligence panel (detailed breakdown with dominant vibe)
- Venue quick badges on event cards (cached, 5-min TTL)
- QR code scan tracking (`venue_scans`)
- Partners showcase page

### 3.12 Admin Dashboard
- Grouped sidebar: Overview, Community, Sessions, Partners, Settings (18 tabs total)
- Member search, sort, CSV export
- Event management + smart group creation + buddy notifications
- Prompt management (create, activate, notify)
- Flag review with escalation stats
- Feature flag toggles
- Icebreaker management
- AI config and growth tabs
- Subscription management
- Analytics + engagement dashboards

### 3.13 Infrastructure
- PWA with service worker (130 precached entries)
- Offline banner (navigator.onLine detection)
- Runtime caching: Supabase API (NetworkFirst, 5s timeout), images (CacheFirst, 30d), fonts (CacheFirst, 1yr), map tiles (CacheFirst, 7d)
- Push notification registration (VAPID, sw-push.js)
- Sentry error tracking
- Analytics event tracking (`analytics_events`, `conversion_events`)
- Feature flags (server-side toggles, independent from subscription gating)

---

## 4. Technical Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite SPA + TypeScript |
| UI | shadcn/ui (48 primitives) + Tailwind CSS + Framer Motion |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions, Realtime) |
| Hosting | Vercel (static SPA) |
| Maps | Leaflet + React Leaflet |
| State | React Context (Auth, Subscription, FeatureFlags, Personality) |
| PWA | vite-plugin-pwa with Workbox |

### Database: 78 Tables
**Core:** profiles (64 fields), events, event_rsvps, session_phases, group_members, member_statuses
**Matching:** taste_graph, match_templates, ai_match_explanations, connections, connection_requests
**Companies:** companies, company_members, company_needs, company_offers, company_intros, intro_credits
**Community:** prompts, prompt_responses, prompt_reactions, community_rituals, coffee_roulette_queue, micro_requests
**Gamification:** peer_props, member_badges, member_milestones, exclusive_achievements, monthly_titles, user_streaks
**Session:** session_intentions, session_photos, session_scrapbook, session_boosts, icebreaker_questions, energy_checks, check_ins
**Subscription:** subscription_tiers, tier_features, tier_limits, user_subscriptions, session_boosts
**Venue:** locations, venue_partners, venue_vibes, venue_scans, partner_applications
**Infrastructure:** feature_flags, notifications, push_subscriptions, analytics_events, conversion_events, app_settings, ai_providers, ai_task_config, ai_usage_log

### Key Algorithms
1. **Match Scoring** (`calculateMatch`): 6-dimension scoring, max 100, returns score + 4 reasons
2. **Smart Grouping** (`createSmartGroups`): Captain → experienced → newbie → gender balance (10 iterations)
3. **Session Matching** (`sessionMatchScore`): Day + time + format + neighborhood proximity
4. **Icebreaker Selection** (`selectIcebreakerRounds`): Least-used questions, depth adapted to group experience
5. **Focus Hours** (`calculateSessionHours`): Format-based (4hr→3h, 2hr→1.33h)
6. **Company Matching** (`get_company_matches` RPC): Cross-references needs/offers between companies
7. **Reliability Scoring** (`updateReliability` RPC): Tracks RSVPs, shows, no-shows, late cancels
8. **Effective Tier** (`get_effective_tier` RPC): Subscription tier + boost logic

### Codebase Stats
- **26 pages** with lazy-loaded routes
- **140+ components** across 18 directories
- **14 hooks** for state management
- **22 lib files** for business logic
- **2 context providers** (Auth, Personality)
- **555 tests** across 39 files (unit, integration, smoke, edge)

---

## 5. What Needs to Be Built

### P0 — Launch Blockers

| Feature | Why | Status |
|---------|-----|--------|
| Payment integration (UPI QR → Razorpay) | No revenue without it | Not built |
| Email notifications (Resend/SendGrid) | Members won't know about sessions, groups, reminders | Not built |
| WhatsApp automation | Primary communication channel in India | Not built |
| Pre-session push scheduling (cron) | Attendance rates depend on reminders | Infrastructure exists, no trigger |
| Women-only RLS policy | Client-side enforcement only, needs DB-level | Not built |
| Day pass purchase flow | Revenue driver for spaces, GTM critical | Not built |

### P1 — First Month

| Feature | Why |
|---------|-----|
| In-session smart intros during networking break | The "wow" moment — "talk to X because Y" |
| AI "you should meet" proactive nudges | Passive matching → active matchmaking |
| Booking limits enforcement at RSVP | Subscription revenue depends on it |
| Day pass → member conversion flow | Growth funnel |
| Email weekly digest delivery | Reach users without push enabled |
| Workspace insights dashboard (free for spaces) | Give spaces a reason to promote FocusClub |

### P2 — Growth

| Feature | Why |
|---------|-----|
| AI community manager (auto-suggest intros, predict churn) | Scale community ops 10x |
| Needs Board (companies post needs, AI matches members) | Unlock freelancer→company value exchange |
| Mentor/mentee explicit matching track | High-value connection type for employees |
| Configurable session formats per venue | Let venues customize their experience |
| Multi-neighborhood expansion (Koramangala, Indiranagar) | Geographic growth |

### P3 — Expansion

| Feature | Why |
|---------|-----|
| Cross-space passport (visit any FocusClub space) | Network effect moat |
| LLM-powered member search ("find someone who can help with Series A") | 10x discovery |
| Corporate team session bookings | B2B revenue channel |
| Offline data caching (IndexedDB for session/event data) | Indian WiFi resilience |
| Multi-city expansion (Mumbai, Delhi) | Scale |

---

## 6. Feature Flag vs Subscription Gating

Two separate systems — intentionally:

| System | Source | Purpose |
|--------|--------|---------|
| Feature Flags | `feature_flags` table | Kill switches, A/B tests, rollout control (on/off for everyone) |
| Subscription | `tier_features` + `tier_limits` | Tier-based access (free vs paid features) |

`FeatureGate` component supports BOTH: `featureFlag` prop checks flags, `requiredTier` prop checks subscription. Can be combined.

---

## 7. Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Meaningful connections per member/month | 5+ | Core value delivery |
| 90-day member retention | 70%+ | Community stickiness |
| Session NPS | 60+ | Session quality |
| Day pass → member conversion | 15%+ | Growth funnel |
| Weekly active rate | 40%+ | Engagement |
| Profile completion (taste graph) | 60%+ at 30 days | Matching quality |
| Company needs fulfilled per company/month | 3+ | B2B value delivery |

---

## 8. Venue Growth System — Feature Specifications

### 8.1 Enhanced Space Insights Page (QR Destination)
**Route:** `/space/:id/insights` (public, no auth)
**Status:** Enhancing existing page
**Priority:** P0

**Current state:** Analytics-focused (attendance trends, peak times, ratings, community health)

**Add above-the-fold conversion section:**
- Live count: "X people focused here right now" (query active check_ins for this location)
- Next session CTA: "Next session: [date] at [time] — [X spots left]" with "Join" button
- If no upcoming sessions: "Be the first to book a session here"
- Community faces: 5 most recent member avatars who attended this venue
- "Download FocusClub" / "Open in app" CTA
- Preserve existing analytics sections below the fold

**Data sources:**
- Active check-ins: `check_ins` table WHERE location_id = :id AND checked_out_at IS NULL
- Next session: `events` table WHERE venue_id = location_id AND date >= today ORDER BY date ASC LIMIT 1
- Recent members: `event_rsvps` JOIN `profiles` WHERE event.venue_id = :id, last 5 unique users

### 8.2 TV Mode Display
**Route:** `/space/:id/live` (public, no auth)
**Status:** New page
**Priority:** P1

**Design:**
- Full-screen, landscape-optimized, dark/light theme auto
- Large venue name + "Powered by FocusClub"
- Centered QR code (links to /space/:id/insights)
- Live stats that rotate every 8 seconds:
  - "X people focused right now"
  - "Y focused hours this month at [venue]"
  - "Z unique coworkers this week"
  - "Next session: [date] at [time]"
- Bottom ticker: recent milestones, props given, new members
- Auto-refresh data every 60 seconds
- No scroll, no interaction needed — designed for wall-mounted TV

**Data sources:**
- Same as SpaceInsights, plus:
- Monthly hours: SUM(focus_hours) from events at this venue in current month
- Weekly unique: COUNT(DISTINCT user_id) from event_rsvps at this venue in last 7 days

### 8.3 Partner Dashboard Enhancements
**Route:** `/partner` (auth required, partner role)
**Status:** Enhancing existing page
**Priority:** P1

**Add to existing dashboard:**
1. **New Customer Attribution Card:**
   - "FocusClub brought you X new faces this month"
   - Query: COUNT(DISTINCT user_id) from check_ins WHERE location_id = partner's venue AND user's first check_in at this location was this month
   - Trend vs last month

2. **Self-serve Marketing Materials:**
   - "Download QR Code" button (generates QR pointing to /space/:id/insights)
   - "Download Table Tent" button (PDF with venue name + QR)
   - "Download Poster" button (A4 PDF)
   - "Copy TV Mode URL" button (copies /space/:id/live URL)
   - Move existing admin-only QR generation to partner-accessible

3. **Venue Streak Badge:**
   - "12 consecutive weeks hosting sessions!"
   - Calculated from events table — consecutive weeks with at least 1 event

### 8.4 Post-Session Contribution Flow (Wiring)
**Component:** `PostSessionContribution.tsx` (exists, needs wiring)
**Location in flow:** Session wrap-up, after venue rating, before scrapbook
**Status:** Wire into Session/index.tsx
**Priority:** P0

Awards Focus Credits for:
- Rating group (5 FC)
- Rating venue (5 FC)
- Submitting noise report (10 FC)
- Submitting WiFi report (10 FC)
- Uploading session photo (5 FC)

Variable reward: 15% chance of 2x/3x bonus per section (behavioral design)

### 8.5 Venue Data Collector (Wiring)
**Component:** `VenueDataCollector.tsx` (exists, needs wiring)
**Location in flow:** Post-session, optional after PostSessionContribution
**Status:** Wire into Session/index.tsx
**Priority:** P1

7 sections: photos, basic info, amenities, food, companies, wifi, noise
Each section awards FC with 12% variable reward chance
Endowed progress bar (starts at 20%)

### 8.6 Referral Dashboard (Wiring)
**Component:** `ReferralDashboard.tsx` (exists, needs wiring)
**Location:** Profile page, Journey tab
**Status:** Wire into Profile/index.tsx
**Priority:** P0

Shows: invited count, first session count, 3+ sessions count, total FC earned
Milestone progress toward Community Builder (10 referrals with 3+ sessions)
Copy/share referral link buttons (WhatsApp green button)

### 8.7 Neighborhood Leaderboard (Wiring)
**Component:** `NeighborhoodLeaderboard.tsx` (exists, needs wiring)
**Location:** Home page, below existing leaderboard section
**Status:** Wire into Home/index.tsx
**Priority:** P1

Shows top contributors by focus hours in user's neighborhood
Only renders when user has a neighborhood set on their profile

### 8.8 Focus Credits Redemption (New)
**Status:** Not built — engine exists but no spending UI
**Priority:** P2

**Redemption options** (defined in growthConfig.ts):
| Option | Cost | Description |
|---|---|---|
| Free session | 100 FC | Waive session fee |
| Priority matching | 30 FC | Get matched with your preferred people |
| Venue upgrade | 50 FC | Book premium venue slot |
| Pick your seat | 20 FC | Choose your group |
| Gift session | 100 FC | Send a friend a free session |
| Exclusive session | 40 FC | Access limited sessions |

**UI:** Dialog/sheet triggered from CreditsBadge tap. Shows balance, earning history, redemption options with "Redeem" buttons.

### 8.9 Post-Session WhatsApp Story Card (New)
**Status:** Not built
**Priority:** P2

One-tap generates Instagram/WhatsApp story-sized image (1080x1920):
- "I did [X]hrs of focused work at [Venue]"
- "with [N] amazing people"
- Session scrapbook photo if available
- FocusClub branding + referral QR code
- Venue name prominently displayed
- Share via native share API (WhatsApp, Instagram, download)

Leverages existing html2canvas + sharing.ts infrastructure.

---

## 9. System Connectivity Requirements

All subsystems must connect. No dangling components.

### Growth System Wiring Map

```
Session Wrap-up Flow (Session/index.tsx):
  → Intention Check (SessionWrapUp)
  → Give Props (GivePropsFlow)
  → Cowork Again (CoworkAgainCard)
  → Venue Rating (VenueVibeRating)
  → Post-Session Contribution (PostSessionContribution)  ← WIRE
  → Venue Data Collector (VenueDataCollector)             ← WIRE
  → Scrapbook (ScrapbookPrompt)
  → Quick Feedback (QuickFeedback)
  → DNA Prompt (PostSessionDnaPrompt)

Home Page (Home/index.tsx):
  → Growth Nudge Card (GrowthNudgeCard)                  ✓ wired
  → Contribution Milestone Card (ContributionMilestoneCard) ✓ wired
  → Neighborhood Leaderboard (NeighborhoodLeaderboard)    ← WIRE
  → Credits Badge (CreditsBadge via useFocusCredits)      ✓ wired

Profile Page (Profile/index.tsx):
  → Referral Dashboard (ReferralDashboard)                ← WIRE
  → Badges (AchievementsSection)                          ✓ wired
  → Stats (StatsGrid)                                     ✓ wired
```
