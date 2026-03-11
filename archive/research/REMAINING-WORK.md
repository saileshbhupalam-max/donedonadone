# FocusClub — Remaining Work for Production Readiness

**Last updated:** 2026-03-10
**Current state:** Core UI complete, session flow works, 410+ tests pass, PWA configured, geolocation check-in built. No payments, no email, no CI/CD, no E2E tests.

---

## 1. Production Infrastructure

### 1.1 Email Notifications (Resend)

| Attribute | Detail |
|-----------|--------|
| **What exists** | Nothing. No Resend SDK, no edge functions, no email templates. The only email-adjacent code is Sentry's `beforeSend` which strips tokens from breadcrumbs. |
| **What's needed** | Full email notification system: Resend account + API key, Supabase Edge Functions for triggers, HTML/React Email templates with FocusClub branding, DB triggers or cron jobs to fire functions, email preference opt-out on profile. |
| **Priority** | **P0 — Launch blocker.** Users won't check the app daily. Without email, RSVPs drop off and sessions go under-attended. |
| **Complexity** | **Large.** 4 distinct email types, each with its own trigger mechanism. |

**Specific emails to build:**

| Email | Trigger | Notes |
|-------|---------|-------|
| RSVP confirmation | On RSVP insert to `event_rsvps` | Include session details, calendar link, cancellation link |
| Session reminder (24h + 1h) | Cron/scheduled function | Query upcoming RSVPs, send at T-24h and T-1h |
| Waitlist promotion | On `session_waitlist` status change | "A spot opened up!" — time-sensitive, needs quick delivery |
| Weekly digest | Weekly cron (Sunday evening) | Summary of upcoming sessions, streak status, community stats |

**Implementation steps:**
1. Create `supabase/functions/` directory with edge function scaffolding
2. Install Resend SDK (`resend` npm package for edge functions)
3. Create email templates (RSVP, reminder, waitlist, digest)
4. Wire DB triggers (for RSVP/waitlist) and pg_cron (for reminders/digest)
5. Add `email_preferences` column to profiles or separate table
6. Add unsubscribe endpoint

---

### 1.2 Payment Integration (Razorpay)

| Attribute | Detail |
|-----------|--------|
| **What exists** | Nothing. No Razorpay SDK, no payment table, no payment UI. The pricing model is defined in the product spec (platform fee Rs 100 for 2hr / Rs 150 for 4hr) but zero code implements it. The `events` table has no price columns. |
| **What's needed** | Full payment flow: Razorpay account + API keys, payments table in DB, create-order edge function, verify-webhook edge function, checkout UI in EventDetail, refund logic on cancellation, admin payment dashboard, partner earnings view. |
| **Priority** | **P0 — Launch blocker.** No payments = no revenue = no business. |
| **Complexity** | **Large.** Touches DB schema, edge functions, frontend UI, admin dashboard, and partner dashboard. Razorpay test mode first, then production credentials. |

**Implementation steps:**
1. Add `payments` table: `id, user_id, event_id, razorpay_order_id, razorpay_payment_id, amount, platform_fee, venue_share, gst, status (pending/captured/refunded/failed), created_at`
2. Add price columns to `events`: `platform_fee, venue_price, total_price`
3. Create edge function: `create-payment-order` (calls Razorpay Orders API)
4. Create edge function: `verify-payment-webhook` (validates signature, updates payment status, confirms RSVP)
5. Build checkout flow in EventDetail.tsx: RSVP button -> Razorpay popup -> success/failure handling
6. Build refund flow: cancellation within policy -> auto-refund via Razorpay API
7. Admin tab: payment collections, pending, refunds, revenue breakdown
8. Partner tab: earnings based on `revenue_share_pct`, payout tracking

---

### 1.3 Error Monitoring (Sentry) — Partially Done

| Attribute | Detail |
|-----------|--------|
| **What exists** | `src/lib/sentry.ts` with full initialization: browser tracing, session replay (10% normal / 100% on error), token stripping from breadcrumbs, `setSentryUser()` and `clearSentryUser()` helpers. @sentry/react is in dependencies. |
| **What's needed** | DSN environment variable (`VITE_SENTRY_DSN`), source map upload on build, Sentry project/org setup, alert rules (error spike, slow transactions, new issues), custom contexts (event_id, session phase), verification that `initSentry()` is called in main.tsx. |
| **Priority** | **P1 — Needed before real traffic.** App works without it but you're flying blind. |
| **Complexity** | **Small.** Most code exists. Mainly ops/config work. |

