# Audit 06 -- UX Coherence, Frontend State & Odd Patterns

**Auditor:** Claude Opus 4.6
**Date:** 2026-03-15
**Scope:** Route structure, state management, loading/error states, dead components,
accessibility, performance, PWA integrity, and odd patterns across the entire frontend.

---

## RANKED ISSUES

Issues are ranked by severity:
- **P0 CRITICAL** -- Will cause user-visible failures or data loss
- **P1 HIGH** -- Significant UX degradation or security concern
- **P2 MEDIUM** -- Confusing UX, maintenance burden, or latent bug
- **P3 LOW** -- Cosmetic, minor DX concern, or future risk

---

### P0-01: ErrorBoundary displays old brand name "FocusClub"

**Location:** `src/components/ErrorBoundary.tsx:38-39`
**Description:** The top-level ErrorBoundary (wrapping the entire app in `main.tsx`) renders the old brand name when a fatal crash occurs:
```html
<span className="font-serif">Focus</span>
<span className="font-sans font-light">Club</span>
```
This is the error screen users see when the entire React tree crashes. It shows "FocusClub" instead of "DanaDone", which destroys brand trust at the worst possible moment.
**Fix:** Change to `<span className="font-serif text-[#e07830]">Dana</span><span className="font-sans font-bold">Done</span>` to match the ProtectedRoute loading screen and the rest of the app.

---

### P0-02: Toasters render outside AuthProvider -- auth-dependent toasts may fail silently

**Location:** `src/App.tsx:67-69`
**Description:** Both `<Toaster />` and `<Sonner />` are rendered as siblings to `<BrowserRouter>`, outside `AuthProvider`, `FeatureFlagsProvider`, and `SubscriptionProvider`. While toasts themselves do not typically depend on these contexts, any toast triggered during auth state transitions (e.g., OAuth callback failures) may not render properly because the Sonner toaster component mounts before the BrowserRouter sets up the Router context. More critically, `<PageTracker />` (line 71) uses `usePageTracking()` which likely depends on `useLocation()` from React Router, and it renders _before_ AuthProvider, so page tracking fires without knowing the user identity.
**Fix:** Move `<Toaster />` and `<Sonner />` inside `<BrowserRouter>` after the providers. Move `<PageTracker />` inside `<AuthProvider>` to capture user identity.

---

### P0-03: OfflineBanner overlaps TopBar -- content hidden behind z-index stack

**Location:** `src/components/OfflineBanner.tsx:23`, `src/components/layout/TopBar.tsx:71`
**Description:** OfflineBanner uses `fixed top-0 inset-x-0 z-[100]` and TopBar uses `fixed top-0 z-50`. When offline, the OfflineBanner renders on top of the TopBar, but the main content still has `pt-14` padding (TopBar height). This means the TopBar is hidden behind the OfflineBanner, and the extra height of the OfflineBanner pushes nothing -- it just overlaps. The notification bell, credits badge, and avatar are all inaccessible while offline.
**Fix:** OfflineBanner should push the TopBar down or be inserted inside it. Alternatively, add `pt-[calc(14px+2rem)]` to main content when offline.

---

### P1-04: Admin route has no server-side authorization -- client-side check only

**Location:** `src/pages/Admin/index.tsx:132-135`, `src/hooks/useAdminCheck.ts`
**Description:** The `/admin` route is wrapped in `ProtectedPage` (auth + error boundary) but has no admin-specific server-side check. The `useAdminCheck` hook checks client-side via email lists and profile.user_type. However, if a malicious user navigates to `/admin`, they can see the loading skeleton and the admin page briefly renders all tab components in the `NAV_GROUPS` const (line 50-101) before the redirect fires in the useEffect. During this window, `AdminAnalyticsCharts`, `OverviewTab`, and all other admin components are mounted and may fire Supabase queries. RLS should prevent data leakage, but the components themselves are exposed.
**Fix:** Either add a dedicated `AdminRoute` component that blocks rendering entirely until isAdmin is confirmed, or gate the entire admin render behind `if (!isAdmin) return null` before any JSX. Currently the guard is in a useEffect that only navigates away -- it does not prevent the initial render.

---

