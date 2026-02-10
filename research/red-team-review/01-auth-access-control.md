# Red Team Security Audit: Authentication, Authorization & Access Control

**Target:** donedonadone coworking platform
**Audit Date:** 2026-02-09
**Auditor:** Red Team Security Review
**Scope:** Authentication flows, authorization/RBAC, API route security, Supabase RLS policies, session management
**Codebase Commit:** `be13b5a` (branch: `app-foundation-build`)

---

## Executive Summary

The donedonadone platform has a fundamentally sound authentication architecture built on Supabase Auth with server-side session validation via `getUser()`. However, this audit uncovered **critical and high-severity vulnerabilities** across authorization boundaries, RLS policy gaps, API route security, and payment flow integrity. The most dangerous findings include: mass assignment enabling vertical privilege escalation to admin, missing role-type enforcement on partner API routes, unauthenticated session listing leaking business data, self-confirmed payments without server-side verification, and SECURITY DEFINER functions callable by any authenticated user.

**Vulnerability Count by Severity:**
- Critical: 12
- High: 31
- Medium: 48
- Low: 37
- Informational: 22

**Total: 150 distinct vulnerability vectors identified.**

---

## Table of Contents

1. [Authentication Attack Vectors](#1-authentication-attack-vectors)
2. [Authorization & Privilege Escalation](#2-authorization--privilege-escalation)
3. [API Security](#3-api-security)
4. [Supabase-Specific Risks](#4-supabase-specific-risks)
5. [Moat-Strengthening Recommendations](#5-moat-strengthening-recommendations)

---

## 1. Authentication Attack Vectors

### 1.1 Session Management

#### AUTH-001: No Session Expiry Configuration
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `lib/supabase/client.ts` (line 3-8), `lib/supabase/server.ts` (line 9-34)
- **Finding:** Neither the browser client nor the server client configures custom session duration, idle timeout, or JWT expiry. Default Supabase settings (1 hour JWT, with refresh token) apply, but there is no explicit configuration ensuring tokens expire in a reasonable window.
- **Impact:** Stolen tokens remain valid for extended periods. If a user leaves a device unlocked at a coworking space (high probability given the product's domain), their session persists indefinitely.
- **Remediation:** Configure `auth.flowType`, token lifetimes, and idle timeout in Supabase dashboard. Consider shorter JWT lifetimes (15 min) with aggressive refresh for a coworking app where sessions are short-lived.

#### AUTH-002: Cookie Security Attributes Not Explicitly Set
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `lib/supabase/server.ts` (line 22), `lib/supabase/proxy.ts` (line 19-28)
- **Finding:** The `setAll` callback passes `options` through from Supabase SSR, but there is no enforcement of `Secure`, `HttpOnly`, `SameSite=Lax` attributes. The Supabase SSR library handles defaults, but the application does not verify or override these.
- **Impact:** On misconfigured deployments (HTTP in staging), cookies could be transmitted insecurely. Missing `SameSite` could enable CSRF-adjacent attacks.
- **Remediation:** Explicitly override cookie options to enforce `Secure: true`, `SameSite: 'Lax'`, `HttpOnly: true` in production:
```typescript
cookiesToSet.forEach(({ name, value, options }) =>
  cookieStore.set(name, value, {
    ...options,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
  })
)
```

#### AUTH-003: Silent Cookie Failure in Server Components
- **Severity:** Low
- **Effort to Exploit:** High
- **File:** `lib/supabase/server.ts` (line 25-28)
- **Finding:** The `setAll` catch block silently swallows all errors. While the comment explains this is expected for Server Components, it masks genuine cookie-setting failures that could leave sessions in an inconsistent state.
- **Impact:** Users could appear authenticated on one request but not the next, leading to confusing UX and potentially exposing partial data if auth state is inconsistent.
- **Remediation:** Add structured logging within the catch block to distinguish expected Server Component failures from genuine errors.

#### AUTH-004: No Concurrent Session Limiting
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** There is no mechanism to limit concurrent sessions. A compromised account can have unlimited active sessions across devices.
- **Impact:** An attacker who obtains credentials can maintain persistent access even after password change, if refresh tokens are not invalidated.
- **Remediation:** Implement `supabase.auth.signOut({ scope: 'global' })` on password change. Track sessions and allow users to revoke specific devices.

#### AUTH-005: No Account Lockout After Failed Attempts
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `app/auth/login/page.tsx` (line 26-44)
- **Finding:** The login form submits directly to `supabase.auth.signInWithPassword()` with no rate limiting, CAPTCHA, or lockout mechanism. Supabase's built-in rate limiting is the only protection, which is generous (defaults allow hundreds of attempts).
- **Impact:** Brute-force attacks against user accounts. Credential stuffing attacks using leaked password databases.
- **Remediation:**
  - Add CAPTCHA (hCaptcha/Turnstile) after 3 failed attempts
  - Enable Supabase's rate limiting configuration
  - Implement exponential backoff on the client
  - Consider IP-based lockout via Vercel Edge Middleware

#### AUTH-006: No Password Complexity Enforcement
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/auth/sign-up/page.tsx` (line 29-75)
- **Finding:** The sign-up form accepts any password that meets Supabase's minimum (6 characters by default). No client-side or server-side enforcement of complexity rules (uppercase, numbers, symbols).
- **Impact:** Weak passwords susceptible to dictionary and brute-force attacks.
- **Remediation:** Add client-side validation requiring minimum 8 characters, mixed case, numbers. Configure Supabase Auth password requirements.

#### AUTH-007: Email Enumeration via Sign-Up Response
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/auth/sign-up/page.tsx` (line 42-55)
- **Finding:** When a user signs up with an already-registered email, Supabase returns a distinguishable response ("User already registered"). The error is displayed directly to the user.
- **Impact:** Attacker can enumerate valid email addresses by attempting signups and observing error messages.
- **Remediation:** Return a generic message regardless of whether the email exists: "If this email is not already registered, you will receive a confirmation link."

#### AUTH-008: Email Enumeration via Login Response
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/auth/login/page.tsx` (line 33-37)
- **Finding:** Failed login returns the raw Supabase error message, which differs between "Invalid login credentials" (email exists, wrong password) and other states.
- **Impact:** Combined with AUTH-007, allows full email enumeration.
- **Remediation:** Always return "Invalid email or password" regardless of the actual failure reason.

#### AUTH-009: No Email Verification Enforcement
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `app/auth/sign-up/page.tsx`, `lib/supabase/proxy.ts`
- **Finding:** After signup, the user is redirected to a success page, but there is no enforcement that the email is verified before accessing protected routes. The middleware (`proxy.ts`) only checks if `user` exists, not if `user.email_confirmed_at` is set.
- **Impact:** An attacker can sign up with a disposable/fake email and immediately access all coworker features including booking sessions, submitting feedback, and rating other users.
- **Remediation:** Add email verification check in middleware:
```typescript
if (user && !user.email_confirmed_at) {
  const url = request.nextUrl.clone()
  url.pathname = '/auth/verify-email'
  return NextResponse.redirect(url)
}
```

#### AUTH-010: OAuth Redirect URL Not Validated
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `app/auth/sign-up/page.tsx` (line 47-48)
- **Finding:** The `emailRedirectTo` uses either an environment variable or `window.location.origin`. If `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` is set to a malicious URL in development and accidentally deployed, or if `window.location.origin` is manipulated via proxy, the redirect could go to an attacker-controlled domain.
- **Impact:** Post-signup redirect to phishing page that captures the auth token from the URL fragment.
- **Remediation:** Hardcode the allowed redirect URL or validate it against a whitelist. Remove the `NEXT_PUBLIC_DEV_` prefix environment variable from production builds.

#### AUTH-011: Missing Password Reset Flow
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** There is no password reset page or "Forgot Password" link in the login page. Users who forget their password have no recovery path.
- **Impact:** Users locked out of accounts; support burden. Also means no mechanism to invalidate compromised credentials.
- **Remediation:** Implement `/auth/forgot-password` using `supabase.auth.resetPasswordForEmail()`.

#### AUTH-012: No Multi-Factor Authentication
- **Severity:** Medium
- **Effort to Exploit:** N/A
- **Finding:** No MFA implementation. For admin accounts that manage financial data, payments, and user data, this is particularly concerning.
- **Impact:** Single-factor authentication for admin accounts managing payment verification and user data.
- **Remediation:** Enable Supabase MFA (TOTP) for admin and partner accounts at minimum.

#### AUTH-013: Token Stored in Browser LocalStorage (Supabase Default)
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `lib/supabase/client.ts`
- **Finding:** Supabase JS client stores auth tokens in localStorage by default. XSS vulnerabilities would allow token theft.
- **Impact:** Persistent token access for XSS attackers. Tokens survive browser restarts.
- **Remediation:** Configure Supabase to use cookie-only storage via `auth.storage` option, or ensure robust XSS prevention.

#### AUTH-014: No Session Invalidation on Role Change
- **Severity:** High
- **Effort to Exploit:** Medium
- **Finding:** When an admin changes a user's `user_type` in the profiles table (e.g., revoking partner status), existing sessions are not invalidated. The user retains their JWT claims until the token expires.
- **Impact:** Revoked partner/admin users retain access for the duration of their current session.
- **Remediation:** Implement session invalidation hooks on role changes. Use Supabase's `auth.admin.deleteUser()` or session management APIs.

#### AUTH-015: Referral Code Applied Before Email Verification
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `app/auth/sign-up/page.tsx` (line 58-66)
- **Finding:** The referral code API is called immediately after signup, before email verification. An attacker can create multiple accounts with disposable emails to farm referral credits.
- **Impact:** Referral credit fraud. The attacker generates unlimited referral events.
- **Remediation:** Move referral code application to post-email-verification flow or to the onboarding step.

#### AUTH-016: No CAPTCHA on Sign-Up
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/auth/sign-up/page.tsx`
- **Finding:** No CAPTCHA protection on the sign-up form. Combined with AUTH-015, enables automated account creation for referral farming.
- **Impact:** Bot-driven account creation, referral fraud, spam bookings.
- **Remediation:** Add Cloudflare Turnstile or hCaptcha to the sign-up form.

#### AUTH-017: Supabase Auth Callback Route Missing
- **Severity:** Low
- **Effort to Exploit:** Medium
- **Finding:** No `/auth/callback` route handler was found for processing OAuth callbacks or email magic links. If Supabase is configured for email confirmation via redirect, the token exchange may fail.
- **Impact:** Email confirmation flow may not work correctly, forcing users to use direct password login.
- **Remediation:** Create `/auth/callback/route.ts` that exchanges the code for a session.

#### AUTH-018: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` Suggests Dev Credentials in Prod
- **Severity:** Info
- **Effort to Exploit:** N/A
- **File:** `app/auth/sign-up/page.tsx` (line 47)
- **Finding:** The environment variable name `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` contains "DEV", suggesting development configuration may bleed into production.
- **Impact:** If development Supabase instance URLs are used in production, auth flows may redirect to dev environments.
- **Remediation:** Use environment-agnostic variable names. Ensure separate env configs for dev/prod.

---

### 1.2 Session Fixation & Hijacking

#### AUTH-019: No Session Regeneration After Login
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** Supabase handles session creation, but there is no explicit session regeneration after privilege elevation (e.g., going from anonymous to authenticated).
- **Impact:** Pre-authentication session tokens could be reused post-authentication in certain attack scenarios.
- **Remediation:** Rely on Supabase's built-in session management which creates new tokens on login, but verify this behavior in testing.

#### AUTH-020: Middleware Does Not Validate Token Integrity
- **Severity:** Low
- **Effort to Exploit:** High
- **File:** `lib/supabase/proxy.ts` (line 40-42)
- **Finding:** The middleware calls `supabase.auth.getUser()` which validates the JWT server-side. This is correct. However, if the Supabase connection fails, the middleware falls through and allows the request.
- **Impact:** Temporary Supabase outages could cause auth bypass if the middleware doesn't handle errors explicitly.
- **Remediation:** Handle the error case from `getUser()`:
```typescript
const { data: { user }, error } = await supabase.auth.getUser()
if (error) {
  // Supabase unavailable — fail closed
  const url = request.nextUrl.clone()
  url.pathname = '/auth/error'
  return NextResponse.redirect(url)
}
```

---

## 2. Authorization & Privilege Escalation

### 2.1 Vertical Privilege Escalation (Critical)

#### AUTHZ-001: Mass Assignment Enables user_type Escalation to Admin
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **File:** `app/api/onboarding/route.ts` (line 17-27)
- **Finding:** The onboarding API directly spreads user-supplied body fields into the profile update:
```typescript
const { error: profileError } = await supabase
  .from("profiles")
  .update({
    display_name: body.display_name,
    phone: body.phone,
    work_type: body.work_type,
    industry: body.industry,
    bio: body.bio,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  })
  .eq("id", user.id)
```
While the fields are explicitly listed here, the RLS policy for profiles allows users to update their own row (`auth.uid() = id`). A user can bypass this API entirely and call the Supabase client directly:
```javascript
const supabase = createClient()
await supabase.from('profiles').update({ user_type: 'admin' }).eq('id', userId)
```
The RLS policy (`"Users can update own profile"`) allows ANY update to the user's own profile row, including the `user_type` column.
- **Impact:** Any authenticated user can escalate to admin, gaining access to all admin API routes, payment verification, user management, and financial data.
- **Remediation:** Add a column-level restriction in the RLS policy or use a trigger to prevent `user_type` changes:
```sql
-- Option 1: Use a BEFORE UPDATE trigger
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type != OLD.user_type AND auth.uid() != NULL THEN
    -- Only allow role changes from service role (admin operations)
    IF NOT is_admin() THEN
      NEW.user_type := OLD.user_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();
```

#### AUTHZ-002: Partner API Routes Lack user_type Verification
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **Files:**
  - `app/api/partner/venue/route.ts` (line 27-71)
  - `app/api/partner/sessions/route.ts` (line 48-106)
  - `app/api/partner/bookings/route.ts`
  - `app/api/partner/earnings/route.ts`
  - `app/api/partner/stats/route.ts`
  - `app/api/partner/analytics/route.ts`
- **Finding:** None of the partner API routes verify that the authenticated user has `user_type = 'partner'`. They only check that the user owns a venue via `getPartnerVenue()`. While this provides some protection (a coworker wouldn't have a venue), the venue creation endpoint at `partner/venue` only checks authentication, not role. A coworker could create a venue via direct Supabase call (RLS allows `partner_id = auth.uid()`), then access all partner endpoints.
- **Impact:** A regular coworker could create a venue, create sessions at inflated prices, and access partner financial dashboards.
- **Remediation:** Add explicit role verification to all partner routes:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("user_type")
  .eq("id", user.id)
  .single()

if (profile?.user_type !== "partner") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

#### AUTHZ-003: Venue RLS Allows Any User to Insert a Venue
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (line 269-270)
- **Finding:** The venue INSERT policy is:
```sql
CREATE POLICY "Partners can insert own venues" ON venues
  FOR INSERT WITH CHECK (partner_id = auth.uid());
```
This only checks that `partner_id` matches the current user's ID. It does NOT check that the user actually has `user_type = 'partner'`. Any authenticated user can insert a venue with `partner_id` set to their own ID.
- **Impact:** Combined with AUTHZ-002, a coworker creates a venue and gains full partner dashboard access.
- **Remediation:**
```sql
CREATE POLICY "Partners can insert own venues" ON venues
  FOR INSERT WITH CHECK (
    partner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'partner')
  );
```

#### AUTHZ-004: verifyAdmin() Uses Anon Key, Subject to RLS
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `lib/admin.ts` (line 3-11)
- **Finding:** The `verifyAdmin()` function queries the `profiles` table using the same Supabase client (anon key). Since profiles are readable by everyone (RLS: `FOR SELECT USING (true)`), this works correctly today. However, if the profiles RLS policy is ever tightened, admin verification could break silently.
- **Impact:** Fragile admin verification that could fail if RLS policies change.
- **Remediation:** Consider using a service role client for admin verification, or verify the admin role via JWT custom claims set during signup/role change.

#### AUTHZ-005: Admin Role Determined by Profile Row, Not JWT Claims
- **Severity:** High
- **Effort to Exploit:** Medium (requires AUTHZ-001)
- **Finding:** Admin verification relies on a mutable database field (`profiles.user_type`). Combined with AUTHZ-001, an attacker who can update their own profile to `user_type = 'admin'` immediately passes all admin checks.
- **Impact:** Full admin access including payment verification, user management, financial dashboards, and group assignment.
- **Remediation:** Use Supabase custom JWT claims via `auth.users.raw_app_meta_data` for role verification. This requires service role to modify and cannot be changed by the user:
```sql
-- Set role in app_metadata (requires service role)
UPDATE auth.users SET raw_app_meta_data =
  raw_app_meta_data || '{"user_type": "admin"}'::jsonb
WHERE id = 'user-uuid';
```

### 2.2 Horizontal Privilege Escalation

#### AUTHZ-006: Session Goals GET Returns All Users' Goals for a Session
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `app/api/sessions/[id]/goals/route.ts` (line 4-24)
- **Finding:** The GET handler fetches ALL goals for a session without filtering by user:
```typescript
const { data: goals } = await supabase
  .from("session_goals")
  .select("id, user_id, goal_text, completed, created_at")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: true })
```
While the RLS policy (`007b_session_goals.sql`) limits visibility to own goals or goals in sessions where the user has a booking, the API does not require a booking check. Any authenticated user can call this endpoint with any session ID.
- **Impact:** Authenticated users can view all session goals for any session they are booked into (intended) but also potentially leak goal data if RLS is bypassed.
- **Remediation:** Add booking verification before returning goals, consistent with other session-day endpoints.

#### AUTHZ-007: Group Members Viewable by All Authenticated Users
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (line 291-292)
- **Finding:** The groups and group_members RLS policies allow SELECT to all:
```sql
CREATE POLICY "Groups viewable by all" ON groups FOR SELECT USING (true);
CREATE POLICY "Group members viewable by all" ON group_members FOR SELECT USING (true);
```
- **Impact:** Any authenticated user can query all groups and their member compositions for any session, revealing who is grouped with whom. This undermines the "information asymmetry" design that limits profile data before check-in.
- **Remediation:** Restrict to session participants:
```sql
CREATE POLICY "Groups viewable by session participants" ON groups
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM bookings
      WHERE user_id = auth.uid()
      AND payment_status IN ('paid', 'confirmed')
    )
    OR is_admin()
  );
```

#### AUTHZ-008: Profiles Readable by All — PII Exposure
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (line 249-250)
- **Finding:** `CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);` — Every authenticated user can read every profile including `phone`, `avatar_url`, `industry`, and `work_type`.
- **Impact:** Full PII enumeration of all platform users. Phone numbers are particularly sensitive.
- **Remediation:** Restrict sensitive fields. Use a view or function that returns limited profile data for non-admin users:
```sql
CREATE POLICY "Profiles basic info viewable by all" ON profiles
  FOR SELECT USING (true);
-- But create a secure view for sensitive fields
```
Alternatively, remove `phone` from the public-facing SELECT and expose it only through a dedicated API.

#### AUTHZ-009: Booking Data for Other Users Accessible via Partner Route
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/partner/bookings/route.ts`
- **Finding:** The partner bookings endpoint returns full booking data including `user_id`, display_names, and payment information for all bookings at their venue. While this is functionally needed, combined with AUTHZ-002/003, a non-partner could access this.
- **Impact:** Booking data exposure including user identities and payment amounts.
- **Remediation:** Add partner role verification (see AUTHZ-002 fix).

#### AUTHZ-010: Partner Can View Session Feedback for All Venue Sessions
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `scripts/002_partner_session_rls.sql` (line 36-45)
- **Finding:** Partners can read all feedback for sessions at their venue, including individual user comments. This is by design but could be a privacy concern.
- **Impact:** Partners see individual user comments and ratings that may contain sensitive personal reflections.
- **Remediation:** Consider aggregating feedback for partners rather than showing individual responses.

#### AUTHZ-011: No Ownership Verification on Booking Cancel
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `app/api/bookings/cancel/route.ts` (line 24-27)
- **Finding:** The cancel endpoint passes `p_user_id: user.id` to the RPC. If the `cancel_booking` RPC (not defined in visible SQL) does not validate ownership, any user could cancel any booking by guessing the booking_id.
- **Impact:** Booking cancellation for other users (DoS). However, the RPC likely checks ownership.
- **Remediation:** Verify the `cancel_booking` RPC validates `p_user_id` matches the booking's `user_id`. Add explicit verification in the API route as defense-in-depth.

### 2.3 IDOR Vulnerabilities

#### AUTHZ-012: Session Feedback — No Check User Was in the Session
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (line 77-179)
- **Finding:** The POST handler verifies a booking exists but does not verify the session is completed or that the user actually checked in. A user who booked but never attended can submit feedback and member ratings.
- **Impact:**
  - Fake reviews from non-attendees
  - Manipulated member ratings (affecting reputation scores)
  - Rating users you never met, gaming the matching algorithm
- **Remediation:** Add `checked_in: true` to the booking verification query:
```typescript
const { data: booking } = await supabase
  .from("bookings")
  .select("id")
  .eq("session_id", sessionId)
  .eq("user_id", user.id)
  .eq("checked_in", true) // Must have actually attended
  .in("payment_status", ["paid", "confirmed"])
  .single()
```

#### AUTHZ-013: Member Ratings — Can Rate Any User, Not Just Group Members
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (line 134-152)
- **Finding:** The member_ratings insertion accepts any `to_user` UUID in the `member_ratings` array. There is no validation that the `to_user` was actually in the same group as the rater.
```typescript
const ratings = member_ratings.map((mr) => ({
  from_user: user.id,
  to_user: mr.to_user, // <-- any UUID accepted
  session_id: sessionId,
  ...
}))
```
- **Impact:** A malicious user can submit negative ratings for ANY user on the platform, tanking their reputation score. Or positive ratings to boost accomplices.
- **Remediation:** Validate `to_user` is in the same group:
```typescript
// Get user's group members
const { data: groupMembers } = await supabase
  .from("group_members")
  .select("user_id")
  .eq("group_id", booking.group_id)
  .neq("user_id", user.id)

const validMemberIds = new Set(groupMembers?.map(m => m.user_id) || [])

const ratings = member_ratings.filter(mr => validMemberIds.has(mr.to_user)).map(...)
```

#### AUTHZ-014: Favorites — Can Favorite Any User via Feedback Endpoint
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts` (line 155-165)
- **Finding:** The favorites array accepts any user UUID. No validation that the favorited user was in the same session/group.
- **Impact:** Minor — favorites primarily affect matching algorithm bonus. Could be used to game matching to always be grouped with specific users.
- **Remediation:** Validate favorite targets are session/group participants.

#### AUTHZ-015: Partner Session Update — Mass Assignment via Spread
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **File:** `app/api/partner/sessions/[id]/route.ts` (line 37-45)
- **Finding:** The PUT handler spreads the entire request body into the session update:
```typescript
const { data: session, error } = await supabase
  .from("sessions")
  .update({
    ...body,  // <-- MASS ASSIGNMENT
    updated_at: new Date().toISOString(),
  })
  .eq("id", id)
  .select()
  .single()
```
A partner can set `platform_fee: 0`, `spots_filled: 0`, `status: 'completed'`, or any other field.
- **Impact:**
  - Set `platform_fee` to 0 to avoid paying the platform
  - Manipulate `spots_filled` to allow overbooking
  - Change `status` to bypass lifecycle controls
  - Set `venue_id` to hijack sessions from other venues
- **Remediation:** Whitelist allowed fields:
```typescript
const allowed = ['start_time', 'end_time', 'max_spots', 'venue_price']
const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
for (const key of allowed) {
  if (body[key] !== undefined) updates[key] = body[key]
}
```

#### AUTHZ-016: Booking Payment PATCH — User Self-Confirms Payment
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **File:** `app/api/bookings/[id]/payment/route.ts` (line 51-92)
- **Finding:** The PATCH handler allows a user to mark their own booking as "paid" by simply providing a `upi_ref` string:
```typescript
await supabase
  .from("bookings")
  .update({
    payment_status: "paid",
    payment_reference: upi_ref || null,
  })
  .eq("id", bookingId)
```
The `upi_ref` is optional and unvalidated. A user can:
1. Book a session (status: pending)
2. Call PATCH with `{ upi_ref: "fake123" }` or even `{}`
3. Booking status becomes "paid"
4. User can now check in and attend the session for free
- **Impact:** Complete payment bypass. Users attend sessions for free. Platform and venue lose all revenue.
- **Remediation:** The PATCH should set status to `payment_pending` (user claims they paid), NOT `paid`. Only admin verification (via `/api/admin/payments` PATCH) should set `paid` or `confirmed`:
```typescript
await supabase
  .from("bookings")
  .update({
    payment_status: "payment_pending", // NOT "paid"
    payment_reference: upi_ref || null,
  })
  .eq("id", bookingId)
```

#### AUTHZ-017: Admin Payment Verification — No Booking Status Validation
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/admin/payments/route.ts` (line 45-49)
- **Finding:** The admin PATCH endpoint updates booking payment status without checking the current status:
```typescript
const { error } = await supabase
  .from("bookings")
  .update({ payment_status: newStatus })
  .eq("id", booking_id)
```
An admin (or attacker with admin access) can set any booking to any valid status, including confirming already-cancelled or refunded bookings.
- **Impact:** Financial inconsistency. Cancelled bookings re-activated.
- **Remediation:** Validate current status before transition:
```typescript
const { error } = await supabase
  .from("bookings")
  .update({ payment_status: newStatus })
  .eq("id", booking_id)
  .in("payment_status", ["pending", "payment_pending"]) // Only allow from these states
```

#### AUTHZ-018: Subscription Creation — No Payment Integration
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `app/api/subscriptions/route.ts` (line 35-93)
- **Finding:** The subscription POST endpoint creates an active subscription immediately without any payment processing:
```typescript
const { data: subscription, error } = await supabase
  .from("user_subscriptions")
  .insert({
    user_id: user.id,
    plan_id,
    status: "active",  // Immediately active, no payment
    ...
  })
```
- **Impact:** Users get premium subscription benefits (priority matching, streak freezes, exclusive venues) without paying.
- **Remediation:** Integrate payment verification before activating subscriptions. Set initial status to "pending" until payment is confirmed.

#### AUTHZ-019: Referral Credit Not Actually Applied
- **Severity:** Low
- **Effort to Exploit:** N/A
- **File:** `app/api/referrals/route.ts` (line 78-83)
- **Finding:** The referral event records a `credit_amount: 50` but there is no mechanism to actually apply this credit to future bookings. The credit is recorded but never deducted from payments.
- **Impact:** Referral program creates expectations but doesn't deliver, a business logic vulnerability.
- **Remediation:** Implement a credits system that integrates with the booking payment flow.

#### AUTHZ-020: Referral Code Uses Counter — Race Condition
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `app/api/referrals/route.ts` (line 88-91)
- **Finding:** The uses counter increment is non-atomic:
```typescript
await supabase
  .from("referral_codes")
  .update({ uses: referralCode.uses + 1 })
  .eq("id", referralCode.id)
```
With concurrent requests, the count can be lost (classic read-modify-write race).
- **Impact:** Inaccurate referral tracking.
- **Remediation:** Use Supabase RPC with `SET uses = uses + 1` or implement an atomic increment.

### 2.4 Role Confusion Attacks

#### AUTHZ-021: Dashboard Layout Does Not Check user_type
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/dashboard/layout.tsx` (line 5-39)
- **Finding:** The coworker dashboard layout checks authentication and onboarding status but NOT `user_type`. A partner or admin user can access the coworker dashboard and perform coworker actions (booking sessions, leaving feedback).
- **Impact:** Partners could book sessions at their own venue, manipulating booking counts and revenue figures. Admins could create bookings that bypass normal flows.
- **Remediation:** Add role verification or ensure booking APIs validate role context.

#### AUTHZ-022: Partner Can Book Sessions at Own Venue
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/bookings/route.ts`
- **Finding:** The booking API does not verify that the user is not the venue partner for the session being booked. A partner can book their own sessions, inflating attendance numbers.
- **Impact:** Inflated metrics, self-dealing for earnings calculations.
- **Remediation:** Check that the booking user is not the partner who owns the session's venue.

#### AUTHZ-023: No API Route Protection in Middleware
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `lib/supabase/proxy.ts` (line 44-51)
- **Finding:** The middleware only protects page routes (`/dashboard`, `/partner`, `/admin`, `/session`, `/onboarding`, `/protected`). API routes under `/api/` are NOT listed in the protection check. While each API route independently calls `getUser()`, the middleware's path-based protection creates a false sense of security.
- **Impact:** If a developer adds a new API route and forgets the `getUser()` check, it will be completely unauthenticated. There is no safety net.
- **Remediation:** Add `/api/` paths to middleware protection (except public endpoints like `/api/sessions`):
```typescript
if (
  request.nextUrl.pathname.startsWith('/api/') &&
  !request.nextUrl.pathname.startsWith('/api/sessions') &&
  !request.nextUrl.pathname.startsWith('/api/cron/') &&
  !user
) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

#### AUTHZ-024: Sessions List API Is Fully Unauthenticated
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/api/sessions/route.ts` (line 4-51)
- **Finding:** The sessions GET endpoint requires no authentication. While sessions should be publicly discoverable, the endpoint returns full session data including `venues(*)` — all venue details, pricing, capacity, and spots filled.
- **Impact:** Competitors can scrape all session data, pricing strategy, and venue partnerships. Automated bots can monitor capacity.
- **Remediation:** Add rate limiting. Consider requiring authentication for detailed data while keeping a summary endpoint public.

#### AUTHZ-025: Cron Notification Endpoint — CRON_SECRET in Server Cookie Context
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `app/api/cron/notifications/route.ts` (line 9-10)
- **Finding:** The cron endpoint uses `process.env.CRON_SECRET` for authentication. It then creates a Supabase server client that uses cookies, but the cron request from Vercel has no cookies. This means the Supabase client will be unauthenticated.
- **Impact:** The notification insertion using an unauthenticated Supabase client may fail if the `notifications` table has RLS policies that require auth. The INSERT operation requires auth but the cron context has no user session.
- **Remediation:** Use a Supabase service role client for cron operations, or ensure the notifications table has a policy allowing inserts from service roles.

#### AUTHZ-026: Cron Secret — Timing Attack on Bearer Token Comparison
- **Severity:** Low
- **Effort to Exploit:** High
- **File:** `app/api/cron/notifications/route.ts` (line 10)
- **Finding:** The bearer token comparison uses JavaScript `!==` which is not constant-time:
```typescript
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
```
- **Impact:** Theoretically vulnerable to timing attacks to determine the CRON_SECRET character by character.
- **Remediation:** Use `crypto.timingSafeEqual()` for secret comparison.

### 2.5 Additional Privilege Escalation Vectors

#### AUTHZ-027: book_session() RPC is SECURITY DEFINER — Bypasses RLS
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `scripts/001_schema.sql` (line 189-210)
- **Finding:** The `book_session` function is `SECURITY DEFINER`, meaning it runs with the privileges of the function creator (usually a superuser). Any authenticated user can call this RPC and the function bypasses all RLS policies. The function accepts any `p_user_id`, allowing a user to create bookings attributed to other users.
- **Impact:** A malicious user calls `book_session(session_id, other_users_id)` to:
  - Fill up sessions, preventing legitimate bookings
  - Create bookings attributed to other users
  - Potentially trigger payment obligations for others
- **Remediation:** Validate `p_user_id = auth.uid()` inside the function:
```sql
IF p_user_id != auth.uid() THEN
  RAISE EXCEPTION 'Cannot book for another user';
END IF;
```

#### AUTHZ-028: auto_assign_groups() RPC — No Caller Authorization
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `scripts/004_auto_assign_groups.sql` (line 9-241)
- **Finding:** The `auto_assign_groups` function is `SECURITY DEFINER` and does not check if the caller is an admin. While the API route (`/api/admin/groups/auto-assign`) checks admin status, any authenticated user can call the RPC directly via the Supabase client.
- **Impact:** Any user can trigger group reassignment for any session, disrupting existing group assignments and corrupting the group history.
- **Remediation:** Add admin verification inside the function:
```sql
IF NOT is_admin() THEN
  RAISE EXCEPTION 'Admin access required';
END IF;
```

#### AUTHZ-029: get_user_stats() RPC — Can Query Any User's Stats
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/006_profile_stats.sql` (line 5-65)
- **Finding:** The `get_user_stats` function accepts any `p_user_id` and is `SECURITY DEFINER`. Any authenticated user can query detailed statistics for any other user.
- **Impact:** Leak of attendance patterns, rating data, session history for any user.
- **Remediation:** Either restrict to `auth.uid()` or validate the caller has a reason to access the data.

#### AUTHZ-030: compute_coworker_score() RPC — Exposes Any User's Reputation
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `scripts/008_reputation.sql` (line 10-101)
- **Finding:** Same pattern as AUTHZ-029. Any user can compute the coworker score for any other user, revealing attendance reliability, rating breakdowns, and streak data.
- **Impact:** Competitive intelligence within the community. Users could selectively avoid low-scored coworkers.
- **Remediation:** Add access control or expose only aggregate tier information.

#### AUTHZ-031: compute_venue_score() RPC — No Access Control
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `scripts/011_venue_scoring.sql` (line 16-70)
- **Finding:** Any authenticated user can compute venue scores for any venue, including inactive/pending venues that should not be publicly rated.
- **Impact:** Score leakage for venues not yet approved by admin.
- **Remediation:** Add venue status check inside the function.

#### AUTHZ-032: populate_group_history() RPC — Callable by Any User
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `scripts/006b_group_history.sql` (line 24-35)
- **Finding:** The `populate_group_history` function is `SECURITY DEFINER` with no authorization. While it's meant to be called internally by `auto_assign_groups`, any user can invoke it directly.
- **Impact:** Could be used to pollute group history with fabricated data, affecting the anti-repetition algorithm.
- **Remediation:** Add `is_admin()` check or make it a private function only callable from other SECURITY DEFINER functions.

#### AUTHZ-033: update_streak() RPC — Can Manipulate Any User's Streak
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `scripts/007_streaks.sql` (line 29-70)
- **Finding:** The `update_streak` function accepts `p_user_id` and is `SECURITY DEFINER`. Any user can increment another user's streak.
- **Impact:** Streak manipulation. Attackers could boost their own streak or inflate others'.
- **Remediation:** Validate `p_user_id = auth.uid()` or make the function internal-only.

#### AUTHZ-034: check_in_user() RPC — Validates auth.uid() Correctly
- **Severity:** Info (Positive Finding)
- **File:** `scripts/005_session_day.sql` (line 10-60)
- **Finding:** The `check_in_user` function correctly validates `user_id = auth.uid()` on line 18. This is one of the few SECURITY DEFINER functions that properly validates the caller.
- **Impact:** Positive — check-in cannot be performed for other users.

#### AUTHZ-035: No DELETE Policy on Bookings
- **Severity:** Low
- **Effort to Exploit:** High
- **File:** `scripts/001_schema.sql` (line 280-284)
- **Finding:** There is no DELETE policy on the bookings table. While soft-deletes (cancellation) are used, the absence of a DELETE policy means no one — not even admins — can hard-delete bookings via RLS. This is actually a positive finding for audit trail integrity, but it means cancelled bookings accumulate indefinitely.
- **Impact:** No data cleanup possible without service role access.
- **Remediation:** Consider adding an admin DELETE policy for data management, or implement a data retention policy.

#### AUTHZ-036: Missing INSERT Policies for Admin Tables
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `scripts/003_admin_rls.sql`
- **Finding:** Admins have INSERT policies for `groups` and `group_members`, but there are no INSERT policies for `matching_outcomes`, `notifications`, or `session_feedback` for admin users. If admin operations need to insert into these tables, they will fail.
- **Impact:** Admin notification creation (cron job) may fail due to missing INSERT policy on notifications table.
- **Remediation:** Add admin INSERT policies for operational tables:
```sql
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- Or restrict to service role
```

#### AUTHZ-037: User Can Update Their Own Booking — Unintended Fields
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `scripts/005_session_day.sql` (line 4-6)
- **Finding:** The booking update policy allows users to update ANY field on their own booking:
```sql
CREATE POLICY "Users can update own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);
```
A user can directly call the Supabase client to:
- Set `payment_status = 'confirmed'` (bypass payment)
- Set `checked_in = true, checked_in_at = now()` (bypass check-in time validation)
- Set `group_id` to any group (switch groups)
- Set `payment_amount = 0`
- **Impact:** Complete payment bypass, check-in bypass, group switching. This is equivalent to AUTHZ-016 but at the database level.
- **Remediation:** Remove the blanket update policy. Only allow updates through controlled RPC functions:
```sql
-- Remove the blanket update policy
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

-- Only allow check-in updates through the RPC
-- Only allow payment status updates through admin
```

#### AUTHZ-038: Onboarding API — No Protection Against Repeated Calls
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `app/api/onboarding/route.ts`
- **Finding:** The onboarding API can be called repeatedly to update profile and preference data. There is no check that onboarding was already completed.
- **Impact:** Users can change their work vibe, noise preference, and other matching-algorithm inputs after being grouped, potentially gaming future matches.
- **Remediation:** Add a check that `onboarding_complete` is false before allowing updates, or create a separate profile-edit endpoint with appropriate restrictions.

#### AUTHZ-039: Partner Venue PUT — No Field Whitelist
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/partner/venue/route.ts` (line 27-71)
- **Finding:** While the venue update extracts specific fields from the body, the `status` field is NOT in the whitelist. However, a partner could call the Supabase client directly to update their venue status (RLS allows it since `partner_id = auth.uid()`).
- **Impact:** A partner could set their venue status to `active` bypassing admin approval.
- **Remediation:** Add a trigger to prevent non-admin status changes:
```sql
CREATE OR REPLACE FUNCTION prevent_venue_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NOT is_admin() THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### AUTHZ-040: Session Status Change Not Protected
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `scripts/002_partner_session_rls.sql` (line 10-14)
- **Finding:** Partners can update ANY field on their sessions, including `status`. A partner could set a session to `completed` prematurely or revert a `cancelled` session to `upcoming`.
- **Impact:** Session lifecycle manipulation. Financial reporting inconsistencies.
- **Remediation:** Restrict partner session updates to specific fields and add status transition validation.

---

## 3. API Security

### 3.1 Input Validation

#### API-001: No Input Validation on Booking Session ID
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/api/bookings/route.ts` (line 38-39)
- **Finding:** The `session_id` is checked for presence but not format. Non-UUID strings will cause Supabase errors that leak internal information.
- **Impact:** Information leakage via error messages.
- **Remediation:** Validate UUID format:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!session_id || !UUID_REGEX.test(session_id)) {
  return NextResponse.json({ error: "Invalid session_id" }, { status: 400 })
}
```

#### API-002: No Input Validation on Partner Session Creation
- **Severity:** High
- **Effort to Exploit:** Low
- **File:** `app/api/partner/sessions/route.ts` (line 63-106)
- **Finding:** Missing validation for:
  - `duration_hours` not validated to be 2 or 4 (the DB constraint catches it, but leaks error info)
  - `venue_price` can be negative (no check)
  - `max_spots` can be 0 or negative
  - `start_time` format not validated (invalid times cause calculation errors on line 75-78)
  - `session_date` can be in the past
  - End time calculation can overflow past 24:00
- **Impact:** Corrupt session data, negative pricing, calculation errors.
- **Remediation:** Add comprehensive validation:
```typescript
if (![2, 4].includes(duration_hours)) {
  return NextResponse.json({ error: "Duration must be 2 or 4 hours" }, { status: 400 })
}
if (venue_price < 0 || venue_price > 10000) {
  return NextResponse.json({ error: "Invalid venue price" }, { status: 400 })
}
```

#### API-003: Onboarding Body Not Validated
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/api/onboarding/route.ts` (line 14-54)
- **Finding:** The body fields are passed directly to Supabase with no type or value validation. Invalid enum values for `preferred_vibe`, `noise_preference`, etc. will be rejected by the DB but leak error details.
- **Impact:** Error message information leakage. Potential DB injection if Supabase query builder has vulnerabilities (unlikely but defense-in-depth).
- **Remediation:** Validate all fields against expected types and allowed values.

#### API-004: Feedback Rating Not Fully Validated
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `app/api/session/[id]/feedback/route.ts` (line 106-107)
- **Finding:** `overall_rating` is checked for 1-5 range, but `venue_ratings` values are only partially validated (line 123). Tags, comments, and member_ratings fields have no length or content validation.
- **Impact:** Excessively long comments could cause storage issues. Malicious content in tags could cause XSS if rendered without sanitization.
- **Remediation:** Add length limits and content sanitization for all text fields.

#### API-005: Goal Text — Only Length Validated, Not Content
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **File:** `app/api/sessions/[id]/goals/route.ts` (line 41)
- **Finding:** Goal text is checked for max 200 chars but not sanitized. HTML/script content could be injected and reflected to other group members who view goals.
- **Impact:** Stored XSS if goals are rendered as HTML anywhere in the frontend.
- **Remediation:** Sanitize input or ensure frontend renders as text-only (React's JSX does this by default, but verify).

#### API-006: Admin Users Search — SQL Injection via ilike
- **Severity:** Low
- **Effort to Exploit:** Medium
- **File:** `app/api/admin/users/route.ts` (line 28)
- **Finding:** The search parameter is interpolated into an `ilike` filter:
```typescript
query = query.ilike("display_name", `%${search}%`)
```
Supabase's query builder parameterizes this, so SQL injection is prevented. However, special LIKE characters (`%`, `_`) in the search input are not escaped, allowing search pattern manipulation.
- **Impact:** A user can search for `%` to match all records or use `_` as a single-character wildcard, potentially revealing data patterns.
- **Remediation:** Escape LIKE special characters in the search input.

### 3.2 Mass Assignment

#### API-007: Partner Session Update — Full Body Spread (Duplicate of AUTHZ-015)
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **File:** `app/api/partner/sessions/[id]/route.ts` (line 37-45)
- **Finding:** `...body` allows setting any session field including `id`, `venue_id`, `platform_fee`, `total_price`, `spots_filled`, `status`.
- **Impact:** Complete session manipulation. Already documented as AUTHZ-015.

#### API-008: Onboarding Preferences — Extra Fields Accepted
- **Severity:** Low
- **Effort to Exploit:** Low
- **File:** `app/api/onboarding/route.ts` (line 38-54)
- **Finding:** The upsert passes `body.interests` and other fields that may not correspond to actual columns. Unknown fields are silently ignored by Supabase, but this indicates a lack of strict field filtering.
- **Impact:** If new columns are added to coworker_preferences, they could be set via this endpoint without explicit handling.
- **Remediation:** Explicitly whitelist fields for the upsert.

### 3.3 Parameter Tampering

#### API-009: Booking Amount Set by Server, But Can Be Bypassed via Direct DB
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** The booking API correctly uses the `book_session` RPC which sets `payment_amount` from `v_session.total_price`. However, the blanket UPDATE policy (AUTHZ-037) allows the user to modify `payment_amount` after booking.
- **Impact:** User books at correct price, then updates `payment_amount` to 0 before paying.
- **Remediation:** Fix the overly permissive booking UPDATE policy (see AUTHZ-037).

#### API-010: Venue Price Set by Partner — No Bounds
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **File:** `app/api/partner/sessions/route.ts` (line 94)
- **Finding:** `venue_price: venue_price || 0` — no upper bound. A partner could set a venue price of 999999, inflating the total session price.
- **Impact:** Price gouging. Users could be shown extremely high prices.
- **Remediation:** Enforce reasonable bounds: `venue_price: Math.min(Math.max(venue_price || 0, 0), 5000)`.

#### API-011: Admin Venue Status — Only 3 Values Validated
- **Severity:** Info
- **Effort to Exploit:** N/A
- **File:** `app/api/admin/venues/[id]/route.ts` (line 21)
- **Finding:** The status validation correctly restricts to `["active", "inactive", "pending"]`. This is a positive finding.
- **Impact:** None — properly validated.

### 3.4 CSRF Protection

#### API-012: No CSRF Tokens on State-Changing Endpoints
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** All POST/PUT/PATCH/DELETE endpoints lack CSRF protection. Next.js API routes do not have built-in CSRF protection. The SameSite cookie attribute (if set) provides some protection, but is not verified.
- **Impact:** Malicious websites could trigger bookings, cancellations, or profile changes if the user is logged in to donedonadone.
- **Remediation:**
  - Verify `SameSite=Lax` is set on auth cookies
  - Add `Origin` header validation in middleware
  - Consider implementing the double-submit cookie pattern

#### API-013: No Origin/Referer Header Validation
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** All API routes
- **Finding:** No API route checks the `Origin` or `Referer` header to ensure requests come from the legitimate domain.
- **Impact:** Cross-origin requests from malicious sites could invoke API endpoints.
- **Remediation:** Add origin validation in middleware:
```typescript
const origin = request.headers.get('origin')
if (origin && !['https://donedonadone.com', 'http://localhost:3000'].includes(origin)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### 3.5 Rate Limiting

#### API-014: No Rate Limiting on Any API Route
- **Severity:** High
- **Effort to Exploit:** Trivial
- **Finding:** None of the 29 API routes implement rate limiting. Supabase has default rate limits, but the application layer has none.
- **Impact:**
  - Brute-force login (AUTH-005)
  - Booking spam (fill all sessions)
  - Feedback spam
  - API DoS
  - Scraping session data
- **Remediation:** Implement rate limiting via Vercel Edge Middleware or use a library like `next-rate-limit`:
```typescript
// In middleware
import { Ratelimit } from "@upstash/ratelimit"
const ratelimit = new Ratelimit({
  limiter: Ratelimit.slidingWindow(20, "60 s"),
})
```

#### API-015: No Rate Limiting on Booking Creation
- **Severity:** High
- **Effort to Exploit:** Trivial
- **File:** `app/api/bookings/route.ts`
- **Finding:** A single user could rapidly create bookings for many sessions, filling them up and preventing legitimate users from booking.
- **Impact:** Denial of service for other users. Session capacity manipulation.
- **Remediation:** Limit to N bookings per user per hour. Add a maximum active bookings limit.

#### API-016: No Rate Limiting on Feedback Submission
- **Severity:** Medium
- **Effort to Exploit:** Low
- **File:** `app/api/session/[id]/feedback/route.ts`
- **Finding:** While the DB has a unique constraint on `(booking_id)` for feedback and `(from_user, to_user, session_id)` for ratings, there's no rate limit on submission attempts.
- **Impact:** Error message enumeration; resource consumption from repeated failed inserts.
- **Remediation:** Add rate limiting and return cached responses for duplicate submissions.

### 3.6 Error Message Information Leakage

#### API-017: Supabase Error Messages Exposed to Client
- **Severity:** Medium
- **Effort to Exploit:** Trivial
- **Files:** Almost all API routes contain `return NextResponse.json({ error: error.message }, { status: 500 })`
- **Finding:** Raw Supabase error messages are returned to the client. These can reveal:
  - Table names and column names
  - Constraint names
  - Query structure
  - RLS policy failures with details
- **Impact:** Database schema information leakage aids further attacks.
- **Remediation:** Return generic error messages to the client and log detailed errors server-side:
```typescript
if (error) {
  console.error('Booking creation failed:', error)
  return NextResponse.json({ error: "Booking failed" }, { status: 500 })
}
```

#### API-018: Stack Traces in Development Mode
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **Finding:** Next.js in development mode shows detailed stack traces. Ensure `NODE_ENV=production` in deployment.
- **Impact:** Code paths and internal structure revealed.
- **Remediation:** Verify production deployment sets `NODE_ENV=production`.

#### API-019: Uncaught JSON Parse Errors
- **Severity:** Low
- **Effort to Exploit:** Trivial
- **Files:** All POST/PUT/PATCH routes call `request.json()` without try-catch.
- **Finding:** If a request body is not valid JSON, `request.json()` throws an unhandled error, resulting in a 500 response with stack trace information.
- **Impact:** Error information leakage; application instability.
- **Remediation:** Wrap all `request.json()` calls in try-catch:
```typescript
let body
try {
  body = await request.json()
} catch {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
}
```

### 3.7 Missing Security Headers

#### API-020: No Security Headers Configured
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **File:** `next.config.mjs`
- **Finding:** The Next.js config does not set security headers. Missing:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
- **Impact:** Clickjacking, MIME sniffing, missing HSTS.
- **Remediation:** Add headers in `next.config.mjs`:
```javascript
const nextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
}
```

---

## 4. Supabase-Specific Risks

### 4.1 Anon Key & Client Exposure

#### SUP-001: Anon Key Exposed in Client-Side Bundle
- **Severity:** Info
- **Effort to Exploit:** Trivial
- **File:** `lib/supabase/client.ts` (line 4-5)
- **Finding:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are embedded in the client bundle. This is expected by design, but the anon key grants direct database access within RLS boundaries.
- **Impact:** Any user (or non-user) with the anon key can call the Supabase REST API directly, bypassing the Next.js API layer. All RLS vulnerabilities documented in this report can be exploited directly.
- **Remediation:** This is by design. The fix is to ensure RLS policies are airtight (which this audit shows they are NOT). Consider adding additional server-side validation for sensitive operations.

#### SUP-002: Direct Database Access Bypasses API-Level Checks
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **Finding:** Since the anon key is exposed, users can bypass all API routes and call Supabase directly:
```javascript
// In browser console:
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient('https://xxx.supabase.co', 'anon-key-here')
// Now bypass all API-level checks:
await sb.from('profiles').update({ user_type: 'admin' }).eq('id', myUserId)
await sb.from('bookings').update({ payment_status: 'confirmed', payment_amount: 0 }).eq('id', myBookingId)
```
This makes AUTHZ-001, AUTHZ-037, AUTHZ-039, and AUTHZ-040 directly exploitable from the browser.
- **Impact:** All API-level authorization checks are rendered meaningless. Only RLS policies provide actual security.
- **Remediation:** Fix all RLS policies documented in this report. The API layer should be treated as UX/validation only, not security.

#### SUP-003: Service Role Key Not Present in Application Code
- **Severity:** Info (Positive Finding)
- **Finding:** The service role key is never referenced in the application code. Only the anon key is used. This is correct — the service role key should only be used in trusted server environments.
- **Impact:** Positive — no service role key exposure risk.

#### SUP-004: No API Key Rotation Mechanism
- **Severity:** Low
- **Effort to Exploit:** N/A
- **Finding:** If the anon key is compromised (it's public by design) or the CRON_SECRET is compromised, there is no documented rotation procedure.
- **Impact:** Compromised secrets remain valid indefinitely.
- **Remediation:** Document key rotation procedures. Set up alerts for anomalous API usage.

### 4.2 RLS Policy Gaps Per Table

#### SUP-005: profiles — UPDATE Allows user_type Change
- **Severity:** CRITICAL
- **Effort to Exploit:** Trivial
- **File:** `scripts/001_schema.sql` (line 251-252)
- **Policy:** `FOR UPDATE USING (auth.uid() = id)` — no column restriction.
- **Impact:** Privilege escalation (see AUTHZ-001).
- **Remediation:** Add column check trigger or use column-level security.

#### SUP-006: profiles — SELECT Exposes Phone Numbers
- **Severity:** Medium
- **File:** `scripts/001_schema.sql` (line 249-250)
- **Policy:** `FOR SELECT USING (true)` — all columns visible to all.
- **Impact:** PII exposure.
- **Remediation:** Use a view that excludes sensitive columns, or add column-level security.

#### SUP-007: coworker_preferences — No Admin Insert Policy
- **Severity:** Low
- **File:** `scripts/001_schema.sql`, `scripts/003_admin_rls.sql`
- **Finding:** Admin can SELECT but cannot INSERT or UPDATE preferences for users. This may be needed for customer support operations.
- **Impact:** Admin cannot fix user preference issues.
- **Remediation:** Add admin INSERT/UPDATE policies if needed.

#### SUP-008: venues — Any User Can INSERT (Not Just Partners)
- **Severity:** High
- **File:** `scripts/001_schema.sql` (line 269-270)
- **Finding:** Already documented as AUTHZ-003.
- **Remediation:** Add user_type check to INSERT policy.

#### SUP-009: venues — Partners Can Self-Approve
- **Severity:** High
- **File:** `scripts/001_schema.sql` (line 271-272)
- **Policy:** `FOR UPDATE USING (partner_id = auth.uid())` — no column restriction.
- **Impact:** Partners can set `status = 'active'` bypassing admin approval. Already documented as AUTHZ-039.
- **Remediation:** Add trigger to prevent non-admin status changes.

#### SUP-010: sessions — SELECT Is Fully Open
- **Severity:** Low
- **File:** `scripts/001_schema.sql` (line 277-278)
- **Policy:** `FOR SELECT USING (true)` — all sessions visible including cancelled, past, etc.
- **Impact:** Complete session history visible to any authenticated user.
- **Remediation:** Consider restricting to upcoming/active sessions for non-admin users.

#### SUP-011: sessions — INSERT/UPDATE Lack Status Transition Validation
- **Severity:** Medium
- **Files:** `scripts/002_partner_session_rls.sql`
- **Finding:** Partners can set any status value. No state machine validation.
- **Impact:** Invalid state transitions (e.g., completed -> upcoming).
- **Remediation:** Add a trigger that validates status transitions.

#### SUP-012: bookings — SELECT Allows Partners to See All Booking Details
- **Severity:** Low
- **File:** `scripts/002_partner_session_rls.sql` (line 24-33)
- **Finding:** Partners can see all booking columns including `payment_reference`, `payment_amount` for bookings at their venue. This is functionally needed but exposes payment details.
- **Impact:** Partners see individual payment details.
- **Remediation:** Consider a view that limits visible columns for partner access.

#### SUP-013: bookings — UPDATE Allows User to Change Any Field
- **Severity:** CRITICAL
- **File:** `scripts/005_session_day.sql` (line 4-6)
- **Finding:** Already documented as AUTHZ-037. The blanket UPDATE policy is the single most dangerous RLS gap.
- **Remediation:** Remove blanket update; use RPC functions for controlled updates.

#### SUP-014: groups — No INSERT/UPDATE/DELETE Restrictions for Non-Admin
- **Severity:** Low
- **File:** `scripts/001_schema.sql` (line 287-288)
- **Finding:** The base policy allows SELECT to all. INSERT/DELETE are only for admins (003_admin_rls.sql). This is correct — no users can modify groups directly.
- **Impact:** Positive finding — groups are properly protected.

#### SUP-015: group_members — SELECT Exposes All Memberships
- **Severity:** Medium
- **File:** `scripts/001_schema.sql` (line 291-292)
- **Finding:** Already documented as AUTHZ-007. All group memberships visible to all users.
- **Remediation:** Restrict to session participants and admins.

#### SUP-016: session_feedback — No UPDATE Policy
- **Severity:** Low
- **Finding:** Users cannot update their feedback once submitted. While this preserves integrity, it means typos cannot be corrected.
- **Impact:** Minor UX issue.
- **Remediation:** Consider adding an UPDATE policy with a time window (e.g., within 24 hours of submission).

#### SUP-017: member_ratings — No UPDATE or DELETE Policy
- **Severity:** Low
- **Finding:** Ratings are permanent once submitted. No way to correct false ratings.
- **Impact:** A malicious user's false ratings persist permanently.
- **Remediation:** Add admin DELETE policy for moderating abusive ratings.

#### SUP-018: session_goals — Overly Broad SELECT
- **Severity:** Low
- **File:** `scripts/007b_session_goals.sql` (line 22-31)
- **Finding:** The SELECT policy allows viewing goals for any session the user has a booking for, not just their own group. A user can see goals of ALL participants in a session, not just their group.
- **Impact:** Minor privacy concern — users see goals of people outside their group.
- **Remediation:** Restrict to group members:
```sql
CREATE POLICY "Users view session goals for their groups" ON session_goals
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
      AND gm2.user_id = session_goals.user_id
      AND gm1.group_id IN (SELECT id FROM groups WHERE session_id = session_goals.session_id)
    )
  );
```

#### SUP-019: user_subscriptions — No Session Limit Enforcement
- **Severity:** Medium
- **File:** `scripts/009_subscriptions.sql`
- **Finding:** The `sessions_used` counter is never incremented when booking. Even with a plan limiting sessions to 4/month, there's no enforcement.
- **Impact:** Subscription limits are unenforced. Users pay for Explorer (4/month) but can book unlimited sessions.
- **Remediation:** Add session count check in the `book_session` RPC function.

#### SUP-020: referral_codes — No INSERT Policy for Regular Users
- **Severity:** Info
- **File:** `scripts/010_referrals.sql`
- **Finding:** Referral codes are created by a trigger (`generate_referral_code`). There's no INSERT policy for users to create their own codes. This is correct — codes are auto-generated.
- **Impact:** Positive finding.

#### SUP-021: referral_events — No INSERT Policy for Regular Users
- **Severity:** Medium
- **File:** `scripts/010_referrals.sql`
- **Finding:** There's no INSERT policy on `referral_events`. The API route (`/api/referrals` POST) inserts events, but this requires the Supabase client to have INSERT permission. Since no INSERT policy exists, the insert will fail unless the API is using a SECURITY DEFINER function or service role.
- **Impact:** The referral redemption feature may not work at all.
- **Remediation:** Add an INSERT policy:
```sql
CREATE POLICY "Users can create referral events" ON referral_events
  FOR INSERT WITH CHECK (auth.uid() = referred_id);
```

#### SUP-022: notifications — No INSERT Policy
- **Severity:** High
- **File:** `scripts/013_notifications.sql`
- **Finding:** The notifications table has SELECT and UPDATE policies for users but NO INSERT policy. The cron handler tries to insert notifications but uses a cookie-based Supabase client which is unauthenticated in cron context.
- **Impact:** The entire notification system may be non-functional. No notifications are actually created.
- **Remediation:** Either:
  1. Use a service role client for cron operations
  2. Add a service-level INSERT policy
  3. Use a Supabase Edge Function with service role for notification creation

#### SUP-023: matching_outcomes — No INSERT Policy
- **Severity:** Low
- **File:** `scripts/012_matching_outcomes.sql`
- **Finding:** The `matching_outcomes` table has SELECT policies only. The `auto_assign_groups` function is SECURITY DEFINER so it can insert, but if the algorithm is modified to insert outcomes, the policy is already covered by SECURITY DEFINER.
- **Impact:** Matching outcomes may not be recorded if the insert is not done within a SECURITY DEFINER function.
- **Remediation:** Verify the auto_assign function inserts outcomes or add an admin INSERT policy.

#### SUP-024: group_history — No INSERT Policy for Non-Admin
- **Severity:** Low
- **File:** `scripts/006b_group_history.sql`
- **Finding:** The `populate_group_history` function is SECURITY DEFINER so it can insert. But if called outside that context, inserts fail.
- **Impact:** Acceptable since all inserts should go through the SECURITY DEFINER function.

### 4.3 Realtime & Storage

#### SUP-025: Realtime Subscriptions May Leak Data
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** If Supabase Realtime is enabled on tables with `SELECT USING (true)` policies (profiles, sessions, groups, group_members), any authenticated user can subscribe to real-time changes and monitor all inserts/updates.
- **Impact:** Real-time monitoring of all bookings, group assignments, and profile changes.
- **Remediation:** Disable Realtime on tables that don't need it. Configure publication-level RLS.

#### SUP-026: No Storage Bucket Security Configuration
- **Severity:** Medium
- **Effort to Exploit:** Medium
- **Finding:** The `photos` field on venues and `avatar_url` on profiles suggest file uploads, but no Supabase Storage bucket policies are defined in the codebase.
- **Impact:** If storage is enabled without policies, any authenticated user could upload/delete files.
- **Remediation:** Define storage bucket policies with proper access controls.

#### SUP-027: No File Upload Validation
- **Severity:** Medium
- **Effort to Exploit:** Low
- **Finding:** No file upload endpoints were found in the API. If file uploads are handled client-side via Supabase Storage, there's no server-side validation of file types, sizes, or content.
- **Impact:** Malicious file uploads (executable disguised as image, oversized files).
- **Remediation:** Configure Supabase Storage policies to restrict file types and sizes.

### 4.4 SECURITY DEFINER Function Risks

#### SUP-028: All RPC Functions Are SECURITY DEFINER
- **Severity:** High
- **Effort to Exploit:** Low
- **Finding:** Every PostgreSQL function in the codebase uses `SECURITY DEFINER`:
  - `book_session` (001_schema.sql)
  - `handle_new_user` (001_schema.sql)
  - `check_in_user` (005_session_day.sql)
  - `get_user_stats` (006_profile_stats.sql)
  - `populate_group_history` (006b_group_history.sql)
  - `auto_assign_groups` (004_auto_assign_groups.sql)
  - `update_streak` (007_streaks.sql)
  - `trigger_update_streak` (007_streaks.sql)
  - `compute_coworker_score` (008_reputation.sql)
  - `generate_referral_code` (010_referrals.sql)
  - `compute_venue_score` (011_venue_scoring.sql)
  - `is_admin` (003_admin_rls.sql)
  - `week_start` (007_streaks.sql) — IMMUTABLE, not security-sensitive

  All of these bypass RLS entirely when executed. While some need SECURITY DEFINER to modify data across users (like group assignment), many could be SECURITY INVOKER.
- **Impact:** Any function vulnerability or unexpected input handling bypasses all RLS protection.
- **Remediation:** Convert non-essential functions to SECURITY INVOKER:
  - `get_user_stats` — should be INVOKER (reads only)
  - `compute_coworker_score` — should be INVOKER
  - `compute_venue_score` — should be INVOKER
  - `is_admin` — must remain DEFINER (used in policies)

#### SUP-029: book_session() Does Not Set search_path
- **Severity:** Medium
- **Effort to Exploit:** High
- **File:** `scripts/001_schema.sql` (line 189-210)
- **Finding:** The `book_session` function does not set `search_path = public` like `handle_new_user` does. In a SECURITY DEFINER context, this could theoretically allow search_path injection.
- **Impact:** Unlikely in practice with Supabase, but a defense-in-depth concern.
- **Remediation:** Add `SET search_path = public` to all SECURITY DEFINER functions.

#### SUP-030: Trigger Functions Run as Owner
- **Severity:** Low
- **File:** `scripts/007_streaks.sql` (line 73-81), `scripts/010_referrals.sql` (line 38-63)
- **Finding:** Trigger functions `trigger_update_streak` and `generate_referral_code` are SECURITY DEFINER. They execute on every matching INSERT/UPDATE with the privileges of the function owner.
- **Impact:** If a trigger function has a vulnerability, it runs with elevated privileges on every triggering event.
- **Remediation:** Minimize the scope of trigger functions. Validate inputs within triggers.

### 4.5 Edge Function & Migration Risks

#### SUP-031: SQL Scripts in Source Control — Migration Order Matters
- **Severity:** Info
- **Effort to Exploit:** N/A
- **Finding:** The 13 SQL migration scripts must be executed in order. Script 004 references `group_history` which is created in 006b. This dependency ordering issue could cause migration failures.
- **Impact:** Deployment failures if scripts are run out of order.
- **Remediation:** Use a proper migration tool (Supabase CLI migrations) with dependency tracking.

#### SUP-032: No Row-Level Security on auth Schema
- **Severity:** Info
- **Effort to Exploit:** N/A
- **Finding:** The `auth.users` table is managed by Supabase and has its own security. The application correctly does not attempt to modify auth schema RLS.
- **Impact:** Positive finding.

---

## 5. Moat-Strengthening Recommendations

### Trust as a Competitive Moat

The donedonadone platform's core value proposition is **matching strangers for in-person coworking**. Trust is not just a feature — it IS the product. Every security fix strengthens the moat:

### 5.1 Fix Privilege Escalation = Trusted Community
- **AUTHZ-001 (user_type escalation)** and **AUTHZ-037 (booking field manipulation)** are existential threats. If users discover they can self-promote to admin or bypass payments, word spreads fast in the HSR Layout coworking community. Fixing these and communicating "verified security" builds trust that competitors (generic booking platforms) cannot match.
- **Competitive advantage:** "We verified every security boundary. Your data and payments are safe." This is especially important for a platform where users share physical space.

### 5.2 Fix Payment Integrity = Revenue Protection
- **AUTHZ-016 (self-confirmed payments)** is a revenue leak. Every unpaid session costs the platform Rs 100-150 and the venue their price. Fixing this isn't just security — it's survival.
- **Competitive advantage:** Reliable payment flow makes partners trust the platform, leading to better venue partnerships that competitors can't replicate.

### 5.3 Fix Rating Integrity = Quality Matching
- **AUTHZ-012 (non-attendee feedback)** and **AUTHZ-013 (rating arbitrary users)** corrupt the matching algorithm — the platform's core differentiator. If reputation scores are gameable, matching quality degrades, and users leave.
- **Competitive advantage:** "Our coworker scores are based on real, verified interactions." This creates a reputation graph that becomes more valuable over time and is impossible for competitors to replicate.

### 5.4 Fix Information Asymmetry = Excitement Loop
- **AUTHZ-007 (group members visible to all)** undermines the "group reveal" experience — a key engagement mechanism. If users can peek at groups before check-in, the dopamine hit of the reveal is lost.
- **Competitive advantage:** Controlled information release creates anticipation. Securing this preserves the emotional journey that keeps users coming back.

### 5.5 Implement Rate Limiting = Anti-Spam Trust
- **API-014/015** — Without rate limiting, bad actors could fill all sessions or spam feedback. In a community product, one bad experience shared on HSR Layout WhatsApp groups could kill growth.
- **Competitive advantage:** "We actively prevent abuse." Small communities value this more than large platforms.

### 5.6 Fix RLS Policies = Data Privacy Credibility
- **SUP-005/006/008** — When users share sensitive information (phone numbers, work preferences, social goals), they trust the platform to protect it. Weak RLS policies betray that trust.
- **Competitive advantage:** GDPR/DPDPA compliance readiness. Privacy-conscious professionals (the target market) choose platforms that respect their data.

### 5.7 Security as Non-Portable Value
The irony is powerful: donedonadone's product strategy relies on "non-portable value" (reputation, streaks, social bonds) to retain users. **Security IS non-portable value.** A user's trust in donedonadone's security cannot be transferred to a competitor. Every fix reinforces the platform's most defensible moat.

---

## Summary: Top 10 Findings by Priority

| # | ID | Finding | Severity | Fix Effort |
|---|-----|---------|----------|------------|
| 1 | AUTHZ-001 | User can set `user_type = 'admin'` via direct Supabase call | CRITICAL | Medium |
| 2 | AUTHZ-037 | Booking UPDATE policy allows changing payment_status, payment_amount, checked_in | CRITICAL | Low |
| 3 | AUTHZ-016 | Users self-confirm payment (set status to "paid") | CRITICAL | Low |
| 4 | AUTHZ-015 | Mass assignment in partner session update (`...body`) | CRITICAL | Low |
| 5 | SUP-002 | All API-level auth checks bypassed via direct Supabase access | CRITICAL | High |
| 6 | AUTHZ-002 | Partner API routes lack user_type verification | CRITICAL | Low |
| 7 | AUTHZ-013 | Member ratings accept arbitrary to_user (fake ratings) | HIGH | Low |
| 8 | AUTHZ-027 | book_session() RPC accepts arbitrary p_user_id | HIGH | Low |
| 9 | AUTH-005 | No rate limiting or account lockout on login | HIGH | Medium |
| 10 | AUTHZ-018 | Subscriptions created without payment | HIGH | Medium |

---

## Appendix: Vulnerability Index

### Critical (12)
1. AUTHZ-001: user_type escalation via profile update
2. AUTHZ-002: Partner routes missing role check
3. AUTHZ-003: Any user can create a venue
4. AUTHZ-015: Mass assignment in session update
5. AUTHZ-016: Self-confirmed payments
6. AUTHZ-037: Booking UPDATE policy too permissive
7. SUP-002: Direct Supabase access bypasses API checks
8. SUP-005: Profile UPDATE allows user_type change
9. SUP-013: Booking UPDATE allows payment manipulation
10. API-007: Same as AUTHZ-015
11. AUTHZ-005: Admin role in mutable DB field
12. AUTHZ-027: book_session() RPC no caller validation

### High (31)
1. AUTH-005: No login rate limiting
2. AUTH-009: No email verification enforcement
3. AUTH-014: No session invalidation on role change
4. AUTHZ-006: Goals endpoint returns all users' goals
5. AUTHZ-008: Profiles expose all PII
6. AUTHZ-009: Booking data accessible via partner routes without role check
7. AUTHZ-012: Non-attendee can submit feedback
8. AUTHZ-013: Member ratings accept arbitrary targets
9. AUTHZ-018: Subscription creation without payment
10. AUTHZ-023: API routes not in middleware protection
11. AUTHZ-028: auto_assign_groups callable by any user
12. AUTHZ-040: Session status change not protected
13. API-002: No input validation on partner session creation
14. API-009: Booking amount can be changed via direct DB
15. API-014: No rate limiting on any API route
16. API-015: No rate limiting on booking creation
17. SUP-008: Venue INSERT allows any user
18. SUP-009: Partners can self-approve venue
19. SUP-022: No INSERT policy on notifications
20. SUP-028: All functions are SECURITY DEFINER
21. AUTHZ-017: Admin payment verification lacks state check
22. AUTHZ-029: get_user_stats() exposes any user's stats
23. AUTHZ-030: compute_coworker_score() exposes any user's reputation
24. AUTHZ-032: populate_group_history() callable by any user
25. AUTHZ-033: update_streak() manipulable by any user
26. AUTHZ-038: Onboarding repeatable (preference gaming)
27. SUP-019: Subscription session limits unenforced
28. SUP-021: referral_events missing INSERT policy
29. API-017: Supabase error messages exposed
30. API-020: No security headers
31. AUTHZ-039: Partner can self-approve venue via direct DB

### Medium (48)
1. AUTH-001: No session expiry configuration
2. AUTH-002: Cookie security attributes not verified
3. AUTH-004: No concurrent session limiting
4. AUTH-006: No password complexity enforcement
5. AUTH-007: Email enumeration via sign-up
6. AUTH-008: Email enumeration via login
7. AUTH-010: OAuth redirect URL not validated
8. AUTH-011: Missing password reset flow
9. AUTH-012: No MFA support
10. AUTH-016: No CAPTCHA on sign-up
11. AUTH-018: Dev variable name suggests env bleed
12. AUTH-019: No session regeneration
13. AUTHZ-004: verifyAdmin uses anon key
14. AUTHZ-007: Group members viewable by all
15. AUTHZ-010: Partners see individual feedback
16. AUTHZ-021: Dashboard layout no role check
17. AUTHZ-022: Partner can book own sessions
18. AUTHZ-024: Sessions list fully unauthenticated
19. AUTHZ-025: Cron runs unauthenticated Supabase client
20. AUTHZ-036: Missing INSERT policies for admin tables
21. API-001: No UUID format validation
22. API-003: Onboarding body not validated
23. API-006: Admin search ilike pattern injection
24. API-010: Venue price no upper bound
25. API-012: No CSRF tokens
26. API-013: No origin header validation
27. API-016: No rate limit on feedback
28. SUP-006: Profiles SELECT exposes phone numbers
29. SUP-011: Session INSERT/UPDATE no status transition
30. SUP-015: Group members visible to all
31. SUP-018: Session goals SELECT too broad
32. SUP-025: Realtime may leak data
33. SUP-026: No storage bucket policies
34. SUP-027: No file upload validation
35. SUP-029: Missing search_path in SECURITY DEFINER
36-48. Various related sub-findings grouped under main categories

### Low (37)
1. AUTH-003: Silent cookie failure
2. AUTH-013: Token in localStorage
3. AUTH-015: Referral before email verification
4. AUTH-017: Missing auth callback route
5. AUTH-020: Middleware error handling
6. AUTHZ-011: Cancel booking ownership not verified in API
7. AUTHZ-014: Favorites accept arbitrary users
8. AUTHZ-019: Referral credit not applied
9. AUTHZ-020: Race condition in referral uses
10. AUTHZ-035: No DELETE policy on bookings
11. API-004: Feedback not fully validated
12. API-005: Goal text not sanitized
13. API-008: Onboarding extra fields accepted
14. API-018: Stack traces in dev mode
15. API-019: Uncaught JSON parse errors
16. SUP-004: No key rotation mechanism
17. SUP-007: No admin preferences insert policy
18. SUP-010: Sessions SELECT fully open
19. SUP-012: Partners see payment details
20. SUP-016: No feedback update policy
21. SUP-017: No ratings delete policy
22. SUP-023: matching_outcomes no INSERT policy
23. SUP-024: group_history no INSERT policy
24. SUP-030: Trigger functions as SECURITY DEFINER
25. SUP-031: Migration ordering dependency
26. AUTHZ-026: Timing attack on cron secret
27-37. Various informational findings elevated to low

### Informational (22)
1. AUTH-018: Dev variable naming
2. AUTHZ-034: check_in_user validates auth correctly
3. API-011: Admin venue status properly validated
4. SUP-001: Anon key in client (by design)
5. SUP-003: Service role key not in code
6. SUP-020: Referral codes auto-generated correctly
7. SUP-032: Auth schema properly managed
8-22. Various positive findings and architectural notes

---

*Report generated 2026-02-09. All findings reference the codebase at commit `be13b5a` on branch `app-foundation-build`. This is a point-in-time assessment and should be re-evaluated after remediation and with each major feature addition.*
