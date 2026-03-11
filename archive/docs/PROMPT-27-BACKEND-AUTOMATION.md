# Prompt 27: Backend Automation — Autopilot, Streaks, Push Notifications, Missed-You

## Context
Several features have frontend UI but no backend logic. The autopilot suggestion card shows on Home.tsx for users with 3+ sessions. The streak warning card shows on Thursdays+ for users with 2+ week streaks. The "Your crew is going" social loss card shows circle members' RSVPs. But none of these have backend automation — no cron jobs actually auto-book sessions, check streak breaks, or send post-session "missed you" notifications.

The `profiles` table has: `autopilot_enabled`, `autopilot_days` (text[]), `autopilot_times` (text[]), `autopilot_max_per_week` (integer), `current_streak` (integer), `longest_streak` (integer), `streak_insurance_used_at` (timestamptz). The `event_rsvps` table tracks RSVPs. The `notifications` table and `create_system_notification` RPC exist. The `get_my_circle` RPC returns a user's coworking circle.

## What to Build

### Part 1: Autopilot Auto-Booking

Create a Supabase Edge Function `run-autopilot` that runs daily at 8 AM IST (via Supabase Cron):

**Logic:**
1. Query all profiles where `autopilot_enabled = true`
2. For each user, get their autopilot preferences: `autopilot_days` (e.g., ["monday", "wednesday"]), `autopilot_times` (e.g., ["morning", "afternoon"]), `autopilot_max_per_week` (e.g., 2)
3. Count how many RSVPs the user already has for the current week (Monday to Sunday). If >= autopilot_max_per_week, skip.
4. Query upcoming events in the next 7 days that match the user's preferences:
   - Day of week matches autopilot_days
   - Time slot matches autopilot_times (morning = start_time before 12:00, afternoon = 12:00-17:00, evening = after 17:00)
   - Event is not full (rsvp_count < max_spots)
   - User hasn't already RSVP'd
   - Event matches user's neighborhood preference (if they have one set via preferred_latitude/longitude, use proximity; otherwise match on neighborhood)
5. Pick the best matching event(s) up to the remaining weekly quota
6. For each selected event:
   - If payments are enabled and event is not free: create a pending payment note but DON'T auto-charge. Instead, create a notification: "Autopilot found a great session for you: [Event Title] on [Date]. Tap to confirm and pay." Link to the event page. This is "suggest and confirm" rather than "auto-book and charge."
   - If event is free: directly create the RSVP and send notification: "Autopilot booked you into [Event Title] on [Date] at [Venue]. See you there!"
7. Log all autopilot actions to an `autopilot_log` table: user_id, event_id, action (suggested/booked/skipped), reason, created_at

**Autopilot Settings UI Enhancement:**
The Home.tsx autopilot card currently just says "Set up" with no destination. Create an autopilot settings modal or page with:
- Toggle: Autopilot on/off
- Day checkboxes: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Time preference: Morning, Afternoon, Evening (multi-select)
- Max sessions per week: 1, 2, 3 (radio buttons)
- Save updates the profile columns

### Part 2: Streak Management

Create a Supabase Edge Function `check-streaks` that runs every Monday at 9 AM IST:

**Logic:**
1. Query all profiles where `current_streak > 0`
2. For each user, check if they attended any session in the previous week (Monday to Sunday):
   - A "session attended" means: an event_rsvp exists AND the event's date falls in last week AND either event_feedback exists with attended=true, OR the RSVP status indicates attendance
3. If they attended: increment `current_streak` by 1. Update `longest_streak` if current exceeds it. Send notification if they hit a milestone streak (5, 10, 25, 50, 100 weeks): "You're on a [N]-week streak! 🔥"
4. If they did NOT attend:
   - Check if `streak_insurance_used_at` is null or more than 30 days ago (insurance available)
   - If insurance was already auto-applied this cycle: break the streak
   - Don't auto-use insurance — the user must manually activate it (see Part 2b)
   - If no insurance: reset `current_streak` to 0. Send notification: "Your [N]-week streak ended. Start a new one this week!"

**Part 2b: Streak Insurance Activation**

Add a "Use Streak Save" button to the streak warning card on Home.tsx. When tapped:
- Call an RPC `use_streak_insurance(p_user_id uuid)` that:
  - Checks `streak_insurance_used_at` is null or > 30 days ago
  - Sets `streak_insurance_used_at` to now()
  - The streak check function (Part 2) should recognize that insurance was used this week and NOT break the streak
- Show confirmation: "Streak save used! Your streak is safe this week. Next save available in 30 days."
- If insurance was already used within 30 days: show "Your next streak save is available on [date]" — disable the button

The streak warning card should show:
- If insurance available: "You have a streak save available" + "Use Streak Save" button
- If insurance on cooldown: "Next save available [date]" — no button
- If no streak risk (already attended this week): don't show the card at all