### P1-05: 16+ eslint-disable-next-line for react-hooks/exhaustive-deps -- stale closure risks

**Location:** Multiple files:
- `src/pages/EventDetail.tsx:210`
- `src/pages/Session/index.tsx:168, 244, 258`
- `src/pages/Profile/index.tsx:160`
- `src/pages/Credits.tsx:165`
- `src/pages/Companies.tsx:107`
- `src/components/checkin/CheckInFlow.tsx:75`
- `src/components/community/CoffeeRoulette.tsx:66, 102`
- `src/components/session/IcebreakerEngine.tsx:45`
- `src/hooks/useVenueBadgesBatch.ts:108`
- `src/hooks/useUserContext.ts:119`

**Description:** These suppressed warnings indicate useEffect callbacks that reference variables not in their dependency arrays. This means the effects will not re-run when those variables change, leading to stale closures. In EventDetail.tsx, the event fetch effect only runs when `id` changes but references `user` -- if the user signs in while viewing the page, the effect does not re-fire and the page shows stale data.
**Fix:** Audit each suppression individually. For most, the fix is to add the missing deps or extract the logic into a callback with `useCallback`.

---

### P1-06: Clickable Card/div elements are not keyboard-accessible

**Location:** Throughout the codebase:
- `src/components/home/PrimaryActionCard.tsx:74, 93, 120, 149, 163`
- `src/pages/EventDetail.tsx:125, 377, 478`
- `src/pages/Discover.tsx:275, 327`
- `src/pages/Home/index.tsx:523, 581, 711, 722, 826, 997, 1034, 1062, 1073`

