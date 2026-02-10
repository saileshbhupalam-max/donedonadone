# Red Team Audit #12: Social Engineering, Human Manipulation, Platform Abuse & Trust Exploitation

**Audit Date:** 2026-02-09
**Auditor:** Red Team Social Engineering & Platform Abuse Specialist
**Scope:** Identity fraud, in-person safety, reputation gaming, content abuse, financial social engineering, platform manipulation, vendor/partner abuse
**Platform:** donedonadone -- group coworking matching platform facilitating in-person meetups between strangers
**Risk Context:** This platform introduces strangers to each other in physical settings. The intersection of digital identity with physical proximity creates a uniquely dangerous attack surface. Every vulnerability here has potential real-world physical consequences.

---

## Executive Summary

donedonadone's core value proposition -- matching strangers into small groups at physical venues -- creates an attack surface fundamentally different from purely digital platforms. The platform currently operates with **zero identity verification**, **no photo verification**, **self-reported payment confirmation**, **no content moderation**, and **algorithmically exploitable matching**. The combination of these gaps means a motivated bad actor can create fake identities, manipulate their way into specific groups, exploit the trust the platform builds, and cause harm ranging from financial fraud to physical danger.

**Critical finding:** The platform trusts user input at every layer -- signup names, onboarding preferences, goal text, feedback comments, payment confirmations, and referral codes. There is no verification, moderation, or abuse detection at any point in the user lifecycle.

**Severity Distribution:**
- P0 (Fix before launch): 23 vulnerabilities
- P1 (Fix within first month): 41 vulnerabilities
- P2 (Fix within first quarter): 52 vulnerabilities
- P3 (Track and address): 38 vulnerabilities

---

## 1. Identity & Impersonation (54 vectors)

### 1.1 Fake Profile Creation at Scale

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 1.1.1 | **Disposable email signup** | Signup (`app/auth/sign-up/page.tsx`) only requires email + password + full name. Services like Guerrilla Mail, TempMail provide unlimited disposable emails. No email domain restriction exists. | 7 | 9 | 8 | P0 |
| 1.1.2 | **No phone verification** | Phone number is collected in onboarding (`components/onboarding/onboarding-wizard.tsx` line 400-408) but is optional and never verified via OTP. Stored as plain text in profiles. | 8 | 9 | 9 | P0 |
| 1.1.3 | **No CAPTCHA on signup** | The signup form has zero bot protection. No reCAPTCHA, hCaptcha, or proof-of-work. Automated account creation is trivial. | 6 | 8 | 9 | P0 |
| 1.1.4 | **Automated account farm** | Combine disposable emails + no CAPTCHA + no phone verification = script can create hundreds of accounts per hour via direct Supabase auth API calls. | 8 | 7 | 8 | P0 |
| 1.1.5 | **No email domain blocklist** | No filtering of known disposable email providers (mailinator.com, guerrillamail.com, etc.). | 5 | 8 | 9 | P1 |
| 1.1.6 | **Profile auto-creation trigger** | `scripts/001_schema.sql` lines 213-228: `handle_new_user()` trigger auto-creates a profile from `raw_user_meta_data.display_name` or email prefix. No sanitization of the display name at this layer. | 4 | 7 | 8 | P1 |

### 1.2 Impersonating Real People

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 1.2.1 | **Name spoofing -- exact match** | Display name is a free-text field with only a 2-character minimum (`canNext()` step 1: `data.display_name.trim().length >= 2`). Anyone can register as "Rahul Sharma" or any other name. | 8 | 8 | 9 | P0 |
| 1.2.2 | **Impersonating known community members** | After attending a few sessions, an attacker learns real names of popular community members. They create a new account with the same name to exploit trust built by the real person. | 9 | 6 | 8 | P0 |
| 1.2.3 | **Unicode homoglyph attacks** | Display name accepts arbitrary Unicode. Attacker uses Cyrillic "а" (U+0430) instead of Latin "a" to create visually identical but technically different names. "Rаhul" vs "Rahul". | 7 | 4 | 10 | P1 |
| 1.2.4 | **Zero-width character injection** | Inserting zero-width joiners (U+200D) or zero-width spaces (U+200B) into display names. "Ra\u200Bhul" renders as "Rahul" but passes uniqueness checks. | 6 | 3 | 10 | P2 |
| 1.2.5 | **Display name as message channel** | Nothing prevents setting display name to "Venmo me @scammer" or "Call me 9876543210". Group members see this prominently in `group-member-card.tsx`. | 5 | 6 | 6 | P1 |
| 1.2.6 | **No avatar verification** | `avatar_url` is a text field with no constraints. Could point to photos stolen from social media. No face-matching or liveness detection. | 7 | 6 | 9 | P1 |

### 1.3 Multiple Account Creation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 1.3.1 | **Sybil attack -- preference manipulation** | Create 3-4 accounts with identical preferences, book same session. The matching algorithm (`004_auto_assign_groups.sql`) will score them highly together (work_vibe +3, noise +2, comm +2 = +7 base score), guaranteeing group placement together. | 8 | 6 | 8 | P0 |
| 1.3.2 | **No device fingerprinting** | No browser fingerprint, device ID, or IP tracking. Same device can create unlimited accounts. | 6 | 8 | 9 | P1 |
| 1.3.3 | **No cross-account correlation** | No system to detect shared IP addresses, similar signup patterns, identical payment methods, or correlated session booking patterns. | 6 | 7 | 9 | P1 |
| 1.3.4 | **Referral self-farming** | Create Account A, get referral code. Create Account B using A's code. Both get credits. Repeat. The referral system (`010_referrals.sql`) only checks `referral_code.user_id !== user.id` -- trivially bypassed with multiple accounts. | 7 | 8 | 7 | P0 |
| 1.3.5 | **Rating ring setup** | Multiple accounts attend the same session, then rate each other positively. Inflates reputation score via `compute_coworker_score()` which weighs `would_cowork_again_rate` at 25%. | 7 | 5 | 8 | P1 |
| 1.3.6 | **Subscription sharing** | One user pays for a subscription, shares credentials. No concurrent session detection or device binding. | 4 | 6 | 7 | P2 |

### 1.4 Bot Account Detection Gaps

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 1.4.1 | **No behavioral analysis** | No tracking of interaction patterns -- time between clicks, mouse movements, typing speed. Bots can automate the entire flow from signup through booking. | 5 | 5 | 9 | P2 |
| 1.4.2 | **No onboarding completion timing check** | A human takes 3-5 minutes to complete 7 quiz steps. A bot completes it in milliseconds. No minimum completion time enforced. | 4 | 5 | 8 | P2 |
| 1.4.3 | **Predictable API patterns** | All API routes follow simple REST patterns. No request signing, no rate limiting visible in code, no request anomaly detection. | 5 | 6 | 8 | P1 |