**Implementation steps:**
1. Create Sentry project at sentry.io, get DSN
2. Add `VITE_SENTRY_DSN` to `.env` and deployment platform
3. Verify `initSentry()` is called early in `main.tsx`
4. Add `@sentry/vite-plugin` for source map upload during build
5. Configure Sentry alerts: error rate > 5/min, p95 response > 3s, new error types
6. Add Sentry user context in AuthContext on login/logout (may already be wired)

---

### 1.4 CI/CD Pipeline

| Attribute | Detail |
|-----------|--------|
| **What exists** | Nothing. No `.github/workflows/` directory. No GitHub Actions, no Vercel config file, no branch protection. |
| **What's needed** | GitHub Actions workflow (lint -> typecheck -> test -> build -> deploy), Vercel project setup with preview deploys on PR, environment variable management, Supabase migration runner in CI, branch protection on main. |
| **Priority** | **P1 — Needed within first week.** Manual deploys are error-prone and block collaboration. |
| **Complexity** | **Medium.** Standard pipeline, but Supabase migration integration adds complexity. |

**Implementation steps:**
1. Create `.github/workflows/ci.yml`: lint, typecheck, vitest, build
2. Create `.github/workflows/deploy.yml`: Vercel deployment on merge to main
3. Set up Vercel project, link to repo, configure env vars
4. Add preview deploy trigger on PR open/update
5. Enable branch protection on main: require CI pass, require review
6. Add Supabase CLI migration check to CI (optional: run migrations on deploy)

---

### 1.5 Scale Readiness

| Attribute | Detail |
|-----------|--------|
| **What exists** | DB indexes are defined in migrations. Supabase RLS policies exist. TanStack Query provides client-side caching. Manual chunks reduce bundle size. |
| **What's needed** | Connection pooling config (PgBouncer via Supabase dashboard), rate limiting on API-like RPCs, query optimization audit (check N+1 patterns), load testing with k6/artillery, realtime connection limit verification, image resize on upload. |
| **Priority** | **P2 — Nice to have for launch, needed before scale.** Current architecture handles 100 concurrent users fine. The 1000-2000 target requires this. |
| **Complexity** | **Medium.** Mostly configuration and testing, not new features. |

**Implementation steps:**
1. Enable PgBouncer in Supabase dashboard (transaction mode)
2. Add rate limiting middleware (Supabase Edge Function or client-side throttle)
3. Run `EXPLAIN ANALYZE` on top 10 queries, add missing indexes
4. Set up k6 load test: 1000 virtual users browsing + RSVPing
5. Test realtime: 200 simultaneous WebSocket connections to same event channel
6. Add image resize on avatar upload (Supabase Storage transform or client-side)
7. Verify Supabase plan supports target connection/realtime limits

---

## 2. Performance — Partially Done

| Attribute | Detail |
|-----------|--------|
| **What exists** | React.lazy for all 14 page routes with Suspense boundaries. Vite manual chunks (8 vendor bundles). Dynamic imports for html2canvas, canvas-confetti, qrcode.react. PWA with service worker and runtime caching. |
| **What's needed** | Lighthouse mobile audit (measure actual scores), image optimization (WebP conversion, lazy loading for non-critical images, avatar size constraints), gzip/brotli verification on deployment platform, FCP measurement on 3G throttle, bundle size tracking. |
| **Priority** | **P1 — Before real users.** Code splitting is done but unmeasured. Mobile users in India on 3G need < 2s FCP. |
| **Complexity** | **Small.** Measurement + configuration, not new architecture. |

**Specific tasks:**

| Task | Status | Effort |
|------|--------|--------|
| React.lazy route splitting | Done | -- |
| Manual vendor chunks (8 bundles) | Done | -- |
| Dynamic import heavy libs | Done | -- |
| Lighthouse mobile audit | Not done | Small |
| Image optimization (WebP, lazy load) | Not done | Small |
| gzip/brotli config verification | Not done | Small |
| FCP < 2s on 3G measurement | Not done | Small |
| Bundle size < 300KB gzipped target | Not measured | Small |

---

## 3. Testing — Partially Done

