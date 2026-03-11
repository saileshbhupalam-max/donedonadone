# Prompt 24: Email Notifications with Resend

## Context
FocusClub has zero email infrastructure. Users won't check the app daily — without email, RSVPs drop off and sessions go under-attended. We need a complete email notification system using Resend (email API service) and Supabase Edge Functions.

The `notifications` table exists for in-app notifications. The `event_rsvps` table tracks RSVPs. The `session_waitlist` table tracks waitlisted users. The `profiles` table has user data. The `events` table has session details including date, start_time, end_time, venue_name, venue_address.

The Resend API key will be stored as a Supabase secret: `RESEND_API_KEY`. The from address will be `hello@focusclub.in`.

## What to Build

### Part 1: Email Preferences

Add an `email_preferences` jsonb column to the `profiles` table with this default structure: `{"rsvp_confirmation": true, "session_reminder": true, "waitlist_promotion": true, "weekly_digest": true}`.

Add an Email Preferences section to the user's profile/settings page (wherever profile editing happens). Four toggles, one for each email type. Label them clearly:
- "RSVP confirmations" — "Get an email when you RSVP for a session"
- "Session reminders" — "Reminder 24 hours and 1 hour before your session"
- "Waitlist updates" — "Get notified when a spot opens up"
- "Weekly digest" — "Sunday evening summary of upcoming sessions and your stats"

Each toggle updates the corresponding key in the jsonb column.

### Part 2: RSVP Confirmation Email

Create a Supabase Edge Function `send-rsvp-confirmation` that:
- Is triggered by a database webhook on INSERT to `event_rsvps` (or called via a database trigger)
- Fetches the user's profile (display_name, email from auth.users) and the event details (title, date, start_time, end_time, venue_name, venue_address)
- Checks the user's email_preferences — skip if rsvp_confirmation is false
- Sends an email via Resend with:
  - Subject: "You're in! [Event Title] on [Date]"
  - Body: Session details (date, time, venue with address), a Google Calendar link (the app already has `getGoogleCalendarUrl` in `src/lib/calendar.ts` — replicate that URL format), a cancellation link (deep link back to the app's event page), and a warm sign-off
- The email should be clean, minimal HTML — not a heavy marketing template. FocusClub's vibe is warm and personal, not corporate. Use the brand color (#7c3aed purple) sparingly.

### Part 3: Session Reminder Emails

Create a Supabase Edge Function `send-session-reminders` that runs on a schedule (via pg_cron or Supabase Cron):
- Runs every hour
- Queries events happening in exactly 24 hours (+/- 30 min window) and events happening in exactly 1 hour (+/- 30 min window)
- For each, finds all users with RSVPs (status = confirmed/going)
- Checks email_preferences.session_reminder for each user
- Sends reminder email:
  - 24h reminder subject: "Tomorrow: [Event Title] at [Venue]"
  - 1h reminder subject: "Starting soon: [Event Title] in 1 hour!"
  - Body: Quick session details, venue address with Google Maps link, the WhatsApp group link if available, a "what to bring" note (laptop, charger, headphones)
- Track sent reminders to avoid duplicates — add a `reminder_emails_sent` table: `id, user_id, event_id, reminder_type (24h/1h), sent_at`. Check this before sending.

### Part 4: Waitlist Promotion Email

Create a Supabase Edge Function `send-waitlist-promotion` that:
- Is triggered when a `session_waitlist` row's `promoted_at` is set (database webhook on UPDATE where promoted_at changes from null to not-null)
- Fetches user profile and event details
- Checks email_preferences.waitlist_promotion
- Sends email:
  - Subject: "A spot opened up! [Event Title]"
  - Body: "Great news — a spot just opened up for [session] on [date]. Your RSVP has been confirmed automatically." Include session details and a note that spots are limited.
- This email is time-sensitive — it should convey urgency without being spammy.

### Part 5: Weekly Digest Email

Create a Supabase Edge Function `send-weekly-digest` that runs every Sunday at 6 PM IST:
- For each active user (last login within 30 days):
  - Check email_preferences.weekly_digest
  - Gather: upcoming sessions they've RSVP'd to (next 7 days), upcoming sessions they haven't RSVP'd to (suggest 2-3 based on neighborhood/vibe match), their current streak count, props received this week, any community rituals posted
  - Send digest email:
    - Subject: "Your week ahead on FocusClub"
    - Body sections: "Your Sessions This Week" (list with dates/times/venues), "Recommended For You" (2-3 suggested sessions with RSVP links), "Your Stats" (streak, total sessions, props this week), a motivational closing line
- The digest should feel like a friendly weekly check-in, not a marketing blast.

### Part 6: Unsubscribe Handling

Add an unsubscribe link to the footer of every email. The link should be a deep link to the app's email preferences page. Format: `https://app.focusclub.in/me?tab=settings&section=email`.

Also create a one-click unsubscribe Edge Function endpoint that accepts a signed token (JWT containing user_id and email_type) and disables that specific email type. This satisfies email regulations (CAN-SPAM, etc).

### Important
- All Edge Functions should use the Resend API (POST to `https://api.resend.com/emails` with Authorization header)
- Error handling: if Resend fails, log the error but don't crash. Failed emails should not block user actions.
- All emails must respect the user's email_preferences — never send an email type the user has opted out of
- Keep email HTML simple and mobile-responsive. No heavy images or complex layouts.
- The `reminder_emails_sent` table needs RLS: only the system (SECURITY DEFINER functions) should write to it. Users should not be able to read or modify it.
- Use IST (Asia/Kolkata) for all time references in emails