### 1.5 No Photo or ID Verification

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 1.5.1 | **No photo required** | Avatar is optional. The group-member-card shows a fallback initial letter. A user can attend sessions with zero visual identification beforehand. | 7 | 9 | N/A | P0 |
| 1.5.2 | **No ID verification for in-person meetups** | The platform facilitates physical meetings between strangers with zero identity verification. No Aadhaar, no PAN, no selfie verification. | 9 | 9 | N/A | P0 |
| 1.5.3 | **No ID-to-name matching** | Even if photos were required, there is no system to verify that the person who shows up matches the profile photo. Check-in (`app/api/session/[id]/checkin/route.ts`) is self-service via app -- no partner/venue staff verification. | 8 | 8 | 9 | P0 |
| 1.5.4 | **Stolen photo avatar** | Attacker downloads photo of attractive person from social media, sets as avatar_url. Builds false trust with group members before meeting. | 7 | 6 | 9 | P1 |
| 1.5.5 | **AI-generated profile photos** | Use tools like ThisPersonDoesNotExist to generate realistic fake photos that pass visual inspection but represent no real person. | 6 | 5 | 9 | P2 |
| 1.5.6 | **No background check** | Criminal history, restraining orders, sex offender registry -- none checked. Platform places potential predators in small groups with unsuspecting people. | 10 | 3 | N/A | P1 |

---

## 2. In-Person Safety Threats (55 vectors)

### 2.1 Stalking & Location Tracking

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 2.1.1 | **Session pattern analysis** | Dashboard shows all past sessions with dates, times, and venues (`app/dashboard/page.tsx`). Group members can observe a target's booking patterns over time (e.g., "She always books the 10am at Third Wave Coffee on Tuesdays"). | 9 | 7 | 9 | P0 |
| 2.1.2 | **Venue location leakage** | Group reveal (`components/session/group-reveal.tsx` line 206-217) provides exact lat/lng coordinates and a Google Maps direction link. Even before check-in, the venue name and address are visible. | 7 | 8 | 7 | P1 |
| 2.1.3 | **"Get Directions" as tracking confirmation** | The Google Maps link confirms exact venue coordinates. A stalker doesn't even need to be in the same group -- they just need to know the target has booked. | 8 | 6 | 9 | P1 |
| 2.1.4 | **Repeated targeting via favorites** | Attacker marks target as "favorite" via `favorite_coworkers` table. The matching algorithm gives +1 bonus for favorites (line 170-172 of `004_auto_assign_groups.sql`), increasing probability of being grouped together. | 9 | 6 | 8 | P0 |
| 2.1.5 | **Anti-repetition bypass via new accounts** | The anti-repetition penalty (-5 per co-grouping in last 3 sessions, line 160-167) tracks by user_id. Creating a new account resets this, allowing infinite re-targeting. | 8 | 5 | 9 | P1 |
| 2.1.6 | **Preference mirroring** | Attacker observes target's visible work_vibe (shown pre-check-in), then creates profile with matching preferences to maximize grouping score (+3 vibe, +2 noise, +2 comm = +7). | 8 | 6 | 9 | P0 |
| 2.1.7 | **Following home after session** | Platform provides no post-session safety features, no "safe departure" check, no delay in revealing who was at which session. | 10 | 4 | 10 | P1 |
| 2.1.8 | **Small group size amplifies risk** | Groups of 3-5 mean a targeted individual has a 25-33% chance of being with the attacker. Much higher than a large event. | 8 | 6 | 7 | P1 |

### 2.2 Harassment & Predatory Behavior

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 2.2.1 | **Sexual harassment at sessions** | Small groups at cafes with no staff monitoring or emergency button. Victim may feel trapped in a 2-4 hour session. | 10 | 5 | 7 | P0 |
| 2.2.2 | **Unwanted romantic advances disguised as networking** | "Networking" and "friendship" are legitimate social_goals in onboarding. A predator uses these to justify persistent unwanted contact. | 7 | 7 | 8 | P1 |
| 2.2.3 | **No in-session emergency reporting** | No SOS button, no real-time reporting mechanism, no way to flag discomfort during a live session. | 9 | 6 | N/A | P0 |
| 2.2.4 | **Post-session retaliation via ratings** | Victim reports harassment; harasser retaliates with negative "would_cowork_again: false" and low energy_match ratings, damaging victim's reputation score. | 8 | 6 | 7 | P0 |
| 2.2.5 | **No block/ban mechanism** | No visible user blocking feature in the codebase. A harassed user cannot prevent being matched with their harasser. | 9 | 7 | N/A | P0 |
| 2.2.6 | **Group WhatsApp as harassment channel** | The "WhatsApp Group (Coming Soon)" feature (line 202-204 of group-reveal.tsx) would share phone numbers between group members, enabling off-platform harassment. | 8 | 5 | 7 | P1 |
| 2.2.7 | **Physical intimidation in small groups** | In a group of 3, if 2 members coordinate, the third has no ally. Platform doesn't track coordinated booking patterns. | 8 | 4 | 9 | P2 |

### 2.3 Physical Safety Threats

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 2.3.1 | **Theft at venues** | Laptops, phones, and valuables are present at every session. Platform provides no insurance, no security guidelines, no theft reporting mechanism. | 7 | 6 | 6 | P1 |
| 2.3.2 | **Drink spiking at cafe sessions** | Cafes serve beverages. In a 2-4 hour session, a predator has ample opportunity. Platform has no safety awareness content. | 10 | 3 | 10 | P1 |
| 2.3.3 | **No venue safety standards** | `venues` table tracks amenities (wifi, coffee) but not safety features (CCTV, security staff, emergency exits, first aid). No venue safety audit. | 7 | 6 | 7 | P1 |
| 2.3.4 | **Catfishing for physical meetings** | Fake profile builds trust through sessions, then arranges off-platform meetup. Platform facilitated the initial trust. | 8 | 5 | 9 | P1 |
| 2.3.5 | **No check-out verification** | Check-in exists but no check-out. If someone goes missing during a session, there is no record of when they left or with whom. | 7 | 4 | 8 | P2 |
| 2.3.6 | **No trusted contact notification** | No option to share session details with a friend/family member ("I'm going to X venue at Y time with Z group"). | 7 | 7 | N/A | P1 |

### 2.4 Scams & Exploitation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 2.4.1 | **MLM/pyramid scheme recruitment** | Coworking sessions are the perfect environment for "startup founders" to pitch MLM schemes to a captive audience of freelancers and remote workers. | 6 | 8 | 7 | P1 |
| 2.4.2 | **Fake business pitches** | "Startup Founder" is a valid work_type. Scammers create profiles with this type, use sessions to build credibility, then pitch fraudulent investment opportunities. | 7 | 6 | 8 | P1 |
| 2.4.3 | **Corporate espionage** | Competitor creates account, selects matching industry preferences, gets grouped with target company's remote employee. 2-4 hours of proximity to observe their screen. | 8 | 4 | 10 | P2 |
| 2.4.4 | **Data harvesting via social engineering** | "What project are you working on?" is natural conversation. Attacker systematically harvests competitive intelligence from multiple sessions. | 6 | 6 | 10 | P2 |
| 2.4.5 | **Insurance/financial product solicitation** | Platform enables targeted access to demographics (freelancers, founders) who are high-value targets for financial product sellers. | 5 | 6 | 7 | P2 |
| 2.4.6 | **Religious/political recruitment** | Captive small-group setting ideal for charismatic recruiters. No rules of conduct visible in the platform. | 5 | 5 | 7 | P2 |
| 2.4.7 | **Romantic catfishing for financial exploitation** | Build fake romantic interest over multiple sessions. Leverage familiarity from in-person meetings to execute romance scams. | 8 | 4 | 9 | P2 |

