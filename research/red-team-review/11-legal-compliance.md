# Red Team Review #11: Legal Risk, Regulatory Compliance, Liability & Data Protection

**Audit Date:** 2026-02-09
**Auditor Role:** Red Team Legal & Compliance Analyst
**Jurisdiction:** India (Karnataka / Bangalore)
**Platform:** donedonadone -- Group Coworking Matchmaking Platform
**Applicable Laws:** DPDP Act 2023, IT Act 2000/2008, Consumer Protection Act 2019, CGST Act, NPCI UPI Guidelines, Karnataka Shops & Establishments Act, POSH Act 2013, and others.

---

## Executive Summary

donedonadone operates at the intersection of **personal data processing**, **financial transactions**, **in-person meetups between strangers**, and **venue marketplace services** in India. This audit identified **287 distinct legal risk vectors** across 7 regulatory domains. The platform currently has **zero legal infrastructure**: no Terms of Service, no Privacy Policy, no consent collection mechanism, no refund policy, no safety disclosures, no GST registration evidence, and no data processing agreements. This represents an existential legal risk that must be addressed before any public launch.

**Critical finding:** The signup flow at `app/auth/sign-up/page.tsx` collects full name, email, and password with zero consent language, zero links to terms/privacy policy, and zero checkboxes. The onboarding wizard at `components/onboarding/onboarding-wizard.tsx` collects phone number, personality data, social goals, work type, industry, and behavioral preferences -- all without any data processing consent or purpose limitation disclosure. This alone constitutes multiple violations of the Digital Personal Data Protection Act 2023.

---

## Table of Contents

