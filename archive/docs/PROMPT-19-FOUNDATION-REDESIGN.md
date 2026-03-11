# Prompt 19 — Foundation Redesign (Simplify, Restructure, Focus)

Pull the codebase from: `https://github.com/saileshbhupalam-max/focusclub-find-your-people.git`

This is a React + Vite + Supabase coworking platform. The database is on Supabase, auth is Google OAuth, and the UI uses Tailwind + shadcn/ui + Radix. The app matches solo workers into groups at partner cafes in Bangalore.

**Design Philosophy:** FocusClub is NOT a generic meetup app. Its positioning is: "The place where ambitious solo workers exchange skills, energy, and accountability." The onboarding must communicate this — the "looking for / can offer" exchange IS the product. We simplify what's premature, but keep what defines the soul.

---

## PART 1 — STREAMLINED ONBOARDING (6 steps → 4 steps)

### Why
The current 6 steps collect preferences (noise, communication style, schedule, location) that are meaningless before the user has attended a session. But identity and value exchange — who you are and what you bring/seek — must stay. That's what makes FocusClub different from "book a cafe seat."

### 1.1 New 4-Step Onboarding

**Step 1: "Who are you?" (Identity)** — Keep existing Step1Identity:
- Display name (required)
- Avatar upload
- One-line tagline

**Step 2: "How do you work?" (Work + Basics)**
Create `Step2WorkVibe.tsx` merging parts of existing Step2Work and Step3Preferences:
- "What do you do?" textarea (from Step2Work)
- Work vibe picker: 3 buttons — Deep Focus / Balanced / Social (from Step2Work)
- Gender selector (from Step3Preferences) — needed for women-only session filtering
- Neighborhood selector (from Step3Preferences) — needed for session matching
- "Interested in women-only sessions?" toggle (from Step3Preferences)

**Step 3: "What's your exchange?" (Give & Get)** — Keep existing Step4GiveGet but with better framing:
- Header: "FocusClub is about exchange. What do you bring to the table?"
- "I'm looking for..." tag input with suggestions (design feedback, accountability, co-founder, coding help, marketing advice, writing buddies, career guidance, startup feedback, creative energy, focus partners)
- "I can offer..." tag input with suggestions (same pool)
- At least one "looking for" tag required — this IS the product
- Subtext: "This helps us match you with the right people at your table."

**Step 4: "You're in!" (Preview + CTA)**
Create `Step3Done.tsx` — compact confirmation:
- Profile preview card showing: avatar, name, tagline, vibe badge, looking for tags, can offer tags
- Subtext: "This is how others see you at the table."
- Big CTA: "Find your first session →" (navigates to `/events`)
- Small link: "I'll explore first" (navigates to `/home`)

### 1.2 What moves to progressive prompts (collected AFTER sessions)

These fields are only asked after the user has experienced value:

| Field | When to ask | Why wait |
|-------|-------------|----------|
| Noise preference, Communication style | After Session 1 | "Now that you've been — how do you like it?" |
| Location/radius/neighborhoods | After Session 1 | They know what "nearby" means now |
| Preferred days/times/duration | After Session 2 | They have a sense of their rhythm |
| Interests | After Session 2 | They've seen what's relevant |
| LinkedIn, Instagram, Twitter, phone | After Session 3 | Trust earned through attendance |

### 1.3 Progressive Profile Prompts on Home Page

Create `src/components/home/ProfilePromptCard.tsx`:

```tsx
/* DESIGN: Data not collected during onboarding is gathered progressively.
   Each prompt appears when the data becomes meaningful — after real sessions.
   We never say "complete your profile" — we say "now that you've been..." */

function getPromptType(profile) {
  const attended = profile.events_attended || 0;
  const dismissed = JSON.parse(localStorage.getItem('dismissed_prompts') || '{}');

  // Check if prompt was dismissed recently (within 3 sessions)
  const isDismissed = (key) => dismissed[key] && attended - dismissed[key] < 3;

  if (attended >= 1 && !profile.noise_preference && !isDismissed('work-style'))
    return 'work-style';

  if (attended >= 1 && !profile.preferred_latitude && !isDismissed('location'))
    return 'location';

  if (attended >= 2 && (!profile.preferred_days || profile.preferred_days.length === 0) && !isDismissed('schedule'))
    return 'schedule';

  if (attended >= 2 && (!profile.interests || profile.interests.length === 0) && !isDismissed('interests'))
    return 'interests';

  if (attended >= 3 && !profile.linkedin_url && !isDismissed('socials'))
    return 'socials';

  return null;
}
```

Each prompt type renders as a warm card:

**work-style** (after 1 session): "Now that you've been to a session... how do you like your workspace?"
- Noise preference: 3 buttons (Quiet / Moderate / Lively)
- Communication style: 3 buttons (Heads-down / Friendly / Social butterfly)

