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

### TD-022: Four growth components built but never imported — RESOLVED
- **Status:** RESOLVED — All four wired: PostSessionContribution + VenueDataCollector in Session wrap-up, ReferralDashboard in Profile Journey, NeighborhoodLeaderboard on Home page.

### TD-023: Focus Credits have no spending UI — RESOLVED
- **Status:** RESOLVED — `src/pages/Credits.tsx` with balance display, earning history, 6 redemption options, and "How to Earn" guide. Route `/credits` added to App.tsx. CreditsBadge navigates to it.

### TD-024: Smart group formation (antifragile.ts) not connected to session creation — RESOLVED
- **Status:** RESOLVED — `createSmartGroups()` was already wired into EventsTab "Create Groups" button + GroupPreviewModal shuffle. Enhanced with taste graph compatibility scoring (work_vibe, noise_preference, comm_style) via new `getGroupCompatibility()` function and a compatibility swap pass. EventsTab now fetches these fields from profiles.

### TD-025: Calendar export functions unused — RESOLVED
- **Status:** RESOLVED — `AddToCalendarButton` imports and uses both `getGoogleCalendarUrl()` and `downloadICSFile()` from `calendar.ts`. Wired in PrimaryActionCard, Home, and EventDetail.

### TD-026: Three discover components built but unused — RESOLVED
- **Status:** RESOLVED — `CompanyHomeCard` wired into Home page. `HorizontalCard.tsx` and `SkeletonCards.tsx` deleted as dead code.

### TD-027: Hardcoded social proof numbers in growth UI — RESOLVED
- **Status:** RESOLVED — All 3 hardcoded strings replaced with real Supabase queries. Social proof hidden when counts are below threshold (5 for weekly, 3 for venue-specific).

### TD-028: SpaceInsights page has no conversion CTA — RESOLVED
- **Status:** RESOLVED — `LiveConversionHero` component added with live check-in avatars, next session CTA, and "Join FocusClub" button.

### TD-029: Partner dashboard QR/marketing tools are admin-only — RESOLVED
- **Status:** RESOLVED — Extracted `VenueQrSection` shared component (`src/components/venue/VenueQrSection.tsx`). Added to PartnerDashboard with QR download, table tent download, and link copy. PartnersTab refactored to use same shared component.

### TD-030: No TV Mode display for venues — RESOLVED
- **Status:** RESOLVED — `SpaceLive.tsx` at `/space/:id/live` with rotating stats, auto-refresh, QR placeholder, and FocusClub branding.

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
| TD-R31 | Growth components unwired (TD-022) | Wired into Session, Profile, Home |
| TD-R32 | Credits no spending UI (TD-023) | `Credits.tsx` page with redemption + history |
| TD-R33 | Smart grouping no taste graph (TD-024) | `getGroupCompatibility()` + compatibility swap pass |
| TD-R34 | Calendar export unused (TD-025) | Already wired via `AddToCalendarButton` |
| TD-R35 | Unused discover components (TD-026) | CompanyHomeCard wired, dead code deleted |
| TD-R36 | Hardcoded social proof (TD-027) | Real Supabase queries with threshold hiding |
| TD-R37 | SpaceInsights no CTA (TD-028) | `LiveConversionHero` component |
| TD-R38 | Partner QR admin-only (TD-029) | Shared `VenueQrSection` in PartnerDashboard |
| TD-R39 | No TV Mode (TD-030) | `SpaceLive.tsx` at `/space/:id/live` |
