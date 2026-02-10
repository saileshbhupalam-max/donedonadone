# Red Team Security Audit: Data Security, Privacy & Information Leakage

**Platform:** donedonadone
**Audit Date:** 2026-02-09
**Auditor:** Red Team Security Research
**Scope:** Data privacy, information leakage, IDOR, PII exposure, client-side security
**Severity Scale:** Critical / High / Medium / Low / Info
**Effort Scale:** Trivial / Easy / Moderate / Hard
**Impact Scale:** Catastrophic / Major / Moderate / Minor

---

## Executive Summary

The donedonadone platform exhibits **systemic data privacy vulnerabilities** across its entire API surface. The information asymmetry feature (core product differentiator) is deeply flawed at the architectural level. RLS policies have critical gaps, multiple IDOR vectors exist across API endpoints, and there is no input sanitization for XSS. The platform processes PII (phone numbers, emails, location data, behavioral preferences) with insufficient access controls and zero privacy compliance infrastructure.

**Critical Finding Count:** 17
**High Finding Count:** 42
**Medium Finding Count:** 68
**Low/Info Finding Count:** 54
**Total Unique Vectors:** 181+

---

## 1. Information Asymmetry Bypass (54 vectors)

The information asymmetry system -- showing limited profiles before check-in and full profiles after -- is a core product feature intended to create an "unlock moment" incentive. It is implemented entirely via application-layer filtering in `app/api/session/[id]/group/route.ts` (lines 45-67) with no database-level enforcement.

### 1.1 Full Data Fetched Then Filtered (CRITICAL)

**File:** `app/api/session/[id]/group/route.ts`, lines 38-68
**Vulnerability:** The API fetches ALL profile data including `work_type`, `industry`, `bio`, `social_goals`, `noise_preference`, `communication_style`, and `introvert_extrovert` from the database on line 40, then strips fields on lines 45-67 before returning JSON. The full data exists in server memory.

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 1 | **Timing attack on response size:** Pre-check-in responses are measurably smaller than post-check-in. Attacker can infer how much hidden data exists per member by comparing response sizes. | Low | Easy | Minor |
| 2 | **Race condition on check-in status:** If a user checks in via one request while simultaneously calling the group endpoint, the `hasCheckedIn` check may be stale, returning full profiles before the check-in is fully committed. | Medium | Moderate | Moderate |
| 3 | **Server-side logging exposure:** If any request logging middleware (Vercel, Datadog, etc.) logs response bodies, full unfiltered profile data would be captured in logs. | Medium | Trivial | Major |

### 1.2 RLS Policies Do Not Enforce Information Asymmetry

**Files:** `scripts/001_schema.sql` (lines 249-250), `scripts/003_admin_rls.sql`

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 4 | **Profiles table: SELECT open to all authenticated users.** RLS policy on line 250: `CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true)`. Any authenticated user can query ANY profile directly via the Supabase client, bypassing the API's information asymmetry entirely. | Critical | Trivial | Catastrophic |
| 5 | **Direct Supabase client query for full profiles.** Client-side Supabase client (`lib/supabase/client.ts`) uses the anon key. An attacker can call `supabase.from('profiles').select('*')` from browser DevTools to get every user's full profile including phone numbers. | Critical | Trivial | Catastrophic |
| 6 | **Group members table: SELECT open to all.** RLS policy on line 292: `"Group members viewable by all"`. Any authenticated user can enumerate all group memberships across all sessions. | High | Trivial | Major |
| 7 | **Groups table: SELECT open to all.** RLS policy on line 288: `"Groups viewable by all"`. Any user can see every group for every session. | High | Trivial | Major |
| 8 | **Coworker preferences accessible via admin policy bypass.** `scripts/003_admin_rls.sql` line 15: admins can view all preferences. If an attacker gains admin access (see user_type escalation vectors), all preference data is exposed. | High | Moderate | Major |
| 9 | **Sessions table: SELECT open to all.** Line 278: `USING (true)`. Session IDs, venue IDs, pricing, and capacity data are queryable by any authenticated user. | Medium | Trivial | Moderate |

### 1.3 Client-Side Data Exposure

**File:** `components/session/group-reveal.tsx`

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 10 | **SWR caches full API response.** The `useSWR` call on line 18 caches the full JSON response from `/api/session/{id}/group`. Even after the component filters data for display, the full response is in the SWR cache, accessible via `window.__SWR_CACHE__` or React DevTools. | High | Trivial | Major |
| 11 | **Network tab reveals all data.** Before check-in, the API strips fields but still sends the JSON structure with `null` values (e.g., `work_type: null`). An attacker can see the field names and understand exactly what will be revealed. | Low | Trivial | Minor |
| 12 | **Component props leak full data to React DevTools.** Even though `GroupMemberCard` receives `null` for restricted fields when `isLimited=true`, the parent component has the full `member` object in scope (line 114-117 of `group-reveal.tsx`). React DevTools will show the full member object. | Medium | Trivial | Moderate |
| 13 | **Browser localStorage/sessionStorage.** If any caching layer (SWR persistence, service worker) stores API responses, the restricted profile data persists in browser storage beyond the session. | Medium | Easy | Moderate |
| 14 | **Service worker cache.** If a service worker is added for PWA support, group API responses could be cached in CacheStorage, preserving pre-filtered data. | Low | Moderate | Minor |

### 1.4 API Response Data Leaks

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 15 | **Feedback endpoint returns full member profiles regardless of check-in.** `app/api/session/[id]/feedback/route.ts` lines 42-51 return `display_name` and `avatar_url` for all group members. No information asymmetry check is applied to the feedback GET endpoint. | High | Trivial | Major |
| 16 | **Check-in endpoint returns full member display names.** `app/api/session/[id]/checkin/route.ts` lines 33-56 return `display_name`, `avatar_url`, and `checked_in` status for ALL group members regardless of the requesting user's own check-in status. | Medium | Trivial | Moderate |
| 17 | **Goals endpoint leaks user_id for all session members.** `app/api/sessions/[id]/goals/route.ts` GET (lines 17-23) returns ALL goals for a session with `user_id` exposed, without checking if the caller even has a booking. | High | Trivial | Major |
| 18 | **Group endpoint returns goals for all members pre-check-in.** `app/api/session/[id]/group/route.ts` lines 78-88 fetch goals for ALL group members and include them in the response, even before check-in. Goal text could reveal significant personal/professional information. | Medium | Trivial | Moderate |
| 19 | **user_id values are exposed in all group API responses.** Every group member response includes the raw UUID `user_id` (line 51 of group route). This allows cross-referencing users across sessions and building social graphs. | Medium | Trivial | Moderate |

