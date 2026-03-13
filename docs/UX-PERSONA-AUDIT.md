# FocusClub UX Persona Audit

## 10 Personas Walking Through Real Flows

> This audit traces 10 diverse personas through the actual implemented codebase,
> identifying friction, dead ends, confusion points, and improvement opportunities.
> Each issue is tagged with severity: **[BLOCKER]** **[FRICTION]** **[MISSED-OPP]** **[CONFUSING]**

---

## Persona 1: Priya — First-Time User (Freelance Designer, Instagram Ad)

**Context:** Sees Instagram ad for FocusClub. Clicks link on phone browser. Has never heard of the platform. Solo freelancer, works from home, lonely.

### Flow Walkthrough

1. **Lands on Index.tsx** — Sees "Where strangers become coworkers become friends." Feature cards (Smart Matching, Weekly Prompts, Cowork Sessions). Google OAuth button.
   - **[FRICTION]** Only Google OAuth available. If Priya uses Apple or email, she's blocked. No email/password, no Apple sign-in.
   - **[MISSED-OPP]** No social proof on landing page. No "Join 500+ members in HSR Layout" or testimonials. A first-time visitor from an ad needs validation.
   - **[MISSED-OPP]** No explanation of what a "session" actually looks like. The 3 feature cards are abstract. A 15-second video or photo carousel of a real session would convert better.

2. **Signs up via Google** — AuthContext creates user, profile record auto-created, redirected to `/onboarding`.

3. **Onboarding (4 steps):**
   - Step 1: Name, avatar, tagline, "what I do" — **[FRICTION]** "What I do" is a textarea but no guidance on what to write. Is it a job title? A bio? An elevator pitch? Placeholder text says nothing.
   - Step 2: Work vibe, communication, noise — Straightforward.
   - Step 3: Give & Get — **[FRICTION]** "Looking for" requires at least 1 item, but tag input with suggestions may not show what a designer would pick. Suggestions are hardcoded (startup, coding, design...). "Design feedback" or "creative accountability" aren't options.
   - Step 4: Two CTAs: "Find your first session" → `/events` or "I'll explore first" → `/home`
   - **[MISSED-OPP]** No neighborhood selection during onboarding. Priya will land on Events and see sessions in neighborhoods she doesn't recognize. Neighborhood should be asked in onboarding.

4. **Lands on Events page** — Sees "Sessions" tab.
   - **[BLOCKER]** If no sessions exist yet (pre-launch), Priya sees "No upcoming sessions" with nothing to do. No waitlist, no "notify me when sessions start." Dead end for a user who just signed up.
   - **[FRICTION]** Session cards show title, date, venue, but no description of what actually happens during the session. A first-timer has no mental model of "RSVP → show up → icebreaker → deep work → wrap up."
   - **[MISSED-OPP]** No "How it works" explainer accessible from the Events page. The onboarding explains the vibe but not the mechanics.

5. **RSVPs to a session** — Button changes to "Going ✓"
   - **[CONFUSING]** After RSVP, the share prompt appears but the user may not know anyone to share with. The intention card appears if structured format, but Priya doesn't know what "intention" means in this context.
   - **[FRICTION]** No confirmation screen/page. The RSVP is a button toggle. For a first-timer making a commitment to meet strangers, this feels too casual. Should feel like a deliberate commitment.

6. **Day of session** — Priya arrives at the cafe.
   - **[CONFUSING]** No clear "how to find your group" guidance. The GroupReveal component exists on EventDetail, but does Priya know to check the app? No push notification or SMS sent saying "Your group is ready, here are your tablemates."
   - **[FRICTION]** Check-in requires geolocation. If browser blocks it, falls back to PIN. But where does Priya find the PIN? The check-in PIN is generated at event creation and stored in DB, but it's not shown anywhere obvious to attendees.
   - **[BLOCKER]** Join Session button only appears on EventDetail if the date is today AND the format is structured AND the user RSVP'd. If the user goes directly to Home, there's no "Join your session" button (PrimaryActionCard handles this but depends on time window).

7. **Post-session** — Feedback flow triggers.
   - **[FRICTION]** FeedbackCard with 5 emoji ratings → GivePropsFlow → VenueReviewCard. That's 3 sequential steps. After a 4-hour session, this feels exhausting. No "do this later" option — it's in a dismissible card but if dismissed, there's no easy way back.

### Summary for Priya
The biggest risk: **she signs up, sees no sessions, and never comes back.** The second risk: she RSVPs but doesn't know what to expect on the day. The third: post-session fatigue from the feedback flow.