| Attribute | Detail |
|-----------|--------|
| **What exists** | 31 test files across 4 categories: unit (11 files testing lib functions), integration (8 files testing hooks and components with mocked Supabase), edge (7 files testing boundary conditions), smoke (4 files testing build/routes/components/libs). Vitest + jsdom + @testing-library/jest-dom. Supabase client mock. |
| **What's needed** | E2E tests (Playwright), mobile viewport tests, stress tests, RLS policy tests against real Supabase. |
| **Priority** | **P1 — Before launch.** Unit/integration coverage is good. E2E tests catch integration issues that unit tests miss. |
| **Complexity** | **Large** (E2E), **Medium** (stress), **Medium** (RLS). |

**Specific gaps:**

### 3.1 E2E Tests (Playwright) — Not Started

| Test | What it covers | Priority |
|------|----------------|----------|
| Full user journey | Sign up -> onboard -> browse events -> RSVP -> attend -> check-in -> feedback | P0 |
| Admin journey | Login -> create event -> assign groups -> view analytics | P1 |
| Payment flow | RSVP -> pay -> confirm (blocked until Razorpay built) | P1 |
| Mobile viewport | Entire flow on 375px width, bottom nav, touch targets | P1 |
| Error scenarios | Network offline, session full, already RSVP'd, GPS denied | P1 |

**Implementation steps:**
1. Install Playwright: `npm init playwright@latest`
2. Configure `playwright.config.ts` with mobile viewports
3. Create test helpers for auth (seed test user, get session token)
4. Write 5 core E2E tests (above)
5. Add to CI pipeline

### 3.2 Stress Tests — Not Started

| Test | Target | Priority |
|------|--------|----------|
| Concurrent reads | 100 simultaneous profile fetches | P2 |
| RSVP race condition | 10 users RSVP last spot simultaneously — only 1 succeeds | P1 |
| Waitlist promotion | Rapid cancel + promote cycle — no double-booking | P1 |
| Realtime subscriptions | 50 users on same session page via WebSocket | P2 |
| Analytics throughput | 1000 `analytics_events` inserts/minute | P2 |

### 3.3 RLS Policy Tests — Not Started

| Test | What it verifies | Priority |
|------|------------------|----------|
| Profile isolation | User A cannot read User B's private fields | P1 |
| RSVP ownership | User cannot cancel another user's RSVP | P1 |
| Admin elevation | Only admin user_type can access admin RPCs | P1 |
| Partner scoping | Partner can only see their own venue's bookings | P1 |
| Flag privacy | Flagged user cannot see who flagged them | P1 |

---

## 4. Security

| Attribute | Detail |
|-----------|--------|
| **What exists** | RLS policies on all tables (23 migration files). SECURITY DEFINER functions for elevated operations. Input validation in forms. Token stripping in Sentry breadcrumbs. Admin email whitelist check. ProtectedRoute auth gate. |
| **What's needed** | OWASP top 10 scan, rate limiting on Supabase RPCs, webhook signature verification (for future Razorpay), CORS configuration review, CSP headers, audit of `as any` casts that bypass type safety. |
| **Priority** | **P1 — Before real user data.** RLS is the main defense and it's in place. These are hardening measures. |
| **Complexity** | **Medium.** Mix of configuration and code changes. |

**Specific tasks:**

| Task | Status | Priority | Effort |
|------|--------|----------|--------|
| RLS policies on all tables | Done (23 migrations) | -- | -- |
| SECURITY DEFINER functions | Done | -- | -- |
| Input validation (forms) | Done | -- | -- |
| Auth gate (ProtectedRoute) | Done | -- | -- |
| OWASP top 10 scan | Not done | P1 | Small |
| Rate limiting on RPCs/APIs | Not done (mentioned in personality.ts only) | P1 | Medium |
| Razorpay webhook signature verification | Not applicable yet (no Razorpay) | P0 when payments ship | Small |
| CORS configuration | Not reviewed | P1 | Small |
| CSP headers | Not configured | P1 | Small |
| Audit `as any` casts | Not done (many instances in Home.tsx, Admin.tsx) | P2 | Medium |

---

## 5. Features Not Fully Wired

### 5.1 Autopilot Auto-Booking

| Attribute | Detail |
|-----------|--------|
| **What exists** | Profile columns: `autopilot_enabled`, `autopilot_days`, `autopilot_times`, `autopilot_max_per_week`. UI on Home.tsx shows autopilot suggestion card (gated to 3+ sessions) and autopilot status indicator. Profile settings page presumably has toggle. |
| **What's missing** | No backend logic actually auto-books sessions. No cron job, no edge function, no scheduled task. The UI lets you "enable" autopilot but nothing happens after that. |
| **Priority** | **P2 — Nice to have.** Manual RSVP works fine for launch. Autopilot is a retention feature for power users. |
| **Complexity** | **Medium.** Need a scheduled function that: queries users with autopilot enabled, matches their preferences against upcoming events, creates RSVP records, sends confirmation email. |

