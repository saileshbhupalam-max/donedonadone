# FocusClub — Production Readiness Plan

**Goal:** Production-ready for 1000-2000 concurrent users with comprehensive testing.
**Current state:** 60% complete. UI/UX solid, core flows work, security locked down.
**Missing:** Geolocation, payments, email, performance, testing, CI/CD.

---

## Phase 1: Geolocation Check-In (Day 1)

**Why first:** Core trust mechanism. Without it, anyone can "attend" remotely.

### Tasks:
1. Add `latitude`/`longitude` columns to `venue_partners` and `events` tables (migration)
2. Build `useGeolocation` hook — GPS permissions, error handling, fallbacks
3. Build `checkInWithLocation(userCoords, venueCoords)` — Haversine distance check (200m radius)
4. Replace "Start Session" button with geolocation-verified check-in in Session.tsx
5. Add venue coordinate entry in admin PartnersTab
6. Fallback: manual check-in code (4-digit PIN displayed at venue) for GPS-denied users

### Tests:
- Unit: Haversine calculation accuracy (known coordinates → known distance)
- Unit: Hook state machine (loading → success/error/denied/unavailable)
- Integration: Check-in flow with mocked coordinates (inside/outside radius)
- Edge: GPS denied, GPS timeout, GPS unavailable, location spoofing guard

---

## Phase 2: Performance & Code Splitting (Day 1-2)

**Why second:** 1.76MB bundle kills mobile UX. Must fix before real users hit it.

### Tasks:
1. React.lazy() for all 13 page routes in App.tsx + Suspense boundaries
2. Dynamic import for heavy libs: html2canvas, recharts, qrcode.react
3. Vite manual chunks: vendor (react, supabase), ui (radix, shadcn), charts (recharts)
4. Image optimization: lazy loading, WebP where possible, avatar size constraints
5. Add gzip/brotli compression config
6. Measure: Lighthouse mobile score before/after

### Tests:
- Smoke: Every route loads correctly after code splitting
- Performance: Bundle size < 300KB initial JS (gzipped)
- Performance: First Contentful Paint < 2s on 3G throttle
- Integration: Lazy-loaded routes render correctly after navigation

---

## Phase 3: Email Notifications via Resend (Day 2)

**Why:** Users won't check the app daily. Need email for session reminders, confirmations, waitlist promotions.

### Tasks:
1. Set up Resend account + API key
2. Create Supabase Edge Functions for email triggers:
   - `send-rsvp-confirmation` — on RSVP
   - `send-session-reminder` — 24h and 1h before session
   - `send-waitlist-promoted` — when spot opens
   - `send-weekly-digest` — weekly summary of upcoming sessions
3. Create email templates (React Email or HTML) with FocusClub branding
4. Wire DB triggers or cron to fire edge functions
5. Add email preferences to profile (opt-out)

### Tests:
- Unit: Email template rendering with test data
- Integration: Edge function receives webhook, sends email, returns 200
- Integration: Unsubscribe link works
- E2E: RSVP → confirmation email arrives

---

## Phase 4: Payment Integration — Razorpay (Day 3-4)

**Why:** Revenue. Platform fee ₹100 (2hr) / ₹150 (4hr).

### Tasks:
1. Razorpay account setup + API keys
2. Create Supabase Edge Function: `create-payment-order`
3. Create Supabase Edge Function: `verify-payment-webhook`
4. Add `payments` table (user_id, event_id, razorpay_order_id, amount, status, created_at)
5. Build payment flow in EventDetail.tsx: RSVP → Razorpay checkout → confirm
6. Handle: payment success, failure, pending, refund on cancellation
7. Admin: payment dashboard showing collections, pending, refunds
8. Partner: earnings view based on revenue_share_pct

