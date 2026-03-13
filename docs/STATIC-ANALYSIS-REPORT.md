# Static Analysis Report

**Date:** 2026-03-13
**Codebase:** donedonadone (FocusClub)
**Files analyzed:** ~304 TypeScript/TSX files in `src/`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 22 |
| MEDIUM | 38 |
| LOW | 30+ |

---

## 1. CRITICAL Issues

### CRIT-01: Supabase client uses `localStorage` directly -- breaks in private browsing

**File:** `src/integrations/supabase/client.ts` line 13
**Risk:** `localStorage` throws in Safari private browsing / some embedded browsers. The Supabase auth client will fail to initialize, breaking the entire app.
**Suggested fix:** Use a try/catch wrapper or Supabase's default storage (which already handles this).

```ts
auth: {
  storage: localStorage,  // <-- will throw in private browsing
```

### CRIT-02: react-router-dom XSS via open redirect (CVE)

**Source:** `npm audit` -- `@remix-run/router <=1.23.1`
**Severity:** HIGH (per npm audit)
**Risk:** React Router 6.0.0-6.30.2 is vulnerable to XSS via open redirects. Attacker-controlled URLs can execute scripts.
**Suggested fix:** `npm audit fix` to upgrade react-router-dom.

### CRIT-03: Fire-and-forget Supabase writes with no error handling in EventDetail buddy matching

**File:** `src/pages/EventDetail.tsx` lines 260-277
**Risk:** Multiple chained `.then(() => {})` calls for critical operations (setting first-session flag, assigning buddy, sending notification). If any fail silently, first-time users get no buddy, and welcome buddies get no notification. Data integrity issue.
**Suggested fix:** Wrap in a proper async function with error handling and toast on failure.

### CRIT-04: `venue_scans` insert has no error handling and no await

**File:** `src/pages/Index.tsx` line 53
**Risk:** `supabase.from("venue_scans").insert({ venue_partner_id: venueId })` -- no `await`, no `.then()`, no error handling. If `venueId` from URL is invalid/malicious, this silently fails and venue scan tracking is completely unreliable.
**Suggested fix:** Add `.then(({ error }) => { if (error) console.error(...) })`.

### CRIT-05: Rollup path traversal vulnerability (CVE)

**Source:** `npm audit` -- `rollup 4.0.0-4.58.0`
**Severity:** HIGH
**Risk:** Arbitrary file write via path traversal in the build tool.
**Suggested fix:** `npm audit fix` to upgrade rollup.

---

## 2. HIGH Issues

### HIGH-01: 18 npm audit vulnerabilities (10 high, 5 moderate, 3 low)

**Source:** `npm audit`
**Key vulnerabilities:**
- `@remix-run/router` -- XSS via open redirects
- `rollup 4.0.0-4.58.0` -- arbitrary file write
- `serialize-javascript <=7.0.2` -- RCE via RegExp.flags
- `esbuild <=0.24.2` -- dev server can be exploited by any website
- `glob 10.2.0-10.4.5` -- command injection
- `minimatch` -- multiple ReDoS vulnerabilities
- `ajv <6.14.0` -- ReDoS with `$data`
- `js-yaml 4.0.0-4.1.0` -- prototype pollution
- `lodash 4.0.0-4.17.21` -- prototype pollution in `_.unset`/`_.omit`
**Suggested fix:** Run `npm audit fix` for non-breaking fixes, then `npm audit fix --force` with testing for breaking changes (jsdom, vite-plugin-pwa).

### HIGH-02: Empty catch blocks swallowing errors silently

**Files and lines:**
- `src/pages/Onboarding.tsx:83` -- `catch {}` after saving onboarding progress
- `src/pages/Onboarding.tsx:101` -- `catch {}` after localStorage.setItem
- `src/pages/Onboarding.tsx:110` -- `catch {}` after localStorage.setItem
- `src/components/checkin/CheckInFlow.tsx:140` -- `catch {}` after RPC call `increment_location_member_count`

