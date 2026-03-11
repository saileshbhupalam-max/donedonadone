# FocusClub — Loveable Build Plan (Full Day, Scale Mindset)

## Vision
FocusClub is the social layer for coworking. Members build rich profiles, get matched with compatible people, attend coworking meetups, and answer weekly prompts that deepen connections and improve matching. Starting in HSR Layout, Bangalore — scaling city-wide and beyond.

Not a toy for 60 friends. A real product that works for 60 and for 60,000.

## Pre-Flight
- [ ] Create Loveable project "FocusClub"
- [ ] Settings > Connectors > GitHub > Connect (repo: `focusclub`)
- [ ] Enable Supabase integration

## Loveable Tips
- You have **unlimited prompts today**. Use them freely.
- If something looks wrong: "undo that" or "revert last change"
- If it's struggling: simplify, rephrase, or break into two prompts
- "Make it more [adjective]" works well for design iteration
- After each checkpoint, tell me — I'll review the GitHub repo and give fixes

## What Transfers to Next.js Later
| Loveable (React+Vite) | donedonadone (Next.js) |
|---|---|
| All React components | Copy into components/community/ |
| Tailwind + shadcn/ui | Identical, works as-is |
| Supabase client queries | Same SDK, same patterns |
| Database schema + RLS | Export SQL, run on your Supabase |
| React Router pages | Convert to app/ directory routes |
| VITE_ env vars | Rename to NEXT_PUBLIC_ |

---

# CHECKPOINT 1: Foundation + Auth
**Goal:** Working app shell. Sign in, see navigation, database ready.

## Prompt 1.1 — Landing Page + Brand

```
Build a mobile-first community platform called "FocusClub". It connects people who cowork together — freelancers, startup founders, designers, developers, and remote workers. Starting in HSR Layout, Bangalore, scaling across the city and beyond.

Think of it as "the social layer for coworking" — members build profiles, discover compatible people to work alongside, attend coworking meetups, and answer weekly prompts that help the community get to know each other and improve how we match people into groups.

Design system:
- Warm, minimal, premium. Think "cozy cafe meets modern tech."
- Color palette: warm white (#FEFCF9) background, charcoal (#2D2D2D) text, terracotta (#C47B5A) as primary accent, sage green (#7B9E87) as secondary, soft cream (#F5F0EB) for card backgrounds
- Typography: Inter for body text, DM Serif Display for headings
- Rounded corners (12px on cards), generous whitespace, subtle shadows
- Mobile-first — should feel like a native app on any phone

Build the landing page:
- FocusClub logo (styled text: "Focus" in DM Serif Display + "Club" in Inter light)
- Tagline: "Find your people. Focus together."
- Subtitle: "The community platform for people who cowork — discover your crew, attend meetups, and build real connections."
- "Sign in with Google" button (UI only for now, no auth yet)
- 3 feature cards:
  1. "Smart Matching" — "Get matched with people who work like you"
  2. "Weekly Prompts" — "Build your profile one question at a time"
  3. "Meetups & Events" — "Cowork together at curated sessions"
- Social proof section: "Starting in HSR Layout, Bangalore" with a subtle map pin icon
- Footer: "Built with ☕ in Bangalore"

This needs to feel like a real product landing page — something that makes someone in a WhatsApp group tap the link and immediately want to sign up.
```

## Prompt 1.2 — Auth + Database + App Shell

```
Now wire up the full authentication and app structure.

AUTHENTICATION:
- Supabase Auth with Google OAuth sign-in
- After sign-in: check if profile exists with onboarding_completed = true
  - If no → redirect to /onboarding
  - If yes → redirect to /home
- Auto-create a profile row on first sign-in (via trigger or app logic)
- Auth state should persist on refresh
- Protected routes: all pages except landing require auth, redirect to / if not signed in

DATABASE — Create these Supabase tables:

profiles:
  - id: uuid PK references auth.users(id)
  - email: text
  - display_name: text
  - avatar_url: text
  - tagline: varchar(140)
  - bio: text (longer description, up to 500 chars)
  - what_i_do: text
  - looking_for: text[] (tags)
  - can_offer: text[] (tags)
  - interests: text[] (tags)
  - linkedin_url: text
  - instagram_handle: text
  - twitter_handle: text
  - phone: text
  - gender: text (woman, man, non_binary, prefer_not_to_say)
  - women_only_interest: boolean default false
  - work_vibe: text (deep_focus, casual_social, balanced)
  - noise_preference: text (silent, low_hum, dont_care)
  - communication_style: text (minimal, moderate, chatty)
  - neighborhood: text
  - profile_completion: integer default 0
  - onboarding_completed: boolean default false
  - last_active_at: timestamptz default now()
  - created_at: timestamptz default now()
  - updated_at: timestamptz default now()

RLS on profiles:
  - SELECT: any authenticated user can read all profiles where onboarding_completed = true (plus always their own)
  - INSERT: auth.uid() = id
  - UPDATE: auth.uid() = id
  - Create an index on (onboarding_completed, last_active_at) for directory queries

APP SHELL for authenticated users:
- Bottom nav (fixed) with 5 tabs using lucide-react icons:
  1. Home (House) → /home
  2. Discover (Search) → /discover
  3. Events (Calendar) → /events
  4. Prompts (MessageCircle) → /prompts
  5. Profile (User) → /me
- Style: white bg, subtle top border, glass-morphism (backdrop-blur), terracotta for active tab, muted gray for inactive
- Top bar: "FocusClub" logo text left, notification bell + avatar right
- Create placeholder pages for all 5 routes (just page title centered)
- Add sign-out in /me page

Test that you can sign in with Google, land on /onboarding (since profile isn't complete), and navigate all tabs.
```

## Prompt 1.3 — Polish + Fix

```
Review the auth flow and app shell. Fix any issues:
- Google sign-in should work end-to-end
- After sign-in, new users should go to /onboarding, returning users to /home
- The bottom nav should not show on /onboarding or the landing page
- Make the landing page Google sign-in button look premium (white bg, Google G logo, "Continue with Google", subtle shadow)
- The app shell should have smooth, fast tab switching
- Add a loading state while auth is being determined (subtle spinner or skeleton, not a blank screen)
- Top bar should be sticky on scroll
- Everything should look good on mobile (375px) and tablet (768px) — test both
```

**✅ Checkpoint 1 done when:** Sign in works, nav works, database table exists, onboarding redirect works.

---

# CHECKPOINT 2: Onboarding
**Goal:** New members go through a beautiful wizard that collects everything we need for matching.

## Prompt 2.1 — Onboarding Wizard (All Steps)

```
Build the /onboarding page as a beautiful multi-step wizard. This is the first impression
of FocusClub — it needs to feel personal, warm, and thoughtful. Not a boring form.

Progress: thin progress bar at top (terracotta fill). Step counter: "Step X of 6"

STEP 1 — "Let's start with you"
Micro-copy: "First impressions matter — make yours count"
- Display name (prefill from Google account)
- Avatar: show Google avatar with "Change Photo" button (Supabase Storage upload)
- Tagline input (140 chars, live counter). Placeholder: "Designer by day, guitarist by night"

STEP 2 — "What do you do?"
Micro-copy: "Help us understand your work life"
- "What I do" textarea (300 chars). Placeholder: "I run a design studio focused on brand identity for startups..."
- Work vibe: 3 large tappable cards (single select, selected state = terracotta border + fill):
  🎯 Deep Focus — "Heads-down, get stuff done"
  ☕ Casual Social — "Here for vibes and conversation"
  ⚖️ Balanced — "Depends on the day"

STEP 3 — "Your preferences"
Micro-copy: "Everyone has their own rhythm"
- Gender: 4 horizontal pills — Woman, Man, Non-binary, Prefer not to say
  Helper text: "Helps us offer safe spaces and women-only sessions"
- If "Woman" selected, show smooth reveal of a toggle:
  "I'm interested in women-only meetups" with helper: "We organize women-only coworking sessions. You'll see these in your feed."
- Noise preference: 3 cards — 🤫 Silent, 🎵 Low Hum, 🤷 Don't Care
- Communication style: 3 cards — 🧘 Minimal, ⚡ Moderate, 💬 Chatty
- Neighborhood dropdown: HSR Layout, Koramangala, Indiranagar, BTM Layout, JP Nagar, Jayanagar, Whitefield, Electronic City, Marathahalli, Sarjapur Road, Other

STEP 4 — "Give & Get"
Micro-copy: "The best communities are built on give and take"
- "What are you looking for?" — tag input. Type + Enter to add. Show tappable suggestion chips:
  co-founder, accountability buddy, clients, friends, mentorship, design feedback, tech help, investment, workout buddy, coffee chats, hiring, networking
  Use terracotta colored pills for these tags.
- "What can you offer?" — same UX, different suggestions:
  design help, code reviews, intro to investors, marketing advice, content writing, career advice, hiring help, startup advice, photography, fitness tips, legal advice, fundraising help
  Use sage green colored pills for these tags.

STEP 5 — "Interests & Socials"
Micro-copy: "Almost there! Let's make it easy to connect 🙌"
- Interests: tag input with suggestions — startups, design, coding, fitness, reading, gaming, music, photography, travel, food, investing, AI/ML, crypto, writing, yoga, running, meditation, cooking, parenting, books
- LinkedIn URL (optional, LinkedIn icon, validate starts with linkedin.com)
- Instagram handle (optional, @ prefix shown)
- Twitter/X handle (optional, @ prefix shown)
- Phone (optional). Helper: "For WhatsApp connections only. Never shared without permission."

STEP 6 — "You're in!"
Micro-copy: "Welcome to FocusClub"
- Show a summary card of their profile (avatar, name, tagline, vibe badge, top tags)
- "This is how others will see you" label
- "Looks good — let's go!" primary button
- "Edit something" secondary text link (goes back to relevant step)
- On confirm: set onboarding_completed = true, calculate profile_completion percentage, save everything
- Brief celebration animation (confetti or checkmark)
- Redirect to /home

UX details:
- Each step slides left smoothly on "Next", slides right on "Back"
- "Next" button at bottom (disabled until required fields are filled)
- "Back" as text button, top-left or below Next
- Step 1 requires: display_name
- Step 4 requires: at least 1 looking_for tag
- All other fields optional but encouraged
- Bottom nav should NOT show during onboarding
```

## Prompt 2.2 — Onboarding Polish

```
Polish the onboarding:
- Make the tag input component really nice: when you type and press Enter, the tag should animate in with a subtle pop. Tapping a suggestion chip should also animate it moving from suggestions into the selected area.
- The step 6 summary card should look exactly like how their profile card will appear in the discover page — give them an accurate preview.
- On mobile, when an input is focused and the keyboard opens, the view should scroll so the input stays visible (not hidden behind keyboard).
- The progress bar should animate smoothly between steps (not jump).
- Add subtle background illustrations or patterns to each step (very light, decorative).
- If someone refreshes mid-onboarding, restore their progress (save to localStorage or Supabase as they go).
- Handle edge cases: what if they already completed onboarding and visit /onboarding? Redirect to /home.
```

**✅ Checkpoint 2 done when:** Full onboarding flow works, data saves to Supabase, redirect to /home.

---

# CHECKPOINT 3: Discover (Member Directory)
**Goal:** Browse and find compatible members. This is the core screen — needs to work at 10 members and 10,000.

## Prompt 3.1 — Discover Page

