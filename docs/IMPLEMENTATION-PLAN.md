# DanaDone — Implementation Plan

> Version: 1.0 | March 2026
> Based on: PRODUCT-VISION.md gap analysis vs current codebase
> Principle: Ship what makes money and delivers value first. Infrastructure before features.

---

## Gap Analysis Summary

### What's STRONG (no work needed)
- Session infrastructure (5 formats, phases, groups, icebreakers, captain system)
- AI matching engine (taste graph, 6-dimension scoring, company matching)
- Community layer (rituals, props, streaks, badges, Coffee Roulette)
- Gamification stack (ranks, badges, milestones, streaks)
- Safety (women-only RLS, flags, reliability scoring)
- PWA + offline resilience
- Admin dashboard
- TypeScript strict mode, error boundaries, Sentry tracking

### What's MISSING (organized by business impact)

| Gap | Vision Reference | Business Impact |
|-----|-----------------|-----------------|
| **No revenue** — payment integration | TD-001, P0 | CRITICAL — zero income |
| **No outbound comms** — email/WhatsApp/push triggers | TD-003, P0 | CRITICAL — silent app |
| **No day pass flow** — outsiders can't buy sessions | Gap 3, P0 | HIGH — revenue driver |
| **No in-session smart intros** — networking break has no AI | Gap 2, P1 | HIGH — the "wow" moment |
| **No proactive AI nudges** — matching is passive | Gap 6, P1 | HIGH — core value prop |
| **No workspace insights dashboard** — spaces have no reason to promote us | Gap 1, P1 | HIGH — GTM enabler |
| **B2B matching buried in UI** — company features hidden in Discover tab | Gap analysis | MEDIUM — B2B value |
| **No mentor/mentee track** — generic connections only | Gap analysis, P2 | MEDIUM — employee value |
| **No needs board** — freelancer/company gig matching | Gap 8, P2 | MEDIUM — freelancer value |
| **No AI community manager** — all community ops manual | Gap 6, P2 | MEDIUM — scale ops |
| **No day pass → member conversion** — no funnel | P1 | MEDIUM — growth |
| **No configurable session formats** — fixed structure per venue | Gap 5, P2 | LOW — expansion |
| **No cross-space network** — placeholder only | Gap 4, P3 | LOW — future moat |
| **No LLM-powered search** — directory only | P3 | LOW — future 10x |

---

## Implementation Phases

### Phase 1: REVENUE + COMMS (Launch Blockers)
> **Goal:** Members can pay. Members get notified. We can make money.
> **Timeline target:** 1-2 weeks

#### 1A: Payment Integration
- **UPI QR for MVP** using `upiqr` npm package (already in memory as the plan)
  - Generate QR code on Pricing page and Session Boost banner
  - After payment, user submits transaction ref → manual verification initially
  - Activate tier in `user_subscriptions` table
- **Razorpay integration** (fast follow)
  - Supabase Edge Function for webhook handling
  - Auto-activate tier on successful payment
  - Handle subscription renewals, cancellations
- **Day pass purchase flow**
  - Lightweight: select session → pay → get access code
  - Per-session pricing: platform takes ₹100 (2hr) / ₹150 (4hr), venue sets their price
  - Day pass users get a temporary `day_pass` tier for 24hrs
  - Simplified onboarding (name, email, phone — skip taste graph)

#### 1B: Outbound Notifications
- **Push notification triggers** (Supabase Edge Function cron)
  - 24hr before session reminder
  - 1hr before session reminder
  - Group assignment notification
  - New match notification
- **Email via Resend**
  - Session confirmation email
  - Weekly digest (Monday morning)
  - Re-engagement emails (7/14 day inactive)
  - Transactional: payment receipt, tier change
- **WhatsApp** (manual first, then automation)
  - Auto-create WhatsApp group link per session
  - Send session reminders via WhatsApp Business API (Phase 2)

---

### Phase 2: THE WOW MOMENT (Core Value Delivery)
> **Goal:** Sessions become magical. Matching becomes proactive. The product sells itself.
> **Timeline target:** 2-3 weeks after Phase 1

#### 2A: In-Session Smart Intros
- During the 30-min networking break, show each member:
  - "Talk to [Name] — they're looking for [X] and you can offer [Y]"
  - "You and [Name] both care about [topic] and are in [industry]"
- Use existing `calculateMatch()` + taste graph data for group members
- New component: `SmartIntroCard` shown during `social_break` phase
- Surfaces the TOP 2 most valuable connections in your session group
- Taps into existing `match_templates` for explanation copy

#### 2B: Proactive AI Nudges ("You Should Meet")
- **Daily/weekly push notifications** with personalized match suggestions
  - "New member Priya joined — she's looking for a React developer. That's you!"
  - "3 people at Thursday's session match your interests. Book now?"
- Supabase Edge Function that runs daily:
  - For each active member, find top 3 new matches they haven't seen
  - Send via push + in-app notification
  - Track opens/actions for algorithm improvement