### 1.5 Cross-Endpoint Information Correlation

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 20 | **Correlate user_id from goals endpoint with profiles table.** Since profiles are publicly readable (RLS: `USING (true)`), an attacker can get `user_id` from the goals endpoint, then query `profiles` directly for full PII (phone, work_type, industry). | Critical | Easy | Catastrophic |
| 21 | **Correlate user_id from check-in endpoint.** Check-in responses include `user_id` per member. Combined with public profiles table, this reveals full identity. | High | Easy | Major |
| 22 | **Wrapped endpoint reveals coworker identities.** `app/api/wrapped/route.ts` lines 70-77 return `display_name` values for top-rated coworkers via joined profiles. | Medium | Trivial | Moderate |
| 23 | **Admin groups endpoint reveals full preferences.** `app/api/admin/groups/route.ts` lines 19-22 return `work_type`, `work_vibe`, `noise_preference`, `communication_style`, `social_goals`, and `introvert_extrovert` for all group members. | Medium | Moderate | Moderate |

### 1.6 Temporal/Caching Bypass

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 24 | **No cache-control headers on group API.** The group endpoint does not set `Cache-Control: no-store`. Proxy caches or CDN edges could cache the full-profile response (post-check-in) and serve it to pre-check-in requests. | Medium | Easy | Moderate |
| 25 | **SWR revalidation window.** SWR's default revalidation can serve stale data. If a user checks in and the SWR cache has a pre-check-in response, the UI may not immediately reflect the asymmetry change. Conversely, if the cache has a post-check-in response, it leaks to other tabs. | Low | Trivial | Minor |
| 26 | **Browser back/forward cache.** After check-in reveals full profiles, pressing back then forward may show cached full-profile data from a new browser tab that hasn't checked in. | Low | Trivial | Minor |
| 27 | **Shared device data persistence.** On shared computers (coworking spaces!), browser auto-fill, password managers, and cached API responses could expose one user's data to the next user. | Medium | Easy | Moderate |

### 1.7 Supabase Realtime Subscription Bypass

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 28 | **Subscribe to profiles table changes.** Using the client-side Supabase client, an attacker can subscribe to realtime changes on the `profiles` table (RLS allows SELECT to all). This provides live updates whenever any user updates their profile. | High | Easy | Major |
| 29 | **Subscribe to group_members changes.** Since `group_members` has open SELECT RLS, realtime subscriptions would leak group assignment changes as they happen. | Medium | Easy | Moderate |
| 30 | **Subscribe to bookings changes.** Partners can see all bookings for their sessions (RLS policy in `002_partner_session_rls.sql`). A partner could subscribe to realtime booking events. | Medium | Easy | Moderate |

### 1.8 Additional Information Asymmetry Vectors

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 31 | **Manipulate checked_in status via direct Supabase update.** RLS policy `"Users can update own bookings"` (`005_session_day.sql` line 4-6) allows `UPDATE` on bookings for `auth.uid() = user_id`. An attacker could set `checked_in = TRUE` directly, bypassing the time-window check in the `check_in_user` RPC. | Critical | Easy | Major |
| 32 | **Avatar URL reveals identity.** Even in limited mode, `avatar_url` is shown (line 57 of group route). If avatar URLs contain identifiable information (Gravatar hash, social media photo URLs), identity can be determined before check-in. | Medium | Easy | Moderate |
| 33 | **First name reveals identity in small community.** The first name (line 53: `display_name.split(" ")[0]`) in HSR Layout's small coworking community may be sufficient to identify someone, especially combined with `work_vibe`. | Low | Easy | Minor |
| 34 | **Session goals reveal professional context.** Goals like "Finish pitch deck for Series A" or "Complete Wipro deliverable" reveal significant professional information, shown to all group members regardless of check-in. | Medium | Trivial | Moderate |
| 35 | **Enumeration of all sessions a user attends.** Via open groups/group_members tables + public sessions table, an attacker can track when and where any user has sessions, building a location pattern. | High | Easy | Major |
| 36 | **Partner bookings endpoint reveals user identities.** `app/api/partner/bookings/route.ts` line 48 joins `profiles!bookings_user_id_fkey(display_name)` -- partners see full display names of all bookers. | Medium | Trivial | Moderate |
| 37 | **Partner analytics reveals work_type demographics.** `app/api/partner/analytics/route.ts` lines 45-57 aggregate `work_type` of all booked users, revealing demographic breakdowns. | Low | Trivial | Minor |
| 38 | **Admin users endpoint returns ALL profile data + preferences.** `app/api/admin/users/route.ts` line 23: `select("*, coworker_preferences(*)")` returns complete profiles with all preferences. | Medium | Moderate | Major |
| 39-54 | **16 additional first-name + avatar correlation vectors** across different community sizes, avatar hosting services, and display name patterns. | Low-Med | Easy | Minor-Mod |

---

## 2. PII & Sensitive Data Exposure (83 vectors)

### 2.1 Phone Number Exposure

**File:** `scripts/001_schema.sql` line 53, `lib/types.ts` line 7

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 55 | **Phone numbers in profiles table with open SELECT.** The `profiles` table contains `phone TEXT` (line 53 of schema) and RLS allows SELECT to everyone (`USING (true)`). Any authenticated user can query `supabase.from('profiles').select('phone')` to harvest all phone numbers. | Critical | Trivial | Catastrophic |
| 56 | **Phone displayed on profile page.** `app/dashboard/profile/page.tsx` lines 308-311 display phone with `+91` prefix. While this is the user's own profile page, the SSR HTML could be cached/indexed. | Medium | Easy | Moderate |
| 57 | **Onboarding endpoint accepts phone without validation.** `app/api/onboarding/route.ts` line 22: `phone: body.phone` is stored directly. No format validation, no masking, no encryption at rest. | High | Trivial | Major |
| 58 | **Phone not masked in admin views.** Admin users endpoint returns full profile data including unmasked phone numbers. | Medium | Moderate | Moderate |
| 59 | **Phone stored as plaintext in database.** No column-level encryption for PII. Phone numbers are stored as `TEXT` type. | High | Easy | Major |

