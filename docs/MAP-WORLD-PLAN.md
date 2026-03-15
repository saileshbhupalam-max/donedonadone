# MAP WORLD + TASTE ENGINE — Strategic Implementation Plan

> The map is DanaDone's second world. Every photo, check-in, and venue
> contribution makes it richer. The taste engine is the intelligence layer —
> the more we know about each person, the better matches we create.
> These two systems feed each other in a flywheel.

## The Flywheel

```
  Better matches ─────► More sessions ─────► More check-ins
       ▲                                          │
       │                                          ▼
  More taste data ◄──── More engagement ◄──── Richer map
       ▲                                          │
       │                                          ▼
  Quick questions ◄──── App opens ◄───────── Users return
```

Every check-in teaches us where someone works. Every answered question
sharpens their compatibility score. Every venue photo makes the map more
useful for the next person. No single contribution is large, but they
compound into a living, breathing world.

---

## Part A: Taste Engine Reimagining

### Problem with Current System

The TasteGraphBuilder is a **7-step wizard** with ~20 fields. Users see it
as a chore. The PostSessionDnaPrompt asks 1 question after each session,
but sessions are infrequent. ProfilePromptCard asks after N sessions,
but those are one-time contextual prompts that run out.

**Result:** Most users have <30% taste completion. Matching quality suffers.

### New Design: "Quick Questions"

**Core idea:** 2-3 lightweight questions shown as a card on the Home page
every time the user opens the app. Different questions each time. Infinite
pool that grows over time. Feels like a conversation, not a form.

#### Question Types

| Type | Example | UI |
|------|---------|-----|
| **This-or-That** | "Morning person or night owl?" | Two big tap targets |
| **Emoji Pick** | "Your ideal noise level?" 🤫 🎵 🔊 | 3-4 emoji cards |
| **Chip Select** | "Topics you'd chat about over coffee" | Multi-select chips, max 3 |
| **Slider** | "How open are you to meeting strangers?" | Drag slider, emoji endpoints |
| **Quick Text** | "What are you building right now?" | Single input, 80 char max |

#### Question Pool (expandable, starts with ~60)

**Work DNA (feeds taste_graph directly):**
- What best describes your work? (role_type)
- Your top 3 skills? (skills)
- What are you looking for from coworkers? (work_looking_for)
- What can you help others with? (work_can_offer)
- Industries you've worked in? (industries)
- When do you do your best work? (peak_hours)
- Preferred session length? (session_length_pref)
- Ideal group size? (group_size_pref)

**Personality & Preferences (new — expands the graph):**
- Coffee or chai? (food_pref)
- Introvert recharging or extrovert energizing? (social_energy)
- Music while working? What kind? (work_music)
- Mac, Windows, or Linux? (tech_setup)
- Tabs or spaces? (just for fun / conversation starter)
- What's your go-to productivity hack? (quick_text)
- Meetings: love them or avoid them? (meeting_pref)
- Remote-first or office-first? (work_location_pref)
- Startup or big company energy? (company_culture)

**Lifestyle & Values (builds deeper compatibility):**
- What matters most: impact, growth, or fun? (values)
- Weekend plans usually involve...? (weekend_style)
- Fitness routine? (lifestyle)
- Book, podcast, or newsletter person? (learning_style)
- Travel: adventure or relaxation? (travel_style)
- Cook or order in? (food_style)

**Contextual (rotate based on season, events, trends):**
- New Year: "One skill you want to learn in 2026?"
- Monday: "Motivation level today?" (slider)
- After event: "Best part of today's session?"
- Rainy day: "Perfect rainy day work setup?"

#### UX Flow

```
┌─────────────────────────────────────────┐
│  Home Page (below streak, above feed)   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Quick Questions          2 FC ↗ │    │
│  │                                 │    │
│  │ ☕ Coffee or chai?              │    │
│  │                                 │    │
│  │  [ ☕ Coffee ]  [ 🫖 Chai ]    │    │
│  │                                 │    │
│  │  ──────────── 1/3 ───────────  │    │
│  │                                 │    │
│  │  Your matches: 42% accurate     │    │
│  │  ░░░░░░░░░░░░████████ 42%      │    │
│  │  Answer more → better matches   │    │
│  │                                 │    │
│  │  [ Skip for now ]              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... rest of home page ...              │
└─────────────────────────────────────────┘
```