- New component: `MatchNudgeCard` on Home page (replaces passive "Best Matches" with active recommendations with reasons)

#### 2C: Workspace Insights Dashboard
- Separate route: `/space/:id/insights` (public, no auth required — shareable link)
- Shows:
  - Total sessions hosted, unique members, repeat rate
  - Peak times heatmap (which days/times have most bookings)
  - Community health: active members, new members, churn
  - Top venue ratings (their crowdsourced scores)
  - Session attendance trends
- Read-only — pulls from existing `analytics_events`, `event_rsvps`, `venue_vibes` tables
- This is the "sales deck" for spaces — they see the value DanaDone brings

---

### Phase 3: VALUE DEPTH (Make Every Persona Win)
> **Goal:** Freelancers find gigs. Founders find co-founders. Employees find mentors. Companies find customers.
> **Timeline target:** 3-4 weeks after Phase 2

#### 3A: Needs Board (Evolved Micro Requests)
- Upgrade existing `micro_requests` into a proper Needs Board
  - Companies can post: "Need a React developer for 2-week project" with budget range
  - Members can post: "Available for freelance design work this month"
  - AI auto-matches needs with member profiles
  - Notification: "Company X posted a need that matches your skills"
- New page: `/needs` with tabs: All Needs | Matching You | Your Posts
- FeatureGated: basic posting free, AI matching for Plus+

#### 3B: Mentor/Mentee Matching Track
- Add `mentor_available: boolean` and `mentee_seeking: boolean` to profiles
- Add `mentor_domains: string[]` to taste_graph
- New matching dimension in `calculateMatch()` for mentor compatibility
- Dedicated section in Discover: "Available Mentors" and "Seeking Mentors"
- When matched, suggest a Coffee Roulette-style 1:1 focused on mentoring

#### 3C: B2B Matching Prominence
- Company features are BUILT but buried in Discover tab
- Move to dedicated `/companies` route with:
  - Company directory (already exists as CompanyDirectorySection)
  - "Matches for your company" featured section
  - Intro request flow (already built)
- Add company needs/offers to Home page for company members
- Push notifications for new company matches

#### 3D: Day Pass → Member Conversion Flow
- Post-session screen for day pass users:
  - Show their match scores with session members
  - "You clicked with 3 people today. Become a member to stay connected."
  - Show what they'd unlock: full matching, Coffee Roulette, community features
  - Special offer: first month free/discounted
- Track conversion in `conversion_events` table (already exists)

---

### Phase 4: AI INTELLIGENCE (Scale and Moat)
> **Goal:** AI runs the community. Humans just show up.
> **Timeline target:** Ongoing after Phase 3

#### 4A: AI Community Manager
- Supabase Edge Function + Claude API:
  - Auto-suggest community prompts based on trending topics
  - Predict churn: flag members with declining engagement
  - Auto-welcome new members with personalized intros to 3 compatible existing members
  - Suggest optimal session times/venues based on member availability
- Admin dashboard integration: "AI Suggestions" tab with approve/dismiss

#### 4B: LLM-Powered Member Search
- Natural language search: "Find someone who can help with Series A fundraising in edtech"
- Claude processes the query → maps to taste graph dimensions → returns ranked members
- Available in Discover page search bar (Plus+ tier)

#### 4C: AI Session Debrief
- Post-session summary pushed to each member:
  - "Your group today: 2 founders, 1 designer, 1 developer"
  - "Priya and you have the most in common — consider connecting"
  - "Your focus score: 87% (you were in red status for 85% of deep work time)"
- Generated by Claude from session data (group members, statuses, taste graph overlap)

#### 4D: Configurable Session Formats
- Venue operators can create custom session templates
- Define phases, durations, icebreaker sets
- Store in `session_templates` table linked to venue
- Admin creates template → sessions at that venue use it automatically

---

### Phase 5: NETWORK EFFECTS (Expansion)
> **Goal:** Multi-space, multi-city. The passport. The moat.
> **Timeline target:** When 10+ spaces are active

- Cross-space passport (portable profile, reputation, matching)
- City-level network discovery
- Corporate team session bookings
- Multi-city expansion toolkit

---

## Priority Matrix

```
                    HIGH BUSINESS IMPACT
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    │  Phase 1A: Payment  │  Phase 2A: Smart    │
    │  Phase 1B: Comms    │    Intros           │
    │  Phase 1A: Day Pass │  Phase 2B: AI       │
    │                     │    Nudges           │
    │    DO FIRST         │  Phase 2C: Space    │
    │                     │    Dashboard        │
    │                     │                     │
    │                     │    DO SECOND        │
EASY ─────────────────────┼───────────────────── HARD
    │                     │                     │
    │  Phase 3C: B2B      │  Phase 4A: AI       │
    │    Prominence       │    Community Mgr    │
    │  Phase 3D: Day Pass │  Phase 4B: LLM      │
    │    Conversion       │    Search           │
    │                     │  Phase 3A: Needs    │
    │    DO THIRD         │    Board            │
    │                     │                     │
    │                     │    DO LATER         │
    └─────────────────────┼─────────────────────┘
                          │
                    LOW BUSINESS IMPACT
```