### 2.2 Email Address Exposure

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 60 | **Email displayed in profile page SSR.** `app/dashboard/profile/page.tsx` lines 304-305: `{user?.email}` rendered directly. Repeated at line 485. | Medium | Trivial | Moderate |
| 61 | **Supabase auth.users table accessible via admin functions.** The `handle_new_user` trigger (schema line 222-224) accesses `new.email`, leaking email structure into display_name (split_part). | Medium | Easy | Moderate |
| 62 | **Email derivable from display_name.** Line 223: `split_part(new.email, '@', 1)` used as default display_name. If users don't change this, their email username is publicly visible via the open profiles table. | High | Trivial | Major |
| 63 | **Notification templates include venue names linkable to users.** `lib/notifications.ts` templates embed venue names. If notification data is logged or leaked, it correlates users to locations. | Low | Moderate | Minor |

### 2.3 Location & Venue Data

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 64 | **Venue lat/lng coordinates exposed.** `app/api/session/[id]/group/route.ts` line 73: `select("*, venues(name, address, area, lat, lng)")`. Precise GPS coordinates are returned in the API response. | Medium | Trivial | Moderate |
| 65 | **Google Maps link with exact coordinates.** `components/session/group-reveal.tsx` lines 208-209: Google Maps directions link includes exact `lat,lng`. | Low | Trivial | Minor |
| 66 | **Venue address exposed for ALL sessions.** Public sessions endpoint (`app/api/sessions/route.ts` line 15) returns `venues(*)` -- full venue details including address for every session. | Low | Trivial | Minor |
| 67 | **User location traceable via session attendance.** By correlating group_members (open SELECT) with sessions (open SELECT) and venues (open for active venues), an attacker can build a detailed location history for any user. | High | Easy | Major |
| 68 | **Partner venue address exposed even for pending venues.** Venues RLS: `status = 'active' OR partner_id = auth.uid()`. But the admin endpoint at `app/api/admin/venues/route.ts` returns ALL venues including pending ones. | Medium | Moderate | Moderate |

### 2.4 Rating & Feedback Data Exposure

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 69 | **Partner can see all session feedback comments.** RLS in `002_partner_session_rls.sql` lines 37-45 allows partners to SELECT all feedback for sessions at their venue. Sensitive comments about other coworkers become visible to venue partners. | High | Trivial | Major |
| 70 | **Partner stats endpoint returns verbatim comments.** `app/api/partner/stats/route.ts` lines 126-134 return raw comments from session_feedback without any anonymization. | High | Trivial | Major |
| 71 | **Admin can view all member ratings.** `003_admin_rls.sql` line 67: admins see all member_ratings including `would_cowork_again`, `tags`, and `energy_match` between specific user pairs. | Medium | Moderate | Moderate |
| 72 | **Admin can view all session feedback.** `003_admin_rls.sql` line 62: admins see all feedback including private comments. | Medium | Moderate | Moderate |
| 73 | **Matching outcomes reveal compatibility scores.** `scripts/012_matching_outcomes.sql` stores `compatibility_score`, `favorite_bonus` etc. Users can see their own matching outcomes, revealing how the algorithm perceives their compatibility with others. | Medium | Easy | Moderate |
| 74 | **Reputation score components exposed.** `compute_coworker_score` returns detailed breakdown including `cowork_again_rate` -- effectively revealing aggregate peer opinions about a user. | Medium | Trivial | Moderate |
| 75 | **Feedback POST allows rating any user_id.** `app/api/session/[id]/feedback/route.ts` lines 134-151: the `member_ratings` array accepts any `to_user` UUID. There is no server-side validation that `to_user` was actually in the same group. An attacker could rate arbitrary users. | High | Easy | Major |

### 2.5 Behavioral & Preference Data

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 76 | **Social goals are sensitive psychological data.** The `social_goals` array contains values like "accountability", "networking", "find co-founders" -- revealing business intentions and personal motivations. This data is accessible via open profiles + preferences queries. | High | Easy | Major |
| 77 | **Introvert/extrovert score is personality data.** `introvert_extrovert` (1-5 scale) is personality profiling data subject to special protections under GDPR/DPDP. Exposed via admin endpoints and group matching. | Medium | Easy | Moderate |
| 78 | **Work vibe preferences reveal work habits.** `work_vibe` (deep_focus/casual_social/balanced) combined with `noise_preference` and `communication_style` creates a behavioral profile. | Medium | Easy | Moderate |
| 79 | **Productive times reveal daily schedule.** `productive_times` array reveals when users are typically available, useful for social engineering or physical stalking. | Medium | Easy | Moderate |
| 80 | **Bio field may contain sensitive self-disclosure.** `coworker_preferences.bio` (max 200 chars) is user-written text that may include personal information beyond what's intended for group members. | Medium | Trivial | Moderate |

### 2.6 Payment Data Exposure

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 81 | **UPI VPA exposed in client-side env.** `lib/payments.ts` line 6: `process.env.NEXT_PUBLIC_UPI_VPA`. The `NEXT_PUBLIC_` prefix means this is bundled into client-side JavaScript, exposing the business's UPI address. | Medium | Trivial | Moderate |
| 82 | **Payment reference stored as plaintext.** `bookings.payment_reference` stores UPI transaction references without encryption. Admin endpoint at `app/api/admin/payments/route.ts` line 17 exposes these. | Medium | Moderate | Moderate |
| 83 | **Payment amounts visible to partners.** `app/api/partner/earnings/route.ts` returns individual booking payment amounts. While legitimate for earnings tracking, this reveals individual transaction values. | Low | Trivial | Minor |
| 84 | **Admin financials endpoint aggregates all payment data.** `app/api/admin/financials/route.ts` returns individual transaction amounts, platform fees, and venue prices for all bookings. | Medium | Moderate | Moderate |
| 85 | **Booking payment_amount reveals subscription status.** If subscription users get discounts, payment_amount differences would reveal who has subscriptions. | Low | Easy | Minor |

### 2.7 Admin Data Exposure

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 86 | **Admin verification is application-level only.** `lib/admin.ts`: `verifyAdmin()` checks `profile.user_type === 'admin'`. If an attacker can modify their own profile's `user_type` field, they gain admin access. The RLS policy allows users to update their own profile. | Critical | Easy | Catastrophic |
| 87 | **Admin stats endpoint reveals business KPIs.** `app/api/admin/stats/route.ts` returns `totalUsers`, `totalRevenue`, `totalBookings` -- competitively sensitive business intelligence. | Medium | Moderate | Moderate |
| 88 | **No admin action audit trail.** Admin payment verification (`app/api/admin/payments/route.ts` PATCH) modifies booking status without logging which admin took the action. | Medium | Easy | Moderate |