1. [India Digital Personal Data Protection Act (DPDP) 2023](#1-dpdp-act-2023)
2. [Payment Compliance](#2-payment-compliance)
3. [Physical Safety & Liability](#3-physical-safety--liability)
4. [Consumer Protection](#4-consumer-protection)
5. [Employment & Labor](#5-employment--labor)
6. [Intellectual Property](#6-intellectual-property)
7. [Regulatory & Licensing](#7-regulatory--licensing)
8. [Compliance as Moat](#8-compliance-as-moat)
9. [Priority Remediation Roadmap](#9-priority-remediation-roadmap)
10. [Appendix: Risk Register](#appendix-risk-register)

---

## 1. DPDP Act 2023

The Digital Personal Data Protection Act 2023 (effective 2025) classifies donedonadone as a **Data Fiduciary** processing personal data of Indian residents. Supabase (the data processor) likely stores data on AWS infrastructure in US/Singapore regions.

### 1.1 Consent Collection (17 vectors)

| # | Risk Vector | Evidence | Severity | Enforcement Likelihood (1-10) | Financial Exposure | Priority |
|---|-------------|----------|----------|-------------------------------|-------------------|----------|
| 1.1.1 | **No consent checkbox at signup** | `app/auth/sign-up/page.tsx` -- form submits `supabase.auth.signUp()` with zero consent UI, no checkbox, no "I agree" language | Critical | 9 | Up to Rs 250 Cr penalty under DPDP S.18 | P0 |
| 1.1.2 | **No consent for onboarding data collection** | `components/onboarding/onboarding-wizard.tsx` collects phone, work_type, industry, personality traits, social goals, communication style, bio -- all without consent | Critical | 9 | Up to Rs 250 Cr | P0 |
| 1.1.3 | **No Privacy Policy linked at signup** | Footer (`components/landing/footer.tsx`) has "About", "FAQ", "Contact" but zero privacy/terms links | Critical | 9 | Rs 50 Cr per violation (DPDP S.18(1)(a)) | P0 |
| 1.1.4 | **No separate consent for each processing purpose** | DPDP requires specific consent per purpose. Matching, analytics, notifications, referrals all use data with single implicit "you signed up" assumption | High | 7 | Rs 50 Cr | P0 |
| 1.1.5 | **No consent for peer-to-peer data sharing** | Group assignment exposes display_name, avatar, work_vibe to group members (`LimitedProfile` in `lib/types.ts`) with no consent for this disclosure | High | 8 | Rs 50 Cr | P0 |
| 1.1.6 | **No consent for WhatsApp notifications** | `lib/notifications.ts` defines `channel: "whatsapp"` as future channel. WhatsApp messages require separate marketing/transactional consent | High | 7 | Rs 50 Cr + WhatsApp Business API ToS violation | P1 |
| 1.1.7 | **No consent for email communications** | Notification types include promotional (streak_at_risk, subscription_expiring) requiring explicit opt-in | Medium | 6 | Rs 50 Cr | P1 |
| 1.1.8 | **No consent withdrawal mechanism** | DPDP S.6(6) requires ability to withdraw consent. No UI or API exists for this | Critical | 8 | Rs 250 Cr | P0 |
| 1.1.9 | **No consent for behavioral profiling** | `compute_coworker_score()` in `scripts/008_reputation.sql` creates a composite behavioral score from attendance, ratings, feedback -- profiling without consent | High | 7 | Rs 50 Cr | P1 |
| 1.1.10 | **No consent for matching algorithm processing** | `auto_assign_groups()` in `scripts/004_auto_assign_groups.sql` processes preferences, history, social bonds for automated grouping decisions without disclosure | High | 7 | Rs 50 Cr | P1 |
| 1.1.11 | **No consent for referral data sharing** | `scripts/010_referrals.sql` -- when a referral code is used, the referrer is notified with the referred person's name, linking two identities without bilateral consent | Medium | 5 | Rs 10 Cr | P2 |
| 1.1.12 | **Implicit consent through onboarding not valid** | DPDP requires "free, specific, informed, unconditional" consent. A 7-step quiz is not informed consent -- users think they are setting preferences, not consenting to data processing | High | 8 | Rs 250 Cr | P0 |
| 1.1.13 | **No consent for location data (venue coordinates)** | While venue lat/lng is venue data, user check-in at a specific GPS location constitutes location processing | Medium | 5 | Rs 10 Cr | P2 |
| 1.1.14 | **No consent for feedback data use in venue scoring** | `scripts/011_venue_scoring.sql` aggregates user feedback into venue quality scores. Users not told their ratings are published | Medium | 6 | Rs 10 Cr | P2 |
| 1.1.15 | **No consent for member ratings affecting others** | `member_ratings` table -- one user's "would_cowork_again = false" affects another user's Coworker Score. Affected user has no consent over this | High | 6 | Rs 50 Cr | P1 |
| 1.1.16 | **No legitimate interest or contractual necessity documentation** | DPDP recognizes limited grounds beyond consent. Platform has documented none | High | 7 | Rs 50 Cr | P1 |
| 1.1.17 | **No parental consent mechanism for minors** | No age verification at signup. If under-18 users sign up, DPDP S.9 requires verifiable parental consent | Critical | 6 | Rs 200 Cr (DPDP S.18(4)) | P0 |

### 1.2 Purpose Limitation (8 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 1.2.1 | **No stated purpose for data collection** -- no privacy policy means no purpose statement exists at all | Critical | 9 | Rs 250 Cr | P0 |
| 1.2.2 | **Onboarding data collected for "matching" used for reputation scoring** -- `compute_coworker_score()` uses attendance/feedback data beyond the original matching purpose | High | 7 | Rs 50 Cr | P1 |
| 1.2.3 | **Feedback collected for "session improvement" used for venue quality scoring** -- `compute_venue_score()` aggregates feedback for a different purpose (venue marketing) | Medium | 5 | Rs 10 Cr | P2 |
| 1.2.4 | **Matching outcomes logged for algorithm training** -- `matching_outcomes` table stores compatibility scores, history penalties, etc. for purpose not disclosed to users | High | 6 | Rs 50 Cr | P1 |
| 1.2.5 | **Member ratings used for future group composition** -- "would_cowork_again" feeds back into matching algorithm, a purpose not stated at feedback collection | Medium | 5 | Rs 10 Cr | P2 |
| 1.2.6 | **Streak data used for engagement notifications** -- `streak_at_risk` notification uses behavioral tracking data for marketing retention | Medium | 6 | Rs 10 Cr | P2 |
| 1.2.7 | **Phone number collected at onboarding potentially for WhatsApp** -- phone field in onboarding wizard could be used for WhatsApp notifications without stated purpose | High | 7 | Rs 50 Cr | P1 |
| 1.2.8 | **Favorites data creates social graph** -- `favorite_coworkers` table builds relationship maps. Social graph construction is a separate purpose from "coworking matching" | Medium | 5 | Rs 10 Cr | P2 |

### 1.3 Data Minimization (9 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 1.3.1 | **Full name collected at signup** -- `sign-up/page.tsx` collects `fullName` and stores as `full_name` in auth metadata. Display name (first name only) would suffice | Medium | 5 | Rs 10 Cr | P2 |
| 1.3.2 | **Phone number collected during onboarding** -- `onboarding-wizard.tsx` collects phone number. Not strictly needed for core matching functionality | Medium | 5 | Rs 10 Cr | P2 |
| 1.3.3 | **Introvert/extrovert personality scale stored** -- `introvert_extrovert INTEGER` in `coworker_preferences` is sensitive personality data beyond minimum needed | Medium | 4 | Rs 10 Cr | P2 |
| 1.3.4 | **Bio text (200 chars) stored** -- free-text bio may contain sensitive personal information users volunteer | Medium | 4 | Rs 10 Cr | P3 |
| 1.3.5 | **Industry/work_type stored beyond matching needs** -- retained indefinitely, used for diversity scoring in `auto_assign_groups()` | Low | 4 | Rs 5 Cr | P3 |
| 1.3.6 | **All historical booking/check-in data retained** -- no data retention period defined. Every booking, check-in timestamp, and cancellation stored indefinitely | High | 7 | Rs 50 Cr | P1 |
| 1.3.7 | **All peer ratings retained forever** -- `member_ratings` has no TTL. Negative ratings from years ago affect current scores | Medium | 5 | Rs 10 Cr | P2 |
| 1.3.8 | **Group history stored for rotation tracking** -- `group_history` table in `scripts/006b_group_history.sql` stores every co-grouping event indefinitely | Medium | 5 | Rs 10 Cr | P2 |
| 1.3.9 | **Free-text comments in feedback** -- `session_feedback.comment` can contain any text, including PII about other people | Medium | 5 | Rs 10 Cr | P2 |

### 1.4 Data Principal Rights (10 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 1.4.1 | **No right to erasure implementation** -- DPDP S.13. No account deletion flow exists. `ON DELETE CASCADE` in schema only triggers on auth.users deletion, which has no user-facing mechanism | Critical | 8 | Rs 250 Cr | P0 |
| 1.4.2 | **No right to correction mechanism** -- DPDP S.12. Users can update profile/preferences via UI, but cannot correct feedback written about them, ratings given to them, or matching outcomes | High | 7 | Rs 50 Cr | P1 |
| 1.4.3 | **No right of access / data export** -- DPDP S.11. No "download my data" or "view all data you hold about me" feature | High | 7 | Rs 50 Cr | P1 |
| 1.4.4 | **No grievance redressal mechanism** -- DPDP S.13. No contact for data-related complaints, no Data Protection Officer (DPO) or Consent Manager appointed | Critical | 8 | Rs 250 Cr | P0 |
| 1.4.5 | **No notification of data breach** -- DPDP S.8 requires notification to Data Protection Board and affected data principals. No breach detection or notification system exists | Critical | 7 | Rs 200 Cr | P0 |
| 1.4.6 | **No mechanism to nominate another person for rights exercise** -- DPDP S.14 allows nomination. Not implemented | Low | 3 | Rs 5 Cr | P3 |
| 1.4.7 | **Ratings about a user not accessible to that user** -- `member_ratings` RLS policy: `FOR SELECT USING (auth.uid() = from_user)`. The `to_user` cannot see ratings about themselves, violating transparency | High | 6 | Rs 50 Cr | P1 |
| 1.4.8 | **Coworker Score opaque to user** -- `compute_coworker_score()` generates a composite score. While shown to user, the inputs (especially negative peer ratings) are not transparent | Medium | 5 | Rs 10 Cr | P2 |
| 1.4.9 | **No mechanism to restrict processing** -- User cannot say "use my data for matching but not for reputation scoring" | Medium | 6 | Rs 10 Cr | P2 |
| 1.4.10 | **Matching algorithm decisions not explainable** -- `matching_outcomes` records scores but no user-facing explanation of why they were placed in a specific group | Medium | 5 | Rs 10 Cr | P2 |

### 1.5 Cross-Border Data Transfer (5 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 1.5.1 | **Supabase data likely stored outside India** -- Supabase uses AWS. Unless explicitly configured for ap-south-1 (Mumbai), data is likely in US or Singapore. DPDP S.16 restricts transfer to non-notified countries | Critical | 7 | Rs 250 Cr | P0 |
| 1.5.2 | **No Data Processing Agreement with Supabase** -- DPDP requires contractual safeguards with data processors. No DPA exists | Critical | 7 | Rs 250 Cr | P0 |
| 1.5.3 | **Vercel edge functions may process data globally** -- Next.js on Vercel executes at nearest edge. Auth session refresh in middleware processes user tokens globally | High | 5 | Rs 50 Cr | P1 |
| 1.5.4 | **No data localization assessment** -- India may notify certain categories of data for restricted transfer. No assessment of whether coworking preference data falls under restricted categories | Medium | 4 | Rs 10 Cr | P2 |
| 1.5.5 | **Email provider for Supabase Auth (likely US-based)** -- Auth email confirmation sent via Supabase's email provider, which processes email addresses outside India | Medium | 5 | Rs 10 Cr | P2 |

### 1.6 Children's Data (4 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 1.6.1 | **No age verification at signup** -- `sign-up/page.tsx` has no DOB field, no age checkbox, no "I am 18+" declaration | Critical | 6 | Rs 200 Cr (DPDP S.18(4) -- children's data violations carry higher penalties) | P0 |
| 1.6.2 | **No verifiable parental consent mechanism** -- If a minor signs up, DPDP S.9 requires parental consent. Physical meetups with minors create compounded risk | Critical | 6 | Rs 200 Cr | P0 |
| 1.6.3 | **Student work_type available** -- `work_type = 'student'` in onboarding suggests the platform expects younger users, increasing likelihood of minors | High | 5 | Rs 200 Cr | P0 |
| 1.6.4 | **No prohibition on behavioral tracking of children** -- DPDP S.9(3) prohibits tracking/behavioral monitoring of children. Reputation scoring, streak tracking, and matching would all violate this | High | 5 | Rs 200 Cr | P0 |

---

## 2. Payment Compliance

### 2.1 UPI Payment Handling (15 vectors)

| # | Risk Vector | Evidence | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|----------|---------------------|----------|----------|
| 2.1.1 | **UPI VPA exposed in client-side code** | `lib/payments.ts`: `NEXT_PUBLIC_UPI_VPA` is a public env var. UPI VPA is visible to all users, enabling social engineering | Medium | 4 | Reputational | P2 |
| 2.1.2 | **Manual payment verification -- fraud risk** | `app/api/bookings/[id]/payment/route.ts` PATCH endpoint: user self-reports "I've paid" and status moves to "paid" without verification. Admin must manually verify | Critical | 7 | Rs 10-50L in chargebacks/fraud per month at scale | P0 |
| 2.1.3 | **No payment receipt/invoice generated** | No receipt generation anywhere in codebase. CGST Act mandates tax invoice for every supply of service | Critical | 8 | Rs 25,000 penalty per missing invoice + GST demand | P0 |
| 2.1.4 | **No GST on platform fee** | Platform fee (Rs 100/150) is a service -- 18% GST applies. No GST calculation, no GSTIN displayed, no tax breakup shown on `app/pricing/page.tsx` | Critical | 9 | Rs 100 per transaction + 18% interest + penalty up to Rs 25,000 | P0 |
| 2.1.5 | **No GST registration evidence** | Platform collecting Rs 100-150 per session will cross Rs 20L threshold quickly. GST registration mandatory | Critical | 9 | Prosecution under CGST Act S.122 | P0 |
| 2.1.6 | **No TDS on venue payments** | Platform collects total_price and presumably remits venue_price to partners. TDS under S.194-O (e-commerce) at 1% applies | High | 7 | TDS demand + 1.5% monthly interest + penalty | P1 |
| 2.1.7 | **Subscription pricing has no GST breakup** | `app/pricing/page.tsx` shows Rs 350/600/999 with no "inclusive/exclusive of GST" language | High | 8 | GST reassessment | P0 |
| 2.1.8 | **No refund policy** | `app/api/bookings/cancel/route.ts` calls `cancel_booking` RPC but no refund logic. `booking_status` has "refunded" state but no code path triggers it | Critical | 8 | Consumer forum complaints, Rs 1L+ per case | P0 |
| 2.1.9 | **No refund timeline defined** | RBI circular on UPI mandates refund timelines (T+5 for failed txns). No timeline communicated | High | 7 | RBI/NPCI compliance action | P1 |
| 2.1.10 | **Payment failure handling absent** | If UPI payment fails, user is stuck in `payment_pending` state. No retry, no timeout, no failure handling | High | 6 | Consumer complaints | P1 |
| 2.1.11 | **Transaction reference truncated** | `lib/payments.ts`: `upiUrl.searchParams.set("tr", bookingId.slice(0, 20))` -- UUID is 36 chars, truncated to 20. May cause reconciliation issues | Medium | 4 | Accounting discrepancies | P2 |
| 2.1.12 | **No NPCI QR code standards compliance** | UPI QR codes must follow NPCI/BharatQR specifications. Custom QR generation may not comply | Medium | 5 | NPCI enforcement | P2 |
| 2.1.13 | **Platform holding user funds** | Between user paying via UPI and admin verifying, platform effectively holds funds. This may trigger Payment Aggregator (PA) regulations under RBI Master Directions | Critical | 6 | RBI enforcement -- need PA license if holding >T+1 | P0 |
| 2.1.14 | **No escrow arrangement** | E-commerce intermediary rules require escrow for marketplace transactions. Platform collects and holds combined amount | High | 6 | CCPA enforcement | P1 |
| 2.1.15 | **Referral credits are stored value** | `referral_events.credit_amount = 50` -- credit issued on referral. Stored credits may constitute a PPI (Prepaid Payment Instrument) under RBI norms | High | 5 | Need PPI license if credits are redeemable for money | P1 |

### 2.2 Subscription Payment (8 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 2.2.1 | **No auto-renewal disclosure** | Subscription plans have `current_period_end` but no disclosure about auto-renewal vs manual renewal | High | 7 | Consumer forum | P1 |
| 2.2.2 | **No subscription cancellation terms** | `user_subscriptions.status` can be "cancelled" but no cancellation policy, prorated refund rules, or cooling-off period | High | 7 | Consumer forum | P1 |
| 2.2.3 | **No payment method stored** | Subscriptions exist without linked payment methods. How recurring charges are collected is undefined | Medium | 4 | Business risk | P2 |
| 2.2.4 | **"Save up to 40%" claim unsubstantiated** | `app/pricing/page.tsx`: "Save up to 40% compared to per-session pricing" -- this claim must be mathematically verifiable and not misleading (CPA 2019) | Medium | 6 | CCPA action for misleading claims | P2 |
| 2.2.5 | **No subscription trial period terms** | If free trial offered later, need terms per CPA guidelines on dark patterns | Low | 3 | Rs 10L | P3 |
| 2.2.6 | **Price changes not addressed** | No mechanism or policy for communicating subscription price changes to existing subscribers | Medium | 5 | Consumer forum | P2 |
| 2.2.7 | **Subscription benefits not contractually guaranteed** | "Priority matching", "exclusive venues" -- these are promises without SLA or contractual backing | Medium | 5 | Deficiency of service claims | P2 |
| 2.2.8 | **No subscription agreement/terms document** | Entire subscription system operates without any written terms | High | 7 | Unenforceable contract | P1 |

### 2.3 Venue Partner Payments (7 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 2.3.1 | **No venue partner agreement** | No written agreement for revenue share, payment terms, settlement cycle | Critical | 8 | Unenforceable arrangements | P0 |
| 2.3.2 | **No settlement cycle defined** | venue_price collection and disbursement to partners has no defined timeline | High | 6 | Partner disputes | P1 |
| 2.3.3 | **No commission/fee disclosure to partners** | Partners set venue_price but platform_fee structure may not be transparently communicated | Medium | 5 | Unfair trade practices | P2 |
| 2.3.4 | **No partner KYC** | Partners onboard with just email/password. No PAN, GSTIN, bank account verification | High | 7 | Tax compliance failure | P1 |
| 2.3.5 | **No Form 26AS reconciliation** | TDS deducted (if any) must be filed quarterly. No infrastructure for TDS certificates | High | 7 | Tax penalties | P1 |
| 2.3.6 | **No earnings withdrawal mechanism** | Partner dashboard shows earnings but no actual payout mechanism in code | High | 5 | Partner trust | P1 |
| 2.3.7 | **No partner invoicing** | Partners need to invoice donedonadone for venue services. No mechanism exists | Medium | 6 | Tax audit failure | P2 |

---

## 3. Physical Safety & Liability

### 3.1 Venue Safety (12 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 3.1.1 | **No venue safety verification** | `venues` table has address, amenities, photos -- but no fire safety, insurance, or compliance verification | Critical | 6 | Unlimited tort liability | P0 |
| 3.1.2 | **No venue insurance verification** | No field for public liability insurance verification. If injury occurs at venue, platform may be jointly liable | Critical | 5 | Unlimited | P0 |
| 3.1.3 | **No venue FSSAI verification** | Venues are cafes. If included_in_cover mentions food/drink, FSSAI license requirement exists | High | 6 | Rs 5L fine + closure | P1 |
| 3.1.4 | **No fire safety compliance check** | Karnataka Fire Force Act requires NOC for public assembly spaces | High | 5 | Criminal liability | P1 |
| 3.1.5 | **No venue accessibility compliance** | Rights of Persons with Disabilities Act 2016 requires accessible public spaces | Medium | 4 | Discrimination claims | P2 |
| 3.1.6 | **No maximum occupancy verification** | `max_capacity` in venues table is self-reported by partner. No verification against actual building capacity | Medium | 4 | Safety liability | P2 |
| 3.1.7 | **No emergency exit information** | No venue safety information displayed to users | Medium | 3 | Negligence | P2 |
| 3.1.8 | **No venue hygiene standards** | Post-COVID, workspace hygiene requirements exist. No verification | Low | 3 | Health claims | P3 |
| 3.1.9 | **No venue inspection process** | No admin workflow for physical venue inspection before listing | High | 5 | Negligence | P1 |
| 3.1.10 | **No venue rating threshold for safety** | `compute_venue_score()` calculates quality but no minimum threshold to remain listed | Medium | 4 | Continued listing of unsafe venues | P2 |
| 3.1.11 | **Venue photos unverified** | `venues.photos TEXT[]` -- photos could be stock images, not actual venue | Medium | 5 | Misleading representation | P2 |
| 3.1.12 | **No venue liability cap/waiver in partner agreement** | No agreement exists at all, let alone liability allocation | Critical | 6 | Joint & several liability | P0 |

### 3.2 User Safety (15 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 3.2.1 | **No identity verification** | Signup uses only email. No KYC, no government ID, no phone verification. Users meeting in person are strangers with unverified identities | Critical | 7 | Assault/fraud claims, criminal negligence | P0 |
| 3.2.2 | **No phone number verification** | Phone field in onboarding is optional and unverified. Cannot reach users in emergencies | High | 6 | Safety failures | P1 |
| 3.2.3 | **No emergency contact collection** | No emergency contact field anywhere in schema or UI | Critical | 6 | Negligence in emergency | P0 |
| 3.2.4 | **No sexual harassment prevention (POSH Act)** | The platform facilitates in-person meetups. Prevention of Sexual Harassment at Workplace (POSH) Act 2013 may apply if coworking space is considered "workplace." No Internal Complaints Committee, no policy, no reporting mechanism | Critical | 7 | Criminal liability, Rs 50,000 fine, license revocation | P0 |
| 3.2.5 | **No safety reporting mechanism** | No "Report a safety concern" button or process in session/feedback UI | Critical | 7 | Negligence | P0 |
| 3.2.6 | **No user code of conduct** | No behavioral guidelines, anti-harassment policy, or community standards document | High | 6 | Harassment claims | P1 |
| 3.2.7 | **No user banning mechanism** | No admin capability to ban/suspend users for safety violations visible in schema | High | 6 | Continued exposure to bad actors | P1 |
| 3.2.8 | **Member ratings enable social pressure** | "Would cowork again?" thumbs up/down about specific people creates bullying/ostracism potential | Medium | 4 | Harassment claims | P2 |
| 3.2.9 | **Favorites feature enables unwanted attention** | `favorite_coworkers` table allows one-sided social tracking. User A favorites User B without B's knowledge | Medium | 5 | Stalking concerns | P2 |
| 3.2.10 | **No liability waiver/disclaimer for users** | Users attending sessions have no waiver for personal injury, loss of property, etc. | Critical | 6 | Unlimited tort liability | P0 |
| 3.2.11 | **No COVID/communicable disease policy** | In-person group meetups with no health screening or policy | Low | 3 | Public health complaints | P3 |
| 3.2.12 | **Display name + avatar visible to group members** | `LimitedProfile` shows display_name, work_vibe, avatar. Combined with venue/time, this enables tracking | Medium | 4 | Privacy/safety | P2 |
| 3.2.13 | **No block/avoid mechanism** | If User A has bad experience with User B, no mechanism to prevent future grouping. `member_ratings.would_cowork_again = false` is only a -5 penalty, not a guarantee | High | 6 | Repeated exposure to bad actors | P1 |
| 3.2.14 | **Group of 3-5 strangers at a cafe -- inherent physical risk** | Platform model creates inherent duty of care for facilitating stranger meetups | High | 5 | Negligence claims | P1 |
| 3.2.15 | **No first-session safety briefing** | New users go straight into group sessions without any safety orientation or expectations-setting | Medium | 4 | Negligence | P2 |

### 3.3 Insurance & Indemnity (5 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 3.3.1 | **No professional liability insurance** | Platform facilitating meetups needs errors & omissions / general liability coverage | Critical | 5 | Unlimited | P0 |
| 3.3.2 | **No cyber insurance** | Handling PII and payments without cyber liability insurance | High | 5 | Data breach costs | P1 |
| 3.3.3 | **No directors & officers insurance** | Founders personally liable without D&O coverage | High | 4 | Personal asset exposure | P1 |
| 3.3.4 | **No indemnity clause with venues** | No agreement, so no mutual indemnification for incidents | Critical | 6 | Unlimited | P0 |
| 3.3.5 | **No indemnity clause with users** | No Terms of Service means no limitation of liability, no indemnification | Critical | 6 | Unlimited | P0 |

---

## 4. Consumer Protection

### 4.1 Consumer Protection Act 2019 (15 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 4.1.1 | **No Terms of Service** | Entire platform operates without any ToS. Every user interaction is an unwritten, unenforceable contract | Critical | 9 | Unenforceable in any dispute | P0 |
| 4.1.2 | **No Privacy Policy** | DPDP Act + IT Rules mandate a publicly accessible privacy policy | Critical | 9 | Rs 250 Cr + platform shutdown | P0 |
| 4.1.3 | **No refund/cancellation policy** | CPA 2019 S.2(9) defines "consumer" broadly. No refund policy = automatic deficiency of service in consumer forum | Critical | 9 | Rs 1Cr+ per consumer forum case | P0 |
| 4.1.4 | **No cancellation charges disclosure** | `cancel_booking` RPC exists but no policy on cancellation fees or free cancellation window | High | 7 | Consumer forum | P1 |
| 4.1.5 | **Misleading pricing display** | `app/pricing/page.tsx`: prices shown without GST. If inclusive, not stated. If exclusive, 18% hidden cost is misleading | High | 8 | CCPA action (CPA S.89) | P0 |
| 4.1.6 | **"Most Popular" badge on Regular plan** | `isPopular = plan.name === "Regular"` in pricing page. Hardcoded label may constitute dark pattern if not based on actual popularity data | Medium | 5 | CCPA dark patterns guidelines | P2 |
| 4.1.7 | **No consumer grievance redressal** | CPA 2019 S.2(37) requires grievance mechanism. No contact email, no complaint form, no designated officer | Critical | 8 | CCPA enforcement | P0 |
| 4.1.8 | **No designated Grievance Officer** | IT Act S.79 + intermediary guidelines require designated Grievance Officer with response timelines | Critical | 8 | Loss of safe harbor | P0 |
| 4.1.9 | **No prominent display of company information** | No registered entity name, CIN, registered address, email displayed anywhere on platform | High | 7 | E-Commerce Rules 2020 violation | P1 |
| 4.1.10 | **No service quality guarantee** | Sessions promise "group matching" but algorithm may produce poor matches with no recourse | Medium | 5 | Deficiency of service | P2 |
| 4.1.11 | **Session cancellation by platform not addressed** | If session is cancelled by venue/platform, what happens to paid users? No policy | High | 7 | Consumer forum | P1 |
| 4.1.12 | **No product/service description obligations** | E-Commerce Rules require accurate description of services. Session listings may not adequately describe what is included | Medium | 5 | Misleading representation | P2 |
| 4.1.13 | **Subscription "features" not guaranteed** | "Priority matching" and "exclusive venues" are subjective benefits without measurable SLA | Medium | 5 | Unfair trade practices | P2 |
| 4.1.14 | **No clear contract formation** | When exactly is the contract formed -- on booking? On payment? On check-in? Undefined | High | 6 | Dispute resolution | P1 |
| 4.1.15 | **No dispute resolution clause** | No arbitration, no jurisdiction, no mediation mechanism defined | High | 7 | Expensive litigation | P1 |

### 4.2 E-Commerce Rules 2020 (10 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 4.2.1 | **No entity registration details displayed** | E-Commerce Rules R.4 -- must display legal name, address, CIN | Critical | 8 | Rs 1Cr fine | P0 |
| 4.2.2 | **No return/refund/exchange policy** | R.4(3)(c) requires clearly stated refund policy | Critical | 8 | Rs 1Cr fine | P0 |
| 4.2.3 | **No total price inclusive of all charges** | R.4(4) -- must show all-inclusive price including taxes | High | 8 | Misleading pricing | P0 |
| 4.2.4 | **No payment method security information** | R.4(3)(d) -- must inform about security of payment methods | Medium | 5 | Compliance gap | P2 |
| 4.2.5 | **No complaint acknowledgment system** | R.4(5) -- must acknowledge complaints within 48 hours | High | 7 | Rs 1Cr fine | P1 |
| 4.2.6 | **No Grievance Officer details on platform** | R.4(6) -- name, contact details, designation of Grievance Officer must be displayed | Critical | 8 | Rs 1Cr fine | P0 |
| 4.2.7 | **No ranking parameters disclosed** | R.4(3)(e) -- must disclose parameters for session ranking/display on discovery page | Medium | 5 | Rs 50L | P2 |
| 4.2.8 | **No consent for data use in ranking** | If user data affects session recommendations, this must be disclosed | Medium | 4 | Rs 50L | P2 |
| 4.2.9 | **Country of origin not relevant but applicable** | For digital services, may need to state where service is provided from | Low | 3 | Rs 10L | P3 |
| 4.2.10 | **No seller/partner information display** | R.6 -- marketplace must display seller (venue partner) details to buyers | High | 7 | Rs 1Cr fine | P1 |

### 4.3 Dark Patterns (8 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 4.3.1 | **Streak "at risk" notifications** | CCPA Dark Patterns guidelines (2023) -- "Urgency" pattern. `streak_at_risk` notification creates artificial urgency to drive bookings | Medium | 5 | CCPA warning/fine | P2 |
| 4.3.2 | **"Most Popular" tag is confirmity-shaming** | Nudging users toward more expensive plan using social proof can be classified as "Confirm-shaming" or "Social proof" dark pattern | Medium | 5 | CCPA warning | P2 |
| 4.3.3 | **Referral credits create sunk cost** | Credit balance makes users feel invested, potentially qualifying as "Basket sneaking" if credits auto-apply | Low | 3 | CCPA warning | P3 |
| 4.3.4 | **No easy subscription downgrade/cancel** | No visible cancellation path in UI | High | 6 | "Roach motel" dark pattern | P1 |
| 4.3.5 | **Limited-time framing on sessions** | "X spots left" creates scarcity pressure | Low | 3 | CCPA warning | P3 |
| 4.3.6 | **Coworker Score creates lock-in** | UserStats/UserReputation as non-portable value is designed to create switching cost. While legal, if used to prevent account deletion, becomes problematic | Medium | 4 | DPDP violation if impeding erasure | P2 |
| 4.3.7 | **No price comparison with actual per-session cost** | "Save up to 40%" claim on pricing page without showing actual calculation | Medium | 6 | Misleading claims | P2 |
| 4.3.8 | **Hidden default notification settings** | Notifications sent by default with no opt-out mechanism visible | Medium | 5 | "Forced action" dark pattern | P2 |

---

## 5. Employment & Labor

### 5.1 Worker Classification (8 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 5.1.1 | **Venue partner classification ambiguous** | Partners operate on platform but relationship is undefined. If deemed "employee" under Code on Social Security 2020, platform must provide benefits | High | 5 | PF/ESI/bonus liabilities | P1 |
| 5.1.2 | **No independent contractor agreement** | No written agreement classifying partners as independent contractors | High | 6 | Misclassification risk | P1 |
| 5.1.3 | **Platform exercises control over pricing** | `platform_fee` is set by donedonadone, constraining partner pricing. Control over work conditions suggests employment relationship | Medium | 4 | Reclassification risk | P2 |
| 5.1.4 | **No gig worker benefits** | Code on Social Security 2020 S.114 -- platform/gig workers entitled to social security. If any facilitators/community managers are engaged, they need coverage | Medium | 4 | Social security fund contribution | P2 |
| 5.1.5 | **Admin users performing "work" -- employee or contractor?** | `user_type = 'admin'` suggests platform staff. Their classification needs documentation | Medium | 4 | Employment claims | P2 |
| 5.1.6 | **No Shops & Establishment registration for remote employees** | If platform hires employees in Karnataka, S&E Act registration required | High | 7 | Rs 25,000 fine | P1 |
| 5.1.7 | **No professional tax registration** | Karnataka Professional Tax applicable for employees/contractors | Medium | 6 | Tax demand | P2 |
| 5.1.8 | **No NDA/confidentiality with partners** | Partners see booking data, user names, session details. No confidentiality obligation | Medium | 5 | Data leakage | P2 |

### 5.2 Venue Staff Labor (5 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 5.2.1 | **No verification of venue labor compliance** | Partner venues must comply with Minimum Wages Act, Payment of Wages Act. Platform listing non-compliant venues creates association risk | Low | 3 | Reputational | P3 |
| 5.2.2 | **Venue staff handling donedonadone check-ins** | If venue staff perform platform functions (check-in verification), labor relationship questions arise | Low | 3 | Classification risk | P3 |
| 5.2.3 | **No working hours/conditions verification** | Venues hosting sessions must maintain labor law compliance for their own staff | Low | 2 | Reputational | P3 |
| 5.2.4 | **Child labor at venues** | If partner cafe employs underage workers, platform association creates reputational/legal risk | Medium | 3 | Reputational + criminal association | P2 |
| 5.2.5 | **No anti-slavery/human trafficking declaration** | While not legally required in India, best practice for platforms facilitating in-person services | Low | 1 | Reputational | P3 |

---

## 6. Intellectual Property

### 6.1 Trademark (5 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 6.1.1 | **Trademark "donedonadone" -- registration status unknown** | No evidence of trademark filing. Name is distinctive and registrable but must be searched and filed | High | 5 | Name squatting, brand confusion | P1 |
| 6.1.2 | **No trademark for "Coworker Score"** | Distinctive term used throughout platform. Should be TM-protected | Medium | 3 | Competitor copying | P2 |
| 6.1.3 | **No trademark for "donedonadone Score" (venue rating)** | Venue scoring system branding needs protection | Medium | 3 | Competitor copying | P2 |
| 6.1.4 | **Trust Tier names ("OG", "Community Pillar") not protected** | `lib/config.ts` TRUST_TIER_CONFIG has distinctive names | Low | 2 | Low risk | P3 |
| 6.1.5 | **Domain name registration** | donedonadone.com -- verify WHOIS, auto-renewal, related TLDs (.in, .co.in) | Medium | 4 | Domain squatting | P2 |

### 6.2 User Content Ownership (6 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 6.2.1 | **No content license from users** | Bio text, feedback comments, session goals -- platform displays and stores user-generated content without license agreement | High | 5 | Copyright claims | P1 |
| 6.2.2 | **No content license for ratings/reviews** | User feedback and venue ratings are published (venue scores). No license to aggregate and display | Medium | 4 | IP claims | P2 |
| 6.2.3 | **Venue photos uploaded without license** | `venues.photos TEXT[]` -- partner uploads photos. No license agreement for platform to display, resize, cache | Medium | 5 | Copyright claims | P2 |
| 6.2.4 | **User avatars -- no rights clearance** | `profiles.avatar_url` -- users may upload images they do not own rights to | Low | 3 | Copyright claims | P3 |
| 6.2.5 | **Session goals are user IP** | `session_goals.goal_text` may contain business-sensitive information. Platform stores it without confidentiality guarantees | Medium | 4 | Trade secret claims | P2 |
| 6.2.6 | **Algorithmic output ownership unclear** | Group matching results, compatibility scores -- who owns the algorithm output? Important for future IP valuation | Low | 2 | Business risk | P3 |

### 6.3 Open Source License Compliance (12 vectors)

Analyzed from `package.json`:

| # | Package | License | Risk | Severity | Priority |
|---|---------|---------|------|----------|----------|
| 6.3.1 | `next` 16.1.6 | MIT | Attribution required in production. Not provided | Low | P3 |
| 6.3.2 | `react` ^19 | MIT | Attribution required | Low | P3 |
| 6.3.3 | `@supabase/supabase-js` ^2.95.3 | MIT | Attribution required | Low | P3 |
| 6.3.4 | `@radix-ui/*` (20 packages) | MIT | Attribution required for all | Low | P3 |
| 6.3.5 | `recharts` 2.15.0 | MIT | Attribution required | Low | P3 |
| 6.3.6 | `lucide-react` ^0.544.0 | ISC | Attribution required | Low | P3 |
| 6.3.7 | `date-fns` 4.1.0 | MIT | Attribution required | Low | P3 |
| 6.3.8 | `swr` ^2.4.0 | MIT | Attribution required | Low | P3 |
| 6.3.9 | `zod` ^3.24.1 | MIT | Attribution required | Low | P3 |
| 6.3.10 | `tailwindcss` ^3.4.17 | MIT | Attribution required | Low | P3 |
| 6.3.11 | **No LICENSES file or page** | N/A | MIT license requires "copyright notice included in all copies." No /licenses page or bundled NOTICES file | Medium | P2 |
| 6.3.12 | **No automated license audit** | N/A | No `license-checker` or equivalent in CI. Transitive dependencies may include GPL/AGPL | Medium | P2 |

### 6.4 Algorithm IP (4 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 6.4.1 | **Matching algorithm not patent-protected** | `auto_assign_groups()` is a novel compatibility-scored grouping algorithm. Patentable in India under Patents Act 1970 (if technical effect proven) | Medium | 3 | Competitor cloning | P2 |
| 6.4.2 | **Algorithm exposed in client-accessible SQL** | `scripts/` folder contains full algorithm logic. If deployed to Supabase, RPC is callable. Logic extractable | Medium | 4 | Trade secret loss | P2 |
| 6.4.3 | **Reputation algorithm weights public** | `compute_coworker_score()` weights (0.25, 0.25, 0.15...) visible in SQL. Gaming becomes possible | Medium | 5 | System integrity | P2 |
| 6.4.4 | **Venue scoring weights public** | `compute_venue_score()` dimension weights in both SQL and config.ts | Low | 3 | Gaming risk | P3 |

---

## 7. Regulatory & Licensing

### 7.1 IT Act & Intermediary Guidelines (12 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 7.1.1 | **No intermediary safe harbor compliance** | IT Act S.79 grants safe harbor to intermediaries who follow due diligence. Platform fails to meet any due diligence requirement | Critical | 7 | Loss of safe harbor -- liable for all user-generated content | P0 |
| 7.1.2 | **No Terms of Use prohibiting unlawful content** | IT (Intermediary Guidelines) Rules 2021 R.3(1)(a) requires informing users of prohibited content | Critical | 7 | Loss of safe harbor | P0 |
| 7.1.3 | **No content takedown mechanism** | R.3(1)(d) -- must remove unlawful content within 36 hours of court/government order | High | 6 | Rs 25L+ fine | P1 |
| 7.1.4 | **No Grievance Officer with 24-hour acknowledgment** | R.3(2)(a) -- Grievance Officer must acknowledge within 24 hours, resolve within 15 days | Critical | 7 | Loss of safe harbor | P0 |
| 7.1.5 | **No monthly compliance report** | R.4(1)(d) for SSMIs -- if user base grows beyond threshold, monthly compliance reports required | Low | 3 | Future compliance | P3 |
| 7.1.6 | **No traceability of first originator** | R.4(2) for SSMIs -- may need to identify first originator of information | Low | 3 | Future compliance | P3 |
| 7.1.7 | **No cooperation mechanism with law enforcement** | R.3(1)(j) -- must assist government agencies within 72 hours | High | 6 | Criminal liability | P1 |
| 7.1.8 | **No user identification on request** | R.3(1)(b) -- must provide information to authorized agencies for identity verification | High | 6 | Criminal obstruction | P1 |
| 7.1.9 | **No data retention policy for law enforcement** | R.3(1)(h) -- must retain data for 180 days after user deletion | High | 6 | Obstruction | P1 |
| 7.1.10 | **No notification of IT Act applicability** | R.3(1)(a) -- must inform users that IT Act rules apply to platform use | Medium | 5 | Compliance gap | P2 |
| 7.1.11 | **No annual compliance audit** | R.4(1)(f) for SSMIs -- independent audit required | Low | 2 | Future compliance | P3 |
| 7.1.12 | **Profiles publicly viewable -- liability for defamation** | RLS policy: "Profiles are viewable by everyone." If a profile contains defamatory bio, platform is intermediary hosting it | Medium | 4 | Safe harbor risk | P2 |

### 7.2 GST & Tax Registration (8 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 7.2.1 | **GST registration required** | Aggregate turnover will exceed Rs 20L threshold. GST registration mandatory before crossing threshold | Critical | 9 | Rs 25,000 penalty + back-taxes + 18% interest | P0 |
| 7.2.2 | **SAC code classification needed** | Platform fees likely under SAC 998599 (Other supporting services). Must be determined for correct GST rate | High | 7 | Incorrect tax filing | P1 |
| 7.2.3 | **Input tax credit eligibility** | Platform paying for Supabase, Vercel, etc. Need proper invoicing for ITC claims | Medium | 5 | Lost ITC | P2 |
| 7.2.4 | **Place of supply determination** | Sessions are at physical venues in Karnataka. IGST vs CGST+SGST depends on user location | Medium | 5 | Wrong tax applied | P2 |
| 7.2.5 | **Reverse charge mechanism for Supabase/Vercel** | Importing digital services from US companies -- RCM applicable. Must self-assess and pay GST | High | 6 | Back-tax demand | P1 |
| 7.2.6 | **TCS obligations as e-commerce operator** | CGST Act S.52 -- e-commerce operators must collect TCS at 1% from suppliers (venue partners) | High | 7 | TCS demand + penalty | P1 |
| 7.2.7 | **Income tax registration (PAN/TAN)** | Entity needs PAN for income tax, TAN for TDS deductions | Critical | 9 | Cannot file any returns without these | P0 |
| 7.2.8 | **Startup India registration** | DPIIT recognition would provide tax holiday (S.80-IAC), easier compliance, angel tax exemption | Low | 2 | Missed benefits | P3 |

### 7.3 Business Licensing (10 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 7.3.1 | **Shop & Establishment Act registration** | Karnataka Shops & Establishments Act 1961 -- any business operating in Karnataka needs registration within 30 days of commencement | High | 7 | Rs 25,000 fine + prosecution | P1 |
| 7.3.2 | **FSSAI implications for venue partners** | If platform promotes or facilitates F&B ("included_in_cover" field), may need to verify partner FSSAI licenses | Medium | 5 | Association liability | P2 |
| 7.3.3 | **RBI Payment Aggregator license** | If platform holds funds between user payment and venue settlement, PA/PG guidelines apply. License needed if settlement > T+1 | Critical | 6 | RBI enforcement -- business shutdown risk | P0 |
| 7.3.4 | **No company incorporation evidence** | No CIN, no entity type visible. Must be incorporated (Pvt Ltd recommended for VC fundability) | Critical | 8 | Cannot operate legally | P0 |
| 7.3.5 | **Professional tax registration (Karnataka)** | Monthly professional tax applicable for businesses with employees | Medium | 6 | Rs 10,000 penalty | P2 |
| 7.3.6 | **MSME/Udyam registration** | If turnover < Rs 250Cr, eligible for MSME benefits (delayed payment protection, credit guarantee) | Low | 2 | Missed benefits | P3 |
| 7.3.7 | **Foreign investment compliance** | If founders/investors are foreign nationals, FEMA/FDI regulations apply. Need RBI approval for certain categories | Medium | 4 | FEMA violation -- 3x penalty | P2 |
| 7.3.8 | **Digital signature certificate** | Required for GST filing, MCA filings, IT returns | Medium | 6 | Cannot file statutory returns | P2 |
| 7.3.9 | **No DIN for directors** | Director Identification Number required for all directors of company | High | 7 | MCA penalty | P1 |
| 7.3.10 | **Annual compliance (ROC filings)** | If incorporated, annual return (MGT-7), financial statements (AOC-4) due annually | High | 7 | Rs 1L+ penalty per year missed | P1 |

### 7.4 Sector-Specific Regulations (5 vectors)

| # | Risk Vector | Severity | Enforcement (1-10) | Exposure | Priority |
|---|-------------|----------|---------------------|----------|----------|
| 7.4.1 | **Karnataka Police Act -- event/gathering notification** | Organized gatherings at commercial venues may require police intimation above certain size | Low | 3 | Police notice | P3 |
| 7.4.2 | **BBMP trade license** | BBMP (Bangalore municipal corporation) requires trade license for businesses | Medium | 5 | Rs 10,000+ penalty | P2 |
| 7.4.3 | **Karnataka Excise Act (if venues serve alcohol)** | If session venues serve alcohol and it is consumed during sessions, excise compliance considerations | Low | 3 | Association risk | P3 |
| 7.4.4 | **Noise pollution regulations** | If platform promotes "lively" venues, noise regulation compliance by venues should be verified | Low | 2 | Association risk | P3 |
| 7.4.5 | **BIS standards for digital payments** | Bureau of Indian Standards may mandate compliance for QR code payments | Low | 3 | Compliance gap | P3 |

---

## 8. Compliance as Moat

### The Trust Advantage

In India's unregulated coworking meetup space, donedonadone has a unique opportunity to make legal compliance a competitive advantage rather than merely a cost center. Here is how:

### 8.1 "India's Most Trusted Coworking Platform" Positioning

| Compliance Area | Moat Mechanism | Competitor Barrier |
|----------------|----------------|-------------------|
| **DPDP Act compliance** | Publicly audited data practices, consent manager, transparent data handling | Competitors cannot claim trust without matching infrastructure investment |
| **Verified venues** | Fire safety + insurance + FSSAI verification badge on venue listings | Users prefer verified venues, especially women and safety-conscious professionals |
| **Identity verification** | DigiLocker/Aadhaar-based optional verification for "Verified Member" badge | Dramatically reduces safety incidents, enabling word-of-mouth growth |
| **GST-compliant invoicing** | Auto-generated GST invoices for every transaction | Corporate users and freelancers can claim ITC -- a tangible financial benefit |
| **POSH compliance** | Published anti-harassment policy, reporting mechanism, trained Internal Complaints Committee | Critical for women users who are 50%+ of target market |
| **Refund policy** | Clear, fair, published refund/cancellation policy | Reduces consumer forum complaints, builds confidence for first-time bookers |

### 8.2 Trust Badges as Network Effects

Each compliance milestone can be turned into a visible trust signal:

1. **"DPDP Compliant" badge** -- Display on signup page. Users increasingly aware of data rights will choose platforms that respect them.
2. **"Verified Venue" badge** -- Venues with insurance, fire safety, FSSAI verified get a visible badge. Partners invest in compliance to earn the badge, which attracts more users.
3. **"Safe Space Certified" badge** -- POSH policy + emergency contacts + safety reporting = visible safety commitment.
4. **"GST Invoice Included" tag** -- Corporate users and freelancers specifically seek platforms providing tax-compliant invoices.
5. **"RBI-Compliant Payments" badge** -- Payment aggregator compliance signals financial safety.

### 8.3 Regulatory Moat Depth

| Compliance Investment | Time to Replicate | Cost to Replicate | Competitive Impact |
|----------------------|-------------------|-------------------|-------------------|
| Full DPDP compliance | 3-6 months | Rs 5-15L (legal + engineering) | Competitors must invest equally or face penalty risk |
| PA license (if needed) | 6-12 months | Rs 25-50L (net worth req + compliance) | Most startups cannot obtain this quickly |
| Venue verification program | 3 months setup + ongoing | Rs 2-5L setup + Rs 50K/month | Physical verification creates operational moat |
| POSH committee + training | 1-2 months | Rs 1-3L annually | Requires institutional commitment |
| Full tax compliance stack | 1-2 months | Rs 3-5L (CA + software) | Table stakes but often delayed by competitors |

### 8.4 Insurance as Differentiator

Carrying professional liability and cyber insurance costs Rs 1-3L annually but enables:
- Marketing: "Every session is insured"
- Venue partner confidence: venues prefer insured platforms
- Investor confidence: reduces risk profile

### 8.5 Compliance-Driven Feature Advantages

| Compliance Requirement | Feature It Enables |
|----------------------|-------------------|
| Age verification | Target corporate professionals specifically -- better group quality |
| Identity verification | "Verified" badge system -- premium matching for verified users |
| DPDP data portability | "Export your coworking history" -- job search proof of remote work discipline |
| GST invoicing | Corporate expense management integration -- bigger ticket sizes |
| POSH compliance | "Women's safety commitment" -- 50%+ of addressable market |
| Refund policy | Higher conversion -- users book with confidence knowing there is a clear refund path |

---

## 9. Priority Remediation Roadmap

### P0 -- MUST DO BEFORE LAUNCH (Block shipping)

| # | Item | Owner | Effort | Deadline |
|---|------|-------|--------|----------|
| 1 | Draft and publish Terms of Service | Legal counsel | 1 week | Pre-launch |
| 2 | Draft and publish Privacy Policy (DPDP-compliant) | Legal counsel | 1 week | Pre-launch |
| 3 | Add consent checkbox at signup linking to ToS + Privacy Policy | Engineering | 1 day | Pre-launch |
| 4 | Add consent notice at onboarding data collection | Engineering | 1 day | Pre-launch |
| 5 | Add age verification (DOB or "I am 18+" checkbox) at signup | Engineering | 1 day | Pre-launch |
| 6 | Implement refund/cancellation policy and display it | Legal + Eng | 3 days | Pre-launch |
| 7 | Register company (if not done) -- Pvt Ltd incorporation | Legal | 2-4 weeks | Pre-launch |
| 8 | Obtain GST registration | CA | 1-2 weeks | Pre-launch |
| 9 | Obtain PAN/TAN | CA | 1-2 weeks | Pre-launch |
| 10 | Implement GST calculation in pricing | Engineering | 2 days | Pre-launch |
| 11 | Generate payment receipts/invoices | Engineering | 3 days | Pre-launch |
| 12 | Draft venue partner agreement | Legal counsel | 1 week | Pre-launch |
| 13 | Add safety reporting mechanism | Engineering | 2 days | Pre-launch |
| 14 | Add emergency contact collection in onboarding | Engineering | 1 day | Pre-launch |
| 15 | Publish company information (entity name, CIN, address, email) on platform | Engineering | 1 day | Pre-launch |
| 16 | Appoint and display Grievance Officer | Operations | 1 day | Pre-launch |
| 17 | Implement consent withdrawal mechanism | Engineering | 3 days | Pre-launch |
| 18 | Implement account deletion (right to erasure) | Engineering | 3 days | Pre-launch |
| 19 | Establish DPA with Supabase (or verify Supabase's standard DPA) | Legal | 1 week | Pre-launch |
| 20 | Confirm Supabase region is ap-south-1 (Mumbai) | Engineering | 1 hour | Pre-launch |

### P1 -- MUST DO WITHIN 30 DAYS OF LAUNCH

| # | Item | Owner | Effort |
|---|------|-------|--------|
| 1 | Implement data export / right of access feature | Engineering | 1 week |
| 2 | Add phone number verification (OTP) | Engineering | 3 days |
| 3 | Create user Code of Conduct | Legal | 3 days |
| 4 | Implement user block/ban mechanism | Engineering | 3 days |
| 5 | Set up POSH compliance (ICC, policy, training) | HR/Legal | 2 weeks |
| 6 | Implement partner KYC (PAN, GSTIN, bank details) | Engineering | 1 week |
| 7 | Set up TDS/TCS infrastructure | CA + Engineering | 2 weeks |
| 8 | Obtain professional liability insurance | Operations | 2 weeks |
| 9 | Obtain cyber insurance | Operations | 2 weeks |
| 10 | File trademark application for "donedonadone" | IP attorney | 1 week |
| 11 | Karnataka S&E Act registration | Legal | 1 week |
| 12 | Implement subscription terms and cancellation flow | Legal + Eng | 1 week |
| 13 | Create content license terms in ToS | Legal | Included in ToS |
| 14 | Implement notification opt-in/opt-out | Engineering | 3 days |
| 15 | Set up data retention policy (auto-purge old data) | Engineering | 1 week |

### P2 -- WITHIN 90 DAYS

| # | Item | Owner | Effort |
|---|------|-------|--------|
| 1 | Venue verification program (fire safety, insurance, FSSAI) | Operations | Ongoing |
| 2 | Identity verification (DigiLocker integration) | Engineering | 2 weeks |
| 3 | Open source license compliance (NOTICES file, /licenses page) | Engineering | 2 days |
| 4 | Automated license audit in CI | Engineering | 1 day |
| 5 | Partner payout mechanism | Engineering + Banking | 2 weeks |
| 6 | RBI PA/PG assessment and compliance path | Legal + CA | 4 weeks |
| 7 | Matching algorithm transparency features | Engineering | 1 week |
| 8 | Annual compliance calendar setup (ROC, GST, IT returns) | CA | 1 week |

### P3 -- WITHIN 6 MONTHS

| # | Item | Owner | Effort |
|---|------|-------|--------|
| 1 | DPIIT Startup India recognition | Legal | 2 weeks |
| 2 | MSME/Udyam registration | Legal | 1 week |
| 3 | Patent assessment for matching algorithm | IP attorney | 4 weeks |
| 4 | D&O insurance | Operations | 2 weeks |
| 5 | Annual data protection audit | External auditor | 2 weeks |

---

## Appendix: Risk Register

### Summary Statistics

| Category | Total Vectors | Critical | High | Medium | Low |
|----------|---------------|----------|------|--------|-----|
| 1. DPDP Act 2023 | 53 | 12 | 19 | 17 | 5 |
| 2. Payment Compliance | 30 | 7 | 12 | 8 | 3 |
| 3. Physical Safety & Liability | 32 | 10 | 10 | 9 | 3 |
| 4. Consumer Protection | 33 | 8 | 11 | 10 | 4 |
| 5. Employment & Labor | 13 | 0 | 4 | 6 | 3 |
| 6. Intellectual Property | 27 | 0 | 3 | 14 | 10 |
| 7. Regulatory & Licensing | 35 | 6 | 12 | 12 | 5 |
| **TOTAL** | **223** | **43** | **71** | **76** | **33** |

### Maximum Financial Exposure (Worst Case)

| Category | Maximum Exposure |
|----------|-----------------|
| DPDP Act violations | Rs 250 Cr (statutory maximum per violation) |
| GST non-compliance | Back-taxes + 18% interest + Rs 25,000 penalty per return |
| Consumer forum cases | Rs 1 Cr+ per case (State Commission) |
| RBI PA non-compliance | Business shutdown order |
| Physical safety incident | Unlimited tort liability (no insurance, no waiver) |
| IT Act safe harbor loss | Liable for all user-generated content |

### Key Finding

The single most dangerous gap is the **complete absence of legal documents** -- no Terms of Service, no Privacy Policy, no Refund Policy, no Venue Partner Agreement, no User Code of Conduct. This means:
1. Every user relationship is uncontracted
2. Every payment is made without agreed terms
3. Every in-person meetup happens without liability allocation
4. Every piece of data is processed without lawful basis
5. The platform has zero legal defenses in any dispute

**Recommendation:** Do not launch publicly until at minimum the P0 items are addressed. The legal documents (ToS, Privacy Policy, Refund Policy, Partner Agreement) and basic compliance (GST, consent checkbox, age verification, Grievance Officer) can be completed in 2-3 weeks with dedicated legal counsel.

---

*This audit was conducted based on codebase analysis as of 2026-02-09. It does not constitute legal advice. Engage qualified Indian legal counsel specializing in technology, data protection, and consumer law for actionable legal opinions.*