```
Build the /discover page — the core of FocusClub. This is where members find each other.
It needs to work beautifully whether there are 20 members or 20,000.

TOP SECTION:
- Greeting: "Discover" as page title
- Search bar (with search icon): searches across display_name, tagline, what_i_do, looking_for, can_offer, interests
- Debounced (300ms), real-time results

SMART SECTIONS (before the full directory):

Section 1: "Best Matches for You" — horizontal scroll of 6-8 cards
- Calculate compatibility score between current user and each member:
  - Same work_vibe: +20
  - Same neighborhood: +15
  - Same noise_preference: +5
  - Same communication_style: +5
  - Each overlap: viewer's looking_for ↔ member's can_offer: +15
  - Each overlap: viewer's can_offer ↔ member's looking_for: +10
  - Each shared interest: +5
  - Cap at 100
- Show match % on each card (small badge, top right)
- Sort by highest score, exclude self
- Card: avatar, name, tagline, match %, 1-2 top matching reasons as tiny text ("Both looking for: co-founder")

Section 2: "New Members" — horizontal scroll
- Members who joined in the last 14 days
- Card: avatar, name, tagline, "New" badge
- Only show this section if there are new members

FULL DIRECTORY below:
- Section title: "All Members" with count: "(52 members)"
- Filter bar (horizontal scroll of chips):
  - Work vibe: All, 🎯 Deep Focus, ☕ Casual, ⚖️ Balanced
  - For women users only: "👩 Women of FocusClub" chip
- Sort dropdown (top right): "Best Match", "Newest", "Recently Active"
- Grid: 2 columns on mobile, 3 on tablet
- Member card: avatar (48px round), display_name (bold, truncate 1 line), tagline (muted, truncate 1 line), work_vibe badge (small, color-coded), 2 looking_for tags as tiny pills
- Cards link to /profile/:id

PAGINATION:
- Load 20 members at a time
- "Load more" button at bottom (not infinite scroll — it's more controlled)
- Show total count

LOADING: skeleton cards (6 placeholders) while fetching
EMPTY SEARCH: "No members found matching '[query]'. Try different keywords?"
```

## Prompt 3.2 — Discover Polish + Filters

```
Enhance the discover page:

SEARCH IMPROVEMENTS:
- When searching, collapse the "Best Matches" and "New Members" sections and just show search results
- Highlight matching text in results (bold the matching substring in name/tagline)
- Clear search button (X icon) to reset back to normal view
- Show result count: "8 results for 'designer'"

ADDITIONAL FILTERS:
- Add a "Filters" button next to the sort dropdown that opens a bottom sheet/drawer:
  - Looking for: multi-select checkboxes of common tags (co-founder, mentorship, clients, etc.)
  - Can offer: multi-select checkboxes
  - Neighborhood: multi-select checkboxes (all neighborhoods from onboarding list)
  - Interests: multi-select checkboxes of top interests
  - "Apply Filters" button, "Clear All" link
- Show active filter count on the Filters button: "Filters (3)"
- Active filters should combine with search and sort

RESPONSIVENESS:
- On larger screens (tablet/desktop), show 3-column grid and expand the horizontal scroll sections to show more cards
- Search bar should be sticky when scrolling down through the directory
- Pull-to-refresh on mobile
- Smooth card tap animations (subtle scale down on press, release to navigate)
```

**✅ Checkpoint 3 done when:** You can search, filter, sort, and browse members. Smart matching sections show at top. Pagination works.

---

# CHECKPOINT 4: Profiles
**Goal:** Rich profile pages that make you want to connect with someone.

## Prompt 4.1 — Public Profile + Compatibility

```
Build /profile/:id — viewing another member's profile. This page should make you think
"I want to cowork with this person."

HERO SECTION:
- Large avatar (80px, round, with subtle terracotta ring border)
- Display name (DM Serif Display heading)
- Tagline (muted text below name)
- Work vibe badge (color-coded pill)
- "Member since March 2026" small muted text
- Social buttons row (only show ones they've filled):
  LinkedIn (blue), Instagram (gradient), Twitter/X (dark), each opens in new tab
- If same neighborhood: show "📍 Also in HSR Layout" badge

COMPATIBILITY CARD (prominent, between hero and content):
- Calculate same score as discover page
- Show as: large circular progress ring (terracotta fill, animated on load) with % in center
- Label: "Great match!" (75+), "Good fit" (50-74), "Worth a chat" (25-49), "Different vibes" (<25)
- Below ring, show match reasons as bullet points:
  "✓ You're both looking for co-founder"
  "✓ They offer design help (you're looking for it!)"
  "✓ Same work vibe: Deep Focus"
  "✓ Both in HSR Layout"
  Only show top 4 reasons. If no reasons, hide the whole section.

CONTENT SECTIONS (each in a card):
- "What I Do" — their bio/what_i_do text
- "Looking For" — terracotta tag pills
- "Can Offer" — sage green tag pills
- "Interests" — neutral gray tag pills
- "Work Style" — 3 items with friendly labels:
  Noise: "Prefers silence" / "Likes background buzz" / "Flexible"
  Communication: "Keeps it focused" / "Goes with the flow" / "Loves a good chat"
  Vibe: their work_vibe with description

CONNECT SECTION (bottom, sticky or prominent):
- "Message on WhatsApp" button (WhatsApp green, opens wa.me/91{phone} with prefilled
  message "Hey! Found you on FocusClub 👋"). Only show if they have a phone number.
- If no phone: "This member hasn't shared their WhatsApp yet"

NAVIGATION:
- Back button top-left (goes to previous page, not hardcoded to /discover)
- If viewing own profile: show "Edit Profile" button instead of compatibility/connect

LOADING: skeleton version of the full profile while data loads
404: "This person isn't on FocusClub yet. Know them? Send them an invite!" with share button
```

## Prompt 4.2 — Edit Profile (/me)

```
Build /me — edit your own profile. Single scrollable page (not a wizard). All fields
pre-filled with current data.

TOP SECTION:
- Your avatar (large, with "Change Photo" overlay button)
- Profile completion ring: circular progress showing X% complete
- If < 100%: show next action — "Add your LinkedIn to reach 85%" (tappable, scrolls to that field)

SECTIONS (each in a card with a section title):

"Basics":
- Display name
- Tagline (140 char counter)
- Bio / What I do (500 char counter)
- Work vibe selector (3 tappable cards, same as onboarding)

"Preferences":
- Gender (4 pills)
- If woman: women-only meetup interest toggle
- Noise preference (3 cards)
- Communication style (3 cards)
- Neighborhood dropdown

"Looking For & Can Offer":
- Looking for tags (terracotta, same tag input as onboarding)
- Can offer tags (sage green)

"Interests":
- Interest tags (gray, same tag input)

"Socials":
- LinkedIn URL
- Instagram handle
- Twitter handle
- Phone (with WhatsApp helper text)

BOTTOM:
- "Save Changes" sticky button (disabled if no changes, terracotta when active)
- Show toast on save: "Profile updated ✓"
- "Sign Out" text button (muted red, with confirmation dialog)

Profile completion calculation (update on save):
- display_name: 10%
- avatar (non-default): 10%
- tagline: 10%
- what_i_do: 15%
- looking_for (≥1 tag): 10%
- can_offer (≥1 tag): 10%
- work_vibe: 5%
- at least 1 social link: 10%
- interests (≥1): 10%
- gender: 5%
- neighborhood: 5%
Store as profile_completion integer on the profiles table.
```

**✅ Checkpoint 4 done when:** Full profile view with compatibility, edit page, WhatsApp connect, completion tracking.

---

# CHECKPOINT 5: Prompts System
**Goal:** Weekly prompts that build deeper profiles and drive return visits. Must work at scale.

## Prompt 5.1 — Prompts Database + Feed

```
Build the prompts system — weekly questions that help the community get to know each other.
At scale, this is what drives repeat engagement and makes matching smarter.

DATABASE TABLES:

prompts:
  - id: uuid PK
  - question: text
  - category: text (work_style, interests, social, reflection, icebreaker)
  - emoji: text
  - is_active: boolean default false (only ONE prompt active at a time)
  - sort_order: integer (for ordering past prompts)
  - response_count: integer default 0 (denormalized for performance)
  - created_at: timestamptz

prompt_responses:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - prompt_id: uuid FK prompts(id)
  - answer: text (max 500 chars)
  - fire_count: integer default 0 (denormalized)
  - created_at: timestamptz
  - UNIQUE(user_id, prompt_id)

prompt_reactions:
  - id: uuid PK
  - response_id: uuid FK prompt_responses(id)
  - user_id: uuid FK profiles(id)
  - created_at: timestamptz
  - UNIQUE(response_id, user_id)

RLS:
  - prompts: authenticated can SELECT all
  - prompt_responses: authenticated can SELECT all, INSERT/UPDATE own (user_id = auth.uid())
  - prompt_reactions: authenticated can SELECT all, INSERT/DELETE own

SEED 8 PROMPTS (mark #1 as active):
  1. 🎯 "What's one skill you're actively learning right now?" (interests)
  2. ☕ "Describe your perfect coworking day in 3 sentences" (work_style)
  3. 💡 "What side project would you start if you found the right cofounder?" (reflection)
  4. 🤝 "What's something you wish more people in the community knew about you?" (social)
  5. 🎲 "What's your most unpopular work opinion?" (icebreaker)
  6. 🔥 "What are you most excited about working on this month?" (interests)
  7. 🧩 "What's a problem you'd love help solving right now?" (reflection)
  8. 🌟 "Best advice you've ever received about work or life?" (social)

BUILD /prompts PAGE:

TOP — "This Week's Prompt" (large featured card):
  - Emoji + question in DM Serif Display
  - Category badge (colored by type)
  - Response count: "34 answers"
  - If user hasn't answered: textarea (500 char limit + live counter) + "Share Your Answer" button
  - If user has answered: show their answer with "Edit" icon button
  - The answer input should feel inviting, not like a form. Placeholder: "Share your thoughts..."

COMMUNITY ANSWERS (below the prompt card):
  - Tabs: "Recent" | "Most 🔥" | "People Like You"
    - Recent: newest first
    - Most 🔥: sorted by fire_count desc
    - People Like You: sorted by compatibility score with current user desc (reuse matching logic)
  - Each answer card: avatar (40px), display_name (bold, tappable → profile), time ago, answer text
  - 🔥 button on each answer (toggle, show count). Tap to react/unreact.
  - Paginate: show 15 at a time, "Load more" button
  - Your own answer pinned at top with subtle highlight border if it exists

PREVIOUS PROMPTS (below):
  - Collapsible section: "Previous Prompts"
  - List of past prompts: emoji + question + response count + "You answered ✓" or "Answer this →"
  - Tap to expand and see answers (same answer list UI)
  - Users can answer past prompts too (not just the current one)
```

## Prompt 5.2 — Prompts on Profiles + Engagement

```
Integrate prompts throughout the app:

ON PROFILES (/profile/:id):
- Add "Prompt Answers" section after the existing content sections
- Show their 5 most recent answers: emoji + question (small, muted) + answer text
- Show 🔥 count on each
- "See all X answers" link if they have more than 5
- This makes profiles feel alive and gives conversation starters when you meet someone

ON DISCOVER PAGE:
- On member cards in the directory, show a small "💬 X" indicator for how many
  prompts they've answered. More answers = more active member. Show this subtly.
- In the "Best Matches" section, if a match has answered the same prompt as you,
  show a tiny "Both answered: [prompt emoji]" indicator

ENGAGEMENT FEATURES:
- After submitting an answer, show a brief animation and then: "See what others said →"
  button that scrolls to community answers
- If it's someone's first prompt answer, show a mini celebration: "First answer! 🎉
  You're building your FocusClub identity."
- "Most Active Voices" section at top of /prompts page: horizontal scroll of top 5
  members by prompt answer count this month (avatar + name + count). Links to profiles.
```

**✅ Checkpoint 5 done when:** Full prompts system — answer, browse, react, fire reactions, shown on profiles, leaderboard.

---

# CHECKPOINT 6: Events & Meetups
**Goal:** Event system with women-only support. Works for 5 events/week or 50.

## Prompt 6.1 — Events Database + Page

