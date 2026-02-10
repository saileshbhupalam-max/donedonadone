# Pending Issues — Ranked by Impact

> Last updated: February 2026
> Source: Red team review (2,919 attack vectors, 16 reports in `research/red-team-review/`)
>
> Phases 1-4 (Quick Wins, P0, P1, P2) are **implemented**. This file tracks remaining work.

---

## Tier 1: Launch Blockers (Do before accepting real money)

### 1. Razorpay Payment Gateway
- **Impact:** CRITICAL — current flow uses "I've paid" self-attestation with zero server-side verification. Users can book without paying.
- **Effort:** 8-10 hours
- **What:** Replace UPI self-attestation with Razorpay payment gateway. Server-side webhook confirms payment before booking is marked `confirmed`.
- **Requires:** Razorpay account + API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
- **Files:** `lib/payments.ts`, `app/api/bookings/[id]/payment/route.ts`, `components/dashboard/booking-sheet.tsx`, new `app/api/webhooks/razorpay/route.ts`
- **Red team ref:** 02-payment-financial.md (vectors PF-001 to PF-050)

### 2. Cloudflare Turnstile CAPTCHA
- **Impact:** HIGH — signup and login have zero bot protection. Automated account creation is trivial.
- **Effort:** 2 hours
- **What:** Add invisible CAPTCHA challenge on signup, login, and booking forms.
- **Requires:** Cloudflare Turnstile site key + secret (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`)
- **Files:** `app/auth/sign-up/page.tsx`, `app/auth/login/page.tsx`, new `lib/turnstile.ts`
- **Red team ref:** 01-auth-access-control.md (vectors AC-030 to AC-035)

### 3. Rate Limiting
- **Impact:** HIGH — all API routes are unlimited. A single user can hammer booking/referral/feedback endpoints.
- **Effort:** 3 hours
- **What:** Add per-IP and per-user rate limiting via Upstash Redis or Vercel KV.
- **Requires:** Upstash account (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) OR Vercel KV
- **Files:** new `lib/rate-limit.ts`, `middleware.ts` or individual routes
- **Red team ref:** 05-infrastructure-devops.md (vectors ID-020 to ID-030)

---

## Tier 2: High Impact (Do within first month of launch)

### 4. Google OAuth Sign-in
- **Impact:** HIGH — reduces signup friction by 60-70%. Most target users (freelancers, remote workers) have Google accounts.
- **Effort:** 2 hours
- **What:** Enable Google OAuth in Supabase dashboard, add "Continue with Google" button.
- **Requires:** Google Cloud OAuth client ID configured in Supabase Auth settings
- **Files:** `app/auth/login/page.tsx`, `app/auth/sign-up/page.tsx` (add Google button), callback route already exists at `app/auth/callback/route.ts`
- **Red team ref:** 09-ux-conversion.md (vector UC-015)

### 5. Venue Photo Uploads
- **Impact:** HIGH — venues without photos get 40-60% fewer bookings. Currently no way to upload venue images.
- **Effort:** 4 hours
- **What:** Enable Supabase Storage for venue images. Partner uploads photos via dashboard. Display in session cards and venue detail.
- **Requires:** Supabase Storage bucket configuration
- **Files:** `app/api/partner/venue/route.ts`, `components/partner/venue-form.tsx`, session card components
- **Red team ref:** 09-ux-conversion.md (vector UC-040)

### 6. Anti-Collusion Detection
- **Impact:** MEDIUM-HIGH — groups of friends could game the matching system, inflate reputation, or always get grouped together.
- **Effort:** 3 hours
- **What:** Flag users who always rate each other 5 stars. Detect repeated group pairings above random chance. Alert admin dashboard.
- **Requires:** Nothing external
- **Files:** new `lib/anti-collusion.ts`, admin dashboard additions
- **Red team ref:** 04-business-logic-gaming.md (vectors BL-080 to BL-100)

### 7. Partner KYC Verification
- **Impact:** MEDIUM-HIGH — anyone claiming to be a venue partner gets partner access. No identity verification.
- **Effort:** 2 hours
- **What:** Add document upload (GSTIN, FSSAI) to partner onboarding. Admin approval workflow before venue goes live.
- **Requires:** Supabase Storage for document uploads
- **Files:** `app/partner/venue/page.tsx`, admin venue approval page, `app/api/admin/venues/[id]/route.ts`
- **Red team ref:** 11-legal-compliance.md (vectors LC-040 to LC-050)

### 8. Partner Agreement / Contract
- **Impact:** MEDIUM-HIGH — no legal agreement between platform and venue partners. Revenue split, liability, and termination terms undefined.
- **Effort:** 4 hours
- **What:** Create a partner agreement page. Require digital acceptance before venue activation.
- **Requires:** Legal review of agreement text
- **Files:** new `app/partner/agreement/page.tsx`, partner onboarding flow updates
- **Red team ref:** 11-legal-compliance.md (vectors LC-060 to LC-070)

---

## Tier 3: Medium Impact (Do within first quarter)

### 9. Dynamic Pricing
- **Impact:** MEDIUM — peak hours (6-8 PM) should cost more, off-peak (10 AM weekday) should be cheaper to balance demand.
- **Effort:** 10 hours
- **What:** Add demand multiplier to session pricing. Adjust based on fill rate, day of week, and time slot.
- **Requires:** Nothing external
- **Files:** `lib/config.ts`, session creation flow, pricing display components
- **Red team ref:** 07-growth-viral-monetization.md (vectors GV-060 to GV-070)

### 10. Funnel Analytics
- **Impact:** MEDIUM — no visibility into where users drop off (landing → signup → onboarding → first booking → repeat).
- **Effort:** 3 hours
- **What:** Track key events (page views, signup, onboarding complete, first booking, check-in, feedback) in a lightweight internal events table or Vercel Analytics.
- **Requires:** Vercel Analytics (free tier) OR internal events table
- **Files:** new `lib/analytics.ts`, layout/page wrappers
- **Red team ref:** 09-ux-conversion.md (vectors UC-070 to UC-080)

### 11. Onboarding Tour
- **Impact:** MEDIUM — new users land on the dashboard with no guidance. First-session conversion depends on clear next steps.
- **Effort:** 2 hours
- **What:** Add a lightweight tooltip tour on first dashboard visit (highlight "Browse Sessions", explain booking flow).
- **Requires:** Nothing external (or use `driver.js` / `react-joyride` for polish)
- **Files:** dashboard page, new tour component
- **Red team ref:** 09-ux-conversion.md (vector UC-055)

### 12. Preference Change Rate Limit
- **Impact:** MEDIUM — users could rapidly flip preferences to game the matching algorithm and always get desired groups.
- **Effort:** 1 hour
- **What:** Add `preferences_updated_at` timestamp, limit changes to once per 24 hours.
- **Requires:** Nothing external
- **Files:** `app/api/onboarding/route.ts`, preferences update flow
- **Red team ref:** 04-business-logic-gaming.md (vectors BL-060 to BL-070)

### 13. Waitlist → Auto-Promotion
- **Impact:** MEDIUM — when a session is full, there's no waitlist. Cancellations waste capacity.
- **Effort:** 2 hours
- **What:** Add waitlist positions. When someone cancels, auto-promote the next waitlisted user and notify them.
- **Requires:** Nothing external
- **Files:** booking route, cancel flow, notification cron
- **Red team ref:** 04-business-logic-gaming.md (vector BL-110)

### 14. Wrapped / Year-in-Review Sharing
- **Impact:** MEDIUM — the `/dashboard/wrapped` page exists but has no shareable image or social sharing.
- **Effort:** 2 hours
- **What:** Generate a shareable card image (using `@vercel/og` or canvas) for Instagram/Twitter/WhatsApp stories.
- **Requires:** Nothing external
- **Files:** `app/dashboard/wrapped/page.tsx`, new share image API
- **Red team ref:** 07-growth-viral-monetization.md (vector GV-100)

### 15. Calendar Integration (iCal Export)
- **Impact:** MEDIUM — users can't add their booked sessions to Google Calendar / Apple Calendar.
- **Effort:** 1 hour
- **What:** Generate .ics file download link for each booking. "Add to Calendar" button.
- **Requires:** Nothing external
- **Files:** new `app/api/bookings/[id]/ical/route.ts`, booking detail UI
- **Red team ref:** 09-ux-conversion.md (vector UC-050)

### 16. Negative Rating Penalty
- **Impact:** MEDIUM — users with consistently low ratings still get matched normally. No disincentive for bad behavior.
- **Effort:** 0.5 hours
- **What:** Weight negative `would_cowork_again=false` ratings into coworker score. Below threshold → matching restriction.
- **Requires:** Nothing external — adjust `compute_coworker_score` RPC
- **Files:** `scripts/014_red_team_fixes.sql` (update compute_coworker_score)
- **Red team ref:** 04-business-logic-gaming.md (vector BL-040)

---

## Tier 4: Strategic / AI-Native (Post-traction backlog)

### 17. ML Matching Weights — 40h
Replace heuristic group matching with a trained model. Use session feedback as training signal. Optimize for `would_cowork_again` rate.

### 18. A/B Testing Framework — 20h
Test pricing, matching parameters, onboarding flows. Requires feature flag system and statistical analysis.

### 19. Churn Prediction Model — 20h
Identify at-risk users (booking frequency declining, negative feedback trend) before they leave. Proactive re-engagement.

### 20. User Embeddings — 15h
Vector representations of users based on preferences + behavior for better matching. Use open-source embedding models.

### 21. Demand Forecasting — 15h
Predict session fill rates by time/venue to help partners plan capacity and set optimal pricing.

### 22. NLP Sentiment Analysis — 10h
Auto-analyze feedback text to extract sentiment and key themes. Flag toxic reviews. Surface insights to admins.

### 23. Open-Source Matching Algorithm — 8h
Publish matching algo as OSS for community/academic contributions. Network effect moat.

### 24. Exploration-Exploitation in Matching — 15h
Balance grouping users with compatible people (exploitation) vs. introducing novel pairings (exploration) to build broader networks.

### 25. In-App Messaging — 30h
Post-session chat between group members. Keeps interactions on-platform. Requires real-time infrastructure.

### 26. Corporate / Team Pricing — 15h
B2B tier: companies buy bulk session credits for their remote workers. Monthly invoicing.

### 27. Streak Milestone Rewards — 8h
Celebratory animations and tangible rewards (venue discounts, free sessions) at streak thresholds (4, 8, 12, 26, 52 weeks).

### 28. Endorsement System — 10h
LinkedIn-style skill endorsements between coworkers. "Great at design", "Inspiring founder". Adds to public profile.

### 29. Venue Exclusivity Deals — 5h
Negotiate partner-only rates or time slots. Platform advantage over direct booking.

### 30. Quality Alert System — 5h
Auto-flag venues/users with declining ratings. Dashboard alerts for admins. Automated warning emails.

### 31. Community Hosts — 8h
Power users who facilitate sessions. Higher trust tier. Get perks (free sessions, priority matching).

### 32. Multi-Neighborhood Expansion — 15h
Koramangala, Indiranagar, Whitefield. Requires area-based session discovery + venue onboarding pipeline.

### 33. Privacy-Preserving ML — 20h
Federated learning or differential privacy for matching. User data never leaves Supabase, only model gradients.

### 34. Full Audit Trail — 8h
Immutable append-only log of all state changes (bookings, payments, role changes, RLS policy decisions). Compliance requirement at scale.

---

## Already Resolved (for reference)

| Item | Status | Note |
|------|--------|------|
| WhatsApp number masking | Not needed | WhatsApp Communities now masks numbers natively |
| Real QR codes | Implemented | `qrcode` package integrated into payment flow |
| Geolocation check-in | Implemented | Browser Geolocation API + distance validation |
| Referral deep links | Skipped for now | Current flow (manual code entry) works fine for MVP |

---

## How to Use This File

1. **Before launch:** Complete Tier 1 (items 1-3). These are existential risks.
2. **First month:** Work through Tier 2 (items 4-8). These drive retention and trust.
3. **First quarter:** Pick from Tier 3 (items 9-16) based on user feedback.
4. **Post-traction:** Tier 4 items (17-34) are the AI-native moat. Prioritize based on data.

For detailed attack vectors and analysis, see `research/red-team-review/`.