**location** (after 1 session): "Want to see sessions near you?"
- "Use my current location" button
- Or mini LocationPicker map
- Radius slider (1/3/5/10 km)

**schedule** (after 2 sessions): "Finding your rhythm? When do you like to work?"
- Day chips (Mon-Sun)
- Time chips (Morning 8-12 / Afternoon 12-5 / Evening 5-9)
- Duration toggle (2hr / 4hr)

**interests** (after 2 sessions): "What are you into outside of work?"
- Interest tag input with suggestions

**socials** (after 3 sessions): "Your tablemates want to connect!"
- LinkedIn URL, Instagram handle, Twitter handle, Phone number

Each card has:
- "Save" button → updates profile via Supabase
- "Not now" link → stores `dismissed_prompts[type] = events_attended` in localStorage (re-shows after 3 more sessions)

Mount `<ProfilePromptCard profile={profile} />` in Home.tsx in the card area.

---

## PART 2 — PROFILE PAGE RESTRUCTURE (Single scroll → 3 Tabs)

### Why
The current Profile page is 790+ lines mixing identity display with settings editing. A user who wants to show their profile sees editing UI. A user who wants to edit their bio scrolls past badge grids. Split by intent: what you show, what you've done, what you configure.

### 2.1 Three-Tab Layout

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="profile" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="profile">Profile</TabsTrigger>
    <TabsTrigger value="journey">Journey</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">{/* ... */}</TabsContent>
  <TabsContent value="journey">{/* ... */}</TabsContent>
  <TabsContent value="settings">{/* ... */}</TabsContent>
</Tabs>
```

### 2.2 Profile Tab (What Others See)

Beautiful enough to screenshot. This is your FocusClub identity:

1. **Avatar + Rank Ring** — existing RankAvatar, large and centered
2. **Display name + tagline** — read-only, prominent text
3. **Work vibe badge** — e.g., "🎯 Deep Focus" as a Badge
4. **"Looking for" tags** — displayed as colored tag pills (this is the product!)
5. **"Can offer" tags** — displayed as outlined tag pills
6. **Compact stats row** — three items: Focus Hours | Sessions | Streak (numbers + labels, no cards)
7. **Props summary** — inline: "⚡ 12 · 🤝 8 · 🎯 15" (prop emoji + count)
8. **Share Card section** — existing ShareCardSection (profile card image + share/download buttons)
9. **Table Captain badge** — if is_table_captain, show CaptainBadge

Do NOT show here: badge grid, achievements, monthly titles, editing forms, preferences, sign out.

### 2.3 Journey Tab (Your FocusClub Story)

Gamification as narrative, not walls of locked items:

1. **Header**: "Your Journey — {events_attended} sessions and counting"
2. **Unified timeline** — merge all earned badges, achievements, milestones, and monthly titles into one chronological list (most recent first):
   ```tsx
   const journeyItems = [
     ...earnedBadges.map(b => ({
       type: 'badge', emoji: getBadgeDef(b.badge_type)?.emoji || '🏅',
       name: getBadgeDef(b.badge_type)?.name || b.badge_type,
       date: b.earned_at
     })),
     ...achievements.map(a => ({ type: 'achievement', emoji: '🏆', name: a.achievement_type.replace(/_/g, ' '), date: a.earned_at })),
     ...milestones.map(m => ({ type: 'milestone', emoji: '⭐', name: m.milestone_type.replace(/_/g, ' '), date: m.awarded_at })),
     ...monthlyTitles.map(t => ({ type: 'title', emoji: '👑', name: t.title_type.replace(/_/g, ' '), date: t.awarded_month })),
   ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
   ```
   Each item: row with emoji + name + formatted date. Only earned items — no locked/grayed.
3. **Intention stats** (if they've set intentions): "You accomplished X% of your intentions" with a small progress ring
4. **Focus hours mini chart** — sparkline showing weekly hours (Recharts AreaChart, already in dependencies)
5. **Placeholder comment**: `{/* Session Scrapbook timeline — future update */}`

If journey is empty (new user): "Your journey starts with your first session. Every session, every connection, every milestone — it all shows up here."

### 2.4 Settings Tab (Edit Everything)

All editing forms, organized in cards:

1. **Personal Info**: Display name, tagline, "what I do" textarea, avatar upload
2. **Work Preferences**: Work vibe (3 buttons), gender, women-only toggle, noise preference, communication style, neighborhood
3. **Exchange**: "Looking for" tag input, "Can offer" tag input (these are editable here)
4. **Location Preferences**: LocationPicker + radius slider + neighborhood checkboxes (existing)
5. **Session Preferences**: Day chips + time chips + duration toggle (existing)
6. **Interests**: Interest tag input
7. **Social Links**: LinkedIn, Instagram, Twitter with visibility toggles, phone number
8. **Captain Opt-In**: existing CaptainOptInCard
9. **Theme**: Dark/light toggle
10. **Sign Out**: existing AlertDialog
11. **Sticky Save button**: "Lock it in"

---

## PART 3 — BOTTOM NAV (6 → 4 items)

### 3.1 New Nav

```tsx
const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Calendar, label: "Sessions", path: "/events" },
  { icon: Users, label: "People", path: "/discover" },
  { icon: User, label: "You", path: "/me" },
];
```

### 3.2 Map as Toggle on Sessions Page

In `src/pages/Events.tsx`, add a List/Map toggle at the top:

```tsx
const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