**Risk:** The Onboarding localStorage catches are acceptable (private browsing guard), but `CheckInFlow.tsx:140` silently swallows a failed RPC call that manages location member counts. Counts will be wrong.
**Suggested fix:** At minimum, log the error in the CheckInFlow catch block.

### HIGH-03: CoworkAgainCard -- unused expression (dead code / potential bug)

**File:** `src/components/session/CoworkAgainCard.tsx` line 28
**ESLint:** `Expected an assignment or function call and instead saw an expression`
**Risk:** The ternary `next.has(id) ? next.delete(id) : next.add(id)` is used as a statement, which works for Set mutation but ESLint flags it as it's an anti-pattern that can mask bugs.
**Suggested fix:** Use an if/else statement instead.

### HIGH-04: 22 React Hook dependency warnings (missing useEffect dependencies)

**Files (all `react-hooks/exhaustive-deps` warnings):**
- `src/components/admin/NotificationsTab.tsx:77` -- missing `fetchStats`
- `src/components/checkin/CheckInFlow.tsx:75` -- missing `detectLocation`
- `src/components/community/CoffeeRoulette.tsx:66` -- missing `user`
- `src/components/community/CoffeeRoulette.tsx:101` -- missing `fetchMatchedUser`, `startPolling`, `startTimeout`, `user`
- `src/components/community/MicroRequestBoard.tsx:89` -- missing `fetchRequests`
- `src/components/company/CompanyIntros.tsx:57` -- missing `fetchIntros`
- `src/components/company/CompanyMatches.tsx:244` -- missing `fetchMatches`
- `src/components/company/CompanyNeedsOffers.tsx:148` -- missing `fetchAll`
- `src/components/home/NeedsMatchCard.tsx:61` -- missing `profile`, `user`
- `src/components/map/SessionMap.tsx:108` -- missing `requestPosition`
- `src/components/session/EnergyCheck.tsx:45` -- missing `loadGroupAvg`
- `src/components/session/IcebreakerEngine.tsx:45` -- missing `round`
- `src/components/session/ScrapbookPrompt.tsx:40` -- missing `generateScrapbook`
- `src/components/upgrade/BoostMathBanner.tsx:28` -- missing `user`
- `src/pages/Session/index.tsx:149` -- missing `groupStatuses`, `icebreakerRounds.length`
- `src/pages/Session/index.tsx:224` -- missing `event`, `phases`, `profile`, `updateMyStatus`, `user`
- `src/pages/Session/index.tsx:237` -- missing `energyCheckShown`, `photoMomentShown`

**Risk:** Can cause stale closures, infinite re-renders when deps change, or effects not re-running when they should. The Session page (line 224) is particularly dangerous -- it references `event`, `phases`, `profile`, `updateMyStatus`, and `user` but doesn't list them, meaning the session phase auto-advance logic may use stale data.
**Suggested fix:** Audit each and either add the missing deps or extract stable refs via useCallback/useRef.

### HIGH-05: JSON.parse on localStorage without try/catch

**Files:**
- `src/lib/matchNudges.ts:54-56` -- `JSON.parse(raw)` on localStorage value
- `src/pages/Events/index.tsx:58` -- `JSON.parse(localStorage.getItem("fc_saved_events") || "[]")`
- `src/components/home/ProfilePromptCard.tsx:30` -- `JSON.parse(localStorage.getItem("dismissed_prompts") || "{}")`
- `src/components/home/ProfilePromptCard.tsx:103` -- same

**Risk:** If localStorage contains corrupted data (e.g., partially written, manually edited), `JSON.parse` will throw, crashing the component. The `|| "[]"` fallback only covers the null case, not malformed JSON.
**Suggested fix:** Wrap in try/catch with fallback default value.

### HIGH-06: Hardcoded WhatsApp number for partner inquiries

**File:** `src/pages/Partners.tsx:112`
**Value:** `919876543210`
**Risk:** Hardcoded phone number. If the business number changes, requires a code deploy. Also appears to be a placeholder/test number.
**Suggested fix:** Move to app_settings table or environment variable.

