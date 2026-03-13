# FocusClub Architecture

## System Overview

FocusClub is a social coworking platform that matches solo workers into groups of 3-5 at partner cafes and coworking spaces in Bangalore. The core value proposition: "The place where ambitious solo workers exchange skills, energy, and accountability." The "looking for / can offer" exchange system is the product differentiator -- users declare what they seek (accountability, design feedback, fundraising advice) and what they can provide, and the matching algorithm connects complementary people.

**Tech stack:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase (Auth, DB, Storage, Realtime, RPCs) + React Router + TanStack Query + Framer Motion.

**Deployed as:** PWA with service worker, offline fallback, installable on mobile.

---

## Directory Map

```
src/
├── App.tsx              — Route definitions (14 lazy-loaded pages), providers (Auth, Personality, Query, Tooltip)
├── main.tsx             — Entry point, renders App
├── pages/               — Route-level components (lazy-loaded via React.lazy in App.tsx)
│   ├── Index.tsx        — Landing page (public)
│   ├── Home.tsx         — Authenticated home dashboard
│   ├── Discover.tsx     — People discovery with match scoring
│   ├── Events.tsx       — Session listing
│   ├── EventDetail.tsx  — Single event with RSVP, calendar, share
│   ├── Session.tsx      — Session-day experience (check-in, phases, feedback, props)
│   ├── Prompts.tsx      — Weekly community prompts
│   ├── Profile.tsx      — Own profile editor (/me)
│   ├── ProfileView.tsx  — View another member's profile (/profile/:id)
│   ├── Admin.tsx        — Admin dashboard (analytics, flags, icebreakers, partners, status game)
│   ├── Partners.tsx     — Venue partner management
│   ├── MapView.tsx      — Leaflet map showing sessions
│   ├── Onboarding.tsx   — 4-step onboarding wizard
│   ├── SpaceInsights.tsx — Public venue analytics + conversion CTA (/space/:id/insights)
│   ├── SpaceLive.tsx    — TV Mode always-on display for venues (/space/:id/live)
│   └── NotFound.tsx     — 404 page
│
├── components/          — Feature-grouped UI components
│   ├── admin/           — Admin dashboard panels
│   │   ├── AdminAnalytics.tsx    — KPI charts, engagement metrics
│   │   ├── ChaiSettingsTab.tsx   — Platform settings
│   │   ├── FlagsTab.tsx          — Member flag review/escalation
│   │   ├── GrowthTab.tsx         — Growth metrics
│   │   ├── IcebreakersTab.tsx    — Icebreaker question management
│   │   ├── PartnersTab.tsx       — Venue partner management
│   │   └── StatusGameTab.tsx     — Gamification configuration
│   │
│   ├── captain/         — Table captain features
│   │   └── CaptainCard.tsx       — Captain nudge display
│   │
│   ├── discover/        — People discovery
│   │   ├── HorizontalCard.tsx    — Compact member card
│   │   ├── MemberCard.tsx        — Full member card with match score
│   │   ├── OfferCard.tsx         — Skill offer card
│   │   └── SkeletonCards.tsx     — Loading placeholders
│   │
│   ├── gamification/    — Badges, ranks, milestones, leaderboard
│   │   ├── AchievementsSection.tsx  — Badge/achievement display
│   │   ├── LeaderboardSection.tsx   — Focus hours leaderboard
│   │   ├── MonthlyTitlesSection.tsx — Monthly title winners
│   │   ├── RankAvatar.tsx           — Avatar with rank ring decoration
│   │   ├── RankBadge.tsx            — Rank tier badge
│   │   └── StatsGrid.tsx            — Stats summary grid
│   │
│   ├── growth/          — Growth engine UI, credits, contributions, referrals
│   │   ├── ContributionMilestoneCard.tsx — Contribution milestone progress (wired: Home)
│   │   ├── CreditsBadge.tsx          — Focus Credits display (wired: TopBar, Home)
│   │   ├── GrowthCards.tsx           — Progressive feature unlock cards
│   │   ├── GrowthNudgeCard.tsx       — Context-aware growth nudges (wired: Home)
│   │   ├── MilestoneCelebration.tsx  — Confetti + celebration modal
│   │   ├── NeighborhoodLeaderboard.tsx — Top contributors by area (wired: Home)
│   │   ├── PostSessionContribution.tsx — Post-session FC awards (wired: Session wrap-up)
│   │   ├── ReferralDashboard.tsx     — Referral stats + invite link (wired: Profile Journey)
│   │   └── VenueDataCollector.tsx    — 7-section venue data form (wired: Session wrap-up)
│   │
│   ├── home/            — Home page feature cards
│   │   ├── PrimaryActionCard.tsx     — Next session CTA or RSVP prompt
│   │   ├── ProfilePromptCard.tsx     — Profile completion nudge
│   │   ├── GratitudeEchoCard.tsx     — Delayed prop delivery (echoes)
│   │   └── CommunityRitualCard.tsx   — Monday Focus + Friday Wins
│   │
│   ├── layout/          — App shell and navigation
│   │   ├── AppShell.tsx     — Authenticated layout wrapper
│   │   ├── BottomNav.tsx    — Mobile bottom navigation bar
│   │   └── TopBar.tsx       — Top bar with notifications
│   │
│   ├── map/             — Leaflet map components
│   │   ├── SessionMap.tsx      — Map showing session locations
│   │   └── LocationPicker.tsx  — Interactive location picker
│   │
│   ├── onboarding/      — Multi-step onboarding wizard
│   │   ├── Step1Identity.tsx   — Name + avatar
│   │   ├── Step2Work.tsx       — Work type
│   │   ├── Step2WorkVibe.tsx   — Work vibe preference
│   │   ├── Step3GiveGet.tsx    — Looking for / can offer
│   │   ├── Step3Preferences.tsx — Noise, communication preferences
│   │   ├── Step4Done.tsx       — Completion screen
│   │   ├── Step4GiveGet.tsx    — Additional give/get (alternate flow)
│   │   ├── Step5Socials.tsx    — Social links
│   │   ├── Step6Summary.tsx    — Onboarding summary
│   │   └── TagInput.tsx        — Reusable tag input component
│   │
│   ├── session/         — Session-day components
│   │   ├── CheckInButton.tsx        — Geolocation-verified check-in
│   │   ├── GroupReveal.tsx          — Flip-card group reveal animation
│   │   ├── IcebreakerEngine.tsx     — Icebreaker round runner with timer
│   │   ├── GivePropsFlow.tsx        — Peer prop giving flow
│   │   ├── CoworkAgainCard.tsx      — "Cowork again?" mutual pick
│   │   ├── ScrapbookCard.tsx        — Auto-generated session memory card
│   │   ├── ScrapbookPrompt.tsx      — Prompt to view/share scrapbook
│   │   ├── VenueVibeRating.tsx      — Crowdsourced venue rating
│   │   ├── EnergyCheck.tsx          — Mid-session energy check
│   │   ├── PhotoMoment.tsx          — Session photo capture
│   │   ├── SkillSwapSuggestion.tsx  — Skill exchange suggestion
│   │   ├── FlagMemberForm.tsx       — Report a member
│   │   ├── SessionWrapUp.tsx        — End-of-session summary
│   │   └── AddToCalendarButton.tsx  — Google Calendar / ICS export
│   │
│   ├── sharing/         — Share cards and social sharing
│   │   ├── PostEventShare.tsx   — Post-event share prompt
│   │   ├── ProfileCard.tsx      — Shareable profile card
│   │   ├── RsvpSharePrompt.tsx  — Share after RSVP
│   │   └── WhatsAppButton.tsx   — WhatsApp share button
│   │
│   ├── ui/              — shadcn/ui primitives (button, card, badge, dialog, etc.)
│   │
│   ├── venue/           — Venue partner components
│   │
│   ├── ErrorBoundary.tsx   — React error boundary
│   ├── InviteRedirect.tsx  — /invite/:code handler
│   └── ProtectedRoute.tsx  — Auth gate wrapper
│
├── lib/                 — Pure business logic (testable without React)
│   ├── antifragile.ts   — Smart group formation, reliability, waitlist, flagging, captain nudges
│   ├── badges.ts        — 17 badge definitions + eligibility checking + auto-award via Supabase RPCs
│   ├── calendar.ts      — Google Calendar URL + ICS file generation
│   ├── growth.ts        — 22 milestones + analytics tracking + re-engagement logic
│   ├── haptics.ts       — Device vibration patterns (light, success, warning)
│   ├── icebreakers.ts   — Icebreaker question selection by group experience level
│   ├── matchUtils.ts    — User compatibility scoring (0-100) + profile completion calculation
│   ├── personality.ts   — Brand voice: greetings, empty states, error copy, onboarding text, community language
│   ├── ranks.ts         — 6-tier rank system (Newcomer to Grandmaster), focus hours tracking, monthly titles, achievements
│   ├── sessionMatch.ts  — Session recommendation scoring (day, time, radius, vibe, duration)
│   ├── sessionPhases.ts — Phase templates for 2hr/4hr structured sessions
│   ├── sharing.ts       — Share message generators with referral codes
│   ├── sentry.ts        — Sentry error tracking initialization
│   ├── types.ts         — OnboardingData interface
│   └── utils.ts         — cn() class merge, getInitials()
│
├── hooks/               — Custom React hooks
│   ├── useEvents.ts        — Event listing + RSVP data fetching
│   ├── useGeolocation.ts   — Browser geolocation API wrapper
│   ├── useNotifications.ts — Notification fetching + mark-read
│   ├── usePageTitle.ts     — Dynamic document.title
│   ├── useProfiles.ts      — Profile data fetching
│   ├── usePrompts.ts       — Prompt + response fetching
│   ├── useTheme.ts         — Theme toggle (light/dark)
│   ├── use-mobile.tsx      — Mobile breakpoint detection
│   └── use-toast.ts        — Toast notification hook (shadcn)
│
├── contexts/            — React context providers
│   ├── AuthContext.tsx      — User auth state, profile, session management (Google OAuth via Supabase)
│   └── PersonalityContext.tsx — Brand voice context (greeting, personality traits)
│
├── integrations/supabase/ — Supabase client + auto-generated types
│   ├── client.ts           — Browser Supabase client singleton
│   └── types.ts            — Database type definitions (auto-generated)
│
└── test/                — Vitest test suite
    ├── unit/            — Pure logic tests (lib functions)
    ├── integration/     — Tests with mocked Supabase
    ├── smoke/           — Build verification checks
    └── mocks/
        └── supabase.ts  — Supabase client mock

supabase/
└── migrations/          — 23 migration files defining the full database schema + RLS policies
```