**Key behaviors:**
- Shows 2-3 questions per app open (one at a time, inline)
- "Skip for now" always visible — no guilt, just a gentle nudge
- Each answer awards 2 FC (toast: "+2 FC — your matches just got sharper")
- Progress bar shows match accuracy % (= taste_graph completion)
- Questions never repeat — tracks answered questions per user
- Prioritizes questions that feed the matching algorithm first
- After all priority questions answered, rotates fun/personality ones
- Dismissing the card hides it for that session only

#### Database Design

```sql
-- Question pool (admin-managed, expandable)
CREATE TABLE taste_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'this_or_that', 'emoji_pick', 'chip_select', 'slider', 'quick_text'
  )),
  options JSONB,           -- e.g. ["Coffee", "Chai"] or [{id, emoji, label}]
  category TEXT NOT NULL,  -- 'work_dna', 'personality', 'lifestyle', 'contextual'
  taste_graph_field TEXT,  -- NULL or field name like 'role_type', 'skills'
  priority INT DEFAULT 50, -- higher = shown first (work_dna questions = 90+)
  fc_reward INT DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  seasonal_start DATE,     -- NULL = always active
  seasonal_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User answers (event-sourced — never delete, always append)
CREATE TABLE taste_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  question_id UUID NOT NULL REFERENCES taste_questions(id),
  answer JSONB NOT NULL,        -- flexible: string, string[], number
  credits_awarded INT DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)  -- one answer per question (can be updated)
);

-- Indexes
CREATE INDEX idx_taste_answers_user ON taste_answers(user_id);
CREATE INDEX idx_taste_questions_active ON taste_questions(is_active, priority DESC);
```

**How answers feed matching:**
- Questions with `taste_graph_field` set automatically sync the answer
  to the `taste_graph` table (via trigger or application code)
- Questions without `taste_graph_field` are personality/fun questions
  that feed a secondary compatibility layer
- The matching algorithm weights taste_graph fields (direct compatibility)
  higher than personality answers (conversational compatibility)

#### Integration with Existing System

- **TasteGraphBuilder stays** — power users can still fill it all at once
- **PostSessionDnaPrompt stays** — contextual post-session questions
- **ProfilePromptCard replaced** — Quick Questions subsumes its role
- **Weekly Prompts (Prompts page) stays** — community Q&A is different

---

## Part B: Map World

### Current State

- 17 locations in DB (neighborhoods + 4 venues)
- 0 venue_partners (no leads seeded)
- Map is fullscreen (just fixed) with floating controls
- Map now in BottomNav (just added)
- No venue detail page exists
- Photos have no lightbox (just fixed)

### Phase 1: Venue Detail Page

**Route:** `/venue/:id` (new page)

**Why first:** Everything else (QR codes, photo galleries, contributions,
check-in history) needs a destination page. Without it, there's nowhere
to show enriched venue data.

**What it shows:**

```
┌──────────────────────────────────────┐
│ ← Back                    ★ 4.2     │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │        [Hero Photo]              │ │
│ │   or map embed if no photo       │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Third Wave Coffee HSR                │
│ 📍 14th Main, HSR Sector 4          │
│ ☕ Cafe · 1.2km away                │
│                                      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│ │WiFi│ │Quiet│ │Power│ │☕  │        │
│ │4.5 │ │3.8 │ │4.2  │ │4.7│        │
│ └────┘ └────┘ └────┘ └────┘        │
│                                      │
│ ═══ Upcoming Sessions ═══           │
│ ┌──────────────────────────────────┐ │
│ │ Deep Work Thursday · Mar 20      │ │
│ │ 3/5 going · Join →              │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ═══ Photos (12) ═══                 │
│ [img] [img] [img] [+9 more]        │
│                                      │
│ ═══ QR Code ═══                     │
│ [QR] Scan to check in here         │
│                                      │
│ ═══ Data Completeness: 64% ═══     │
│ ░░░░░░░░░████████████ 64%          │
│ Missing: parking, food menu         │
│ [ + Add info · earn 5 FC ]          │
│                                      │
│ ═══ Recent Check-ins ═══           │
│ 🟢 Sailesh · 2h ago · Deep Work    │
│ 🟡 Priya · 4h ago · Available      │
│                                      │
│ ═══ Reviews ═══                     │
│ ★★★★☆ "Great coffee, fast wifi"    │
│ ★★★★★ "My go-to spot"              │
└──────────────────────────────────────┘
```