---

## Implementation Order (Strict Sequence)

### Track A: Map World + Data Collection (Current Focus)
> See `docs/MAP-WORLD-PLAN.md` for full technical design.

| Order | Item | Depends On | Complexity |
|-------|------|-----------|-----------|
| A1 | **Quick Questions system** | Nothing | Medium — migration + component + FC |
| A2 | **Venue Detail page** (`/venue/:id`) | Nothing | Medium — new page, route |
| A3 | **Content seeding** (25 HSR venues) | A2 | Low — migration only |
| A4 | **Exhaustive venue data model** | A2 | Low — extend contribution types |
| A5 | **Map/list swap on all screens** | Nothing | Low — MapSwapToggle integration |
| A6 | **QR codes + check-in graph** | A2 | Medium — visit_summaries + profile section |
| A7 | **Contribution engine** (first-mover bonuses) | A2 | Low — extend venueContributions.ts |
| A8 | **Map enrichment** (markers, search, clustering) | A3 | Medium — SessionMap upgrades |

### Track B: Revenue + Comms (Launch Blockers)

| Order | Item | Depends On | Complexity |
|-------|------|-----------|-----------|
| B1 | **Payment (UPI QR MVP)** | Nothing | Medium — upiqr + manual verification |
| B2 | **Push notification cron** | Nothing | Medium — Edge Function + VAPID |
| B3 | **Email via Resend** | Nothing | Medium — Edge Function + templates |
| B4 | **Day pass purchase flow** | B1 | Medium — new route + simplified onboarding |

### Track C: The Wow Moment

| Order | Item | Depends On | Complexity |
|-------|------|-----------|-----------|
| C1 | **In-session smart intros** | Nothing | Low — uses existing match engine |
| C2 | **Proactive match nudges** | B2/B3 | Medium — Edge Function + scheduling |
| C3 | **Workspace insights dashboard** | Nothing | Medium — new read-only page |

### Track D: Value Depth

| Order | Item | Depends On | Complexity |
|-------|------|-----------|-----------|
| D1 | **B2B matching prominence** | Nothing | Low — mostly UI reorganization |
| D2 | **Day pass → member conversion** | B4 | Low — post-session CTA |
| D3 | **Needs board** | Nothing | Medium — evolve micro_requests |
| D4 | **Mentor/mentee track** | Nothing | Low — profile fields + matching |

### Track E: AI Intelligence + Scale

| Order | Item | Depends On | Complexity |
|-------|------|-----------|-----------|
| E1 | **AI community manager** | Claude API | High — Edge Functions + AI pipeline |
| E2 | **LLM-powered search** | Claude API | Medium — query parsing + search |
| E3 | **AI session debrief** | Claude API | Medium — post-session generation |
| E4 | **Configurable session formats** | Nothing | Medium — template system |
| E5 | **Cross-space network** | 10+ spaces | High — multi-tenant architecture |

### Current Execution Plan

**Now (Track A):** Quick Questions → Venue Detail → Content Seeding → Map enrichment
**Next (Track B):** Payment + notifications (launch blockers)
**Then (Track C+D):** Smart intros, nudges, B2B prominence
**Later (Track E):** AI features, cross-space network

---

## What NOT to Build Yet

- **White-label/co-branded experience** — premature. Prove value with DanaDone brand first.
- **Full marketplace/payment for services** — start with Needs Board matchmaking, not transactions.
- **Operator onboarding flow** — manual onboarding is fine for first 10 spaces.
- **Corporate team bookings** — wait for organic demand signal.
- **Multi-language support** — Bangalore market is English-first.

---

## Technical Prerequisites

Before starting Phase 1:
- [x] Supabase project on Pro plan (ap-south-1)
- [x] Vercel deployment working
- [x] PWA + offline resilience
- [x] Error boundaries + Sentry tracking
- [x] TypeScript strict mode
- [x] Women-only RLS policy (migration ready to apply)
- [ ] Resend account + API key (for email)
- [ ] Razorpay account + API keys (for payment)
- [ ] VAPID keys in production (for push)
- [ ] `upiqr` package installed (for UPI QR MVP)

---

## Success Criteria per Track

| Track | Ship When | Success Metric |
|-------|-----------|---------------|
| A (Map World) | Map feels alive, Quick Questions live, 25+ venues, venue detail pages | Taste completion >40% avg, map visits >20% of DAU |
| B (Revenue) | Payment works, notifications send | First paying member |
| C (Wow Moment) | Smart intros in session, nudges sending | "How did you know?!" feedback from members |
| D (Value Depth) | Needs board active, mentors matched | First gig/project from needs board |
| E (AI + Scale) | AI suggestions being accepted by admin | 50% of AI suggestions acted on |