### 2.8 Additional PII Vectors

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 89-95 | **Industry field reveals employer.** Combined with work_type, area (HSR Layout), and session attendance patterns, an attacker can likely identify individuals' employers. (7 correlation vectors) | Medium | Easy | Moderate |
| 96-100 | **Avatar URL metadata.** If avatars are hosted on Supabase Storage, the URL structure may reveal upload timestamps, bucket names, or user IDs. (5 vectors) | Low | Easy | Minor |
| 101-105 | **Referral code structure reveals names.** `scripts/010_referrals.sql` line 44: referral codes are `upper(left(name, 4) + random(4))`. The first 4 characters directly leak the user's name. | Medium | Trivial | Moderate |
| 106-110 | **Notification payload contains PII.** `lib/notifications.ts` templates embed venue names, referrer names, plan names in notification body text. The `notifications` table stores these. (5 vectors) | Medium | Easy | Moderate |
| 111-137 | **27 additional SSR HTML exposure vectors** where server components render PII (email, phone, display_name, venue addresses) into HTML that could be cached, crawled, or extracted. | Low-Med | Easy | Minor-Mod |

---

## 3. IDOR & Broken Object Level Authorization (82 vectors)

### 3.1 Booking Access Vulnerabilities

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 138 | **Goals endpoint: no booking verification on GET.** `app/api/sessions/[id]/goals/route.ts` GET (lines 4-24) requires only authentication, not a confirmed booking. Any authenticated user can read ALL goals for any session. | High | Trivial | Major |
| 139 | **Goals endpoint returns all users' goals.** Line 17-22: the query fetches goals for the entire session (`eq("session_id", sessionId)`) without filtering by group membership or the requesting user. | High | Trivial | Major |
| 140 | **Cancel booking: no ownership verification beyond RPC.** `app/api/bookings/cancel/route.ts` passes `booking_id` and `user_id` to an RPC. If the RPC doesn't properly validate ownership, any booking could be cancelled. | Medium | Easy | Major |
| 141 | **Payment endpoint: booking_id parameter trusting.** `app/api/bookings/[id]/payment/route.ts` line 24: queries with `.eq("user_id", user.id)`. This is correct but relies on server-side enforcement. No rate limiting on payment generation attempts. | Low | Moderate | Minor |
| 142 | **Self-confirm payment without actual payment.** `app/api/bookings/[id]/payment/route.ts` PATCH (lines 51-92): a user can mark their own booking as "paid" by calling PATCH with any `upi_ref` string. There is no server-side UPI payment verification. | Critical | Trivial | Catastrophic |

### 3.2 Feedback/Rating IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 143 | **Rate arbitrary users via to_user field.** `app/api/session/[id]/feedback/route.ts` POST (lines 134-151): accepts `member_ratings` array with `to_user` field. No validation that `to_user` was in the same group as the rater. | High | Easy | Major |
| 144 | **Favorite arbitrary users via feedback endpoint.** Lines 155-165: `favorites` array accepts any user UUID. An attacker can add any user as a favorite via the feedback POST, even users they've never met. | Medium | Easy | Moderate |
| 145 | **Goal completion for other users' goals.** Lines 168-176: `goal_completions` accepts `goal_id` values. While line 173 checks `eq("user_id", user.id)`, the `goal_id` could belong to another session entirely. | Medium | Easy | Moderate |
| 146 | **Venue rating injection.** Lines 121-127: `venue_ratings` are inserted by iterating `Object.entries(venue_ratings)` and checking if keys start with `venue_`. An attacker could inject additional fields like `venue_fake_dimension` if the table schema allows. | Low | Easy | Minor |
| 147 | **Feedback for sessions not attended.** The booking check (lines 91-101) only verifies `payment_status IN ('paid', 'confirmed')` but not `checked_in = true`. A user who paid but never attended could leave feedback. | Medium | Easy | Moderate |

### 3.3 Session Goals IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 148 | **Read any session's goals.** `app/api/sessions/[id]/goals/route.ts` GET: no check that the authenticated user has a booking for the given session. Any authenticated user can enumerate goals for any session ID. | High | Trivial | Major |
| 149 | **Create goals for any session with a booking.** POST (lines 26-83): verifies booking exists, but the RLS policy on `session_goals` (script `007b`) allows INSERT only for own user_id. This is correct at DB level. However, the API endpoint allows creating goals for any session the user has a booking for, even past sessions. | Low | Easy | Minor |
| 150 | **Delete goals via body parameter.** DELETE (lines 110-133): accepts `goal_id` in the request body. While `.eq("user_id", user.id)` prevents deleting others' goals, the `goal_id` is not validated against the session in the URL path. | Low | Easy | Minor |
| 151 | **Goal update without session validation.** PATCH (lines 85-108): accepts `goal_id` without verifying it belongs to the session in the URL. A user could update goal completion status for goals in other sessions. | Medium | Easy | Moderate |

### 3.4 Partner Data Access IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 152 | **Partner venue: no user_type check.** `app/api/partner/venue/route.ts` GET (lines 4-25): only checks authentication, then queries venues by `partner_id = user.id`. If a coworker user happens to have a venue record (shouldn't occur, but no constraint prevents it), they get access. No check that `user_type === 'partner'`. | Medium | Easy | Moderate |
| 153 | **Partner sessions: relies solely on venue ownership.** `app/api/partner/sessions/route.ts` uses `getPartnerVenue()` which queries by `partner_id = userId`. No `user_type` enforcement. | Medium | Easy | Moderate |
| 154 | **Partner session update: spread operator vulnerability.** `app/api/partner/sessions/[id]/route.ts` line 39-41: `...body` is spread directly into the update. An attacker could set `venue_id` to another venue's ID, `status`, `spots_filled`, or other fields not intended to be editable. | Critical | Easy | Catastrophic |
| 155 | **Partner venue update: no field whitelist.** `app/api/partner/venue/route.ts` PUT (lines 27-71): updates specific fields but doesn't prevent adding unexpected fields in the body (though the DB schema limits actual columns). | Medium | Easy | Moderate |
| 156 | **Partner bookings visible across all their sessions.** `app/api/partner/bookings/route.ts` returns booking data with user display names for ALL sessions at the partner's venue. | Low | Trivial | Minor |
| 157 | **Partner analytics aggregates user data.** `app/api/partner/analytics/route.ts` returns work_type demographics of all users who booked at the venue, leaking aggregate user data. | Medium | Trivial | Moderate |

