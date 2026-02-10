# 16. Master Executive Synthesis -- Red Team Review

**Platform:** donedonadone -- Group coworking matching platform
**Date:** 2026-02-09
**Report Type:** Capstone Synthesis of 12 Specialist Red Team Audits
**Codebase:** branch `app-foundation-build` @ commit `be13b5a`
**Author:** Red Team Lead

---

## 1. Executive Summary

Twelve specialist red teams reviewed every surface of the donedonadone platform across security, payments, privacy, business logic, infrastructure, database, growth, AI, UX, competitive defense, legal compliance, and social engineering. The combined audit produced **2,919 distinct attack/weakness vectors** -- a number that reflects the platform's broad ambition touching payments, identity, physical safety, and algorithmic matching simultaneously.

### Severity Breakdown (Aggregate)

| Severity | Count | % of Total |
|----------|------:|----------:|
| Critical | 128 | 4.4% |
| High | 325 | 11.1% |
| Medium | 668 | 22.9% |
| Low / Info | 449 | 15.4% |
| Opportunity/Gap | ~1,349 | 46.2% |
| **Total** | **2,919** | **100%** |

The "Opportunity/Gap" category captures growth, AI, UX, and competitive vectors that are not security vulnerabilities in the traditional sense but represent missing capabilities that directly affect platform viability.

### Top 5 Most Dangerous Findings

1. **Payment verification is pure self-attestation.** Users click "I have paid" and the system believes them. There is zero server-side UPI transaction verification. An attacker can book and attend unlimited sessions without paying a single rupee. (Reports 01, 02, 04, 06, 07)

2. **Privilege escalation to admin via profile update.** The RLS policy allows any authenticated user to UPDATE their own profile row, including the `user_type` column. A single Supabase client call changes `user_type` from "coworker" to "admin," granting full admin access to payments, users, venues, and groups. (Reports 01, 03, 06)

3. **Zero legal infrastructure before launch.** No Terms of Service, no Privacy Policy, no consent collection, no refund policy, no GST registration, no DPDP compliance. The signup flow collects personality data, phone numbers, and behavioral preferences with zero data processing consent. Financial exposure under DPDP Act 2023: up to Rs 250 Cr per violation category. (Report 11)

4. **Physical safety of strangers meeting in person with no identity verification.** The platform facilitates in-person meetups between unverified strangers with no phone verification, no ID check, no background screening, no emergency reporting mechanism, no block/ban feature, and no gender-based safety options. (Reports 11, 12)

5. **Disintermediation is structurally inevitable.** Users meeting in groups of 3-5 for 2-4 hours WILL exchange WhatsApp numbers. After 5 sessions a user has 15-20 contacts -- enough to self-organize without the platform. The matching algorithm's favorite/would-cowork-again features actively deepen the relationships that enable bypass. Estimated revenue leakage: 30-40% of repeat sessions. (Report 10)

### Overall Security Posture: Grade D-

The architecture (Supabase Auth, server-side getUser(), RLS) provides a sound foundation, but the implementation has critical gaps at every trust boundary. Payment flows are entirely honor-based. Authorization checks are missing on most partner/admin routes. RLS policies are permissive to the point of defeating the product's core information asymmetry feature. No monitoring, no audit trail, no incident response capability.

### Overall Moat Strength: 3/10

At pre-launch, the moat is almost entirely theoretical. The matching algorithm exists but is rule-based with static weights. The data flywheel is not connected -- matching outcomes are logged but never consumed. No ML pipeline, no A/B testing, no feedback loop. Community depth is zero. Venue lock-in has no contractual enforcement. A well-funded competitor can replicate everything in 3-4 months.

---

## 2. Attack Vector Census

