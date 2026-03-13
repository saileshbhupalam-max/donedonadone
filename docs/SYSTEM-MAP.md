# FocusClub System Map

> Quick reference: how all the pieces connect.

## User Journey Map

```
                    ACQUISITION                    ACTIVATION                        RETENTION
                    ──────────                    ──────────                        ─────────

Instagram Ad ─┐                                  ┌─ Greeting ────────────────────── Home Dashboard
Referral Link ─┼── Landing ── Google Auth ── Onboarding (4 steps) ── Home          │
Venue QR Code ─┘   (Index)                       │                                  ├── Primary Action Card
                                                  │                                  ├── Streak / Activity
                                                  │                                  ├── Your Circle
                                                  │                                  ├── Community Rituals (Mon/Fri)
                                                  │                                  ├── Gratitude Echoes
                                                  │                                  ├── Weekly Digest (Mon)
                                                  │                                  ├── Crew Events (FOMO)
                                                  │                                  └── Milestone Celebrations

                    BOOKING                        SESSION                          POST-SESSION
                    ───────                        ───────                          ────────────

                    Events Page ─── Event Detail    Pre-Start                       Feedback (emoji)
                    │                │              │                                │
                    ├── Filters      ├── RSVP       ├── Group Reveal                ├── Give Props (6 types)
                    ├── Map View     ├── Intention   ├── Check-In (geo/PIN)         ├── Cowork Again
                    ├── Request      ├── Calendar    ├── Phase Preview               ├── Venue Rating
                    └── Create       ├── Buddy       │                               ├── Scrapbook
                                     └── Share       During Session                  └── Share Card
                                                     │
                                                     ├── Phase Timer
                                                     ├── Traffic Light (realtime)
                                                     ├── Icebreaker Engine
                                                     ├── Captain Nudges
                                                     ├── Energy Check
                                                     ├── Photo Moment
                                                     └── Skill Swap Match
```

## Navigation Structure

```
Bottom Nav:
  Home (/home)        ── Main dashboard, all conditional cards
  Discover (/discover) ── People (locations, suggestions, connections) + Companies
  Sessions (/events)   ── Upcoming/Past + Filters + Map toggle
  You (/me)            ── Profile (3 tabs: Showcase / Journey / Settings)
  [Network] (/network) ── Max tier only (cross_space_network feature)

Top Bar:
  Logo → /home
  Notifications bell → Sheet overlay
  Avatar → /me

Other Routes:
  /events/:id     ── Event detail + RSVP
  /session/:id    ── Live session experience
  /profile/:id    ── View other user's profile
  /discover       ── People + companies
  /prompts        ── Weekly community question
  /settings       ── App settings + account
  /pricing        ── Subscription tiers
  /partners       ── Venue partner showcase
  /map            ── Full map view
  /admin          ── Admin dashboard (email-gated)
  /onboarding     ── New user flow
  /invite/:code   ── Referral redirect
```

## Data Flow: Session Lifecycle

```
1. CREATION (Admin/Captain)
   └── CreateEventButton → events table + session_phases table
       └── Smart Groups → event_groups (via createSmartGroups)

2. BOOKING (User)
   └── RSVP → event_rsvps (status: going/waitlist)
       ├── Intention → session_intentions
       ├── Waitlist → position tracking
       └── Analytics → analytics_events

3. DAY-OF (User)
   └── Check-In → check_ins table (geo verified or PIN)
       └── Join Session → member_statuses (realtime channel)

4. DURING (All members)
   ├── Traffic Light → member_statuses (red/amber/green broadcast)
   ├── Icebreakers → icebreaker_questions (times_used++)
   ├── Energy Check → energy_checks table
   └── Photos → session_photos (storage + table)

5. WRAP-UP (User)
   ├── Accomplishment → session_intentions (accomplished field)
   ├── Props → peer_props (with echo logic: 30% delayed)
   ├── Cowork Again → cowork_preferences
   ├── Venue Rating → venue_vibes
   └── Scrapbook → session_scrapbook (auto-generated)

6. FEEDBACK (User)
   └── event_feedback (rating, comment, attended boolean)
       ├── Focus Hours → profiles.focus_hours (via addFocusHours)
       ├── Badge Check → member_badges (via checkAndAwardBadges)
       ├── Milestone Check → user_milestones (via checkMilestones)
       └── Reliability → profiles (via updateReliability RPC)
```

## Gamification Stack

```
ENGAGEMENT LOOP:
  Attend Session → Focus Hours → Rank Up → Badge Earned → Milestone → Share
       │              │             │          │             │
       │              │             │          │             └── WhatsApp / Copy
       │              │             │          └── 17 types (auto-awarded)
       │              │             └── 6 tiers (Newcomer → Grandmaster)
       │              └── Calculated from session format/time
       └── Props Received → Echo Delay (30%) → Gratitude Card

WEEKLY LOOPS:
  Monday: Focus Intention (Community Ritual) + Weekly Digest
  Friday: Wins Sharing (Community Ritual)
  Weekly: Prompt Answer + Fire Reactions

RETENTION MECHANICS:
  Streak (weekly attendance) → Warning (Thu+) → Insurance (1/month, NOT IMPLEMENTED)
  Re-engagement: 7-day, 10-day, 14-day push notifications
  Social Loss: "Your circle is going to X session" (FOMO card)
  Profile Prompts: Progressive at 1st, 2nd, 3rd session
```

## Subscription Architecture

```
               ┌──────────┐
               │  TIERS   │
               ├──────────┤
               │ Free   0 │──── Default for all new users
               │ Plus  10 │──── Rs.299/mo
               │ Pro   20 │──── Rs.599/mo
               │ Max   30 │──── Rs.999/mo
               └──────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   tier_features  tier_limits  Session Boost
   (feature_key   (limit_key   (Rs.99/24hr
    min_tier_id)   limit_value)  temp upgrade)
        │           │
        ▼           ▼
   hasFeature()  getLimit()     ← useSubscription hook
        │           │
        ▼           ▼
   UI gating    NOT ENFORCED    ← PROBLEM: limits not checked at RSVP

   ALSO: useFeatureFlags ← SEPARATE system, admin toggles, NOT tier-based
         Used by FeatureGate component (check_in, taste_matching, etc.)
```

## Safety System

```
Flag Flow (current):
  User → FlagMemberForm → member_flags table → checkFlagEscalation()
                                                      │
                                          2+ flaggers across 2+ sessions?
                                                │              │
                                               YES            NO
                                                │              │
                                          console.warn()    (nothing)

  GAPS:
  - No admin review UI for flags
  - No member suspension/ban mechanism
  - No communication with flagged/flagging members
  - Flag button not accessible on mobile (hover-only in TrafficLightPanel)
  - Women-only events not enforced server-side
```