---

## Persona 2: Rahul — Referred Startup Founder (Busy, Time-Poor)

**Context:** Friend sent a referral link. CEO of a 5-person startup. Has 2 hours max. Needs focused work time, not socializing.

### Flow Walkthrough

1. **Clicks referral link** `/invite/:code` — InviteRedirect stores `fc_ref` in localStorage, redirects to Index.
   - **[MISSED-OPP]** Referral landing shows "You were invited by [name]" but doesn't show who the referrer is working with or what they've accomplished. Social proof from the referrer would be powerful.

2. **Onboarding** — Selects "Deep Focus" work vibe, "Minimal" communication, "Library energy" noise.
   - **[FRICTION]** No "how long do sessions last" info during onboarding. Rahul needs to know he can commit just 2 hours. He'd skip signup if he assumed it's a full day.

3. **Browses events** — Filters for his neighborhood.
   - **[FRICTION]** No filter for session format (casual vs structured 2hr vs structured 4hr). A busy founder specifically needs to filter by duration. Currently, format is shown on the card but there's no filter.
   - **[CONFUSING]** EventCard shows "Structured 2hr" vs "Casual" but doesn't explain the difference. Rahul doesn't know that structured means icebreaker → deep work → break → deep work → wrap-up.

4. **During session** — Rahul is deep in code. Traffic light panel buzzes.
   - **[FRICTION]** The traffic light system (red/amber/green) requires active management. Rahul would want to set "red" once and not be bothered. But the system resets between phases, and captain nudges arrive.
   - **[MISSED-OPP]** No "do not disturb" mode that persists through the entire session. Deep focus users need this.

5. **Post-session** — Gets asked for feedback, props, venue review.
   - **[FRICTION]** Same as Priya. Rahul has no time for 3-step feedback. A single "rate and go" option would be better.

### Summary for Rahul
Needs: duration filters, DND mode, minimal post-session flow. The structured 2hr format is perfect for him but he can't easily find or filter for it.

---

## Persona 3: Ananya — Woman, Safety-Conscious

**Context:** Saw FocusClub on LinkedIn. Interested but worried about safety. Wants women-only sessions first.

### Flow Walkthrough

1. **Landing page** — No mention of safety features, women-only sessions, or community guidelines.
   - **[MISSED-OPP]** Safety is a top-3 concern for women joining stranger-meeting platforms. The landing page should prominently feature: women-only sessions, member verification, flag system, trusted community.

2. **Events page** — Women-only filter appears because `profile.gender === "woman"`.
   - **[FRICTION]** If Ananya didn't set her gender during onboarding (it's not required), the women-only filter doesn't appear. She has no way to discover women-only sessions exist. Gender should be prompted more clearly.
   - **[FRICTION]** Women-only toggle is a filter chip, not prominently displayed. It looks like a regular filter, not a safety feature.

3. **EventDetail** — Women-only badge appears if set.
   - **[CONFUSING]** No explanation of how women-only is enforced. Can men RSVP? Is it honor-system? The code shows `event.women_only` flag but no enforcement logic on the RSVP mutation.
   - **[BLOCKER]** Checking the code: there's no RSVP-side enforcement of women-only. Any user can RSVP to a women-only event. This is a trust and safety gap.

4. **During session** — FlagMemberForm exists for reporting.
   - **[FRICTION]** The flag button is on hover in TrafficLightPanel. On mobile (the primary use case), there's no hover state. How does Ananya access the flag form on mobile?
   - **[MISSED-OPP]** No pre-session safety info (e.g., "You can flag any member privately at any time" or "A host is always present"). This would dramatically increase comfort.

5. **After flagging** — `checkFlagEscalation()` runs. Requires 2+ flaggers across 2+ sessions.
   - **[FRICTION]** That means a problematic member needs to be reported by 2 different people at 2 different events before any action. For a community this small, that's a high bar. First-time flagging should trigger immediate admin review.

### Summary for Ananya
Safety is under-communicated and under-enforced. Women-only sessions lack server-side enforcement. Flagging has a high threshold. Mobile flag access is unclear.

---

## Persona 4: Karthik — Power User (20+ Sessions, Table Captain)

**Context:** One of the most active members. Promoted to table captain. Runs structured sessions.

### Flow Walkthrough

