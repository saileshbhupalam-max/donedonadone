# Prompt 21 — The Memory Engine (Scrapbook, Intentions, Rituals, Gratitude)

Pull the codebase from: `https://github.com/saileshbhupalam-max/focusclub-find-your-people.git`

This is a React + Vite + Supabase coworking platform. The database is on Supabase, auth is Google OAuth, and the UI uses Tailwind + shadcn/ui + Radix + Framer Motion. The app matches solo workers into groups at partner cafes in Bangalore.

**Design Philosophy:** Sessions aren't just attended — they're remembered, reflected on, and shared. The Memory Engine transforms "I went to a coworking session" into "I have a FocusClub story." Every feature here strengthens the memory→identity→sharing loop. Progressive disclosure: features appear as users earn them through real participation.

---

## PART 0 — FIX GAPS FROM PREVIOUS PROMPT

### 0.1 Remove "Interested" RSVP from Events

In `src/pages/Events.tsx`, the event cards still show an "Interested" button with an `Eye` icon (around line 182-185). Remove it completely. Replace it with a Bookmark/Save button using the `Bookmark` icon from lucide-react. The bookmark should use the existing `savedEvents` localStorage state (already in the component around line 636-638). When saved, the Bookmark icon should be filled. Remove the `interestedCount` calculation and its display in the card footer.

In `src/pages/EventDetail.tsx`, also remove "interested" as an RSVP option. Only keep "Going" (or "Waitlisted" if full) and "Cancel".

Why: Binary commitment. "Interested" creates fake signal the system can't plan around. Going = committed. Save = private bookmark for later.

### 0.2 Add "Your Circle" to Home

In `src/pages/Home.tsx`, add a "Your Circle" section showing mutual cowork-again connections. Gate it to `events_attended >= 2`.

It should call `supabase.rpc('get_my_circle', { p_user_id: user.id })` (RPC already exists in migrations) and render a horizontal scrollable row of avatar circles with display names and "X sessions together" count. Each avatar links to that person's profile. If circle is empty, show: "After your next session, tap 'Cowork Again' on people you clicked with. Mutual picks appear here."

Use a Card with header "Your Circle" and `Users` icon from lucide-react.

Why: This closes the Cowork Again loop — selections made in the session wrap-up now have a visible home. It's the social graph built through real sessions.

### 0.3 Ensure cowork_preferences Table Exists

The `CoworkAgainCard` component inserts into `cowork_preferences` but the table may not be created. Create a migration ensuring the table exists with columns: `id` (uuid pk), `user_id` (references profiles), `preferred_user_id` (references profiles), `event_id` (references events), `created_at` (timestamptz). Add a unique constraint on (user_id, preferred_user_id, event_id). Enable RLS — users can insert their own rows, and can read rows where they are either user_id or preferred_user_id.

Also ensure the `get_my_circle` RPC function exists — it finds mutual pairs (where A picked B AND B picked A) and returns circle_user_id, display_name, avatar_url, tagline, cowork_count ordered by cowork_count descending. Use SECURITY DEFINER.

---

## PART 1 — SESSION SCRAPBOOK (Auto-Generated Memory Cards)

The scrapbook transforms sessions from "I attended" into "I remember." After each session, an auto-generated card combines: who was there, what you intended, what you accomplished, photos taken, props received. This becomes the shareable artifact.

### 1.1 Migration

Create a `session_scrapbook` table:
- `id` uuid primary key
- `user_id` references profiles, not null
- `event_id` references events, not null (unique with user_id)
- `session_date` date not null
- `venue_name` text
- `venue_neighborhood` text
- `group_members` jsonb default '[]' — array of {user_id, display_name, avatar_url}
- `cowork_again_picks` uuid array default '{}'
- `intention` text
- `intention_accomplished` text — 'yes', 'partially', 'no'
- `props_received` jsonb default '[]' — array of {from_user_id, from_display_name, prop_type, message}
- `photo_url` text — from session_photos if any
- `focus_hours` numeric(4,2) — duration of session
- `personal_note` text — user can add a reflection
- `highlight` text — auto-generated one-liner like "3hr deep focus at Third Wave with Priya & Arjun"
- `created_at` timestamptz default now()

Enable RLS: users can read/update their own scrapbook entries. No delete (memories are permanent).

### 1.2 Auto-Generate Scrapbook Entry

In `src/pages/Session.tsx`, when the session enters the wrap-up/completed phase (after feedback and cowork-again), auto-generate a scrapbook entry by gathering:
- Event details (venue, date, duration)
- Group members from the session
- The user's intention (from `session_intentions` table)
- Props received during this session (from `peer_props` table)
- Any photo taken (from `session_photos` table)
- Generate a `highlight` string like: "{focus_hours}hr {work_vibe} session at {venue_name} with {member_names}"

