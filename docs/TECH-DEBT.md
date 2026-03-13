# FocusClub — Technical Debt Register

> Last updated: March 2026
> Severity: CRITICAL | HIGH | MEDIUM | LOW
> Status: OPEN | IN-PROGRESS | RESOLVED

---

## CRITICAL — Must fix before launch

### TD-001: No payment integration
- **Location:** `src/pages/Pricing.tsx:64`, `src/components/session/SessionBoostBanner.tsx`
- **Description:** `handleUpgrade()` and Session Boost button both show `toast.info("Payment integration coming soon!")`. No Razorpay, Stripe, or UPI integration exists. The entire subscription system (tiers, features, limits, boost) is built but has no way to activate paid tiers.
- **Impact:** Zero revenue. All tier gating is theoretical — every user is permanently free tier.
- **Fix:** Integrate Razorpay (or UPI QR via `upiqr` npm package for MVP). Wire up subscription creation, webhook handling, tier activation.

### TD-002: Women-only enforcement is client-side only
- **Location:** `src/pages/EventDetail.tsx` (handleRsvp function)
- **Description:** Women-only RSVP check happens in React component: `if (event.women_only && profile.gender !== "woman") toast.error(...)`. No Row Level Security policy on `event_rsvps` table prevents direct API insertion.
- **Impact:** Safety-critical. A determined user can bypass via Supabase client or API.
- **Fix:** Add RLS policy on `event_rsvps`: `CREATE POLICY women_only_check ON event_rsvps FOR INSERT USING (NOT EXISTS (SELECT 1 FROM events WHERE id = event_id AND women_only = true) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND gender = 'woman'))`.

### TD-003: No outbound notification channel
- **Location:** `src/lib/notificationLogic.ts`, `src/lib/growth.ts`
- **Description:** Notifications only exist in-app (`notifications` table + realtime subscription). No email delivery (Resend/SendGrid), no WhatsApp (Business API), no SMS. Push notifications have infrastructure (`sw-push.js`, VAPID, `push_subscriptions` table) but no server-side trigger to send them.
- **Impact:** Members who aren't actively in the app receive zero communication. Session reminders, group assignments, re-engagement — all silent.
- **Fix:** Phase 1: Supabase Edge Function for push notification cron (24hr + 1hr before session). Phase 2: Resend for email. Phase 3: WhatsApp Business API.

### TD-004: Booking limits not enforced
- **Location:** `src/hooks/useEvents.ts` (toggleRsvp)
- **Description:** `tier_limits` table has per-tier booking limits, and `useSubscription().getLimit()` can read them, but `toggleRsvp` never calls `getLimit("monthly_sessions")` before allowing RSVP. All tiers can book unlimited sessions.
- **Impact:** No subscription differentiation. Free users get everything paid users get.
- **Fix:** Check `getLimit("monthly_sessions")` in RSVP handler. Count user's RSVPs this month. Block with upgrade prompt if over limit.

---

## HIGH — Should fix soon after launch

### TD-005: Supabase mock makes tests fragile
- **Location:** `src/test/mocks/supabase.ts`
- **Description:** Global supabase mock returns empty arrays/objects for all queries. Any test that needs realistic data must override the mock manually. The mock doesn't validate query shapes — tests pass even if production queries would fail.
- **Impact:** False confidence. Tests verify component rendering but not data integration.
- **Fix:** Consider MSW (Mock Service Worker) for more realistic API mocking, or integration tests against a Supabase test project.

### TD-006: No error boundaries on data-fetching pages
- **Location:** All page components
- **Description:** Top-level `ErrorBoundary` exists in `main.tsx`, but individual pages that fail to fetch data show blank screens or infinite loading. No per-page error states with retry.
- **Impact:** Users see blank pages on network errors instead of friendly error states with retry options.
- **Fix:** Add `ErrorBoundary` wrappers per route with `ERROR_STATES` copy from personality.ts.

### TD-007: Admin email allowlist is hardcoded
- **Location:** `src/pages/Admin/constants.ts`
- **Description:** `ADMIN_EMAILS` array is hardcoded in source. Adding a new admin requires a code deploy.
- **Impact:** Operational bottleneck.
- **Fix:** Move to `app_settings` table or a dedicated `admin_users` table with DB-level role check.