| # | Domain | Report | Total Vectors | Critical | High | Medium | Low/Info |
|---|--------|--------|------:|------:|-----:|-------:|--------:|
| 01 | Auth & Access Control | 01 | 150 | 12 | 31 | 48 | 59 |
| 02 | Payment & Financial | 02 | 289 | 28 | 64 | 102 | 95 |
| 03 | Data Privacy & Leakage | 03 | 327 | 17 | 42 | 68 | 200 |
| 04 | Business Logic & Gaming | 04 | 216 | 11 | 45 | 89 | 71 |
| 05 | Infrastructure & DevOps | 05 | 180 | 14 | 38 | 52 | 76 |
| 06 | SQL & Database | 06 | 290 | 15 | 48 | 105 | 122 |
| 07 | Growth & Monetization | 07 | 397 | 12 | 62 | 138 | 185 |
| 08 | AI & Automation | 08 | 330 | 4 | 28 | 112 | 186 |
| 09 | UX & Conversion | 09 | 347 | 8 | 42 | 127 | 170 |
| 10 | Competitive Defense | 10 | 193 | 6 | 32 | 65 | 90 |
| 11 | Legal & Compliance | 11 | 287 | 18 | 38 | 78 | 153 |
| 12 | Social Engineering & Abuse | 12 | 154 | 23 | 41 | 52 | 38 |
| | | **TOTAL** | **3,160** | **168** | **511** | **1,036** | **1,445** |

**Note:** Some vectors are identified independently across multiple reports (e.g., self-confirmed payment appears in Reports 01, 02, 04, 06, 07, and 12). After deduplication, the unique vector count is approximately **2,919**. The raw sum of 3,160 reflects the fact that critical findings were flagged by multiple specialists, reinforcing their severity.

---

## 3. Top 10 Critical Vulnerabilities

| Rank | Title | Source | Why It's Critical | Fix Summary | Effort |
|------|-------|--------|-------------------|-------------|--------|
| 1 | **Self-attested payment ("I've paid" button)** | 02, 04, 07 | Users book sessions for free. 100% revenue loss from day one. Every downstream system (groups, streaks, reputation) trusts payment status. | Integrate Razorpay/Cashfree webhook verification; only mark "confirmed" on server callback. | 20-40h |
| 2 | **Privilege escalation via user_type UPDATE** | 01, 03, 06 | Any authenticated user can become admin with a single Supabase client call. Full access to all financial data, user data, and platform controls. | Add column restriction to profiles UPDATE RLS policy: exclude `user_type` from user-updatable columns. | 2h |
| 3 | **No consent, no Privacy Policy, no Terms of Service** | 11 | DPDP Act 2023 violations carrying up to Rs 250 Cr penalty per category. Platform collects personality data, phone numbers, behavioral profiles with zero consent infrastructure. | Draft and deploy ToS + Privacy Policy; add consent checkbox to signup; implement data deletion API. | 40-60h |
| 4 | **Profiles table open SELECT leaks all PII** | 03, 06 | Any authenticated user can query every user's phone number, email prefix, work type, industry, and personality data via direct Supabase client. Defeats information asymmetry entirely. | Restrict profiles RLS to `auth.uid() = id` for full fields; create a limited public view. | 4h |
| 5 | **No identity verification for physical meetups** | 11, 12 | Strangers meet in person with only a self-chosen display name. No phone verification, no ID check, no photo requirement. Enables stalking, harassment, catfishing, and predatory behavior. | Add phone OTP verification at signup; mandatory avatar photo; QR-based venue check-in. | 16-24h |
| 6 | **Subscription activated without payment** | 02, 07 | POST /api/subscriptions creates an active subscription immediately with no payment verification. Users get unlimited sessions for free. | Require payment gateway confirmation before setting status to "active." | 8-16h |
| 7 | **Booking spots consumed without payment** | 02, 04 | Creating a booking immediately increments spots_filled. Unpaid bookings block legitimate users. No expiry, no auto-cancel. Bot can DoS all sessions. | Add payment timeout (15 min auto-cancel); reserve spots only after confirmed payment. | 8h |
| 8 | **No Content Security Policy or security headers** | 05 | Zero CSP, HSTS, X-Frame-Options, or Permissions-Policy headers. Any XSS payload executes unrestricted. Combined with localStorage token storage, XSS = account takeover. | Add security headers via next.config.mjs. | 2h |
| 9 | **SECURITY DEFINER RPCs with no internal auth** | 06 | `auto_assign_groups`, `book_session`, `check_in_user` run as DB owner. Any authenticated user can call them directly via PostgREST with arbitrary parameters. | Add `auth.uid()` checks inside all SECURITY DEFINER functions. | 4-8h |
| 10 | **No block/ban mechanism + no emergency reporting** | 12 | A harassed user cannot prevent being matched with their harasser. No SOS button, no report mechanism, no way to flag safety concerns during a live session. | Implement block list (hard matching constraint); add safety report button; partner alert system. | 16h |

---

