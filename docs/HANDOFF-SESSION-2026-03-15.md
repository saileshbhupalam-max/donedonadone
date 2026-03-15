# Session Handoff — 2026-03-15 Evening

## What Was Done

### Bug Fixes (4)
1. **Discover search fallback** — client-side text search when Edge Function unavailable (`Discover.tsx`)
2. **profile_views 409** — `ignoreDuplicates: true` on upsert (`ProfileView.tsx`)
3. **Needs Board "All Needs" hides own posts** — removed own-post filter (`Needs.tsx`)
4. **Admin app_settings 406** — `.maybeSingle()` instead of `.single()` (`useAdminCheck.ts`)

### Infrastructure Deployed
- VAPID keys generated and set as Supabase secrets (via dashboard)
- ANTHROPIC_API_KEY confirmed in vault
- `admin_emails` seeded in `app_settings` table
- Cron schedules applied (11 jobs) aligned to session rhythm
- Duplicate crons removed (`ai-community-manager-daily`, `match-nudges-daily`)
- `default_session_windows` seeded in app_settings (Morning Focus, Afternoon Hustle)
- All 12 Edge Functions confirmed ACTIVE
- `auto-sessions` v3 deployed with proximity clubbing

### Session Rhythm System
- **SessionRequestSheet** — default windows: Morning Focus (9:30-1:30), Afternoon Hustle (2-6), Evening (6-9) with descriptions
- **NearbySessionNudge** — Home card showing nearby sessions with preference-flexible messaging
- **`find_proximity_clusters` RPC** — groups checked-in available users by venue, returns clusters >= 3
- **auto-sessions Edge Function v3** — two jobs:
  1. Demand clustering (from session_requests, original)
  2. Proximity clubbing (from check-ins) with 2.5x overbooking notifications

### Cron Schedule (All IST)
| Job | Time | Purpose |
|-----|------|---------|
| session-reminders-morning | 8:00 AM | 90 min before morning slot |
| ai-community-manager | 8:00 AM | Morning health check |
| auto-sessions | 7:30 AM / 12:30 PM / 7:30 PM | Before each window + evening sweep |
| match-nudges | 8:30 AM | Daily match suggestions |
| send-streak-warnings | 9:00 AM | Motivation nudge |
| session-reminders-afternoon | 1:00 PM | Before afternoon slot |
| session-reminders-evening | 8:00 PM | Tomorrow preview |
| compute-weekly-digest | Mon 8:00 AM | Weekly stats |

### Docs Updated
- `HANDOFF.md` — complete rewrite, all tracks status
- `TECH-DEBT.md` — TD-001, TD-003, TD-019 updated
- `HANDOFF-E2E-PASS3.md` — all bugs marked fixed

---

## What Needs Doing Next

### 1. VITE_VAPID_PUBLIC_KEY in Vercel
Add to Vercel dashboard > Settings > Environment Variables:
`VITE_VAPID_PUBLIC_KEY=BFhMIfiAE_s9mRv-NkdeXEPCmtYMQq0nz2fLG39NtWIQwQxPOkGUj5O_Wo-SBGfJDVij1gfbVRpxc1mdO9eXcko`
Then redeploy.

### 2. VIP Attendance Alerts (Max Tier Feature)
Design spec below — needs implementation.

### 3. Safety Block List
Design spec below — needs implementation.

### 4. Razorpay Webhook
Edge Function for auto-verifying payments (manual UTR works now).

### 5. Adaptive Overbook Multiplier
Track response rates in `notification_log` metadata, adjust `OVERBOOK_MULTIPLIER` per neighborhood/time.

---

## Design Spec: VIP Attendance Alerts

**Feature:** Max-tier members can follow specific people and get notified when they RSVP to a session.

### Data Model
```sql
CREATE TABLE public.member_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  followed_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, followed_id)
);
-- RLS: follower can CRUD own rows. Followed user CANNOT see who follows them.
-- This is critical: following is private. No "X is following you" notification.
```

### Abuse Prevention
- **Tier-gated:** Only Max tier (highest paid) can follow. This limits the pool to paying customers with skin in the game.
- **Follow cap:** Max 20 follows per user. Prevents mass-following.
- **No visibility to followed user:** The followed person never knows who follows them. This prevents social pressure or gaming ("follow me back").
- **Notification is passive:** "Someone you follow is going to X" — doesn't name-drop unless the follower clicks through. Prevents stalking behavior.
- **Rate limit on follow changes:** Max 5 follow/unfollow actions per day. Prevents churn-following to game notifications.
- **No follow list export:** API only returns follow status per user, not a bulk list. Prevents scraping.