### TD-008: Smart group formation has no admin trigger UI
- **Location:** `src/pages/Admin/EventsTab.tsx:106-138`
- **Description:** "Create Groups" button exists inline in the EventsTab event list, but it's small and easy to miss. No preview of groups before saving. No undo. No scheduled auto-formation.
- **Impact:** Admin must manually click per event. No way to preview or adjust groups.
- **Fix:** Add group preview modal before saving. Add auto-formation option (e.g., form groups 24hrs before session).

### TD-009: `taste_graph` completion gates features but builder is buried
- **Location:** `src/pages/TasteGraphBuilder.tsx`, `src/components/FeatureGate.tsx`
- **Description:** Several features require `requireDnaComplete >= N%` but the TasteGraphBuilder is only accessible via `/me/dna` or a small CTA on the Home page. Most users don't know it exists.
- **Impact:** Users get locked out of features (Coffee Roulette, etc.) without understanding why or how to unlock them.
- **Fix:** Progressive profiling — ask taste graph questions post-session, in-context, or during natural pauses. Don't make users go to a separate 7-step form.

### TD-010: PullToRefresh calls window.location.reload()
- **Location:** `src/components/ui/PullToRefresh.tsx`
- **Description:** Pull-to-refresh triggers a full page reload, which on slow connections means complete re-download of the SPA chunk, re-authentication, and state loss.
- **Impact:** Poor experience on 3G/slow WiFi. User loses scroll position and any in-progress interactions.
- **Fix:** Replace with React state refresh (re-fetch data queries) instead of full page reload.

---

## MEDIUM — Quality and performance

### TD-011: No data caching layer for offline
- **Location:** `vite.config.ts` (Workbox config)
- **Description:** Service worker caches app shell (HTML/JS/CSS) and map tiles, but no API response caching. Supabase queries use NetworkFirst with 5s timeout but no IndexedDB fallback. If network fails, all data pages show empty/error states.
- **Impact:** Users on spotty WiFi (common in Indian cafes) get broken experiences during sessions.
- **Fix:** Add Supabase query result caching via React Query's `persistQueryClient` with IndexedDB adapter, or manual SWR cache for critical data (current session, event details, profile).

### TD-012: EventCard fetches VenueQuickBadges per card
- **Location:** `src/components/venue/VenueQuickBadges.tsx`
- **Description:** Each EventCard renders its own VenueQuickBadges, each making a Supabase query. In-memory cache (5-min TTL) prevents repeat fetches for the same venue, but initial page load with 20 events at 5 venues = 5 queries in parallel.
- **Impact:** Unnecessary DB load. Latency on events page.
- **Fix:** Batch-fetch all venue vibes for visible events in a single query in the parent component, pass as props.