## 4. Moat Scorecard

| Dimension | Score (1-10) | Justification |
|-----------|:-----------:|---------------|
| **Network Effects** | 2 | Zero users at pre-launch. Network effects are theoretically designed (groups create connections) but unproven. Small-pool rotation failure means network effects may plateau early in HSR Layout. |
| **Data / Algorithm** | 3 | Matching algorithm exists but is rule-based with hand-tuned weights. `matching_outcomes` table logs data but nothing reads it. No ML pipeline, no feedback loop, no A/B testing. The data flywheel is embryonic. |
| **Reputation / Trust** | 2 | Composite reputation score is well-designed (`compute_coworker_score`) but has zero data. Trust tiers are quantity-based (session count), not quality-based. No identity verification undermines trust entirely. |
| **Brand** | 1 | Pre-launch. No brand recognition. Landing page uses hardcoded fake social proof ("1,000+ coworkers"). No testimonials, no press, no community presence. |
| **Switching Cost** | 3 | Designed switching costs (streaks, reputation, favorites, group history) are well-conceived but accumulate slowly. The "5-session wall" is the critical danger zone -- enough contacts to bypass, not enough sunk cost to stay. |
| **Supply-Side (Venue)** | 2 | No contractual venue exclusivity. No `exclusivity_end_date` column. No guaranteed minimums. Partners can be poached with a single offer from a funded competitor. Venues can self-organize. |
| **Regulatory / Compliance** | 1 | Zero compliance infrastructure. No ToS, no Privacy Policy, no GST registration, no DPDP consent. This is currently a liability, not a moat. If built properly, compliance becomes a barrier to entry for casual competitors. |
| **Technology** | 4 | Clean Next.js + Supabase architecture. Good separation of concerns. 17 SQL migrations show thoughtful schema design. The grouping algorithm, while rule-based, is more sophisticated than most competitors would build in v1. But everything is replicable in 3-4 months. |
| **Composite Score** | **2.3** | The moat is aspirational, not actual. Every moat dimension requires execution, time, and users to activate. The architectural foundations are promising but unproven. |

---

## 5. Strategic Recommendations (Layered)

### Layer 1: Security Foundation -- "What Must Be True for the Platform to Survive"

Without these, the platform can be destroyed on day one.

1. **Integrate server-side payment verification.** Razorpay or Cashfree webhook that moves payment_status to "confirmed" only on verified transaction callback. Remove the "I've paid" self-attestation model entirely.
2. **Fix privilege escalation.** Add column restriction to profiles UPDATE RLS: `user_type` must not be user-updatable. This is a 2-hour fix that closes the most dangerous single vulnerability.
3. **Add security headers.** CSP, HSTS, X-Frame-Options, Permissions-Policy via next.config.mjs. Two hours of work eliminates an entire attack class.
4. **Add auth.uid() checks inside all SECURITY DEFINER RPCs.** Prevent direct invocation with arbitrary parameters.
5. **Restrict profiles and bookings RLS.** Remove open SELECT on profiles for non-own records. Restrict bookings UPDATE to specific columns via RPC-only pattern.

### Layer 2: Trust Architecture -- "What Must Be True for Users to Stay"

Without these, users will not feel safe or return.

1. **Phone OTP verification at signup.** One phone = one account. Eliminates Sybil attacks, referral farming, and adds identity assurance for in-person meetups.
2. **Block/ban mechanism.** Users must be able to prevent being matched with specific people. Hard constraint in the matching algorithm (-999 penalty or exclusion).
3. **Safety reporting and emergency contact.** In-session "Report" button. Pre-session trusted contact sharing. Post-session safety check-in notification.
4. **Legal infrastructure.** Terms of Service, Privacy Policy, consent checkboxes, refund policy, age verification (18+ declaration), code of conduct. Non-negotiable before public launch.
5. **Booking expiry.** Auto-cancel unpaid bookings after 15 minutes. Release spots back to inventory.

### Layer 3: Growth Engine -- "What Must Be True for Viral Growth"

Without these, acquisition stalls.