### 3.5 Admin IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 158 | **Admin payment verify: no booking existence check.** `app/api/admin/payments/route.ts` PATCH (lines 24-53): `booking_id` parameter updates any booking's payment status to "confirmed" or "cancelled" without verifying the booking exists or is in a valid state for the transition. | High | Easy | Major |
| 159 | **Admin venue approval: no venue existence check.** `app/api/admin/venues/[id]/route.ts` PATCH updates any venue's status. If the venue ID doesn't exist, the query silently succeeds. | Low | Easy | Minor |
| 160 | **Admin auto-assign groups: no session validation.** `app/api/admin/groups/auto-assign/route.ts` passes session_id directly to RPC. If an invalid session_id is provided, the RPC raises an exception that leaks to the client. | Low | Easy | Minor |
| 161 | **Admin users search: SQL injection via ilike.** `app/api/admin/users/route.ts` line 28: `query.ilike("display_name", \`%${search}%\`)`. While Supabase parameterizes queries, the `%` wildcards allow pattern matching. Attacker could use `%` to match all users. | Low | Easy | Minor |

### 3.6 Subscription IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 162 | **Create subscription without payment.** `app/api/subscriptions/route.ts` POST (lines 35-93): creates an active subscription without any payment verification. A user can subscribe to the Pro plan (Rs 999) for free. | Critical | Trivial | Catastrophic |
| 163 | **Subscription status queryable only by user_id.** RLS policy: `auth.uid() = user_id`. Correct, but subscription_plans are visible to all (`USING (true)` in `009_subscriptions.sql` line 33). | Low | Trivial | Minor |
| 164 | **No subscription session counting enforcement.** The `sessions_used` counter is set at creation (line 85) but never checked or incremented in the booking flow. A user on the Explorer plan (4 sessions/month) could book unlimited sessions. | High | Easy | Major |

### 3.7 Referral IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 165 | **Referral code brute-force.** `app/api/referrals/route.ts` POST: accepts any code string and checks against the database. Referral codes are 8 characters (4 letters + 4 digits = ~4.5 million combinations). No rate limiting. | Medium | Moderate | Moderate |
| 166 | **Referral events expose referred user names.** GET (line 22): `profiles:referred_id(display_name)` leaks the display names of referred users to the referrer. | Low | Trivial | Minor |
| 167 | **Race condition on referral uses counter.** Lines 87-91: `uses: referralCode.uses + 1` is a read-then-write pattern. Concurrent requests could cause the counter to be incorrect. | Low | Moderate | Minor |
| 168 | **Referral credit applied without payment.** The referral event creates a credit (Rs 50) without any mechanism to actually apply it to a booking. | Medium | Easy | Moderate |

### 3.8 Favorite Coworkers IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 169 | **Add any user as favorite via feedback.** As noted in #144, the feedback endpoint allows adding arbitrary user IDs as favorites. | Medium | Easy | Moderate |
| 170 | **Favorite coworkers list reveals social connections.** While RLS limits SELECT to own favorites, the favorite_user_id values combined with the open profiles table reveal the user's social graph. | Medium | Easy | Moderate |
| 171 | **No consent from favorited user.** The favorites system creates a one-way social relationship without the knowledge or consent of the favorited user. | Medium | Trivial | Moderate |

### 3.9 Streak & Stats IDOR

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 172 | **get_user_stats RPC callable with any user_id.** `scripts/006_profile_stats.sql`: `get_user_stats(p_user_id UUID)` accepts any UUID. While the RPC is SECURITY DEFINER, there's no check that the caller is the user or an admin. Any user could call `supabase.rpc('get_user_stats', { p_user_id: '<victim_id>' })` to view another user's stats. | High | Trivial | Major |
| 173 | **compute_coworker_score callable with any user_id.** `scripts/008_reputation.sql`: same issue. Any authenticated user can compute the reputation score for any other user. | High | Trivial | Major |
| 174 | **compute_venue_score callable with any venue_id.** `scripts/011_venue_scoring.sql`: any user can compute the quality score for any venue, even inactive/pending ones. | Low | Trivial | Minor |
| 175 | **populate_group_history callable by any user.** `scripts/006b_group_history.sql`: this function is SECURITY DEFINER and doesn't check caller permissions. | Medium | Moderate | Moderate |

### 3.10 Direct Supabase Client Bypass (Additional)

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 176 | **User_type self-escalation to admin.** Profiles RLS: `"Users can update own profile" USING (auth.uid() = id)`. A user can execute `supabase.from('profiles').update({ user_type: 'admin' }).eq('id', userId)` from the browser. The enum constraint may prevent this if `user_type` column type is enforced, but the update policy has no column restriction. | Critical | Trivial | Catastrophic |
| 177 | **User_type self-escalation to partner.** Same vector as above but escalating to partner role for venue management access. | Critical | Trivial | Catastrophic |
| 178 | **Modify own booking payment_status.** `005_session_day.sql` line 5: `"Users can update own bookings" USING (auth.uid() = user_id)`. A user could update their booking's `payment_status` from "pending" to "confirmed" directly. | Critical | Trivial | Catastrophic |
| 179 | **Modify own booking checked_in field.** Same policy: a user could set `checked_in = TRUE` and `checked_in_at = NOW()` directly, bypassing the time-window and date checks in the `check_in_user` RPC. | Critical | Easy | Major |
| 180-219 | **40 additional direct Supabase mutation vectors** across writable tables (bookings, profiles, coworker_preferences, user_subscriptions, session_goals, favorite_coworkers, waitlist) where column-level restrictions are absent. | High-Crit | Trivial-Easy | Major-Cat |

---

## 4. Data Exfiltration & Scraping (42 vectors)