**Description:** Dozens of `<Card>` and `<div>` elements use `onClick` with `cursor-pointer` for navigation but lack `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers. Screen reader users and keyboard-only users cannot activate these elements. This is a WCAG 2.1 Level A violation (2.1.1 Keyboard). The NextMilestone component (line 168-171) is a rare exception that correctly includes both onClick and onKeyDown.
**Fix:** For navigation cards, use `<Link>` instead of `onClick`. For interactive cards, add `role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}`.

---

### P1-07: NEIGHBORHOODS mapping duplicated and inconsistent across 4 files

**Location:**
- `src/pages/EventDetail.tsx:154-157` -- Record<string, string> with underscores
- `src/pages/Events/constants.ts:3` -- Array format
- `src/pages/Partners.tsx:11-14` -- Record<string, string> with underscores
- `src/components/admin/PartnersTab.tsx:16` -- Array format

**Description:** Neighborhood display labels are hardcoded in 4 separate locations with different formats. EventDetail and Partners use underscore-separated keys (`hsr_layout`), but the normalized slug format per CLAUDE.md is hyphen-separated (`hsr-layout`). This means `NEIGHBORHOODS["hsr-layout"]` returns undefined and the raw slug is shown to users. Each file lists a different subset of neighborhoods. When a new neighborhood is added, all 4 files must be updated -- and they will not be.
**Fix:** Create a single `getNeighborhoodLabel()` function in `src/lib/neighborhoods.ts` that handles both slug formats and is used everywhere. Events/constants.ts already has a `getNeighborhoodLabel` -- use it everywhere.

---

### P2-08: useOfflineQuery hook exists but is imported nowhere

**Location:** `src/hooks/useOfflineQuery.ts`
**Description:** This hook provides IndexedDB-backed offline data caching with network fallback -- a critical feature for PWA reliability. However, it is not imported by any component or page. All data fetching uses raw Supabase calls that fail silently offline. The offline banner warns users, but every page shows loading skeletons forever when offline because network requests never resolve and there is no cached fallback.
**Fix:** Integrate `useOfflineQuery` for critical data paths: events list, profile data, and session details. These are the pages users most need offline.

---

### P2-09: SpaceInsights links to /events/:id but that route requires auth -- broken conversion funnel

**Location:** `src/pages/SpaceInsights.tsx:378, 387`
**Description:** SpaceInsights is a public route (`/space/:id/insights`) designed as a venue conversion CTA page. It links to `/events/:id` (line 378) and `/events` (line 387). However, both routes are protected by `ProtectedPage` in App.tsx. An unauthenticated venue visitor who clicks "Browse sessions" will be redirected to `/` (the login page) with no context about why, no return-to URL preserved, and no indication of what they were trying to do. The conversion funnel is broken.
**Fix:** Either make `/events` public (read-only mode for unauthenticated users), or redirect through the auth flow with a return URL (`/?returnTo=/events`).

---

### P2-10: PartnerDashboard has no partner role verification

**Location:** `src/pages/PartnerDashboard.tsx:37-58`
**Description:** The partner dashboard checks for a `partner_applications` row for the current user but does not verify the user's role is "venue_partner". Any authenticated user can navigate to `/partner` and see the loading state. If they happen to have an approved partner_applications row (which could happen if the application system has bugs), they see the full partner dashboard with stats and current visitors. There is no `user_type === "venue_partner"` check.
**Fix:** Add a `user_type` check similar to the admin page, or verify the application status before rendering the dashboard.

---

### P2-11: Pricing page route is protected -- unauthenticated users cannot see plans

**Location:** `src/App.tsx:141-143`
**Description:** The `/pricing` route is wrapped in `ProtectedPage`. This means users who are not logged in cannot view pricing, which is a significant conversion barrier. Many SaaS products show pricing publicly. The FeatureGate and UpgradeSessionPrompt components direct users to `/pricing`, but if a session expires, they cannot even see what they would pay for.
**Fix:** Make `/pricing` a public route (remove ProtectedPage wrapper), and conditionally show the "Current Plan" state only when authenticated.

---

### P2-12: Dead/orphan components listed in ARCHITECTURE.md but not in codebase

**Location:** `src/ARCHITECTURE.md`
**Description:** The following components are documented in ARCHITECTURE.md but do not exist:
- `src/components/gamification/StatsGrid.tsx` -- listed in architecture, file does not exist
- `src/components/discover/HorizontalCard.tsx` -- listed, does not exist
- `src/components/discover/OfferCard.tsx` -- listed, does not exist
- `src/components/discover/SkeletonCards.tsx` -- listed, does not exist

Additionally, several onboarding steps listed in ARCHITECTURE.md no longer exist:
- `Step2Work.tsx`, `Step3Preferences.tsx`, `Step4GiveGet.tsx`, `Step5Socials.tsx`, `Step6Summary.tsx`

The architecture doc lists 14 lazy-loaded pages but the actual count is 29 routes.
**Fix:** Update ARCHITECTURE.md to reflect the actual codebase. Remove phantom component references.

---

### P2-13: Landing page email input has inline styles that bypass theme system

**Location:** `src/pages/Index.tsx:192-199`
**Description:** The email magic link input uses hardcoded inline styles (`background: 'rgba(245, 240, 232, 0.08)'`, `color: '#f5f0e8'`, etc.) instead of Tailwind classes or CSS variables. This means the input does not respond to the light/dark theme toggle. The `focusRingColor` style property (line 198) is not a valid CSS property -- it does nothing. The focus ring will not appear on the email input.
**Fix:** Use Tailwind classes: `bg-white/5 text-white border-white/10 focus:ring-primary`. Remove the invalid `focusRingColor`.

---

### P2-14: Delete account button shows a toast instead of actually deleting

**Location:** `src/pages/Settings/index.tsx:355`
**Description:** The "Delete account" confirmation dialog's action handler is:
```ts
onClick={() => toast.info("Contact support to delete your account")}
```
This is a dark pattern -- the user goes through an explicit confirmation dialog ("I understand, delete") only to be told to email support. The action button text says "I understand, delete" which implies the action will happen, but it does not.
**Fix:** Either implement actual account deletion (mark profile as deleted, sign out) or change the button text to "Contact Support" and make it a mailto link, bypassing the deceptive confirmation dialog.

---

### P2-15: No loading/error handling for SubscriptionProvider DB queries

**Location:** `src/hooks/useSubscription.tsx:89-99`
**Description:** The SubscriptionProvider fires 4 parallel Supabase queries on mount. If any fail, it calls `captureSupabaseError` but still sets `loading: false` with whatever partial data succeeded. This means if the `get_effective_tier` RPC fails but `subscription_tiers` succeeds, the user appears to be on "free" tier even if they paid. No user-visible error is shown.
**Fix:** Add a fallback that checks for critical failures (especially `get_effective_tier`) and shows a toast or retry mechanism.

---

### P2-16: Session page timer uses setInterval without accounting for tab backgrounding

**Location:** `src/pages/Session/index.tsx:215-220`
**Description:** The session timer uses `setInterval` with 1-second ticks. When the browser tab is backgrounded (common on mobile), browsers throttle intervals to at most once per minute. This means the timer drifts significantly -- a 25-minute focus block could appear to last 5 minutes if the user switches tabs. The auto-advance to next phase (`setTimeout(() => setCurrentPhaseIdx(i => i + 1), 3000)`) may fire at the wrong time.
**Fix:** Use `Date.now()` comparison on each tick instead of decrementing a counter. Calculate `timeLeft = phaseEndTime - Date.now()` so the timer is always accurate regardless of throttling.

---

### P3-17: CoffeeRoulette has a setInterval poll without backoff

**Location:** `src/components/community/CoffeeRoulette.tsx:126-155`
**Description:** After requesting a coffee match, the component polls every 3 seconds (`setInterval`, line 139) for 2 minutes (120s timeout, line 126). With 100 concurrent users, this generates ~2000 queries/minute to Supabase. There is no exponential backoff, no Supabase Realtime subscription as an alternative, and the poll fires even when the tab is not visible.
**Fix:** Use Supabase Realtime to listen for match events instead of polling. Or at minimum, add exponential backoff and pause polling when document.hidden is true.

---

### P3-18: PWA start_url is /home but unauthenticated users are redirected to /

**Location:** `vite.config.ts:31`
**Description:** The PWA manifest sets `start_url: "/home"`. When a user installs the PWA and opens it later with an expired session, they hit ProtectedRoute, get redirected to `/`, sign in, then get redirected to `/home`. The double redirect is jarring. If they are offline when opening the installed PWA, they see the offline fallback instead of any cached content because `/home` requires auth.
**Fix:** Set `start_url: "/"` and let the Index page handle the redirect based on auth state. This way the PWA opens cleanly whether authenticated or not.

---

### P3-19: Multiple components use `any` type for Supabase data

**Location:**
- `src/pages/Events/index.tsx:64` -- `setPendingFeedback<any[]>`
- `src/pages/Session/index.tsx:54` -- `const [event, setEvent] = useState<any>(null)`
- `src/pages/Partners.tsx:18` -- `useState<any[]>`
- `src/pages/PartnerDashboard.tsx:42` -- `useState<any>(null)`
- `src/components/session/ScrapbookPrompt.tsx:54` -- `(p.profiles as any)?.display_name`

**Description:** Using `any` bypasses TypeScript's type safety. In Session/index.tsx, the entire event object is `any`, meaning any property access is unchecked. If a migration adds/removes/renames a column, there is no compile-time error -- only a runtime crash.
**Fix:** Use the generated Supabase types from `src/integrations/supabase/types.ts` via `Tables<"events">`.

---

### P3-20: NotFound page links to /home with an `<a>` tag instead of React Router Link

**Location:** `src/pages/NotFound.tsx:21`
**Description:** The 404 page uses `<a href="/home">` which causes a full page reload, discarding all client-side state (auth context, subscription data, feature flags). Every other internal link in the app uses React Router's `<Link>` or `navigate()`.
**Fix:** Import `Link` from `react-router-dom` and use `<Link to="/home">`.

---

## ODDITIES

Things that warrant investigation or are unusually designed:

### ODD-01: Module-level `HAD_AUTH_CALLBACK` in AuthContext
`src/contexts/AuthContext.tsx:23` reads `window.location.search` at **module load time** (before React renders) and stores the result in a module-level const. This is intentional (documented in comments) to detect OAuth callbacks before the first render, but it means this value is frozen for the lifetime of the application. If the user navigates away from the callback URL and back (unlikely but possible with browser history), the stale value could cause the 10-second safety timeout to fire unnecessarily.

### ODD-02: PersonalityProvider fetches from a `personality_config` table
`src/contexts/PersonalityContext.tsx:48` fetches brand copy from a database table, with hardcoded defaults as fallback. This is an unusual pattern -- most apps hardcode copy and use i18n for translation. The database-driven approach means admin can change error messages, loading text, and celebrations without a deploy. However, it also means a Supabase outage could cause the entire brand voice to fall back to hardcoded defaults, and the two could drift apart.

### ODD-03: SubscriptionProvider fires 4 parallel queries on every page load
`src/hooks/useSubscription.tsx:89-94` queries 4 tables/RPCs simultaneously. Unlike FeatureFlags (which has module-level caching), subscription data is re-fetched on every mount of SubscriptionProvider. Since the provider wraps the entire app in App.tsx, this fires on initial load. The Realtime subscription (line 123-139) is good for live updates but the initial 4-query blast adds latency to first paint.

### ODD-04: Two separate error boundary layers with different behavior
The app has two error boundaries: `ErrorBoundary.tsx` (wraps entire app, shows brand logo with full-page crash screen) and `RouteErrorBoundary.tsx` (wraps each route, shows retry button). The outer one shows a "Go Home" button that reloads the page (`window.location.href`), while the inner one has a retry that resets state. This layered approach is correct, but the outer boundary's branding is wrong (P0-01).

### ODD-05: The `checkAndAwardBadges()` pattern -- synchronous badge checks in multiple components
Multiple pages call badge/milestone checking functions after user actions (RSVP, check-in, give props). Each call triggers a separate set of Supabase RPCs. If a user RSVPs and checks in quickly, two concurrent badge-check flows could award the same badge twice. The DB likely has unique constraints, but the toasts could fire twice.

### ODD-06: SpaceLive page has no error state
`src/pages/SpaceLive.tsx` is a "TV Mode" display for venues. If the Supabase query fails (network error, invalid ID), `data` stays `null` and the page shows `usePageTitle("DanaDone Live")` but renders nothing visible. For a display meant to run 24/7 on a venue's TV, this is a blank screen failure with no recovery mechanism.

### ODD-07: Onboarding saves progress to localStorage but never clears it
`src/pages/Onboarding.tsx:41-46` reads `danadone_onboarding_progress` from localStorage to restore progress, but the code that saves progress (if it exists) is not shown clearing it after completion. This means a completed user who clears their auth session and re-onboards could see stale progress data from their previous onboarding.

### ODD-08: Landing page uses inline event handlers for hover styles
`src/pages/Index.tsx:163-168, 523-530` uses `onMouseEnter`/`onMouseLeave` to manually set `style.boxShadow` and `style.background`. This bypasses React's reconciliation and directly manipulates the DOM. It works, but it is an unusual pattern in a codebase that otherwise uses Tailwind's `hover:` utilities everywhere.

### ODD-09: Events page fetches app_settings for `min_session_threshold` on every mount
`src/pages/Events/index.tsx:75-77` queries `app_settings` on every page visit to get a threshold value. This is a configuration value that changes rarely. It should be cached in the FeatureFlagsProvider or a similar mechanism.

### ODD-10: The `fc_` prefix in localStorage keys suggests old "FocusClub" branding
Several localStorage keys use `fc_` prefix: `fc_ref`, `fc_theme`, `fc_saved_events`, `fc_venue`. The `fc_` likely stands for "FocusClub" (the old brand name). While harmless, it is confusing for developers and inconsistent with the "danadone_" prefix used for onboarding progress.

---

## SUMMARY

| Severity | Count | Key Theme |
|----------|-------|-----------|
| P0 | 3 | Wrong brand in crash screen, toaster ordering, offline overlap |
| P1 | 4 | Admin auth bypass window, stale closures, a11y, duplicate data |
| P2 | 9 | Dead code, broken funnels, type safety, dark patterns |
| P3 | 4 | PWA start URL, any types, full-page reload, polling without backoff |
| Oddities | 10 | Auth callback detection, dual error boundaries, FC_ prefix |

The most impactful fixes in priority order:
1. Fix the ErrorBoundary brand name (P0-01) -- 30-second fix, high visibility
2. Add keyboard navigation to clickable cards (P1-06) -- WCAG compliance
3. Consolidate NEIGHBORHOODS to a single source (P1-07) -- prevents future bugs
4. Integrate useOfflineQuery for critical paths (P2-08) -- PWA reliability
5. Fix the admin route rendering window (P1-04) -- security hardening