1. **Google/Apple social login.** Single-tap signup. Eliminates 40-60% of signup abandonment.
2. **Reduce onboarding to 3 steps.** Name + work vibe + noise preference. Everything else deferred or optional. Target: landing to first booking in under 5 minutes.
3. **Functional payment flow.** Working Razorpay/Cashfree integration with proper QR/UPI intent links. Payment is the #1 conversion blocker.
4. **Referral system hardening.** Credit on first completed session (not signup). Rate limiting. Phone-verified accounts only. WhatsApp share button with deep link.
5. **Share triggers at high-emotion moments.** Post-session group photo share, booking confirmation share, streak milestone share, Wrapped share.

### Layer 4: Compounding Moat -- "What Must Be True for Unassailable Competitive Advantage"

Without these, a funded competitor can replicate everything.

1. **Close the matching feedback loop.** Weekly join of `matching_outcomes` + `session_feedback` + `member_ratings`. Compute which matching dimensions actually predict satisfaction. Adjust weights based on data, not intuition.
2. **Anti-disintermediation value.** The platform must provide value that WhatsApp groups cannot: algorithmic matching with new compatible people, venue variety, streak/reputation portability, quality guarantees. Double down on DISCOVERY (new connections) over REUNION (repeat groupings).
3. **Venue contractual lock-in.** Minimum 6-month exclusive partnerships with volume guarantees. Add `exclusivity_end_date` and `min_sessions_per_week` to the venues table. First-mover advantage in HSR Layout cafes is time-limited.
4. **Reputation portability.** Make the Coworker Score genuinely valuable -- visible to group members, used as a trust signal, difficult to rebuild on a competing platform. Every session invested makes leaving more costly.
5. **Cross-session relationship intelligence.** Track the social graph. Recommend "You haven't coworked with Priya in 3 weeks -- she's at Third Wave tomorrow." This context is something no WhatsApp group can replicate.

### Layer 5: AI-Native Platform -- "What Must Be True for the Platform to Be Intelligent"

Without these, the platform is a booking tool, not an intelligence engine.

1. **Extract matching to a Python microservice.** PL/pgSQL cannot use ML libraries. Deploy a FastAPI service that receives user IDs and returns group assignments.
2. **Build user embeddings.** Dense vector representations from stated preferences + behavioral history + social graph. Store in pgvector.
3. **Train satisfaction prediction model.** Input: user pair embeddings + venue + time features. Output: predicted session satisfaction. Replace hand-tuned weights with learned predictions.
4. **A/B testing infrastructure.** Session-level random assignment to algorithm variants. Statistical significance testing before rollout.
5. **Churn prediction and intervention.** Identify at-risk users before they leave. Personalized retention offers.

---

## 6. Solo Founder Priority Framework

### This Week (5 items)

These can each be completed in 2-8 hours and close existential risks.

| # | Item | Time | Rationale |
|---|------|------|-----------|
| 1 | Fix privilege escalation: add column restriction to profiles UPDATE RLS | 2h | Single most dangerous vulnerability. One line of SQL. |
| 2 | Add security headers (CSP, HSTS, X-Frame-Options) to next.config.mjs | 2h | Eliminates XSS execution, clickjacking, SSL stripping. |
| 3 | Add auth.uid() checks inside SECURITY DEFINER RPCs | 4h | Prevents direct RPC invocation with spoofed parameters. |
| 4 | Restrict profiles RLS: remove open SELECT for sensitive fields | 4h | Stops PII harvesting via direct Supabase client queries. |
| 5 | Add booking expiry: cron job auto-cancels unpaid bookings after 15 min | 4h | Prevents spot-hoarding DoS and unpaid booking accumulation. |

### This Month (10 items)

| # | Item | Time | Rationale |
|---|------|------|-----------|
| 1 | Integrate Razorpay/Cashfree payment gateway with webhook verification | 24h | Without real payments, there is no business. |
| 2 | Draft and deploy Terms of Service + Privacy Policy | 16h | Legal prerequisite for any public launch. Outsource to a startup lawyer. |
| 3 | Add consent checkbox at signup + data processing notice | 4h | DPDP Act compliance. |
| 4 | Phone OTP verification at signup (Supabase Phone Auth or MSG91) | 8h | Identity assurance + Sybil prevention. |
| 5 | Google social login (Supabase OAuth provider) | 4h | Largest single conversion improvement. |
| 6 | Reduce onboarding to 3 essential steps, defer the rest | 8h | 7-step quiz is the #2 conversion killer after payment. |
| 7 | Block/ban mechanism in matching algorithm | 8h | Minimum safety feature for in-person meetups. |
| 8 | Safety report button + code of conduct page | 8h | Legal and moral prerequisite. |
| 9 | GST registration + invoice generation | 16h | Tax compliance. Outsource to CA. |
| 10 | Add referral credit on first completed session, not signup | 4h | Closes referral farming exploit. |