---

## Key Data Flows

### Authentication
```
Google OAuth → Supabase Auth → AuthContext.tsx → profile fetch from profiles table
→ onboarding_completed check → redirect to /onboarding or /home
```

### RSVP Flow
```
EventDetail page → "I'm going" button → event_rsvps table (status: "going")
→ Binary RSVP only (no "interested") → spots_filled counter update
→ If full → joinWaitlist() → session_waitlist table
```

### Session Day Flow
```
Check-in (geolocation verified via CheckInButton)
→ Group Reveal (flip-card animation via GroupReveal)
→ Icebreaker rounds (IcebreakerEngine selects by group experience)
→ Deep Work Block 1 (phase timer)
→ Break (energy check, photo moment)
→ Deep Work Block 2
→ Wrap-Up → GivePropsFlow → CoworkAgainCard → VenueVibeRating → ScrapbookCard
```

### Matching
```
profiles table → calculateMatch(viewer, member) in matchUtils.ts
→ Score components: work_vibe (20), neighborhood (15), looking_for↔can_offer (15 each),
  interests (5 each), noise (5), communication (5)
→ Score capped at 100, top 4 reasons returned
```

### Ranking
```
Session attendance → calculateSessionHours() → addFocusHours()
→ profiles.focus_hours updated → getRankForHours() → profiles.focus_rank updated
→ If rank changed: notify all members via create_system_notification RPC
→ Check first-to achievements (50, 100, 200 hours)
```