### HIGH-07: `trackConversion` function has no error handling at all

**File:** `src/lib/trackConversion.ts:4-12`
**Risk:** The entire function is fire-and-forget with `.then(() => {})`. If `getUser()` succeeds but `insert` fails, conversion events are silently lost. There's no `.catch()` anywhere.
**Suggested fix:** Add `.catch(console.error)` at minimum.

### HIGH-08: FeatureFlags provider has race condition with module-level cache

**File:** `src/hooks/useFeatureFlags.tsx:11-12,39-49`
**Risk:** `cachePromise` is set module-level but the `.then()` callback captures the `setFlags`/`setLoading` of whichever component instance set it up. If the provider unmounts and remounts, `cachePromise` still references old setter. Subsequent mounts go into the `else` branch (line 44) where they call `cachePromise.then(...)` which may resolve with stale `setFlags` calls on unmounted components.
**Suggested fix:** Use `useRef` or proper state management instead of module-level promise caching.

### HIGH-09: AuthContext `localStorage` in `signOut` -- no try/catch

**File:** `src/contexts/AuthContext.tsx:82-83`
**Risk:** In private browsing mode, `localStorage.removeItem()` can throw, which would break the signOut flow and leave the user in an inconsistent state.
**Suggested fix:** Wrap in try/catch.

### HIGH-10: Supabase client auth storage uses raw localStorage

**File:** `src/integrations/supabase/client.ts:13`
**Risk:** Same as CRIT-01. The `storage: localStorage` option means the Supabase auth client will crash on initialization in environments where localStorage is unavailable.
**Suggested fix:** Remove the `storage: localStorage` line (Supabase defaults to localStorage with a fallback), or provide a safe wrapper.

---

## 3. MEDIUM Issues

### MED-01: 60+ console.log/console.error statements left in production code

**Key files (non-exhaustive):**
- `src/main.tsx:20` -- `console.log("[SW] App ready to work offline")`
- `src/lib/sessionTemplates.ts` -- 8 console.error calls
- `src/pages/Home/index.tsx:924,940` -- console.error in event handlers
- `src/lib/sentry.ts:52` -- console.error as fallback (acceptable)
- `src/hooks/usePushNotifications.ts` -- 4 console.error calls
- `src/hooks/usePrompts.ts` -- 4 console.error calls
- `src/hooks/useNotifications.ts` -- 2 console.error calls
- `src/pages/Index.tsx:98,102` -- console.error on sign-in
- `src/components/admin/PartnersTab.tsx:246` -- `console.error(e)` (unstructured)
- `src/components/connections/ConnectionRequestsList.tsx:88` -- `console.error(error)` (unstructured)
- `src/components/venue/VenueReviewCard.tsx:44` -- `console.error(e)` (unstructured)

**Risk:** Exposes internal error details in production browser console. Some are unstructured (`console.error(e)`) which leak stack traces.
**Suggested fix:** Replace with Sentry integration (already in project) or a structured logger that can be disabled in production.

### MED-02: 76 modules with unused exports

**Source:** `ts-unused-exports`
**Notable unused non-UI-library exports:**
- `src/components/discover/HorizontalCard.tsx` -- `HorizontalCard`
- `src/components/discover/MemberCard.tsx` -- `MemberCard`
- `src/components/discover/SkeletonCards.tsx` -- `SkeletonHorizontal`, `SkeletonGrid`
- `src/components/gamification/LeaderboardSection.tsx` -- `LeaderboardSection`
- `src/components/gamification/MonthlyTitlesSection.tsx` -- `MonthlyTitlesSection`
- `src/components/home/CompanyHomeCard.tsx` -- `CompanyHomeCard`
- `src/components/home/NeedsMatchCard.tsx` -- `NeedsMatchCard`
- `src/components/session/SmartIntroCard.tsx` -- `SmartIntroCard`
- `src/hooks/useOfflineQuery.ts` -- `useOfflineQuery`
- `src/hooks/useProfiles.ts` -- `useProfiles`, `vibeLabels`, `Profile`, `SortOption`
- `src/lib/badges.ts` -- `fetchBadgeStats`, `BadgeCheckStats`
- `src/lib/haptics.ts` -- `hapticWarning`
- `src/lib/mentorMatch.ts` -- `MENTOR_KEYWORDS`, `MENTEE_KEYWORDS`, `fetchMentors` + more
- `src/lib/offlineCache.ts` -- `clearCache`
- `src/lib/profileValidation.ts` -- 12 unused validators
- `src/lib/pushNotifications.ts` -- `requestPushPermission`, `hasActivePushToken`
- `src/lib/sessionPhases.ts` -- `FOCUS_ONLY_2HR_PHASES`, `FOCUS_ONLY_4HR_PHASES`

