# Prompt 14 — System Audit Fixes (Security, Data Flows, Personality Wiring)

A deep audit found critical security holes, broken data flows, and a personality system that's defined but never wired in. This prompt fixes all of it in priority order.

---

## PART A — CRITICAL SECURITY FIXES (RLS Policies)

### A1. Lock down `personality_config` table
The current RLS allows ANY authenticated user to INSERT/UPDATE/DELETE personality config. Fix:
- DROP existing INSERT/UPDATE/DELETE policies on `personality_config`
- CREATE new policies that restrict INSERT/UPDATE/DELETE to admin users only (check `profiles.user_type = 'admin'` for `auth.uid()`)
- Keep SELECT open to all authenticated users (needed for PersonalityProvider)

### A2. Lock down `venue_partners` table
Any authenticated user can currently create/modify venue partner records. Fix:
- DROP existing INSERT/UPDATE/DELETE policies on `venue_partners`
- CREATE new policies restricting INSERT/UPDATE/DELETE to admin users only
- Keep SELECT open to all authenticated users

### A3. Protect system-managed profile columns
Users can currently UPDATE their own `user_type`, `reliability_status`, `no_show_count`, `sessions_rsvpd`, `sessions_showed_up`, `captain_sessions`, `focus_hours` — these are all system-managed. Fix:
- DROP the existing UPDATE policy on `profiles`
- CREATE a new UPDATE policy that only allows users to update non-system columns. Use a column list approach: the policy should check `auth.uid() = id` AND the update should only be allowed to modify: `display_name`, `bio`, `avatar_url`, `gender`, `area`, `work_type`, `linkedin_url`, `instagram_handle`, `twitter_handle`, `show_linkedin`, `show_instagram`, `show_twitter`, `social_goals`, `give_help`, `get_help`, `onboarding_completed`
- For system columns (`user_type`, `reliability_status`, `no_show_count`, `sessions_rsvpd`, `sessions_showed_up`, `captain_sessions`, `focus_hours`, `is_table_captain`, `current_streak`, `longest_streak`, `events_attended`, `events_no_show`), create a separate UPDATE policy that only allows service_role or admin to modify them

### A4. Protect `member_milestones` from user self-award
- DROP existing INSERT policy
- CREATE INSERT policy that only allows service_role key (or wrap milestone creation in an RPC function that validates the milestone was actually earned)

### A5. Validate `analytics_events` user_id
- UPDATE the INSERT policy to check `user_id = auth.uid()` so users can't insert events for other users

### A6. Prevent self-flagging in `member_flags`
- UPDATE the INSERT policy to add `flagged_user != auth.uid()` check

### A7. Validate `session_waitlist` ownership
- UPDATE INSERT policy to check `user_id = auth.uid()`

### A8. Prevent `is_captain` self-assignment in `event_rsvps`
- UPDATE INSERT/UPDATE policy so that `is_captain` can only be set by admin/service_role
- Regular users should always INSERT with `is_captain = false`

### A9. Lock down `notifications` INSERT
Any user can currently create notifications targeting ANY other user. Fix:
- DROP the permissive INSERT policy
- CREATE an INSERT policy that checks `user_id = auth.uid()` (for self-notifications) OR create a SECURITY DEFINER function for system-originated notifications

### A10. Restrict `member_flags` SELECT to admin only
Any user can currently read ALL flags, including who flagged them. Fix:
- DROP the "Authenticated can read flags" SELECT policy
- CREATE SELECT policy restricted to admin users only (or users can only see flags they created)

### A11. Lock down `icebreaker_questions` write access
Any user can INSERT new questions and UPDATE all columns. Fix:
- DROP existing INSERT/UPDATE policies
- CREATE admin-only INSERT/UPDATE policies

### A12. Lock down badge/achievement/title self-award
`member_badges`, `exclusive_achievements`, `monthly_titles` all let users self-award. Fix:
- For each table, DROP the permissive INSERT policy
- CREATE SECURITY DEFINER functions that validate the award was earned before inserting
- Or restrict INSERT to admin/service_role only

### A13. Lock down `venue_scans` INSERT
Any user can fabricate scan records. Fix:
- UPDATE INSERT policy to only allow scans where `scanned_by = auth.uid()`

### A14. Add missing unique constraints
Create these unique constraints to prevent duplicate data:
```sql
ALTER TABLE event_feedback ADD CONSTRAINT uq_event_feedback_event_user UNIQUE (event_id, user_id);
ALTER TABLE session_waitlist ADD CONSTRAINT uq_session_waitlist_user_session UNIQUE (user_id, session_id);
ALTER TABLE member_flags ADD CONSTRAINT uq_member_flags_per_session UNIQUE (flagged_user, flagging_user, session_id);
```