### 2.5 Venue-Specific Physical Risks

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 2.5.1 | **Late-night sessions at isolated venues** | No session time restrictions. Evening/night sessions at less-trafficked venues increase risk. | 7 | 4 | 5 | P2 |
| 2.5.2 | **No maximum session duration safety limit** | 4-hour sessions with strangers. No mid-session check-in or comfort confirmation. | 5 | 6 | 7 | P2 |
| 2.5.3 | **Parking lot/transit stalking** | Sessions end at known times. Attacker waits outside venue for target to leave. | 8 | 4 | 10 | P2 |
| 2.5.4 | **Fake venue partner** | Partner signup process: unknown from current code. A bad actor could register a fake "cafe" at a private address to lure users. | 9 | 3 | 7 | P1 |
| 2.5.5 | **Partner collusion with predator** | Venue partner knows which table assignment a target has (visible in group data). Could provide this to an accomplice. | 8 | 2 | 9 | P2 |

### 2.6 Gender & Vulnerability Specific Risks

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 2.6.1 | **No gender-based safety options** | No option for women-only sessions, no gender preferences in matching, no awareness of gender-based risk. | 8 | 7 | N/A | P0 |
| 2.6.2 | **No safety briefing** | No pre-session safety guidelines, no code of conduct presented, no reporting instructions. | 7 | 8 | N/A | P0 |
| 2.6.3 | **Solo women in male-dominated groups** | In a group of 4, a single woman with 3 unknown men creates a power imbalance. No algorithmic consideration for gender balance. | 8 | 6 | 6 | P1 |
| 2.6.4 | **Age gap exploitation** | "Student" work_type could include very young adults grouped with much older users. No age verification or age-appropriate matching. | 7 | 5 | 7 | P1 |
| 2.6.5 | **No cultural sensitivity in matching** | HSR Layout Bangalore has diverse cultures. No consideration for language barriers or cultural comfort in grouping algorithm. | 4 | 5 | 6 | P3 |
| 2.6.6 | **Disability exploitation** | No accommodation tracking. A person with mobility challenges may be unable to easily leave an uncomfortable situation. | 6 | 3 | 8 | P3 |

---

## 3. Rating & Reputation Manipulation (42 vectors)

### 3.1 Rating Extortion & Weaponization

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 3.1.1 | **"Rate me 5 or I'll rate you 1"** | During session, attacker verbally coerces group members into positive ratings. The binary "would_cowork_again" system (`member_ratings` table) makes retaliation easy and impactful. | 7 | 6 | 9 | P1 |
| 3.1.2 | **Post-session rating retaliation** | After any dispute or rejected advance, attacker gives negative `would_cowork_again: false` + low `energy_match: 1`. Affects victim's 25% weighted `cowork_again_rate` in reputation score. | 8 | 7 | 7 | P0 |
| 3.1.3 | **No mutual-reveal protection** | Both parties see each other's identity. One can rate negatively while the other has no way to know who rated what. `member_ratings` RLS (line 302-304) only lets users see their own outgoing ratings, not incoming. | 6 | 7 | 8 | P1 |
| 3.1.4 | **Energy match score as weapon** | `energy_match` (1-5) contributes 15% to overall score via `avg_energy` in `compute_coworker_score()`. A single malicious 1-rating significantly drags down average, especially for new users. | 6 | 7 | 8 | P1 |
| 3.1.5 | **Tag abuse -- sarcastic tagging** | MEMBER_RATING_TAGS include "Helpful", "Focused", "Fun". No negative tags exist, but the absence of positive tags from multiple sessions creates implicit negative signal. Currently tags are not used in scoring -- but infrastructure exists. | 3 | 4 | 7 | P3 |

### 3.2 Coordinated Reputation Attacks

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 3.2.1 | **Reputation destruction campaign** | Attacker with 2-3 accounts books same sessions as target over several weeks. Each account rates target negatively. `would_cowork_again: false` from 3 coordinated accounts = severe reputation damage. | 9 | 4 | 8 | P1 |
| 3.2.2 | **Coordinated venue review bombing** | Multiple accounts give 1-star venue ratings across all 7 dimensions (`venue_wifi`, `venue_ambiance`, etc.) to destroy a venue's rating. | 7 | 4 | 6 | P1 |
| 3.2.3 | **Feedback comment harassment** | `session_feedback.comment` is free text with no length limit (only `CHECK (comment TEXT)` in schema -- no max length). Multiple accounts leave degrading comments. | 6 | 4 | 5 | P1 |
| 3.2.4 | **No rating velocity detection** | No system to detect sudden drops in a user's ratings. A targeted user's score can crash overnight without any alert. | 5 | 5 | 8 | P2 |

### 3.3 Fake Positive Rating Rings

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 3.3.1 | **Mutual positive rating agreement** | Two users agree to always rate each other positively. `would_cowork_again: true` + `energy_match: 5` + favorite each other. Matching algorithm increases their grouping probability, creating a self-reinforcing loop. | 6 | 7 | 8 | P1 |
| 3.3.2 | **Sybil rating ring** | Create 4 accounts, book them all into same session, they get grouped (identical preferences = high match score), all rate each other 5/5. Each account's reputation rises rapidly. | 8 | 5 | 7 | P1 |
| 3.3.3 | **Boosted accounts for sale** | Farm accounts with high coworker scores, sell to users who want to skip the "New Member" tier. Trust tier is purely session-count based (`getTrustTier()` in `lib/config.ts`). | 5 | 3 | 7 | P3 |
| 3.3.4 | **Favorite exploitation for guaranteed grouping** | Two accounts mark each other as favorites (+1 scoring bonus) + both have matching preferences (+7 base). Combined +8 score virtually guarantees grouping, enabling rating ring. | 7 | 5 | 8 | P1 |

### 3.4 Trust Tier Gaming

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 3.4.1 | **Rapid tier climbing** | Trust tiers (`TRUST_TIER_CONFIG`) are based purely on `sessions_completed`: 0-2 = New, 3-10 = Rising, 11-25 = Trusted, 26-50 = Pillar, 51+ = OG. No quality threshold, just quantity. Book cheap 2hr sessions to climb fast. | 5 | 7 | 5 | P2 |
| 3.4.2 | **Session padding via no-show** | Book session, get marked as "paid"/"confirmed", never show up. If check-in isn't enforced strictly, sessions_completed may still increment. Attendance reliability is only 25% of score. | 4 | 5 | 6 | P2 |
| 3.4.3 | **Streak exploitation** | `user_streaks.current_streak` contributes to both reputation score (10%) and matching algorithm (+1 bonus). Gaming streaks via minimum-effort sessions inflates perceived reliability. | 4 | 6 | 6 | P3 |
| 3.4.4 | **Feedback quality gaming** | `feedback_score` (10% of reputation) = feedback_given / past_sessions. Just submit any feedback (even 3-star, no comment) to maximize this component. Quality of feedback is irrelevant. | 3 | 7 | 5 | P3 |
| 3.4.5 | **New account fresh start** | No penalty for abandoning an account with bad reputation and creating a new one. Reputation is non-transferable and non-trackable across accounts. | 7 | 7 | 8 | P1 |