### This Quarter (15 items)

| # | Item | Time | Rationale |
|---|------|------|-----------|
| 1 | Close matching feedback loop (weekly evaluation pipeline) | 16h | Activates the data moat. |
| 2 | Implement A/B testing for algorithm variants | 16h | Data-driven algorithm improvement. |
| 3 | Venue partner agreements with 6-month exclusivity | 20h | Supply-side lock-in. Legal work. |
| 4 | Comprehensive RLS audit + column-level restrictions | 12h | Security hardening across all 18+ tables. |
| 5 | Account deletion / data export (DPDP compliance) | 8h | Data principal rights. |
| 6 | Dynamic pricing (weekend premium, last-minute discounts) | 12h | Revenue optimization. |
| 7 | Share buttons at key moments (booking, session end, Wrapped) | 8h | Viral loop activation. |
| 8 | Session recommendation engine (basic: vibe + time + venue affinity) | 16h | Personalization as retention lever. |
| 9 | WhatsApp booking confirmation (WhatsApp Business API) | 12h | India-native communication channel. |
| 10 | Corporate/team pricing tier | 16h | High-LTV revenue stream. |
| 11 | Calendar integration (Google Calendar .ics) | 4h | Reduce no-shows. |
| 12 | Monitoring + alerting (Vercel Analytics + Supabase logs + PagerDuty) | 8h | Cannot defend what you cannot see. |
| 13 | Rate limiting on all API routes (Vercel Edge Middleware) | 8h | Prevents brute-force, DoS, and automation abuse. |
| 14 | Audit logging for admin actions | 8h | Accountability and forensics. |
| 15 | Venue safety verification checklist (FSSAI, fire NOC, insurance) | 8h | Liability reduction. |

### What to Delegate / Automate / Skip

| Action | Items |
|--------|-------|
| **Delegate to lawyer** | ToS, Privacy Policy, venue partner agreement, GST registration, DPDP compliance assessment |
| **Delegate to CA** | GST filing, TDS compliance, invoicing setup |
| **Automate** | Booking expiry (cron), payment verification (webhook), group assignment (scheduled RPC), streak updates (trigger), notification sending (cron) |
| **Skip for now** | MFA (add when admin abuse is a real risk, not a theoretical one), device fingerprinting (phone OTP is sufficient for v1), ML pipeline (close the feedback loop first with SQL, then extract), annual subscriptions (quarterly is fine for now), multi-city (solve HSR Layout first) |

---

## 7. Moat Compounding Timeline

### Month 1: Fragile Foundation

**Moat state:** Score 2/10. Fully replicable.

- Payment gateway live. Real money flows.
- Phone verification eliminates Sybil accounts.
- Legal infrastructure in place (ToS, Privacy Policy, consent).
- Security hardened: RLS fixed, headers added, RPCs secured.
- 50-100 real users doing sessions.
- Data: 200-500 matching outcomes with feedback. Not enough to learn from, but the pipeline exists.

**Vulnerability:** Any funded team can build this in 90 days.

### Month 3: Early Traction

**Moat state:** Score 3.5/10. Thin but forming.

- 300-500 active users. Network effects beginning to activate within HSR Layout.
- Feedback loop closed: first data-driven weight adjustment deployed. Algorithm is provably better than a cold-start competitor's.
- 5-10 venue partners with exclusivity agreements. Competitor must negotiate from scratch.
- Reputation scores meaningful for 100+ users. First switching cost appears.
- Referral system hardened and driving 20% of new signups.

**Vulnerability:** A VC-funded competitor with Rs 5 Cr can still win by subsidizing free sessions.

### Month 6: Data Advantage

**Moat state:** Score 5/10. Meaningful and growing.

- 1,000+ active users. 5,000+ matching outcomes. Algorithm has been through 3+ weight adjustment cycles.
- User embeddings computed. Matching quality measurably superior to rule-based approaches.
- 15-20 venue partners across HSR Layout and expanding to Koramangala.
- Streaks of 10-20 weeks for power users. Reputation scores of 70+ for 100+ users. Leaving means losing months of accumulated status.
- A/B testing running. Each week the algorithm gets better.
- WhatsApp-based disintermediation is happening (inevitable) but retention signals show 60-70% of users continue using the platform because algorithmic matching with NEW people is something WhatsApp groups cannot provide.