```
Build the events system. This is how FocusClub members find and attend coworking meetups.

DATABASE TABLES:

events:
  - id: uuid PK
  - title: text
  - description: text
  - date: date
  - start_time: text (e.g. "10:00 AM")
  - end_time: text (e.g. "1:00 PM")
  - venue_name: text
  - venue_address: text
  - neighborhood: text (same list as profiles)
  - whatsapp_group_link: text
  - max_spots: integer (nullable — null means unlimited)
  - women_only: boolean default false
  - created_by: uuid FK profiles(id)
  - rsvp_count: integer default 0 (denormalized)
  - created_at: timestamptz

event_rsvps:
  - id: uuid PK
  - event_id: uuid FK events(id)
  - user_id: uuid FK profiles(id)
  - status: text (going, interested)
  - created_at: timestamptz
  - UNIQUE(event_id, user_id)

RLS — THIS IS CRITICAL FOR WOMEN-ONLY:
  - events SELECT: authenticated users can see events WHERE:
    women_only = false
    OR (women_only = true AND exists(select 1 from profiles where id = auth.uid() and gender = 'woman'))
  - This means women-only events are INVISIBLE to non-women. No "access denied", they just don't exist in queries.
  - event_rsvps: authenticated can read RSVPs for events they can see. INSERT/UPDATE/DELETE own.
  - events INSERT: any authenticated user. UPDATE/DELETE: only created_by.

BUILD /events PAGE:

TOP TABS: "Upcoming" | "Past"

UPCOMING SECTION:
- Filter chips (horizontal scroll):
  - "All Events"
  - Neighborhood filters: "HSR Layout", "Koramangala", etc. (only show neighborhoods that have events)
  - For women: "👩 Women Only" filter chip
- Event cards (vertical list):
  - Title (bold)
  - Date + time: "Sat, Mar 15 · 10:00 AM - 1:00 PM"
  - Venue + neighborhood: "Third Wave Coffee, HSR Layout"
  - Women-only badge (sage green "Women Only" pill) if applicable
  - Description (2 lines, truncated)
  - RSVP status: "Going ✋" / "Interested 👀" toggle buttons
  - Attendee info: "8 going · 3 interested" + avatar stack (first 5 going)
  - If max_spots: "8 of 15 spots" progress bar
  - Tap card → /events/:id detail page

PAST SECTION:
- Same card layout but muted styling
- Show "X attended" instead of RSVP buttons
- Collapsed by default, expandable

EMPTY STATE: "No upcoming events yet. Why not create one?" with CTA

FLOATING "+" BUTTON (bottom right, above nav):
- Opens event creation form as a modal/sheet:
  - Title, Description, Date picker, Start time, End time
  - Venue name, Venue address, Neighborhood dropdown
  - Max spots (optional — leave empty for unlimited)
  - WhatsApp group link (optional)
  - Women-only toggle (ONLY visible if creator's gender = woman)
  - "Create Event" button
- After creation: redirect to the new event's detail page

Seed 3 events: 1 upcoming regular, 1 upcoming women-only, 1 past.
```

## Prompt 6.2 — Event Detail Page

```
Build /events/:id — the event detail page.

HEADER:
- Back button
- Title (large, DM Serif Display)
- Women-only badge if applicable (sage green)
- Date + time prominently: "Saturday, March 15, 2026 · 10:00 AM - 1:00 PM"
- Venue name + address (address tappable → opens Google Maps)
- Neighborhood badge
- Created by: avatar + name of creator (tappable → their profile)

RSVP SECTION (prominent card):
- Big "I'm Going ✋" / "I'm Interested 👀" buttons (toggle)
- If already RSVPed: show status with option to change or cancel
- Spots: "8 of 15 spots filled" with progress bar (only if max_spots set)
- If full: "Event is full — join waitlist" (just mark as interested)

DESCRIPTION:
- Full event description text

WHO'S GOING (section):
- Grid of attendee cards: avatar + name (tappable → profile)
- Grouped: "Going (8)" and "Interested (3)" as sub-sections
- "See all attendees" if more than 12

WHATSAPP GROUP:
- If link provided: "Join Event Group Chat" button (WhatsApp green, opens link)

SHARING:
- "Share Event" button that copies text for WhatsApp:
  "🎯 [title] — [date] at [venue]. Join on FocusClub: [link]"

If event is past: show "This event has ended" banner, hide RSVP buttons, show "X attended" list

If event doesn't exist: 404 page
```

## Prompt 6.3 — Events Polish

```
Polish the events system:
- Upcoming events should show contextual timing: "Tomorrow!", "In 3 days", "Next Saturday"
- Past events: "2 weeks ago", "Last month"
- Animate RSVP button state changes (smooth toggle, not jarring)
- Event cards should be sorted by date (soonest first for upcoming, most recent for past)
- On the home page (we'll build /home next), we'll want to show upcoming events — for now just make sure the events data fetching is clean and reusable
- Add a "Going to X upcoming events" stat that we can show on profiles later
- If someone creates a women-only event, auto-tag it so only women can see it (should already work via RLS, but verify)
- The event creation form should validate: title required, date required, date must be in future
- After RSVP change, immediately update the count and attendee list (optimistic UI)
```

**✅ Checkpoint 6 done when:** Full events with RSVP, women-only gating via RLS, event creation, detail pages.

---

# CHECKPOINT 7: Home Feed + Retention
**Goal:** The home page that brings people back every day. Smart, personalized, not noisy.

## Prompt 7.1 — Home Feed

```
Build /home — the first thing members see when they open FocusClub. This is the retention
engine. It should feel personal and give people a reason to come back.

This page should NOT be a generic activity feed. It's curated cards, each with a purpose.

GREETING:
- "Hey, [first name] 👋" (large, DM Serif Display)
- "Here's what's happening in your community" (muted subtitle)

CARD 1: "This Week's Prompt" (always show if there's an active prompt)
- Emoji + question text
- If not answered: "Share your answer →" CTA button
- If answered: "You answered ✓ · See 28 other answers →"
- Links to /prompts

CARD 2: "Your Next Meetup" (show if user has an upcoming RSVP)
- Event title, date, venue, "X others going"
- Links to /events/:id
- If no upcoming RSVP: "Find a meetup →" linking to /events

CARD 3: "New Faces" (show if new members in last 14 days)
- Horizontal scroll of new member mini-cards (avatar + name + tagline)
- "X new members this week" header
- Tappable → profile

CARD 4: "Top Matches" (always show)
- Horizontal scroll of top 5 compatibility matches
- Avatar + name + match % badge
- "Why you match" single line: "Both looking for co-founder"
- "See all matches →" links to /discover sorted by Best Match
- Exclude people they've already viewed (or just show the top matches, fine for now)

CARD 5: "Community Pulse" (small stats card)
- "[X] members · [X] prompt answers this week · [X] events this month"
- Subtle, informational, at the bottom

CARD 6: "Complete Your Profile" (only show if profile_completion < 80%)
- Progress bar showing completion %
- "Add [next recommended field] to reach X%" with arrow
- Links to /me

Design: each card should feel distinct but cohesive. Use the cream card backgrounds,
rounded corners, subtle shadows. Generous spacing between cards. The page should feel
like opening a thoughtful newsletter, not a social media feed.
```

## Prompt 7.2 — Badges & Activity

```
Add a badges/achievements system to drive engagement.

DATABASE TABLE:
member_badges:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - badge_type: text
  - earned_at: timestamptz default now()
  - UNIQUE(user_id, badge_type)

BADGE TYPES:
  - "early_adopter" — joined within first 30 days of launch
  - "complete_profile" — profile_completion = 100%
  - "first_prompt" — answered first prompt
  - "prompt_streak_3" — answered 3 different prompts
  - "prompt_streak_all" — answered all available prompts
  - "first_event" — RSVPed "going" to first event
  - "regular" — RSVPed going to 3+ events
  - "og" — RSVPed going to 10+ events
  - "connector" — has all 3 social links filled
  - "fire_starter" — received 10+ total 🔥 reactions on prompt answers
  - "community_voice" — one of their prompt answers got 5+ 🔥

BADGE DISPLAY:
- Each badge: emoji icon + name + description
  🌱 Early Adopter — "Joined FocusClub early"
  ✅ Complete Profile — "Filled out everything"
  💬 First Words — "Answered your first prompt"
  🔥 On a Roll — "Answered 3 prompts"
  📝 Prolific — "Answered every prompt"
  🎪 First Meetup — "Signed up for your first event"
  🏃 Regular — "Attended 3+ events"
  👑 OG — "Attended 10+ events"
  🔗 Connector — "All socials linked"
  ⚡ Fire Starter — "10+ reactions received"
  🌟 Community Voice — "A prompt answer went viral"

ON /me PAGE:
- "My Badges" section: earned badges (full color with date earned), unearned (grayed out with hint: "Answer 3 prompts to earn this")

ON /profile/:id:
- Show earned badges as small icons in a row in the hero section (below tagline)
- Tap a badge to see its name and when earned (tooltip or small modal)

AWARDING:
- Check badge conditions after relevant actions (answer prompt → check prompt badges, RSVP → check event badges, save profile → check profile badges)
- When a new badge is earned, show a toast/modal celebration: "🎉 You earned: [badge name]!"
```

## Prompt 7.3 — Notifications

```
Add an in-app notification system.

DATABASE TABLE:
notifications:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - type: text (new_prompt, new_event, badge_earned, new_member_match, fire_received)
  - title: text
  - body: text
  - link: text (route to navigate to on tap)
  - read: boolean default false
  - created_at: timestamptz

RLS: users can only see and update their own notifications.

NOTIFICATION BELL (in top bar):
- Bell icon with red dot + unread count badge when there are unread notifications
- Tap opens a drawer/sheet from right:
  - "Notifications" header + "Mark all read" link
  - List of notifications, newest first
  - Unread: subtle cream highlight background
  - Read: white/transparent background
  - Each notification: icon (by type), title (bold), body, time ago
  - Tappable → navigates to the link route and marks as read

TRIGGER NOTIFICATIONS (create rows in the notifications table):
- "new_prompt": when active prompt changes → notify all members
  Title: "New weekly prompt! [emoji]"
  Body: first 60 chars of the question + "..."
  Link: /prompts

- "badge_earned": when user earns a badge
  Title: "Badge earned! [badge emoji]"
  Body: badge description
  Link: /me

- "fire_received": when someone 🔥 reacts to your prompt answer
  Title: "[name] loved your answer"
  Body: first 60 chars of your answer + "..."
  Link: /prompts

For now, trigger these in the app (client-side after relevant actions).
We can move to server-side triggers later.
```

**✅ Checkpoint 7 done when:** Home feed with personalized cards, badges system, notifications with bell icon.

---

# CHECKPOINT 8: Polish & Scale Readiness
**Goal:** Make everything feel cohesive, handle edge cases, dark mode, admin basics.

## Prompt 8.1 — Dark Mode

```
Add dark mode support across the entire app.

Dark palette:
- Background: #1A1A1A
- Card backgrounds: #262626
- Text: #F5F0EB (warm off-white)
- Muted text: #9A9A9A
- Terracotta accent: #C47B5A (same — it works on dark)
- Sage green: #7B9E87 (same)
- Borders: #333333
- Input backgrounds: #2D2D2D

On /me page: add a "Theme" toggle — Light / Dark / System (match device preference)
Store in localStorage + apply immediately.

Go through EVERY page and make sure dark mode looks good:
- Landing page
- Onboarding wizard
- Home feed
- Discover directory + member cards
- Profile pages
- Prompts feed + answer cards
- Events page + event cards + event detail
- Edit profile
- Notification drawer
- All modals, sheets, toasts, dropdowns
- Bottom nav and top bar
- Loading skeletons
- Empty states

The dark mode should feel warm, not cold. It's a cozy dark, not a stark black.
Use the warm off-white for text, not pure white.
```

## Prompt 8.2 — UX Polish Pass

```
Do a comprehensive UX polish pass across the entire app:

LOADING STATES:
- Every page should have skeleton loading (not spinners). Skeletons should match the shape of actual content.
- Skeleton colors: light gray pulse on light mode, dark gray pulse on dark mode

AVATARS:
- All avatars should have a fallback: colored circle with user's initials (first letter of first + last name)
- Avatar colors based on user ID (consistent per user — hash the ID to pick from a set of 8 warm colors)

ANIMATIONS:
- Page transitions: subtle fade-in (200ms)
- Card interactions: slight scale on press (0.98), release to navigate
- Toast notifications: slide in from top, auto-dismiss after 3 seconds
- Modal/sheet open: slide up with backdrop blur

ERROR STATES:
- Network error: "Something went wrong. Pull to refresh or try again."
- Empty states should all have illustrations or friendly copy (not just blank)

TYPOGRAPHY:
- Make sure DM Serif Display is used consistently for all page headings
- Inter for everything else
- Check font sizes are readable on small phones (min 14px body text)

MOBILE UX:
- All tap targets minimum 44px
- No horizontal overflow on any page (test at 320px width)
- Bottom nav should have safe area padding for phones with home indicator
- Forms should scroll properly when keyboard opens

TOASTS:
- Use consistent toast style across the app for: save success, error, badge earned, RSVP change
- Terracotta background for success, red for error, sage for info
```

## Prompt 8.3 — Simple Admin

