# Session Handoff: Exhaustive E2E + UX Tests

## Priority: TD-019 — No E2E Tests

All features are built and deployed. The platform needs **exhaustive end-to-end and UX testing** using Playwright MCP to verify every button, flow, and edge case works correctly before launch.

## What to Test

### Critical Flows (Launch Blockers)

1. **Auth Flow**
   - Google OAuth login → profile creation → onboarding
   - Logout → redirect to landing
   - Protected route access when logged out → redirect to login
   - Session persistence across page reloads

2. **Onboarding Flow**
   - Step 1: Name + avatar upload
   - Step 2: Work vibe selection (deep_focus / casual_social / balanced)
   - Step 3: Looking for + Can offer tag selection
   - Step 4: Neighborhood input (autocomplete, normalization)
   - Step 5: Interests selection
   - Skip steps → profile completion percentage updates
   - Back navigation between steps

3. **UPI Payment Flow (B1)**
   - Pricing page → select tier → PaymentModal opens
   - QR code renders with correct UPI URL + amount
   - Copy VPA button works
   - "I've made the payment" → UTR input step
   - UTR validation (min 6 chars)
   - Submit UTR → payment recorded as pending_verification
   - Success screen shows UTR + "usually verified within 30 minutes"
   - Session Boost purchase flow (₹99)

4. **Day Pass Purchase (B4)**
   - EventDetail → DayPassCard shows correct price (₹100 for ≤2hr, ₹150 for >2hr)
   - Click "Buy Day Pass" → PaymentModal with day_pass type
   - After purchase: card shows "Payment pending verification"
   - After admin verifies: card shows "Day Pass active" with access code

5. **Admin Payment Verification**
   - Admin dashboard → Payments tab → pending payments listed
   - Verify button → payment status changes to verified
   - Subscription/boost/day_pass activated correctly per type
   - Reject button → payment status changes to rejected
   - Realtime updates (new payment appears without refresh)

### Discovery & Matching

6. **Discover Page**
   - People tab: member cards load with match scores
   - Companies tab: company cards load
   - Filter by neighborhood, work vibe
   - AI Search bar (Pro+ users): type query → results with match scores
   - AI Search (Free users): falls back to text search
   - Clear search → returns to normal view
   - Click member card → navigates to profile

7. **Match Scoring**
   - Match score displays correctly (0-100)
   - Match reasons show as pills/badges
   - Same work vibe → reason appears
   - Skill overlap → "They offer X" reason appears

### Events & Sessions

8. **Home Page**
   - Upcoming events load
   - Match nudge cards show (if data exists)
   - Smart intro cards show
   - Primary action card (book/RSVP CTA)
   - Needs board card

9. **Event Detail**
   - Event info renders (title, date, time, venue, map)
   - RSVP button → status changes to "going"
   - Cancel RSVP → status reverts
   - Waitlist when full
   - DayPassCard shows for non-subscribers
   - IntentionAtRsvp → set intention text
   - Share button → copies link

10. **Session (Live)**
    - Timer display
    - Group members visible
    - Smart intro card with conversation starters
    - Session wrap-up flow:
      - "Did you get your one thing done?" (yes/partially/no)
      - Streak update + confetti on milestones
      - Give Props button → GivePropsFlow
      - Rate Session button → VenueVibeRating
    - DayPassConversionCard shows for day-pass attendees

### Profile & Settings

11. **Profile Page**
    - View own profile: all fields display
    - Edit profile: all fields editable
    - Avatar upload
    - Social links (LinkedIn, Instagram, Twitter)
    - Profile completion percentage
    - View other's profile: match score visible

12. **Settings**
    - Notification preferences toggle
    - Quiet hours setting
    - Push notification opt-in
    - Account management

### Venue System

13. **Venue Discovery**
    - Map view with venue markers
    - Venue popup → links to /venue/:id
    - Map swap toggle (Home + Discover)
    - Venue detail page loads

14. **Venue Nomination**
    - Nominate venue form
    - Vouch for venue (requires events_attended >= 1)
    - Venue health check

### Subscription & Tier Gating

15. **Pricing Page**
    - All 4 tiers display with correct prices
    - Feature comparison table
    - Upgrade button → PaymentModal
    - Session Boost option

16. **Feature Gating**
    - Free user: basic discovery, limited connections
    - Plus user: full profiles, match reasons, unlimited connections
    - Pro user: AI matching, AI search, session insights
    - Max user: all features
    - Session boost temporarily elevates tier

### Notifications

17. **Notification Bell**
    - Badge count for unread
    - Click → notification list
    - Mark as read
    - Click notification → navigates to link
    - Realtime updates (new notification appears)

### Community Features

18. **Needs Board**
    - Post a need/offer
    - View active needs
    - Respond to a need

19. **Props & Badges**
    - Give prop to group member
    - Receive prop notification
    - Badge display on profile
    - Rank progression

20. **Focus Credits**
    - Credit balance display
    - Credit earning (session attendance)
    - Credit spending

### Edge Cases & Error States

21. **Error Handling**
    - Network offline → graceful degradation
    - API errors → toast messages
    - Empty states (no events, no members, no notifications)
    - Loading skeletons display correctly
    - 404 page for invalid routes

22. **Responsive Design**
    - Mobile viewport (375px)
    - Tablet viewport (768px)
    - Desktop viewport (1024px+)
    - Bottom nav visibility on mobile
    - AppShell layout consistency

23. **Navigation**
    - Bottom nav: all 5 tabs navigate correctly
    - Back button behavior
    - Deep linking to event/venue/profile
    - Protected routes redirect correctly

## Test Infrastructure

- **Tool**: Playwright MCP (browser automation)
- **Test files**: `tests/e2e/*.spec.ts`
- **Config**: `playwright.config.ts`
- **Base URL**: `http://localhost:5173` (Vite dev server)
- **Auth**: Need test user accounts (create via Supabase auth)
- **Data**: Seed test data for events, venues, profiles

## Current Test Coverage

- 603 unit tests (Vitest) — all passing
- 0 E2E tests — **this is the gap**

## API Keys Status

| Key | Status |
|-----|--------|
| ANTHROPIC_API_KEY | Set (test key, rotate before prod) |
| VAPID keys | Not set (run `node scripts/generate-vapid-keys.mjs`) |
| RESEND_API_KEY | Not set |
| Razorpay | Not set (user will add) |
| Dodo Payments | Not set (user will add) |

## Deployed Edge Functions

| Function | Version | Cron |
|----------|---------|------|
| send-push | v2 | — |
| send-notification | v2 | — |
| match-nudges | v1 | Daily 10:00 IST |
| ai-community-manager | v2 | Daily 09:00 IST |
| smart-search | v2 | — |
| session-debrief | v2 | — |

## Architecture Notes for Test Author

- App uses `AppShell` wrapper for authenticated pages
- Auth context: `useAuth()` from `@/contexts/AuthContext`
- Subscription context: `useSubscription()` from `@/hooks/useSubscription`
- Routes defined in `src/App.tsx` (lazy-loaded)
- Supabase client at `src/integrations/supabase/client.ts`
- All neighborhoods normalized via `normalizeNeighborhood()`
- Payments table constraints: payment_type includes 'day_pass', status includes 'pending_verification'/'verified'/'rejected'