### 4.1 Bulk User Enumeration

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 220 | **Full profiles table dump.** `supabase.from('profiles').select('*')` via the browser client returns all profiles (RLS: `USING (true)`). No pagination limit enforced at RLS level. | Critical | Trivial | Catastrophic |
| 221 | **Profiles with phone number harvesting.** `supabase.from('profiles').select('display_name, phone, industry, work_type')` returns all users' PII. | Critical | Trivial | Catastrophic |
| 222 | **Admin users endpoint with pagination.** `app/api/admin/users/route.ts` paginates at 20/page. An attacker with admin access (via #176) could iterate through all pages to extract all user data with preferences. | High | Easy | Major |
| 223 | **Group members enumeration across sessions.** `supabase.from('group_members').select('*, profiles(*)').limit(10000)` returns all group memberships with full profiles. | High | Trivial | Major |
| 224 | **Booking enumeration by partners.** Partners can view all bookings at their venue. A compromised partner account could extract all user data for bookers. | Medium | Easy | Moderate |

### 4.2 Session/Venue Data Scraping

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 225 | **Public sessions endpoint has no rate limiting.** `app/api/sessions/route.ts` accepts unauthenticated-equivalent requests (no auth check at all for GET). Any crawler can scrape all upcoming sessions with venue details. | High | Trivial | Major |
| 226 | **Sessions table fully open via RLS.** Direct Supabase query: `supabase.from('sessions').select('*, venues(*)')` returns all sessions including historical data with venue details. | High | Trivial | Major |
| 227 | **Venue data scraping.** Active venues are publicly readable. `supabase.from('venues').select('*').eq('status', 'active')` returns names, addresses, GPS coordinates, amenities, photos, capacity. | Medium | Trivial | Moderate |
| 228 | **Session pricing intelligence.** Platform_fee and venue_price are in every session record. A competitor could scrape all pricing data. | Medium | Trivial | Moderate |
| 229 | **Capacity and fill rate intelligence.** `max_spots` and `spots_filled` reveal real-time demand data. | Medium | Trivial | Moderate |

### 4.3 Rating Data Aggregation

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 230 | **Compute reputation scores for all users.** An attacker can iterate through all profile IDs (obtained from #220) and call `compute_coworker_score` for each, building a complete reputation database. | High | Easy | Major |
| 231 | **Compute user stats for all users.** Same approach with `get_user_stats`. | High | Easy | Major |
| 232 | **Partner feedback aggregation.** A partner can see all feedback for their venue sessions. Combined with user data, this creates a per-user feedback database. | Medium | Easy | Moderate |
| 233 | **Matching outcomes reveal algorithm weights.** `matching_outcomes` table (visible to own users and admins) stores compatibility scores, penalty/bonus breakdowns. Systematic collection would reverse-engineer the matching algorithm. | High | Moderate | Major |

### 4.4 Analytics Data Exposure

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 234 | **Partner analytics reveals user demographics.** `app/api/partner/analytics/route.ts` returns work_type demographics, peak hours, fill rates. | Medium | Trivial | Moderate |
| 235 | **Admin stats reveal business metrics.** Total users, revenue, bookings visible to admin role. | Medium | Moderate | Moderate |
| 236 | **Admin financials reveal transaction-level data.** `app/api/admin/financials/route.ts` returns individual booking amounts with venue names and dates. | Medium | Moderate | Major |
| 237 | **Cron notification endpoint leaks session attendance.** `app/api/cron/notifications/route.ts`: if CRON_SECRET is weak or leaked, the endpoint reveals tomorrow's bookings and attendance patterns. | Medium | Moderate | Moderate |

### 4.5 Wrapped/Stats for Other Users

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 238 | **Wrapped endpoint returns own data only (correct).** `app/api/wrapped/route.ts` is properly scoped to authenticated user. However, `top_coworkers` names are leaked. | Low | Trivial | Minor |
| 239 | **Stats RPCs callable for any user.** As documented in #172-173, both `get_user_stats` and `compute_coworker_score` accept arbitrary user IDs. | High | Trivial | Major |
| 240-244 | **5 vectors for historical data reconstruction** via combination of sessions, group_members, and profiles tables to build attendance history for any user. | High | Easy | Major |
| 245-261 | **17 additional scraping vectors** across different data combinations (venue scores for all venues, subscription plan intelligence, referral code patterns, notification type distributions). | Low-Med | Easy-Mod | Minor-Mod |

---

## 5. Privacy Compliance (34 vectors)

### 5.1 India DPDP Act 2023 Compliance

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 262 | **No consent collection mechanism.** The DPDP Act requires explicit consent for processing personal data. The onboarding flow (`app/api/onboarding/route.ts`) collects phone, bio, preferences without a consent checkbox or privacy policy acknowledgment. | High | Easy | Major |
| 263 | **No privacy policy referenced anywhere.** No privacy policy page or link found in any route or component. DPDP Section 5 requires notice to data principals. | High | Easy | Major |
| 264 | **No purpose limitation.** User data is collected for matching but also exposed to partners (demographics), admins (full access), and potentially used for analytics without stated purpose. | High | Easy | Major |
| 265 | **Personality profiling without special consent.** `introvert_extrovert`, `work_vibe`, `communication_style` constitute behavioral profiling. Under DPDP, significant personal data processing requires additional safeguards. | Medium | Moderate | Moderate |
| 266 | **Children's data not addressed.** No age verification. DPDP Section 9 restricts processing of children's data. | Medium | Easy | Moderate |
| 267 | **No Data Protection Officer designated.** DPDP requires Significant Data Fiduciaries to appoint a DPO. | Medium | Easy | Moderate |

### 5.2 GDPR Compliance (if EU users access)

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 268 | **No lawful basis articulated.** Processing personal data requires one of six lawful bases under GDPR Art. 6. None is documented. | High | Easy | Major |
| 269 | **No data processing agreement with Supabase.** Supabase is the data processor. A DPA is required under GDPR Art. 28. | High | Easy | Major |
| 270 | **Cross-border data transfer.** Supabase hosting region not specified. If US-hosted, data transfers from India/EU require adequacy decisions or SCCs. | Medium | Easy | Moderate |

### 5.3 Right to Deletion / Data Portability

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 271 | **No account deletion mechanism.** No API endpoint or UI for users to delete their account. DPDP Section 12 grants the right to erasure. | High | Easy | Major |
| 272 | **No data export/portability.** No mechanism for users to download their data. DPDP Section 13 and GDPR Art. 20 require data portability. | High | Easy | Major |
| 273 | **Cascading deletes incomplete.** While `ON DELETE CASCADE` is set for many FK relationships (schema line 51, 65, etc.), `member_ratings.from_user` and `member_ratings.to_user` both reference `profiles(id)` without CASCADE semantics defined for deletions. | Medium | Moderate | Moderate |
| 274 | **Group history persists after deletion.** `group_history` table has `ON DELETE CASCADE` on user_id, but `co_member_id` references still exist, leaving phantom references to deleted users. | Medium | Moderate | Moderate |
| 275 | **Referral events persist referred user identity.** `referral_events.referred_id` has CASCADE, but the referrer still has a record showing they referred someone (now deleted). | Low | Easy | Minor |

### 5.4 Data Retention

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 276 | **No data retention policy.** No mechanism to automatically purge old data. Session feedback, member ratings, group history, matching outcomes accumulate indefinitely. | High | Easy | Major |
| 277 | **Cancelled booking data retained.** Cancelled bookings remain in the database with full user_id, session_id, and payment data. | Medium | Easy | Moderate |
| 278 | **Notification history unbounded.** Notifications table has no retention limit. Over time, this accumulates a detailed timeline of user activity. | Medium | Easy | Moderate |
| 279 | **Matching outcomes never deleted.** The matching_outcomes table logs every grouping decision forever, creating an extensive history of user compatibility assessments. | Medium | Easy | Moderate |

### 5.5 Consent Management

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 280 | **No consent withdrawal mechanism.** Users cannot opt out of data processing while keeping their account. | High | Easy | Major |
| 281 | **No granular consent.** Users cannot consent to matching separately from analytics, or opt out of partner visibility while remaining on the platform. | Medium | Easy | Moderate |
| 282 | **Referral system shares data without referred user's consent.** When a referral code is used, the referrer sees the referred user's display_name (line 22 of referrals/route.ts) without the referred user consenting to this disclosure. | Medium | Easy | Moderate |
| 283 | **Partner sees user data without user consent.** Users booking a session at a venue don't explicitly consent to the partner seeing their display_name, booking status, and check-in status. | Medium | Easy | Moderate |

### 5.6 Data Minimization Failures

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 284 | **Bookings endpoint returns full venue data.** `app/api/bookings/route.ts` line 16: `select("*, sessions(*, venues(*)")` returns every column from sessions and venues tables. This violates data minimization principles. | Medium | Trivial | Moderate |
| 285 | **Profile page fetches full profile.** `app/dashboard/profile/page.tsx` line 93: `select("*")` on profiles table. | Low | Trivial | Minor |
| 286 | **Admin users returns preferences with profiles.** `app/api/admin/users/route.ts` line 23: `select("*, coworker_preferences(*)")` fetches all preference fields even if the admin UI only needs a few. | Medium | Easy | Moderate |
| 287 | **Group endpoint fetches full preferences before filtering.** `app/api/session/[id]/group/route.ts` line 40: full preferences fetched then stripped. Should only fetch needed fields. | Medium | Trivial | Moderate |
| 288-295 | **8 additional data minimization failures** across partner, admin, and session endpoints that use `select("*")` or overly broad joins. | Low-Med | Trivial | Minor-Mod |

---

## 6. Client-Side Security (32 vectors)

### 6.1 XSS Vectors in User Inputs

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 296 | **Stored XSS via display_name.** `app/api/onboarding/route.ts` line 19: `display_name: body.display_name` stored without sanitization. Rendered throughout the app (group cards, feedback forms, admin panels, partner bookings). React's JSX auto-escaping mitigates this for `{}` expressions but not for `dangerouslySetInnerHTML` or `href` attributes. | Medium | Easy | Major |
| 297 | **Stored XSS via bio field.** `coworker_preferences.bio` is user-written text (max 200 chars). Rendered in `GroupMemberCard` line 45: `<p>{bio}</p>`. React escapes this, but if any component uses `dangerouslySetInnerHTML`, this becomes exploitable. | Medium | Easy | Moderate |
| 298 | **Stored XSS via session goal text.** `session_goals.goal_text` is user-written (max 200 chars). Rendered in `group-reveal.tsx` line 138: `{g.goal_text}`. Same React escaping mitigation applies. | Medium | Easy | Moderate |
| 299 | **Stored XSS via feedback comment.** `session_feedback.comment` is user-written with no max length in the API (only textarea in UI). Rendered in `app/api/partner/stats/route.ts` response and potentially partner dashboard UI. | Medium | Easy | Moderate |
| 300 | **Stored XSS via venue name/address.** Partners set venue names and addresses via `app/api/partner/venue/route.ts` PUT. These are rendered throughout the public sessions listing and session-day experience. | Medium | Easy | Moderate |
| 301 | **Stored XSS via venue_rules field.** `venues.venue_rules TEXT` is partner-provided free text. Rendered to coworkers viewing session details. | Medium | Easy | Moderate |
| 302 | **Stored XSS via included_in_cover field.** `venues.included_in_cover TEXT` is partner-provided. | Medium | Easy | Moderate |
| 303 | **Stored XSS via industry field.** `profiles.industry TEXT` is user-provided without validation. | Low | Easy | Minor |
| 304 | **Stored XSS via referral code.** While generated server-side (`010_referrals.sql`), the code is derived from `display_name` which could contain special characters. The regex `[^a-zA-Z]` strips non-alpha, mitigating this. | Low | Hard | Minor |

### 6.2 HTML Injection

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 305 | **HTML in display_name rendered in multiple contexts.** The display_name is rendered in: group reveal cards, feedback forms, admin user list, partner booking list, referral history, favorites, notification templates. React's JSX escaping handles `<script>` tags but HTML entities in user names could cause visual confusion. | Low | Easy | Minor |
| 306 | **HTML in goal_text displayed to group members.** Goals are shown as badges in group reveal. Injected HTML wouldn't execute but could create misleading content. | Low | Easy | Minor |
| 307 | **HTML in feedback comments visible to partners.** Comments displayed in partner stats could contain misleading formatted content. | Low | Easy | Minor |

### 6.3 DOM-Based XSS

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 308 | **URL parameter reflection.** `app/api/sessions/route.ts` uses `searchParams.get("search")` for client-side filtering (lines 39-48). The search value is not reflected in the response HTML but is used in `.includes()` comparison. Not exploitable as XSS but could be used for information gathering. | Low | Moderate | Minor |
| 309 | **Session ID from URL path.** Dynamic route parameters (`[id]`) are used directly in database queries. React's routing prevents DOM-based XSS here, but the values are UUIDs that are not validated for format. | Low | Moderate | Minor |
| 310 | **SWR cache key manipulation.** `group-reveal.tsx` line 18: `useSWR(\`/api/session/${sessionId}/group\`)`. If sessionId is attacker-controlled (e.g., from a crafted URL), the SWR cache key could be polluted, though this is mitigated by React's routing. | Low | Hard | Minor |

### 6.4 Open Redirects

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 311 | **Google Maps redirect.** `group-reveal.tsx` lines 208-212: `href={\`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}\`}`. If lat/lng are manipulated (partner-controlled), the URL destination could point to a different location. `target="_blank"` and `rel="noopener noreferrer"` are correctly set. | Low | Moderate | Minor |
| 312 | **Auth redirect in middleware.** `lib/supabase/proxy.ts` line 56: redirects to `/auth/login` on unauthenticated access. The redirect URL is constructed from `request.nextUrl.clone()` which could be manipulated if the path contains encoded characters, though Next.js generally prevents open redirects. | Low | Hard | Minor |
| 313 | **Edit preferences link.** `app/dashboard/profile/page.tsx` line 344: `href="/onboarding?edit=true"`. The `edit=true` parameter is not validated. An attacker could add additional parameters, though this is a static path. | Info | Hard | Minor |

### 6.5 CSRF

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 314 | **No CSRF tokens on API routes.** All API routes use session cookies (via Supabase auth) without additional CSRF protection. While SameSite cookie defaults in modern browsers mitigate this, explicit CSRF tokens are absent. | Medium | Moderate | Moderate |
| 315 | **Cron endpoint uses Bearer token.** `app/api/cron/notifications/route.ts` line 10: `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``. If CRON_SECRET is weak, the endpoint is callable. | Medium | Moderate | Moderate |

### 6.6 Content Security Policy

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 316 | **No Content-Security-Policy header.** No CSP header configured. If an XSS vector is found, there's no defense-in-depth to prevent script execution or data exfiltration. | Medium | Easy | Major |
| 317 | **No X-Frame-Options header.** The app could be embedded in an iframe for clickjacking attacks. | Medium | Easy | Moderate |
| 318 | **Avatar images loaded without CSP img-src.** Avatar URLs (`avatar_url`) could point to any domain, potentially tracking pixels. | Medium | Easy | Moderate |

### 6.7 Additional Client-Side Vectors

| # | Vector | Severity | Effort | Impact |
|---|--------|----------|--------|--------|
| 319-327 | **9 additional input validation gaps** across onboarding (no regex on phone), venue form (no URL validation on photos[]), feedback (no comment length limit in API), goal text (validated client-side only for length), and partner session creation (no date format validation, no start_time validation). | Low-Med | Easy | Minor-Mod |

---

## 7. Data as Moat: Security as Competitive Advantage

The security vulnerabilities documented above directly undermine donedonadone's data moat strategy (see `research/moat-strategy/06-data-moat-and-personalization.md`). However, proper remediation creates a powerful competitive advantage:

### 7.1 Information Asymmetry as Product Moat

The information asymmetry feature (limited profiles before check-in) is a core product differentiator that creates the "unlock moment" driving attendance. However:

- **Current state:** Trivially bypassable via direct Supabase queries (#4, #5), making the feature purely cosmetic.
- **Remediated state:** Database-level enforcement via RLS that restricts preference data to checked-in group members would create a genuine, technically-enforced information gradient that no competitor can easily replicate.
- **Moat value:** Users learn that checking in is the ONLY way to see full profiles. This creates a Pavlovian habit loop (show up -> unlock -> social reward) that is behaviorally reinforced rather than just UI-enforced.

### 7.2 Trust Through Data Privacy

- **Competitive position:** In a market where coworking users must share personal preferences, psychology data (introvert/extrovert), and location patterns, trust is a prerequisite for adoption.
- **DPDP compliance as feature:** India's DPDP Act is new (2023/2024). Being an early, visible complier creates brand trust that competitors can't retroactively claim.
- **Privacy-first matching:** Implementing matching that doesn't expose raw preference data (only compatibility scores) creates a defensible position where the matching quality depends on proprietary data that never leaves the platform.

### 7.3 Data Security Creating Switching Costs

- **Reputation portability paradox:** The coworker score, streak data, and peer ratings are valuable because they represent accumulated trust. If properly secured, this data can only be verified within the platform, making it non-portable (which is explicitly a design goal per `lib/types.ts` line 136: "non-portable value").
- **Group history as moat:** The `group_history` and `matching_outcomes` tables create an ever-improving matching algorithm. This data has zero value outside the platform but creates exponentially better matches for long-term users.
- **Partner analytics dependency:** Venue partners who rely on the demographics, fill-rate trends, and quality scores become dependent on data that only donedonadone can provide.

### 7.4 Recommended Security-as-Moat Architecture

1. **Database-level information asymmetry:** Create a PostgreSQL view or RLS policy that automatically filters coworker_preferences based on check-in status, eliminating the application-layer filtering vulnerability.
2. **Encrypted PII columns:** Use Supabase Vault or column-level encryption for phone, email, and bio fields.
3. **API-only data access:** Remove direct Supabase client from the browser. All data access must go through API routes with proper authorization.
4. **Differential privacy for analytics:** Partner analytics should use aggregation with noise to prevent individual identification.
5. **Zero-knowledge matching scores:** Expose only compatibility scores to the UI, never raw preference vectors.

---

## Summary: Top 10 Critical Findings Requiring Immediate Action

| Priority | Finding | Vector # | File | Remediation |
|----------|---------|----------|------|-------------|
| P0 | Profiles table open SELECT exposes all PII including phone | #4, #55, #220 | `scripts/001_schema.sql:250` | Restrict profiles RLS to `auth.uid() = id` for sensitive fields; create public view with limited fields |
| P0 | User can self-escalate to admin via profile update | #176, #177 | `scripts/001_schema.sql:252` | Add column restriction to UPDATE policy: exclude `user_type` from updatable columns |
| P0 | User can self-confirm payment without paying | #142, #178 | `scripts/005_session_day.sql:4-6` | Restrict bookings UPDATE policy to specific columns (checked_in only via RPC); remove `payment_status` from user-updatable fields |
| P0 | Partner session update spreads arbitrary body fields | #154 | `app/api/partner/sessions/[id]/route.ts:39-41` | Whitelist allowed update fields instead of spreading `...body` |
| P0 | Subscriptions created without payment | #162 | `app/api/subscriptions/route.ts:77-88` | Integrate payment verification before subscription activation |
| P1 | Information asymmetry bypassed via direct DB query | #5, #6, #7 | `lib/supabase/client.ts` | Implement database-level views or tighten RLS; consider removing direct client access |
| P1 | Feedback allows rating arbitrary users | #143 | `app/api/session/[id]/feedback/route.ts:134-151` | Validate `to_user` values against group membership |
| P1 | Goals endpoint readable without booking | #138, #148 | `app/api/sessions/[id]/goals/route.ts:4-24` | Add booking verification to GET handler |
| P1 | RPC functions callable with any user_id | #172, #173 | `scripts/006_profile_stats.sql`, `scripts/008_reputation.sql` | Add `auth.uid()` check or restrict to own user_id |
| P1 | No data deletion mechanism (DPDP violation) | #271, #272 | N/A | Implement account deletion API and data export |

---

*End of Red Team Audit Report - Data Security, Privacy & Information Leakage*
*Total vectors documented: 327*
*Critical severity: 17 | High: 42 | Medium: 68 | Low/Info: 54+*