1. **Home page** — Loaded with content: streak, circle, crew events, digest, milestones.
   - **[FRICTION]** The home page has 15+ sections that conditionally render based on state. For a power user, it's information overload. No way to customize or reorder sections. The most important info (next session, circle updates) competes with upgrade prompts and DNA cards.
   - **[MISSED-OPP]** No captain-specific dashboard. Karthik should see: his upcoming captain duties, group compositions for sessions he's captaining, first-timer alerts.

2. **Creates a session** — CreateEventButton with eligibility check.
   - **[FRICTION]** Session creation form has 10+ fields but no save-as-draft. If Karthik gets interrupted mid-creation, he loses everything.
   - **[FRICTION]** Venue partner dropdown only shows DB-stored partners. If Karthik wants to host at a new cafe, he has to type the name manually. No "suggest a new venue" flow.

3. **During session as captain** — CAPTAIN_NUDGES appear.
   - **[CONFUSING]** Captain nudges are just text strings. No action buttons attached. "Captain nudge: Check if everyone's good" — but there's no mechanism to do a group check beyond the traffic light.
   - **[MISSED-OPP]** No captain tools: group announcement, extend/shorten phase, skip phase, mute notifications for group.

4. **Group formation** — Karthik can see `createSmartGroups()` results.
   - **[CONFUSING]** The admin creates groups from EventsTab.tsx. But the captain sees group members only via GroupReveal on EventDetail. There's no flow showing the captain their specific table's composition in advance.

5. **Profile/Journey tab** — 20+ entries, timeline filters.
   - **[MISSED-OPP]** No "captain stats" — sessions captained, average group satisfaction, badge progress. Captains should feel recognized and tracked.

### Summary for Karthik
Power users need: customizable home, captain dashboard, session creation drafts, captain tools during sessions.

---

## Persona 5: Deepa — Venue Partner (Cafe Owner)

**Context:** Runs a cafe in HSR Layout. Wants to list it on FocusClub for foot traffic.

### Flow Walkthrough

1. **Landing page** — "Partner Venues" link at bottom.
   - **[FRICTION]** The link goes to `/partners` which is a read-only showcase of existing partners. The only CTA is "Contact Us" via WhatsApp to a hardcoded number. No self-serve venue registration.
   - **[BLOCKER]** There is no venue partner signup flow in the app. Deepa must contact someone manually via WhatsApp. For scaling to 1000 bookings/day, this is a bottleneck.

2. **Partners page** — Shows existing partners with stats.
   - **[MISSED-OPP]** No "What partners get" section explaining the value prop: foot traffic, recurring bookings, venue vibe data, marketing exposure.
   - **[MISSED-OPP]** No dashboard for venue partners showing: upcoming sessions at their venue, expected headcount, revenue split, reviews.

3. **If Deepa somehow gets added as a partner** — Her cafe appears in the venue partner dropdown during event creation.
   - **[CONFUSING]** The connection between venue partners and events is loose. Events have `venue_partner_id` but there's no venue-side management: approve/reject sessions, set capacity, set blackout dates, set pricing.

### Summary for Deepa
Venue partner experience is essentially absent. No self-serve registration, no dashboard, no management tools. This is the supply side of a marketplace — it needs as much product attention as the demand side.

---

## Persona 6: Arjun — Lapsed User (2 Weeks Inactive)

**Context:** Attended 3 sessions, loved it, but got busy with work. Hasn't opened the app in 14 days.

### Flow Walkthrough

1. **Re-engagement notification** — `checkReEngagement()` triggers at 7/10/14 days.
   - **[FRICTION]** Re-engagement only works if the user has push notifications enabled (PushOptInCard). If Arjun never enabled push, he gets nothing. No email re-engagement, no WhatsApp message.
   - **[CONFUSING]** The 14-day notification says "{N} sessions happening soon" but doesn't link to a specific session. The notification `link` field in the code is set to `/events` generically.

2. **Opens app again** — Home page loads.
   - **[MISSED-OPP]** No "welcome back" experience. The greeting says "Look who's back" (via `getContextualGreeting` with `daysSinceActive >= 7`), but there's no summary of what he missed: sessions happened, new members joined, his circle was active.
   - **[MISSED-OPP]** Streak is broken. No "streak insurance" prompt. The code has `streak_insurance_used_at` on the profile, and the streak warning card shows on Thursday+, but there's no actual mechanism to USE streak insurance — the card just says "You have a streak save available" with no action button.

3. **Browses events** — Sees upcoming sessions.
   - **[MISSED-OPP]** No "sessions your circle is attending" prominently on Events page. This exists on Home (crewEvents) but not on the Events listing itself. Social proof from familiar faces would be the strongest re-engagement hook.

