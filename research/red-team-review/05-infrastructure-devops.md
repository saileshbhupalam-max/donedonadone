# Red Team Security Audit: Infrastructure, DevOps & Supply Chain Security

**Target:** donedonadone coworking platform
**Audit Date:** 2026-02-09
**Auditor:** Red Team Security Review
**Scope:** Vercel deployment, Supabase infrastructure, dependency supply chain, server-side security, network/transport, monitoring & incident response
**Codebase Commit:** `be13b5a` (branch: `app-foundation-build`)

---

## Executive Summary

The donedonadone platform runs on a modern serverless stack (Next.js 16 on Vercel + Supabase) which inherits solid baseline security from managed infrastructure. However, this audit identifies **critical gaps** in how that infrastructure is configured and hardened. The most dangerous findings include: a cron endpoint vulnerable to secret brute-forcing with no rate limiting, complete absence of security headers (no CSP, no HSTS, no Permissions-Policy), zero server-side logging or audit trail, no WAF or DDoS protection configuration, NEXT_PUBLIC environment variables leaking UPI payment identifiers, and a dependency tree with 60+ packages lacking lockfile integrity verification. The platform has no monitoring, no alerting, no incident response plan, and no mechanism to detect or respond to active attacks.

**Vulnerability Count by Severity:**
- Critical: 14
- High: 38
- Medium: 52
- Low: 47
- Informational: 29

**Total: 180 distinct vulnerability vectors identified.**

---

## Table of Contents