**Data sources:**
- `locations` table for basic info + coordinates
- `venue_vibes` for ratings (aggregated)
- `events` for upcoming sessions at this location
- `session_photos` + `venue_contributions` for photo gallery
- `check_ins` for recent/live presence
- `venue_reviews` for star ratings
- `venue_contributions` for data completeness calculation
- QR code generated via `qrcode.react` (already installed)

**Key files to create:**
- `src/pages/VenueDetail.tsx` — the page
- Route in `App.tsx`: `/venue/:id`

**Key files to modify:**
- `SessionMap.tsx` — venue popup links to `/venue/:id`
- `EventDetail.tsx` — venue name links to `/venue/:id`

### Phase 2: Content Seeding

**Goal:** Make the map feel alive on day 1. An empty map kills trust.

**Seed ~25 popular HSR Layout workspaces into `locations` table:**

| Category | Examples | Count |
|----------|----------|-------|
| Cafes | Third Wave, Blue Tokai, Starbucks, Toit, Dialogues, Matteo | ~10 |
| Coworking | WeWork, 91springboard, Cowrks, Innov8, BHive, GoWork | ~8 |
| Independent | The Hub, Ministry of New, WorkBench, local favorites | ~7 |

**How:**
- Supabase migration with INSERT statements
- Include: name, type, coordinates, neighborhood, radius
- Mark as `is_partner = false` (community-discovered, not partnered)
- Set `verified = true` so they show immediately

**Why this helps:**
- New users see a populated map immediately
- Creates contribution opportunities (photos, ratings — "this place is missing data")
- Each seeded venue becomes a check-in target
- Demonstrates what the platform looks like at scale

### Phase 3: QR Codes + Check-in Graph

**Every venue detail page auto-generates a QR code** that links to:
`/venue/:id?action=checkin`

**Scanning the QR:**
1. Opens venue detail page
2. Auto-triggers check-in flow (if authenticated)
3. Records time-based association in `check_ins` table

**Visit graph (profile enhancement):**
- New section on Profile page: "Your Places"
- Shows venues visited, frequency, total hours
- Visualization: simple bar chart or dot map
- Data source: `check_ins` grouped by `location_id`

**Schema addition:**
```sql
-- Visit summaries (materialized, updated on check-out)
CREATE TABLE visit_summaries (
  user_id UUID REFERENCES auth.users(id),
  location_id UUID REFERENCES locations(id),
  visit_count INT DEFAULT 0,
  total_minutes INT DEFAULT 0,
  last_visited_at TIMESTAMPTZ,
  first_visited_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, location_id)
);
```

### Phase 4: Contribution Engine

**Goal:** Users add richness — photos, ratings, info — and earn FC.

**Entry points:**
1. **Venue detail page** — "Add what's missing" CTA with FC incentive
2. **Post-session** — VenueDataCollector (already exists, stays)
3. **Map long-press** — "Know a workspace here? Add it" (nomination flow)

**First-mover bonus:**
- First photo of a venue: **+10 FC** (instead of normal 5)
- First review: **+15 FC** (instead of normal 10)
- Adding a venue that doesn't exist: **+30 FC** (already implemented)
- Adding data to a venue with <50% completeness: **2x multiplier**

**Implementation:**
- Extend `venueContributions.ts` with first-mover checks
- Add `isFirstContribution(venueId, type)` query
- Show "Be the first to add a photo!" badge on empty venues

### Phase 5: Map Enrichment

**Rich markers:**
- Venues with photos show a tiny thumbnail on the marker
- Color-coded by type: cafe (brown), coworking (blue), other (gray)
- Size reflects activity (more check-ins = larger marker)
- Pulse animation on venues with active check-ins

**Map search:**
- Search bar overlaid on map
- Fuzzy search against `locations.name`
- Results as list below search, tap to fly-to marker

**Clustering:**
- Use `react-leaflet-cluster` for marker clustering at low zoom
- Cluster shows count badge

**Activity indicators:**
- "3 people here now" label on active venues
- Recent photo thumbnails in popup

---

## Part C: Execution Order

### Why This Order

```
Taste Questions ──► Users open app more ──► More data collected
       │                                          │
       ▼                                          ▼
Venue Detail Page ─► Destination exists ──► Contributions land somewhere
       │                                          │
       ▼                                          ▼
Content Seeding ───► Map feels alive ────► Users explore
       │                                          │
       ▼                                          ▼
QR + Check-in ─────► Time associations ──► Visit graph builds
       │                                          │
       ▼                                          ▼
Contributions ─────► Users add richness ─► Map gets richer
       │                                          │
       ▼                                          ▼
Map Enrichment ────► Visual delight ─────► Users share / invite
```