**Vulnerability:** Disintermediation caps growth at ~60-70% retention. Must continuously deliver enough new, compatible introductions to justify the platform fee.

### Year 1: Compounding Intelligence

**Moat state:** Score 6.5/10. Difficult to replicate.

- 3,000-5,000 active users across 3-4 Bangalore neighborhoods.
- 50,000+ matching outcomes. ML model deployed. Satisfaction prediction RMSE < 0.8.
- Churn prediction model identifies at-risk users 2 weeks in advance. Retention improves 15%.
- 30+ venue partners. The best cafes in Bangalore are exclusive. A new competitor must use B-tier venues.
- Corporate tier generating 20%+ of revenue.
- Brand recognition in Bangalore's remote work community. Organic referrals exceed paid acquisition.
- Regulatory compliance (DPDP, GST, safety) is a genuine barrier. A competitor must invest 3+ months in legal infrastructure before launching.

**Vulnerability:** Third Wave Coffee or similar chain self-launches. Mitigated by: they lack matching expertise, community data, and cross-venue variety.

### Year 2: Fortress

**Moat state:** Score 8/10. Approaching unassailable within Bangalore.

- 10,000+ active users. 500,000+ matching outcomes.
- Algorithm accuracy exceeds 90% satisfaction prediction. Users trust the matching because it consistently delivers great groups.
- Social graph of 100,000+ co-working relationships. Transfer learning enables instant high-quality matching in new cities.
- Open-source matching algorithm (commoditize the complement) while keeping the trained model weights proprietary.
- Multi-city expansion (Mumbai, Delhi) bootstrapped by Bangalore data.
- "donedonadone score" becomes an informal credential in the freelance community. Like an Uber rating but for professional reliability.

**Residual vulnerability:** A Big Tech entry (LinkedIn Cowork, Google Local) with massive distribution. Mitigated by: Big Tech has never successfully built IRL community products.

---

## 8. Final Verdict

### Is donedonadone viable?

**Yes, conditionally.** The core insight is sound: solo remote workers want structured social accountability, and algorithmic matching can produce better group chemistry than self-selection. The architecture is well-designed for a solo founder. The Supabase + Next.js + Vercel stack is the right choice for speed and cost.

However, the current codebase is NOT launch-ready. The payment system is non-functional. The security posture has 3-5 vulnerabilities that would make national news if exploited ("platform lets users attend sessions for free" or "anyone can become admin"). The legal exposure under DPDP alone could be company-ending. The 23-step signup funnel will kill conversion before any moat can form.

### What's the #1 existential risk?

**Disintermediation.** Not a competitor. Not a security breach. The fundamental threat is that the product works TOO WELL -- users form great connections, exchange WhatsApp numbers, and stop using the platform. This is not a bug to be fixed; it is a structural tension that must be managed through continuous delivery of value that offline coordination cannot replicate: new compatible introductions, venue variety, quality guarantees, and intelligent scheduling.

### What's the #1 opportunity?

**The matching data flywheel.** No competitor in India has a dataset of "which groups of coworkers had great chemistry and why." Every session generates ground-truth signal about human compatibility in professional settings. If the feedback loop is closed (matching outcomes connected to satisfaction ratings), the algorithm improves with every session. After 6 months and 5,000+ sessions, the matching quality becomes a genuine competitive moat that would take any competitor 6+ months and thousands of sessions to replicate. This is the Waze playbook applied to coworking: the product gets better because people use it.

### Thesis: How to Win

donedonadone wins by executing three things faster than anyone can copy: (1) closing the matching feedback loop so the algorithm improves weekly, (2) locking in the best 20 venues in HSR Layout with exclusive partnerships before any competitor enters, and (3) building enough community trust through safety, reliability, and great sessions that the switching cost of abandoning your reputation, streak, and curated network exceeds the Rs 100-150 per-session platform fee. The race is not to build the most features. The race is to accumulate 5,000 matching outcomes with feedback before anyone else starts. Every session is a data point competitors do not have. Ship the minimum viable secure product, fix payments, fix legal, and start running sessions. The moat compounds from day one -- but only if sessions are actually happening.