```
Add a simple admin panel at /admin. Gate access by checking if the user's email
is in a hardcoded ADMIN_EMAILS array (use: "sailesh@focusclub.in" — I'll update this later).

If non-admin tries to access /admin, redirect to /home.
Don't show /admin in the bottom nav — it's a hidden route.

ADMIN DASHBOARD:
- Total members (completed onboarding)
- New members this week
- Active prompt response rate (% who answered current prompt)
- Total events (upcoming + past)
- Avg profile completion %

MEMBER MANAGEMENT:
- Searchable table of all members: name, email, joined date, profile completion %,
  prompts answered, events RSVPed, last active
- Sortable by any column
- Click row → view their profile (regular /profile/:id)

PROMPT MANAGEMENT:
- List all prompts with: question, status (active/inactive), response count
- "Set Active" button to change the active prompt
- "Create Prompt" form: emoji, question, category dropdown
- Only 1 prompt can be active at a time

EVENT OVERVIEW:
- List upcoming events: title, date, RSVP count, women-only flag, creator
- List past events with attendance

EXPORT:
- "Export Members CSV" button — downloads: name, email, joined, profile completion, neighborhood, work vibe, prompts answered, events attended
```

## Prompt 8.4 — Final Review

```
Do a complete end-to-end review. Go through every user flow and fix anything broken:

1. LANDING → Sign in with Google → Onboarding (all steps) → Home feed
2. HOME → Browse prompt → Answer → See community answers → React 🔥
3. HOME → Discover → Search "designer" → Filter by Deep Focus → View profile → WhatsApp connect
4. HOME → Events → RSVP to event → View event detail → See attendees
5. HOME → Create event → Fill form → See it in events list
6. HOME → Edit profile → Change tags → Save → View own profile → Verify changes
7. Check notifications bell → Read notifications
8. Toggle dark mode → verify all pages
9. Check admin panel → all stats load → export CSV works
10. Sign out → Sign back in → should go to /home (not onboarding)

For women users specifically:
11. Onboarding → Select "Woman" → See women-only toggle
12. Events → See women-only events → Women Only filter works
13. Discover → "Women of FocusClub" filter chip works
14. Create event → Women-only toggle visible

Fix any bugs, broken layouts, missing data, or console errors.
Make sure the app feels like a real product someone would be proud to share in a WhatsApp group.
```

**✅ Checkpoint 8 done when:** Everything works end-to-end, dark mode, admin panel, no bugs.

---

# CHECKPOINT 9 (Bonus): Growth Features
**If you still have time and energy.**

## Prompt 9.1 — Invite System

```
Add a member invite system to help FocusClub grow organically.

On /me page, add "Invite Friends" section:
- Personal invite link: focusclub.app/invite/[user_id_short] (just generate the URL format,
  actual domain doesn't matter)
- "Copy Link" button
- "Share on WhatsApp" button — opens WhatsApp with pre-filled message:
  "Hey! I'm on FocusClub — a community for people who cowork in Bangalore.
  Come join: [invite link]"
- Show count: "You've invited X people" (track via referral_code on profiles)

On landing page: if someone arrives via /invite/:code, show:
- "You were invited by [name]!" with their avatar
- "Join FocusClub" sign-in button (slightly warmer CTA)

DATABASE: add to profiles:
  - referred_by: uuid FK profiles(id) nullable
  - referral_code: text unique (generate short code from ID)

After a referred user completes onboarding, award the referrer a "🤝 Recruiter" badge.
```

## Prompt 9.2 — Request Women-Only Meetup

```
Add a feature where women can request/suggest a women-only meetup.

On /events page, for women users, add a card at the top:
"Want a women-only session? Let us know when works for you."
"Request a Session →" button

Tap opens a simple form (bottom sheet):
- Preferred day: checkboxes for days of week
- Preferred time: Morning (9-12), Afternoon (12-4), Evening (4-8)
- Preferred neighborhood: dropdown
- Any notes (optional textarea)
- "Submit Request" button

Save to new table:
session_requests:
  - id, user_id, request_type (women_only for now, but extensible),
    preferred_days text[], preferred_time text, neighborhood text,
    notes text, status (pending/fulfilled), created_at

Show in admin panel: list of session requests with ability to mark as fulfilled.
When 3+ women request similar times/neighborhoods, the admin knows to create that event.
```

## Prompt 9.3 — Rich Discover Sections

```
Enhance the /discover page with more smart sections for better discovery at scale:

Add these sections (below "Best Matches" and "New Members", above "All Members"):

"In Your Area: [neighborhood]" — members in the same neighborhood as the viewer
- Horizontal scroll cards, same as Best Matches but filtered by neighborhood
- Only show if 3+ members in same neighborhood

"Can Help With What You Need" — members whose can_offer overlaps with viewer's looking_for
- Show with match reason: "Offers: design help, intro to investors"
- This is the most valuable connection type — make these cards slightly larger/prominent

"Same Vibe" — members with same work_vibe
- Horizontal scroll, show vibe badge prominently

"Active This Week" — members who answered the current prompt or RSVPed to an upcoming event
- Shows engaged community members, sorted by last_active_at
- Helps surface people who are actually active, not dormant profiles
```

**✅ Checkpoint 9 done when:** Invite system, women-only session requests, richer discovery.

---

# CHECKPOINT 10: Status Game Engine + Analytics
**Goal:** Build a complete status-as-a-service system inspired by Eugene Wei's framework. Focus Hours as the primary status currency, multiple status ladders, scarce monthly titles, visual rank progression, leaderboards, and privacy controls. Plus admin analytics.

## Prompt 10.1 — The Status Game: Focus Hours, Ranks, Leaderboards, Visual Progression

```
Build a comprehensive status and gamification system for FocusClub. This is designed using the "Status as a Service" framework — status must be EARNED through real proof of work (actually showing up and coworking), it must be SCARCE (not everyone gets every badge), it must be VISIBLE (others can see your rank at a glance), and it must REFRESH (monthly competitions keep people coming back).

## THE PRIMARY STATUS CURRENCY: FOCUS HOURS

Track cumulative deep work hours as the core status metric. This is FocusClub's equivalent of a follower count — but it can't be faked because it requires physically attending sessions.

DATABASE — add columns to profiles:
  ALTER TABLE profiles ADD COLUMN focus_hours numeric(7,1) DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN focus_rank text DEFAULT 'Newcomer';
  ALTER TABLE profiles ADD COLUMN show_linkedin boolean DEFAULT true;
  ALTER TABLE profiles ADD COLUMN show_instagram boolean DEFAULT true;
  ALTER TABLE profiles ADD COLUMN show_twitter boolean DEFAULT true;

FOCUS HOURS CALCULATION:
- When a member submits event feedback with attended = true:
  - Calculate session duration from the event's start_time and end_time
  - For structured_4hr events: count 3 hours (deep work phases only, not breaks)
  - For structured_2hr events: count 1.33 hours (deep work only)
  - For casual events: count full event duration
  - Add to their focus_hours on profiles
  - Recalculate their focus_rank

## LIFETIME RANKS (earned through cumulative hours — never lost)

These are permanent tiers. Once earned, they stay forever. Each rank CHANGES HOW YOUR PROFILE LOOKS — this is the key visual status signal.

RANK TIERS:
  0-5 hours: 🌱 "Newcomer"
    - Avatar ring: none
    - Card style: standard
  5-15 hours: ⚡ "Getting Started"
    - Avatar ring: thin sage green (#7B9E87) border
    - Card style: subtle sage green left border accent
  15-35 hours: 🔥 "Regular"
    - Avatar ring: thin terracotta (#C47B5A) border
    - Card style: terracotta left border accent
  35-75 hours: 💎 "Deep Worker"
    - Avatar ring: thick terracotta border (3px)
    - Card style: terracotta left border + subtle cream gradient background
  75-150 hours: 🏆 "Elite"
    - Avatar ring: thick gold (#D4A853) border
    - Card style: gold left border + warm gradient background
  150+ hours: 👑 "Grandmaster"
    - Avatar ring: thick gold border + subtle glow/shadow effect
    - Card style: gold border on all sides + premium gradient background

VISUAL RANK INDICATORS — apply EVERYWHERE the member appears:
- Discover cards: avatar gets the ring, rank badge shows below name
- Profile page: large avatar with ring, rank badge next to name prominently
- Home page greeting: "Hey Priya 👋 · 💎 Deep Worker"
- Event attendee lists: avatar rings visible
- Prompt answers: avatar rings visible
- Leaderboard: rank emoji + name

The point: you should be able to GLANCE at any member card and immediately know their approximate status. This creates aspiration ("I want that gold ring") and recognition ("That person is serious about focused work").

RANK PROGRESS ON /me:
- Show current rank badge (large, with emoji + label)
- Progress bar to next rank: "23.5 more hours to reach 🏆 Elite"
- Percentage: "You're 68% of the way to Elite"
- Motivational copy that changes per rank:
  - Newcomer: "Every hour of focused work counts. Keep going!"
  - Getting Started: "You're building a habit. The hardest part is starting."
  - Regular: "You're in the groove now. The community sees your commitment."
  - Deep Worker: "Top 20% of FocusClub. You're inspiring others."
  - Elite: "Among the most dedicated members. Legendary status awaits."
  - Grandmaster: "You've reached the summit. The community looks up to you."

## MONTHLY TITLES (scarce, competitive, reset every month)

This is the STATUS GAME. Monthly titles create recurring competition and keep people coming back. They reset on the 1st of every month — last month's champion must earn it again.

DATABASE TABLE — monthly_titles:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - title_type: text CHECK (title_type IN (
      'focus_champion', 'rising_star', 'most_loved',
      'community_voice', 'connector', 'session_mvp'
    ))
  - month: text (e.g., '2026-03')
  - value: numeric (the metric that earned them the title)
  - created_at: timestamptz
  - UNIQUE(title_type, month) — only ONE winner per title per month

TITLES (only 1 winner each, per month):
  🏆 "Focus Champion" — most focus hours logged this month
  🚀 "Rising Star" — biggest increase in focus hours vs previous month (rewards newcomers!)
  💛 "Most Loved" — most props received this month
  🌟 "Community Voice" — most 🔥 on prompt answers this month
  🤝 "Connector" — most successful referrals this month
  ⭐ "Session MVP" — highest average props-per-session this month (min 2 sessions)

WHY "Rising Star" MATTERS: This is the "new money" mechanic from StaaS. Even if a Grandmaster dominates Focus Champion, a brand new member who goes from 0 to 20 hours can win Rising Star. This keeps status mobility HIGH — critical for retaining new members.

TITLE DISPLAY:
- On /me: "Your Titles" section showing all monthly titles won (with month labels)
  - "🏆 Focus Champion — March 2026" (with gold card background)
- On /profile/:id: most recent title shown as a prominent banner below name
  - "[Name] is March 2026's 🏆 Focus Champion"
- On discover cards: if they hold a current-month title, show a small crown/star indicator

MONTHLY TITLE ANNOUNCEMENT:
- On the 1st of each month (or when admin triggers it), calculate winners
- Create notification for ALL members: "🏆 March 2026 titles are in! [Name] is Focus Champion with [X] hours"
- Create notification for winners: "You won 🏆 Focus Champion for March 2026! Share your achievement →"
- Show a special card on /home for the first 3 days of each month: "March Leaderboard is Final" with winners listed

CALCULATION: Run title calculation based on data from the previous calendar month. For the MVP, calculate on page load if it's the first 3 days of a new month and titles haven't been calculated yet. Store the results.

## EXCLUSIVE ACHIEVEMENTS (one-time, scarce, some can only be earned by ONE person EVER)

DATABASE TABLE — exclusive_achievements:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - achievement_type: text
  - achieved_at: timestamptz
  - UNIQUE(user_id, achievement_type)
  - For "first_to_X" types: also UNIQUE(achievement_type) — only one person ever

ACHIEVEMENTS:

Time-Limited (expire after a date — creates urgency):
  🌱 "OG Member" — joined FocusClub in the first 3 months (before June 2026)
    After June 2026, this badge can NEVER be earned. Creates FOMO for early adopters.
    This already partially exists as "early_adopter" — rename and emphasize it.

  🏖️ "Summer Grinder 2026" — logged 30+ focus hours in June-August 2026
    Seasonal badge. Shows dedication during a specific period.

First-To (only ONE person can ever earn these — ultimate scarcity):
  🥇 "First to 50" — first person to reach 50 focus hours
  🥇 "First to 100" — first person to reach 100 focus hours
  🥇 "First to 200" — first person to reach 200 focus hours
  🥇 "Century Props" — first person to receive 100 props
  Show on profile with "The ONLY person to earn this" tooltip

Difficulty-Based (hard but not exclusive):
  ⚡ "Perfect Month" — attended at least 1 session every week of a calendar month (4+ sessions)
  🔥 "Iron Streak" — maintained a 10+ session streak
  💎 "Triple Threat" — held a monthly title 3 different months (not necessarily consecutive)
  🌟 "Full House" — earned all 6 different monthly title types (lifetime)
  🤝 "Squad Goals" — coworked with the same person 5+ times

Display exclusive achievements on /me and /profile/:id in a special "Achievements" section with a locked/unlocked visual (like gaming achievement lists). Locked ones show: "?" + hint text + "Only [X] people have earned this" or "No one has earned this yet — be the first!"

## LEADERBOARDS

Add a "🏆 Leaderboard" section to /discover page (above "All Members", below smart sections).

TABS: "This Month" | "All Time"

LEADERBOARD CARDS (horizontal scroll of top 10):
  - Rank number (#1, #2, #3 in gold/silver/bronze, rest in gray)
  - Avatar with rank ring
  - Display name
  - Focus hours (large number)
  - Rank badge
  - If it's you: highlighted background + "You" label

"This Month" leaderboard:
  - Focus hours logged THIS calendar month only
  - "You're #[X] of [total active] · [X] hours behind #[X-1]" motivational text
  - This is the competitive driver — resets monthly

"All Time" leaderboard:
  - Total focus hours lifetime
  - "You're #[X] of [total]" text
  - This is the legacy/reputation builder

YOUR POSITION (if not in top 10):
  - Show a card at the end: "You · #[X] · [hours] hours"
  - "X hours to reach top 10" if they're close

LEADERBOARD ON HOME PAGE:
  - Small card: "🏆 Leaderboard" with top 3 avatars + "You're #[X]"
  - Tappable → scrolls to leaderboard on /discover

## PERSONAL STATS ON /me

Add "Your FocusClub Journey" section (below badges, above achievements). Always expanded.

STAT CARDS (2-column grid, warm design):
  - 🕐 Focus Hours: [X.X] hrs — large number, with rank badge + progress bar to next rank
  - 🔥 Session Streak: [X] — current streak with flame animation if active (>0)
  - 📅 Sessions Attended: [X] total
  - 👥 People Met: [X] unique co-attendees (count DISTINCT users at same events)
  - 💬 Prompts Answered: [X] of [Y] available
  - ⚡ Props Received: [X] total (with top prop type emoji)
  - 🔥 Fires Received: [X] total on prompt answers
  - 👀 Profile Views: [X] this month

PROFILE VIEWS TRACKING:
DATABASE TABLE — profile_views:
  - id: uuid PK
  - viewer_id: uuid FK profiles(id)
  - viewed_id: uuid FK profiles(id)
  - viewed_at: date DEFAULT CURRENT_DATE
  - UNIQUE(viewer_id, viewed_id, viewed_at) — max one view per person per day

RLS: Any authenticated user can INSERT. Users can only SELECT where viewed_id = auth.uid() — you see the COUNT of who viewed you, not WHO. Privacy preserved.

Track a view every time /profile/:id loads (where viewer ≠ viewed person).

MOST POPULAR ANSWER (below stat grid):
- "Your Most Popular Answer" card
- Show the prompt question (emoji + text, small muted)
- Their answer text
- 🔥 count prominently
- Only show if they have an answer with fire_count > 0

MONTHLY COMPARISON (subtle, motivational):
- "vs last month: +12.5 hours · +3 sessions · +8 props"
- Green arrows for improvements, neutral for same, orange for declines
- Never use red or negative language — always frame as opportunity

## FOCUS HOURS + RANK ON PUBLIC PROFILES (/profile/:id)

On other members' profiles, show:
- Rank badge PROMINENTLY next to name: "Priya 💎 Deep Worker"
- "🕐 87.5 Focus Hours" stat line (below tagline)
- Avatar with rank-appropriate ring
- If they hold a current monthly title: banner below name — "March 2026 🏆 Focus Champion"
- Exclusive achievements section (if any)
- If viewer and this member attended the same events: "You've coworked together [X] times" (builds connection)

## PRIVACY CONTROLS

ON /me — "Socials & Contact" section:
- Each social link has a visibility toggle next to it:
  - LinkedIn URL + "Show on profile" toggle (default ON)
  - Instagram handle + "Show on profile" toggle (default ON)
  - Twitter handle + "Show on profile" toggle (default ON)
- Phone / WhatsApp — NO toggle. Instead show:
  - Phone input field
  - 🔒 icon + text: "Your number is NEVER shown on your profile. When someone taps 'Message on WhatsApp', they contact you through a link — your number stays hidden until you choose to reply."
  - This is critical for safety, especially for women members.

ON /profile/:id — respect visibility:
- Only show LinkedIn button if show_linkedin = true
- Only show Instagram button if show_instagram = true
- Only show Twitter button if show_twitter = true
- NEVER display phone numbers anywhere on any profile
- The WhatsApp "Message" button uses wa.me deep link format (number isn't exposed visually)

## STATUS NOTIFICATIONS (social graph amplification)

When someone reaches a new rank, notify ALL members:
  "🎉 [Name] just reached 💎 Deep Worker status! They've logged [X] focus hours."
  Link: /profile/:id

When someone earns an exclusive achievement:
  "🥇 [Name] is the first person to reach 100 focus hours! Legendary."
  Link: /profile/:id

When monthly titles are announced:
  Notify all: "🏆 [Month] titles are in! Focus Champion: [Name] ([X] hrs). Rising Star: [Name]. Most Loved: [Name]."
  Link: /discover (leaderboard section)

When someone passes you on the monthly leaderboard:
  "📈 [Name] just passed you on this month's leaderboard. You're now #[X]."
  Link: /discover

These notifications create aspiration and FOMO — core StaaS mechanics. They make other people's status visible, which drives everyone to participate more.

## THE STATUS FLYWHEEL (how this drives retention)

The design creates a self-reinforcing loop:
1. Attend session → earn focus hours → rank up → get visible status
2. Higher rank → more profile views → more social validation → attend more
3. Monthly titles reset → must keep attending to maintain status
4. "Rising Star" rewards velocity → new members can compete immediately
5. Exclusive achievements → early members have unrepeatable badges → drives urgency to join NOW
6. Leaderboard → competitive tension → "I'm 3 hours behind #5" → book another session
7. Props from peers → social proof that can't be faked → others want the same recognition

Make this feel warm and aspirational, not toxic or stressful. FocusClub is about celebrating focused work, not creating anxiety. Use encouraging language throughout. The leaderboard should feel like a celebration wall, not a ranking of worth.
```