### Phase Breakdown

| Phase | What | Key Deliverable | Estimated Scope |
|-------|------|-----------------|-----------------|
| **1** | Quick Questions system | Home page card, question pool, FC rewards | New component + migration |
| **2** | Venue Detail page | `/venue/:id` with ratings, photos, QR, sessions | New page |
| **3** | Content Seeding | 25 HSR Layout venues in DB | Migration only |
| **4** | QR + Check-in Graph | QR on venue page, visit summaries, profile section | Migration + components |
| **5** | Contribution Engine | First-mover bonuses, venue detail CTAs | Extend existing lib |
| **6** | Map Enrichment | Rich markers, search, clustering, activity | SessionMap upgrades |

### Dependencies

```
Phase 1 (Taste Questions) ── no dependencies, can start immediately
Phase 2 (Venue Detail) ──── no dependencies, can start immediately
Phase 3 (Content Seeding) ── Phase 2 should land first (so seeded venues have a page)
Phase 4 (QR + Graph) ─────── Phase 2 required (QR lives on venue detail page)
Phase 5 (Contributions) ──── Phase 2 required (CTAs on venue detail page)
Phase 6 (Map Enrichment) ─── Phase 3 required (need venues to show enriched markers)
```

**Phases 1 and 2 can run in parallel** — they're independent systems.
After both land, Phases 3-5 can proceed sequentially.
Phase 6 is polish after the core loop works.

---

## Part D: What's Already Done

| Item | Status |
|------|--------|
| Map fullscreen (hideNav + 100dvh + floating controls) | Done |
| Map in BottomNav (5th item) | Done |
| Photo lightbox (EventMemories + ScrapbookCard) | Done |
| "Add workspace" button on map (links to /nominate) | Done |
| Back navigation on map | Done |
| Venue contribution system (venueContributions.ts) | Exists |
| Venue nomination system (venueNomination.ts) | Exists |
| Health check system (venueHealthCheck.ts) | Exists |
| Focus Credits economy | Exists |
| Check-in flow (CheckInFlow.tsx) | Exists |
| QR code generation (VenueQrSection.tsx) | Exists (partner-only) |
| Post-session venue rating (VenueVibeRating.tsx) | Exists |
| Post-session DNA prompt (PostSessionDnaPrompt.tsx) | Exists |
| Matching algorithm (calculate_taste_match SQL) | Exists |
| Quick Questions system (QuickQuestionsCard + migration) | Done |
| taste_questions table (60 seeded questions, 5 types, 4 categories) | Done |
| taste_answers table (event-sourced, RLS, unique per user+question) | Done |
| FC reward for taste_answer action | Done |
| Venue Detail page (`/venue/:id`) with ratings, photos, QR, sessions | Done |
| Venue Detail route in App.tsx | Done |
| Content seeding (25 HSR Layout venues in locations table) | Done |

---

## Part E: Metrics to Track

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Taste completion % (avg across users) | >60% within 2 weeks | Better matches need data |
| Questions answered per user per week | 6-10 | Engagement + data quality |
| Skip rate on Quick Questions | <40% | Questions are relevant + fun |
| Venues with >50% data completeness | >80% of seeded venues | Map value |
| Check-ins per user per week | 2+ | Visit graph builds |
| Photos contributed per venue (avg) | 3+ | Visual richness |
| Map page visits (% of DAU) | >30% | Map is a destination |
| Time on venue detail page | >45s | Content is useful |

---

## Part F: Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Question fatigue (users stop answering) | Rotate question types, keep to 2-3 max, make them fun |
| Empty map despite seeding | Seed with real, verified venues + add "contribute" nudge |
| FC inflation from easy questions | Cap taste question FC at 20/day, separate from venue FC cap |
| Inaccurate seeded data | Mark seeded venues as "community data — help verify" |
| Users game first-mover bonuses | Quality gates (photo min size, review min length) already exist |
| Map performance with many markers | Clustering + lazy loading markers by viewport |

---

## Part G: Session Handoff — What To Build Next

**Last updated: 2026-03-15. Read this section at the start of the next session.**

