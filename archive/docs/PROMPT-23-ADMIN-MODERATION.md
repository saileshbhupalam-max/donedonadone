# Prompt 23: Admin Moderation & Content Safety

## Context
The admin dashboard has a FlagsTab that displays member flags with escalation detection (2+ unique flaggers across 2+ sessions get a red border + "Escalated" badge). But there are NO action buttons — admins can see problems but can't DO anything about them. We need the complete moderation workflow.

The `member_flags` table exists with columns: flagged_user, flagged_by, session_id, reason, notes. The `profiles` table exists but has no suspension-related columns. The `notifications` table exists with a `create_system_notification` RPC function.

## What to Build

### Part 1: Flag Resolution Actions

In the FlagsTab component (`src/components/admin/FlagsTab.tsx`), add action buttons for each flagged user's flag group:

**Three action buttons per flagged user:**

1. **Dismiss** — Mark all flags for this user as reviewed/dismissed. Add a `resolved_at` timestamp and `resolution` text column to `member_flags`. Set resolution to "dismissed". The flag group disappears from the active view but remains in database for audit.

2. **Warn** — Send a warning notification to the flagged user via the existing `create_system_notification` RPC. The notification title should be "Community Guidelines Reminder" with a body that's professional but firm: "We've received feedback about your behavior in sessions. Please review our community guidelines." Set resolution to "warned" on the flags. Show a toast confirming the warning was sent.

3. **Suspend** — Suspend the user for a configurable duration (1 week, 2 weeks, 1 month, permanent). This requires new columns on `profiles`: `suspended_until` (timestamptz, nullable) and `suspension_reason` (text, nullable). When suspended, send a notification to the user explaining the suspension duration. Set resolution to "suspended" on the flags.

**Add a "Resolved" tab** in FlagsTab that shows previously resolved flags with their resolution type and timestamp, so admins have an audit trail.

### Part 2: Suspension Enforcement

Add suspension checking to the app's auth flow. In the ProtectedRoute or layout component that wraps authenticated pages, after loading the user's profile, check if `suspended_until` is set and is in the future. If so, show a full-screen suspension notice instead of the app content. The notice should show:
- "Your account is temporarily suspended"
- The suspension end date (formatted nicely)
- The reason (if provided)
- A "Contact Support" link (mailto to a support email)
- If the suspension is permanent, say "Your account has been suspended" without an end date

When `suspended_until` is in the past, the user can access the app normally (the suspension has expired). Clear the `suspended_until` and `suspension_reason` fields when the admin manually lifts a suspension via a new "Lift Suspension" button that appears on suspended users in the Members tab.

### Part 3: Auto-Escalation Rules

Add a database trigger or RPC that runs when a new flag is inserted. The logic:

- Count distinct `flagged_by` users for this `flagged_user` across all unresolved flags
- Count distinct `session_id` values for this `flagged_user` across all unresolved flags
- If 3+ unique flaggers OR flags span 3+ different sessions: auto-suspend the user for 1 week and create a notification: "Your account has been temporarily suspended pending review due to multiple community reports."
- If 2+ unique flaggers across 2+ sessions (the current escalation threshold): create an admin notification (to all admin users) saying "⚠️ Escalated flag: [user display_name] has been flagged by [count] members across [count] sessions"

This should be a SECURITY DEFINER function so it can modify profiles and create notifications regardless of RLS.

### Part 4: Members Tab Suspension Indicator

In the Admin Members tab, show a visual indicator on suspended users:
- A red "Suspended" badge next to their name
- The suspension end date
- A "Lift Suspension" button that clears `suspended_until` and `suspension_reason` and sends a notification: "Your account suspension has been lifted. Welcome back!"

### Database Changes Needed

1. Add to `member_flags`: `resolved_at` (timestamptz), `resolution` (text — "dismissed", "warned", "suspended")
2. Add to `profiles`: `suspended_until` (timestamptz), `suspension_reason` (text)
3. Create the auto-escalation trigger function
4. RLS: Only admins can update `resolved_at` and `resolution` on member_flags. Only admins can update `suspended_until` and `suspension_reason` on profiles.

### Important
- Do NOT change any existing flag display logic — the escalation badges and grouping work correctly
- The `create_system_notification` RPC already exists — use it for all notifications
- Keep the UI consistent with the existing admin dashboard style (shadcn cards, small text, muted colors)
- All suspension checks should work with timezone-aware timestamps