4. **RSVPs and attends** — Streak resets to 1.
   - **[FRICTION]** Streak reset feels punishing. The code tracks `current_streak` but there's no grace period or "streak freeze" mechanic. The streak warning card exists but streak insurance has no implementation.

### Summary for Arjun
Re-engagement is weak: push-only, no email/WhatsApp, broken streak insurance. The "welcome back" moment is a missed emotional opportunity.

---

## Persona 7: Sneha — New to Bangalore (Zero Network)

**Context:** Just moved to Bangalore from Delhi. Doesn't know anyone. Looking for coworking friends in her neighborhood.

### Flow Walkthrough

1. **Onboarding** — Fills out profile. No neighborhood selection in onboarding.
   - **[FRICTION]** Sneha picks HSR Layout as neighborhood in Profile settings (after onboarding). But the Events page defaults to "All Sessions" — she has to manually tap the neighborhood filter each time.
   - **[MISSED-OPP]** Location preferences should be remembered and auto-applied to Events filtering. The profile stores `neighborhood` and `preferred_latitude/longitude` but the Events page doesn't use them as defaults.

2. **Home page** — Sees top matches (5 people).
   - **[CONFUSING]** Match scores are shown (e.g., "85% match") but the match reasons are vague: "Similar work vibe" or "Same neighborhood." Sneha doesn't know what makes a good match or why she should care.
   - **[MISSED-OPP]** No "people in your neighborhood" section. The Discover page has this (via locations) but Home doesn't surface it for offline users. For someone new to a city, this is the highest-value information.

3. **Discover page** — "Where people are working" section.
   - **[FRICTION]** This section shows active locations, but only for people currently checked in. If no one is checked in right now, it's empty. For a new city arrival browsing in the evening, this is likely empty.
   - **[MISSED-OPP]** No "popular spots in your area" or "upcoming sessions near you" on Discover. The map view exists but isn't linked from Discover.

4. **Attends first session** — Gets assigned a welcome buddy.
   - This is great design. BuddyCard on EventDetail shows the buddy with a "reach out" prompt.
   - **[FRICTION]** But the buddy assignment is automatic (someone with 5+ sessions). There's no buddy chat, no pre-session intro. The buddy just appears as a card. Sneha has no way to message them before the session.
   - **[MISSED-OPP]** No "your buddy at this session" notification before the event day. The buddy sees a notification but Sneha doesn't know she has one until she checks the event detail.

5. **After first session** — ProfilePromptCard triggers at 1 event attended.
   - Good progressive disclosure. But Sneha needs friends, not profile optimization.
   - **[MISSED-OPP]** After a first session, the highest-value prompt should be: "Want to cowork with [buddy name] again?" linking to CoworkAgainCard or a connection request. Instead, ProfilePromptCard asks about noise preferences.

### Summary for Sneha
The platform has good matching infrastructure but doesn't surface it for the "new to city" use case. Neighborhood awareness, buddy pre-intros, and post-session connection nudges would dramatically improve her experience.

---

## Persona 8: Vikram — Deep Focus Tech Worker (Hates Small Talk)

**Context:** Senior engineer. Wants pure focus time at a cafe. Doesn't want forced socializing.

### Flow Walkthrough

1. **Browses sessions** — Sees structured 4hr format.
   - **[FRICTION]** The 4hr structured format has 15-min icebreaker + 30-min social break = 45 minutes of socializing. That's 19% of the session. For someone who just wants focus time, this is too much. No "deep focus only" session format.
   - **[MISSED-OPP]** No "skip icebreaker" or "opt-out of social break" option. The session flow forces participation in all phases.

2. **During session** — Traffic light set to red.
   - **[FRICTION]** Even in red, captain nudges arrive. "Captain nudge: Check if everyone's good" interrupts focus. No way to mute nudges.
   - **[CONFUSING]** The traffic light says red = "Deep focus mode" but social break phase auto-changes status. Vikram's preference gets overridden by the phase system.

3. **Post-session** — Wrap-up components flood in.
   - **[FRICTION]** SessionWrapUp → intention accomplishment → GivePropsFlow → CoworkAgainCard → VenueVibeRating → ScrapbookPrompt. That's 5-6 sequential interactions. For someone who just wants to pack up and leave, there's no "skip all" or quick exit.
   - **[MISSED-OPP]** No minimal feedback mode: "Rate 1-5 and go." The current flow is designed for social users who enjoy reflection.