**✅ Prompt 10.1 done when:** Focus hours track after feedback, ranks with visual avatar rings show everywhere, monthly titles calculate and announce, exclusive achievements work, leaderboards on discover page, stats on /me, privacy toggles on socials, status notifications fire.

---

## Prompt 10.2 — Admin Analytics + Status Game Management

```
Enhance the admin dashboard with comprehensive analytics and tools to manage the status game.

CHARTS (use recharts or any chart library):

OVERVIEW TAB — add these charts:
- Member growth: line chart of cumulative members over time (by week)
- Focus hours: line chart of total community focus hours over time (weekly)
- Prompt engagement: bar chart of response count per prompt
- Events: bar chart of RSVP count per event (upcoming + recent)
- Neighborhoods: pie chart of member distribution by neighborhood
- Work vibes: pie chart of member distribution by work_vibe
- Rank distribution: horizontal bar chart showing how many members at each rank tier

TABLES:
- Most active members this month (by focus hours this month) — top 20
- Most connected (highest avg compatibility score) — top 20
- Members who haven't been active in 30+ days (re-engagement targets)
- Women-only event stats: attendance rates, request count

STATUS GAME TAB (new tab in admin):

Monthly Titles Management:
- Show current month's leaderboard for each title category:
  - Focus Champion candidates (top 5 by hours this month)
  - Rising Star candidates (top 5 by month-over-month improvement)
  - Most Loved candidates (top 5 by props received this month)
  - Community Voice candidates (top 5 by prompt 🔥 this month)
  - Connector candidates (top 5 by referrals this month)
  - Session MVP candidates (top 5 by props-per-session this month)
- "Announce Winners" button — calculates final winners for previous month and sends notifications
- History: past month winners in a table

Exclusive Achievements:
- List of all achievement types with: who earned it (if anyone), when
- "First to X" achievements: show current leader and how close they are
- Ability to create new seasonal achievements: name, emoji, description, criteria text, start_date, end_date

Rank Distribution:
- Bar chart: how many members at each rank
- Table: members who ranked up this month (celebration list)
- Average focus hours per member (overall and this month)

EXPORT:
- "Export Members CSV" button — downloads: name, email, joined date, focus_hours, focus_rank, sessions_attended, current_streak, props_received, prompts_answered, profile_completion, neighborhood, work_vibe, referral_count, last_active_at

This gives you the data to see if the status game is healthy: Are new members earning status? Are ranks well-distributed? Are monthly titles competitive or dominated by one person?
```

**✅ Checkpoint 10 done when:** Full status game with focus hours + ranks + visual progression + monthly titles + exclusive achievements + leaderboards + personal stats + privacy controls + admin analytics with charts + status game management tools.

---

# CHECKPOINT 11: Peer Props + Session Experience Engine
**Goal:** Transform events from casual meetups into structured, memorable coworking sessions with peer recognition, timed phases, icebreakers, traffic light status, and accountability.

## Prompt 11.1 — Peer Props System + Session Structure + Traffic Light