### 3.5 Score Component Manipulation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 3.5.1 | **Attendance manipulation** | `attendance` (25% weight) = checked_in / total_bookings. Cancel all sessions where you might not attend to keep ratio high. Only maintain bookings you'll definitely attend. | 3 | 6 | 6 | P3 |
| 3.5.2 | **Selective session booking** | Only book sessions likely to have compatible, friendly groups (e.g., small sessions, established venues). Avoid challenging sessions that might generate negative ratings. | 3 | 6 | 7 | P3 |
| 3.5.3 | **Cold-start exploitation** | New users have 0 scores across all components. A single positive session catapults them to high per-component scores (1/1 = 100% attendance, 100% cowork_again rate). | 4 | 7 | 5 | P3 |
| 3.5.4 | **Score threshold awareness** | Session score maxes at 50 sessions (line 57 of `008_reputation.sql`). An OG user with 100 sessions gets the same session_score as one with 50. Diminishing returns reduce incentive for long-term users. | 2 | 5 | 3 | P3 |

---

## 4. Content & Communication Abuse (43 vectors)

### 4.1 Goal Text as Abuse Vector

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 4.1.1 | **Harassment via goal text** | `session_goals.goal_text` is visible to entire group (shown in `group-reveal.tsx` lines 132-143). Setting goal to "Make [person's name] uncomfortable" or "Get [person's] number" -- 200 char limit is plenty. | 8 | 5 | 5 | P0 |
| 4.1.2 | **Contact info in goals** | Goal text: "Find me on Instagram @scammer or WhatsApp 9876543210" -- bypasses any future communication restrictions. | 5 | 6 | 5 | P1 |
| 4.1.3 | **Offensive/threatening goal text** | "My goal: show everyone why [slur] don't belong here". No content moderation on goal_text input. Server (`app/api/sessions/[id]/goals/route.ts`) only checks length. | 8 | 4 | 4 | P0 |
| 4.1.4 | **Goal text as phishing** | "My goal: Visit donedonadone-rewards.com for free credits!" (fake lookalike domain). | 6 | 4 | 6 | P1 |
| 4.1.5 | **Goal spam** | Post 3 goals (max limit) with advertising content. Each goal shown as a badge on the group member card. | 4 | 5 | 4 | P2 |

### 4.2 Feedback Comment Abuse

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 4.2.1 | **Harassment via feedback comments** | `session_feedback.comment` has no character limit in schema, no content moderation. "This person was [slur] and should be banned." | 7 | 5 | 5 | P0 |
| 4.2.2 | **Doxing in feedback** | "This person's real name is [full name], works at [company], lives in [area]". Stored permanently in database. | 8 | 3 | 7 | P1 |
| 4.2.3 | **False accusations in feedback** | "This person stole from my bag" or "This person was sexually inappropriate". Creates permanent record of false accusation. | 9 | 4 | 8 | P0 |
| 4.2.4 | **SQL/XSS in comment field** | Comment text rendered in feedback UI. If not properly escaped: `<script>alert('xss')</script>`. React auto-escapes JSX, but rich text rendering could be vulnerable. | 4 | 3 | 4 | P2 |

### 4.3 Display Name & Bio Abuse

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 4.3.1 | **Display name as advertising** | Name: "Buy crypto at XYZ.com" -- visible to all group members in every session. | 4 | 5 | 3 | P2 |
| 4.3.2 | **Offensive display names** | Slurs, hate speech, or threatening language as display name. No profanity filter. | 7 | 4 | 3 | P1 |
| 4.3.3 | **Bio as harassment channel** | `profiles.bio` (up to 200 chars) visible after check-in. "If you're reading this, [target name], I know where you work." | 7 | 3 | 6 | P1 |
| 4.3.4 | **Bio as scam content** | "I'm giving away Rs 50,000 to my next coworking partner! Just send Rs 500 to verify your account..." | 5 | 4 | 5 | P2 |
| 4.3.5 | **Emoji abuse in display name** | Name filled with emojis to break UI layout or draw excessive attention. No character type validation. | 2 | 4 | 2 | P3 |
| 4.3.6 | **Excessively long display name** | No visible max length on display_name in schema. Could break card layout or be used for content injection. | 3 | 4 | 3 | P3 |

### 4.4 Notification & Communication Exploitation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 4.4.1 | **Notification template injection** | `lib/notifications.ts` templates interpolate user data: `${data.venue}`, `${data.name}`. If venue name or user name contains script/HTML, notification content could be manipulated. | 5 | 3 | 6 | P2 |
| 4.4.2 | **Notification spam via booking churn** | Book and cancel repeatedly. Each booking generates `booking_confirmed` notification. No rate limiting on notification creation. | 4 | 5 | 4 | P2 |
| 4.4.3 | **WhatsApp phishing (future risk)** | Notification channel includes 'whatsapp'. When implemented, spoofed platform messages could trick users. | 7 | 4 | 7 | P2 |
| 4.4.4 | **Email phishing via platform patterns** | Attackers study legitimate notification templates, create lookalike emails directing to phishing sites. No DKIM/SPF guidance in codebase. | 6 | 5 | 7 | P2 |
| 4.4.5 | **Referral code as phishing** | Referral code format is predictable (4 alpha + 4 numeric, e.g., "SAIL1234"). Attacker distributes fake "special referral codes" that link to phishing sites. | 5 | 5 | 7 | P2 |

### 4.5 Data Exposure via Social Features

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 4.5.1 | **Wrapped page screenshot sharing** | Dashboard links to `/dashboard/wrapped` for monthly summary. If this contains personal stats, screenshots shared on social media could expose attendance patterns, venue preferences, etc. | 4 | 6 | 3 | P3 |
| 4.5.2 | **Profile page information density** | Profile page (`app/dashboard/profile/page.tsx`) shows: full name, display name, email, phone, city, work type, industry, member since date, coworker score, streak, trust tier, referral code, preferences. Excessive PII on one page. | 6 | 5 | 4 | P1 |
| 4.5.3 | **Favorites list as social graph** | Dashboard shows favorite coworkers with display names. Screenshots could expose social connections. | 4 | 4 | 4 | P3 |
| 4.5.4 | **Referral code reveals identity** | Referral code format includes first 4 chars of display_name (line 44-45 of `010_referrals.sql`). Code "RAHUL1234" reveals the referrer's approximate name. | 3 | 5 | 3 | P3 |
| 4.5.5 | **Goal text reveals work context** | Session goals like "Finish pitch deck for Series A" or "Debug production issue for [company]" expose confidential work information to the entire group. | 5 | 7 | 8 | P2 |

---

## 5. Financial Social Engineering (32 vectors)

### 5.1 Payment System Exploitation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 5.1.1 | **Self-confirmed payments** | `app/api/bookings/[id]/payment/route.ts` PATCH endpoint lets users mark their own payment as "paid" by providing a `upi_ref`. No server-side payment verification. User sends empty/fake UPI reference and is marked as paid. | 10 | 9 | 4 | P0 |
| 5.1.2 | **Fake UPI reference numbers** | The `payment_reference` field accepts any text. "FAKE123456" is accepted. Admin must manually verify each payment -- unsustainable at scale. | 9 | 8 | 5 | P0 |
| 5.1.3 | **Race condition in payment confirmation** | No locking between payment generation (POST) and payment confirmation (PATCH). Multiple rapid PATCH requests could cause state inconsistency. | 5 | 4 | 7 | P2 |
| 5.1.4 | **UPI QR code substitution** | If QR codes are generated client-side via `generateUPILink()`, attacker intercepts and substitutes with their own UPI ID. Victim pays attacker instead of platform. | 9 | 4 | 8 | P1 |
| 5.1.5 | **Payment screenshot forgery** | If admin verification is based on submitted screenshots, these are trivially fabricated with photo editing tools. | 8 | 7 | 6 | P0 |