### Social Graph (Your Circle)
```
CoworkAgainCard → cowork_preferences table (mutual picks)
→ get_my_circle RPC → "Your Circle" section on Home page
```

### Gratitude Echoes
```
GivePropsFlow → peer_props table → 30% flagged as is_echo=true
→ echo_deliver_at set to 4-24hrs later → GratitudeEchoCard displays on Home
```

---

## Progressive Disclosure System

Features unlock based on `events_attended` count on the user's profile:

| events_attended | Features Unlocked |
|----------------|-------------------|
| 0 | Basic home, events listing, RSVP, onboarding, profile editing |
| 1 | Gratitude echoes, community rituals, props, badges visible |
| 2 | Your Circle, social loss cards, streak display, streak insurance |
| 3 | Autopilot suggestion, become-a-buddy prompt |
| 5+ | Full venue vibe aggregates, leaderboard |

---

## Feature Systems

### Session Scrapbook
Auto-generated memory cards combining session data (venue, group members, props received, photos). Stored in `session_scrapbook` table. Rendered by `ScrapbookCard` component.

### Gratitude Echoes
30% of props are delayed 4-24 hours for unexpected delight. Controlled by `is_echo` and `echo_deliver_at` columns on `peer_props` table. Delivered via `GratitudeEchoCard` on the home page.