```
Add three interconnected systems that transform FocusClub events into structured, memorable coworking sessions.

## SYSTEM 1: PEER PROPS ("Thanks" System)

After attending an event and submitting feedback, show a "Give Props" screen where the user can recognize fellow attendees.

DATABASE TABLE — peer_props:
  - id: uuid PK default gen_random_uuid()
  - from_user: uuid FK profiles(id) ON DELETE CASCADE
  - to_user: uuid FK profiles(id) ON DELETE CASCADE
  - event_id: uuid FK events(id) ON DELETE CASCADE
  - prop_type: text CHECK (prop_type IN ('energy','helpful','focused','inspiring','fun','kind'))
  - anonymous: boolean default true
  - created_at: timestamptz default now()
  - UNIQUE(from_user, to_user, event_id, prop_type)

RLS:
  - Users can INSERT props for events they RSVPed "going" to (check event_rsvps)
  - Users can SELECT props where to_user = auth.uid() (see props given TO them)
  - Users can SELECT props where from_user = auth.uid() (see props they gave)
  - No UPDATE or DELETE (props are permanent)

PROP TYPES with emojis:
  - ⚡ energy — "Great energy"
  - 🤝 helpful — "Super helpful"
  - 🎯 focused — "Infectious focus"
  - 💡 inspiring — "Really inspiring"
  - 🎉 fun — "Made it fun"
  - 💛 kind — "So welcoming"

LIMIT: Max 5 props total per event per user (across all recipients). This creates scarcity and makes each prop meaningful. Show "X/5 props remaining" counter.

GIVE PROPS FLOW (after event feedback submission):
1. Show "Give Props to people you met" with attendee avatars in a grid
2. Tap a person → show 6 prop type buttons (emoji + label)
3. Tap prop(s) → checkmark appears, counter decrements
4. Toggle "Let them know it was me" (default OFF = anonymous)
5. "Done" button → save all, show confetti + "Props sent! 🎉"
6. Can skip entirely with "Skip" link

PROPS ON PROFILE (/profile/:id and /me):
- "Props Received" section below badges
- Show as: ⚡ 23 · 🤝 15 · 🎯 31 · 💡 8 · 🎉 12 · 💛 19
- Only show prop types that have count > 0
- Top 2 props become "vibe tags" shown on discover cards: e.g., "🎯 Focused · ⚡ Energetic"
- On /me: also show "Props Given: X total across Y events"

NOTIFICATIONS:
- When someone receives a prop: "Someone gave you ⚡ Props for bringing great energy!" (if anonymous)
- Or "[Name] thinks you're 🤝 super helpful!" (if revealed)

NEW BADGES (add to existing badge system):
- "first_props" 🙏 "Got Props" — received first prop ever
- "energy_magnet" ⚡ "Energy Magnet" — received 10+ energy props
- "helper_badge" 🤝 "Always Helpful" — received 10+ helpful props
- "focus_idol" 🎯 "Focus Idol" — received 10+ focused props
- "beloved" 💜 "Beloved" — received 50+ total props from 10+ unique people

Check badge conditions after receiving props.

## SYSTEM 2: STRUCTURED SESSION FORMAT WITH TIMER

Add session structure to events. Each event has a format that determines the timer phases.

DATABASE — add to events table:
  ALTER TABLE events ADD COLUMN session_format text
    CHECK (session_format IN ('structured_4hr','structured_2hr','casual'))
    DEFAULT 'casual';
  ALTER TABLE events ADD COLUMN vibe_soundtrack text; -- optional Spotify/YouTube link

DATABASE TABLE — session_phases:
  - id: uuid PK
  - event_id: uuid FK events(id) ON DELETE CASCADE
  - phase_order: int NOT NULL
  - phase_type: text CHECK (phase_type IN ('icebreaker','deep_work','mini_break','social_break','wrap_up'))
  - phase_label: text NOT NULL
  - duration_minutes: int NOT NULL
  - started_at: timestamptz nullable
  - ended_at: timestamptz nullable

DATABASE TABLE — session_intentions:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - event_id: uuid FK events(id)
  - intention: text NOT NULL (max 140 chars)
  - accomplished: text CHECK (accomplished IN ('yes','partially','no')) nullable
  - created_at: timestamptz default now()
  - UNIQUE(user_id, event_id)

RLS on both tables: Authenticated users can read for events they RSVPed to. Only event creator can write session_phases. Users can write their own intentions.

WHEN EVENT IS CREATED with structured format, auto-generate phases:

For structured_4hr (4 hours):
  1. Icebreaker (15 min)
  2. Deep Work Block 1 (90 min)
  3. Social Break (30 min)
  4. Deep Work Block 2 (90 min)
  5. Wrap-Up & Props (15 min)

For structured_2hr (2 hours):
  1. Icebreaker (10 min)
  2. Deep Work Block 1 (40 min)
  3. Mini Break (10 min)
  4. Deep Work Block 2 (40 min)
  5. Social + Wrap-Up (20 min)

For casual: no phases, no timer.

ON EVENT CREATION FORM:
- Add "Session Format" selector: Casual (default), Structured 2hr, Structured 4hr
- Show phase preview when structured is selected (visual timeline)
- Optional "Vibe Soundtrack" URL field (Spotify/YouTube link)

SESSION TIMER PAGE (/session/:eventId):
- Only accessible when event is today and user RSVPed "going"
- Link appears on event detail page: "Join Session →" button (primary, prominent)
- Also accessible from home page card: "Your session starts in X minutes"

TIMER UI:
- Big circular countdown timer in center (terracotta accent color for ring)
- Current phase label above timer: "🎯 Deep Work Block 1"
- Phase progress dots at top (filled = complete, current = pulsing, future = outline)
- Below timer: list of all phases with times (current highlighted)
- At icebreaker phase: show icebreaker content (see next prompt)
- At deep work start: "Set your intention" — text input, save to session_intentions
- At wrap-up: "Did you accomplish your intention?" — Yes / Partially / No buttons
- Between phases: gentle transition screen with next phase name (3 second countdown)
- If soundtrack URL provided: small "🎵 Session Playlist" link button

INTENTION TRACKING:
- Set at start of first deep work block
- Check at wrap-up
- Show on home page next day: "Yesterday you accomplished: [intention] ✅"
- Feed into streak: completing 3 intentions in a row = "🔥 Focus Streak"

Add to profiles:
  ALTER TABLE profiles ADD COLUMN intentions_completed int DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN current_streak int DEFAULT 0;

Show streak on profile: "🔥 3 session streak" (only if streak > 0)

## SYSTEM 3: TRAFFIC LIGHT STATUS

During active sessions, each attendee has a real-time availability status visible to their group.

DATABASE TABLE — member_status:
  - user_id: uuid FK profiles(id) PRIMARY KEY
  - event_id: uuid FK events(id)
  - status: text CHECK (status IN ('red','amber','green')) DEFAULT 'green'
  - until_time: timestamptz nullable (for red status: "don't disturb until")
  - topic: text nullable (for amber: what you're open to discuss)
  - updated_at: timestamptz default now()

RLS: Users can UPDATE their own row. Users can SELECT all rows for events they RSVPed to.

Use Supabase realtime subscriptions so status changes appear instantly for group members.

TRAFFIC LIGHT ON SESSION PAGE:
- Below the timer, show "Your Table" section:
  - Your status: large toggle — 🔴 Red / 🟡 Amber / 🟢 Green
  - Red: "Deep Focus" + time picker (until when?)
  - Amber: "Open to Chat" + shows your looking_for/can_offer tags from profile
  - Green: "Free" — doing light work, come say hi

- Group members list:
  Each member shows: avatar (with colored ring matching status) + name + status detail
  🔴 Priya — "Deep focus until 3:15 PM"
  🟡 Arjun — "💬 Design feedback, startup advice"
  🟢 Meera — "☕ Light work, come chat"

AUTO-STATUS:
- During deep_work phase → auto-set to 🔴 red (until phase end time)
- During social_break → auto-set to 🟢 green
- During icebreaker → auto-set to 🟢 green
- User can ALWAYS override manually
- After event ends → status row deleted automatically

SMART SUGGESTION (during social break):
- If someone is 🟡 amber with topics matching your looking_for:
  Show a subtle card: "💡 [Name] can help with [topic] — they're open to chat!"
- This uses the existing matchUtils.ts logic for looking_for/can_offer overlap

Add "Session Format" option to event creation. Show the session timer page for structured events. Display the traffic light status during active sessions.
```

**✅ Checkpoint 11 done when:** Props flow works after feedback, timer page works for structured events, traffic light status visible during sessions, intentions tracked.

---

# CHECKPOINT 12: Icebreaker Engine + Value-Adds
**Goal:** AI-powered icebreaker system, photo moments, energy checks, and session memories.

## Prompt 12.1 — Icebreaker Engine + Session Extras

```
Add an icebreaker question engine and session experience extras that make every FocusClub meetup memorable.

## ICEBREAKER QUESTION SYSTEM

DATABASE TABLE — icebreaker_questions:
  - id: uuid PK
  - question: text NOT NULL
  - category: text CHECK (category IN ('quick_fire','pair_share','group_challenge','intention_set'))
  - depth: text CHECK (depth IN ('light','medium','deep'))
  - emoji: text default '💬'
  - active: boolean default true
  - times_used: int default 0
  - created_at: timestamptz

RLS: Anyone authenticated can SELECT active questions. Only admin can INSERT/UPDATE.

SEED 40+ ICEBREAKER QUESTIONS:

Quick Fire (answer in 10 seconds each, whole group):
Light:
  - "☕ Coffee order that describes your personality?"
  - "🌤️ If your work style was weather, what would it be?"
  - "🎵 Song that matches your current project's energy?"
  - "🏠 Favorite spot in HSR Layout to think?"
  - "📱 App you couldn't live without for work?"
  - "🍕 Controversial food opinion?"
  - "✈️ Next place you want to visit and why?"
  - "🎬 Movie that describes your startup journey?"
  - "🐾 What animal matches your work style?"
  - "🌙 Are you a morning person or night owl, genuinely?"

Medium:
  - "🔥 One thing you're working on that genuinely excites you?"
  - "💭 What would you spend all day doing if money wasn't a factor?"
  - "📚 Book or podcast that changed how you think about work?"
  - "🎯 One skill you wish you could instantly master?"
  - "🌱 Something you started doing recently that's changed your routine?"

Pair & Share (pairs of 2, deeper conversation, 2 min each):
Medium:
  - "🧩 What's a problem you're stuck on that someone here might help with?"
  - "💡 What's something you learned this week that surprised you?"
  - "🚀 If you had to start a completely different career tomorrow, what would it be?"
  - "🤝 What's the most useful piece of advice someone gave you about work?"
  - "🎯 What does a perfect work day look like for you?"
  - "🌊 What's a risk you took that paid off?"
  - "💬 How do you explain what you do to your parents?"

Deep:
  - "🏗️ What would you build if you had unlimited time and zero fear of failure?"
  - "🔮 Where do you honestly see yourself in 3 years?"
  - "💎 What's something you're really good at that most people don't know about?"
  - "🌟 What's a moment this year when you felt genuinely proud of your work?"

Group Challenge (whole group, collaborative, 3-5 min):
Light:
  - "🔍 Find 3 things ALL of you have in common that aren't obvious"
  - "🚀 Each person shares one skill. Now pitch a fake startup using everyone's skills."
  - "🎭 Two truths and a dream — share two true things and one thing you wish were true"
  - "📸 If your group was a band, what would your band name be and what genre?"
  - "🗺️ Plan a dream team trip — each person picks one activity, build the itinerary"
  - "🏆 What's one thing each person at this table could teach the others?"

Medium:
  - "💡 Share your biggest current challenge. Group has 60 seconds per person to brainstorm solutions."
  - "🎯 Everyone writes their #1 goal for this month. Take turns — others suggest one action step."
  - "🤔 Debate: Is remote work better than office? Each person argues the OPPOSITE of their real opinion."

Intention Set (at end of icebreaker, transition to work):
  - "⏰ In the next 90 minutes, I will ___. Share with your table and write it in the app."
  - "🎯 What's the ONE thing that if you finish today, everything else gets easier?"
  - "🏁 By the end of this session, I'll feel good if I ___."

ICEBREAKER SELECTION ALGORITHM:
- For each session, select: 2 quick_fire + 1 pair_share + 1 group_challenge + 1 intention_set
- Prefer questions NOT recently used (sort by times_used ascending, then random)
- If most group members are first-time attendees (events_attended < 2): prefer "light" depth
- If returning group (most have 3+ events): mix in "medium" and "deep"
- Increment times_used when selected

ICEBREAKER UI (shown during icebreaker phase on timer page):

Round indicator: "Round 1 of 4" with progress dots

Quick Fire Round:
  - Big question text in center with emoji
  - "⏱️ 10 seconds each!" instruction
  - "Next Question →" button to advance
  - Auto-advance after 60 seconds

Pair & Share Round:
  - "Pair up! One question, 2 minutes each."
  - Big question text
  - 2-minute countdown per person
  - "Switch!" alert at halfway
  - Gentle chime sound indicator

Group Challenge Round:
  - "Everyone together! You have 3 minutes."
  - Challenge text with emoji
  - 3-minute countdown
  - Fun completion: "Time's up! How'd you do? 😄"

Intention Set Round:
  - Question text
  - Text input: "My intention for this session..."
  - "Set Intention ✨" button → saves to session_intentions
  - Show other group members' intentions after everyone submits (or after 60 seconds)
  - "Let's go! 🚀" transition to Deep Work phase

ADMIN PANEL — Icebreakers Tab:
- Add new tab "Icebreakers" to admin panel
- List all questions: question, category, depth, times_used, active toggle
- "Add Question" form: emoji, question, category dropdown, depth dropdown
- Bulk toggle active/inactive
- Sort by times_used to see which need refreshing

## SESSION EXTRAS

### A. Energy Check (during social break)
After 2 minutes into social_break phase, show a quick overlay:
- "How's your energy? ⚡"
- 5 battery icons: 🪫 (empty) to 🔋🔋🔋🔋🔋 (full) — tap one
- After all group members respond, show: "Your table's energy: 85% ⚡"
- If average is low (< 40%), suggest: "Try a 1-minute stretch! 🧘"
- Save to new table:
  energy_checks:
    - id: uuid PK
    - user_id: uuid FK profiles(id)
    - event_id: uuid FK events(id)
    - energy_level: int (1-5)
    - phase: text (which break)
    - created_at: timestamptz
    - UNIQUE(user_id, event_id, phase)

### B. Photo Moment
At the end of social_break (last 2 minutes), show a card:
- "📸 Group Photo Time!"
- "Capture this moment with your table"
- "Open Camera" button → opens device camera
- After photo: option to share to event memories
- Save photo URL to:
  session_photos:
    - id: uuid PK
    - event_id: uuid FK events(id)
    - user_id: uuid FK profiles(id) -- who took it
    - photo_url: text
    - created_at: timestamptz
- Photos appear on event detail page in "Memories" section (grid of photos)
- Use Supabase storage bucket "session-photos" for uploads

### C. Skill Swap Suggestions (during social break)
During social_break, if any group member has amber/green status:
- Check looking_for/can_offer overlap between group members
- Show card: "💡 Skill Swap! [Name] offers [skill] — you're looking for this!"
- Only show if there's a genuine match
- Tappable → opens their profile

### D. Session Wrap-Up Screen
During wrap_up phase:
1. "Did you accomplish your intention?" → Yes ✅ / Partially 🔶 / No ❌
   - Yes: increment intentions_completed + current_streak on profile
   - Partially: increment intentions_completed, keep streak
   - No: reset current_streak to 0
2. "Give Props" → flows into the peer props system from Checkpoint 11
3. "Rate this session" → flows into existing event feedback
4. Show group stats: "Your table worked for 3 hours together! 🎉"
5. If streak milestone (3, 5, 10): celebration animation + badge check

### E. Post-Session Summary (on home page, next day)
Show a card on home feed:
- "Yesterday at [Event Name] 📍 [Venue]"
- "You worked for [X] hours with [names]"
- "Intention: [intention] — [accomplished emoji]"
- "Props received: [list]"
- "🔥 [streak] session streak!"
- "Share your experience →" button → pre-filled WhatsApp message

### F. Weekly Digest Card (on home page, Mondays)
- "Your Week in FocusClub 📊"
- Sessions attended: X
- Hours of deep work: Y
- Props given/received: Z
- Current streak: N 🔥
- "You're in the top X% of active members" (if applicable)

Make all these systems work together seamlessly. The session timer is the hub — icebreakers, energy checks, photo moments, and wrap-up all appear at the right time within the timer flow. The traffic light status from Checkpoint 11 is always visible alongside.
```