<div className="flex gap-1 bg-muted rounded-lg p-0.5 mb-3">
  <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm"
    onClick={() => setViewMode('list')}>
    <List className="h-4 w-4 mr-1" /> List
  </Button>
  <Button variant={viewMode === 'map' ? 'default' : 'ghost'} size="sm"
    onClick={() => setViewMode('map')}>
    <MapPin className="h-4 w-4 mr-1" /> Map
  </Button>
</div>

{viewMode === 'list' ? (
  /* existing session list content */
) : (
  <Suspense fallback={<PersonalityLoader />}>
    <SessionMap />
  </Suspense>
)}
```

### 3.3 Prompts Accessible from Home

On the Active Prompt card in Home.tsx, add:
```tsx
<Link to="/prompts" className="text-xs text-muted-foreground hover:text-foreground mt-2 block">
  See all community answers →
</Link>
```

---

## PART 4 — RSVP SIMPLIFICATION

### 4.1 Remove "Maybe/Interested"

RSVP buttons become binary:
- **Spots available**: "RSVP" → status = 'going'
- **Full**: "Join Waitlist" → status = 'waitlisted'
- **Already going**: "Going ✓" (outline) → click opens cancel confirmation

Remove any "Interested" or "Maybe" button from Events.tsx and EventDetail.tsx.

### 4.2 Add Bookmark/Save

Add a bookmark icon next to each event card:
```tsx
<Button variant="ghost" size="icon" onClick={() => toggleSave(event.id)}>
  <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
</Button>
```

Save to localStorage:
```tsx
const [saved, setSaved] = useState<string[]>(() =>
  JSON.parse(localStorage.getItem('fc_saved_events') || '[]')
);
const toggleSave = (id: string) => {
  const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
  setSaved(next);
  localStorage.setItem('fc_saved_events', JSON.stringify(next));
};
```

Don't change the database CHECK constraint — just stop using 'maybe' in new UI code.

---

## PART 5 — HOME PAGE PRIORITY-BASED RENDERING

### 5.1 Primary Action Card

Create `src/components/home/PrimaryActionCard.tsx`:

Shows ONE primary card based on user state:

```tsx
/* DESIGN: Home answers "What should I do right now?" instantly.
   One clear action, not 12 competing cards. */

// Priority order:
// 1. Active session NOW → "Check in!"
// 2. Pending feedback → "How was yesterday?"
// 3. Session today → countdown + details
// 4. Next booked session → date + calendar button
// 5. No sessions → "Find your next session" with recommendations
```

**Render each type:**

- **active-session**: Big card: "Your session is live at {venue}! → Check in" (green accent, links to /session/{id})
- **feedback**: "How was {title} at {venue}?" with 5 emoji buttons (reuse existing feedback pattern)
- **today**: "{title} at {venue} — starts in {countdown}" with AddToCalendarButton
- **upcoming**: "Next: {day}, {time} at {venue}" with AddToCalendarButton and "View details" link
- **find-session**: "Find your next session" with top 3 recommended sessions. Each shows title, venue, date, distance badge, and a "RSVP" button

### 5.2 Home Page Render Order

Keep the greeting + rank badge at the very top. Then:

1. **MilestoneCelebration** (existing overlay — if triggered)
2. **PrimaryActionCard** (new)
3. **Weekly Digest** (Mondays only — existing)
4. **ProfilePromptCard** (new progressive prompts — if applicable)
5. **Sessions Near You** (existing horizontal scroll)
6. **Perfect For You** (existing horizontal scroll)
7. **Try Something New** (existing horizontal scroll)
8. **Post-Session Summary** (existing — if applicable)
9. **Active Prompt** (with "See all answers →" link to /prompts)
10. **Progressive cards** (only show when the user has enough context — see Part 7.3):
    - New Faces carousel (always — shows community is alive)
    - Community Highlight (after 1+ session)
    - Top Matches (if "looking for" tags exist)
    - Community Pulse stats (after 2+ sessions)
    - Leaderboard (after 3+ sessions)

Each card checks `profile.events_attended` and only renders if the threshold is met. First-time users see a clean Home with just the PrimaryActionCard and recommendations. Power users see the full experience.

---

## PART 6 — SESSION PAGE FOCUS MODE

### 6.1 Deep Work Phase → Minimal UI

In `src/pages/Session.tsx`, when the current phase type is `deep_work`:

```tsx
const isDeepWork = currentPhase?.phase_type === 'deep_work';