### Community Rituals
Weekly rituals: Monday Focus (set weekly intention) and Friday Wins (share accomplishments). Data in `community_rituals` + `ritual_likes` tables. Displayed via `CommunityRitualCard`.

### Buddy System
First-timers auto-matched with experienced members (`is_welcome_buddy` on profiles). Buddy assigned during RSVP via `buddy_user_id` on `event_rsvps`.

### The Reveal
`GroupReveal` component with flip-card animation. Each card shows clue data from group members' profiles (what they do, looking for, can offer) before revealing names/photos.

### Autopilot
Auto-booking preferences stored on profiles: `autopilot_enabled`, `autopilot_days`, `autopilot_times`, `autopilot_max_per_week`. System auto-RSVPs matching sessions.

### Venue Vibes
Crowdsourced venue ratings in `venue_vibes` table. Shown on event detail after 3+ ratings aggregated. Rated via `VenueVibeRating` component post-session.

### Icebreakers
Questions stored in `icebreaker_questions` table with category (quick_fire, pair_share, group_challenge, intention_set) and depth (light, medium, deep). `selectIcebreakerRounds()` picks questions based on group experience level, preferring least-used questions.

### Ranks & Achievements
6 rank tiers based on focus hours: Newcomer (0), Getting Started (5), Regular (15), Deep Worker (35), Elite (75), Grandmaster (150+). Visual progression via ring colors, glows, card borders. Monthly titles awarded for top performers. Exclusive achievements for first-to milestones.

### Badges
17 badge types covering: early adopter, profile completion, prompt engagement, event attendance, social connections, reactions, referrals, and peer props. Auto-checked and awarded via `checkAndAwardBadges()`.

### Milestones
22 milestone definitions covering: event attendance (1/3/5/10/25/50), streaks (3/5/10), props (given/received/25/50), prompts (1/5), referrals (1/3/10), and membership duration (1mo/3mo/6mo/1yr). Each has a shareable message with referral code.

---