Insert into `session_scrapbook` via upsert (on conflict user_id + event_id do update).

### 1.3 Scrapbook Card Component

Create `src/components/session/ScrapbookCard.tsx` — a beautiful, shareable card that shows:
- Date and venue at top
- The highlight text as the main heading
- Group member avatars in a row
- Intention + accomplished status (green check / yellow partial / red x)
- Props received as small badges
- Photo if available (rounded, with subtle shadow)
- Personal note (if added)
- Focus hours with a small clock icon
- A "Share" button that generates a screenshot-friendly version (use html2canvas, already in the project)
- An "Add Note" button that lets the user write a reflection and saves to `personal_note`

Style: warm, journal-like feel. Use soft backgrounds (amber-50/orange-50 in light mode, warm grays in dark mode). Rounded corners, subtle shadows. The card should feel like a page from a journal, not a data dashboard.

### 1.4 Add Scrapbook to Journey Tab

In `src/pages/Profile.tsx`, the Journey tab (currently showing badges, achievements, monthly titles in a timeline) should also include scrapbook entries. Fetch from `session_scrapbook` ordered by session_date desc. Merge with existing journeyItems chronologically.

Each scrapbook entry in the timeline shows the ScrapbookCard component (compact version — just highlight, venue, date, member count, and intention status). Tapping expands to full card.

The Journey tab should now have filter chips at the top: "All" | "Sessions" | "Badges" | "Achievements" so users can filter the timeline.

### 1.5 Post-Session Scrapbook Prompt

After the session wrap-up completes (all feedback given, cowork-again selected), show a final card: "Your session story is ready!" with a preview of the ScrapbookCard and buttons: "View in Journey" (navigates to profile Journey tab) and "Share" (triggers share flow). This is the last thing the user sees before leaving the session page.

---

## PART 2 — INTENTION FLOW REDESIGN

Currently intentions are set during the session. Move them to RSVP time — so users arrive with purpose already set, and the session can reference it.

### 2.1 Add Intention at RSVP Time

In `src/pages/EventDetail.tsx`, after a successful RSVP (status "going"), show an inline intention prompt:

- Small expandable section: "What's your focus for this session?" with a text input
- Placeholder suggestions that rotate: "Ship the landing page", "Write 2000 words", "Review 3 pull requests", "Finish the pitch deck"
- Optional — user can skip, but encourage with: "People who set intentions accomplish 2x more"
- Save to `session_intentions` table (already exists) with the event_id
- If the user already has an intention for this event, show it with an edit button

### 2.2 Show Intention on Session Day

In `src/pages/Session.tsx`, during the deep_work phase, the user's intention should be prominently displayed (this may already work if it reads from session_intentions — verify and ensure it does).

### 2.3 Monday Intention Prompt on Home

In `src/pages/Home.tsx`, on Mondays (check day of week), show a special card at the top for users with `events_attended >= 1`:

- Header: "Monday Focus" with a Target icon
- Body: "What's your #1 goal this week?"
- Text input for weekly intention
- Save to a new `weekly_intentions` field or use the existing prompt system
- If the user has an upcoming RSVP'd session this week, show: "You're booked for {session} on {day}. Set your intention now?" with a button that pre-fills the session intention

### 2.4 Migration for Weekly Intentions

Add to profiles table: `weekly_intention` text, `weekly_intention_set_at` timestamptz. This is a single field that gets overwritten each Monday. Simple.

---

## PART 3 — GRATITUDE ECHOES (Delayed Prop Delivery)

Props given during sessions are currently delivered instantly. Gratitude Echoes delays SOME props to create warm between-session moments — a notification that arrives hours or a day later saying "Someone appreciated you."

### 3.1 Migration

Add columns to `peer_props` table (or create a wrapper):
- `delivered_at` timestamptz — null means not yet delivered
- `is_echo` boolean default false — true means this prop is delayed
- `echo_deliver_at` timestamptz — when to deliver (random 4-24 hours after session ends)

### 3.2 Echo Logic

In the props submission flow (when a user gives props during session wrap-up), randomly mark ~30% of props as echoes:
- Set `is_echo = true`
- Set `echo_deliver_at` to a random time 4-24 hours after the session's end_time
- Set `delivered_at` to null

The remaining 70% of props are delivered immediately as they are now (`delivered_at = now()`).

### 3.3 Echo Notification Card on Home

