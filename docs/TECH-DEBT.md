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

### TD-002: Women-only enforcement is client-side only — RESOLVED
- **Status:** RESOLVED — RLS migration at `supabase/migrations/20260313_women_only_rls.sql`. Replaces INSERT policy to enforce women-only check at DB level. Apply via Supabase dashboard or CLI.

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

### TD-008: Smart group formation has no admin trigger UI — RESOLVED
- **Status:** RESOLVED — GroupPreviewModal shows proposed groups with stats (size, gender, captains) before saving. Shuffle button re-runs algorithm.

### TD-009: `taste_graph` completion gates features but builder is buried — RESOLVED
- **Status:** RESOLVED — PostSessionDnaPrompt asks one question during wrap-up. DnaCompletionNudge on Home page when DNA < 50%. Shared dnaCompletion.ts utility.

### TD-010: PullToRefresh calls window.location.reload() — RESOLVED
- **Status:** RESOLVED — Home page now calls `refreshProfile()` + `fetchAll()`. Discover page uses `refreshKey` counter to remount sub-components.

---

## MEDIUM — Quality and performance

### TD-011: No data caching layer for offline — RESOLVED
- **Status:** RESOLVED — `offlineCache.ts` (IndexedDB, 24hr TTL), `useOfflineQuery` hook, applied to Events page. Cached data served on network failure.

### TD-012: EventCard fetches VenueQuickBadges per card — RESOLVED
- **Status:** RESOLVED — `useVenueBadgesBatch` hook fetches all venue vibes in one `.in()` query. Events page passes `preloadedBadges` prop to each EventCard.

### TD-013: Profile has 64 fields with no validation — RESOLVED
- **Status:** RESOLVED — `src/lib/profileValidation.ts` with field-level validators. Applied at 6 profile update call sites (Profile, Settings, Onboarding, Autopilot, ProfilePrompt, ranks).

### TD-014: No rate limiting on client-side Supabase operations — RESOLVED
- **Status:** RESOLVED — `isTogglingRef` mutex guard on `toggleRsvp` prevents concurrent calls. ConnectionRequestsList already had `acting` state guard.

### TD-015: Realtime subscriptions not cleaned up consistently — RESOLVED
- **Status:** RESOLVED — All 5 channel call sites audited. `useSubscription` channel name fixed to include user ID. All have proper cleanup.

### TD-016: No TypeScript strict mode — RESOLVED
- **Status:** RESOLVED — `strictNullChecks: true` enabled. 33 type errors fixed across 24 files. Plus `strictFunctionTypes`, `strictBindCallApply`, `noImplicitThis`.

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

### TD-021: No API error tracking granularity — RESOLVED
- **Status:** RESOLVED — `captureSupabaseError()` in sentry.ts with operation tags and query context. Applied to useEvents, useNotifications, useSubscription, Session page.

### TD-022: Four growth components built but never imported
- **Location:** `src/components/growth/`
- **Description:** Four fully-implemented growth components exist but are never imported or rendered anywhere in the app:
  - `PostSessionContribution.tsx` — Awards FC for post-session ratings/reports. Should be in Session wrap-up.
  - `ReferralDashboard.tsx` — Shows referral stats, invite link, Community Builder progress. Should be in Profile Journey tab.
  - `VenueDataCollector.tsx` — 7-section venue data form with FC rewards. Should be in post-session flow.
  - `NeighborhoodLeaderboard.tsx` — Top contributors by focus hours in neighborhood. Should be on Home page.
- **Impact:** Key growth features (referrals, venue contributions, leaderboard) are invisible to users despite being fully coded.
- **Fix:** Wire each component into its correct parent page. See PRD Section 9 for wiring map.

### TD-023: Focus Credits have no spending UI
- **Location:** `src/lib/focusCredits.ts` (spendCredits function), no UI consumer
- **Description:** The Focus Credits engine has full earn AND spend logic (6 redemption options: free session, priority matching, venue upgrade, pick seat, gift session, exclusive session). Users can earn credits via the CreditsBadge in TopBar. But there is zero UI for spending credits — no redemption dialog, no rewards shop, no way to use earned FC.
- **Impact:** Credits accumulate with no outlet. Users may disengage from earning when they realize credits have no value.
- **Fix:** Build redemption dialog triggered from CreditsBadge tap. Show balance, earning history, and redemption options.