**Implementation:**
1. Create Supabase Edge Function: `autopilot-booking` (scheduled via pg_cron)
2. Query profiles where `autopilot_enabled = true`
3. For each, find matching events (day, time, max_per_week not exceeded)
4. Create RSVP, send confirmation email
5. Handle edge cases: event full, user already RSVP'd, max bookings reached

---

### 5.2 Streak Insurance — UI Exists, Backend Incomplete

| Attribute | Detail |
|-----------|--------|
| **What exists** | `streak_insurance_used_at` column referenced in Home.tsx (via `as any` cast). UI shows streak warning card on Thursdays+ for users with 2+ week streaks. Card text mentions "streak save available" if insurance hasn't been used in 30 days. |
| **What's missing** | No actual "use streak insurance" button or flow. No backend function that freezes a streak. No logic that auto-breaks streaks on missed weeks. The streak warning card is informational only — there's no way to activate the insurance. The streak break detection itself may not exist (no cron checking for missed sessions). |
| **Priority** | **P2 — Retention feature.** Streaks display correctly. Insurance is a safety net for engaged users. |
| **Complexity** | **Small-Medium.** Need: streak break detection (weekly cron), insurance activation endpoint, insurance cooldown tracking. |

**Implementation:**
1. Create weekly cron function: check all users with active streaks, if no session attended this week and no insurance used, reset streak
2. Add "Use streak save" button to streak warning card
3. Create RPC: `use_streak_insurance(user_id)` — sets `streak_insurance_used_at`, preserves streak
4. Enforce 30-day cooldown on insurance use

---

### 5.3 Social Loss "Missed You" Notifications

| Attribute | Detail |
|-----------|--------|
| **What exists** | Home.tsx has a "Your crew is going" card (social loss framing, gated to 2+ sessions). It queries circle members' RSVPs for upcoming events the user hasn't joined. The card shows which circle members are attending which sessions. |
| **What's missing** | No **post-session** "missed you" notification. The current implementation is pre-session FOMO (proactive). There's no system that creates a notification after a session saying "Your crew met without you — here's what happened." No push notification or in-app notification for this. |
| **Priority** | **P2 — Engagement feature.** The pre-session card already provides social motivation. Post-session notifications are a stronger hook but not essential for launch. |
| **Complexity** | **Small.** Post-session trigger -> create notification in `notifications` table -> display in notification feed. |

---

### 5.4 Venue Vibe Summary on Event Cards

| Attribute | Detail |
|-----------|--------|
| **What exists** | `VenueVibeSummary` component is exported from `src/components/session/VenueVibeRating.tsx`. It IS mounted in Events.tsx on each event card (`{event.venue_name && <VenueVibeSummary venueName={event.venue_name} />}`). It's also referenced in EventDetail.tsx. |
| **What's missing** | This appears to be **done**. The component exists and is mounted. The only concern is whether `venue_vibes` table has data — with zero ratings, the summary would be empty. Needs seed data or first real sessions to populate. |
| **Priority** | **P2 — Works but empty until sessions happen.** |
| **Complexity** | **N/A — Already implemented.** May need seed data for demo/testing. |

---

### 5.5 Rituals Feed on People/Discover Page

| Attribute | Detail |
|-----------|--------|
| **What exists** | `CommunityRitualCard` component exists at `src/components/home/CommunityRitualCard.tsx`. It's used on the Home page. The `community_rituals` and `ritual_likes` tables exist. Monday Focus and Friday Wins ritual types are supported. |
| **What's missing** | The Discover page (`src/pages/Discover.tsx`) has no rituals feed. It's purely a people discovery page with match scoring. There's no community activity feed showing what members are working on, their weekly intentions, or wins. |
| **Priority** | **P2 — Nice to have.** The rituals feature works on Home. A Discover page feed would increase engagement but isn't core to the product. |
| **Complexity** | **Small.** Reuse `CommunityRitualCard` or create a feed variant. Query `community_rituals` ordered by recent, show on Discover page as a tab or section. |

---

## 6. Operational