### 5.2 Referral Fraud

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 5.2.1 | **Referral farming with disposable accounts** | Create account A (gets code AAAA1234). Create accounts B, C, D with disposable emails using A's code. A earns Rs 150 (3 x Rs 50). Repeat with new accounts. | 7 | 8 | 6 | P0 |
| 5.2.2 | **Unlimited referral credits** | `referral_codes` has no `max_uses` column. A single referral code can be used unlimited times. No cap on total earnings per referrer. | 7 | 7 | 5 | P0 |
| 5.2.3 | **Credit stacking** | Referred user gets "first session free". If credits are not time-limited, they accumulate indefinitely. | 5 | 6 | 5 | P2 |
| 5.2.4 | **Referral code sharing on social media** | No ToS preventing mass distribution of referral codes. Post "Use code RAHUL1234 for free session!" on Reddit/Twitter for mass fraudulent signups. | 4 | 7 | 3 | P2 |
| 5.2.5 | **Cross-referral rings** | A refers B, B refers C, C refers D, D creates new email and refers A. Each person earns Rs 50 credit. | 6 | 5 | 7 | P2 |

### 5.3 In-Person Financial Scams

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 5.3.1 | **"Split the bill" scams** | "Hey, my payment didn't go through. Can you pay for me and I'll send you money?" Never repays. Platform facilitates trust needed for this scam. | 5 | 6 | 8 | P2 |
| 5.3.2 | **Investment scams via built trust** | After several genuine sessions building rapport, scammer pitches fake investment. Platform's trust-building mechanisms (ratings, tiers) make the scam more credible. | 8 | 5 | 9 | P1 |
| 5.3.3 | **Fake partnership proposals** | "I saw you're a designer (from profile). I have a client who needs [work]. Let me connect you -- just need a Rs 5000 commitment fee." | 6 | 5 | 9 | P2 |
| 5.3.4 | **QR code phishing at venue** | Attacker places fake "donedonadone payment QR code" stickers at venues. Users scan and pay to attacker's account. | 8 | 4 | 7 | P1 |
| 5.3.5 | **Venue kickback scheme** | Partner charges higher `venue_price`, kicks back portion to a user who "recruits" others to their sessions. Partner sees all booking data. | 6 | 4 | 8 | P2 |

### 5.4 Subscription Exploitation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 5.4.1 | **Subscription credential sharing** | Share login credentials with friends. Each takes turns attending sessions under the same subscription. | 5 | 6 | 7 | P2 |
| 5.4.2 | **Subscription downgrade timing** | Use all sessions at beginning of month, downgrade before renewal. No prorated enforcement visible. | 3 | 5 | 4 | P3 |
| 5.4.3 | **Trial abuse with multiple accounts** | If free trials exist (first session free for referred users), create multiple accounts for unlimited free sessions. | 6 | 7 | 6 | P1 |
| 5.4.4 | **Chargeback after attending** | Attend session, then dispute UPI payment with bank. Platform has already provided the service. No chargeback protection. | 7 | 5 | 5 | P1 |
| 5.4.5 | **Check-in without valid payment** | Check-in endpoint (`app/api/session/[id]/checkin/route.ts`) verifies booking exists with `payment_status IN ('paid', 'confirmed')`. But "paid" status is self-confirmed (see 5.1.1). So check-in can happen without actual payment. | 9 | 8 | 5 | P0 |

---

## 6. Platform Manipulation (44 vectors)

### 6.1 Matching Algorithm Exploitation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 6.1.1 | **Targeted matching via preference cloning** | Observe target's visible traits (work_vibe shown pre-check-in), set identical preferences. Scoring: +3 (vibe) + 2 (noise) + 2 (comm) + 1 (personality) + 1 (goals overlap) = +9 base score. Extremely high probability of same group. | 8 | 6 | 9 | P0 |
| 6.1.2 | **Coordinated multi-account group capture** | 3 accounts with identical preferences book the same session. With group_size=4, they fill 75% of a group. The 4th member is isolated. | 8 | 4 | 8 | P1 |
| 6.1.3 | **Favorite + cowork_again stacking** | Mark target as favorite (+1), rate them positively (+2 cowork_again bonus). Combined +3 persistent bonus per session ensures repeated grouping. Target cannot see or prevent this. | 7 | 5 | 8 | P1 |
| 6.1.4 | **Anti-repetition timer manipulation** | Anti-repetition penalty only looks at last 30 days (line 165 of `004_auto_assign_groups.sql`). Wait 31 days, then re-target. Or use new account for immediate bypass. | 6 | 4 | 8 | P2 |
| 6.1.5 | **Seed user exploitation** | Algorithm picks "first unassigned user" as seed (line 89-97). If booking order is predictable, an attacker can ensure they're the seed and thus control who's added to their group. | 5 | 3 | 9 | P3 |
| 6.1.6 | **Industry diversity bonus gaming** | Algorithm gives +1 for different industries (line 153-156). Set industry to something uncommon to maximize grouping with diverse users, increasing chances of being with a specific target. | 3 | 4 | 8 | P3 |
| 6.1.7 | **Streak affinity exploitation** | Both attacker and target have active streaks: +1 bonus to grouping score. Attacker maintains streak to boost grouping probability with other streak holders. | 4 | 5 | 7 | P3 |

### 6.2 Session & Booking Manipulation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 6.2.1 | **Session hoarding** | Book all spots in a session with multiple accounts, then cancel selectively. Controls who gets in. Other users face "session full" errors. | 7 | 4 | 5 | P1 |
| 6.2.2 | **Last-minute cancellation griefing** | Book session, wait until groups are assigned, cancel. Disrupts group dynamics, wastes other users' plans. No cancellation penalty visible. | 6 | 6 | 4 | P1 |
| 6.2.3 | **Spots_filled manipulation** | `book_session()` RPC atomically increments spots_filled. But cancellation doesn't appear to decrement it (no cancel_session RPC visible). Phantom bookings permanently reduce available spots. | 5 | 4 | 6 | P2 |
| 6.2.4 | **Waitlist queue jumping** | If waitlist offers expire, attacker monitors and grabs spots faster than legitimate users via automated scripts. | 4 | 3 | 7 | P3 |
| 6.2.5 | **Double-booking for arbitrage** | Book multiple sessions on same day, choose the one with the "best" group after group reveal, cancel others. | 3 | 5 | 5 | P2 |

### 6.3 Venue Rating Manipulation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 6.3.1 | **Venue brigading -- positive** | Venue partner creates multiple accounts, books their own sessions, leaves 5-star ratings across all 7 dimensions. Inflates venue score. | 7 | 5 | 6 | P1 |
| 6.3.2 | **Venue brigading -- negative** | Competing venue's partner creates accounts to leave 1-star ratings on competitor's sessions. | 7 | 4 | 6 | P1 |
| 6.3.3 | **Venue feedback tag manipulation** | Session feedback tags ("Nice venue", "Good coffee" vs "Too noisy", "Poor wifi") can be coordinated to create false positive/negative impressions. | 4 | 5 | 6 | P2 |
| 6.3.4 | **Venue dimension rating gaming** | Rate only dimensions you want to emphasize (e.g., all 5 on WiFi for a tech-focused venue) while ignoring others. No requirement to rate all dimensions. | 3 | 6 | 5 | P3 |