### Tests:
- Unit: Payment amount calculation (platform fee + GST)
- Integration: Razorpay test mode — create order, mock payment, verify webhook
- Integration: Refund flow on RSVP cancellation
- Integration: Webhook idempotency (same webhook twice doesn't double-credit)
- E2E: Full RSVP → pay → confirm → cancel → refund flow
- Security: Webhook signature verification, amount tampering prevention

---

## Phase 5: Error Monitoring & Observability (Day 4)

**Why:** Can't run production blind. Need to see errors, performance, usage.

### Tasks:
1. Sentry SDK integration — error tracking with source maps
2. Sentry performance monitoring — transaction tracing
3. Custom Sentry contexts: user_id, user_type, session_id, event_id
4. Add `sentry.io` DSN to environment
5. Upload source maps on build
6. Set up Sentry alerts: error spike, slow transactions, new issues

### Tests:
- Smoke: Intentional error → appears in Sentry dashboard
- Integration: Source maps resolve to correct file/line
- Integration: User context attached to error reports

---

## Phase 6: Comprehensive Test Suite (Day 4-5)

**Why:** Confidence. Every critical path tested.

### Test Categories:

#### Unit Tests (Vitest)
- `lib/antifragile.ts` — createSmartGroups, updateReliability, promoteWaitlist
- `lib/growth.ts` — checkMilestones, trackAnalyticsEvent, checkReEngagement
- `lib/personality.ts` — getContextualGreeting, getLoadingMessage, all exports
- `lib/config.ts` — platformFee, priceWithGST, getTrustTier
- Geolocation distance calculations
- Payment amount calculations

#### Integration Tests (Vitest + Testing Library)
- Auth flow: sign in → profile created → redirected to onboarding
- Onboarding: complete 6 steps → profile saved → redirected to home
- RSVP flow: browse → RSVP → confirmation → cancel → waitlist promotion
- Session flow: check-in → phases → feedback → props
- Admin: create event → create groups → view analytics
- Personality: context loads from DB, falls back to static

#### E2E Tests (Playwright)
- Full user journey: sign up → onboard → RSVP → attend → feedback
- Admin journey: login → create event → assign groups → view dashboard
- Payment flow: RSVP → pay → confirm (Razorpay test mode)
- Mobile viewport: entire flow on 375px width
- Error scenarios: network offline, session full, already RSVP'd

#### Stress Tests
- Supabase connection pool: 100 concurrent reads
- RSVP race condition: 10 users RSVP last spot simultaneously
- Waitlist promotion: rapid cancellation + promotion cycle
- Realtime subscriptions: 50 users on same session page
- Analytics insert throughput: 1000 events/minute

#### Smoke Tests (CI)
- Build succeeds
- TypeScript zero errors
- All routes render without crash
- Auth redirect works
- Supabase connection healthy

---

## Phase 7: CI/CD & Deployment (Day 5)

### Tasks:
1. GitHub Actions workflow: lint → typecheck → test → build → deploy
2. Vercel project setup (or Netlify) with preview deploys on PR
3. Environment variables in deployment platform
4. Supabase migration runner in CI
5. Branch protection: main requires passing CI
6. Deploy preview URLs for testing before merge

### Tests:
- CI pipeline runs end-to-end on push
- Preview deploy works on PR
- Production deploy succeeds on merge to main

---

## Phase 8: Scale Readiness (Day 5-6)

### Tasks:
1. Supabase connection pooling (PgBouncer) — configure for 1000+ connections
2. Add database indexes for common query patterns (most already done in 14A)
3. Rate limiting on API calls (Supabase built-in or Edge Function middleware)
4. CDN for static assets (Vercel/Netlify handles this)
5. Realtime connection limits — verify Supabase plan supports 2000 concurrent
6. Image/avatar storage optimization — resize on upload, serve via CDN
7. Query optimization — check for N+1 patterns, add .select() limits

### Tests:
- Load test: k6 or artillery — 1000 concurrent users browsing + RSVPing
- Database: EXPLAIN ANALYZE on top 10 queries
- Realtime: 200 simultaneous WebSocket connections to same channel
- Memory: No memory leaks after 1000 page navigations

---

## Execution Order

| Day | Phase | Deliverable |
|-----|-------|-------------|
| 1 | Phase 1 + 2 | Geolocation check-in + code splitting |
| 2 | Phase 3 | Email notifications |
| 3-4 | Phase 4 | Razorpay payments |
| 4 | Phase 5 | Sentry monitoring |
| 4-5 | Phase 6 | Full test suite |
| 5 | Phase 7 | CI/CD pipeline |
| 5-6 | Phase 8 | Scale testing + optimization |

**Total: ~6 days of focused work.**

---

## Success Criteria

- [ ] Every page loads in < 2s on 3G
- [ ] Bundle < 300KB gzipped initial load
- [ ] Geolocation check-in works within 200m of venue
- [ ] Payments process correctly with Razorpay test mode
- [ ] Email confirmations arrive within 60s of RSVP
- [ ] 1000 concurrent users: < 500ms p95 response time
- [ ] Zero TypeScript errors
- [ ] > 80% code coverage on critical paths
- [ ] All E2E tests pass on mobile viewport
- [ ] Sentry captures errors with full context
- [ ] CI pipeline: push → test → deploy < 10 minutes
