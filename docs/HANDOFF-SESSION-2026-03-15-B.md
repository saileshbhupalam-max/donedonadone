# Session Handoff — 2026-03-15 Evening (Part B)

## What Was Built

### 1. VIP Attendance Alerts (Max Tier Feature)

**Database:** `member_follows` table with RLS (follower-only access)

**Business logic:** `src/lib/memberFollows.ts`
- `followUser()` — tier check, 20-follow cap, 5/day rate limit (client-side)
- `unfollowUser()` — with same rate limit
- `isFollowing()` / `getFollowedUsers()` / `getFollowCount()`

**UI:**
- `src/components/profile/FollowButton.tsx` — Only renders for Max tier. Shows Eye icon + Crown badge. Toggle follow/unfollow.
- `src/components/settings/FollowedPeopleCard.tsx` — Settings page list with avatar, name, unfollow action. Shows "X/20 follows used".

**RSVP trigger:** `notify_rsvp_followers_and_blockers` RPC called fire-and-forget from `EventDetail.tsx` after RSVP. Notifies followers: "Someone you follow just joined a session".

**Notification category:** `follow_rsvp` added to notification settings toggles.

---

### 2. Safety Block List (All Users)

**Database:** `member_blocks` table with RLS (blocker-only + admin read)

**Two block modes:**
1. **Safety block** — structured reasons (uncomfortable, inappropriate, harassment, spam) + free-text details. Counts toward escalation.
2. **Personal preference** — just avoidance, no consequences. Reason prefixed with `[personal]` in DB. Does NOT count toward escalation.

**Auto-escalation trigger** (`check_block_escalation`):
- 3+ unique **safety** blockers → auto-creates `member_flags` entry for admin review + admin notification
- 5+ unique **safety** blockers → sets `profiles.is_suspended = true` + admin notification with all reasons
- Personal preference blocks are completely ignored by the trigger

**Business logic:** `src/lib/memberBlocks.ts`
- `blockUser()` — 25-block cap
- `unblockUser()` / `isBlocked()` / `getBlockedUsers()` / `getBlockedUserIds()`

**UI:** `src/components/profile/BlockButton.tsx`
- Step 1: Choose "Safety concern" or "Personal preference" with clear descriptions
- Safety path: select reason → optional free-text detail → "Block & Report"
- Personal path: optional notes → "Block" (messaging: "won't affect their account")
- Both: blocker gets RSVP alerts, person excluded from match nudges

**Match suppression:** `src/lib/matchNudges.ts` now calls `getBlockedUserIds()` and filters them out.

**Settings:** `src/components/settings/BlockedPeopleCard.tsx` — list with unblock, "X/25 blocks used"

---

### 3. Venue Availability Dashboard

**Database:**
- `venue_slots` — day_of_week, start/end time, max_cowork_seats, price_member_paise, price_outsider_paise, platform_fee_paise, auto_approve
- `venue_slot_blackouts` — per-slot date exclusions with reason
- RLS: authenticated can read active slots; partners can manage own venue's slots

**RPC:** `find_available_venue_slots(p_neighborhood, p_date, p_time_slot)` — returns available slots with current booking counts. Used by auto-sessions to check capacity before creating events.

**UI:** `src/components/partner/ScheduleBuilder.tsx`
- Weekly day selector with dot indicators for configured days
- Per-slot: time range, seats, member price, outsider price, active toggle, delete
- Quick-add buttons: Morning Focus (9:30-13:30), Afternoon Hustle (14-18), Evening (18-21)
- Blackout date manager with date picker and reason field

**Integration:** Added to `PartnerDashboard.tsx` between stats and QR section.

---

## Files Created (16 new)
| File | Purpose |
|------|---------|
| `src/lib/memberFollows.ts` | Follow/unfollow logic with caps and rate limits |
| `src/lib/memberBlocks.ts` | Block/unblock logic with caps |
| `src/components/profile/FollowButton.tsx` | Max-tier follow toggle on profiles |
| `src/components/profile/BlockButton.tsx` | Two-mode block dialog (safety vs personal) |
| `src/components/settings/FollowedPeopleCard.tsx` | Settings: manage follows |
| `src/components/settings/BlockedPeopleCard.tsx` | Settings: manage blocks |
| `src/components/partner/ScheduleBuilder.tsx` | Partner weekly schedule + blackouts |
| `supabase/migrations/20260315_member_follows_and_blocks.sql` | Tables + RLS + RSVP RPC |
| `supabase/migrations/20260315_block_auto_escalation.sql` | Escalation trigger |
| `supabase/migrations/20260315_venue_availability_slots.sql` | Slots + blackouts + availability RPC |

## Files Modified (6)
| File | Change |
|------|--------|
| `src/pages/ProfileView.tsx` | Added FollowButton + BlockButton to profile actions |
| `src/pages/Settings/index.tsx` | Added FollowedPeopleCard + BlockedPeopleCard sections |
| `src/pages/Settings/NotificationSettingsCard.tsx` | Added follow_rsvp category toggle |
| `src/pages/EventDetail.tsx` | Call `notify_rsvp_followers_and_blockers` after RSVP |
| `src/lib/matchNudges.ts` | Filter blocked users from nudge generation |
| `src/pages/PartnerDashboard.tsx` | Added ScheduleBuilder component |

---

## What Needs Doing Next

### 1. Wire auto-sessions to venue_slots
The `find_available_venue_slots` RPC is deployed but `auto-sessions/index.ts` doesn't call it yet. The demand clustering code (Part 1) should query available slots before picking a venue. Change needed in `supabase/functions/auto-sessions/index.ts`:
- After finding a demand cluster, call `find_available_venue_slots(neighborhood, date, time_slot)`
- Pick the venue with the most available seats
- If no venues have capacity, skip or waitlist

### 2. Platform fee display on EventDetail
When an event is at a venue with pricing (`venue_slots.price_member_paise > 0`), show the breakdown on EventDetail: "Venue: ₹X + DanaDone: ₹Y = Total: ₹Z".

### 3. Venue approval flow for large groups
When `auto_approve = false` or group > `auto_approve_max`, the system should notify the venue partner and wait for approval before confirming the session. Currently auto_approve data is stored but not enforced.

### 4. Admin block pattern dashboard
The `member_flags` auto-escalation creates flags, but the Admin FlagsTab should surface block-specific patterns (e.g., "User X blocked by 4 people — reasons: harassment (2), uncomfortable (2)").

### 5. Suspended user handling
`profiles.is_suspended` column exists but the frontend doesn't check it. ProtectedRoute should check `is_suspended` and show a "Your account has been suspended" page instead of the app.

---

## Architectural Decisions Made

1. **Two-mode blocking** — Safety blocks escalate, personal preference blocks don't. This prevents weaponization while still protecting users. The `[personal]` prefix in the reason field is the discriminator.

2. **Client-side rate limiting for follows** — Server-side would be more secure but the follow feature is tier-gated (Max only) and capped at 20. The client rate limit (5/day) prevents UI abuse. Worth hardening later if needed.

3. **Fire-and-forget RSVP notifications** — The `notify_rsvp_followers_and_blockers` RPC is called with `.catch(() => {})` after RSVP. If it fails, the RSVP still succeeds. Notifications are best-effort.

4. **Venue slots are per-day-of-week, not per-date** — Partners set a weekly template, not individual dates. Blackouts handle exceptions. This minimizes partner workload.

---

## Git State
- Branch: `main`
- Latest commit: `2d36469` — feat: VIP attendance alerts, safety block list, venue availability dashboard
- All migrations applied to production Supabase (cdybdawcyptgqmjlmrpx)