**✅ Checkpoint 12 done when:** Icebreakers show during session, energy checks work, photo moments save, wrap-up flows into props + feedback, post-session summary on home.

---

# CHECKPOINT 13: Growth Engine — Viral Loops, Shareable Cards, WhatsApp Automation, Cafe Partnerships
**Goal:** Turn every member action into a growth opportunity. Shareable profile cards, pre-filled WhatsApp messages everywhere, QR codes for venue partnerships, post-event viral prompts, and an automated cafe partner acquisition pipeline in admin.

## Prompt 13.1 — Shareable Profile Cards + WhatsApp Viral Loops

```
Add viral sharing mechanics throughout FocusClub. Every interaction should have a natural, low-friction way to share outside the app — especially on WhatsApp, which is how our community communicates.

## SHAREABLE PROFILE CARDS

Build a beautiful, auto-generated profile card image that members can share on WhatsApp, Instagram Stories, and LinkedIn.

PROFILE CARD DESIGN (like a digital business card):
- Size: 1080x1080px (square, works on all platforms)
- Background: warm gradient (cream #F5F0EB to soft terracotta #F0D5C5)
- FocusClub logo watermark (subtle, bottom-right corner)
- Member avatar (large, circular, centered at top, 200px, with terracotta ring)
- Display name (DM Serif Display, large, bold)
- Tagline (Inter, muted, below name)
- Work vibe badge (pill, color-coded)
- Top 3 "looking for" tags (terracotta pills)
- Top 3 "can offer" tags (sage green pills)
- If they have props: show top 2 prop types as vibe tags (e.g., "🎯 Focused · ⚡ Energetic")
- If they have a streak: "🔥 X session streak"
- Match prompt: "Find me on FocusClub" + QR code linking to their profile (/profile/:id)
- Bottom bar: "focusclub.app" + "Find your people. Focus together."

IMPLEMENTATION:
- Use html2canvas or a canvas-based approach to generate the card client-side
- Generate on-demand when user taps "Share My Card"
- Save as PNG, trigger native share sheet (navigator.share API on mobile) or download

ON /me PAGE — "Share Your Card" section (prominent, below profile completion):
- Preview thumbnail of their card (small, tappable to see full size)
- "Share My Card" primary button → generates image + opens share sheet
- "Share on WhatsApp" button (WhatsApp green) → shares image + pre-filled message:
  "Hey! I'm on FocusClub — a community for people who cowork in Bangalore. Check out my profile and join: focusclub.app/profile/[id]?ref=[referral_code]"
- "Copy Profile Link" button → copies URL with referral code to clipboard
- "Download Card" button → saves PNG to device

ON /profile/:id — for OTHER people's profiles:
- "Share [Name]'s Profile" button at bottom
- Generates a slightly different card: same design but with "Recommended by [your name]" at bottom
- WhatsApp share: "Check out [Name] on FocusClub — [tagline]. Join us: focusclub.app/invite/[your_referral_code]"

## WHATSAPP SHARE BUTTONS EVERYWHERE

Add contextual WhatsApp share buttons throughout the app. Each one should have a carefully crafted, pre-filled message that feels natural (not spammy) and includes a tracking referral link.

EVENT SHARING (on event detail page + event cards):
- "Share on WhatsApp" button (WhatsApp green, wa.me icon)
- Pre-filled message:
  "🎯 [Event Title]
  📅 [Day], [Date] · [Time]
  📍 [Venue], [Neighborhood]
  [X] people going already!

  Join on FocusClub: focusclub.app/events/[id]?ref=[referral_code]"
- Also add a "Copy Event Link" icon button

AFTER EVENT RSVP — show a share prompt card:
- "You're going! 🎉 Bring a friend?"
- "Share with someone who'd enjoy this" button
- Pre-filled WhatsApp:
  "Hey! I'm going to [Event Title] on [Date] at [Venue]. Come join? focusclub.app/events/[id]?ref=[referral_code]"
- Dismissable (X button), but show it every time they RSVP (it's the highest-intent moment)

PROMPT ANSWER SHARING (on /prompts after answering):
- "Share your answer" button below your submitted answer
- Pre-filled WhatsApp:
  "💬 FocusClub asked: "[prompt question]"
  My answer: "[first 100 chars of answer]..."
  What's yours? Join and answer: focusclub.app/prompts?ref=[referral_code]"

WEEKLY PROMPT NOTIFICATION CARD (on /home):
- Add "Invite someone to answer this" link on the prompt card
- Pre-filled:
  "💬 This week on FocusClub: "[prompt question]"
  Come share your answer: focusclub.app/prompts?ref=[referral_code]"

POST-EVENT VIRAL PROMPT (after giving feedback + props):
- Show a "Share your experience" card:
  - "You just completed a great session! Tell your network."
  - Two options:
    a) "Share on WhatsApp" → pre-filled:
      "Just did a [X]-hour coworking session with [X] amazing people at [Venue] through FocusClub! 🎯
      If you work remotely or freelance in Bangalore, check it out: focusclub.app/invite/[referral_code]"
    b) "Post on LinkedIn" → opens LinkedIn share URL with pre-filled text:
      "Just finished a focused coworking session at [Venue] with [X] people through @FocusClub.
      If you're a remote worker, freelancer, or founder in Bangalore — this community is amazing.
      #coworking #bangalore #remotework #focusclub"
  - "Maybe later" dismiss option

BADGE SHARING:
- When a badge is earned (in the celebration modal), add:
  - "Share this achievement" button
  - WhatsApp: "Just earned the [badge emoji] [badge name] badge on FocusClub! [badge description]. Join us: focusclub.app/invite/[referral_code]"
  - Each badge share is a micro-viral moment

REFERRAL TRACKING:
- All shared links include ?ref=[referral_code]
- When someone visits with a ref parameter:
  - Store in localStorage
  - On sign-up, set referred_by to the referrer's profile ID
  - Show "Invited by [Name]" on the landing page (fetch referrer's avatar + name)
  - After the referred user completes onboarding, notify the referrer: "🤝 [Name] joined FocusClub through your link!"
  - Award "recruiter" badge when first referral completes onboarding (already exists, just verify it triggers)

REFERRAL STATS ON /me:
- "Your Invites" section:
  - "X people joined through your link" with avatars of referred members
  - "Your referral link: focusclub.app/invite/[code]" with copy button
  - "Share link" WhatsApp button

Make all WhatsApp share buttons use the wa.me deep link format: https://wa.me/?text=[URL-encoded message]
Make all LinkedIn share buttons use: https://www.linkedin.com/sharing/share-offsite/?url=[URL-encoded link]
```

**✅ Prompt 13.1 done when:** Profile cards generate and share, WhatsApp share buttons on events/prompts/badges/post-session, referral tracking works end-to-end, LinkedIn sharing works.

---

## Prompt 13.2 — QR Codes, Venue Partner Tools, Cafe Acquisition Pipeline

```
Build tools for FocusClub to partner with cafes and coworking spaces at scale. This includes QR codes for physical presence in venues, a partner onboarding flow, and admin tools to manage the partner pipeline.

## QR CODE SYSTEM

Generate QR codes that link to FocusClub — for printing on table tents, stickers, and posters at partner venues.

DATABASE TABLE — venue_partners:
  - id: uuid PK default gen_random_uuid()
  - venue_name: text NOT NULL
  - venue_address: text
  - neighborhood: text
  - contact_name: text
  - contact_phone: text
  - contact_email: text
  - google_maps_url: text
  - instagram_handle: text
  - status: text CHECK (status IN ('lead','contacted','interested','active','declined','churned')) DEFAULT 'lead'
  - notes: text
  - partnership_type: text CHECK (partnership_type IN ('free_hosting','revenue_share','sponsored')) DEFAULT 'free_hosting'
  - revenue_share_pct: integer DEFAULT 0
  - events_hosted: integer DEFAULT 0
  - members_acquired: integer DEFAULT 0 (members who signed up via this venue's QR)
  - qr_code_url: text (generated QR image URL)
  - created_at: timestamptz default now()
  - updated_at: timestamptz default now()

RLS: Only admin can read/write venue_partners.

DATABASE TABLE — venue_scans:
  - id: uuid PK
  - venue_partner_id: uuid FK venue_partners(id)
  - scanned_at: timestamptz default now()
  - resulted_in_signup: boolean default false
  - user_id: uuid FK profiles(id) nullable (if they signed up)

RLS: Insert by anyone (anonymous scans), select by admin only.

QR CODE GENERATION (in admin panel):
- For each venue partner, generate a QR code that links to:
  focusclub.app/?venue=[venue_id]&utm_source=qr&utm_medium=table_tent
- Use a QR code library (qrcode.react or similar) to generate in-browser
- QR code styling: terracotta colored dots (not plain black), FocusClub logo in center, rounded corners
- Generate a printable "Table Tent" design around the QR:
  - Header: FocusClub logo
  - Tagline: "Find your people. Focus together."
  - QR code (centered, large)
  - Call to action: "Scan to join the coworking community"
  - Footer: "Free to join · [Venue Name] is a FocusClub partner"
  - Size: A6 (postcard size, fits table tent holders)
- "Download Table Tent PDF" button for each venue
- "Download QR Only" button (just the QR code as PNG)

WHEN SOMEONE SCANS THE QR:
- Landing page detects ?venue= parameter
- Show: "[Venue Name] is a FocusClub partner! 🎯"
- Show venue-specific messaging: "Join the community of people who cowork at [Venue Name] and other great spots in [Neighborhood]"
- Track the scan in venue_scans table
- If they sign up, link the user to the venue (set resulted_in_signup = true, store user_id)
- Increment members_acquired on venue_partners

## VENUE PARTNER ADMIN PANEL

Add a "Partners" tab to the admin dashboard. This is the cafe partnership CRM.

PARTNER PIPELINE VIEW:
- Kanban-style columns (or tabs): Lead → Contacted → Interested → Active → Declined
- Each card shows: venue name, neighborhood, contact name, contact phone, events hosted, members acquired
- Drag between columns (or use a status dropdown)
- Click card → detail view/edit form

ADD PARTNER FORM:
- Venue name, address, neighborhood dropdown
- Contact: name, phone, email
- Google Maps URL (paste link)
- Instagram handle
- Partnership type: Free Hosting / Revenue Share / Sponsored
- If Revenue Share: percentage field (default 10%)
- Notes (textarea for tracking conversations)
- "Save" → creates the partner + auto-generates QR code

PARTNER DETAIL VIEW:
- All fields editable
- QR Code section:
  - Preview of generated QR code
  - "Download QR Code" button
  - "Download Table Tent" button
  - "Copy QR Link" button
- Stats section:
  - QR scans: X total (with chart over time if enough data)
  - Members acquired: X (via this venue's QR)
  - Events hosted here: X (link events to venue partners by venue_name matching)
  - Revenue generated: ₹X (if revenue share model)
- Communication log:
  - Simple list of notes with timestamps
  - "Add Note" button to log interactions

PARTNER OUTREACH TEMPLATES:
- "Generate Pitch Message" button that creates a WhatsApp message:
  "Hi [Contact Name]! 👋

  I'm [Admin Name] from FocusClub — we organize coworking meetups in [Neighborhood]. We bring groups of 3-5 focused professionals to work at great cafes.

  We'd love to feature [Venue Name] as a partner venue. Here's what it means:
  ✅ We bring 5-15 customers per session (they order food & drinks)
  ✅ Zero cost to you — we handle everything
  ✅ Your venue gets featured in our app to 500+ members
  ✅ We place branded table tents that drive new customers to you

  Interested? I can drop by to chat — takes 5 minutes.

  Check us out: focusclub.app"
- "Copy Message" button → ready to paste into WhatsApp
- "Open WhatsApp" button → opens wa.me/91[phone]?text=[URL-encoded message]

BULK LEAD IMPORT:
- "Import Leads" button → CSV upload
- Expected columns: venue_name, address, neighborhood, contact_name, contact_phone, contact_email, google_maps_url
- Parse and create venue_partner rows with status = 'lead'
- Show import summary: "Imported X new leads, Y duplicates skipped"

PARTNER DASHBOARD STATS (at top of Partners tab):
- Total partners: X (by status breakdown)
- Active partners: X
- Total QR scans: X (this month)
- Members via QR: X (this month)
- Top performing venue: [name] (most scans)
- Conversion rate: X% (scans → signups)

## VENUE PARTNER PUBLIC PAGE

Create a /partners page (linked from landing page footer):
- "Our Partner Venues" heading
- Grid of active partner venues:
  - Venue name (large)
  - Neighborhood badge
  - Google Maps link ("View on Maps →")
  - Instagram link (if provided)
  - "X events hosted" stat
  - "X members cowork here" stat
- "Want your venue featured? Contact us" CTA at bottom with admin email/WhatsApp

ON EVENT CREATION:
- When creating an event, add "Link to Partner Venue" dropdown
  - Shows list of active venue_partners
  - When selected, auto-fills venue_name, venue_address, neighborhood
  - Links the event to the partner for tracking

## POST-EVENT VENUE REVIEW CARDS

After giving event feedback, if the event was at a partner venue:
- Show a card: "How was [Venue Name]? 📍"
- Quick star rating (1-5 stars) for the venue
- Optional one-line comment
- Save to:
  venue_reviews:
    - id: uuid PK
    - venue_partner_id: uuid FK venue_partners(id)
    - user_id: uuid FK profiles(id)
    - event_id: uuid FK events(id)
    - rating: integer (1-5)
    - comment: text nullable
    - created_at: timestamptz
    - UNIQUE(user_id, event_id)
- Show average rating on the partner detail in admin
- Show average rating on /partners public page

This creates a complete growth flywheel:
1. Admin finds cafes → adds as leads → sends pitch via WhatsApp
2. Cafe says yes → status → active → QR codes printed
3. QR at cafe → people scan → sign up → attend events
4. Events at cafe → reviews → more members → cafe gets more customers
5. More members → more events → more cafes want to partner
```

