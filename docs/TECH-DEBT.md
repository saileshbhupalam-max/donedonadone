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

### TD-004: Booking limits not enforced — RESOLVED
- **Status:** RESOLVED — `toggleRsvp` now accepts `monthlySessionLimit` option, checks RSVP count this month before allowing new "going" RSVPs.

---

## HIGH — Should fix soon after launch

### TD-005: Supabase mock makes tests fragile
- **Location:** `src/test/mocks/supabase.ts`
- **Description:** Global supabase mock returns empty arrays/objects for all queries. Any test that needs realistic data must override the mock manually. The mock doesn't validate query shapes — tests pass even if production queries would fail.
- **Impact:** False confidence. Tests verify component rendering but not data integration.
- **Fix:** Consider MSW (Mock Service Worker) for more realistic API mocking, or integration tests against a Supabase test project.

### TD-006: No error boundaries on data-fetching pages — RESOLVED
- **Status:** RESOLVED — RouteErrorBoundary component wraps all protected routes via `ProtectedPage` wrapper in App.tsx.

### TD-007: Admin email allowlist is hardcoded — RESOLVED
- **Status:** RESOLVED — `useAdminCheck` hook checks profile role, hardcoded fallback, then `app_settings` DB table for `admin_emails`.

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

### TD-010: PullToRefresh calls window.location.reload() — RESOLVED
- **Status:** RESOLVED — Home page now calls `refreshProfile()` + `fetchAll()`. Discover page uses `refreshKey` counter to remount sub-components.

---

## MEDIUM — Quality and performance

### TD-011: No data caching layer for offline
- **Location:** `vite.config.ts` (Workbox config)
- **Description:** Service worker caches app shell (HTML/JS/CSS) and map tiles, but no API response caching. Supabase queries use NetworkFirst with 5s timeout but no IndexedDB fallback. If network fails, all data pages show empty/error states.
- **Impact:** Users on spotty WiFi (common in Indian cafes) get broken experiences during sessions.
- **Fix:** Add Supabase query result caching via React Query's `persistQueryClient` with IndexedDB adapter, or manual SWR cache for critical data (current session, event details, profile).

### TD-012: EventCard fetches VenueQuickBadges per card — RESOLVED
- **Status:** RESOLVED — `useVenueBadgesBatch` hook fetches all venue vibes in one `.in()` query. Events page passes `preloadedBadges` prop to each EventCard.

### TD-013: Profile has 64 fields with no validation — RESOLVED
- **Status:** RESOLVED — `src/lib/profileValidation.ts` with field-level validators. Applied at 6 profile update call sites (Profile, Settings, Onboarding, Autopilot, ProfilePrompt, ranks).

### TD-014: No rate limiting on client-side Supabase operations — RESOLVED
- **Status:** RESOLVED — `isTogglingRef` mutex guard on `toggleRsvp` prevents concurrent calls. ConnectionRequestsList already had `acting` state guard.

### TD-015: Realtime subscriptions not cleaned up consistently — RESOLVED
- **Status:** RESOLVED — All 5 channel call sites audited. `useSubscription` channel name fixed to include user ID. All have proper cleanup.

### TD-016: No TypeScript strict mode — PARTIALLY RESOLVED
- **Status:** IN-PROGRESS — Enabled `strictFunctionTypes`, `strictBindCallApply`, `noImplicitThis` in tsconfig.app.json. Full `strict: true` and `strictNullChecks` deferred to avoid hundreds of errors.

---

## LOW — Nice to fix

### TD-017: Lovable branding remnants — RESOLVED
- **Status:** RESOLVED — OG/Twitter meta tags use local `/og-image.png` and `@FocusClubHQ`. Removed `lovable-tagger`, `@lovable.dev/cloud-auth-js`, and `src/integrations/lovable/`.

### TD-018: Bundle size could be optimized — RESOLVED (no change needed)
- **Status:** RESOLVED — Investigation confirmed recharts only used in lazy-loaded Admin page, html2canvas uses dynamic `await import()`, qrcode uses `React.lazy`. Chunks already lazy-load correctly via existing page-level code splitting.

### TD-019: Test coverage gaps
- **Location:** `src/test/`
- **Description:** 555 tests across 39 files, but coverage is concentrated on lib functions (matchUtils, badges, ranks, antifragile, icebreakers). No component render tests. No integration tests against real Supabase. No E2E tests.
- **Impact:** UI regressions undetected. Data integration bugs missed.
- **Fix:** Add React Testing Library render tests for critical components (EventCard, FeatureGate, SessionPreStart). Add Playwright E2E for core flows (signup → RSVP → session → feedback).

### TD-020: Inconsistent date handling — RESOLVED
- **Status:** RESOLVED — Replaced `new Date(isoString)` with `parseISO(isoString)` across 27 files. `new Date()` (current time) left as-is.

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
| TD-R13 | Booking limits not enforced (TD-004) | `toggleRsvp` accepts `monthlySessionLimit` option |
| TD-R14 | No error boundaries on pages (TD-006) | RouteErrorBoundary + ProtectedPage wrapper |
| TD-R15 | Admin emails hardcoded (TD-007) | `useAdminCheck` hook with DB fallback |
| TD-R16 | PullToRefresh full page reload (TD-010) | React state refresh in Home + Discover |
| TD-R17 | N+1 venue badge queries (TD-012) | `useVenueBadgesBatch` batch fetch |
| TD-R18 | Profile fields unvalidated (TD-013) | `profileValidation.ts` at 6 update sites |
| TD-R19 | RSVP double-click (TD-014) | `isTogglingRef` mutex guard |
| TD-R20 | Realtime channel name collision (TD-015) | All channels use unique user/entity IDs |
| TD-R21 | TS strict mode partial (TD-016) | `strictFunctionTypes` + `strictBindCallApply` + `noImplicitThis` |
| TD-R22 | Lovable branding (TD-017) | Removed tagger, cloud-auth, fixed OG/Twitter meta |
| TD-R23 | Bundle size (TD-018) | Verified already lazy-loaded via code splitting |
| TD-R24 | Inconsistent date parsing (TD-020) | `parseISO` across 27 files |