### A15. Add missing indexes
```sql
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_session_feedback_session_id ON session_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_member_ratings_to_user ON member_ratings(to_user);
CREATE INDEX IF NOT EXISTS idx_session_waitlist_session_id ON session_waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_member_flags_flagged_user ON member_flags(flagged_user);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_member_milestones_user_id ON member_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_peer_props_to_user ON peer_props(to_user);
```

---

## PART B — WIRE BROKEN DATA FLOWS

### B1. Wire `updateReliability()` — currently ZERO call sites
This function tracks no-shows and applies graduated consequences. Wire it:

1. In the **check-in flow** (wherever geolocation check-in succeeds): after marking `checked_in = true`, call `updateReliability(userId, 'showed_up')`.
2. Create a **no-show detection** mechanism: after a session's start_time + 30 minutes, for any RSVP'd user who hasn't checked in, call `updateReliability(userId, 'no_show')`.
   - For now, do this client-side: when a session page loads and current time is 30+ min past start, check if user has checked in. If not, call `updateReliability()` with `'no_show'`.
   - Show a toast/notification to users with `reliability_status = 'WARNING'` on the Events page: "Heads up — you've missed recent sessions. Your reliability score is at risk."
   - Users with `reliability_status = 'RESTRICTED'` should see a banner on Events page and be unable to RSVP (show message explaining why and how to recover).

### B2. Wire `promoteWaitlist()` — users enter but never leave
When a user **cancels their RSVP** (un-RSVPs from an event), after removing their RSVP:
1. Call `promoteWaitlist(eventId)` to auto-promote the next person on the waitlist
2. This function already handles: finding position #1, creating their RSVP, removing from waitlist, sending notification

Find the RSVP cancellation handler (likely in EventDetail.tsx or Events.tsx where status is updated to 'cancelled') and add the `promoteWaitlist()` call there.

### B3. Wire `createSmartGroups()` — the matching algorithm
This is the superior grouping function (considers captain status, experience, gender). Wire it:
1. Add a **"Create Groups" button** in the admin session management UI (or auto-trigger it)
2. When triggered for a session/event: fetch all RSVP'd members, call `createSmartGroups(members, targetSize)`, then write the resulting groups to the `groups` and `group_members` tables
3. Alternatively, create an admin-facing endpoint that calls this function

### B4. Wire `trackAnalyticsEvent()` — only tracks page_view
Add tracking calls for these events throughout the app:
- `'signup'` — in Onboarding.tsx after profile save completes
- `'rsvp'` — in Events.tsx / EventDetail.tsx after successful RSVP
- `'rsvp_cancel'` — after RSVP cancellation
- `'checkin'` — after successful geolocation check-in
- `'feedback_submit'` — after session feedback is submitted
- `'props_sent'` — in GivePropsFlow.tsx after props are saved
- `'share_click'` — on WhatsApp/LinkedIn/Copy share button clicks
- `'qr_scan'` — in the venue scan tracking flow (Index.tsx)
- `'prompt_answer'` — in Prompts.tsx after answering a prompt
- `'profile_view'` — in ProfileView.tsx on page load
- `'referral_signup'` — in Onboarding.tsx when referral code is present

### B5. Mount `FlagMemberForm` component
The component exists but is never rendered. Add it to the Session.tsx page:
- Show a small "Report" or flag icon button in the session attendee list
- When clicked, open the `FlagMemberForm` in a dialog/sheet
- Pre-populate the session ID and available member list

### B6. Wire `usePersonality()` context OR remove the dead provider
The PersonalityProvider fetches from DB on every page load but `usePersonality()` is never called. Two options:
- **Option A (recommended):** Wire it in — replace all inline personality strings with `usePersonality()` calls. At minimum, use it in Home.tsx for greetings, in error toasts, and in empty states.
- **Option B:** Remove PersonalityProvider from App.tsx to save the wasted DB query, and just use static imports from personality.ts.

Go with **Option A**: use the context so admin can modify personality via ChaiSettingsTab.

---

## PART C — PERSONALITY WIRING (Replace hardcoded strings with constants)

### C1. Fix ALL "event/events" → "session/sessions" in user-facing text
Replace every instance. Key locations:
- `Index.tsx:26` — "Meetups & Events" → "Cowork Sessions" or "Sessions"
- `EventDetail.tsx:70` — "Event -- FocusClub" → "Session -- FocusClub"
- `EventDetail.tsx:171,172,173` — "Event not found" → "Session not found", "Back to Events" → "Back to Sessions"
- `Events.tsx:656` — "All Events" → "All Sessions"
- `Events.tsx:268` — "Failed to create event" → use ERROR_STATES.generic
- `Events.tsx:370` — "Women-only event" → "Women-only session"
- `Events.tsx:687` — "No past events yet" → "No past sessions yet"
- `Session.tsx:305` — "This event doesn't have a structured session." → "This session doesn't have a structured format."
- `Partners.tsx:80` — "events hosted" → "sessions hosted"
- `ProfileView.tsx:263` — "events" → "sessions"
- `GivePropsFlow.tsx:285` — "attend an event" → "attend a session"
- `GivePropsFlow.tsx:289` — "event(s)" → "session(s)"
- `PhotoMoment.tsx:44` — "event memories" → "session memories"
- `Admin.tsx:419,425,428` — "event" → "session"