### 6.1 Admin Tools — Partially Built

| Attribute | Detail |
|-----------|--------|
| **What exists** | Full admin dashboard at `/admin` with 8 tabs: Overview (KPIs, member stats, neighborhoods), Members (list, search, sort), Events (create/manage), Analytics (charts via Recharts), Flags (member reports), Icebreakers, Partners, Status Game, Growth, Chai Settings. Smart group creation via `createSmartGroups()`. |
| **What's missing** | No payment management (blocked on Razorpay), no bulk operations (mass email, bulk event creation), no user suspension/ban flow (flags display but no action buttons to resolve them), no export functionality (CSV of members, events, payments). |
| **Priority** | **P1 — Admin needs to manage day-to-day operations.** |
| **Complexity** | **Medium.** |

**Specific gaps:**

| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Event CRUD | Done (create, list) | -- | -- |
| Member management (list, search) | Done | -- | -- |
| KPI dashboard | Done | -- | -- |
| Analytics charts | Done (Recharts) | -- | -- |
| Flag review display | Done | -- | -- |
| Flag resolution actions (warn, suspend, ban) | Not done | P1 | Small |
| Payment dashboard | Not done (blocked on Razorpay) | P0 when payments ship | Medium |
| Bulk operations (mass email, bulk create) | Not done | P2 | Medium |
| CSV export (members, events) | Not done | P2 | Small |
| User suspension/ban enforcement | Not done | P1 | Medium |

---

### 6.2 Partner Onboarding Flow

| Attribute | Detail |
|-----------|--------|
| **What exists** | `PartnersTab` in admin dashboard for managing venue partners. `venue_partners` table with coordinates. Partner-related types in Supabase types. |
| **What's missing** | No self-service partner registration flow. Partners can't sign up and create their own venue listing. No partner dashboard (separate from admin). No session creation by partners. No earnings view for partners. No partner-specific auth flow. |
| **Priority** | **P1 — Need partner onboarding before scaling venues.** For MVP, admin can manually add partners. |
| **Complexity** | **Large.** Full partner portal: registration, venue details, session scheduling, earnings tracking, payout history. |

**Implementation:**
1. Partner registration page (name, venue details, photos, amenities)
2. Admin approval workflow (partner submits, admin reviews, approves/rejects)
3. Partner dashboard: venue stats, upcoming sessions, earnings
4. Partner session creation: set dates, times, pricing, max spots
5. Partner earnings view: per-session revenue, payout schedule

---

### 6.3 Content Moderation

| Attribute | Detail |
|-----------|--------|
| **What exists** | `FlagMemberForm` component for reporting members during sessions. `FlagsTab` in admin dashboard displaying flags with flagged user, reporter, session, reason, and notes. `member_flags` table in DB. |
| **What's missing** | No action buttons on flags (resolve, dismiss, warn user, suspend). No automated escalation (e.g., 3 flags = auto-suspend). No flagged content review for prompts/rituals. No appeal process for flagged users. No notification to flagged user about outcome. |
| **Priority** | **P1 — Before launch with real users.** Displaying flags without the ability to act on them is insufficient. |
| **Complexity** | **Small-Medium.** Add action buttons + status field to flags, create user suspension logic. |

---

### 6.4 Analytics Visualization

| Attribute | Detail |
|-----------|--------|
| **What exists** | `analytics_events` table in DB. `trackAnalyticsEvent()` function in `lib/growth.ts`. `AdminAnalyticsCharts` component with Recharts showing member growth, engagement trends, rank distribution. `GrowthTab` with growth metrics. |
| **What's missing** | Analytics are based on profile/event aggregate queries, not the `analytics_events` table data. No funnel visualization (sign up -> onboard -> first RSVP -> first session -> retained). No cohort analysis. No event-level analytics (which events fill fastest, cancellation rates). No real-time dashboard. |
| **Priority** | **P2 — Nice to have.** Current admin analytics provide basic visibility. Funnel/cohort analysis helps optimize growth but isn't launch-critical. |
| **Complexity** | **Medium.** Query `analytics_events` table, build funnel and cohort charts. |

---

## 7. Mobile / PWA — Partially Done