4. **Home page** — Community rituals, gratitude echoes, circle updates.
   - **[FRICTION]** Vikram doesn't care about Monday intentions or Friday wins. But there's no way to hide these cards. No settings for "minimal home" or notification preferences for in-app cards.

### Summary for Vikram
The platform's personality is social-first, which alienates deep focus users. Need: focus-only session format, skip mechanisms for social elements, minimal mode for post-session and home.

---

## Persona 9: Meera — College Student (Budget-Conscious, Free Tier)

**Context:** CS student. Uses cafe WiFi. Zero budget for subscriptions. Wants study groups.

### Flow Walkthrough

1. **Pricing page** — Sees 4 tiers.
   - **[CONFUSING]** Pricing page exists but `handleUpgrade()` shows "Payment integration coming soon!" toast. There's no payment system implemented. The entire tier/subscription infrastructure (DB tables, hooks, feature gates) is built but has no payment processor.
   - **[FRICTION]** Feature gates like `FeatureGate featureFlag="check_in"` and `FeatureGate featureFlag="taste_matching"` block content behind flags, but it's unclear if these are subscription-gated or feature-flag-gated. The `FeatureGate` component checks `isEnabled(featureFlag)` from useFeatureFlags, not `hasFeature` from useSubscription. These are two different systems.

2. **Free tier experience** — What's actually gated?
   - **[CONFUSING]** The code has two gating systems: `useFeatureFlags` (server-side toggles) and `useSubscription.hasFeature()` (tier-based). In practice, most UI elements check feature flags, not subscription tiers. This means gating is admin-controlled, not tier-controlled. Meera's free experience depends entirely on which flags are enabled, not her tier.
   - **[MISSED-OPP]** No clear "what you get free vs paid" explanation in the app. UpgradeSessionPrompt and BoostMathBanner exist but feel like ads, not value explanations.

3. **Session booking** — `getLimit("bookings_per_month")` should enforce limits.
   - **[BLOCKER]** Checking the code: `getLimit()` returns the limit value, but no component actually checks it before allowing RSVP. The EventDetail RSVP logic has no limit enforcement. Free users can book unlimited sessions.

4. **Discovers FeatureGate blocked content** — DNA builder, check-in, etc.
   - **[CONFUSING]** FeatureGate renders nothing when flag is off. No "upgrade to access" prompt. Content just disappears. Meera doesn't know a feature exists that she could unlock.

### Summary for Meera
The subscription/payment system is infrastructure without implementation. Free vs paid isn't enforced. Feature gating is confusing (flags vs tiers). Students need clear free-tier value and obvious upgrade paths.

---

## Persona 10: Aditya — Admin/Community Manager

**Context:** Runs the FocusClub community. Manages sessions, members, prompts, settings.

### Flow Walkthrough

1. **Admin page** — 18-tab layout (from Admin/index.tsx refactor).
   - **[FRICTION]** 18 tabs in a mobile-first app is unusable. Even on desktop, finding the right tab requires scrolling horizontally through a tiny tab bar. Needs grouping/sidebar navigation.
   - **[CONFUSING]** Admin access is gated by `ADMIN_EMAILS` constant, not a role in the database. If the admin email list changes, it requires a code deploy. Should use `profiles.user_type === "admin"` from the DB.

2. **Group creation** — EventsTab has "Create Groups" button calling `createSmartGroups()`.
   - **[FRICTION]** Groups are created but there's no way to preview/adjust them before saving. No drag-and-drop member reassignment. No manual override.
   - **[MISSED-OPP]** No notification sent to members when groups are formed. The group just appears on EventDetail via GroupReveal, but members don't know to check.

3. **Prompt management** — PromptsTab creates/activates prompts.
   - **[FRICTION]** Can only have one active prompt at a time. "Activate" button exists but no scheduling. Admin can't queue up next week's prompt.
   - **[MISSED-OPP]** No prompt analytics: response rate, average fire count, engagement comparison across prompts.

4. **Member management** — MembersTab with search, sort, CSV export.
   - **[FRICTION]** No ability to: suspend/ban members, change user type, send individual notifications, view flag history, or manage subscriptions. CSV export is the only action.
   - **[BLOCKER]** Flag escalation (`checkFlagEscalation()`) logs a warning but has no admin UI to review flags, take action, or communicate with flagged/flagging members.

5. **Settings** — SettingsTab is a key-value editor.
   - **[CONFUSING]** Settings are raw key-value pairs with no labels or descriptions. An admin seeing `min_session_threshold: 3` has no context for what it controls. No settings documentation or inline help.