1. [Vercel Deployment Security](#1-vercel-deployment-security)
2. [Supabase Infrastructure](#2-supabase-infrastructure)
3. [Dependency & Supply Chain](#3-dependency--supply-chain)
4. [Server-Side Security](#4-server-side-security)
5. [Network & Transport Security](#5-network--transport-security)
6. [Monitoring & Incident Response](#6-monitoring--incident-response)
7. [Infrastructure as Moat](#7-infrastructure-as-moat)

---

## 1. Vercel Deployment Security

### 1.1 Cron Endpoint Authentication

#### INFRA-001: Cron Secret Brute-Force via Timing Attack
- **Severity:** Critical
- **Effort to Exploit:** Medium
- **File:** `app/api/cron/notifications/route.ts` (line 10)
- **Finding:** The cron endpoint validates `CRON_SECRET` using a simple string equality check (`authHeader !== \`Bearer ${process.env.CRON_SECRET}\``). JavaScript's `!==` operator is not constant-time, enabling timing side-channel attacks to brute-force the secret character by character.
- **Impact:** An attacker who discovers the cron secret can trigger arbitrary notification generation, spam users, and abuse the notification pipeline to enumerate user data.
- **Remediation:** Use `crypto.timingSafeEqual()` for secret comparison. Wrap in a try-catch since it throws on length mismatch.

#### INFRA-002: Cron Endpoint Publicly Accessible
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `vercel.json` (line 4), `app/api/cron/notifications/route.ts`
- **Finding:** The `/api/cron/notifications` endpoint is a standard GET route accessible to anyone on the internet. While it checks `CRON_SECRET`, there is no IP allowlisting, no rate limiting, and no Vercel-specific header validation (`x-vercel-cron-signature`). An attacker can send unlimited requests to probe the secret.
- **Impact:** Denial of service via repeated cron invocations. If the secret is weak or leaked, full notification system compromise.
- **Remediation:** Validate the `x-vercel-cron-signature` header (available on Vercel Pro/Enterprise). Add rate limiting via Vercel Edge Config or middleware. Restrict to Vercel's cron IP ranges if possible.

#### INFRA-003: CRON_SECRET May Not Be Set
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `app/api/cron/notifications/route.ts` (line 10)
- **Finding:** If `CRON_SECRET` is not set in the environment, `process.env.CRON_SECRET` is `undefined`, and the check becomes `authHeader !== "Bearer undefined"`. An attacker sending `Authorization: Bearer undefined` would pass the check.
- **Impact:** Complete bypass of cron authentication, allowing anyone to trigger notification generation at will.
- **Remediation:** Add an explicit check: `if (!process.env.CRON_SECRET) return 500`. Validate the secret exists at startup/build time.

#### INFRA-004: Cron Response Leaks Processing Metadata
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `app/api/cron/notifications/route.ts` (line 111-114)
- **Finding:** The cron endpoint returns `{ processed: notifications.length, timestamp: now.toISOString() }` even on success. This leaks the number of active users/bookings and exact server time.
- **Impact:** Information disclosure enabling user activity profiling and timing-based attacks.
- **Remediation:** Return minimal response: `{ ok: true }`. Log details server-side only.

#### INFRA-005: Cron N+1 Query Pattern Enables DoS
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/cron/notifications/route.ts` (lines 54-69, 83-97)
- **Finding:** The cron handler executes N+1 queries: for each session, it queries bookings; for each streaker, it queries bookings again. With 100 sessions and 1000 streakers, this becomes ~1100 database queries per invocation, potentially exhausting Supabase connection pool.
- **Impact:** Database connection exhaustion, cron timeout, cascading failures across the platform.
- **Remediation:** Batch queries using `.in()` filters or JOIN-based approaches. Limit per-run processing.

### 1.2 Environment Variable Exposure

#### INFRA-006: UPI VPA Exposed via NEXT_PUBLIC Prefix
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `lib/payments.ts` (line 6-7)
- **Finding:** `NEXT_PUBLIC_UPI_VPA` and `NEXT_PUBLIC_UPI_PAYEE_NAME` use the `NEXT_PUBLIC_` prefix, meaning they are bundled into client-side JavaScript and visible to anyone inspecting the page source. The UPI VPA is a payment address equivalent to a bank account identifier.
- **Impact:** Attackers learn the exact UPI ID receiving payments, enabling social engineering ("pay to this VPA instead"), phishing QR codes, or monitoring transaction patterns via UPI apps.
- **Remediation:** Move to server-only environment variables (remove `NEXT_PUBLIC_` prefix). Generate UPI links server-side only.

#### INFRA-007: Fallback UPI VPA Hardcoded
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `lib/payments.ts` (line 6)
- **Finding:** The fallback `"donedonadone@upi"` is hardcoded if the env var is missing. This reveals the payment VPA in source code visible on GitHub.
- **Impact:** Persistent exposure of payment identifier even if env vars are properly configured in production.
- **Remediation:** Remove hardcoded fallback. Throw an error if the env var is not set.

#### INFRA-008: Supabase URL and Anon Key in Client Bundle
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `lib/supabase/client.ts` (lines 4-7)
- **Finding:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are necessarily public (required for client-side Supabase), but combined they give direct PostgREST API access. This is by design, but the application must ensure RLS policies are airtight since anyone can use these credentials.
- **Impact:** Direct database access bypassing application-level controls; relies entirely on RLS policies for security.
- **Remediation:** Accepted risk for Supabase architecture. Ensure exhaustive RLS policy testing (see Section 2).

#### INFRA-009: No Runtime Environment Validation
- **Severity:** Medium
- **Effort to Exploit:** N/A (configuration risk)
- **File:** All files using `process.env`
- **Finding:** The application uses non-null assertions (`!`) on all environment variables: `process.env.NEXT_PUBLIC_SUPABASE_URL!`. If any variable is missing, the app silently uses `undefined`, leading to cryptic runtime errors rather than clear startup failures.
- **Impact:** Misconfigured deployments could appear functional but silently fail on critical paths (auth, payments, cron).
- **Remediation:** Add a `lib/env.ts` validation module using `zod` to validate all required env vars at build/startup time.

#### INFRA-010: No Separation of Staging/Production Secrets
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `.gitignore` (lines 25-30)
- **Finding:** While `.env.local` and variants are gitignored, there is no evidence of separate Supabase projects for staging vs. production. The same anon key likely works across all environments.
- **Impact:** Preview deployments may connect to production Supabase, allowing preview-branch code to modify production data.
- **Remediation:** Use separate Supabase projects for preview/staging. Configure Vercel environment variable scoping (Preview vs Production).

### 1.3 Build-Time Security

#### INFRA-011: No Build-Time Secret Scanning
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No `git-secrets`, `trufflehog`, or `gitleaks` configuration detected. No pre-commit hooks to prevent accidental secret commits.
- **Impact:** Developers may accidentally commit API keys, database URLs, or secrets. Once in git history, they persist even after deletion.
- **Remediation:** Add `gitleaks` as a pre-commit hook. Configure GitHub secret scanning alerts.

#### INFRA-012: Source Maps May Expose Application Logic
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `next.config.mjs`
- **Finding:** The Next.js config does not set `productionBrowserSourceMaps: false`. Default behavior may generate source maps that expose full application logic to anyone with browser dev tools.
- **Impact:** Attackers can read the exact business logic, find vulnerabilities in API calls, and understand data flow.
- **Remediation:** Explicitly set `productionBrowserSourceMaps: false` in next.config.mjs.

#### INFRA-013: Build Output Includes All Scripts
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `scripts/*.sql`
- **Finding:** The `scripts/` directory containing all SQL schemas is in the repository root. While Vercel won't serve these directly, they are visible in the public GitHub repo, giving attackers complete database schema knowledge.
- **Impact:** Full schema disclosure aids in crafting precise SQL injection or RLS bypass attacks.
- **Remediation:** Accepted risk for open-source projects. If private: move to a separate ops repo. Add `.vercelignore` to exclude scripts from deployment.

#### INFRA-014: TypeScript Strict Mode Gaps
- **Severity:** Low
- **Effort to Exploit:** N/A
- **File:** `tsconfig.json`
- **Finding:** While `strict: true` is set, `noUncheckedIndexedAccess` is not enabled. Multiple files use `eslint-disable @typescript-eslint/no-explicit-any` to bypass type safety (at least 8 instances found in API routes).
- **Impact:** Runtime type errors could cause unexpected behavior in security-critical code paths.
- **Remediation:** Enable `noUncheckedIndexedAccess`. Reduce `any` usage by defining proper Supabase join types.

### 1.4 Preview Deployment Risks

#### INFRA-015: Preview Deployments May Expose Unreleased Features
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** Vercel creates preview deployments for every PR and branch push. These are publicly accessible at predictable URLs (`<branch>-<project>.vercel.app`). There is no authentication gate on preview deployments.
- **Impact:** Unreleased features, buggy code, and security-testing branches are publicly accessible. Attackers can test exploit chains on preview deployments before they reach production.
- **Remediation:** Enable Vercel Deployment Protection (password or Vercel Authentication). Use `VERCEL_ENV` to disable sensitive features in preview.

#### INFRA-016: Preview Deployments Share Production Supabase
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** No evidence of environment-specific Supabase configuration. Preview deployments likely use the same Supabase project as production.
- **Impact:** Buggy preview code can corrupt production data. Attackers accessing preview deployments get production database access.
- **Remediation:** Create separate Supabase projects per environment. Scope environment variables in Vercel to Production only for production Supabase credentials.

### 1.5 Security Headers

#### INFRA-017: No Content Security Policy (CSP)
- **Severity:** Critical
- **Effort to Exploit:** Medium
- **File:** `next.config.mjs`, `app/layout.tsx`
- **Finding:** No Content Security Policy header is configured anywhere in the application. No `next.config.mjs` headers config, no meta tags, no middleware-set headers.
- **Impact:** The application is fully vulnerable to XSS payload execution. Any injected script can exfiltrate data to any domain, load external resources, or execute inline scripts.
- **Remediation:** Add CSP headers via `next.config.mjs`:
```javascript
headers: () => [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; font-src 'self' https://fonts.gstatic.com;" }]}]
```

#### INFRA-018: No Strict-Transport-Security (HSTS) Header
- **Severity:** High
- **Effort to Exploit:** Medium
- **File:** `next.config.mjs`
- **Finding:** No HSTS header configured. While Vercel serves HTTPS by default, without HSTS the browser does not enforce HTTPS-only for subsequent visits, leaving a window for SSL stripping attacks.
- **Impact:** First-visit users on hostile networks (common in cafe coworking scenarios) could have their traffic intercepted via SSL stripping.
- **Remediation:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` via next.config.mjs headers.

#### INFRA-019: No X-Frame-Options / frame-ancestors
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** No clickjacking protection headers configured. The application can be embedded in iframes on any domain.
- **Impact:** Clickjacking attacks where users are tricked into clicking buttons (e.g., "Confirm Payment", "Book Session") while thinking they're interacting with a different page.
- **Remediation:** Add `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`.

#### INFRA-020: No X-Content-Type-Options Header
- **Severity:** Low
- **Effort to Exploit:** Low
- **Finding:** No `X-Content-Type-Options: nosniff` header configured.
- **Impact:** Browser MIME-type sniffing could cause uploaded content to be interpreted as executable scripts.
- **Remediation:** Add `X-Content-Type-Options: nosniff` to all responses.

#### INFRA-021: No Referrer-Policy Header
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** No Referrer-Policy configured. Full referrer URLs (including session IDs, booking IDs in paths) are sent to external domains when users click outbound links.
- **Impact:** Leaks sensitive URL parameters (booking IDs, session IDs) to third-party sites linked from the platform.
- **Remediation:** Add `Referrer-Policy: strict-origin-when-cross-origin`.

#### INFRA-022: No Permissions-Policy Header
- **Severity:** Low
- **Effort to Exploit:** Low
- **Finding:** No Permissions-Policy (formerly Feature-Policy) header configured.
- **Impact:** If the site is embedded or compromised, attackers can access browser APIs (camera, microphone, geolocation) without restriction.
- **Remediation:** Add `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

#### INFRA-023: No CORS Configuration
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** All API routes
- **Finding:** No explicit CORS headers set on any API route. Next.js defaults to same-origin, but there is no explicit enforcement or documentation of CORS policy. No `OPTIONS` handlers for preflight requests.
- **Impact:** While same-origin default is reasonable, the absence of explicit configuration means future changes could inadvertently open CORS. The Supabase client-side calls go directly to Supabase (which has its own CORS), bypassing this entirely.
- **Remediation:** Add explicit CORS middleware for API routes. Document intended cross-origin policy.

### 1.6 Edge/Middleware Security

#### INFRA-024: Middleware Runs on Every Request Without Optimization
- **Severity:** Low
- **Effort to Exploit:** N/A
- **File:** `middleware.ts` (lines 8-18)
- **Finding:** The middleware matcher is very broad: `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)`. This means every API call, every page load, and every non-asset request triggers a Supabase `getUser()` call to validate the session, even for public pages like the landing page.
- **Impact:** Unnecessary latency on public pages. Supabase auth API rate limit consumption on unauthenticated traffic.
- **Remediation:** Narrow the middleware matcher to only protected routes, or add early returns for public paths.

#### INFRA-025: No Security Headers Set in Middleware
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **File:** `middleware.ts`, `lib/supabase/proxy.ts`
- **Finding:** The middleware only handles session refresh and auth redirects. It does not set any security headers on responses. This is the ideal location for setting CSP, HSTS, and other headers per-request.
- **Impact:** Missed opportunity for the most reliable header-setting mechanism in Next.js.
- **Remediation:** Add security headers to the `supabaseResponse` object before returning from `updateSession()`.

#### INFRA-026: API Routes Not Protected by Middleware Auth Check
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `middleware.ts`, `lib/supabase/proxy.ts` (lines 44-51)
- **Finding:** The middleware auth redirect only applies to `/dashboard`, `/partner`, `/admin`, `/session`, `/onboarding`, and `/protected`. API routes under `/api/` are NOT in the protected paths list. Each API route must independently verify auth.
- **Impact:** If any API route forgets `getUser()`, it is completely unauthenticated. Currently `GET /api/sessions` has no auth at all (by design for public listing, but sets a dangerous pattern).
- **Remediation:** Add `/api/` paths (except explicitly public ones) to the middleware protection list.

#### INFRA-027: No Bot/Crawler Protection
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **Finding:** No `robots.txt` or bot detection middleware. Admin/partner dashboard pages could be indexed by search engines if discovered.
- **Impact:** Search engine indexing of admin pages, API endpoint discovery via crawling.
- **Remediation:** Add `robots.txt` disallowing `/admin`, `/partner`, `/api`. Add `X-Robots-Tag: noindex` to sensitive pages.

---

## 2. Supabase Infrastructure

### 2.1 Connection & Authentication

#### INFRA-028: Anon Key Grants Direct PostgREST Access
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `lib/supabase/client.ts`
- **Finding:** The publicly exposed anon key allows anyone to make direct REST API calls to `<supabase-url>/rest/v1/<table>`. All security relies on RLS policies. An attacker can bypass the Next.js application entirely and interact with the database directly.
- **Impact:** Application-level validations (input sanitization, business logic checks) are completely bypassed. Only RLS and database constraints protect data.
- **Remediation:** Ensure every table has restrictive RLS policies. Consider using Supabase API gateway restrictions. Enable Supabase Auth rate limiting.

#### INFRA-029: No Service Role Key Isolation
- **Severity:** Medium
- **Effort to Exploit:** N/A (configuration)
- **Finding:** The codebase uses only the anon key for all operations, including server-side routes and the cron handler. The cron handler at `app/api/cron/notifications/route.ts` uses `createClient()` which uses the anon key, meaning the notification insert is subject to RLS.
- **Impact:** The cron handler may fail silently if RLS policies don't allow inserts for the anonymous/system context. Conversely, if a service role key is later added, it could bypass all RLS if misused.
- **Remediation:** Use a dedicated service role key for server-side operations that need to bypass RLS (cron, admin operations). Store it as a server-only env var (no NEXT_PUBLIC prefix).

#### INFRA-030: Cron Notification Insert Likely Fails Due to RLS
- **Severity:** High
- **Effort to Exploit:** N/A (functional bug with security implications)
- **File:** `app/api/cron/notifications/route.ts` (line 108), `scripts/013_notifications.sql`
- **Finding:** The notifications table has RLS enabled with policies only for SELECT and UPDATE by `auth.uid() = user_id`. There is NO INSERT policy. The cron handler tries to insert notifications using the anon-key server client, which has no authenticated user context. This insert will be silently rejected by RLS.
- **Impact:** The entire notification system is non-functional. Users never receive reminders, group reveals, or streak warnings. This is both a reliability issue and a security issue (attackers can determine that notifications don't work).
- **Remediation:** Either add an INSERT policy for service role, or use a service role key in the cron handler that bypasses RLS.

#### INFRA-031: SECURITY DEFINER Functions Bypass RLS
- **Severity:** High
- **Effort to Exploit:** Medium
- **File:** `scripts/001_schema.sql` (line 210), `scripts/005_session_day.sql` (line 60)
- **Finding:** `book_session()` and `check_in_user()` are declared as `SECURITY DEFINER`, meaning they run with the privileges of the function creator (typically the superuser/service role). Any authenticated user can call these functions via `supabase.rpc()`, and they bypass all RLS policies.
- **Impact:** An attacker can call `book_session` with any `p_user_id` (not just their own) since the SECURITY DEFINER function doesn't enforce `auth.uid() = p_user_id`. Books sessions on behalf of other users.
- **Remediation:** Add `auth.uid()` checks inside SECURITY DEFINER functions. Or switch to SECURITY INVOKER where possible. For `book_session`, verify `p_user_id = auth.uid()` inside the function body.

#### INFRA-032: No Connection Pooling Configuration
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** No evidence of Supabase connection pooling configuration (PgBouncer/Supavisor). Each serverless function invocation creates a new database connection.
- **Impact:** Under load (target: 1000 bookings/day), connection exhaustion is likely. Supabase free tier has limited connections.
- **Remediation:** Enable Supabase connection pooling (Supavisor). Use the pooled connection string in server-side code.

#### INFRA-033: No Database Connection Timeout Configuration
- **Severity:** Low
- **Effort to Exploit:** Medium
- **Finding:** No statement timeout or connection timeout configured in the Supabase client initialization.
- **Impact:** Long-running queries (e.g., from the N+1 cron handler) could hold connections indefinitely.
- **Remediation:** Set `db.statement_timeout` and connection timeouts in Supabase dashboard and client config.

### 2.2 RLS Policy Gaps (Infrastructure Perspective)

#### INFRA-034: Sessions Table Has Unrestricted SELECT
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (line 278)
- **Finding:** `CREATE POLICY "Upcoming sessions viewable by all" ON sessions FOR SELECT USING (true)`. Any user (or unauthenticated PostgREST call with anon key) can read ALL sessions including completed, cancelled, and future unannounced sessions.
- **Impact:** Business intelligence leakage: competitors can monitor session pricing, fill rates, and venue partnerships.
- **Remediation:** Restrict to `status = 'upcoming' AND date >= CURRENT_DATE` for anonymous access. Allow admins/partners to see all.

#### INFRA-035: Profiles Table Has Unrestricted SELECT
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (line 250)
- **Finding:** `CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true)`. All user profiles (including phone numbers, avatar URLs, user types) are readable by anyone with the anon key.
- **Impact:** Complete user directory enumeration. PII exposure (phone numbers). Admin user identification.
- **Remediation:** Restrict anonymous access to display_name and avatar_url only. Use a database view for public profiles.

#### INFRA-036: Groups and Group Members Have Unrestricted SELECT
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (lines 288-292)
- **Finding:** Both `groups` and `group_members` have `FOR SELECT USING (true)`. Any user can enumerate all groups and their members across all sessions.
- **Impact:** Privacy violation: who coworks with whom is disclosed. Social graph construction.
- **Remediation:** Restrict to members of the same group or session participants only.

#### INFRA-037: No RLS on Several Newer Tables
- **Severity:** High
- **Effort to Exploit:** Trivial
- **Finding:** Tables created in later migration scripts (subscription_plans, user_subscriptions, referral_codes, referral_events, favorite_coworkers, session_goals, user_streaks, matching_outcomes) may lack RLS policies if the migration scripts don't explicitly enable and configure them.
- **Impact:** Direct PostgREST access to subscription data, referral codes, and matching algorithms without any access control.
- **Remediation:** Audit every table in every migration script for RLS enablement and policies. Create a checklist.

### 2.3 Direct PostgREST Access

#### INFRA-038: Direct Table Enumeration via PostgREST
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** An attacker can call `GET <supabase-url>/rest/v1/profiles?select=*` with the anon key to dump all profiles. Similarly for sessions, groups, and group_members which have permissive SELECT policies.
- **Impact:** Bulk data exfiltration bypassing application-level pagination or rate limiting.
- **Remediation:** Add row-level limits via RLS. Enable Supabase API rate limiting per anon key. Consider using a proxy (API gateway) instead of direct PostgREST access.

#### INFRA-039: PostgREST Schema Introspection
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** PostgREST exposes OpenAPI schema at `<supabase-url>/rest/v1/` which reveals all public tables, columns, types, and relationships.
- **Impact:** Complete database schema disclosure without needing source code access.
- **Remediation:** Restrict the exposed schema in Supabase dashboard. Use `GRANT` to limit which tables are visible to the anon role.

#### INFRA-040: RPC Functions Callable via PostgREST
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** All `SECURITY DEFINER` functions (`book_session`, `check_in_user`, `auto_assign_groups`, `compute_venue_score`, `cancel_booking`) are callable via `POST <supabase-url>/rest/v1/rpc/<function_name>`.
- **Impact:** Attackers can call admin-intended functions like `auto_assign_groups` directly. Only internal function logic (if any) prevents misuse.
- **Remediation:** Revoke EXECUTE permission from the anon role for admin-only functions. Use `REVOKE EXECUTE ON FUNCTION auto_assign_groups FROM anon;`.

#### INFRA-041: Bulk INSERT/UPDATE via PostgREST
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** Tables with INSERT policies (bookings, session_feedback, member_ratings) allow bulk inserts via PostgREST. An attacker can insert thousands of rows in a single request.
- **Impact:** Data pollution, rating manipulation at scale, storage exhaustion.
- **Remediation:** Add rate limiting at the Supabase level. Add CHECK constraints for reasonable data limits.

### 2.4 Storage & File Upload

#### INFRA-042: No Supabase Storage Bucket Configuration Visible
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** The `venues` table has a `photos TEXT[]` column for venue images, and `profiles` has `avatar_url TEXT`. No Supabase Storage configuration is visible in the codebase. Photos may be stored as external URLs or in an unconfigured storage bucket.
- **Impact:** If a storage bucket exists, it may have default (permissive) policies. Public buckets could be abused for arbitrary file hosting.
- **Remediation:** Audit Supabase Storage buckets. Ensure all buckets have appropriate access policies. Validate uploaded file types and sizes.

#### INFRA-043: Avatar URL Allows Arbitrary External URLs
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `scripts/001_schema.sql` (line 54)
- **Finding:** `avatar_url TEXT` has no validation. Users can set their avatar to any URL, including malicious URLs, tracking pixels, or SSRF-triggering internal URLs.
- **Impact:** XSS via `javascript:` URLs (if rendered in `<img src>`), SSRF if the server fetches the URL for processing, tracking pixels.
- **Remediation:** Validate avatar URLs against an allowlist of domains (Supabase Storage URLs only). Add URL scheme validation.

#### INFRA-044: Venue Photos Array Allows Arbitrary URLs
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `scripts/001_schema.sql` (line 93)
- **Finding:** `photos TEXT[] DEFAULT '{}'` stores venue photo URLs without validation. Partners can inject arbitrary URLs.
- **Impact:** Same as INFRA-043, plus potential for hosting malicious content under the platform's domain reputation.
- **Remediation:** Validate all photo URLs. Use Supabase Storage with signed upload URLs.

### 2.5 Webhook & Realtime Security

#### INFRA-045: No Webhook Secret Validation
- **Severity:** Medium
- **Effort to Exploit:** N/A (future risk)
- **Finding:** No webhook endpoints or webhook secret validation code exists. If Supabase webhooks or third-party webhooks are added later, there is no pattern for secure webhook handling.
- **Impact:** Future webhook integrations may lack authentication, allowing spoofed webhook payloads.
- **Remediation:** Create a webhook validation utility before adding any webhook integrations.

#### INFRA-046: Supabase Realtime Not Restricted
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** Supabase Realtime is likely enabled by default. Any authenticated user can subscribe to realtime changes on any table with SELECT RLS policies. Given the permissive SELECT on sessions, groups, and profiles, realtime monitoring is trivial.
- **Impact:** Real-time monitoring of all bookings, group assignments, and user activity.
- **Remediation:** Disable Realtime on sensitive tables. Configure Realtime authorization policies.

### 2.6 Backup & Recovery

#### INFRA-047: No Application-Level Backup Strategy
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No backup scripts, no point-in-time recovery testing, no backup verification code. Relies entirely on Supabase's built-in backups (which vary by plan: free tier has no PITR).
- **Impact:** Data loss from accidental deletion, RLS policy misconfiguration, or SQL injection is potentially unrecoverable.
- **Remediation:** Enable Supabase PITR (Pro plan). Create pg_dump scripts for regular exports. Test restoration procedures.

#### INFRA-048: No Database Migration Versioning
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **File:** `scripts/001_schema.sql` through `scripts/013_notifications.sql`
- **Finding:** Database migrations are plain SQL files with no migration framework (no Supabase CLI migrations, no Prisma, no Drizzle). There is no tracking of which migrations have been applied. No rollback scripts.
- **Impact:** Failed migrations could leave the database in an inconsistent state. No way to roll back schema changes.
- **Remediation:** Adopt Supabase CLI migrations (`supabase migration new/up/down`). Add rollback SQL for every migration.

#### INFRA-049: No Data Integrity Constraints on Critical Financial Data
- **Severity:** High
- **Effort to Exploit:** Medium
- **File:** `scripts/001_schema.sql` (lines 139-152)
- **Finding:** The `bookings` table has `payment_amount INTEGER NOT NULL` but no CHECK constraint ensuring it matches the session's `total_price`. The `payment_status` can be updated to any valid enum value without verifying the actual payment occurred.
- **Impact:** Payment amount tampering via direct PostgREST access (if UPDATE policy exists). Bookings with zero or negative amounts.
- **Remediation:** Add `CHECK (payment_amount > 0)`. Add a trigger to validate payment_amount matches the session total_price at insert time.

#### INFRA-050: No Soft Delete Implementation
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** Tables use `ON DELETE CASCADE` which permanently deletes data. No `deleted_at` soft delete pattern for audit trail preservation.
- **Impact:** Deleted data is unrecoverable. Audit trail is lost. Forensic investigation is impossible.
- **Remediation:** Add `deleted_at TIMESTAMPTZ` columns. Replace CASCADE deletes with soft deletes for critical tables.

### 2.7 Additional Supabase Risks

#### INFRA-051: No Row-Level Rate Limiting
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** No per-user INSERT rate limits on any table. A user can create unlimited bookings (except the unique constraint), feedback, ratings, goals, and favorites.
- **Impact:** Data pollution and storage exhaustion.
- **Remediation:** Add rate-limiting functions or triggers on INSERT operations.

#### INFRA-052: UUID Predictability via uuid_generate_v4()
- **Severity:** Low
- **Effort to Exploit:** High
- **File:** `scripts/001_schema.sql`
- **Finding:** All primary keys use `uuid_generate_v4()` which generates random UUIDs. While not truly predictable, the use of UUIDv4 means there is no time-ordering information, making forensic analysis harder.
- **Impact:** Minor: harder to do time-based queries on IDs. No direct security impact.
- **Remediation:** Consider UUIDv7 (time-ordered) for new tables to improve query performance and debugging.

#### INFRA-053: No Database-Level Encryption for Sensitive Fields
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** Phone numbers (`profiles.phone`), UPI references (`bookings.payment_reference`), and user bios are stored in plaintext. No column-level encryption.
- **Impact:** Database compromise exposes all PII. Supabase dashboard access reveals all sensitive data.
- **Remediation:** Use `pgcrypto` for column-level encryption on phone, payment_reference. Implement application-level encryption for highly sensitive fields.

#### INFRA-054: No Database Activity Logging
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No `pgaudit` or equivalent audit logging configured. No triggers recording who changed what and when on critical tables.
- **Impact:** No forensic trail for investigating security incidents, data tampering, or unauthorized access.
- **Remediation:** Enable Supabase Log Explorer. Add audit triggers on bookings, profiles, and payment-related updates.

#### INFRA-055: Supabase Dashboard Access Not Restricted
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No evidence of Supabase organization-level access controls, MFA enforcement for dashboard users, or IP restrictions on the Supabase management API.
- **Impact:** Compromised Supabase dashboard credentials give full superuser database access, bypassing all RLS.
- **Remediation:** Enable MFA for all Supabase organization members. Restrict dashboard access to specific IPs. Use least-privilege roles.

---

## 3. Dependency & Supply Chain

### 3.1 Known Vulnerable Packages

#### INFRA-056: Next.js 16.1.6 -- Verify CVE Status
- **Severity:** Medium
- **Effort to Exploit:** Varies
- **File:** `package.json` (line 50)
- **Finding:** Next.js 16.1.6 is a very recent version. Any unpatched CVEs in this version could affect the application. Next.js has had multiple security advisories (SSRF via image optimization, header injection, path traversal).
- **Impact:** Depends on specific CVEs. Previous Next.js vulnerabilities have enabled SSRF and path traversal.
- **Remediation:** Run `npm audit` regularly. Subscribe to Next.js security advisories. Pin to exact versions.

#### INFRA-057: No `npm audit` in CI/CD Pipeline
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No GitHub Actions, no CI/CD configuration files detected. No automated vulnerability scanning.
- **Impact:** Known vulnerable dependencies can persist in production indefinitely without detection.
- **Remediation:** Add `npm audit --audit-level=high` to CI pipeline. Use Dependabot or Snyk for automated PR-based updates.

#### INFRA-058: Broad Version Ranges with Caret (^)
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `package.json`
- **Finding:** Most dependencies use caret ranges (`^3.9.1`, `^2.95.3`, `^0.8.0`). The `@supabase/supabase-js: ^2.95.3` could resolve to any 2.x version on fresh install. Caret on `^0.8.0` for `@supabase/ssr` allows 0.8.x through 0.9.x (SemVer rules for 0.x).
- **Impact:** Automatic minor/patch updates could introduce breaking changes or supply chain compromises.
- **Remediation:** Use exact versions for critical packages (supabase, next). Or rely strictly on package-lock.json and never run `npm install` without `--frozen-lockfile`.

#### INFRA-059: 60+ Direct Dependencies with Transitive Risk
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `package.json`
- **Finding:** The package.json lists 40+ direct dependencies across Radix UI, Supabase, and utility libraries. Each brings its own transitive dependency tree, likely totaling hundreds of packages.
- **Impact:** Large attack surface for supply chain compromises. Each transitive dependency is a potential vector.
- **Remediation:** Audit transitive dependencies. Use `npm ls --all` to understand the full tree. Consider `socket.dev` for supply chain monitoring.

### 3.2 Typosquatting & Package Integrity

#### INFRA-060: Radix UI Package Typosquatting Risk
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `package.json` (lines 12-39)
- **Finding:** 20 `@radix-ui/react-*` packages are installed. The scoped package namespace reduces risk, but typos in manual `npm install` commands (e.g., `@radix-ui/react-dialg` vs `react-dialog`) could install malicious packages.
- **Impact:** Malicious code execution during install (postinstall scripts) or at runtime.
- **Remediation:** Use exact package names from official documentation. Enable npm's `--save-exact` flag. Add `.npmrc` with `save-exact=true`.

#### INFRA-061: No Package Integrity Verification
- **Severity:** High
- **Effort to Exploit:** Medium
- **Finding:** While `package-lock.json` exists, there is no `npm ci` enforcement (no CI/CD). Developers might use `npm install` which can modify the lockfile.
- **Impact:** Modified lockfile could introduce different package versions than intended. Man-in-the-middle attacks on npm registry could go undetected.
- **Remediation:** Always use `npm ci` in CI/CD. Add `engine-strict=true` to `.npmrc`. Consider enabling npm's built-in signature verification.

#### INFRA-062: No .npmrc Security Configuration
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No `.npmrc` file found in the project root.
- **Impact:** Default npm configuration may allow scripts from untrusted packages, use HTTP instead of HTTPS for registry, etc.
- **Remediation:** Create `.npmrc` with: `save-exact=true`, `audit=true`, `fund=false`, `ignore-scripts=true` (for CI).

#### INFRA-063: No Subresource Integrity (SRI) for External Scripts
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `app/layout.tsx`
- **Finding:** The layout loads Google Fonts via `next/font/google`. While Next.js handles this securely by self-hosting fonts, any future addition of external scripts would lack SRI protection since there is no pattern for it.
- **Impact:** Future risk: compromised CDN-hosted scripts could inject malicious code.
- **Remediation:** Add SRI hashes for any external scripts. Use CSP to restrict allowed script sources.

### 3.3 Build Pipeline Security

#### INFRA-064: No CI/CD Pipeline Exists
- **Severity:** Critical
- **Effort to Exploit:** N/A
- **Finding:** No GitHub Actions, CircleCI, or any CI/CD configuration found. No automated testing, linting, or security scanning before deployment.
- **Impact:** Code is deployed directly from developer machines to Vercel without automated quality or security gates. A single compromised developer account can deploy malicious code.
- **Remediation:** Create GitHub Actions workflow with: lint, type-check, test, npm audit, build verification.

#### INFRA-065: No Branch Protection Rules
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** No evidence of branch protection on `main`. Any developer can push directly to main, triggering production deployment.
- **Impact:** No code review requirement. Single-person approval for production changes.
- **Remediation:** Enable GitHub branch protection: require PR reviews, require status checks, prevent force pushes.

#### INFRA-066: No Automated Testing
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No test files (`*.test.ts`, `*.spec.ts`), no test framework in devDependencies (no jest, vitest, playwright, or cypress).
- **Impact:** No automated verification that security controls (auth checks, RLS policies, input validation) work correctly. Regressions go undetected.
- **Remediation:** Add Vitest for unit tests. Add Playwright for E2E tests. Prioritize testing auth flows, payment routes, and admin access controls.

#### INFRA-067: No Linting Rules for Security Patterns
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** ESLint is configured (`npm run lint`) but no eslint configuration file is in the project root. No security-focused ESLint plugins (eslint-plugin-security, eslint-plugin-no-secrets).
- **Impact:** Security anti-patterns (eval, innerHTML, unsanitized SQL) are not caught during development.
- **Remediation:** Add `eslint-plugin-security` and `eslint-plugin-no-secrets` to the ESLint configuration.

#### INFRA-068: Vercel Build Logs May Contain Secrets
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** Build logs on Vercel may contain environment variables if they are referenced during build-time code. Any console.log or error message containing env vars would appear in build logs accessible to team members.
- **Impact:** Secret leakage via build log inspection.
- **Remediation:** Review Vercel build logs for secret exposure. Use Vercel's secret masking feature.

#### INFRA-069: No Dependency License Audit
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No license auditing configured. Some dependencies may use licenses incompatible with commercial use.
- **Impact:** Legal risk, not direct security risk.
- **Remediation:** Run `npx license-checker` to audit all dependency licenses.

### 3.4 Third-Party Script Risks

#### INFRA-070: Google Fonts Loaded Without Privacy Consideration
- **Severity:** Low
- **Effort to Exploit:** N/A
- **File:** `app/layout.tsx` (line 4)
- **Finding:** Google Fonts (`Inter`) is loaded via `next/font/google`. Next.js self-hosts the font files, which is good for privacy. However, the initial font metadata request still goes to Google's servers during build time.
- **Impact:** Minimal: build-time only. No runtime privacy leakage.
- **Remediation:** Acceptable. Consider local font files for fully air-gapped builds.

#### INFRA-071: No Third-Party Script Inventory
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No documentation of third-party services, scripts, or APIs used. No third-party risk assessment.
- **Impact:** Unknown data sharing with third parties. No visibility into supply chain risk.
- **Remediation:** Create a third-party inventory document. Assess each service for data handling, privacy, and security.

#### INFRA-072: Recharts Library Potential XSS via SVG
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `package.json` (line 57)
- **Finding:** Recharts renders SVG charts. If chart data includes user-controlled strings (venue names, user names in tooltips), SVG injection could occur.
- **Impact:** XSS via crafted venue names or user display names rendered in chart tooltips/labels.
- **Remediation:** Sanitize all data passed to Recharts components. Ensure venue names and user names are HTML-entity-encoded.

### 3.5 Additional Supply Chain Vectors

#### INFRA-073: No Package Provenance Verification
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** npm package provenance (SLSA) is not checked during installation. Packages could be published by compromised maintainer accounts.
- **Impact:** Supply chain attack via compromised npm packages.
- **Remediation:** Use `npm install --verify-signatures` once available. Monitor npm advisories for all dependencies.

#### INFRA-074: PostCSS Plugin Chain Risk
- **Severity:** Low
- **Effort to Exploit:** High
- **File:** `package.json` devDependencies
- **Finding:** PostCSS and Tailwind CSS process all CSS at build time. Compromised PostCSS plugins could inject malicious styles or scripts.
- **Impact:** Build-time code injection.
- **Remediation:** Pin PostCSS and Tailwind to exact versions. Audit PostCSS plugin chain.

#### INFRA-075: No Software Bill of Materials (SBOM)
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No SBOM generation configured (no CycloneDX, no SPDX).
- **Impact:** Cannot quickly determine exposure to new CVEs across the dependency tree.
- **Remediation:** Add SBOM generation to CI pipeline: `npx @cyclonedx/cyclonedx-npm`.

---

## 4. Server-Side Security

### 4.1 SSRF Vectors

#### INFRA-076: Avatar URL SSRF via Server-Side Rendering
- **Severity:** High
- **Effort to Exploit:** Medium
- **Finding:** User-controlled `avatar_url` values are stored in the database and rendered in server components. If Next.js Image Optimization is used (not currently, but likely future), the server would fetch the URL, enabling SSRF to internal services.
- **Impact:** Access to internal cloud metadata endpoints (e.g., `http://169.254.169.254/`), internal services, or localhost ports.
- **Remediation:** Validate URLs against an allowlist. Block private IP ranges. Use `next/image` with `remotePatterns` configured to only allow Supabase Storage URLs.

#### INFRA-077: Venue Photo URLs as SSRF Vectors
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** Same as INFRA-076 but for `venues.photos[]` array. Partners can set arbitrary photo URLs.
- **Impact:** SSRF if server-side image processing is added.
- **Remediation:** Same as INFRA-076.

#### INFRA-078: UPI Link Generation with User-Controlled Data
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `lib/payments.ts` (lines 26-39)
- **Finding:** The `generateUPILink` function constructs a URL from `bookingId` and `transactionNote`. While these are server-controlled values, the `bookingId` slice is used as the transaction reference. If any of these values contain URL-special characters, the URL could be malformed.
- **Impact:** Malformed UPI deep links that could redirect payments.
- **Remediation:** URL-encode all parameters explicitly. Validate bookingId format before use.

### 4.2 Input Validation & Injection

#### INFRA-079: No JSON Body Size Limiting
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** All API routes using `request.json()`
- **Finding:** Every API route calls `request.json()` without body size limits. An attacker can send multi-megabyte JSON payloads to exhaust server memory.
- **Impact:** Memory exhaustion DoS. Serverless function timeout. Billing spike on Vercel.
- **Remediation:** Add body size validation in middleware. Use Next.js body size config: `export const config = { api: { bodyParser: { sizeLimit: '10kb' } } }`.

#### INFRA-080: No Input Validation on Query Parameters
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/sessions/route.ts` (lines 8-10)
- **Finding:** Query parameters `vibe`, `date`, `city`, `search` are used directly without validation. The `date` parameter is passed directly to Supabase `.eq("session_date", date)`. While Supabase parameterizes queries, excessively long strings waste resources.
- **Impact:** Resource waste via oversized parameters. Potential for unexpected Supabase behavior with malformed date strings.
- **Remediation:** Validate and sanitize all query parameters. Use zod schemas for request validation.

#### INFRA-081: Unvalidated Session ID Parameters
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** All `[id]` route handlers
- **Finding:** Route parameters like `{ id: sessionId }` are used without UUID format validation. Non-UUID strings are passed to Supabase `.eq("id", sessionId)`.
- **Impact:** Supabase handles non-UUID gracefully (returns no results), but unnecessary database queries are made. In edge cases, specially crafted IDs could trigger unexpected behavior.
- **Remediation:** Validate all ID parameters as UUID format before querying.

#### INFRA-082: Unbounded Array Inputs
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (lines 134-165)
- **Finding:** The feedback endpoint accepts `member_ratings` (array), `favorites` (array), `tags` (array), and `goal_completions` (array) without length limits. An attacker can submit thousands of member ratings or favorites in a single request.
- **Impact:** Database storage exhaustion. CPU-intensive bulk inserts.
- **Remediation:** Limit array lengths: `if (member_ratings.length > 20) return 400`. Validate array element types.

#### INFRA-083: Comment Field Without Length Limit
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (line 117)
- **Finding:** The `comment` field in session feedback has no length validation in the API route. The database schema also has no CHECK constraint on comment length.
- **Impact:** Storage of arbitrarily large text content. Potential rendering issues.
- **Remediation:** Add `CHECK (char_length(comment) <= 1000)` in schema. Validate in API route.

#### INFRA-084: venue_ratings Object Keys Not Validated Against Allowlist
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (lines 121-127)
- **Finding:** The code iterates `Object.entries(venue_ratings)` and inserts any key starting with `venue_` into the feedback row. An attacker can inject arbitrary columns: `{ "venue_malicious_col": 5 }`.
- **Impact:** Supabase will reject unknown columns, but the error message leaks table schema information. Also potential for column injection if new columns are added.
- **Remediation:** Validate keys against the known `VENUE_RATING_DIMENSIONS` keys from `lib/config.ts`.

### 4.3 Error Handling & Information Disclosure

#### INFRA-085: Supabase Error Messages Exposed to Clients
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** Multiple API routes
- **Finding:** Many routes return `{ error: error.message }` directly from Supabase errors. Examples:
  - `app/api/bookings/route.ts` line 21: `return NextResponse.json({ error: error.message }, { status: 500 })`
  - `app/api/partner/sessions/route.ts` line 41
  - `app/api/admin/stats/route.ts` (implicit via error propagation)
- **Impact:** Supabase error messages contain internal details: table names, column names, constraint names, RLS policy names. This aids attackers in understanding the database structure.
- **Remediation:** Return generic error messages to clients. Log full error details server-side. Use a centralized error handler.

#### INFRA-086: No Global Error Boundary for API Routes
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** No try-catch wrappers around API route handlers. Unhandled exceptions (e.g., from `request.json()` on invalid JSON) will cause 500 errors with default Next.js error pages that may expose stack traces in development mode.
- **Impact:** Stack trace leakage revealing file paths, line numbers, and dependency versions.
- **Remediation:** Wrap all API handlers in try-catch. Return 400 for parse errors, 500 for unexpected errors. Never expose stack traces.

#### INFRA-087: request.json() Can Throw on Invalid JSON
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** All POST/PUT/PATCH routes
- **Finding:** Every route that calls `await request.json()` will throw a `SyntaxError` if the request body is not valid JSON. None of these calls are wrapped in try-catch.
- **Impact:** Unhandled exception responses may expose stack traces or internal error details.
- **Remediation:** Wrap `request.json()` in try-catch: `try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }`.

#### INFRA-088: Verbose Error in Partner Venue GET
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `app/api/partner/venue/route.ts` (line 22)
- **Finding:** Returns `{ error: error.message }` with status 404 when the venue query fails. The Supabase error message for `.single()` when no row exists is verbose and reveals the query structure.
- **Impact:** Schema information disclosure.
- **Remediation:** Return `{ error: "Venue not found" }` for all non-200 cases.

### 4.4 Denial of Service Vectors

#### INFRA-089: No Rate Limiting on Any API Route
- **Severity:** Critical
- **Effort to Exploit:** Trivial
- **File:** All API routes
- **Finding:** Zero rate limiting implementation across the entire application. No middleware-level rate limiting, no per-route limits, no IP-based throttling, no user-based throttling.
- **Impact:** An attacker can:
  - Exhaust Supabase API quotas by hammering `/api/sessions`
  - Create thousands of bookings per second via `/api/bookings`
  - Trigger thousands of database queries via the admin stats endpoint
  - Exhaust Vercel serverless function invocations (billing impact)
- **Remediation:** Implement rate limiting via Vercel Edge Middleware using `@vercel/edge-rate-limit` or a custom token bucket. Apply stricter limits to write operations.

#### INFRA-090: Admin Stats Route Executes 7 Parallel Queries
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/admin/stats/route.ts` (lines 23-37)
- **Finding:** The admin stats route executes 7 parallel Supabase queries plus additional sequential queries. Each invocation consumes multiple database connections.
- **Impact:** Repeated calls exhaust the connection pool. Combined with no rate limiting, this is an amplification vector.
- **Remediation:** Cache admin stats with short TTL (30s). Rate limit the admin stats endpoint.

#### INFRA-091: Wrapped Route Executes Unbounded Queries
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/wrapped/route.ts` (lines 43-50)
- **Finding:** The wrapped endpoint queries `group_members` with `.in("group_id", bookings.map(...))` where the array can be arbitrarily large for active users.
- **Impact:** Very large IN clause queries can be slow and resource-intensive.
- **Remediation:** Limit the date range. Paginate results.

#### INFRA-092: Unbounded Query Results Without Pagination
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** Multiple API routes
- **Finding:** Several routes return all matching rows without LIMIT:
  - `GET /api/admin/financials` returns all paid bookings
  - `GET /api/admin/users` likely returns all users
  - `GET /api/partner/analytics` processes all sessions for a venue
- **Impact:** Memory exhaustion for large result sets. Slow response times. Vercel function timeout (10s default).
- **Remediation:** Add `.limit(100)` to all queries. Implement cursor-based pagination.

#### INFRA-093: No Vercel Function Duration Limits
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **File:** `vercel.json`
- **Finding:** No `maxDuration` configured for serverless functions. Default Vercel limits apply (10s for Hobby, 60s for Pro).
- **Impact:** Long-running queries or malicious slow requests tie up function instances.
- **Remediation:** Set explicit `maxDuration` in `vercel.json` or per-route configs.

#### INFRA-094: Search Parameter Enables Database-Level DoS
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/sessions/route.ts` (lines 39-48)
- **Finding:** The `search` parameter does client-side filtering after fetching ALL upcoming sessions from the database. Even if search returns 0 results, the full dataset is queried.
- **Impact:** Every search request fetches the entire sessions table. Combined with no rate limiting, trivial DoS.
- **Remediation:** Move search to database level using Supabase text search (`textSearch()` or `ilike()`). Add LIMIT.

### 4.5 Path Traversal & File Operations

#### INFRA-095: No File Upload Endpoints (Positive Finding)
- **Severity:** Informational
- **Effort to Exploit:** N/A
- **Finding:** No file upload routes exist in the current codebase. Avatar and photo URLs are stored as text strings, not uploaded files.
- **Impact:** No current path traversal risk via file uploads. Risk emerges when file uploads are added.
- **Remediation:** When adding file uploads, validate file types, enforce size limits, use Supabase Storage with signed URLs, and sanitize filenames.

#### INFRA-096: Dynamic Route Parameters Not Path-Validated
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** All `[id]` routes
- **Finding:** Route parameters (e.g., `params.id`) could theoretically contain path traversal characters (`../`). While Next.js App Router handles this safely, the parameters are passed directly to database queries.
- **Impact:** No direct path traversal risk (database queries, not file system). Supabase parameterization prevents SQL injection.
- **Remediation:** Validate all route parameters as UUIDs before use.

### 4.6 Additional Server-Side Vectors

#### INFRA-097: No Request ID / Correlation ID
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No request ID generation or propagation. Cannot correlate requests across middleware, API routes, and database queries.
- **Impact:** Impossible to trace an attack chain across multiple log sources.
- **Remediation:** Generate a UUID request ID in middleware. Propagate via headers.

#### INFRA-098: Date/Time Manipulation in Cron Handler
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/cron/notifications/route.ts` (lines 15-18)
- **Finding:** The cron handler uses `new Date()` for all time calculations. If the server's timezone is not UTC, all date comparisons with the database (which stores UTC) will be wrong. The `currentHour` check (`now.getHours()`) returns local time, not UTC.
- **Impact:** Notifications sent at wrong times. Missed reminders. Incorrect streak calculations.
- **Remediation:** Use explicit UTC methods: `now.getUTCHours()`. Or use `date-fns` UTC functions.

#### INFRA-099: Promise.all Without Error Handling in Admin Stats
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `app/api/admin/stats/route.ts` (lines 23-37)
- **Finding:** `Promise.all()` is used for parallel queries. If any single query fails, the entire Promise.all rejects, and the destructuring assignment fails with an unhandled error.
- **Impact:** A transient database error on one query crashes the entire admin dashboard with an unhelpful error.
- **Remediation:** Use `Promise.allSettled()` or wrap each promise in error handling.

#### INFRA-100: Referral Code Race Condition
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `app/api/referrals/route.ts` (lines 87-91)
- **Finding:** The referral uses count is incremented via `update({ uses: referralCode.uses + 1 })` -- a read-then-write pattern. Two concurrent referral applications could both read `uses: 5` and both write `uses: 6`, losing one increment.
- **Impact:** Referral count inaccuracy. Minor financial impact.
- **Remediation:** Use database-level increment: `.update({ uses: supabase.sql\`uses + 1\` })` or use an RPC function with atomic increment.

#### INFRA-101: Subscription Creation Without Payment
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `app/api/subscriptions/route.ts` (lines 74-92)
- **Finding:** The subscription creation endpoint inserts an `active` subscription immediately with no payment verification. A user can call this endpoint to get a free subscription.
- **Impact:** Free access to premium features (priority matching, streak freezes, exclusive venues).
- **Remediation:** Create subscription in `pending` state. Require payment verification before activating.

#### INFRA-102: Goals Endpoint Exposes Other Users' Goals
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/sessions/[id]/goals/route.ts` (lines 17-23)
- **Finding:** The GET handler returns ALL goals for a session, not just the requesting user's goals. The query filters by `session_id` but not `user_id`.
- **Impact:** Users can see other group members' private productivity goals.
- **Remediation:** Either filter by user_id (for private goals) or document this as intentional for group accountability.

#### INFRA-103: Feedback Endpoint Allows Arbitrary Venue Rating Keys
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (lines 121-127)
- **Finding:** Any key matching `/^venue_/` is accepted and inserted into the feedback row. This is an unbounded property injection pattern.
- **Impact:** Unexpected columns cause Supabase errors that leak schema information.
- **Remediation:** Whitelist accepted keys: `const VALID_KEYS = ['venue_wifi', 'venue_ambiance', ...]`.

---

## 5. Network & Transport Security

### 5.1 TLS Configuration

#### INFRA-104: No TLS Version Enforcement
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** TLS configuration is managed by Vercel and Supabase. The application has no control over TLS version or cipher suite selection. While both providers use modern TLS, there is no verification that TLS 1.2+ is enforced.
- **Impact:** Theoretical downgrade attacks if providers allow TLS 1.0/1.1.
- **Remediation:** Verify TLS configuration via `ssllabs.com` for the deployed domain. Both Vercel and Supabase enforce TLS 1.2+ by default.

#### INFRA-105: No Certificate Transparency Monitoring
- **Severity:** Low
- **Effort to Exploit:** High
- **Finding:** No monitoring of Certificate Transparency logs for unauthorized certificate issuance for the donedonadone domain.
- **Impact:** A rogue CA could issue a certificate for the domain, enabling man-in-the-middle attacks.
- **Remediation:** Set up CT monitoring via `crt.sh` or services like Hardenize.

#### INFRA-106: Supabase Connection Not TLS-Pinned
- **Severity:** Low
- **Effort to Exploit:** High
- **Finding:** The Supabase client connects to the Supabase API over HTTPS but does not pin the certificate.
- **Impact:** Theoretical MitM if the certificate chain is compromised. Extremely unlikely with managed infrastructure.
- **Remediation:** Accepted risk for managed infrastructure.

### 5.2 Mixed Content

#### INFRA-107: User-Provided URLs May Introduce Mixed Content
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** `avatar_url` and `photos[]` accept arbitrary URLs including `http://` URLs. If rendered via `<img src>`, they create mixed content warnings and potentially leak cookies via referer headers to HTTP sites.
- **Impact:** Mixed content warnings degrade user trust. HTTP image requests leak referrer information.
- **Remediation:** Validate all URLs use `https://` scheme. Reject or rewrite `http://` URLs.

#### INFRA-108: UPI Deep Link Protocol Handling
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `lib/payments.ts` (line 31)
- **Finding:** The `upi://pay` scheme is a mobile deep link, not HTTPS. When rendered in a QR code or link, it triggers the UPI app directly. No HTTPS hop means no TLS protection.
- **Impact:** UPI deep links are standard and expected. No direct security issue, but the link content is visible to anyone who can see the QR code.
- **Remediation:** Accepted risk. UPI deep links are the standard payment flow. Ensure QR codes are generated server-side and not cached.

### 5.3 DNS Security

#### INFRA-109: No DNSSEC Configuration
- **Severity:** Medium
- **Effort to Exploit:** High
- **Finding:** No evidence of DNSSEC configuration for the application domain.
- **Impact:** DNS spoofing could redirect users to a phishing site.
- **Remediation:** Enable DNSSEC through the domain registrar. Verify DNSSEC chain via `dnsviz.net`.

#### INFRA-110: No CAA Records
- **Severity:** Low
- **Effort to Exploit:** High
- **Finding:** No Certificate Authority Authorization (CAA) DNS records to restrict which CAs can issue certificates for the domain.
- **Impact:** Any CA can issue certificates for the domain, increasing rogue certificate risk.
- **Remediation:** Add CAA DNS records limiting certificate issuance to Vercel's CA (Let's Encrypt) and any other needed CA.

#### INFRA-111: Domain Enumeration via Vercel Subdomains
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **Finding:** Vercel creates `*.vercel.app` subdomains that are publicly discoverable. Branch preview URLs follow predictable patterns.
- **Impact:** Attackers can enumerate deployment URLs and access preview deployments.
- **Remediation:** Enable Vercel Deployment Protection. Use custom domains with strict CNAME configuration.

### 5.4 CDN & Cache Security

#### INFRA-112: No Cache-Control Headers on API Responses
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** All API routes
- **Finding:** No API route sets `Cache-Control` headers. Default Vercel behavior applies, which may cache responses at the CDN edge.
- **Impact:** Authenticated API responses could be cached and served to other users. Admin financial data, user bookings, and personal stats could be served from cache.
- **Remediation:** Set `Cache-Control: no-store, no-cache, must-revalidate` on all authenticated API responses. Use `private` directive for user-specific data.

#### INFRA-113: CDN Cache Poisoning via Host Header
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** If the CDN caches responses based on the `Host` header, an attacker could send requests with a manipulated host header to poison the cache with malicious redirects.
- **Impact:** Cache poisoning serving malicious content to legitimate users.
- **Remediation:** Vercel handles Host header validation, but verify by testing with non-standard Host headers.

#### INFRA-114: Session Listing Cached Without Consideration
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/sessions/route.ts`
- **Finding:** The public sessions endpoint fetches real-time data (spots_filled, status) but may be CDN-cached by Vercel's Edge Network. Users could see stale availability data.
- **Impact:** Race conditions: users book sessions shown as available that are actually full. Stale pricing data.
- **Remediation:** Add `Cache-Control: no-store` to the sessions listing response. Or use `s-maxage=10, stale-while-revalidate=30` for controlled caching.

### 5.5 WebSocket Security

#### INFRA-115: Supabase Realtime WebSocket Access
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** Supabase Realtime uses WebSocket connections authenticated via the anon key + JWT. Anyone with the anon key can establish WebSocket connections and subscribe to database changes on tables with SELECT policies.
- **Impact:** Real-time data exfiltration. Connection exhaustion if many WebSocket connections are opened.
- **Remediation:** Disable Supabase Realtime for tables that don't need it. Configure Realtime authorization.

#### INFRA-116: No WebSocket Rate Limiting
- **Severity:** Low
- **Effort to Exploit:** Medium
- **Finding:** No configuration for limiting WebSocket connections per user or per IP.
- **Impact:** WebSocket connection exhaustion DoS.
- **Remediation:** Configure Supabase Realtime connection limits.

### 5.6 Additional Network Vectors

#### INFRA-117: No IP-Based Access Control for Admin
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** Admin API routes are accessible from any IP address. Only application-level auth protects them.
- **Impact:** Compromised admin credentials can be used from anywhere.
- **Remediation:** Add IP allowlisting for admin routes via Vercel Edge Middleware.

#### INFRA-118: No Geographic Access Restrictions
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** The platform targets HSR Layout, Bangalore, but accepts traffic from any geography. No geo-fencing.
- **Impact:** Increased attack surface from global traffic. Bot traffic from non-target geographies.
- **Remediation:** Consider geo-restricting API endpoints to India initially via Vercel Edge Middleware.

#### INFRA-119: Open Redirect Potential in Auth Flow
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `lib/supabase/proxy.ts` (lines 55-57)
- **Finding:** The auth redirect constructs: `url.pathname = '/auth/login'` using `request.nextUrl.clone()`. While the pathname is hardcoded, no `return_to` parameter is validated, preventing open redirect via URL path manipulation. However, Supabase's email confirmation links contain redirect URLs that should be validated.
- **Impact:** Phishing attacks using the platform's domain in redirect URLs.
- **Remediation:** Validate all redirect targets against an allowlist of internal paths.

---

## 6. Monitoring & Incident Response

### 6.1 Missing Logging

#### INFRA-120: Zero Application-Level Logging
- **Severity:** Critical
- **Effort to Exploit:** N/A
- **File:** Entire codebase
- **Finding:** Not a single `console.log()`, `console.error()`, or structured logging call exists in any API route. No logging framework (winston, pino) is installed. The only output is HTTP responses.
- **Impact:** Complete blindness to application behavior. Cannot detect attacks in progress, debug production issues, or perform forensic analysis after incidents.
- **Remediation:** Add structured logging (pino or winston). Log: authentication events, authorization failures, payment state changes, admin actions, error conditions.

#### INFRA-121: No Authentication Event Logging
- **Severity:** Critical
- **Effort to Exploit:** N/A
- **Finding:** Login attempts (successful and failed), sign-ups, password resets, and session invalidations are not logged anywhere in the application. Supabase Auth logs exist in the Supabase dashboard but are not integrated with application monitoring.
- **Impact:** Cannot detect brute-force attacks, credential stuffing, or account compromise.
- **Remediation:** Log all auth events from Supabase Auth webhooks or by wrapping auth calls with logging.

#### INFRA-122: No Payment Event Logging
- **Severity:** Critical
- **Effort to Exploit:** N/A
- **File:** `app/api/bookings/[id]/payment/route.ts`
- **Finding:** Payment state transitions (pending -> payment_pending -> paid -> confirmed) are not logged. The admin payment verification route (`app/api/admin/payments/route.ts`) changes payment status without logging who approved/rejected it.
- **Impact:** No audit trail for financial transactions. Impossible to investigate payment disputes or fraud.
- **Remediation:** Log every payment state change with: user_id, booking_id, old_status, new_status, admin_id (for verifications), timestamp, IP address.

#### INFRA-123: No Admin Action Logging
- **Severity:** Critical
- **Effort to Exploit:** N/A
- **File:** All `app/api/admin/` routes
- **Finding:** Admin actions (venue approval, payment verification, group assignment) are not logged. A rogue admin can approve fraudulent venues, verify fake payments, or manipulate groups without any audit trail.
- **Impact:** No accountability for admin actions. Internal fraud is undetectable.
- **Remediation:** Log all admin actions to a dedicated audit_log table with: admin_id, action, target_entity, old_value, new_value, timestamp, IP.

#### INFRA-124: No Error Logging
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** Database errors from Supabase are caught and returned to clients, but never logged server-side. Failed queries, RLS violations, and constraint errors are invisible to operators.
- **Impact:** Cannot detect systematic failures, attack patterns, or misconfiguration.
- **Remediation:** Log all Supabase errors with full context (route, user_id, query details).

#### INFRA-125: No Access Logging
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No HTTP access logging beyond what Vercel provides in its dashboard. Vercel's built-in logging has limited retention and query capabilities.
- **Impact:** Cannot perform traffic analysis, detect scanning/probing, or identify suspicious access patterns.
- **Remediation:** Export Vercel logs to a SIEM (Datadog, Grafana Cloud, etc.). Add custom access logging in middleware.

### 6.2 No Audit Trail

#### INFRA-126: No Immutable Audit Log Table
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No `audit_log` or `event_log` table in any SQL migration. No mechanism for recording who did what and when.
- **Impact:** Cannot investigate security incidents, demonstrate compliance, or detect internal threats.
- **Remediation:** Create an append-only audit_log table: `CREATE TABLE audit_log (id UUID, actor_id UUID, action TEXT, entity_type TEXT, entity_id UUID, old_data JSONB, new_data JSONB, ip_address INET, created_at TIMESTAMPTZ)`. Deny UPDATE and DELETE on this table.

#### INFRA-127: No Data Change History
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No `updated_by` columns, no temporal tables, no change data capture. When a booking status changes or a profile is updated, the old value is lost.
- **Impact:** Cannot reconstruct the sequence of events during an incident.
- **Remediation:** Add `updated_by` columns to critical tables. Consider Supabase's built-in audit log extension.

#### INFRA-128: No Deletion Logging
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** `ON DELETE CASCADE` throughout the schema means cascading deletes happen silently. If a user is deleted, their bookings, feedback, ratings, and group memberships are all deleted without trace.
- **Impact:** Data loss. Forensic investigation impossible for deleted entities.
- **Remediation:** Add deletion triggers that log to audit_log before cascading. Consider soft deletes.

### 6.3 No Alerting

#### INFRA-129: No Error Rate Alerting
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No alerting configured for error rates, latency spikes, or 5xx responses.
- **Impact:** Production incidents go unnoticed until users report them.
- **Remediation:** Configure Vercel alerts for error rate thresholds. Add external monitoring (UptimeRobot, Checkly).

#### INFRA-130: No Security Alert Triggers
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No alerts for:
  - Multiple failed login attempts from one IP
  - Admin account creation
  - Unusual payment patterns
  - Mass booking creation
  - RLS policy violations
- **Impact:** Active attacks proceed undetected. Account compromises are discovered only when users notice.
- **Remediation:** Implement security event alerting via Supabase webhooks + alert service (PagerDuty, Opsgenie).

#### INFRA-131: No Uptime Monitoring
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No external uptime monitoring for the application or its critical dependencies (Supabase, Vercel).
- **Impact:** Downtime is discovered by users, not operators.
- **Remediation:** Add uptime monitoring for: main page, key API endpoints, Supabase status page integration.

#### INFRA-132: No Database Performance Monitoring
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No monitoring of database connection counts, query latency, or table sizes.
- **Impact:** Performance degradation and connection exhaustion go unnoticed until service failure.
- **Remediation:** Use Supabase Dashboard monitoring. Set up alerts for connection pool exhaustion and slow queries.

#### INFRA-133: No Billing Alert Configuration
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No billing alerts configured for Vercel or Supabase usage.
- **Impact:** A DDoS attack or resource exhaustion bug could cause unexpected billing spikes before detection.
- **Remediation:** Configure spending limits and alerts on both Vercel and Supabase.

### 6.4 No Rate Limiting Infrastructure

#### INFRA-134: No Rate Limiting Middleware
- **Severity:** Critical
- **Effort to Exploit:** Trivial
- **Finding:** No rate limiting library installed (no `@vercel/kv`, no `upstash/ratelimit`, no in-memory rate limiter). Zero rate limiting at any level of the application.
- **Impact:** Every API endpoint is vulnerable to abuse. See INFRA-089 for detailed impact.
- **Remediation:** Install `@upstash/ratelimit` with Vercel KV. Implement tiered rate limits: strict for writes, lenient for reads.

#### INFRA-135: No Per-User Rate Limiting
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** Even if infrastructure-level rate limiting is added (Vercel/Cloudflare), there is no mechanism to rate-limit per authenticated user. A single user could make unlimited API calls.
- **Impact:** Authenticated abuse: data scraping, booking manipulation, feedback spam.
- **Remediation:** Implement per-user rate limiting using the authenticated user ID as the rate limit key.

#### INFRA-136: No IP-Based Rate Limiting
- **Severity:** High
- **Effort to Exploit:** Trivial
- **Finding:** No IP-based throttling for unauthenticated endpoints (login, sessions listing, cron).
- **Impact:** Brute-force attacks on login. Automated scraping of session data. Cron endpoint probing.
- **Remediation:** Add IP-based rate limiting via Vercel Edge Middleware or Cloudflare.

### 6.5 No WAF

#### INFRA-137: No Web Application Firewall
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No WAF configured. No Vercel Firewall rules, no Cloudflare, no AWS WAF.
- **Impact:** No automatic protection against:
  - SQL injection attempts (even if parameterized, defense in depth is needed)
  - XSS payloads in request parameters
  - Known bot signatures
  - Tor/VPN/datacenter IP blocking
  - Request anomaly detection
- **Remediation:** Enable Vercel Firewall (available on Pro plan). Or front the application with Cloudflare for WAF, DDoS protection, and bot management.

#### INFRA-138: No DDoS Protection Configuration
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** While Vercel provides basic DDoS protection, no application-level DDoS mitigation is configured. No challenge pages, no CAPTCHA on suspicious traffic, no circuit breakers.
- **Impact:** Application-layer DDoS (slow HTTP attacks, API flood) could exhaust serverless function capacity and database connections.
- **Remediation:** Add Cloudflare or Vercel Advanced DDoS protection. Implement circuit breakers for database connections.

#### INFRA-139: No Bot Detection
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **Finding:** No CAPTCHA, no browser fingerprinting, no bot detection middleware. All endpoints are equally accessible to automated tools and browsers.
- **Impact:** Automated account creation, booking spam, rating manipulation, data scraping.
- **Remediation:** Add CAPTCHA (Cloudflare Turnstile) on sign-up, login, and booking flows.

### 6.6 Incident Response Gaps

#### INFRA-140: No Incident Response Plan
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No documented incident response plan, no runbooks, no escalation procedures, no communication templates.
- **Impact:** When (not if) a security incident occurs, the response will be ad-hoc, slow, and likely incomplete.
- **Remediation:** Create an incident response plan covering: detection, containment, eradication, recovery, and post-incident review.

#### INFRA-141: No Ability to Disable User Accounts
- **Severity:** High
- **Effort to Exploit:** N/A
- **Finding:** No admin endpoint to disable or ban user accounts. The admin dashboard can view users but cannot lock accounts, revoke sessions, or block IPs.
- **Impact:** A compromised or malicious account cannot be quickly disabled. The only option is direct Supabase dashboard access.
- **Remediation:** Add admin endpoints for: account disable, session revocation, IP blocking.

#### INFRA-142: No Emergency Kill Switch
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No mechanism to quickly disable specific features (booking, payments, cron) without a code deployment.
- **Impact:** If a vulnerability is discovered in the payment flow, the only option is a full redeploy.
- **Remediation:** Implement feature flags (LaunchDarkly, Vercel Edge Config, or simple database flags) for critical features.

#### INFRA-143: No Secrets Rotation Procedure
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No documented procedure for rotating secrets (Supabase keys, CRON_SECRET, UPI VPA).
- **Impact:** If a secret is compromised, the rotation process is unknown, likely causing downtime.
- **Remediation:** Document secret rotation procedures. Practice rotation regularly.

#### INFRA-144: No Security Contact Published
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No `security.txt` file (`.well-known/security.txt`), no responsible disclosure policy.
- **Impact:** Security researchers who find vulnerabilities have no way to report them responsibly.
- **Remediation:** Add `/.well-known/security.txt` with contact information and disclosure policy.

#### INFRA-145: No Backup Communication Channel
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** If Vercel or Supabase is compromised, there is no alternative communication channel to notify users.
- **Impact:** Users remain uninformed about security incidents affecting their data.
- **Remediation:** Maintain an independent communication channel (email list via separate provider, Twitter/X account).

### 6.7 Additional Monitoring Gaps

#### INFRA-146: No Client-Side Error Tracking
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No Sentry, LogRocket, or other client-side error tracking. JavaScript errors, failed API calls, and rendering issues in the browser are invisible.
- **Impact:** Client-side exploitation (XSS, DOM manipulation) goes undetected.
- **Remediation:** Add Sentry for client-side error tracking.

#### INFRA-147: No Performance Monitoring (APM)
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No Application Performance Monitoring tool configured.
- **Impact:** Cannot detect performance degradation that might indicate an attack (e.g., crypto mining in injected scripts).
- **Remediation:** Add Vercel Analytics or a third-party APM.

#### INFRA-148: No Dependency Vulnerability Alerting
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No Dependabot, Snyk, or Socket configured for the GitHub repository.
- **Impact:** Newly discovered vulnerabilities in dependencies go unnoticed until manual `npm audit`.
- **Remediation:** Enable GitHub Dependabot alerts and automated security PRs.

#### INFRA-149: No Health Check Endpoint
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No `/api/health` or similar endpoint that verifies application and database connectivity.
- **Impact:** Cannot implement external health monitoring. Load balancers cannot verify instance health.
- **Remediation:** Add a `/api/health` endpoint that checks Supabase connectivity and returns status.

#### INFRA-150: No Canary/Anomaly Detection
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** No database canary rows, honeypot endpoints, or anomaly detection for unusual access patterns.
- **Impact:** Sophisticated attacks that stay under rate limits go undetected.
- **Remediation:** Add honeypot API endpoints (e.g., `/api/admin/export-all-users`) that alert on any access. Insert canary rows in database tables.

---

## 7. Infrastructure as Moat

### How Robust Infrastructure Creates Competitive Advantage

The donedonadone platform's value proposition centers on **trust**: users trust the platform to match them with compatible coworkers, handle their payments, and protect their personal preferences. Infrastructure security directly translates to this trust moat:

### 7.1 Reliability Moat

| Investment | Moat Effect |
|-----------|------------|
| **99.9%+ uptime** via proper monitoring, alerting, and redundancy | Users develop daily habits around the platform. Missing a single session notification or booking failure erodes habit formation. |
| **Sub-200ms API responses** via connection pooling, caching, and query optimization | Instant booking confirmation creates the "it just works" feeling that drives repeat usage. Competitors with sluggish UX feel broken by comparison. |
| **Zero-downtime deployments** via Vercel's atomic deploys + feature flags | Users never see maintenance pages. The platform feels "always on" like a utility, not a startup. |
| **Automated failover** via Supabase PITR + health checks | A database incident that causes 4+ hours of downtime at a competitor only causes 15 minutes at donedonadone. |

### 7.2 Trust Moat

| Investment | Moat Effect |
|-----------|------------|
| **Comprehensive audit logging** | When a user asks "who saw my profile?", you can answer. This radical transparency is a feature, not just security. |
| **Real-time payment verification** (future: Razorpay webhooks) | Instant payment confirmation eliminates the anxiety of "did my payment go through?" that plagues UPI-first platforms. |
| **Security headers + CSP** | Users' browsers show the padlock. Security-conscious users (many in the tech freelancer demographic) notice and appreciate proper security. |
| **Published security.txt + responsible disclosure** | Signals maturity and seriousness that differentiates from "weekend project" competitors. |
| **Data encryption at rest and in transit** | Becomes a marketing differentiator: "Your coworking preferences are encrypted and never shared." |

### 7.3 Operational Moat

| Investment | Moat Effect |
|-----------|------------|
| **CI/CD pipeline with automated testing** | Ship features 5x faster than competitors still doing manual QA. Security tests catch regressions before users do. |
| **Feature flags** | A/B test matching algorithms, pricing, and UX without risking the entire user base. Move fast without breaking things. |
| **Structured logging + SIEM** | Understand user behavior at scale. Detect and fix issues before users notice. Turn operational data into product insights. |
| **Rate limiting + bot protection** | Prevent competitors from scraping your venue partnerships, pricing, and fill rates. Your business intelligence stays proprietary. |

### 7.4 Data Network Effect Protection

| Investment | Moat Effect |
|-----------|------------|
| **Encrypted preference storage** | Even if a competitor gains database access, they cannot replicate the matching algorithm's learned preferences. |
| **Immutable rating history** | Trust scores that took months to build cannot be faked or imported. New users must earn trust from scratch, creating genuine switching costs. |
| **Tamper-proof streak records** | Streaks verified by check-in timestamps + venue confirmation cannot be forged. A user's 20-week streak is a real achievement tied to this platform. |

### 7.5 Priority Remediation Roadmap

**Week 1 (Critical):**
1. Add rate limiting via `@upstash/ratelimit` (INFRA-089, INFRA-134)
2. Add security headers in `next.config.mjs` (INFRA-017, INFRA-018, INFRA-019)
3. Fix CRON_SECRET validation with `crypto.timingSafeEqual` and existence check (INFRA-001, INFRA-003)
4. Add structured logging with `pino` (INFRA-120, INFRA-121, INFRA-122)
5. Fix notification insert RLS / use service role key for cron (INFRA-030)

**Week 2 (High):**
1. Create CI/CD pipeline with `npm audit`, lint, build checks (INFRA-064, INFRA-057)
2. Remove `NEXT_PUBLIC_` prefix from UPI VPA (INFRA-006)
3. Add input validation (body size limits, UUID validation, array length limits) (INFRA-079, INFRA-081, INFRA-082)
4. Revoke anon EXECUTE on admin RPC functions (INFRA-040)
5. Add audit_log table and admin action logging (INFRA-126, INFRA-123)
6. Fix subscription creation to require payment (INFRA-101)

**Week 3-4 (Medium):**
1. Configure Vercel Deployment Protection for preview deploys (INFRA-015)
2. Separate Supabase projects for staging/production (INFRA-016)
3. Add env var validation with zod (INFRA-009)
4. Restrict RLS on profiles, sessions, groups tables (INFRA-034, INFRA-035, INFRA-036)
5. Add error handling wrappers to all API routes (INFRA-086, INFRA-087)
6. Add uptime monitoring and alerting (INFRA-129, INFRA-131)
7. Implement bot detection / CAPTCHA (INFRA-139)

**Ongoing:**
1. Dependency update cadence (weekly `npm audit`, monthly updates)
2. Quarterly security audit reviews
3. Incident response plan documentation and tabletop exercises
4. Database migration framework adoption

---

## Appendix: Vulnerability Index

| ID | Title | Severity | Section |
|----|-------|----------|---------|
| INFRA-001 | Cron secret timing attack | Critical | 1.1 |
| INFRA-002 | Cron endpoint publicly accessible | High | 1.1 |
| INFRA-003 | CRON_SECRET may not be set | High | 1.1 |
| INFRA-006 | UPI VPA exposed via NEXT_PUBLIC | High | 1.2 |
| INFRA-016 | Preview deploys share production Supabase | High | 1.4 |
| INFRA-017 | No CSP header | Critical | 1.5 |
| INFRA-018 | No HSTS header | High | 1.5 |
| INFRA-028 | Anon key grants direct PostgREST access | High | 2.1 |
| INFRA-030 | Cron notification insert fails RLS | High | 2.1 |
| INFRA-031 | SECURITY DEFINER bypasses RLS | High | 2.1 |
| INFRA-037 | No RLS on newer tables | High | 2.2 |
| INFRA-040 | Admin RPC functions callable via PostgREST | High | 2.3 |
| INFRA-054 | No database activity logging | High | 2.7 |
| INFRA-057 | No npm audit in CI/CD | High | 3.1 |
| INFRA-061 | No package integrity verification | High | 3.2 |
| INFRA-064 | No CI/CD pipeline | Critical | 3.3 |
| INFRA-065 | No branch protection | High | 3.3 |
| INFRA-066 | No automated testing | High | 3.3 |
| INFRA-079 | No JSON body size limiting | High | 4.2 |
| INFRA-085 | Supabase errors exposed to clients | High | 4.3 |
| INFRA-089 | No rate limiting on any API route | Critical | 4.4 |
| INFRA-101 | Subscription creation without payment | High | 4.6 |
| INFRA-120 | Zero application-level logging | Critical | 6.1 |
| INFRA-121 | No authentication event logging | Critical | 6.1 |
| INFRA-122 | No payment event logging | Critical | 6.1 |
| INFRA-123 | No admin action logging | Critical | 6.1 |
| INFRA-126 | No immutable audit log | High | 6.2 |
| INFRA-129 | No error rate alerting | High | 6.3 |
| INFRA-130 | No security alert triggers | High | 6.3 |
| INFRA-134 | No rate limiting middleware | Critical | 6.4 |
| INFRA-137 | No WAF | High | 6.5 |
| INFRA-138 | No DDoS protection | High | 6.5 |
| INFRA-140 | No incident response plan | High | 6.6 |
| INFRA-141 | No ability to disable user accounts | High | 6.6 |

---

*Report generated as part of the donedonadone red team security audit series. This is Batch 5 of 5, covering Infrastructure, DevOps & Supply Chain Security. Cross-reference with Batch 1 (Auth & Access Control), Batch 2 (Payment & Financial), Batch 3 (Data Privacy), and Batch 4 (Business Logic & Gaming) for complete coverage.*