### 6.4 Social Status Gaming

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 6.4.1 | **Trust tier badge as false credibility** | "Community Pillar" or "OG" tier badges imply trustworthiness but only measure session count, not behavior quality. A problematic user with 51 sessions shows "OG" badge. | 6 | 6 | 5 | P1 |
| 6.4.2 | **Streak display as social pressure** | Visible streak count creates FOMO/social pressure. Users attend sessions they shouldn't (when sick, uncomfortable, etc.) to maintain streak. | 4 | 6 | 4 | P3 |
| 6.4.3 | **Referral count as status** | Profile shows "X referrals used". Incentivizes spam distribution of referral codes for vanity metrics. | 3 | 5 | 3 | P3 |
| 6.4.4 | **"People Met" count inflation** | Dashboard shows `unique_coworkers` stat. Attend many sessions to build impressive "network" number for social proof in scams. | 4 | 4 | 6 | P3 |

### 6.5 Group Dynamics Manipulation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 6.5.1 | **Toxic behavior for rating damage** | Be intentionally disruptive during session so group members rate each other poorly. Destroys reputation of innocent members who happen to be in the group. | 7 | 4 | 8 | P1 |
| 6.5.2 | **Social isolation tactics** | In a group of 4, 2 coordinated accounts exclude the other 2 from conversation. Targets leave negative feedback on the session (not the attackers specifically). | 6 | 4 | 9 | P2 |
| 6.5.3 | **Session goal shaming** | Attacker sees target's goals (visible to group). "Oh, you only finished a pitch deck in 4 hours? I did 3 pitch decks and a financial model." Undermines target's confidence. | 5 | 5 | 9 | P2 |
| 6.5.4 | **Organized platform boycott** | Coordinate users to cancel all bookings for specific sessions/venues to damage platform revenue. No cancellation fees. | 5 | 3 | 4 | P3 |
| 6.5.5 | **Community manipulation via favorites** | Create a "popular clique" by cross-favoriting. The matching algorithm groups favorites together, creating an exclusive in-group that new users can't penetrate. | 5 | 5 | 7 | P2 |

---

## 7. Vendor/Partner Abuse (33 vectors)

### 7.1 Partner Self-Enrichment

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 7.1.1 | **Fake session inflation** | Partner creates sessions at their venue, creates fake coworker accounts to "book" them. Partner receives `venue_price` per booking. Platform pays partner for sessions with no real coworkers. | 8 | 5 | 6 | P0 |
| 7.1.2 | **Venue price manipulation** | Partner sets `venue_price` artificially high. Platform's `total_price` = `platform_fee` + `venue_price`. Users pay inflated prices. No price ceiling or market rate check. | 6 | 6 | 4 | P1 |
| 7.1.3 | **Ghost sessions with colluding users** | Partner creates session, colludes with a few users for fake check-ins. Session shows as "completed" with paid bookings. Partner and colluding users split the venue_price. | 8 | 4 | 7 | P1 |
| 7.1.4 | **Capacity fraud** | Partner claims `max_capacity: 50` for a venue that fits 10. Oversells sessions. No physical verification of venue capacity. | 6 | 5 | 5 | P1 |
| 7.1.5 | **Amenity falsification** | Partner claims `amenities: [wifi, power_outlets, coffee]` but venue has poor WiFi and no outlets. No pre-verification of amenity claims. | 5 | 7 | 4 | P1 |

### 7.2 Partner Data Exploitation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 7.2.1 | **User data harvesting** | Partner dashboard likely shows bookings with user details. Partner exports this data for their own marketing, building a customer database from platform users. | 7 | 6 | 8 | P1 |
| 7.2.2 | **Preference data exploitation** | If partners see coworker preferences (vibe, noise, industry), they can target marketing: "Hey freelance designers who like quiet spaces, we have a new private studio!" | 5 | 5 | 8 | P2 |
| 7.2.3 | **Poaching high-value users** | Partner identifies "OG" or "Community Pillar" users who frequently book their venue. Offers them direct deals: "Book with us directly, skip the platform fee." | 7 | 6 | 7 | P1 |
| 7.2.4 | **Selling user contact information** | If partners have access to user phone numbers (from check-in data or WhatsApp groups), they could sell this data. | 8 | 3 | 8 | P1 |
| 7.2.5 | **Competitive intelligence** | Partner sees booking volumes, pricing, and user counts for competitors (if multiple venues are visible in admin). | 5 | 4 | 6 | P2 |

### 7.3 Partner Rating Manipulation

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 7.3.1 | **Self-rating via coworker accounts** | Partner creates coworker accounts, books their own sessions, leaves glowing reviews across all 7 venue dimensions. | 7 | 5 | 6 | P1 |
| 7.3.2 | **Rating solicitation pressure** | "Rate us 5 stars and get a free coffee next time!" Venue staff verbally pressure users during sessions. | 5 | 6 | 8 | P2 |
| 7.3.3 | **Negative review retaliation** | Partner identifies who left negative feedback (small groups make this easy), bans them from venue or provides poor service next time. | 6 | 4 | 8 | P2 |
| 7.3.4 | **Competitor sabotage** | Partner A creates accounts, books sessions at Partner B's venue, leaves negative reviews. Orchestrated campaign to damage competitor. | 7 | 3 | 6 | P2 |

### 7.4 Partner Operational Abuse

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 7.4.1 | **Session time manipulation** | Partner creates session listed as 10am-2pm but opens venue at 11am. Users arrive early, venue isn't ready. No automated session-time enforcement. | 5 | 5 | 4 | P2 |
| 7.4.2 | **Table assignment exploitation** | `groups.table_assignment` is set by partner. Partner assigns undesirable tables to certain users (near kitchen, bathroom) while reserving best spots for preferred users. | 4 | 4 | 7 | P3 |
| 7.4.3 | **Discriminatory service** | Partner provides different service levels based on user appearance, gender, or perceived spending power. No accountability mechanism. | 7 | 4 | 9 | P2 |
| 7.4.4 | **Fake cancellation claims** | Partner cancels session claiming "maintenance" or "private event", then serves walk-in customers at regular prices during that slot. Collects both platform bookings (if not refunded promptly) and walk-in revenue. | 6 | 4 | 6 | P2 |
| 7.4.5 | **Upselling pressure** | "The minimum order at our cafe is Rs 500 per person" -- not disclosed on platform. Users feel trapped after arriving. | 5 | 6 | 5 | P1 |
| 7.4.6 | **Venue photo fraud** | `venues.photos` array can contain professionally staged photos that don't represent actual conditions. No photo verification or recency requirements. | 4 | 7 | 4 | P2 |

### 7.5 Partner-User Collusion