**Risk:** Dead code increases bundle size and maintenance burden. ~30 of these are UI component library re-exports (acceptable), but ~46 are application-specific dead code.
**Suggested fix:** Remove unused application exports. Keep UI library re-exports.

### MED-03: 130+ uses of `any` type across production code

**Source:** ESLint (`@typescript-eslint/no-explicit-any`) -- 244 errors total (some in tests)
**Key production files with heavy `any` usage:**
- `src/components/admin/AIConfigTab.tsx` -- 13 `any` types
- `src/components/admin/SubscriptionsTab.tsx` -- 11 `any` types
- `src/components/admin/StatusGameTab.tsx` -- 6 `any` types
- `src/components/admin/GrowthTab.tsx` -- 6 `any` types
- `src/pages/Session/index.tsx` -- 6 `any` types
- `src/pages/Profile/index.tsx` -- 4 `any` types
- `src/pages/Home/index.tsx:89-94` -- 6 state variables typed as `any[]`

**Risk:** Bypasses TypeScript's type safety. Most are on Supabase query results that could use the generated Database types.
**Suggested fix:** Replace with proper types from `src/integrations/supabase/types.ts`.

### MED-04: Empty block statement in CheckInFlow

**File:** `src/components/checkin/CheckInFlow.tsx:140`
**ESLint:** `no-empty`
**Code:** `try { await supabase.rpc(...); } catch {}`
**Risk:** See HIGH-02.

### MED-05: State updates after potential unmount in async effects

**Files (async operations in useEffect without cleanup/mount check):**
- `src/pages/Session/index.tsx:86-130` -- Large async IIFE in useEffect, multiple setState calls after awaits
- `src/pages/Home/index.tsx:98-200+` -- `fetchAll` callback with many setState calls
- `src/components/community/CoffeeRoulette.tsx` -- polling with setState
- `src/components/checkin/CheckInFlow.tsx:77-101` -- async detectLocation with multiple setStates
- `src/pages/EventDetail.tsx:170-195` -- async data loading with setState

**Risk:** If user navigates away during async operations, React will warn "Can't perform a React state update on an unmounted component." While React 18 suppresses the warning, the underlying issue (wasted work, potential stale data) remains.
**Suggested fix:** Use AbortController or a mounted ref check in async effects.

### MED-06: Hardcoded external URLs

**Files:**
- `src/components/map/SessionMap.tsx:21-23,193` -- Leaflet marker icons from unpkg.com CDN, Stadia Maps tile URL
- `src/components/map/LocationPicker.tsx:14-16,73` -- Same Leaflet icons, same tile URL
- `src/components/admin/PartnersTab.tsx:60` -- Fallback URL `https://focusclub.app`
- `src/components/sharing/WhatsAppButton.tsx:64` -- LinkedIn sharing URL

**Risk:** CDN outages break map icons. Tile provider changes break the map. If the domain changes from focusclub.app, needs code deploy.
**Suggested fix:** Move CDN URLs to constants. Move domain to env var.

### MED-07: `needsMatch.ts` JSON.parse on untrusted description field