### Part 3: Post-Session "Missed You" Notifications

Create a Supabase Edge Function `send-missed-you` that runs daily at 9 PM IST:

**Logic:**
1. Find all events that happened today (date = today, end_time has passed)
2. For each event, get the list of attendees (from event_rsvps)
3. For each attendee, get their circle (via `get_my_circle` or by querying `cowork_preferences` for mutual "cowork again" picks)
4. Find circle members who did NOT attend this event
5. For each circle member who missed the session:
   - Check if we already sent them a "missed you" for this event (avoid duplicates)
   - Create a notification: "Your crew met at [Venue] today without you! [Names] were there. Don't miss the next one." Link to the events page.
   - Insert into a `missed_you_sent` table: user_id, event_id, sent_at (for dedup)
6. Rate limit: max 2 "missed you" notifications per user per week. Don't be annoying.

### Part 4: Push Notifications (Web Push)

**Database setup:**
Create a `push_subscriptions` table:
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles)
- `endpoint` (text — the push service URL)
- `p256dh` (text — encryption key)
- `auth` (text — auth secret)
- `created_at` (timestamptz)
- `user_agent` (text — to identify device)
- Unique on (user_id, endpoint)

RLS: Users can insert/delete their own subscriptions. System functions can read all.

**Frontend: Permission Request Flow**

Create a `usePushNotifications` hook that:
- Checks if the browser supports push notifications (`'PushManager' in window`)
- Checks current permission status: granted, denied, default
- Provides a `requestPermission()` function that:
  1. Calls `Notification.requestPermission()`
  2. If granted: gets the push subscription from the service worker using the VAPID public key (stored as `VITE_VAPID_PUBLIC_KEY`)
  3. Saves the subscription to the `push_subscriptions` table
- Provides the current permission status for UI display

**Show a push notification prompt** on the Home page for users with 2+ sessions who haven't granted push permission:
- "Never miss a session with your crew" + "Enable Notifications" button
- If denied: don't show the prompt again
- Dismissable with "Not now" (stored in localStorage, re-ask after 2 weeks)

**Service Worker Push Handler:**

Add to the service worker (or create a push handler that integrates with the existing vite-plugin-pwa service worker):
- Listen for `push` events
- Parse the notification data (title, body, url, icon)
- Show the notification using `self.registration.showNotification()`
- Handle `notificationclick` to open/focus the app at the specified URL

**Backend: Sending Push Notifications**

Create a utility Edge Function `send-push-notification` that:
- Accepts: user_id, title, body, url (deep link), icon (optional)
- Queries `push_subscriptions` for the user
- Sends to all subscriptions using the Web Push protocol (using the `web-push` library or manual VAPID-signed fetch calls)
- Handles expired subscriptions: if push fails with 410 Gone, delete the subscription

**Wire push to existing triggers:**
- When `create_system_notification` RPC is called, also call `send-push-notification` for the same user
- Or: create a database trigger on INSERT to `notifications` table that calls the push Edge Function via `pg_net` (Supabase's HTTP extension)
- This way, every in-app notification automatically becomes a push notification too (for users who have enabled push)

**VAPID keys** will be generated externally and stored as Supabase secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:hello@focusclub.in). The public key is also exposed as `VITE_VAPID_PUBLIC_KEY` for the frontend.

### Part 5: Discover Page Rituals Feed

Add a "Community" tab or section to the Discover page (`src/pages/Discover.tsx`). Below the existing smart sections (Best Matches, New Members, etc.), add:

**"This Week in the Community" section:**
- Query `community_rituals` from the current week, ordered by created_at desc, limit 10
- Show each ritual as a small card: user avatar + name, ritual type badge ("Monday Focus" or "Friday Win"), the content text, likes count with a heart button
- Reuse the existing `CommunityRitualCard` component if its format works here, or create a compact variant
- This section only shows if there are rituals to display
- Gate behind 1+ sessions attended (same as Home page gating)

### Important
- All scheduled Edge Functions should be idempotent — running them twice should not create duplicate RSVPs, notifications, or log entries. Always check for existing records before creating new ones.
- The autopilot should NEVER auto-charge money. For paid events, it suggests and the user confirms. For free events, it can auto-book.
- Streak counting should be robust: handle timezone edge cases (IST), handle users who attend multiple sessions in a week (still counts as 1 streak week), handle weeks with no events available (should NOT break streak — only break if events existed and user didn't attend any).
- Push notification payload should be small (< 4KB). Keep title and body concise.
- The service worker push handler must work with the existing vite-plugin-pwa setup. Don't replace the existing service worker — extend it.
- Rate limit "missed you" notifications: max 2 per user per week, and never send to a user who was at a session today (they were active, don't nag them).
- All Edge Functions should have proper error logging. If a function fails for one user, it should continue processing other users and log the error.