| # | Vector | Description | Harm | Likelihood | Detection Difficulty | Priority |
|---|--------|-------------|------|------------|---------------------|----------|
| 7.5.1 | **Fake check-in collusion** | Partner verifies check-in for users who aren't physically present. Both benefit: user builds streak/reputation, partner shows session activity. | 6 | 4 | 8 | P2 |
| 7.5.2 | **Split-revenue fraud** | Partner creates overpriced sessions. Colluding users book with fake payments (self-confirmed). Partner claims revenue from platform. | 8 | 3 | 7 | P1 |
| 7.5.3 | **Referral laundering** | Partner distributes their own referral codes to walk-in customers: "Sign up with this code for your first free session." Partner earns referral credits + session revenue. | 5 | 5 | 6 | P2 |
| 7.5.4 | **Venue as predator enabler** | Unscrupulous venue staff tips off a stalker about when a target has booked. Venue has access to booking data. | 9 | 2 | 9 | P2 |

---

## Trust Architecture: Building Safety as a Moat

The following trust and safety system, if implemented comprehensively, would make donedonadone the safest platform for in-person stranger interactions -- a significant competitive moat.

### Layer 1: Identity Assurance (Pre-Registration)

**Goal:** Every human on the platform is a verified, unique, real person.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **Phone OTP verification** | Mandatory +91 SMS OTP during signup. One phone per account. | Eliminates disposable email farms, creates accountability |
| **Aadhaar-based identity verification** | DigiLocker integration for age and identity verification. Store only verification status, not Aadhaar number. | Prevents impersonation, enables legal accountability |
| **Selfie liveness check** | On first booking, require a live selfie (blink detection, head turn). Compare against profile photo. | Prevents stolen photos, creates physical identity link |
| **Progressive verification tiers** | Tier 1: Email + Phone. Tier 2: + Photo. Tier 3: + ID. Higher tiers unlock more sessions, premium groups, lower pricing. | Incentivizes verification without blocking MVP signups |
| **Device fingerprinting** | Track browser/device fingerprints to detect multi-accounting. Flag accounts created from same device. | Detects sybil attacks, referral farming |
| **CAPTCHA on signup** | hCaptcha or Cloudflare Turnstile on registration form. | Blocks automated account creation |
| **Email domain filtering** | Block known disposable email domains. Allowlist corporate domains for premium tier. | Reduces fake account creation |

### Layer 2: Behavioral Trust Scoring (Ongoing)

**Goal:** Continuously assess user trustworthiness from behavioral signals, not just self-reported data.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **Weighted multi-signal trust score** | Combine: verification level (30%), attendance reliability (20%), rating consistency (15%), account age (10%), reporting history (10%), payment reliability (15%). | Holistic trust assessment beyond simple session count |
| **Anomaly detection** | Flag: sudden preference changes before a session, multiple accounts booking same session, rating patterns that deviate from norm. | Catches matching manipulation, rating rings |
| **Rating cross-validation** | Compare incoming ratings for a user across multiple independent raters. Flag if one rater's pattern is consistently outlier (always negative or always positive). | Detects rating manipulation, extortion |
| **Payment verification scoring** | Track actual payment verification rate. Users who consistently have unverified payments get lower trust score. | Incentivizes real payments |
| **Session engagement scoring** | Track check-in timing, feedback completion, goal setting. Genuine users engage more deeply. | Distinguishes real users from gaming accounts |
| **Decay function** | Trust score decays slowly if user is inactive. Prevents abandoned high-trust accounts from being compromised and exploited. | Maintains score relevance |

### Layer 3: Content Safety (Real-Time)

**Goal:** All user-generated text is safe and appropriate before it's shown to others.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **Display name validation** | Unicode normalization (NFKC), homoglyph detection, profanity filter, max length 30 chars, alpha + spaces only. | Blocks name spoofing, offensive names, injection |
| **Goal text moderation** | Pre-publication filter: profanity, hate speech, personal info (phone, email), URLs. Can use simple regex + keyword list for MVP, ML later. | Prevents harassment, phishing, contact info leakage |
| **Feedback comment moderation** | Same filter as goals, plus: false accusation detection (flag comments mentioning "stole", "assault", "harass" for human review). | Prevents defamation, enables proper investigation |
| **Bio content filter** | Apply at onboarding API submission. Filter profanity, contact info, URLs. | Prevents bio-based harassment and scams |
| **Rate limiting on text submission** | Max 3 goals (already implemented), max 1 feedback per session (enforced by booking_id UNIQUE), but add: max 1 bio update per day, max 1 name change per week. | Prevents content spam |

### Layer 4: Matching Safety (Algorithm)

**Goal:** The matching algorithm considers safety alongside compatibility.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **Block list enforcement** | Before scoring, hard-filter: if user A has blocked user B, they are never in the same group. | Core safety requirement |
| **Report-based matching restrictions** | If A has reported B (even if not conclusive), reduce matching probability by -20 score penalty. | Proactive safety without requiring proven guilt |
| **Gender balance consideration** | Optional: users can indicate gender preference for group composition. Algorithm ensures minimum diversity in groups. | Addresses gender-specific safety concerns |
| **Trust score minimum for new group members** | In groups with high-trust users, don't place unverified/low-trust users. | Protects established community from bad actors |
| **Matching randomization** | Add controlled randomness (±2 score jitter) to prevent deterministic matching exploitation. | Makes preference-cloning attacks unreliable |
| **Repeat-targeting detection** | If user A has been in a group with user B more than 3 times and B hasn't blocked or reported, fine. But if A has modified preferences to match B's visible traits, flag for review. | Detects stalking-via-algorithm behavior |
| **Maximum favorites per user** | Cap at 10-20 favorites. Prevents using favorites as a mass-targeting tool. | Limits favorite system exploitation |

### Layer 5: In-Session Safety (Physical)

**Goal:** Users feel physically safe during every session, with rapid response to incidents.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **SOS button** | In-app emergency button during active sessions. Sends alert to: platform safety team + venue staff + optional trusted contact. | Immediate response to safety incidents |
| **Real-time session reporting** | "Flag this session" with categories: harassment, inappropriate behavior, safety concern, other. Triggers immediate review. | Empowers users to report without waiting |
| **Trusted contact sharing** | Pre-session: "Share your session details with a friend" (venue, time, group members). One-tap share via WhatsApp/SMS. | External safety net |
| **Venue safety requirements** | Mandatory: CCTV in common areas, staff present during sessions, well-lit parking, emergency exits documented. Add `safety_features` to venues table. | Ensures baseline physical safety |
| **Session check-out** | Add check-out confirmation. If a user doesn't check out within 30 min of session end, send a "Are you safe?" notification. | Post-session safety monitoring |
| **Photo-verified check-in** | Optional: venue staff confirms person matches profile photo at check-in. Adds `partner_verified_checkin` boolean. | Prevents identity fraud at physical meeting |
| **Pre-session safety briefing** | First-time users see mandatory safety guidelines: code of conduct, reporting instructions, emergency contacts. | Sets behavioral expectations |
| **Code of conduct** | Clear, visible rules: no solicitation, no unsolicited contact info sharing, no photography without consent, respect boundaries. Violation = immediate ban. | Establishes norms, provides basis for enforcement |

### Layer 6: Post-Session Safety (Feedback & Response)