| Attribute | Detail |
|-----------|--------|
| **What exists** | `vite-plugin-pwa` configured in `vite.config.ts` with autoUpdate registration. Manifest with app name, colors, standalone display. Service worker with runtime caching: NetworkFirst for Supabase API (5 min cache, 50 entries), CacheFirst for OpenStreetMap tiles (7 day cache, 200 entries). Offline fallback configured. `use-mobile.tsx` hook for breakpoint detection. Bottom navigation bar (`BottomNav.tsx`). |
| **What's needed** | Push notifications, app icon assets (all sizes), iOS Safari testing + meta tags, install prompt UX, splash screens. |
| **Priority** | **P1 — Push notifications are critical for engagement.** Icon assets and iOS testing are P1 for mobile users. Install prompt is P2. |
| **Complexity** | **Medium** (push notifications), **Small** (icons/testing/meta tags). |

**Specific gaps:**

| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Service worker + offline fallback | Done | -- | -- |
| Runtime caching strategy | Done | -- | -- |
| App manifest | Done | -- | -- |
| Mobile navigation (BottomNav) | Done | -- | -- |
| Push notifications (Web Push API) | Not done | P1 | Medium |
| App icon assets (all sizes) | Not verified | P1 | Small |
| iOS Safari meta tags (status bar, splash) | Not done | P1 | Small |
| iOS Safari testing | Not done | P1 | Small |
| Install prompt UX (beforeinstallprompt) | Not done | P2 | Small |
| Splash screens (all devices) | Not done | P2 | Small |

**Push notification implementation:**
1. Generate VAPID keys for Web Push
2. Create service worker push event handler
3. Create Supabase Edge Function to send push via Web Push API
4. Build notification permission request flow in app
5. Store push subscriptions in DB (new `push_subscriptions` table)
6. Wire to existing notification triggers (RSVP confirmation, session reminder, prop received)

---

## Priority Summary

### P0 — Launch Blockers (Must have before any real users)

| Item | Section | Effort | Dependency |
|------|---------|--------|------------|
| Email notifications (Resend) | 1.1 | Large | Resend account, Supabase Edge Functions |
| Payment integration (Razorpay) | 1.2 | Large | Razorpay account, Supabase Edge Functions |

### P1 — First Month (Needed for sustainable operation)

| Item | Section | Effort |
|------|---------|--------|
| Sentry DSN + source maps + alerts | 1.3 | Small |
| CI/CD pipeline | 1.4 | Medium |
| Lighthouse audit + image optimization | 2 | Small |
| E2E tests (Playwright) | 3.1 | Large |
| RSVP race condition stress test | 3.2 | Small |
| RLS policy tests | 3.3 | Medium |
| OWASP scan | 4 | Small |
| Rate limiting | 4 | Medium |
| CORS + CSP headers | 4 | Small |
| Flag resolution actions (admin) | 6.1 | Small |
| User suspension/ban | 6.1 | Medium |
| Partner onboarding (at least manual) | 6.2 | Large |
| Content moderation actions | 6.3 | Small |
| Push notifications | 7 | Medium |
| iOS Safari testing + meta tags | 7 | Small |
| App icon assets | 7 | Small |

### P2 — Nice to Have (Growth/retention features)

| Item | Section | Effort |
|------|---------|--------|
| Scale readiness (load testing, pooling) | 1.5 | Medium |
| Autopilot auto-booking backend | 5.1 | Medium |
| Streak insurance activation flow | 5.2 | Small |
| Post-session "missed you" notifications | 5.3 | Small |
| Rituals feed on Discover page | 5.5 | Small |
| Admin bulk operations + CSV export | 6.1 | Medium |
| Analytics funnel/cohort visualization | 6.4 | Medium |
| Install prompt UX | 7 | Small |
| Audit `as any` type casts | 4 | Medium |

---

## Recommended Execution Order

**Week 1: Revenue + Communication**
1. Razorpay payment integration (P0, large)
2. Resend email notifications (P0, large)

**Week 2: Reliability + Safety**
3. Sentry production setup (P1, small)
4. CI/CD pipeline (P1, medium)
5. CORS + CSP + rate limiting (P1, small-medium)
6. Flag resolution + user suspension (P1, small-medium)

**Week 3: Quality + Mobile**
7. E2E tests with Playwright (P1, large)
8. Push notifications (P1, medium)
9. iOS Safari testing + app icons (P1, small)
10. Lighthouse audit + image optimization (P1, small)

**Week 4: Growth Features**
11. Autopilot backend (P2, medium)
12. Streak insurance flow (P2, small)
13. Partner self-service portal (P1, large — start here, finish in week 5)
14. Analytics visualization (P2, medium)