### C2. Replace generic error toasts with ERROR_STATES
In every file that shows error toasts, import `ERROR_STATES` from `@/lib/personality` and use the appropriate constant:
- Network errors → `ERROR_STATES.network`
- Generic errors → `ERROR_STATES.generic`
- Session full → `ERROR_STATES.sessionFull`
- Already RSVP'd → `ERROR_STATES.alreadyRsvpd`
- **CRITICAL:** In `Profile.tsx:304`, replace `error.message` with `ERROR_STATES.generic` — raw Supabase errors must NOT be shown to users.
- In `ErrorBoundary.tsx:34`, use `ERROR_STATES.generic`

### C3. Replace generic success toasts with CONFIRMATIONS
- `GivePropsFlow.tsx` — use `CONFIRMATIONS.propsSent`
- `PhotoMoment.tsx` — use `CONFIRMATIONS.photoUploaded`
- `Events.tsx` RSVP success — use `CONFIRMATIONS.rsvpSuccess`
- `Prompts.tsx` prompt answered — use `CONFIRMATIONS.promptAnswered`
- Feedback submitted — use `CONFIRMATIONS.feedbackSubmitted`

### C4. Add personality loading messages
In each page's loading/skeleton state, add a small text element showing `getLoadingMessage()` above or below the skeleton blocks. Even just on the main pages: Home, Events, Discover, Session.

### C5. Wire CELEBRATIONS to streak milestones
In `SessionWrapUp.tsx`, replace hardcoded streak celebration strings with `CELEBRATIONS.streak3`, `CELEBRATIONS.streak5`, `CELEBRATIONS.streak10`, `CELEBRATIONS.streak25`, `CELEBRATIONS.firstSession`, `CELEBRATIONS.rankUp`.

### C6. Add missing page titles
- `Admin.tsx` — add `usePageTitle("Mission Control -- FocusClub")`
- `Onboarding.tsx` — add `usePageTitle("Join -- FocusClub")`
- `NotFound.tsx` — add `usePageTitle("Lost -- FocusClub")`

### C7. Pass missing greeting context
In `Home.tsx` where `getContextualGreeting()` is called, also pass:
- `isFirstVisit`: check if user has 0 sessions attended
- `afterFirstSession`: check if user has exactly 1 session attended
- `daysSinceActive`: calculate from `last_active_at` or `updated_at`
- `monthsAsMember`: calculate from `created_at`

This unlocks the special first-visit greeting, post-first-session greeting, and returning-after-absence greeting.

---

## PART D — CODE QUALITY CLEANUP

### D1. Remove all unnecessary `as any` casts on Supabase queries
Every table cast with `as any` exists in the generated types. Remove the casts from all Supabase `.from()` calls and `.upsert()`/`.insert()` payloads. This restores TypeScript type checking. Key files:
- `GrowthTab.tsx`, `EnergyCheck.tsx`, `IcebreakersTab.tsx`, `GivePropsFlow.tsx`, `sessionPhases.ts`, `PhotoMoment.tsx`, `EventDetail.tsx`, `PartnersTab.tsx`, `Events.tsx`, `Index.tsx`, `Partners.tsx`, `Session.tsx`, `CaptainCard.tsx`, `FlagMemberForm.tsx`, `VenueReviewCard.tsx`, `SessionWrapUp.tsx`, `antifragile.ts`, `growth.ts`, `icebreakers.ts`, `badges.ts`, `Profile.tsx`

Also remove `(profile as any).fieldName` patterns — all profile fields exist in the generated types.

### D2. Fix OnboardingData circular dependency
Move the `OnboardingData` interface from `Onboarding.tsx` to `src/lib/types.ts` (or `src/components/onboarding/types.ts`). Update all Step component imports to use the new location.

### D3. Display CaptainBadge
The `CaptainBadge` component is exported but never imported. Show it:
- In the session attendee list next to table captains
- On profile cards for captains
- In the Discover page member cards for captains

---

## Implementation Order

1. **Security first (Part A)** — create a single migration for all RLS fixes, constraints, and indexes
2. **Data flows (Part B)** — wire the broken functions
3. **Personality (Part C)** — replace hardcoded strings
4. **Code quality (Part D)** — remove `as any`, fix circular deps

Take each part as a batch. Don't skip any items. Every change listed above was identified through a thorough system audit and is necessary.