### Summary for Aditya
Admin tools are minimal — enough to launch but not to operate. Critical gaps: member moderation, flag review, group editing, prompt scheduling, settings documentation.

---

## Cross-Persona Issues (Systemic)

### 1. **[BLOCKER] No Payment System**
The entire subscription infrastructure (4 tiers, features, limits, boost) is built in the DB and UI but there's no payment processor. `handleUpgrade()` shows a toast. UPI QR (mentioned in memory) isn't implemented. This means:
- Revenue = $0
- All tier features are either ungated or completely blocked
- No venue partner revenue share possible

### 2. **[BLOCKER] No WhatsApp Integration**
The product spec mentions WhatsApp groups for session coordination. `whatsapp_group_link` field exists on events. But there's no automation:
- No auto-group creation
- No session reminders via WhatsApp
- No re-engagement messages via WhatsApp
This is critical for India where WhatsApp is the default communication channel.

### 3. **[BLOCKER] No Email System**
No transactional email for: welcome, RSVP confirmation, session reminders, post-session feedback, re-engagement. Push notifications are the only outreach channel, and they require browser permission.

### 4. **[FRICTION] Information Architecture Overload**
The Home page conditionally renders 15+ sections. The Profile page has 3 tabs with 20+ fields. The Admin has 18 tabs. The app tries to surface everything everywhere. Needs ruthless prioritization.

### 5. **[FRICTION] Post-Session Flow Too Long**
The wrap-up sequence (intention check → props → cowork-again → venue rating → scrapbook) is 5 sequential interactions. This works for engaged users but alienates casual ones. Need a "quick rate" path.

### 6. **[CONFUSING] Two Gating Systems**
Feature flags (`useFeatureFlags`) and subscription tiers (`useSubscription.hasFeature()`) are separate systems. Some UI uses one, some uses the other. This creates inconsistent experiences and makes it hard to reason about what's available to whom.

### 7. **[FRICTION] No Pre-Session Communication**
Between RSVP and session day, users get nothing. No "your session is tomorrow" reminder, no "here's your group" notification, no "here's the venue on Maps" push. The GroupReveal exists but users must proactively check.

### 8. **[MISSED-OPP] No Onboarding for Session Mechanics**
First-time session attendees don't know: what happens when, what traffic light means, what props are, what the icebreaker looks like. A 3-screen "your first session" explainer would reduce anxiety dramatically.

### 9. **[FRICTION] No Offline / Slow Network Handling**
No service worker (beyond push), no offline cache, no optimistic UI for slow connections. In Indian cafes with spotty WiFi, the app will feel broken during sessions.

### 10. **[MISSED-OPP] Venue Intelligence Not Surfaced**
VenueVibeRating collects wifi/power/coffee/comfort ratings, but this data is barely shown. VenueVibeSummary exists but only appears in limited contexts. Users choosing a session want to know: "Does this cafe have good WiFi? Power outlets? Decent coffee?"

---

## Priority Matrix

| # | Issue | Impact | Effort | Priority |
|---|-------|--------|--------|----------|
| 1 | No payment system | Revenue-blocking | High | P0 |
| 2 | No WhatsApp/email notifications | Retention-critical | Medium | P0 |
| 3 | Women-only RSVP enforcement | Trust & safety | Low | P0 |
| 4 | Admin flag review UI | Safety-critical | Medium | P0 |
| 5 | Pre-session reminders (push at minimum) | Attendance-critical | Low | P1 |
| 6 | Session format filter on Events | Usability | Low | P1 |
| 7 | Neighborhood default from profile | Usability | Low | P1 |
| 8 | Quick post-session path | Retention | Medium | P1 |
| 9 | First-session explainer | Onboarding | Low | P1 |
| 10 | Venue partner self-serve registration | Supply-side growth | High | P1 |
| 11 | Landing page social proof | Conversion | Low | P2 |
| 12 | Streak insurance implementation | Retention | Low | P2 |
| 13 | Captain dashboard | Power user retention | Medium | P2 |
| 14 | Admin UX overhaul (18 tabs → grouped) | Operations | Medium | P2 |
| 15 | Unify gating systems (flags vs tiers) | Architecture | Medium | P2 |
| 16 | Home page section prioritization | UX | Medium | P2 |
| 17 | Focus-only session format | Market expansion | Medium | P3 |
| 18 | Buddy pre-introduction messaging | Onboarding quality | Medium | P3 |
| 19 | Venue intelligence on event cards | Decision support | Low | P3 |
| 20 | Offline/slow network resilience | Reliability | High | P3 |