## Database Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User identity, preferences, stats (events_attended, focus_hours, focus_rank, current_streak), autopilot settings, social links |
| `events` | Sessions with venue_id, date, start_time, end_time, session_format, max_spots, spots_filled, neighborhood |
| `event_rsvps` | Binary RSVP (going/waitlisted/cancelled) + buddy_user_id, checked_in, check_in_lat/lng |
| `session_phases` | Phase timings per event (icebreaker, deep_work, break, wrap_up) |
| `session_scrapbook` | Auto-generated session memory cards |
| `session_waitlist` | Waitlist queue with position |
| `cowork_preferences` | "Cowork again" mutual picks between users |
| `peer_props` | Props with prop_type, is_echo, echo_deliver_at |
| `community_rituals` | Weekly Monday Focus / Friday Wins entries |
| `ritual_likes` | Likes on ritual entries |
| `venue_vibes` | Crowdsourced venue ratings (noise, wifi, coffee, seating, vibe) |
| `icebreaker_questions` | Question bank with category, depth, times_used |
| `member_badges` | Awarded badges per user |
| `member_milestones` | Awarded milestones per user |
| `exclusive_achievements` | One-per-person achievements (first_to_50, etc.) |
| `member_flags` | Member reports for community safety |
| `notifications` | System + social notifications |
| `prompt_responses` | User answers to weekly prompts with fire_count |
| `prompts` | Weekly community prompt questions |
| `analytics_events` | Event tracking for admin analytics |

---

## Performance Architecture

### Code Splitting
- All 14 page routes lazy-loaded via `React.lazy()` + `Suspense` in App.tsx
- Vite manual chunks split vendor code into 8 bundles:
  - `vendor-react` — React, ReactDOM, React Router, Scheduler
  - `vendor-supabase` — @supabase/* packages
  - `vendor-ui` — Radix UI, class-variance-authority, clsx, tailwind-merge
  - `vendor-charts` — Recharts, D3, Victory
  - `vendor-animation` — Framer Motion
  - `vendor-dates` — date-fns
  - `vendor-media` — html2canvas, qrcode
  - `vendor-query` — TanStack Query
- Heavy libs (html2canvas, canvas-confetti, qrcode.react) dynamically imported at point of use

### PWA
- Service worker via vite-plugin-pwa with autoUpdate registration
- Offline fallback to `/offline.html`
- Runtime caching:
  - Supabase API: NetworkFirst (5 min cache, 50 entries)
  - OpenStreetMap tiles: CacheFirst (7 day cache, 200 entries)
- Installable with manifest (standalone display, portrait orientation)

### Data Fetching
- TanStack Query for client-side caching and deduplication
- Custom hooks (useEvents, useProfiles, usePrompts, etc.) wrap Supabase queries
- Supabase RPCs used for operations requiring elevated permissions (badge awards, notifications, waitlist promotion)

---

## Testing

- **Framework:** Vitest + jsdom + @testing-library/jest-dom
- **Test directories:**
  - `src/test/unit/` — Pure logic tests (lib functions like matchUtils, ranks, badges)
  - `src/test/integration/` — Tests with mocked Supabase client
  - `src/test/smoke/` — Build verification checks
- **Mocking:** Supabase client mock at `src/test/mocks/supabase.ts`
- **Config:** `vitest.config.ts` at project root

---

## Key Conventions

- **Routing:** React Router v6 with `BrowserRouter`. All authenticated routes wrapped in `<ProtectedRoute>`.
- **Auth guard:** `ProtectedRoute` checks AuthContext. Redirects to `/` if not authenticated, to `/onboarding` if onboarding incomplete.
- **Supabase RPCs:** Used for operations that bypass RLS: `award_badge`, `award_milestone`, `create_system_notification`, `update_reliability`, `promote_waitlist`, `get_my_circle`.
- **Brand voice:** All user-facing copy comes from `personality.ts`. Use `CONFIRMATIONS`, `ERROR_STATES`, `EMPTY_STATES` instead of ad-hoc strings.
- **Community language:** Use terms from `COMMUNITY_LANG` in personality.ts: "session" not "event", "table" not "group", "member" not "user", "regulars" not "active members".
