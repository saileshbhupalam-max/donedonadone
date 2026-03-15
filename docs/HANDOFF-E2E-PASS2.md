# Session Handoff: E2E Testing Pass 2

## What Was Done (Pass 1)

Ran Playwright MCP E2E tests against `localhost:5173` using a test user (`e2e-test@danadone.club` / `TestPass123!`, user ID `90a2ba66-3855-4b2c-a6b7-589f491ae400`).

### Tests Passed (18)
1. Landing page — all sections render, 0 errors
2. Protected route `/home` redirects to `/` when unauthenticated
3. Protected route `/discover` redirects to `/`
4. Protected route `/pricing` redirects to `/`
5. 404 page — shows custom "Lost" page with witty message
6. Email sign-in form — expands correctly with email input + "Send link"
7. Onboarding Step 1 — name + avatar initials
8. Onboarding Step 2 — work vibe (3 options) + neighborhood autocomplete + gender
9. Onboarding Step 3 — "looking for" / "can offer" tag picker with suggestions
10. Onboarding Step 4 — profile preview with all data, "Find first session" / "Explore" buttons
11. Home page — welcome toast, newcomer badge, event card, FC display, gamification cards, leaderboard, Work DNA, Quick Questions, profile completion
12. Discover page — People/Companies tabs, search bar, List/Map toggle, mentoring, connections sections
13. Sessions page — filters (neighborhood, format), Upcoming/Past tabs, empty state + session request CTA
14. Map page — 40 venue markers on Leaflet map, venue popup with "View venue" link
15. Venue detail — name, location, type/status badges, QR code, "Contribute data" CTA
16. Profile page — Profile/Journey/Settings tabs, stats, share card (Share/WhatsApp/Copy/Download)
17. Pricing page — 4 tiers (Explorer free, Plus 199, Pro 499, Max 1499), Session Boost 99, FAQ
18. Payment modal — QR code renders, UPI ID copy, UTR input with validation, Confirm button enables at 6+ chars

### Bugs Fixed
1. **manifest.webmanifest missing** — `public/manifest.webmanifest` created (was only in `dist/`)
2. **RSVP crash** — SmartIntroCard called with `eventId` but expects `currentUser`/`groupMembers`. Added guard: returns null when props are missing.

### Known Remaining Bugs
1. **`update_reliability` RPC missing** — 404 when RSVP fires. Need to create this Supabase RPC function. Non-blocking (error boundary caught it after the SmartIntroCard crash was the primary cause).
2. **Leaderboard slug display** — Home page shows "hsr-layout Leaderboard" instead of "HSR Layout Leaderboard". The heading uses the raw normalized slug. Fix: un-slugify for display (replace hyphens, title case).

## What To Test Next (Pass 2)

### Critical (test these first)
- [ ] **RSVP flow end-to-end** — verify the SmartIntroCard fix works, page stays stable after RSVP
- [ ] **Cancel RSVP** — click again to un-RSVP, verify status reverts
- [ ] **Event detail** — IntentionAtRsvp (set intention text after RSVP)
- [ ] **Notification bell** — click bell icon, verify notification list/empty state, badge count
- [ ] **Session Boost purchase** — pricing page "Get Session Boost" button → payment modal with ₹99

### Important
- [ ] **Settings page** — Profile tab > Settings tab, notification toggles, quiet hours
- [ ] **Admin dashboard** — navigate to `/admin`, verify PendingPayments tab loads, test verify/reject buttons
- [ ] **Needs board** — `/needs`, post a need/offer, view list
- [ ] **Credits page** — `/credits`, verify balance display
- [ ] **Companies tab** on Discover — switch to Companies tab, verify cards load
- [ ] **Other member profile** — click on "sailesh bhupalam" from Going list → `/profile/:id`
- [ ] **Share button** on event detail — verify copy link works

### Nice to Have
- [ ] **Responsive viewports** — test at 375px (mobile), 768px (tablet), 1024px (desktop)
- [ ] **Session persistence** — reload page while logged in, verify session maintained
- [ ] **Logout flow** — find logout button, verify redirect to landing
- [ ] **Deep linking** — directly navigate to `/events/:id`, `/venue/:id`, `/profile/:id`
- [ ] **Map List toggle** — switch to List view on Map page, verify venue list renders
- [ ] **Discover AI search** — type query in search bar, verify results (Pro+ gets AI, Free gets text fallback)
- [ ] **Quick Questions** — answer a question on Home, verify FC award
- [ ] **Work DNA** — click "Complete your DNA", verify TasteGraphBuilder page

## Test User

- **Email**: `e2e-test@danadone.club`
- **Password**: `TestPass123!`
- **User ID**: `90a2ba66-3855-4b2c-a6b7-589f491ae400`
- **Profile**: display_name "E2E Test User", balanced vibe, hsr-layout, looking_for: [coding help, accountability], can_offer: [code reviews]
- **Tier**: Free (Explorer)
- **Login method**: `signInWithPassword` via browser evaluate (see below)

### How to sign in for testing
```js
// In Playwright browser_evaluate:
const mod = await import('/src/integrations/supabase/client.ts');
const { data, error } = await mod.supabase.auth.signInWithPassword({
  email: 'e2e-test@danadone.club',
  password: 'TestPass123!'
});
```

## Still Pending (Non-E2E)

- **ANTHROPIC_API_KEY**: Stored in vault but Edge Functions need `supabase secrets set` CLI command
- **VAPID keys**: Run `node scripts/generate-vapid-keys.mjs` and set as Supabase secrets
- **RESEND_API_KEY**: User will add later
- **Razorpay + Dodo Payments**: User will add later
- **update_reliability RPC**: Create in Supabase (called on RSVP)
- **Leaderboard slug display fix**: Replace hyphens + title case in Home.tsx leaderboard heading