### TD-013: Profile has 64 fields with no validation
- **Location:** `src/integrations/supabase/types.ts` (profiles table)
- **Description:** Profiles table has 64 columns. Many are nullable with no constraints. Fields like `preferred_radius_km`, `autopilot_max_per_week`, `focus_hours` have no range validation. Display names have no length limit.
- **Impact:** Data quality issues. Potential for XSS via unvalidated text fields displayed in UI.
- **Fix:** Add Supabase CHECK constraints on numeric fields. Add length limits on text fields. Sanitize display in UI (already using React's default escaping, but should validate on write).

### TD-014: No rate limiting on client-side Supabase operations
- **Location:** Various hooks (`useEvents`, `usePrompts`, `useConnections`)
- **Description:** RSVP toggling, connection requests, prompt submissions — all go directly to Supabase with no client-side debounce or rate limiting. Double-clicking creates duplicate records (though some have unique constraints).
- **Impact:** Duplicate records, excess API calls, potential for abuse.
- **Fix:** Add `useMemo`/`useCallback` with debounce. Add loading states that disable buttons during operations (partially done for RSVP).

### TD-015: Realtime subscriptions not cleaned up consistently
- **Location:** `src/pages/Session/index.tsx`, `src/hooks/useNotifications.ts`
- **Description:** Supabase Realtime channels are subscribed in useEffect but cleanup varies. Some components unsubscribe on unmount, others don't. Realtime channel names may collide if multiple instances exist.
- **Impact:** Memory leaks. Stale subscriptions. Potential for receiving events for old sessions.
- **Fix:** Audit all `supabase.channel()` calls. Ensure consistent unsubscribe in cleanup. Use unique channel names with session/user IDs.

### TD-016: No TypeScript strict mode
- **Location:** `tsconfig.json`
- **Description:** TypeScript compiles with default strictness. Many `any` types in component props, Supabase query results cast with `as any`. The generated Supabase types (4042 lines) are proper, but usage often bypasses them.
- **Impact:** Type safety is partial. Refactoring is risky without full type coverage.
- **Fix:** Enable `strict: true` incrementally. Start with `noImplicitAny` for new files.

---

## LOW — Nice to fix

### TD-017: Lovable branding remnants
- **Location:** `index.html` (og:image, twitter:site), `vite.config.ts` (componentTagger)
- **Description:** OpenGraph image points to `lovable.dev/opengraph-image`, Twitter site is `@Lovable`, and `lovable-tagger` plugin runs in dev mode. These are leftover from the Lovable build.
- **Impact:** Brand confusion. Social shares show Lovable branding.
- **Fix:** Replace OG image with FocusClub branding. Remove lovable-tagger from devDependencies. Update Twitter handle.

### TD-018: Bundle size could be optimized
- **Location:** `vite.config.ts` (manualChunks)
- **Description:** Manual chunks exist for react, supabase, ui, charts, animation, dates, media, query. But `vendor-charts` is 383KB (recharts + d3) loaded even if user never visits admin analytics. `vendor-media` is 218KB (html2canvas + qrcode) loaded for sharing features.
- **Impact:** Initial load size on slow connections.
- **Fix:** Lazy-load chart and media vendor chunks. Only import when needed (dynamic import on admin/sharing pages).

### TD-019: Test coverage gaps
- **Location:** `src/test/`
- **Description:** 555 tests across 39 files, but coverage is concentrated on lib functions (matchUtils, badges, ranks, antifragile, icebreakers). No component render tests. No integration tests against real Supabase. No E2E tests.
- **Impact:** UI regressions undetected. Data integration bugs missed.
- **Fix:** Add React Testing Library render tests for critical components (EventCard, FeatureGate, SessionPreStart). Add Playwright E2E for core flows (signup → RSVP → session → feedback).

### TD-020: Inconsistent date handling
- **Location:** Various pages
- **Description:** Mix of `date-fns` functions (`parseISO`, `format`, `differenceInDays`) and raw `new Date()` parsing. Some dates stored as ISO strings, some as date-only strings. Timezone handling is implicit (user's browser timezone).
- **Impact:** Edge cases around midnight, cross-timezone users, events showing on wrong day.
- **Fix:** Standardize on UTC storage + browser timezone display. Use `date-fns-tz` for timezone-aware formatting.

### TD-021: No API error tracking granularity
- **Location:** `src/lib/sentry.ts`
- **Description:** Sentry is initialized but Supabase errors are caught with `console.error` or `toast.error`. No structured error reporting to Sentry with context (which query failed, what parameters, user state).
- **Impact:** Hard to debug production issues. Errors are logged client-side but not tracked centrally.
- **Fix:** Wrap Supabase queries with error reporter that sends to Sentry with context.

---

## Resolved

| ID | Description | Resolved In |
|----|-------------|------------|
| TD-R01 | Vitest OOM and fork hang | `bb57234` — pool: "forks" + removed thenable mock |
| TD-R02 | 11 pre-existing test failures | `bb57234` — global supabase mock + personality fix |
| TD-R03 | No women-only UI enforcement | `b665f10` — blockedByWomenOnly check in EventDetail |
| TD-R04 | No quick feedback path | `b665f10` — QuickFeedback component |
| TD-R05 | No first-session guide | `b665f10` — FirstSessionGuide component |
| TD-R06 | Admin flag review missing | `b665f10` — FlagsTab with stats |
| TD-R07 | No session format filter | `b665f10` — Format filter chips on Events |
| TD-R08 | Admin nav unusable (18 horizontal tabs) | `2f45e7c` — Grouped sidebar |
| TD-R09 | Home page information overload | `2f45e7c` — 4-tier prioritization + collapsible |
| TD-R10 | Two gating systems not unified | `2f45e7c` — FeatureGate supports both |
| TD-R11 | No focus-only session format | `44c4cde` — focus_only_2hr/4hr |
| TD-R12 | No offline resilience | `44c4cde` — PWA manifest + SW caching + OfflineBanner |
