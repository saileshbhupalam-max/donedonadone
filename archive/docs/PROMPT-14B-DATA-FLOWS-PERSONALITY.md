# Prompt 14B — Wire Broken Data Flows + Personality System

The audit found 3 completely broken data flows (functions defined but never called), a personality system that's 90% dead code, and 17+ places where "event" should say "session". This prompt wires everything up.

---

## PART 0 — CRITICAL FIX FROM 14A

The security migration (14A) added `user_type text DEFAULT 'member'` to profiles and all admin RLS policies check `user_type = 'admin'`. But no user was ever set to admin. The admin cannot manage any locked-down tables until this is fixed.

**Create a small migration:**

```sql
-- Set admin user_type for the platform admin
UPDATE profiles
SET user_type = 'admin'
WHERE email = 'saileshbhupalam@gmail.com';
```

If `email` is not on the profiles table, find the admin user via `auth.users` and update by `id`:

```sql
UPDATE profiles
SET user_type = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'saileshbhupalam@gmail.com' LIMIT 1);
```

Also update `Admin.tsx` to check `profile.user_type === 'admin'` instead of (or in addition to) the hardcoded `ADMIN_EMAILS` array. This makes the admin check consistent between RLS and the app.

**Also:** Update the reliability status values in the client code. The 14A migration uses lowercase values (`'good'`, `'warning'`, `'restricted'`). Make sure any client-side checks match — use lowercase, not `'WARNING'` or `'RESTRICTED'`.

---

## PART 1 — WIRE BROKEN DATA FLOWS

### 1.1 Wire `updateReliability()` — NO-SHOW TRACKING (currently zero call sites)

`updateReliability()` in `src/lib/antifragile.ts` tracks RSVPs, show-ups, and no-shows with graduated consequences. It is never called anywhere. Wire it:

**On successful check-in** (wherever geolocation check-in marks `checked_in = true`):
```ts
import { updateReliability } from '@/lib/antifragile';
// After check-in succeeds:
await updateReliability(userId, 'showed_up');
```

**No-show detection** — in `Session.tsx` or `EventDetail.tsx`, when the page loads and current time is 30+ minutes past the session start time, check if the current user RSVP'd but hasn't checked in:
```ts
const sessionStart = new Date(`${event.date} ${event.start_time}`);
const now = new Date();
const minutesPast = (now.getTime() - sessionStart.getTime()) / 60000;

if (minutesPast > 30 && userRsvp && !userRsvp.checked_in) {
  await updateReliability(userId, 'no_show');
}
```

**Show reliability warnings on Events page:**
- If `profile.reliability_status === 'warning'`, show an amber banner at the top of Events: "Heads up — you've missed recent sessions. One more no-show and your account will be restricted."
- If `profile.reliability_status === 'restricted'`, show a red banner: "Your account is restricted due to repeated no-shows. Contact us to restore access." Disable the RSVP button on all events.

### 1.2 Wire `promoteWaitlist()` — WAITLIST EXITS (users enter but never leave)

`promoteWaitlist()` in `src/lib/antifragile.ts` auto-promotes the next waitlisted person when a spot opens. It is never called. Wire it:

Find the RSVP cancellation flow (where a user un-RSVPs or cancels their booking). After the RSVP status is updated to 'cancelled' or the RSVP row is deleted:
```ts
import { promoteWaitlist } from '@/lib/antifragile';
// After un-RSVP succeeds:
await promoteWaitlist(eventId);
```

This is likely in `EventDetail.tsx` or `Events.tsx` — find the cancel/un-RSVP handler and add the call there.

### 1.3 Wire `createSmartGroups()` — THE MATCHING ALGORITHM

`createSmartGroups()` in `src/lib/antifragile.ts` distributes members into balanced groups considering captain status, experience, and gender. It is never called. Wire it:

**Option A (recommended for now): Admin button**
In the admin dashboard, add a "Create Groups" action for each upcoming session:
1. Fetch all confirmed RSVPs for the session (with their profile data including gender, events_attended, is_table_captain)
2. Call `createSmartGroups(members, 4)` (target group size 4)
3. Write the resulting groups to the `groups` and `group_members` tables
4. Show a success toast with group count

**Option B (auto-trigger): Edge function**
Create a Supabase Edge Function that runs N hours before session start, auto-creating groups. This is better long-term but more complex.

Go with Option A for now. Add the button in the admin Events/Sessions management area.

### 1.4 Wire `trackAnalyticsEvent()` — ONLY 1 EVENT TRACKED

`trackAnalyticsEvent()` from `src/lib/growth.ts` is only called for `page_view` in Home.tsx. Add tracking for all these events:

| Event | Where to add | When |
|-------|-------------|------|
| `signup` | `Onboarding.tsx` | After profile save completes successfully |
| `rsvp` | `EventDetail.tsx` or `Events.tsx` | After successful RSVP insert |
| `rsvp_cancel` | `EventDetail.tsx` or `Events.tsx` | After RSVP cancellation |
| `checkin` | Session check-in handler | After geolocation check-in succeeds |
| `feedback_submit` | `Events.tsx` / `Home.tsx` | After session feedback is saved |
| `props_sent` | `GivePropsFlow.tsx` | After props are saved (~line 124) |
| `share_click` | `WhatsAppButton.tsx` / share handlers | On any share button click |
| `qr_scan` | `Index.tsx` | On venue scan tracking (~line 52) |
| `prompt_answer` | `Prompts.tsx` | After prompt response is saved |
| `profile_view` | `ProfileView.tsx` | On page load |
| `referral_signup` | `Onboarding.tsx` | When referral code is present during signup |

Each call looks like:
```ts
import { trackAnalyticsEvent } from '@/lib/growth';
await trackAnalyticsEvent(userId, 'rsvp', { event_id: eventId });
```

### 1.5 Mount `FlagMemberForm` — UNREACHABLE UI

`FlagMemberForm` component exists at `src/components/session/FlagMemberForm.tsx` but is never rendered anywhere. Members cannot flag other members.

In `Session.tsx`, in the attendee list area where group members are shown:
1. Add a small flag/report icon button next to each member (NOT the current user)
2. When clicked, open a `Dialog` or `Sheet` containing `<FlagMemberForm />`
3. Pass the `sessionId` and the list of other group members as props

```tsx
import { FlagMemberForm } from '@/components/session/FlagMemberForm';

// In the member list:
<Dialog>
  <DialogTrigger asChild>
    <Button variant="ghost" size="icon" className="h-6 w-6">
      <Flag className="h-3 w-3" />
    </Button>
  </DialogTrigger>
  <DialogContent>
    <FlagMemberForm sessionId={eventId} members={groupMembers} />
  </DialogContent>
</Dialog>
```

### 1.6 Display `CaptainBadge` — EXPORTED BUT NEVER SHOWN

`CaptainBadge` in `src/components/captain/CaptainCard.tsx` is exported but never imported. Show it:

1. In `Session.tsx` attendee list — next to members where `is_table_captain = true`
2. In `ProfileView.tsx` — near the user's name/avatar if they are a captain
3. In `Discover.tsx` member cards — on captain members

```tsx
import { CaptainBadge } from '@/components/captain/CaptainCard';
// Next to captain names:
{member.is_table_captain && <CaptainBadge />}
```

---

## PART 2 — PERSONALITY WIRING

### 2.1 Replace ALL "event/events" with "session/sessions" in user-facing text

This is the most visible issue. Replace every instance:

| File | Line | Current | Replace with |
|------|------|---------|-------------|
| `Index.tsx` | ~26 | "Meetups & Events" | "Cowork Sessions" |
| `EventDetail.tsx` | ~70 | "Event -- FocusClub" | "Session -- FocusClub" |
| `EventDetail.tsx` | ~171 | "Event not found" | "Session not found" |
| `EventDetail.tsx` | ~172 | "This event doesn't exist..." | "This session doesn't exist..." |
| `EventDetail.tsx` | ~173 | "Back to Events" | "Back to Sessions" |
| `Events.tsx` | ~656 | "All Events" | "All Sessions" |
| `Events.tsx` | ~268 | "Failed to create event" | Use `ERROR_STATES.generic` |
| `Events.tsx` | ~370 | "Women-only event" | "Women-only session" |
| `Events.tsx` | ~687 | "No past events yet" | "No past sessions yet" |
| `Session.tsx` | ~305 | "This event doesn't have a structured session." | "This session doesn't have a structured format." |
| `Partners.tsx` | ~80 | "events hosted" | "sessions hosted" |
| `ProfileView.tsx` | ~263 | "{count} events" | "{count} sessions" |
| `GivePropsFlow.tsx` | ~285 | "attend an event!" | "attend a session!" |
| `GivePropsFlow.tsx` | ~289 | "event(s)" | "session(s)" |
| `PhotoMoment.tsx` | ~44 | "event memories" | "session memories" |
| `Admin.tsx` | ~419 | "creating an event" | "creating a session" |
| `Admin.tsx` | ~425 | "No upcoming events" | "No upcoming sessions" |
| `Admin.tsx` | ~428 | "No past events" | "No past sessions" |

Do a global search for "event" (case-insensitive) in all `.tsx` and `.ts` files and fix any other instances in user-facing strings. Don't change variable names, table names, or code identifiers — only user-facing text.

### 2.2 Wire `ERROR_STATES` into all error toasts

Import `ERROR_STATES` from `@/lib/personality` and replace generic error messages:

```ts
import { ERROR_STATES } from '@/lib/personality';
```

Replace patterns like `toast({ title: "Error", description: "Something went wrong..." })` with the appropriate personality constant:

- Generic errors → `ERROR_STATES.generic` ("Well, that didn't go as planned. Neither did my morning. Try again?")
- Network errors → `ERROR_STATES.network`
- Session full → `ERROR_STATES.sessionFull`
- Already RSVP'd → `ERROR_STATES.alreadyRsvpd`

**CRITICAL SECURITY FIX:** In `Profile.tsx` (~line 304), replace `error.message` with `ERROR_STATES.generic`. Raw Supabase error messages must NEVER be shown to users — they can contain SQL details and column names.

In `ErrorBoundary.tsx` (~line 34), replace "Something went wrong. Please try reloading." with `ERROR_STATES.generic`.

Key files to update: `Home.tsx`, `Events.tsx`, `EventDetail.tsx`, `Index.tsx`, `Onboarding.tsx`, `Profile.tsx`, `GivePropsFlow.tsx`, `PhotoMoment.tsx`, `VenueReviewCard.tsx`, `ErrorBoundary.tsx`

### 2.3 Wire `CONFIRMATIONS` into success toasts

Import and use these instead of inline strings:

| File | Current toast | Use instead |
|------|--------------|-------------|
| `GivePropsFlow.tsx` | "Props sent!" | `CONFIRMATIONS.propsSent` |
| `PhotoMoment.tsx` | "Photo saved to event memories!" | `CONFIRMATIONS.photoUploaded` |
| RSVP success handler | Whatever it shows | `CONFIRMATIONS.rsvpSuccess` |
| `Prompts.tsx` prompt answer | Whatever it shows | `CONFIRMATIONS.promptAnswered` |
| Feedback submission | Whatever it shows | `CONFIRMATIONS.feedbackSubmitted` |

### 2.4 Add personality to loading states

This is the biggest personality gap — every page shows silent skeleton blocks during loading. Add a loading message above or alongside the skeletons on the main pages.

Create a small reusable component:

```tsx
// src/components/ui/PersonalityLoader.tsx
import { getLoadingMessage } from '@/lib/personality';

export function PersonalityLoader() {
  const message = getLoadingMessage();
  return (
    <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">
      {message}
    </p>
  );
}
```

Add `<PersonalityLoader />` above the skeleton blocks in: `Home.tsx`, `Events.tsx`, `Discover.tsx`, `Session.tsx`, `EventDetail.tsx`, `Profile.tsx`.

### 2.5 Wire `CELEBRATIONS` to streak milestones

In `SessionWrapUp.tsx`, replace hardcoded streak celebration strings with the personality constants:

```ts
import { CELEBRATIONS } from '@/lib/personality';

// Replace inline strings:
// "3 session streak! Amazing!" → CELEBRATIONS.streak3
// "5 session streak!" → CELEBRATIONS.streak5
// etc.
```

Also wire `CELEBRATIONS.firstSession` for the user's first session, and `CELEBRATIONS.rankUp` when their rank changes.

### 2.6 Wire `usePersonality()` context — or it's wasted work

The `PersonalityProvider` wraps the entire app and fetches from the DB on every page load, but `usePersonality()` is never called by any component. The provider is doing work for nothing.

Wire it into at least the greeting and key touchpoints:

In `Home.tsx`, replace the static `getContextualGreeting()` import with the dynamic context:
```ts
const personality = usePersonality();
// Use personality.get('greetings', 'morning') etc.
// Fall back to static getContextualGreeting() if context not loaded
```

This way, when admin edits personality via ChaiSettingsTab, the changes actually take effect.

### 2.7 Pass missing greeting context fields

In `Home.tsx` where `getContextualGreeting()` is called, also pass these currently-missing fields:

```ts
getContextualGreeting({
  firstName: profile.display_name,
  // ... existing fields ...
  // ADD these:
  isFirstVisit: (profile.events_attended || 0) === 0,
  afterFirstSession: (profile.events_attended || 0) === 1,
  daysSinceActive: calculateDaysSince(profile.last_active_at || profile.updated_at),
  monthsAsMember: calculateMonthsSince(profile.created_at),
});
```

This unlocks 3 special greetings: first-visit welcome, post-first-session celebration, and returning-after-absence message.

### 2.8 Add missing page titles

```ts
// Admin.tsx — add near the top of the component:
usePageTitle("Mission Control -- FocusClub");

// Onboarding.tsx:
usePageTitle("Join -- FocusClub");

// NotFound.tsx:
usePageTitle("Lost -- FocusClub");
```

### 2.9 Fix button label consistency

- `Profile.tsx` sign-out dialog: change "Cancel" → "Never mind" (matches pattern in Prompts.tsx and FlagMemberForm.tsx)
- `FlagMemberForm.tsx`: change "Submit" → "Report"
- `VenueReviewCard.tsx`: change "Submit" → "Rate it"