**File:** `src/lib/needsMatch.ts:46`
**Code:** `JSON.parse(description.slice(idx + META_SEPARATOR.length))`
**Risk:** Parses JSON embedded in a user-facing description string. If the separator is found at an unexpected position or the JSON is malformed, this throws.
**Suggested fix:** Wrap in try/catch.

### MED-08: Onboarding progress can silently fail to save

**File:** `src/pages/Onboarding.tsx:82-83`
**Code:** localStorage.setItem inside try, with `catch {}`
**Risk:** If private browsing or storage full, onboarding progress silently lost. User may have to redo steps.
**Suggested fix:** Fall back to sessionStorage or in-memory state.

### MED-09: `noFallthroughCasesInSwitch: false` in tsconfig

**File:** `tsconfig.app.json:16`
**Risk:** Allows accidental fall-through in switch statements, which is a common source of bugs.
**Suggested fix:** Set to `true`.

### MED-10: `strict: false` with selective strict options

**File:** `tsconfig.app.json:25-30`
**Risk:** While `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, and `noImplicitThis` are enabled, `strictPropertyInitialization` and `alwaysStrict` are not. Class properties could be used before initialization.
**Suggested fix:** Enable `strict: true` and remove individual overrides.

### MED-11: `noImplicitAny: false` in tsconfig

**File:** `tsconfig.app.json:17`
**Risk:** Allows variables to implicitly be `any`, defeating the purpose of TypeScript. This is why there are 130+ explicit `any` usages -- the implicit ones aren't even counted.
**Suggested fix:** Enable `noImplicitAny: true` and fix the resulting errors.

---

## 4. LOW Issues

### LOW-01: 12 `react-refresh/only-export-components` warnings

**Files:**
- `src/components/connections/ConnectionRequestsList.tsx:19`
- `src/components/session/GivePropsFlow.tsx:19,314`
- `src/components/sharing/ProfileCard.tsx:175`
- `src/components/ui/badge.tsx:31`
- `src/components/ui/button.tsx:48`
- `src/components/ui/form.tsx:129`
- `src/components/ui/navigation-menu.tsx:111`
- `src/components/ui/sidebar.tsx:636`
- `src/components/ui/sonner.tsx:27`
- `src/components/ui/toggle.tsx:37`
- `src/contexts/AuthContext.tsx:93`

**Risk:** Fast refresh won't work for these files during development, causing full page reloads.
**Suggested fix:** Move non-component exports (constants, hooks, variants) to separate files.

### LOW-02: Empty interface in UI components

**Files:**
- `src/components/ui/command.tsx:24` -- `An interface declaring no members is equivalent to its supertype`
- `src/components/ui/textarea.tsx:5` -- same

**Risk:** Code smell, no runtime impact.
**Suggested fix:** Use type alias instead of empty interface.

### LOW-03: `prefer-const` violation in test file

**File:** `src/test/integration/giveProps.test.tsx:70`
**Risk:** Minor code quality issue.
**Suggested fix:** Change `let` to `const`.

### LOW-04: No circular dependencies found

**Source:** `madge --circular`
**Status:** Clean.

### LOW-05: TypeScript strict compilation passes cleanly

**Source:** `tsc --noEmit --noUnusedLocals --noUnusedParameters`
**Status:** No errors with current config. However, this is because `noImplicitAny: false` and `strict: false` mask issues.

### LOW-06: `noUnusedLocals` and `noUnusedParameters` disabled

**File:** `tsconfig.app.json:18-19`
**Risk:** Dead local variables and parameters aren't flagged.
**Suggested fix:** Enable both and clean up the resulting warnings.

### LOW-07: Many `.catch(() => {})` calls on non-critical fire-and-forget operations

**Files:** ~25 instances across the codebase
**Examples:**
- `src/hooks/useEvents.ts:108,176,178,188-202` -- cache saves, analytics, reliability updates
- `src/hooks/usePrompts.ts:149` -- analytics tracking
- `src/pages/Onboarding.tsx:179,181` -- analytics tracking
- `src/pages/EventDetail.tsx:241-256` -- waitlist promotion, analytics, reliability

**Risk:** While these are intentionally fire-and-forget (analytics, caching), completely swallowing errors makes debugging impossible.
**Suggested fix:** Replace `catch(() => {})` with `catch((e) => console.debug('[FireForget]', e))` or pipe through Sentry at a low severity level.

### LOW-08: Tile map attribution uses CDN tile provider

**Files:** `src/components/map/SessionMap.tsx`, `src/components/map/LocationPicker.tsx`
**Risk:** Stadia Maps tiles may require an API key for production usage above free tier limits.
**Suggested fix:** Verify Stadia Maps free tier limits and consider setting up an API key.

---

## 5. Dependency Audit Detail

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `@remix-run/router` | HIGH | XSS via open redirect | `npm audit fix` |
| `rollup 4.0.0-4.58.0` | HIGH | Arbitrary file write | `npm audit fix` |
| `serialize-javascript <=7.0.2` | HIGH | RCE via RegExp.flags | `npm audit fix --force` |
| `glob 10.2.0-10.4.5` | HIGH | Command injection via --cmd | `npm audit fix` |
| `minimatch` | HIGH | Multiple ReDoS (3 CVEs) | `npm audit fix` |
| `esbuild <=0.24.2` | MODERATE | Dev server info disclosure | `npm audit fix` |
| `js-yaml 4.0.0-4.1.0` | MODERATE | Prototype pollution | `npm audit fix` |
| `lodash 4.0.0-4.17.21` | MODERATE | Prototype pollution | `npm audit fix` |
| `ajv <6.14.0` | MODERATE | ReDoS with $data | `npm audit fix` |
| `@tootallnate/once` | LOW | Control flow scoping | `npm audit fix --force` (jsdom breaking) |

---

## 6. Architecture Observations (not bugs, but risks)

1. **No request deduplication:** Multiple components fetch the same Supabase data independently (e.g., profiles, events). Consider using React Query's cache (already installed via `@tanstack/react-query`) more broadly.

2. **Home page makes 7+ parallel Supabase calls:** `src/pages/Home/index.tsx` loads prompt, RSVPs, members, stats, feedback, and more. No batching or pagination visible for the members query (loads ALL onboarding-completed profiles).

3. **Module-level mutable state in feature flags:** `cachedFlags` and `cachePromise` are module-level variables that persist across React strict mode double-renders and HMR. Can cause subtle bugs in development.

4. **No Content Security Policy headers configured:** Inline scripts, external CDN resources, and eval-like patterns are all potentially exploitable without CSP.

5. **`next-themes` listed as dependency but this is a Vite SPA, not Next.js:** May be unused or cause unexpected behavior. Consider `@wits/next-themes` or a Vite-native theme solution.

---

## ESLint Summary

- **Total problems:** 279 (244 errors, 35 warnings)
- **Fixable:** 2 errors with `--fix`
- **Most common error:** `@typescript-eslint/no-explicit-any` (200+ instances)
- **Most impactful warnings:** `react-hooks/exhaustive-deps` (22 instances)

---

## Circular Dependencies

No circular dependencies detected (madge analysis of 304 files).

---

## Recommended Priority Order

1. **Run `npm audit fix`** -- fixes 10+ vulnerabilities with no breaking changes
2. **Fix react-hooks/exhaustive-deps warnings** -- especially in Session and Home pages (stale closure bugs)
3. **Add try/catch to localStorage and JSON.parse calls** -- prevents crashes in private browsing
4. **Remove or guard fire-and-forget Supabase calls** -- especially EventDetail buddy matching
5. **Enable stricter TypeScript config** -- `noImplicitAny: true`, `strict: true`
6. **Remove unused exports** -- ~46 dead application-specific exports bloating the bundle
7. **Replace console.log/error with structured logging** -- use existing Sentry integration
8. **Move hardcoded values to config** -- WhatsApp numbers, CDN URLs, domain names