### TD-024: Smart group formation (antifragile.ts) not connected to session creation
- **Location:** `src/lib/antifragile.ts` — `createSmartGroups()`, `updateReliability()`, `joinWaitlist()`, `promoteWaitlist()`, `checkFlagEscalation()`
- **Description:** 6 group matching functions exist but are not called from the admin session creation flow or any automated grouping. Sessions use simple assignment instead. Only `CAPTAIN_NUDGES` and `updateReliability` are imported (in Session/index.tsx).
- **Impact:** Group quality is suboptimal — captain distribution, experience balance, and gender balance algorithms aren't applied.
- **Fix:** Wire `createSmartGroups()` into the admin GroupPreviewModal or automated group assignment flow.

### TD-025: Calendar export functions unused
- **Location:** `src/lib/calendar.ts` — `getGoogleCalendarUrl()`, `downloadICSFile()`
- **Description:** AddToCalendarButton component exists in session/ but the underlying lib functions in calendar.ts are not called from any UI element.
- **Impact:** Users cannot add sessions to their calendar.
- **Fix:** Verify AddToCalendarButton is properly wired. If it uses its own implementation, clean up or consolidate.

### TD-026: Three discover components built but unused
- **Location:** `src/components/discover/HorizontalCard.tsx`, `src/components/discover/SkeletonCards.tsx`, `src/components/home/CompanyHomeCard.tsx`
- **Description:** Three UI components exist but are never imported:
  - `HorizontalCard.tsx` — Compact member card variant
  - `SkeletonCards.tsx` (exports `SkeletonHorizontal`) — Loading placeholder for HorizontalCard
  - `CompanyHomeCard.tsx` — Company card for Home page
- **Impact:** Dead code. Minor — no user-facing consequence.
- **Fix:** Either integrate into Discover/Home pages or remove to reduce bundle.

### TD-027: Hardcoded social proof numbers in growth UI
- **Location:** Multiple growth components
- **Description:** Components like PostSessionContribution and VenueDataCollector contain hardcoded social proof text like "47 members contributed this week" that doesn't reflect real data.
- **Impact:** Minor — self-corrects once real data flows. But could erode trust if users notice obviously fake numbers early on.
- **Fix:** Replace with real queries or hide social proof when user count is below threshold (e.g., show after 20+ real contributions).

### TD-028: SpaceInsights page has no conversion CTA
- **Location:** `src/pages/SpaceInsights.tsx`
- **Description:** The public venue insights page (QR code destination) shows only analytics. No "Join a session" CTA, no live "people here now" count, no upcoming session preview, no download CTA. As the primary QR destination, this page must convert visitors.
- **Impact:** HIGH — QR scans → analytics page → bounce. Zero acquisition from physical touchpoints.
- **Fix:** Add above-the-fold conversion section with live social proof, next session CTA, and app download link.

### TD-029: Partner dashboard QR/marketing tools are admin-only
- **Location:** `src/components/admin/PartnersTab.tsx` (QR generation, table tent PDF)
- **Description:** QR code generation and table tent PDF creation exist only in the admin PartnersTab. Venue partners cannot access their own marketing materials from the partner dashboard at /partner.
- **Impact:** Partners depend on admin to generate their own QR codes. Adds friction to the onboarding process.
- **Fix:** Move QR code + table tent generation to the partner dashboard page. Let partners self-serve.

### TD-030: No TV Mode display for venues
- **Location:** Not built
- **Description:** No `/space/:id/live` route exists. Venues with TVs/displays have no always-on FocusClub content to show. This is a zero-cost, high-impact ambient acquisition channel.
- **Impact:** Missed growth opportunity. Every coworking space has idle screen real estate.
- **Fix:** Build TV Mode page — landscape-optimized, auto-refreshing, QR code + live stats.

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
| TD-R25 | Women-only RLS policy (TD-002) | `supabase/migrations/20260313_women_only_rls.sql` |
| TD-R26 | Group preview modal (TD-008) | `GroupPreviewModal` + shuffle before save |
| TD-R27 | DNA builder buried (TD-009) | `PostSessionDnaPrompt` + `DnaCompletionNudge` |
| TD-R28 | No offline data cache (TD-011) | `offlineCache.ts` + `useOfflineQuery` hook |
| TD-R29 | strictNullChecks (TD-016) | Enabled, 33 errors fixed across 24 files |
| TD-R30 | Sentry error tracking (TD-021) | `captureSupabaseError()` on critical paths |