### Completed This Session (commit a934ab1)
- MapView: fullscreen with `hideNav`, floating controls, `100dvh`
- BottomNav: Map as 5th item `[Home] [Discover] [Map] [Sessions] [You]`
- PhotoLightbox: swipe/keyboard/download, wired into EventMemories + ScrapbookCard
- MapSwapToggle: reusable component created (not yet integrated into Discover/Home)
- Guard tests: 22 tests covering tile URLs, react-leaflet version, vite config, lightbox
- Bug prevention memories saved (react-leaflet v5, Stadia Maps, keepNames)

### User's Additional Requirements (not yet in phases above)

1. **Map as swap on almost all screens** — User wants map/list toggle on Home,
   Discover, Events (Events already has it). Use `MapSwapToggle` component.
   The `SessionMap` is already lazy-loaded in Events. Do the same for Discover
   and Home. Show checked-in people on map (Discover) and upcoming sessions (Home).

2. **Exhaustive venue data collection** — User wants EVERYTHING captured:
   - Every wall/angle photographed (multi-photo upload per venue)
   - Sounds at different times of day (noise level with timestamp)
   - Ambient noise recordings (future: audio clips)
   - Floor plans and layout descriptions
   - Lighting conditions (natural light, fluorescent, etc.)
   - Temperature/AC quality
   - Restroom quality rating
   - Parking details and photos
   - Menu/pricing photos
   - Power outlet locations and count
   - Desk/table dimensions and types
   - **Goal: enough data to recreate a 3D rendering later**
   - All of this incentivized with FC (first-mover bonuses)

3. **Taste graph as continuous collection** — NOT a long form:
   - 2-3 quick questions every app open (Home page card)
   - Skippable with "Skip for now"
   - Nudge: "Your matches are X% accurate"
   - FC reward per answer (2 FC each)
   - Infinite question pool (never runs out)
   - Questions should feel conversational, not form-like
   - This-or-that, emoji pick, chip select, slider, quick text formats
   - See Part A of this plan for full design

### Recommended Next Session Order

1. **Phase 1: Quick Questions** — Build the taste_questions + taste_answers
   tables (migration), seed ~60 questions, create QuickQuestionsCard component
   for Home page. Replace ProfilePromptCard's role. FC rewards via awardCredits.

2. **Phase 2: Venue Detail Page** — Create `/venue/:id` page showing everything
   from locations + venue_vibes + venue_contributions + session_photos + check_ins.
   Route in App.tsx. Link from SessionMap popups and EventDetail venue name.

3. **Exhaustive Data Model** — Extend venue_contributions schema for new types:
   wall_photo, ambient_noise, lighting, temperature, restroom, desk_layout,
   outlet_locations, menu_photo. Add `captured_at` timestamp and `time_of_day`
   field for time-varying data (noise, lighting, temperature).

4. **Map Swap Integration** — Add MapSwapToggle + lazy SessionMap to Discover
   (show people on map) and Home (show nearby sessions on map). Events already
   has this pattern — copy it.

5. **Content Seeding** — Seed 25 HSR Layout venues via migration. Include
   real coordinates. The user mentioned "leads we collected" but venue_partners
   table is empty — ask user for their lead list, or research and seed known
   popular workspaces.

### Key Files for Next Session

| File | Purpose |
|------|---------|
| `docs/MAP-WORLD-PLAN.md` | This plan — read Part A for taste engine design |
| `src/components/map/MapSwapToggle.tsx` | Reusable map/list toggle (created, not integrated) |
| `src/components/map/SessionMap.tsx` | Main map component (already shows venues + sessions) |
| `src/components/ui/PhotoLightbox.tsx` | Photo lightbox (created, integrated) |
| `src/pages/Events/index.tsx:48,58,183` | Example of map swap pattern (already working) |
| `src/lib/venueContributions.ts` | Venue data contribution + FC awards |
| `src/lib/focusCredits.ts` | FC economy — use awardCredits() for taste answers |
| `src/lib/dnaCompletion.ts` | Current DNA completion calc — extend for quick questions |
| `src/components/home/ProfilePromptCard.tsx` | Current progressive profiling — QuickQuestions replaces this |
| `src/test/unit/mapGuards.test.ts` | Guard tests — add new guards for any new features |

### Database Tables to Create (Next Session)

```sql
-- taste_questions: expandable question pool
-- taste_answers: user answers (event-sourced)
-- visit_summaries: materialized visit history per user per venue
-- Extended venue_contributions types for exhaustive data
```

See Part A (taste engine) and Part B Phase 3-4 for full schema designs.