### Notification Flow
1. User RSVPs to an event
2. Trigger (DB or Edge Function) checks `member_follows` for followers
3. For each follower: send notification "Someone you follow just joined [Session Name]"
4. Follower taps notification → event detail page

### UI
- Profile page: "Follow" button (Max tier badge next to it, grayed out for lower tiers)
- Settings: "People you follow" list with unfollow
- Notification type: `follow_rsvp` in notification_preferences channels

---

## Design Spec: Safety Block List

**Feature:** Any user can block another user. If a blocked person RSVPs to a session the blocker is attending, the blocker gets a private alert so they can decide whether to stay or leave. Critically: the blocked person is NEVER told they're blocked.

### Design Principles
1. **Privacy first:** Blocking is completely invisible to the blocked person. No behavioral change for them — they can still RSVP, see the session, etc. The only effect is the blocker gets a heads-up.
2. **Not a weapon:** Blocking doesn't remove anyone from sessions or change their experience. It's purely a notification mechanism for the blocker's comfort.
3. **No gaming:** Since blocking doesn't affect the blocked person's access, there's no incentive to mass-block competitors or game the system.
4. **Bidirectional awareness:** If A blocks B AND B blocks A, both get alerts independently. They don't know about each other's blocks.

### Data Model
```sql
CREATE TABLE public.member_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reason TEXT, -- optional, for admin review if disputes arise
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
-- RLS: blocker can CRUD own rows. Blocked user has NO access.
-- Admin can read all (for dispute resolution).
```

### Abuse Prevention
- **Block cap:** Max 25 blocks per user. If someone blocks 25 people, that's a signal to review their behavior, not give them more blocks.
- **No impact on blocked user:** Blocked person's experience is unchanged — same sessions, same visibility, same matching. This eliminates weaponization.
- **Admin visibility:** Admins can see block patterns. If one person is blocked by 5+ different people, that's a flag for investigation (not automatic action).
- **Reason field is optional but logged:** Helps admins understand patterns without requiring users to justify their comfort.
- **No mutual block inference:** Even if A blocks B, B's UI shows zero indication. A's matching/nudge scores for B are suppressed (B won't appear in A's match nudges), but B still sees A normally.

### Notification Flow
1. User A (blocker) RSVPs to event X
2. Later, user B (blocked) RSVPs to event X
3. Trigger checks: does anyone attending event X have B in their block list?
4. If yes: send private notification to A: "Heads up: someone you've flagged just RSVP'd to [Session Name]. You can update your RSVP if needed."
5. The notification does NOT name the blocked person directly — it says "someone you've flagged". Tapping shows the attendee list where A can see for themselves.
6. **Reverse check too:** If A RSVPs to event X where B is already going, A gets the alert immediately upon RSVPing.

### Matching Suppression
- Blocked users are excluded from the blocker's:
  - Match nudges (MatchNudgeCard)
  - WhosHere suggestions
  - Smart search results
  - Auto-session grouping (if both are in the same demand cluster, try to split them into different groups)
- NOT excluded from: event attendee lists, Discover people tab, public profiles

### UI
- Profile page: "..." menu > "Block this person" (no confirmation dialog — make it easy to act on gut feeling)
- Settings: "Blocked members" list with unblock
- Toast on block: "Got it. You'll be notified if they RSVP to your sessions."
- Notification type: `block_alert` in notification_preferences channels (enabled by default, can't be disabled — safety feature)

### Why This Design Works
- **Not punitive:** Blocking doesn't punish the blocked person. It empowers the blocker with information.
- **Can't be gamed:** Since blocking has no effect on the blocked person, there's no incentive to mass-block.
- **Scales with community:** As the community grows, people will inevitably have interpersonal friction. This gives them a private, non-confrontational tool.
- **Admin escalation path:** If block patterns emerge (one person blocked by many), admins can investigate. But the system doesn't auto-act — it just surfaces signals.
- **Compatible with women-only sessions:** Women-only sessions already use RLS. Blocks add a personal safety layer on top.

---

## Git State
- Branch: `main`
- Latest commit: `b0b61de` — feat: proximity clubbing with overbooking notifications
- Both remotes in sync