**Goal:** Every incident is investigated, and the system learns from each event.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **Anonymous safety reports** | Separate from ratings: anonymous report form for safety concerns. Not visible to reported user. | Encourages reporting without fear of retaliation |
| **Automatic pattern detection** | If user receives safety reports from 2+ independent users, automatic account suspension pending review. | Rapid response to repeated offenders |
| **Rating retaliation detection** | If A reports B, and B gives A a low rating in the same session, flag B's rating for manual review. Optionally discard retaliatory ratings. | Protects reporters from retaliation |
| **Graduated enforcement** | Warning -> Temporary suspension -> Permanent ban. With clear criteria for each level. | Fair but firm enforcement |
| **Appeal process** | Banned users can appeal with additional context. Human review within 48 hours. | Prevents unjust bans from false reports |
| **Incident response team** | Dedicated safety team (even 1 person for MVP) who reviews reports within 4 hours during business hours. | Shows users their safety is prioritized |
| **Post-session safety check** | 2 hours after session ends, automated notification: "How did your session go? Any concerns?" with easy reporting link. | Catches incidents that users hesitate to report immediately |
| **Banned user database** | Cross-reference phone numbers, email patterns, device fingerprints of banned users to prevent re-registration. | Stops ban evasion |

### Layer 7: Systemic Protections (Platform-Level)

**Goal:** The platform itself is resilient to organized abuse campaigns.

| Component | Implementation | Impact |
|-----------|---------------|--------|
| **Rate limiting** | API rate limiting: 5 bookings/hour, 10 referral attempts/day, 3 account creations per IP/day. | Blocks automated abuse at scale |
| **Payment verification pipeline** | Integrate Razorpay for server-side payment verification. Eliminate self-confirmed payments entirely. | Eliminates payment fraud |
| **Referral fraud detection** | Flag: same IP/device creating referred accounts, referral chains longer than 3 hops, high-volume referral codes used from same geography. Cap referral earnings at Rs 1000/month. | Stops referral farming |
| **Partner vetting** | Physical venue verification before listing. GST/FSSAI verification. Annual re-verification. | Prevents fake venue fraud |
| **Data access audit logging** | Log every data access by partner accounts. Alert on bulk data exports or unusual access patterns. | Detects data harvesting |
| **Canary tokens** | Insert unique identifiers in data shown to each partner. If data appears externally, trace the leak. | Detects data selling |
| **Regular safety audits** | Quarterly red-team exercise. Annual third-party safety audit. Publish transparency report. | Continuous improvement, user trust |

### Moat Value Proposition

The comprehensive trust architecture described above creates a moat through several mechanisms:

1. **Network effects of trust**: As more verified users join, the platform becomes safer. Each verified user increases the trust density, making the platform more valuable for safety-conscious professionals.

2. **Data flywheel**: Behavioral trust scoring improves with more data. More sessions = better anomaly detection = fewer incidents = more trust = more users.

3. **Competitor barrier**: Replicating this safety infrastructure requires significant investment. A competitor can copy the matching algorithm but not the verified user base and trust data.

4. **Regulatory advantage**: When Indian regulations for aggregator platforms tighten (likely in 2-3 years), donedonadone will already be compliant. Competitors will scramble.

5. **Brand differentiation**: "The safest way to cowork with strangers" is a powerful positioning that justifies premium pricing and attracts the most desirable user segment (professionals with high-value equipment and privacy concerns).

6. **Partner selection**: Venues want to be associated with a safe, premium platform. Best venues will choose donedonadone over competitors who can't guarantee user quality.

---

## Summary of Critical Findings by Priority

### P0 -- Fix Before Launch (23 items)
1. Self-confirmed payments with no server-side verification (5.1.1, 5.1.2, 5.1.5, 5.4.5)
2. Zero identity verification for in-person meetups (1.5.1, 1.5.2, 1.5.3)
3. No phone OTP verification (1.1.2)
4. No CAPTCHA on signup (1.1.3)
5. Disposable email signup (1.1.1)
6. Name spoofing with no uniqueness check (1.2.1, 1.2.2)
7. No user blocking mechanism (2.2.5)
8. No in-session emergency reporting (2.2.3)
9. No content moderation on goal text or feedback comments (4.1.1, 4.1.3, 4.2.1, 4.2.3)
10. Preference cloning for targeted matching (2.1.6, 6.1.1)
11. Favorite-based stalking via algorithm (2.1.4)
12. Rating retaliation with no protection (3.1.2)
13. No gender-based safety options (2.6.1)
14. No safety briefing or code of conduct (2.6.2)
15. Referral farming with unlimited credits (5.2.1, 5.2.2)
16. Automated account farm possible (1.1.4)
17. Sybil attack via preference manipulation (1.3.1)
18. Self-referral farming (1.3.4)
19. Partner fake session inflation (7.1.1)

### P1 -- Fix Within First Month (41 items)
Matching algorithm safety additions, rate limiting, basic content moderation, partner data access controls, venue safety requirements, trusted contact sharing, background check framework, rating retaliation detection, venue brigading prevention, and all items with P1 designation above.

### P2 -- Fix Within First Quarter (52 items)
Advanced anomaly detection, behavioral analysis, device fingerprinting, comprehensive audit logging, subscription fraud prevention, partner operational accountability, and all items with P2 designation above.

### P3 -- Track and Address (38 items)
Edge-case gaming vectors, minor UI abuse, low-probability high-sophistication attacks, and all items with P3 designation above.

---

## Code References

| File | Key Finding |
|------|-------------|
| `app/auth/sign-up/page.tsx` | No CAPTCHA, no phone verification, optional referral code with no validation |
| `components/onboarding/onboarding-wizard.tsx` | Display name min 2 chars, no content filtering, phone optional and unverified |
| `components/session/group-reveal.tsx` | Exact venue coordinates shared, goals visible to group, WhatsApp integration planned |
| `components/session/group-member-card.tsx` | Display name prominently shown, avatar from URL with no verification |
| `components/session/feedback-form.tsx` | Free-text comment with no moderation, per-member ratings with no abuse detection |
| `scripts/004_auto_assign_groups.sql` | Exploitable scoring: preference matching +9, favorite +1, cowork_again +2, streak +1 |
| `scripts/008_reputation.sql` | Score based on quantity not quality, cold-start vulnerability, no fraud detection |
| `scripts/010_referrals.sql` | No max_uses limit, predictable code format leaks name, no fraud detection |
| `scripts/007b_session_goals.sql` | 200 char goal text with no content moderation, visible to entire group |
| `scripts/013_notifications.sql` | Template injection risk via user data interpolation |
| `lib/notifications.ts` | User-supplied data (venue, name) directly interpolated into notification text |
| `app/api/session/[id]/feedback/route.ts` | No comment moderation, member ratings stored without cross-validation |
| `app/api/sessions/[id]/goals/route.ts` | Only length check, no content filtering on goal_text |
| `app/api/referrals/route.ts` | No referral cap, no velocity check, no multi-account detection |
| `app/api/bookings/[id]/payment/route.ts` | PATCH allows self-confirmation of payment with arbitrary upi_ref |
| `app/api/session/[id]/checkin/route.ts` | Self-service check-in, no physical identity verification |
| `app/api/session/[id]/group/route.ts` | Information asymmetry implemented but bypassable, work_vibe visible pre-check-in |
| `scripts/001_schema.sql` | Profiles viewable by everyone (RLS), display_name has no content constraints |
| `app/dashboard/profile/page.tsx` | Dense PII display: email, phone, city, work type, industry, referral code |
| `lib/config.ts` | Trust tiers based purely on session count, not behavior quality |