{isDeepWork ? (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 py-8">
    <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">
      Focus Mode
    </p>

    {/* Large centered timer */}
    <div className="relative w-48 h-48">
      {/* existing timer SVG */}
      <p className="absolute inset-0 flex items-center justify-center text-3xl font-mono font-bold">
        {formatTime(remainingSeconds)}
      </p>
    </div>

    {/* Intention reminder */}
    {userIntention && (
      <p className="text-sm text-muted-foreground text-center max-w-[280px] italic">
        "{userIntention}"
      </p>
    )}

    {/* Tablemate traffic lights — minimal dots */}
    <div className="flex gap-4">
      {groupMembers?.map(m => (
        <div key={m.id} className="flex flex-col items-center gap-1">
          <div className={`w-3 h-3 rounded-full ${
            m.status === 'red' ? 'bg-red-500' :
            m.status === 'amber' ? 'bg-amber-500' : 'bg-green-500'
          }`} />
          <span className="text-[11px] text-muted-foreground">
            {m.display_name?.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>

    {/* Phase progress dots */}
    <div className="flex gap-2">
      {phases.map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${
          i === currentPhaseIndex ? 'bg-primary scale-125' :
          i < currentPhaseIndex ? 'bg-primary/40' : 'bg-muted-foreground/20'
        }`} />
      ))}
    </div>
  </div>
) : (
  /* Full phase UI for icebreaker, social break, wrap-up (existing code) */
)}
```

---

## PART 7 — PROGRESSIVE GAMIFICATION DISPLAY

### Why
Instead of removing gamification, make it **progressive** — it appears as users earn it. A first-timer sees a clean profile. A 10-session veteran sees a rich achievement wall. Nothing is cut — it's earned into view.

### 7.1 Progressive Badge Display on Profile Tab

In the Profile tab, show badges ONLY if the user has earned at least 1 badge. If they have zero badges, don't show the section at all (no empty grid, no locked items).

```tsx
{earnedBadges.length > 0 && (
  <div>
    <h3 className="text-sm font-medium mb-2">Badges ({earnedBadges.length})</h3>
    <div className="flex flex-wrap gap-2">
      {earnedBadges.map(b => (
        <Badge key={b.badge_type} variant="secondary">
          {getBadgeDef(b.badge_type)?.emoji} {getBadgeDef(b.badge_type)?.name}
        </Badge>
      ))}
    </div>
  </div>
)}
```

**Key change:** Show ONLY earned badges as pills/tags. No locked/grayed items. No grid of 16 with 14 locked. Just the ones you have, worn proudly.

### 7.2 Progressive Achievements and Monthly Titles

Same pattern:
- Show AchievementsSection ONLY if user has earned at least 1 achievement
- Show MonthlyTitlesSection ONLY if user has received at least 1 title
- If empty, these sections simply don't render — no "you haven't earned any yet" messages

### 7.3 Progressive Home Page Cards

Cards on the Home page should also be activity-gated:
- **Leaderboard**: Only show if user has attended 3+ sessions (they have context for it)
- **Top Matches**: Only show if user has filled out "looking for" tags
- **Community Pulse**: Only show if user has attended 2+ sessions
- **New Faces**: Always show (helps first-timers feel the community is alive)
- **Community Highlight**: Only show if user has attended 1+ session

### 7.4 Journey Tab Is Inclusive

The Journey tab (Part 2.3) shows EVERYTHING earned — badges, achievements, milestones, titles — as a timeline. This is the "full picture" for power users who want to see their complete history. First-timers see: "Your journey starts with your first session."

### 7.5 Keep All Earning Logic

All code in badges.ts, ranks.ts, growth.ts stays exactly as-is. We're only changing display conditions, not earning.

---

## Implementation Notes

- **Do NOT delete any database tables, columns, or earning logic.** All changes are UI restructuring and progressive display.
- **Do NOT delete existing Step component files** (Step1-6) — keep for reference/reuse by progressive prompts.
- **Philosophy: Progressive, not cutting.** Nothing is removed from the app — features appear as users earn context for them. A first-timer sees a focused experience. A veteran sees the full richness. Same codebase, different rendering based on `events_attended` and earned items.
- **The `/map` route still works** — accessed from Sessions page toggle, not bottom nav.
- **The `/prompts` route still works** — accessed from Home page prompt card link.
- **framer-motion** (already installed) — use for tab transitions and card enter animations.
- **shadcn Tabs** — already in the project at `@/components/ui/tabs`.
- Add `/* DESIGN: ... */` comments in the code before major sections explaining the reasoning.
