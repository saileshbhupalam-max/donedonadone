# 14. Priority Action Plan — Red Team Remediation Roadmap

**Synthesized from:** Reports 01-12 (1,800+ vulnerability vectors across 12 audit domains)
**Target audience:** Solo founder implementing fixes pre-launch and in first 90 days
**Date:** 2026-02-09
**Principle:** LOW EFFORT + HIGH IMPACT first. Ship fixes, not perfection.

---

## Table of Contents

1. [P0 — Must Fix Before Launch (20 items)](#p0--must-fix-before-launch)
2. [P1 — Fix Within First Month (30 items)](#p1--fix-within-first-month)
3. [P2 — Fix Within First Quarter (30 items)](#p2--fix-within-first-quarter)
4. [P3 — Strategic Backlog (20 items)](#p3--strategic-backlog)
5. [Quick Wins (<1 hour each, 20 items)](#quick-wins)
6. [Implementation Sequence (Week-by-Week)](#implementation-sequence)
7. [Cost of Inaction](#cost-of-inaction)

---

## P0 — Must Fix Before Launch

These 20 items represent existential risks. If ANY remain unfixed, the platform can be trivially exploited for financial loss, legal liability, or user harm.

---

### P0-01: Prevent user_type Self-Escalation to Admin

**Source:** Report 01 (AUTHZ-001), Report 03 (#176-177), Report 06 (RLS-002)
**Why P0:** Any authenticated user can run `supabase.from('profiles').update({ user_type: 'admin' }).eq('id', userId)` from browser DevTools. The RLS policy `"Users can update own profile" USING (auth.uid() = id)` has no column restriction. This grants instant admin access to payment verification, user management, and all financial data.
**Specific fix:** Add a database trigger to prevent role escalation:
```sql
-- Run in Supabase SQL editor
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
    RAISE EXCEPTION 'Cannot change user_type directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();
```
**Effort:** 0.5 hours
**Moat impact:** Protects admin integrity, prevents financial fraud, secures all admin-gated features.

---

### P0-02: Prevent Direct Payment Status Manipulation via RLS

**Source:** Report 02 (#21-25), Report 03 (#178-179), Report 06 (RLS-003)
**Why P0:** The RLS policy in `scripts/005_session_day.sql` line 5: `"Users can update own bookings" USING (auth.uid() = user_id)` allows a user to directly call `supabase.from('bookings').update({ payment_status: 'confirmed', checked_in: true }).eq('id', bookingId)` -- bypassing all payment flows. Free sessions for everyone.
**Specific fix:** Replace the broad UPDATE policy with a column-restricted one:
```sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

-- Only allow users to update cancelled_at (for cancellation)
-- All payment/checkin changes must go through RPCs
CREATE POLICY "Users can cancel own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    payment_status = OLD.payment_status AND
    checked_in = OLD.checked_in AND
    payment_reference = OLD.payment_reference AND
    payment_amount = OLD.payment_amount AND
    group_id = OLD.group_id
  );
```
Note: Supabase RLS does not support `OLD` in WITH CHECK. Instead, use an RPC-only approach:
```sql
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
-- No direct update policy for users. All mutations through RPCs.
```
**Effort:** 1 hour
**Moat impact:** Prevents 100% of direct payment bypass attacks. Forces all state changes through validated server-side RPCs.

---

### P0-03: Prevent Direct Subscription Manipulation via RLS

**Source:** Report 02 (#90-93), Report 06 (RLS-001)
**Why P0:** `scripts/009_subscriptions.sql` line 44-46: `"Users update own subscriptions" USING (auth.uid() = user_id)` allows: `supabase.from('user_subscriptions').update({ status: 'active', plan_id: '<pro-plan-uuid>', current_period_end: '2099-12-31', sessions_used: 0 })`. Free unlimited Pro subscription forever.
**Specific fix:**
```sql
DROP POLICY IF EXISTS "Users update own subscriptions" ON user_subscriptions;
-- No user UPDATE policy. All subscription changes through admin/payment-verified RPCs.
```
**Effort:** 0.5 hours
**Moat impact:** Protects subscription revenue. Without this fix, subscription pricing is meaningless.

---

### P0-04: Fix Duplicate Booking Check (Wrong Column Name)

**Source:** Report 02 (#31), Report 04 (#81), Report 06 (SQL-026)
**Why P0:** `app/api/bookings/route.ts` line 53: `.neq("status", "cancelled")` references a column `status` that does not exist on the `bookings` table. The actual column is `payment_status`. This means the duplicate booking check is a complete no-op -- users can book the same session multiple times.
**Specific fix in `app/api/bookings/route.ts` line 53:**
```typescript
// BEFORE (broken):
.neq("status", "cancelled")
// AFTER (fixed):
.is("cancelled_at", null)
```
**Effort:** 0.25 hours
**Moat impact:** Prevents double-bookings that waste session spots and corrupt group assignments.

---

### P0-05: Add auth.uid() Check Inside book_session RPC

**Source:** Report 05 (INFRA-031), Report 06 (SQL-016)
**Why P0:** `book_session(p_session_id, p_user_id)` is SECURITY DEFINER and accepts any `p_user_id`. An attacker can call `supabase.rpc('book_session', { p_session_id: '...', p_user_id: '<victim_id>' })` to book sessions on behalf of other users, consuming their spots or charging their subscriptions.
**Specific fix:** Add inside the `book_session` function body (in `scripts/001_schema.sql`):
```sql
-- Add as the first line inside the function body
IF p_user_id != auth.uid() THEN
  RAISE EXCEPTION 'Unauthorized: cannot book for another user';
END IF;
```
**Effort:** 0.5 hours
**Moat impact:** Prevents impersonation bookings and booking fraud.

---

### P0-06: Secure Cron Endpoint Against Missing/Brute-Forced Secret

**Source:** Report 05 (INFRA-001, INFRA-002, INFRA-003)
**Why P0:** In `app/api/cron/notifications/route.ts` line 10: if `CRON_SECRET` is not set, `process.env.CRON_SECRET` is `undefined`, and sending `Authorization: Bearer undefined` bypasses auth. Also, string comparison with `!==` is not timing-safe.
**Specific fix in `app/api/cron/notifications/route.ts`:**
```typescript
import { timingSafeEqual } from "crypto"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  const expected = `Bearer ${secret}`

  if (
    !authHeader ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // ... rest of handler
}
```
**Effort:** 0.5 hours
**Moat impact:** Prevents unauthorized notification triggering, user data enumeration via cron, and notification spam.

---

### P0-07: Whitelist Fields in Partner Session Update (Remove Spread Operator)

**Source:** Report 03 (#154), Report 06 (SQL-004)
**Why P0:** `app/api/partner/sessions/[id]/route.ts` line 39-41: `...body` spreads the entire request body into the session update. A partner (or anyone who creates a venue) can set `status`, `platform_fee`, `spots_filled`, `max_spots`, or `venue_id`, manipulating pricing and capacity at will.
**Specific fix in `app/api/partner/sessions/[id]/route.ts` lines 37-45:**
```typescript
const { date, start_time, end_time, duration_hours, venue_price, max_spots, description, title } = body

const { data: session, error } = await supabase
  .from("sessions")
  .update({
    date, start_time, end_time, duration_hours,
    venue_price, max_spots, description, title,
    updated_at: new Date().toISOString(),
  })
  .eq("id", id)
  .select()
  .single()
```
**Effort:** 0.5 hours
**Moat impact:** Prevents financial manipulation (changing platform_fee to 0), session hijacking (changing venue_id), and capacity fraud.

---

### P0-08: Add Booking Expiry for Unpaid Bookings

**Source:** Report 02 (#41-43, #46-47, #62)
**Why P0:** Bookings are created in `pending` state with `spots_filled` incremented atomically. There is no expiry -- a user can hold a spot indefinitely without paying. A bot can create 20 bookings to fill all spots in a session, blocking all legitimate users. This is a platform-wide denial-of-service for zero cost.
**Specific fix:** Add `expires_at` column and a cron cleanup:
```sql
ALTER TABLE bookings ADD COLUMN expires_at TIMESTAMPTZ;

-- In book_session RPC, after INSERT:
-- Set expires_at = NOW() + INTERVAL '15 minutes'
```
Add to the cron handler (`app/api/cron/notifications/route.ts`):
```typescript
// Cancel expired unpaid bookings
const { data: expired } = await supabase
  .from("bookings")
  .select("id, session_id")
  .eq("payment_status", "pending")
  .is("cancelled_at", null)
  .lt("expires_at", now.toISOString())

for (const b of expired || []) {
  await supabase.from("bookings").update({
    cancelled_at: now.toISOString(),
    payment_status: "cancelled"
  }).eq("id", b.id)
  // Decrement spots_filled
  await supabase.rpc("decrement_spots", { p_session_id: b.session_id })
}
```
**Effort:** 2 hours
**Moat impact:** Prevents session capacity DoS. Ensures spots are only held by users who intend to pay.

---

### P0-09: Create Terms of Service and Privacy Policy

**Source:** Report 11 (1.1.1-1.1.4, 4.1.1-4.1.3)
**Why P0:** DPDP Act 2023 carries penalties up to Rs 250 Cr for processing personal data without consent. The platform currently collects full name, email, phone, personality data, behavioral preferences, and location check-ins with zero consent, zero privacy policy, and zero terms. This is a hard legal blocker for any public launch in India.
**Specific fix:**
1. Draft Terms of Service covering: service description, user obligations, payment terms, cancellation/refund policy, liability limitations, dispute resolution, governing law (Karnataka).
2. Draft Privacy Policy covering: data collected, purpose of processing, data sharing (group members, partners, admin), retention periods, user rights (access, correction, erasure), cross-border transfer disclosure (Supabase/AWS), contact for grievances.
3. Add consent checkbox to `app/auth/sign-up/page.tsx`:
```tsx
<label className="flex items-center gap-2 text-sm">
  <input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} />
  I agree to the <a href="/terms" className="underline">Terms of Service</a> and{" "}
  <a href="/privacy" className="underline">Privacy Policy</a>
</label>
```
**Effort:** 6 hours (use a template generator, customize for Indian law)
**Moat impact:** Legal compliance is a moat -- competitors who skip this are vulnerable. Also builds user trust.

---

### P0-10: Add GST Registration and Tax Compliance Display

**Source:** Report 11 (2.1.3-2.1.5, 2.1.7)
**Why P0:** Platform collecting Rs 100-150 per session crosses the Rs 20L annual threshold almost immediately. Operating without GST registration is prosecutable under CGST Act S.122. Displaying prices without GST breakdown violates Consumer Protection Act and E-Commerce Rules.
**Specific fix:**
1. Register for GST (offline task, ~2 weeks with CA).
2. Update `lib/config.ts` to include GST calculation:
```typescript
export const GST_RATE = 0.18
export function priceWithGST(basePrice: number): { base: number; gst: number; total: number } {
  const gst = Math.round(basePrice * GST_RATE)
  return { base: basePrice, gst, total: basePrice + gst }
}
```
3. Update all pricing displays to show "Rs X + Rs Y GST = Rs Z total".
**Effort:** 3 hours (code changes) + 2 weeks (registration, parallel task)
**Moat impact:** Compliance as competitive moat. Unregistered competitors face legal risk you do not.

---

### P0-11: Require Email Verification Before Protected Route Access

**Source:** Report 01 (AUTH-009), Report 12 (1.1.1-1.1.4)
**Why P0:** After signup, there is no check that `user.email_confirmed_at` is set before accessing protected routes. An attacker can sign up with a disposable email and immediately book sessions, submit feedback, rate users, and farm referral credits. Combined with self-confirmed payments, this enables zero-cost platform abuse at scale.
**Specific fix in `lib/supabase/proxy.ts` (inside `updateSession` function, after `getUser()`):**
```typescript
const { data: { user } } = await supabase.auth.getUser()

if (user && !user.email_confirmed_at && !request.nextUrl.pathname.startsWith('/auth/')) {
  const url = request.nextUrl.clone()
  url.pathname = '/auth/verify-email'
  return NextResponse.redirect(url)
}
```
Create a simple `/auth/verify-email/page.tsx` that says "Check your email for a confirmation link."
**Effort:** 1 hour
**Moat impact:** Blocks disposable-email bot armies. Every verified email is a real person.

---

### P0-12: Add Refund Policy and Cancellation Terms

**Source:** Report 11 (2.1.8, 4.1.3)
**Why P0:** No refund mechanism exists. Consumer Protection Act 2019 mandates a clearly stated refund policy. Without one, every cancelled booking is a potential consumer forum case (Rs 1L+ per case). The `cancel_booking` RPC is referenced but never defined in any migration, meaning cancellation itself is broken.
**Specific fix:**
1. Implement `cancel_booking` function:
```sql
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID)
RETURNS void AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  IF v_booking.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Booking already cancelled';
  END IF;
  UPDATE bookings SET cancelled_at = NOW(), payment_status = 'cancelled'
    WHERE id = p_booking_id;
  UPDATE sessions SET spots_filled = spots_filled - 1
    WHERE id = v_booking.session_id AND spots_filled > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
2. Display cancellation policy on booking sheet and in Terms of Service.
**Effort:** 2 hours
**Moat impact:** Legal protection from consumer complaints. Clear policy builds trust.

---

### P0-13: Add Safety Reporting Mechanism and User Code of Conduct

**Source:** Report 11 (3.2.4-3.2.6), Report 12 (2.2.1-2.2.5)
**Why P0:** The platform facilitates in-person meetings between strangers with zero safety infrastructure. No SOS button, no reporting mechanism, no code of conduct, no block/ban capability. POSH Act 2013 may apply. A single harassment incident without any reporting mechanism creates severe legal and reputational exposure.
**Specific fix:**
1. Add a `user_reports` table:
```sql
CREATE TABLE user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id),
  reported_user_id UUID REFERENCES profiles(id),
  session_id UUID REFERENCES sessions(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('harassment', 'safety', 'fraud', 'spam', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON user_reports FOR SELECT USING (auth.uid() = reporter_id);
```
2. Add a `blocked_users` table and check in the matching algorithm.
3. Add a "Report" button on the session day group page and feedback form.
4. Create a simple code of conduct page at `/code-of-conduct`.
**Effort:** 4 hours
**Moat impact:** Trust infrastructure is a core moat for a platform facilitating physical meetups.

---

### P0-14: Add Age Verification Checkbox at Signup

**Source:** Report 11 (1.6.1-1.6.4)
**Why P0:** DPDP Act S.9 requires verifiable parental consent for minors. S.18(4) carries penalties up to Rs 200 Cr for children's data violations. The "student" work_type actively suggests the platform expects younger users. A minor's parent filing a DPDP complaint could be existential.
**Specific fix in `app/auth/sign-up/page.tsx`:**
```tsx
<label className="flex items-center gap-2 text-sm">
  <input type="checkbox" required checked={isAdult} onChange={e => setIsAdult(e.target.checked)} />
  I confirm I am 18 years of age or older
</label>
```
Block signup submission if unchecked.
**Effort:** 0.25 hours
**Moat impact:** Minimal effort for critical legal protection.

---

### P0-15: Restrict Profiles Table SELECT to Prevent Mass PII Harvesting

**Source:** Report 03 (#4-5, #55), Report 04 (#9)
**Why P0:** `scripts/001_schema.sql` line 250: `CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true)`. Any authenticated user can call `supabase.from('profiles').select('phone, display_name, work_type, industry, bio')` to harvest ALL users' personal data including phone numbers.
**Specific fix:**
```sql
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- Users can see their own full profile
CREATE POLICY "Users view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Others can see only limited fields via an RPC
CREATE OR REPLACE FUNCTION get_limited_profile(p_user_id UUID)
RETURNS TABLE(id UUID, display_name TEXT, avatar_url TEXT, work_type TEXT) AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.display_name, p.avatar_url, p.work_type
    FROM profiles p WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
Update API routes that need to display other users' data to use the RPC instead of direct queries.
**Effort:** 3 hours (policy change + update 5-6 API routes)
**Moat impact:** DPDP compliance. Prevents data harvesting. Protects information asymmetry (core product feature).

---

### P0-16: Restrict group_members and groups SELECT Policies

**Source:** Report 03 (#6-7), Report 04 (#58)
**Why P0:** `groups` and `group_members` have `FOR SELECT USING (true)` -- any authenticated user can enumerate all group memberships across all sessions, building a complete social graph and location history for every user.
**Specific fix:**
```sql
DROP POLICY IF EXISTS "Groups viewable by all" ON groups;
DROP POLICY IF EXISTS "Group members viewable by all" ON group_members;

-- Users can see groups for sessions they have a booking for
CREATE POLICY "Groups viewable by session participants" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.session_id = groups.session_id
        AND b.user_id = auth.uid()
        AND b.cancelled_at IS NULL
    )
  );

CREATE POLICY "Group members viewable by session participants" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN bookings b ON b.session_id = g.session_id
      WHERE g.id = group_members.group_id
        AND b.user_id = auth.uid()
        AND b.cancelled_at IS NULL
    )
  );
```
**Effort:** 1 hour
**Moat impact:** Prevents social graph harvesting. Protects user location patterns.

---

### P0-17: Add Venue Rating Key Whitelist in Feedback Endpoint

**Source:** Report 06 (SQL-003)
**Why P0:** `app/api/session/[id]/feedback/route.ts` lines 121-127 accept any key starting with `venue_` from user input and write it into the database row. An attacker could write to unintended columns.
**Specific fix in `app/api/session/[id]/feedback/route.ts`:**
```typescript
const ALLOWED_VENUE_KEYS = ['venue_wifi', 'venue_ambiance', 'venue_fnb', 'venue_service', 'venue_power', 'venue_noise', 'venue_cleanliness']

if (venue_ratings && typeof venue_ratings === "object") {
  for (const [key, value] of Object.entries(venue_ratings)) {
    if (ALLOWED_VENUE_KEYS.includes(key) && typeof value === "number" && value >= 1 && value <= 5) {
      feedbackRow[key] = value
    }
  }
}
```
**Effort:** 0.25 hours
**Moat impact:** Prevents arbitrary column writes. Standard input validation hygiene.

---

### P0-18: Add partner user_type Verification to All Partner API Routes

**Source:** Report 01 (AUTHZ-002)
**Why P0:** None of the partner API routes verify `user_type === 'partner'`. A coworker could create a venue via direct Supabase call (RLS allows `partner_id = auth.uid()` for INSERT), then access all partner endpoints. This allows any user to create venues, sessions, and access partner financial dashboards.
**Specific fix:** Create a helper and apply to all partner routes. In `lib/partner.ts`:
```typescript
export async function verifyPartner(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .single()
  return profile?.user_type === 'partner'
}
```
In each partner route (venue, sessions, bookings, earnings, stats, analytics):
```typescript
if (!(await verifyPartner(supabase, user.id))) {
  return NextResponse.json({ error: "Not a partner" }, { status: 403 })
}
```
Also add an RLS restriction on venues INSERT:
```sql
-- Restrict venue creation to partners only
DROP POLICY IF EXISTS "Partners can manage own venues" ON venues;
CREATE POLICY "Partners can insert own venues" ON venues
  FOR INSERT WITH CHECK (
    auth.uid() = partner_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'partner')
  );
```
**Effort:** 1.5 hours
**Moat impact:** Prevents coworker-to-partner privilege escalation. Protects venue integrity.

---

### P0-19: Remove Hardcoded Social Proof Numbers from Landing Page

**Source:** Report 07 (4.1.8)
**Why P0:** The landing page displays hardcoded "1,000+ coworkers", "500+ sessions" etc. When real numbers are zero at launch, this is false advertising under Consumer Protection Act 2019 and destroys trust the moment a user realizes the deception. First users who see "1000+ coworkers" and then get grouped with the founder alone will never return.
**Specific fix:** In landing page components, replace hardcoded numbers with honest language:
```tsx
// BEFORE:
<span>1,000+ coworkers</span>
// AFTER:
<span>Join our growing community</span>
// Or show real numbers from the database once you have them
```
**Effort:** 0.5 hours
**Moat impact:** Authentic social proof builds real trust. Fake numbers create irreversible trust debt.

---

### P0-20: Add Security Headers via next.config.mjs

**Source:** Report 05 (INFRA-017 through INFRA-022)
**Why P0:** Zero security headers exist -- no CSP, no HSTS, no X-Frame-Options, no Referrer-Policy. The platform is fully vulnerable to XSS payload execution, clickjacking, and SSL stripping (especially relevant at cafe WiFi networks where users will be).
**Specific fix in `next.config.mjs`:**
```javascript
const nextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' https://fonts.gstatic.com;" },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
  // ... existing config
}
```
**Effort:** 0.5 hours
**Moat impact:** Baseline security posture. Prevents XSS-based token theft, clickjacking payment confirmations, and SSL stripping on cafe WiFi.

---

## P1 — Fix Within First Month

These 30 items should be fixed within the first 30 days post-launch. They prevent significant abuse but are not immediate existential risks.

---

### P1-01: Add CAPTCHA to Signup Form
**Source:** Report 01 (AUTH-005, AUTH-016), Report 12 (1.1.3)
**Why P1:** Without CAPTCHA, bot-driven account creation enables referral farming, session DoS, and Sybil attacks.
**Fix:** Add Cloudflare Turnstile (free tier) to `app/auth/sign-up/page.tsx`. Add the Turnstile script tag and validate the token server-side.
**Effort:** 2 hours
**Moat:** Blocks automated abuse at the front door.

### P1-02: Add Rate Limiting to API Routes
**Source:** Report 05 (INFRA-002), Report 07 (1.1.1)
**Why P1:** Zero rate limiting on all endpoints. Booking endpoint, referral code lookup, payment PATCH, and admin verification are all unbounded.
**Fix:** Use Vercel Edge Middleware with a simple IP-based rate limiter (use `@upstash/ratelimit` with Upstash Redis -- free tier):
```typescript
// middleware.ts — add rate limiting for API routes
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "60 s"), // 30 requests per minute
})
```
**Effort:** 3 hours
**Moat:** Prevents brute-force attacks, referral code enumeration, and API abuse.

### P1-03: Validate member_ratings to_user Against Group Membership
**Source:** Report 03 (#143), Report 04 (#105-106), Report 06 (SQL-031)
**Why P1:** The feedback endpoint accepts `to_user` UUIDs without verifying the target was in the same group. An attacker can rate arbitrary users.
**Fix in `app/api/session/[id]/feedback/route.ts`:** Before inserting member_ratings, query `group_members` for the user's group, collect valid member IDs, and validate each `to_user` against that list.
**Effort:** 1.5 hours
**Moat:** Protects reputation system integrity.

### P1-04: Add Forgot Password Flow
**Source:** Report 01 (AUTH-011), Report 09 (1.8)
**Why P1:** No password reset mechanism. Locked-out users have no recovery path.
**Fix:** Create `app/auth/forgot-password/page.tsx` using `supabase.auth.resetPasswordForEmail()`. Add a link on the login page.
**Effort:** 1.5 hours
**Moat:** Basic user experience expectation.

### P1-05: Enforce Check-in Only for confirmed (Admin-Verified) Payments
**Source:** Report 02 (#44), Report 04 (#61, #83)
**Why P1:** Check-in accepts `payment_status IN ('paid', 'confirmed')` but "paid" is self-attested. Users who never actually paid can check in and attend sessions for free.
**Fix in `scripts/005_session_day.sql` (check_in_user function):** Change `IN ('paid', 'confirmed')` to `= 'confirmed'`. Until automated payment verification is implemented, rely on admin confirmation.
**Effort:** 0.25 hours
**Moat:** Closes the free-attendance loophole.

### P1-06: Add robots.txt and X-Robots-Tag
**Source:** Report 05 (INFRA-027)
**Why P1:** Admin, partner dashboard pages could be indexed by search engines.
**Fix:** Create `public/robots.txt`:
```
User-agent: *
Disallow: /admin
Disallow: /partner
Disallow: /api
Disallow: /dashboard
Disallow: /session
Disallow: /onboarding
```
**Effort:** 0.25 hours
**Moat:** Prevents search engine indexing of sensitive pages.

### P1-07: Return Generic Error Messages on Login/Signup
**Source:** Report 01 (AUTH-007, AUTH-008)
**Why P1:** Error messages distinguish between "User already registered" and other states, enabling email enumeration.
**Fix in `app/auth/login/page.tsx` and `app/auth/sign-up/page.tsx`:** Always return generic messages:
```typescript
setError("Invalid email or password")  // login
setError("If this email is not already registered, you will receive a confirmation link.") // signup
```
**Effort:** 0.25 hours
**Moat:** Blocks email enumeration attacks.

### P1-08: Move UPI VPA to Server-Only Environment Variable
**Source:** Report 02 (#9-11), Report 05 (INFRA-006, INFRA-007)
**Why P1:** `NEXT_PUBLIC_UPI_VPA` exposes the payment address in client-side JavaScript. Hardcoded fallback `"donedonadone@upi"` also leaks in source code.
**Fix in `lib/payments.ts`:**
```typescript
// Remove NEXT_PUBLIC_ prefix. Access only server-side.
const UPI_VPA = process.env.UPI_VPA
if (!UPI_VPA) throw new Error("UPI_VPA environment variable is required")
```
Ensure `generateUPILink` is only called from API routes (server-side), never from client components.
**Effort:** 1 hour
**Moat:** Prevents payment phishing and UPI address spoofing.

### P1-09: Add Entity Registration Details to Footer
**Source:** Report 11 (4.2.1, 4.1.9)
**Why P1:** E-Commerce Rules 2020 R.4 requires display of legal name, address, CIN. Missing entirely.
**Fix:** Add to `components/landing/footer.tsx`:
```tsx
<p className="text-xs text-muted-foreground mt-4">
  [Company Name] | CIN: [number] | Registered Address: [address]
  | Email: support@donedonadone.com | Grievance Officer: [name], [email]
</p>
```
**Effort:** 0.5 hours
**Moat:** Legal compliance. Builds trust.

### P1-10: Add Google OAuth Login
**Source:** Report 09 (1.1)
**Why P1:** No social login loses 40-60% of signups. Target demographic (remote workers) expect Google login.
**Fix:** Enable Google provider in Supabase dashboard. Add Google button to `app/auth/login/page.tsx` and `app/auth/sign-up/page.tsx`:
```typescript
await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })
```
Create `app/auth/callback/route.ts` for token exchange.
**Effort:** 2 hours
**Moat:** Dramatically reduces signup friction. Single biggest conversion improvement.

### P1-11: Make Onboarding Quiz Skippable
**Source:** Report 09 (1.4)
**Why P1:** 7-step mandatory quiz before any value delivery loses 50%+ of users.
**Fix:** Add "Skip for now" button to onboarding wizard that sets `onboarding_complete: true` with default preferences. Show a banner on dashboard prompting completion later.
**Effort:** 1 hour
**Moat:** Reduces time-to-value from 23 steps to ~5 steps.

### P1-12: Implement Actual UPI QR Code (Replace Mock)
**Source:** Report 09 (2.1, 2.2)
**Why P1:** The payment UI shows a placeholder dashed box, not an actual QR code. Payment literally cannot work.
**Fix:** Install `qrcode` npm package. In the booking payment API, generate QR from the UPI link:
```typescript
import QRCode from 'qrcode'
const upiLink = generateUPILink({ amount, bookingId })
const qrDataUrl = await QRCode.toDataURL(upiLink)
return NextResponse.json({ qrDataUrl, upiLink })
```
Display `qrDataUrl` as an `<img>` in the booking sheet.
**Effort:** 2 hours
**Moat:** Makes payment functional. Without this, revenue is literally zero.

### P1-13: Only Count "confirmed" Status in Revenue KPIs
**Source:** Report 02 (#73-74)
**Why P1:** Admin financials count `paid` (self-attested) same as `confirmed` (admin-verified) in revenue. Partner earnings count all non-cancelled bookings.
**Fix in `app/api/admin/financials/route.ts` and `app/api/partner/earnings/route.ts`:** Change filters to `.eq("payment_status", "confirmed")` for all revenue calculations.
**Effort:** 0.5 hours
**Moat:** Accurate financial reporting is essential for business decisions.

### P1-14: Add per-user Concurrent Booking Limit
**Source:** Report 02 (#46-47)
**Why P1:** No limit on how many active bookings a user can have. Bot creates 100 bookings across all sessions, blocking all legitimate users.
**Fix in `app/api/bookings/route.ts`:** Before booking, count active bookings:
```typescript
const { count } = await supabase.from("bookings").select("id", { count: 'exact', head: true })
  .eq("user_id", user.id).is("cancelled_at", null).in("payment_status", ["pending", "paid", "confirmed"])
if ((count || 0) >= 5) {
  return NextResponse.json({ error: "Maximum 5 active bookings allowed" }, { status: 429 })
}
```
**Effort:** 0.5 hours
**Moat:** Prevents platform-wide booking DoS.

### P1-15: Validate UUID Format on All Route Parameters
**Source:** Report 06 (SQL-007)
**Why P1:** Malformed UUIDs cause PostgreSQL errors that may leak schema information.
**Fix:** Create a helper in `lib/utils.ts`:
```typescript
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}
```
Use at the top of every `[id]` route handler.
**Effort:** 1 hour
**Moat:** Information disclosure prevention. Clean error handling.

### P1-16: Add Subscription Plan Write Protection
**Source:** Report 02 (#117-118)
**Why P1:** No RLS INSERT/UPDATE/DELETE restriction on `subscription_plans` table. Any authenticated user can modify plan features, prices, or create new plans.
**Fix:**
```sql
CREATE POLICY "Only admins can modify plans" ON subscription_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
```
**Effort:** 0.25 hours
**Moat:** Protects pricing integrity.

### P1-17: Implement Referral Credit Cap and Require Session Completion
**Source:** Report 07 (1.1.1-1.1.4)
**Why P1:** No cap on referral credits per user, no requirement that the referred user completes a session. Unlimited free credits via bot farms.
**Fix:** Add `max_uses INTEGER DEFAULT 20` column to `referral_codes`. In `app/api/referrals/route.ts`, check `referralCode.uses < referralCode.max_uses`. Move credit granting to post-first-session (via check-in trigger).
**Effort:** 2 hours
**Moat:** Prevents referral fraud while keeping the viral loop functional.

### P1-18: Require checked_in = TRUE Before Feedback Submission
**Source:** Report 04 (#112), Report 12 (3.1.2)
**Why P1:** Users who never attended can submit ratings. Ghost raters affect reputation.
**Fix in `app/api/session/[id]/feedback/route.ts`:** Add to the booking verification:
```typescript
.eq("checked_in", true)
```
**Effort:** 0.25 hours
**Moat:** Only people who were physically present can rate. Higher quality reputation data.

### P1-19: Add Payment State Machine Enforcement
**Source:** Report 02 (#23-24)
**Why P1:** No state machine prevents backward state transitions (cancelled -> paid).
**Fix:**
```sql
CREATE OR REPLACE FUNCTION enforce_payment_state_machine()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_status = 'confirmed' AND NEW.payment_status != 'refunded' THEN
    RAISE EXCEPTION 'Cannot change from confirmed except to refunded';
  END IF;
  IF OLD.payment_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of cancelled booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_state_check BEFORE UPDATE OF payment_status ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_state_machine();
```
**Effort:** 1 hour
**Moat:** Prevents payment status manipulation.

### P1-20: Add Self-Rating Prevention in Feedback
**Source:** Report 04 (#107)
**Why P1:** Feedback endpoint does not check `to_user != user.id`.
**Fix in `app/api/session/[id]/feedback/route.ts`:**
```typescript
const validRatings = member_ratings.filter((mr: any) => mr.to_user !== user.id)
```
**Effort:** 0.25 hours
**Moat:** Prevents self-inflated reputation.

### P1-21: Add Minimum Payment Amount CHECK Constraint
**Source:** Report 02 (#48, #50)
**Why P1:** If session `total_price` is 0, free bookings are possible.
**Fix:**
```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_amount_positive CHECK (payment_amount > 0);
ALTER TABLE sessions ADD CONSTRAINT sessions_platform_fee_valid CHECK (platform_fee IN (100, 150));
```
**Effort:** 0.25 hours
**Moat:** Prevents zero-price session exploits.

### P1-22: Disable Source Maps in Production
**Source:** Report 05 (INFRA-012)
**Why P1:** Source maps expose full application logic to anyone with browser dev tools.
**Fix in `next.config.mjs`:**
```javascript
productionBrowserSourceMaps: false,
```
**Effort:** 0.1 hours
**Moat:** Raises attacker effort to understand business logic.

### P1-23: Add Env Var Validation at Build Time
**Source:** Report 05 (INFRA-009)
**Why P1:** Missing env vars cause silent failures (undefined comparisons, broken auth).
**Fix:** Create `lib/env.ts`:
```typescript
import { z } from 'zod'
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  UPI_VPA: z.string().includes('@'),
})
export const env = envSchema.parse(process.env)
```
Import in server-side files that use env vars.
**Effort:** 1 hour
**Moat:** Prevents misconfigured deployments.

### P1-24: Add Cancel Confirmation Dialog
**Source:** Report 09 (2.18)
**Why P1:** One-tap cancel with no confirmation loses revenue from accidental cancels.
**Fix:** Add `AlertDialog` from shadcn/ui around the cancel button in the bookings UI.
**Effort:** 0.5 hours
**Moat:** Prevents accidental revenue loss.

### P1-25: Fix Feedback Form Error Handling
**Source:** Report 09 (3.30)
**Why P1:** `handleSubmit` in feedback form has no error handling. If submission fails, user sees nothing.
**Fix:** Add try/catch with error state display in the feedback form component.
**Effort:** 0.5 hours
**Moat:** Prevents data loss. Users who gave feedback that silently failed will not give it again.

### P1-26: Add Account Deletion Capability
**Source:** Report 09 (4.32), Report 11 (1.4.1)
**Why P1:** DPDP Act S.13 right to erasure. No mechanism exists.
**Fix:** Add an API route that calls `supabase.auth.admin.deleteUser(userId)` (requires service role key). Existing `ON DELETE CASCADE` will clean up related data. Add a "Delete Account" button on profile page with confirmation dialog.
**Effort:** 2 hours
**Moat:** DPDP compliance. Builds trust.

### P1-27: Restrict get_user_stats and compute_coworker_score to Own User
**Source:** Report 03 (#172-173), Report 06 (SQL-019, SQL-020)
**Why P1:** These RPCs accept any user_id, exposing stats and reputation for anyone.
**Fix:** Add inside each function body:
```sql
IF p_user_id != auth.uid() THEN
  RAISE EXCEPTION 'Cannot view other users stats';
END IF;
```
**Effort:** 0.5 hours
**Moat:** Prevents competitive intelligence harvesting between users.

### P1-28: Add Content Moderation for User-Generated Text
**Source:** Report 12 (4.1.1, 4.1.3, 4.2.1)
**Why P1:** Goal text, feedback comments, display names, and bios have no content filtering.
**Fix:** Create a simple profanity/content filter in `lib/moderation.ts` using a blocklist. Apply to all user-generated text endpoints.
**Effort:** 2 hours
**Moat:** Prevents harassment, offensive content, and contact info sharing that enables disintermediation.

### P1-29: Add Feedback Submission Time Window
**Source:** Report 04 (#113, #148)
**Why P1:** Feedback can be submitted for sessions arbitrarily far in the past or even future sessions.
**Fix in `app/api/session/[id]/feedback/route.ts`:** Check session date:
```typescript
const sessionDate = new Date(booking.sessions.date)
const daysSince = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
if (daysSince > 7 || daysSince < 0) {
  return NextResponse.json({ error: "Feedback window has closed" }, { status: 400 })
}
```
**Effort:** 0.5 hours
**Moat:** Prevents delayed reputation attacks and future-session feedback gaming.

### P1-30: Add Unique Payment Reference Constraint
**Source:** Report 02 (#4, #8)
**Why P1:** Same UPI reference can be reused across multiple bookings. One payment for many bookings.
**Fix:**
```sql
CREATE UNIQUE INDEX bookings_payment_ref_unique
  ON bookings(payment_reference)
  WHERE payment_reference IS NOT NULL AND payment_status != 'cancelled';
```
**Effort:** 0.25 hours
**Moat:** Each payment can only confirm one booking.

---

## P2 — Fix Within First Quarter

These 30 items improve platform quality, close secondary abuse vectors, and build competitive moat.

---

### P2-01: Implement Razorpay/Cashfree Payment Gateway Integration
**Source:** Report 02 (entire section 1.1), Report 07 (2.5.4)
**Fix:** Replace self-attested UPI with Razorpay webhook verification. This eliminates 83+ payment fraud vectors.
**Effort:** 8 hours | **Moat:** Automated payment verification at scale.

### P2-02: Implement Automated Group Assignment Cron
**Source:** Report 08 (#104)
**Fix:** Auto-trigger `auto_assign_groups` at T-2h before session start via cron.
**Effort:** 2 hours | **Moat:** Removes manual admin bottleneck.

### P2-03: Add WhatsApp Share Button for Referral Code
**Source:** Report 07 (1.3.3)
**Fix:** Add `whatsapp://send?text=...` deep link button on dashboard/profile.
**Effort:** 0.5 hours | **Moat:** Dramatically improves referral sharing rate.

### P2-04: Build PWA Manifest and Service Worker
**Source:** Report 09 (5.1)
**Fix:** Add `manifest.json` and basic service worker for "Add to Home Screen".
**Effort:** 2 hours | **Moat:** Native app feel without App Store friction.

### P2-05: Add Calendar Integration (Add to Google Calendar)
**Source:** Report 09 (2.15)
**Fix:** Generate Google Calendar link after booking confirmation.
**Effort:** 1 hour | **Moat:** Reduces no-shows significantly.

### P2-06: Improve Touch Targets to 44x44px Minimum
**Source:** Report 09 (5.2, 3.40)
**Fix:** Update venue rating buttons, energy match buttons, member tag pills to meet accessibility guidelines.
**Effort:** 1.5 hours | **Moat:** Accessible UX is a quality signal.

### P2-07: Add Referral Deep Link with Auto-Fill
**Source:** Report 07 (1.3.7)
**Fix:** Create route `/r/[code]` that redirects to signup with code pre-filled.
**Effort:** 1 hour | **Moat:** Reduces referral friction from 3 steps to 1.

### P2-08: Add Progressive Disclosure to Feedback Form
**Source:** Report 09 (3.12, 3.13)
**Fix:** Break feedback into 3 collapsible sections: Session Rating, Venue Rating, Member Ratings. Default to collapsed for venue and member ratings.
**Effort:** 2 hours | **Moat:** Higher feedback completion rate = better data quality.

### P2-09: Add Cookie Security Attributes
**Source:** Report 01 (AUTH-002)
**Fix:** Explicitly enforce `Secure`, `SameSite`, `HttpOnly` in cookie options.
**Effort:** 0.5 hours | **Moat:** Transport security.

### P2-10: Implement Subscription Period Expiry Check
**Source:** Report 02 (#109-110)
**Fix:** Add a cron check: if `current_period_end < NOW()`, set `status = 'expired'`.
**Effort:** 1 hour | **Moat:** Prevents perpetual subscriptions.

### P2-11: Add Data Processing Agreement with Supabase
**Source:** Report 11 (1.5.2)
**Fix:** Sign Supabase's standard DPA. Verify data region (use ap-south-1 Mumbai).
**Effort:** 1 hour (sign document) | **Moat:** DPDP compliance for cross-border data.

### P2-12: Add Matching Algorithm Randomization
**Source:** Report 04 (#19-21), Report 08 (#2)
**Fix:** Shuffle the user array before seeding: `v_users := array_shuffle(v_users)` in `auto_assign_groups`.
**Effort:** 0.5 hours | **Moat:** Prevents seed position gaming.

### P2-13: Add Anti-Collusion Detection for Preference Clusters
**Source:** Report 04 (#11-13)
**Fix:** Log preference changes with timestamps. Flag users who change preferences to match another user within 24h of a session.
**Effort:** 3 hours | **Moat:** Protects algorithmic integrity.

### P2-14: Implement Negative Rating Penalty in Matching
**Source:** Report 04 (#80)
**Fix:** Add `-3` penalty when `would_cowork_again = FALSE` in `auto_assign_groups`, in addition to existing positive bonus.
**Effort:** 0.5 hours | **Moat:** Prevents repeated bad pairings.

### P2-15: Add Preference Change Rate Limiting
**Source:** Report 04 (#1, #8)
**Fix:** Track `preferences_updated_at` in `coworker_preferences`. Allow changes max once per 7 days.
**Effort:** 1 hour | **Moat:** Prevents preference gaming for targeted grouping.

### P2-16: Add Funnel Analytics Tracking
**Source:** Report 09 (1.50)
**Fix:** Add event tracking (Mixpanel/PostHog free tier) on each signup step, onboarding step, and booking step.
**Effort:** 3 hours | **Moat:** Data-driven conversion optimization.

### P2-17: Add First-Session Onboarding Tour
**Source:** Report 09 (4.12)
**Fix:** Use a tooltip library to guide new users through their first dashboard visit.
**Effort:** 2 hours | **Moat:** Reduces first-session confusion, improves retention.

### P2-18: Make Wrapped Page Shareable
**Source:** Report 09 (4.8), Report 07 (6.x)
**Fix:** Add OpenGraph meta tags and a "Share to WhatsApp" button on `/dashboard/wrapped`.
**Effort:** 2 hours | **Moat:** Viral loop via highest-shareability feature.

### P2-19: Add Venue Photos Upload
**Source:** Report 09 (2.10)
**Fix:** Use Supabase Storage for venue photo uploads. Display on session cards and venue detail.
**Effort:** 4 hours | **Moat:** Visual trust for venue-based product.

### P2-20: Add Pricing Page (/pricing)
**Source:** Report 09 (4.20)
**Fix:** The subscription management link goes to `/pricing` which does not exist. Create the page.
**Effort:** 2 hours | **Moat:** Active subscription pages reduce churn.

### P2-21: Add Geolocation Check-In Verification
**Source:** Report 04 (#83), Report 09 (3.4)
**Fix:** Request browser geolocation on check-in. Compare against venue lat/lng with 500m tolerance.
**Effort:** 3 hours | **Moat:** Prevents remote check-in. Validates attendance.

### P2-22: Implement Session Status Auto-Transitions
**Source:** Report 08 (#105)
**Fix:** Cron job: upcoming -> in_progress at start_time, in_progress -> completed at end_time.
**Effort:** 1 hour | **Moat:** Removes manual admin burden.

### P2-23: Add Partner KYC Fields
**Source:** Report 11 (2.3.4)
**Fix:** Add PAN, GSTIN, bank_account fields to venues table. Require during partner onboarding.
**Effort:** 2 hours | **Moat:** Tax compliance for TDS obligations.

### P2-24: Add Timezone-Aware Date Handling
**Source:** Report 04 (#84), Report 09 (4.47)
**Fix:** Use `Asia/Kolkata` consistently in all date comparisons. Replace `new Date().toISOString().split("T")[0]` with proper IST date formatting.
**Effort:** 2 hours | **Moat:** Prevents off-by-one-day bugs near midnight.

### P2-25: Restrict matching_outcomes Read Access to Admin Only
**Source:** Report 04 (#59)
**Fix:** Users can currently see their own matching_outcomes, exposing exact algorithm scoring.
```sql
DROP POLICY IF EXISTS "Users view own matching outcomes" ON matching_outcomes;
```
**Effort:** 0.25 hours | **Moat:** Prevents algorithm reverse-engineering.

### P2-26: Add Overlapping Session Time Check
**Source:** Report 04 (#63)
**Fix:** In `app/api/bookings/route.ts`, before booking, check for time overlap with existing bookings.
**Effort:** 1.5 hours | **Moat:** Prevents session shopping and multi-venue booking exploits.

### P2-27: Implement Automated Waitlist Promotion
**Source:** Report 08 (#107)
**Fix:** When a booking is cancelled, auto-notify top waitlisted user.
**Effort:** 2 hours | **Moat:** Maximizes session fill rate.

### P2-28: Add Onboarding Completion Requirement Before Booking
**Source:** Report 04 (#49, #76)
**Fix:** In booking API, check `profile.onboarding_complete === true`. Redirect to onboarding if not.
**Effort:** 0.5 hours | **Moat:** Better matching data quality.

### P2-29: Add Post-Session "Book Next Session" CTA
**Source:** Report 09 (3.35)
**Fix:** After feedback submission, show a "Book your next session" prompt with recommended sessions.
**Effort:** 1 hour | **Moat:** Retention hook at highest-engagement moment.

### P2-30: Implement Venue Partner Agreement Template
**Source:** Report 11 (2.3.1)
**Fix:** Create a standard partner agreement covering revenue share, payment terms, exclusivity, liability, and data handling. Require digital signature during partner onboarding.
**Effort:** 4 hours | **Moat:** Venue lock-in and legal protection.

---

## P3 — Strategic Backlog

These 20 items strengthen the moat long-term but are not urgent for the first 90 days.

---

| # | Item | Source | Effort | Moat Impact |
|---|------|--------|--------|-------------|
| P3-01 | Implement ML-based matching weights learned from matching_outcomes + feedback | Report 08 (#3-4) | 40h | 10/10 -- This IS the moat |
| P3-02 | Build A/B testing infrastructure for algorithm variants | Report 08 (#42, #58) | 20h | 9/10 |
| P3-03 | Implement churn prediction model | Report 08 (#63) | 20h | 8/10 |
| P3-04 | Build user embedding vector store (pgvector) | Report 08 (#57) | 15h | 9/10 |
| P3-05 | Implement demand forecasting for venue/session planning | Report 08 (#64) | 15h | 7/10 |
| P3-06 | Add NLP sentiment analysis on feedback comments | Report 08 (#65) | 10h | 7/10 |
| P3-07 | Open source matching algorithm framework (not weights) | Report 08 (#134) | 8h | 7/10 |
| P3-08 | Implement exploration-exploitation tradeoff in matching | Report 08 (#27) | 15h | 9/10 |
| P3-09 | Build in-app messaging (replace WhatsApp dependency) | Report 10 (2.1.1-2.1.4) | 30h | 8/10 |
| P3-10 | Implement phone number masking for group communications | Report 10 (2.3.6) | 10h | 8/10 |
| P3-11 | Add corporate/team pricing tier | Report 07 (2.6.3) | 15h | 7/10 |
| P3-12 | Implement dynamic pricing (peak/off-peak) | Report 07 (2.6.7) | 10h | 6/10 |
| P3-13 | Build streak milestone celebrations and streak recovery purchase | Report 07 (3.3.1, 3.5.5) | 8h | 7/10 |
| P3-14 | Implement endorsement system for non-portable reputation | Report 10 (3.3.6) | 10h | 8/10 |
| P3-15 | Add venue exclusivity tracking in database and contracts | Report 10 (3.6.1) | 5h | 7/10 |
| P3-16 | Build automated venue quality alerts | Report 08 (#66, #114) | 5h | 6/10 |
| P3-17 | Implement community host/anchor user program | Report 07 (4.4.2) | 8h | 7/10 |
| P3-18 | Add multi-neighborhood support for expansion | Report 07 (4.2.2) | 15h | 6/10 |
| P3-19 | Implement privacy-preserving ML data pipeline | Report 08 (#85) | 20h | 5/10 |
| P3-20 | Build comprehensive admin audit trail for all state changes | Report 02 (#29), Report 04 (#66) | 8h | 5/10 |

---

## Quick Wins

20 items that take less than 1 hour each but have outsized impact. Ordered by impact/effort ratio (highest first).

---

| # | Item | Source | Fix | Time | Impact |
|---|------|--------|-----|------|--------|
| QW-01 | Fix duplicate booking check column name | Report 06 (SQL-026) | Change `.neq("status", "cancelled")` to `.is("cancelled_at", null)` in `app/api/bookings/route.ts:53` | 5 min | CRITICAL -- duplicate bookings |
| QW-02 | Add age verification checkbox | Report 11 (1.6.1) | Add checkbox to signup form | 10 min | CRITICAL -- Rs 200 Cr penalty |
| QW-03 | Disable production source maps | Report 05 (INFRA-012) | Add `productionBrowserSourceMaps: false` to `next.config.mjs` | 2 min | HIGH -- logic exposure |
| QW-04 | Add `self !== target` check on member ratings | Report 04 (#107) | Filter `to_user !== user.id` in feedback route | 5 min | HIGH -- self-rating |
| QW-05 | Require checked_in for feedback | Report 04 (#112) | Add `.eq("checked_in", true)` to feedback booking check | 5 min | HIGH -- ghost raters |
| QW-06 | Return generic auth error messages | Report 01 (AUTH-007-008) | Replace error strings in login/signup pages | 5 min | MEDIUM -- email enum |
| QW-07 | Remove hardcoded social proof numbers | Report 07 (4.1.8) | Replace fake stats on landing page with honest language | 15 min | HIGH -- trust |
| QW-08 | Add robots.txt | Report 05 (INFRA-027) | Create `public/robots.txt` with admin/api disallows | 5 min | MEDIUM -- indexing |
| QW-09 | Whitelist venue rating keys | Report 06 (SQL-003) | Add `ALLOWED_VENUE_KEYS` array check in feedback route | 10 min | HIGH -- column injection |
| QW-10 | Add payment reference uniqueness | Report 02 (#8) | `CREATE UNIQUE INDEX` on payment_reference | 5 min | HIGH -- payment reuse |
| QW-11 | Add minimum payment amount constraint | Report 02 (#48) | `ALTER TABLE bookings ADD CONSTRAINT` | 5 min | HIGH -- free bookings |
| QW-12 | Drop subscription user UPDATE policy | Report 06 (RLS-001) | `DROP POLICY "Users update own subscriptions"` | 2 min | CRITICAL -- free Pro |
| QW-13 | Add platform_fee CHECK constraint | Report 02 (#51) | `ALTER TABLE sessions ADD CONSTRAINT` | 5 min | HIGH -- fee manipulation |
| QW-14 | Fix referral code copy button (no-op handler) | Report 09 (4.15) | Implement `navigator.clipboard.writeText()` in profile page | 15 min | MEDIUM -- referral friction |
| QW-15 | Add confirm password hide/show toggle | Report 09 (1.7) | Add eye icon toggle to password fields | 15 min | MEDIUM -- login friction |
| QW-16 | Add "You can change these anytime" to quiz steps | Report 09 (1.44) | Add reassurance text to onboarding wizard | 5 min | MEDIUM -- completion rate |
| QW-17 | Collapse referral code field on signup | Report 09 (1.9) | Wrap in disclosure: "Have a referral code?" | 15 min | LOW -- visual noise |
| QW-18 | Add subscription_plans write protection | Report 02 (#117-118) | Add admin-only policy to subscription_plans | 5 min | CRITICAL -- plan tampering |
| QW-19 | Restrict matching_outcomes to admin-only | Report 04 (#59) | Drop user SELECT policy on matching_outcomes | 2 min | MEDIUM -- algo secrecy |
| QW-20 | Add `statement_timeout` to auto_assign_groups RPC | Report 08 (#23) | `SET LOCAL statement_timeout = '30s'` at function start | 5 min | MEDIUM -- DoS prevention |

---

## Implementation Sequence

### Pre-Launch Week (Week 0) — "Stop the Bleeding"

**Goal:** Fix all items that allow trivial exploitation with zero cost to the attacker.

| Day | Items | Dependencies | Test Plan |
|-----|-------|-------------|-----------|
| Mon | QW-01 through QW-13 (all quick wins that are SQL/config) | None | Run `npm run build`. Test booking flow end-to-end. Verify duplicate booking is rejected. Verify subscription update is rejected. |
| Tue | P0-01 (role escalation trigger), P0-02 (booking RLS), P0-03 (subscription RLS) | None -- all SQL changes | Test: from browser console, attempt `supabase.from('profiles').update({user_type:'admin'})` -- should fail. Attempt `supabase.from('bookings').update({payment_status:'confirmed'})` -- should fail. Attempt `supabase.from('user_subscriptions').update({status:'active'})` -- should fail. |
| Wed | P0-05 (book_session auth check), P0-06 (cron secret), P0-07 (spread operator), P0-17 (venue keys) | None | Test: call `book_session` RPC with wrong user_id -- should fail. Hit cron endpoint without secret -- should 401. Partner session update with extra fields -- should be ignored. |
| Thu | P0-15 (profiles RLS), P0-16 (groups RLS), P0-18 (partner user_type check) | P0-15 requires updating 5-6 API routes that JOIN profiles | Test: from browser console, `supabase.from('profiles').select('phone')` should return only own profile. `supabase.from('group_members').select('*')` should return only own session groups. Non-partner user hitting /api/partner/* should get 403. |
| Fri | P0-09 (Terms/Privacy), P0-14 (age checkbox), P0-19 (social proof), P0-20 (security headers) | Terms drafting may extend into weekend | Test: Signup form requires checkboxes. Landing page has honest numbers. Check response headers in browser dev tools for CSP, HSTS, etc. |

### Week 1 — "Make Payment Work"

| Day | Items | Dependencies | Test Plan |
|-----|-------|-------------|-----------|
| Mon | P0-10 (GST -- code changes only), P0-11 (email verification), P0-12 (refund/cancel) | None | Test: Prices show GST breakdown. Unverified email user is redirected to verify page. Cancel button works and decrements spots. |
| Tue | P1-12 (actual QR code), P1-08 (server-only UPI VPA) | npm install qrcode | Test: Booking payment step shows real QR code. Client bundle does not contain UPI_VPA string. |
| Wed | P0-08 (booking expiry), P1-14 (concurrent booking limit) | P0-08 needs `expires_at` column migration | Test: Create booking, wait 15 min, verify it auto-cancels. Try creating 6th booking -- should fail. |
| Thu | P1-10 (Google OAuth), P1-04 (forgot password) | Supabase dashboard config | Test: Google login button works. Forgot password sends email. |
| Fri | P1-11 (skippable onboarding), P1-01 (CAPTCHA) | Turnstile dashboard setup | Test: Can skip quiz and browse sessions. Bot signup is blocked by CAPTCHA. |

### Week 2 — "Trust & Safety"

| Day | Items | Dependencies | Test Plan |
|-----|-------|-------------|-----------|
| Mon | P0-13 (safety reporting + user reports table), P1-28 (content moderation) | Schema migration | Test: Report button visible on session page. Profanity in goal text is rejected. |
| Tue | P1-03 (validate member ratings), P1-20 (self-rating prevention), P1-18 (require check-in for feedback) | None | Test: Submit rating for non-group member -- rejected. Self-rating filtered. Non-checked-in user -- feedback rejected. |
| Wed | P1-05 (check-in only for confirmed), P1-19 (payment state machine), P1-13 (revenue KPI fix) | None | Test: User with "paid" (not confirmed) cannot check in. Cannot change payment_status from cancelled to paid. Revenue dashboard shows only confirmed bookings. |
| Thu | P1-17 (referral cap + session requirement), P1-30 (unique payment ref) | None | Test: 21st referral fails. Duplicate payment_reference rejected. |
| Fri | P1-02 (rate limiting), P1-15 (UUID validation) | Upstash Redis setup | Test: Rapid API calls get 429 response. Malformed UUID returns 400 not 500. |

### Week 3 — "UX & Conversion"

| Day | Items | Dependencies | Test Plan |
|-----|-------|-------------|-----------|
| Mon | P1-09 (entity details in footer), P1-07 (generic errors), QW-14 (copy button), QW-15 (password toggle) | None | Test: Footer shows company info. Login error is generic. Referral code copies. Password toggle works. |
| Tue | P1-22 (source maps), P1-23 (env validation), P1-24 (cancel dialog), P1-25 (feedback error handling) | None | Test: Build succeeds. Missing env var causes build error. Cancel shows confirmation. Feedback submission error shows message. |
| Wed | P1-26 (account deletion), P1-27 (restrict RPCs) | Service role key required | Test: Delete account button works. `get_user_stats` with other user_id fails. |
| Thu-Fri | P1-29 (feedback time window), P1-06 (robots.txt), P1-16 (plan write protection), remaining P1s | None | Test: Feedback for 8-day-old session fails. robots.txt accessible. subscription_plans INSERT fails for non-admin. |

### Week 4 — "Growth & Polish"

| Day | Items | Dependencies | Test Plan |
|-----|-------|-------------|-----------|
| Mon-Tue | P2-01 (Razorpay integration -- biggest P2 item) | Razorpay account | Test: Payment webhook confirms booking automatically. |
| Wed | P2-03 (WhatsApp share), P2-07 (referral deep link), P2-05 (calendar integration) | None | Test: Share button opens WhatsApp. Deep link auto-fills code. Calendar link adds event. |
| Thu | P2-02 (auto group assignment), P2-22 (session auto-transitions) | None | Test: Groups auto-assigned 2h before session. Session status changes at start/end time. |
| Fri | P2-08 (feedback progressive disclosure), P2-29 (post-session CTA) | None | Test: Feedback form shows sections one at a time. After feedback, "Book next session" appears. |

---

## Cost of Inaction

What happens if each P0 item is NOT fixed before launch:

| P0 Item | Worst Case Scenario | Revenue at Risk | Legal Exposure | User Safety Risk |
|---------|--------------------|-----------------|--------------------|------------------|
| P0-01: Role escalation | Any user becomes admin. Approves fake payments, views all data, manipulates all bookings. | 100% of revenue (attacker can approve unlimited fake payments) | DPDP violation (admin accesses all PII) | HIGH -- admin can see phone numbers, venues, locations |
| P0-02: Payment status manipulation | Every user marks themselves as "confirmed" via browser console. Zero revenue collected. | 100% of revenue | Consumer fraud enablement | LOW |
| P0-03: Subscription manipulation | Every user gives themselves free unlimited Pro subscription. | 100% of subscription revenue (target: 60% of total) | N/A | LOW |
| P0-04: Duplicate bookings | Users double-book, consuming 2x spots. Sessions fill with 50% phantom bookings. | 50% capacity waste | N/A | LOW |
| P0-05: Booking impersonation | Attacker books sessions for other users, consuming their spots and potentially charging their payment methods. | Loss of trust. Affected users churn. | Fraud liability | MEDIUM |
| P0-06: Cron bypass | Attacker triggers unlimited notifications, spamming all users. Or if CRON_SECRET unset, `Bearer undefined` gives access. | Indirect: user churn from spam | N/A | LOW |
| P0-07: Spread operator | Partner sets `platform_fee: 0`, keeping 100% of revenue. Or sets `spots_filled: 0` to reset capacity. | Rs 100-150 lost per manipulated session | N/A | LOW |
| P0-08: No booking expiry | Bot army fills all sessions with unpaid bookings. Legitimate users cannot book anywhere. Complete platform denial of service. | 100% of revenue while attack persists | N/A | LOW |
| P0-09: No Terms/Privacy | First DPDP complaint: Rs 50-250 Cr penalty. First consumer complaint: unenforceable contract. | N/A | Rs 250 Cr maximum DPDP penalty + platform shutdown order | LOW |
| P0-10: No GST | Tax authority audit: 18% GST on all historical transactions + 18% interest + Rs 25,000 penalty per invoice. | Back-dated GST liability (could be Rs 10-50L in first year) | Prosecution under CGST Act S.122 | LOW |
| P0-11: No email verification | Bot army creates 10,000 accounts with disposable emails. Farms referral credits, fills sessions, submits fake ratings. | Referral credit fraud (unlimited) + capacity DoS + corrupted reputation data | N/A | MEDIUM -- fake accounts in physical sessions |
| P0-12: No refund policy | Every cancelled booking is a potential consumer forum case. Rs 1L+ per case. 10 complaints = Rs 10L+ legal costs. | Rs 10L+ in legal costs per year | Consumer Protection Act violation | LOW |
| P0-13: No safety reporting | Harassment incident occurs. Victim has no way to report. No incident record. Media coverage: "Platform connects strangers with no safety measures." | Total brand destruction | POSH Act violation. Criminal negligence. | CRITICAL -- physical safety |
| P0-14: No age verification | Minor attends session. Parent files DPDP complaint for children's data processing without consent. | N/A | Rs 200 Cr DPDP penalty (S.18(4)) | CRITICAL -- minor safety |
| P0-15: Profile data open | Attacker harvests all phone numbers, names, industries. Sells data. Or uses for targeted scams. | User churn from privacy breach | DPDP data breach notification required. Rs 250 Cr penalty. | HIGH -- phone number exposure |
| P0-16: Group data open | Attacker builds complete social graph: who met whom, when, where. Enables stalking, corporate espionage. | Trust destruction | DPDP violation (profiling without consent) | HIGH -- location tracking |
| P0-17: Venue key injection | Attacker writes arbitrary columns in feedback table. Could overwrite foreign keys or system fields. | Data corruption | N/A | LOW |
| P0-18: No partner role check | Any coworker creates venues and sessions. Inflates session supply. Accesses partner financial data. | Corrupted venue supply. Financial data exposure. | N/A | LOW |
| P0-19: Fake social proof | First 10 users see "1000+ coworkers" and find 3. Word-of-mouth: "That app is fake." Never recoverable in a small community. | 100% of HSR Layout market (reputation loss in small community is permanent) | Consumer Protection Act: misleading claims | LOW |
| P0-20: No security headers | XSS attack steals auth tokens on cafe WiFi. Attacker gains access to victim's account, bookings, personal data. | Per-user: full account takeover | DPDP data breach | HIGH -- session on cafe WiFi is the primary use case |

### Aggregate Revenue at Risk

| Scenario | Monthly Revenue at Risk | Probability Without Fix | Expected Monthly Loss |
|----------|------------------------|------------------------|----------------------|
| Payment bypass (P0-02, P0-03) | 100% of collections | 95% (trivial exploit) | 100% |
| Capacity DoS (P0-04, P0-08) | 50% of capacity | 30% (requires mild effort) | 15% |
| Brand destruction (P0-13, P0-19) | 100% long-term | 40% (one incident) | 40% |
| Legal shutdown (P0-09, P0-10, P0-14) | 100% | 20% in year 1 | 20% |
| Data breach (P0-15, P0-20) | 80% from churn | 25% in year 1 | 20% |

**Bottom line:** Without fixing P0-01 through P0-03 alone, the platform has ZERO revenue potential. An attacker can get unlimited free services within 30 seconds of account creation using only browser developer tools. These three fixes are the absolute minimum to make the business viable.

---

*This action plan was synthesized from 12 red team reports containing 1,800+ vulnerability vectors. It prioritizes the intersection of exploitability (how easy), impact (how bad), and effort (how quick to fix). The solo founder should execute the Quick Wins list first (2-3 hours total), then proceed through the week-by-week schedule, treating each P0 as a launch blocker.*