**✅ Prompt 13.2 done when:** QR codes generate for venues, admin partner pipeline works, venue scans tracked, partner public page shows venues, post-event venue reviews work.

---

## Prompt 13.3 — Automated Growth Triggers + Smart Notifications

```
Add automated growth triggers that fire at high-intent moments and smart notifications that bring people back. Every trigger should feel natural, not pushy — like a friend suggesting something, not an ad.

## MILESTONE CELEBRATIONS (auto-trigger at key moments)

Track member milestones and celebrate them with shareable moments:

DATABASE TABLE — member_milestones:
  - id: uuid PK
  - user_id: uuid FK profiles(id)
  - milestone_type: text CHECK (milestone_type IN (
      'first_event', 'events_3', 'events_5', 'events_10', 'events_25', 'events_50',
      'first_prop_given', 'first_prop_received', 'props_received_25', 'props_received_50',
      'first_prompt_answer', 'prompts_5', 'prompts_all',
      'streak_3', 'streak_5', 'streak_10',
      'referral_1', 'referral_3', 'referral_10',
      'member_1_month', 'member_3_months', 'member_6_months', 'member_1_year'
    ))
  - achieved_at: timestamptz default now()
  - shared: boolean default false
  - UNIQUE(user_id, milestone_type)

RLS: Users can read own milestones. Insert via app logic after relevant actions.

MILESTONE CELEBRATION FLOW:
When a milestone is achieved:
1. Full-screen celebration modal with confetti animation
2. Milestone card showing:
   - Achievement emoji + title: "🎯 10 Sessions Complete!"
   - Description: "You've coworked at 10 sessions through FocusClub. That's more focused hours than 95% of our members!"
   - Stats summary: "X hours of deep work · X people met · X props received"
3. Share options:
   - "Share on WhatsApp" → pre-filled message with milestone + invite link
   - "Share on LinkedIn" → professional-toned post
   - "Download Card" → generates a celebration image (similar to profile card but milestone-themed)
4. "Keep going!" dismiss button

MILESTONE MESSAGES (customize per type):

events_3: "🎯 Committed! 3 sessions down. You're officially a regular."
events_5: "⭐ High Five! 5 sessions. You're in the top 20% of active members."
events_10: "🏆 Double Digits! 10 sessions. You're now eligible to host events!"
events_25: "💎 Quarter Century! 25 sessions. You're a FocusClub legend."
events_50: "👑 Hall of Fame! 50 sessions. The community is better because of you."

streak_3: "🔥 On Fire! 3 sessions in a row. Keep the momentum."
streak_5: "🔥🔥 Unstoppable! 5 session streak. That's serious dedication."
streak_10: "🔥🔥🔥 Legendary! 10 session streak. You're inspiring others."

referral_1: "🤝 First Recruit! You brought someone new to FocusClub."
referral_3: "🌱 Community Builder! 3 people joined through you."
referral_10: "🚀 Growth Engine! 10 referrals. You're building this community."

props_received_25: "💛 Loved by Many! 25 props received. People really enjoy working with you."
props_received_50: "🌟 Community Star! 50 props. You make every session better."

member_1_month: "📅 One Month In! Thanks for being part of FocusClub."
member_3_months: "📅 Quarter Year! 3 months of focused coworking."
member_6_months: "📅 Half Year! 6 months. You've been here since the early days."

## SMART RE-ENGAGEMENT NOTIFICATIONS

Add time-based notification triggers that fire when members go quiet. These are created by checking member activity periodically (run checks when any page loads, throttled to once per day per user).

TRIGGER RULES:

"We miss you" (7 days inactive — no event RSVP, no prompt answer, no app visit):
  - Notification: "👋 It's been a while! [X] new members joined this week. Come say hi."
  - Link: /discover

"Your matches have been busy" (10 days inactive):
  - Notification: "Your top match [Name] just answered a prompt. See what they said!"
  - Link: /prompts
  - Only send if a real match answered recently

"Events you're missing" (14 days inactive, upcoming events exist):
  - Notification: "🎯 [X] sessions happening this week in [neighborhood]. Don't miss out!"
  - Link: /events

"Your streak!" (when a streak is about to break — last session was 6+ days ago):
  - Notification: "🔥 Your [X]-session streak is at risk! Attend a session this week to keep it alive."
  - Link: /events

THROTTLE: Max 1 re-engagement notification per user per 3 days. Don't spam.

## POST-EVENT SOCIAL PROOF ON HOME PAGE

After any event completes, generate a "Community Highlight" card on the home page for ALL members (not just attendees):

"FocusClub Highlight ✨":
- "[X] members coworked at [Venue] [yesterday/on Saturday]"
- Show attendee avatars (first 5) + "and X more"
- "Join the next session →" CTA linking to /events
- This creates FOMO for non-attendees and social proof for new members

## SMART INVITE SUGGESTIONS

On /discover, when viewing a profile with high compatibility (75%+), show:
- "Know someone like [Name]? Invite them!"
- "Members like [Name] love FocusClub. Know someone similar? Share the app."
- Share button → WhatsApp pre-filled: "I found my coworking match on FocusClub! If you're into [Name's work_vibe], you'd love it too: focusclub.app/invite/[referral_code]"

## WEEKLY DIGEST CARD (Enhanced)

Enhance the Monday digest card on /home:
- "Your Week in FocusClub 📊"
- Sessions attended: X
- Hours of deep work: Y (calculated from session durations)
- Props given: X / Props received: X
- New people met: X (people at sessions you attended that you hadn't seen before)
- Current streak: X 🔥
- Community stats: "[total] members · [X] sessions this week · [X] props given"
- "Share your week" button → generates a weekly summary image:
  - Similar to Spotify Wrapped / Strava weekly summary style
  - "[Name]'s FocusClub Week"
  - Key stats in a visual card
  - "Join me on FocusClub" + invite link

## ADMIN GROWTH DASHBOARD

Add "Growth" tab to admin panel with:

FUNNEL METRICS:
- Landing page visits (track with a simple page view counter)
- Sign-ups (profiles created)
- Onboarding completed
- First event RSVP
- First event attended (feedback given)
- Repeat attendee (2+ events)
- Show conversion rate between each step as a funnel chart

ACQUISITION CHANNELS:
- Referral signups: X (by referrer, top referrers table)
- QR code signups: X (by venue, top venues table)
- Direct signups: X (no ref/venue parameter)
- Chart: signups by channel over time (stacked bar, weekly)

VIRAL METRICS:
- Shares this week: X (track when share buttons are clicked — add a shares table)
- Viral coefficient: average referrals per member (total referred / total members)
- Top shared content: which events/prompts/profiles got shared most

RETENTION:
- WAU (weekly active users) / MAU (monthly active users) ratio
- Cohort chart: % of members from each signup week who are still active
- At-risk members: people trending toward inactivity (3+ days, was previously active)
- Churned: 30+ days inactive (with re-engagement status)

DATABASE TABLE — analytics_events:
  - id: uuid PK
  - event_type: text CHECK (event_type IN (
      'page_view', 'share_click', 'qr_scan', 'referral_visit',
      'signup', 'onboarding_complete', 'first_rsvp', 'first_feedback'
    ))
  - user_id: uuid nullable
  - metadata: jsonb (page, utm_source, utm_medium, venue_id, etc.)
  - created_at: timestamptz default now()

RLS: Insert by anyone authenticated. Select by admin only.

TRACKING: Add lightweight analytics event logging:
- On landing page load: log page_view with UTM params
- On share button click: log share_click with content type (event/prompt/profile/badge)
- On QR scan arrival: log qr_scan with venue_id
- On signup: log signup with referral source
- On onboarding complete: log onboarding_complete
- On first RSVP: log first_rsvp
- On first feedback: log first_feedback

Keep this lightweight — no external analytics, just Supabase inserts. Admin dashboard queries the analytics_events table for charts.
```

**✅ Prompt 13.3 done when:** Milestones celebrate and share, re-engagement notifications fire, social proof cards show on home, weekly digest generates shareable image, admin growth dashboard shows funnel + channels + retention.

---

# CHECKPOINT 13 Summary

When all three prompts are done, FocusClub has a complete growth engine:
- **Viral sharing**: Every action (RSVP, answer, badge, session, milestone) has a WhatsApp/LinkedIn share moment
- **Physical presence**: QR codes at partner venues drive offline → online conversion
- **Partner pipeline**: Admin can find, pitch, onboard, and track cafe partners at scale
- **Re-engagement**: Smart notifications bring inactive members back at the right moment
- **Social proof**: Non-attendees see session highlights, creating FOMO
- **Measurable**: Full funnel metrics + acquisition channels + retention cohorts in admin
- **Viral coefficient**: Track and optimize how many new members each existing member brings

---

# Post-Loveable: Migration Checklist

1. Clone GitHub repo locally
2. Run `npm install && npm run dev` to verify
3. Use free migration script: github.com/sergust/lovable-vite-nextjs-migration
4. Port components → donedonadone/components/community/
5. Convert React Router → Next.js app/community/ routes
6. Rename VITE_ → NEXT_PUBLIC_ env vars
7. Export Supabase SQL, add new tables to existing project
8. Extend profiles table with new columns
9. Connect to your existing Supabase project
10. Test all flows in Next.js