In `src/pages/Home.tsx`, check for undelivered echoes where `echo_deliver_at <= now()` and `delivered_at IS NULL`. Show a special card:

- Warm styling (golden/amber background, subtle glow animation)
- "A gratitude echo arrived..." with a slight reveal animation
- Show the prop type and message from the giver
- Show giver's avatar and name
- "From your session at {venue} on {date}"
- A heart/sparkle button to acknowledge (sets `delivered_at = now()`)
- After acknowledging, optionally prompt: "Send one back?" linking to that person's profile

Gate to `events_attended >= 1`. Only show one echo at a time (the oldest undelivered one).

### 3.4 Echo in Notification Bell

If there's a notification system/bell icon, also add echo arrivals there. Each echo creates a notification entry.

---

## PART 4 — COMMUNITY RITUALS (Monday Focus + Friday Wins)

Lightweight, recurring engagement moments that create belonging between sessions.

### 4.1 Migration

Create a `community_rituals` table:
- `id` uuid primary key
- `user_id` references profiles, not null
- `ritual_type` text not null — 'monday_intention' or 'friday_win'
- `content` text not null
- `week_of` date not null — the Monday of that week
- `likes_count` integer default 0
- `created_at` timestamptz default now()
- Unique constraint on (user_id, ritual_type, week_of)

Enable RLS: users can insert/update their own. All authenticated users can read all.

Create a `ritual_likes` table:
- `id` uuid primary key
- `user_id` references profiles, not null
- `ritual_id` references community_rituals, not null
- `created_at` timestamptz default now()
- Unique constraint on (user_id, ritual_id)

Enable RLS: users can insert/delete their own. All authenticated users can read all.

### 4.2 Friday Wins Card on Home

On Fridays (check day of week), show a card for users with `events_attended >= 1`:

- Header: "Friday Wins" with a Trophy icon
- Body: "What did you accomplish this week?"
- Text input
- Submit saves to `community_rituals` with `ritual_type = 'friday_win'`
- Below the input, show a feed of this week's wins from other users (max 10, ordered by created_at desc)
- Each win shows: avatar, display_name, content, like button with count
- Like button toggles via `ritual_likes` table

### 4.3 Monday Focus (from Part 2.3)

The Monday intention card from Part 2.3 should ALSO save to `community_rituals` with `ritual_type = 'monday_intention'`, and show a feed of other users' Monday intentions below the input. Same format as Friday Wins.

### 4.4 Rituals Feed in People/Discover

On the People page (or Discover section), add a "This Week" tab or section showing the combined Monday intentions + Friday wins feed. This gives users a sense of community activity between sessions.

---

## PART 5 — WIRING IT ALL TOGETHER

### 5.1 Session Flow Integration

The updated session wrap-up flow should be:
1. Session ends → Feedback (existing)
2. → Give Props (existing, now 30% become echoes)
3. → Cowork Again selection (existing)
4. → "Your session story is ready!" scrapbook preview (new)
5. → Done / navigate home

### 5.2 Home Page Priority

Update the PrimaryActionCard priority logic to include:
- If there's an undelivered gratitude echo ready → show echo card (high priority)
- If it's Monday and no intention set → show Monday Focus
- If it's Friday and no win shared → show Friday Wins
- Existing priorities (pending feedback, upcoming session, etc.) stay

### 5.3 Journey Tab Richness

The Journey tab in Profile should now show a rich timeline mixing:
- Session scrapbook entries (most prominent — these are the story)
- Badges earned
- Achievements unlocked
- Monthly titles
- Milestone celebrations

Each type should have a distinct visual style so the timeline feels varied and alive, not repetitive.

### 5.4 Design Notes

Add `/* DESIGN: ... */` comments throughout explaining WHY each feature exists, especially:
- Why scrapbook auto-generates (users won't manually create memories)
- Why intentions move to RSVP time (arrive with purpose, not fumble during session)
- Why 30% of props are delayed (intermittent reinforcement creates stronger emotional bonds)
- Why rituals are Monday/Friday only (consistent rhythm, not constant noise)
- Why the journey tab mixes all types (your FocusClub story, not a trophy case)

---

## Implementation Notes

- `html2canvas` is already installed for share/screenshot functionality
- `session_intentions` table already exists — use it for RSVP-time intentions
- `peer_props` table already exists — extend it for echo columns
- `session_photos` table already exists — reference photos in scrapbook
- Framer Motion is already installed — use for echo reveal animations and scrapbook card transitions
- All new tables need RLS policies as specified
- All new features should be activity-gated (events_attended thresholds) for progressive disclosure
