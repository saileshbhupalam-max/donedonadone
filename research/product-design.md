# donedonadone: Product Design Research

> **Platform concept**: A group coworking marketplace matching solo workers into groups of 3-5 at partner cafes in Bangalore.
>
> Research compiled: February 2026

---

## Table of Contents

1. [Onboarding Best Practices](#1-onboarding-best-practices)
2. [Booking UX](#2-booking-ux)
3. [Group Matching UX](#3-group-matching-ux)
4. [Retention](#4-retention)
5. [Two-Sided Marketplace](#5-two-sided-marketplace)
6. [Trust & Safety](#6-trust--safety)
7. [Gamification](#7-gamification)
8. [Key Metrics to Track](#8-key-metrics-to-track)

---

## 1. Onboarding Best Practices

### The Core Tension: Depth vs. Drop-Off

Every onboarding quiz faces a fundamental tradeoff: you need enough data to make good matches, but every additional screen loses users. The research converges on clear targets.

**Benchmarks from the industry:**

- A **3-screen / 9-question onboarding** flow typically sees no more than 10% drop-off (AppAgent, UXCam research).
- The ideal B2C onboarding completion rate is **30-50%** from first app open to fully activated user (Userpilot).
- Hinge's onboarding collects name, phone, email, date of birth, photos, and multiple profile prompts across roughly **15-20 steps**, but staggers the ask -- the first few screens are frictionless identity fields, with heavier profile-building deferred to post-registration.
- Bumble's registration is intentionally deeper than competitors, with each step framed by purpose: "the more you share, the better your matches." Users accept the length because the **value proposition is restated at each stage**.

### Lessons from Hinge and Bumble BFF

**Hinge's "Designed to Be Deleted" philosophy:**
- Prompts ("A Sunday well spent...", "I'm weirdly attracted to...") are pre-written conversation starters users select and fill in. This gives structure to self-expression and makes the quiz feel like play, not paperwork.
- Photos and prompts are interleaved, breaking up text entry with visual tasks. This variation in input type reduces perceived effort.
- Each prompt doubles as matching signal AND conversation starter -- the data is immediately useful in the product, which justifies the effort to the user.

**Bumble BFF's approach:**
- Bumble redesigned BFF profiles to focus on **shared common interests and connections** rather than physical appearance.
- BFF Groups mode encourages activity within groups to make participants more visible: initiating events, attending meetups, commenting, and creating topical surveys.
- The main user-reported obstacle is **awkwardness around planning face-to-face meetings with matched strangers** -- which is directly relevant to donedonadone.

### Progressive Profiling Strategy

Rather than asking everything upfront, the most successful apps distribute data collection across the user journey:

| Phase | What to Ask | Why |
|-------|------------|-----|
| **Sign-up (2 min)** | Name, photo, work style (remote/freelance/startup), neighborhood in Bangalore | Minimum viable profile for first match |
| **First session booked** | Preferred cafe vibes, noise tolerance, work hours, coffee/chai preference | Contextual -- they're making a booking decision |
| **After first session** | Rate the group, share what you're working on, communication style | They've experienced the product; feedback is natural |
| **Week 2+** | Deeper interests, skill tags, open to collaboration vs. heads-down | Earned the right to ask; user sees value |

### Making Quizzes Fun: Specific Tactics

1. **Use visual/card-based selection over text fields.** Duolingo's language quiz pulls users into an interactive test immediately, creating instant engagement. Replace dropdowns with tappable cards showing cafe vibes (e.g., illustrations of "buzzy vs. quiet," "laptop-friendly vs. notebook-only").

2. **Progress bars with personality.** Show a progress indicator but make it playful -- "You're 60% matched" or a filling coffee cup icon. Research shows progress bars alleviate frustration about onboarding length and provide a sense of accomplishment (Zigpoll, UXCam).

3. **Celebrate micro-completions.** Confetti animations, trophy icons, and subtle sounds on step completion stimulate dopamine release and encourage continued onboarding (Branch, Expert App Devs).

4. **"This or That" binary choices.** Faster than open text, more engaging than dropdowns. "Morning person or night owl?", "Headphones on or ambient chatter?", "Chai or filter coffee?"

5. **Show immediate payoff.** After 3-4 questions, show a preview: "Based on your answers, you'd match well with groups at Third Wave Coffee, Koramangala." This creates an "aha moment" mid-onboarding.

6. **Sort screens by conversion.** Place highest-conversion steps first; move lowest-conversion steps to the end or make them optional. This optimization alone can increase completion rates by 200% (Ridhi Singh, Medium case study).

7. **The "Reveal" moment.** After quiz completion, show a "Coworker Card" preview -- "Here's how others will see you." Similar to Hinge's profile preview or LinkedIn's profile strength meter. This creates investment in the profile and gives an immediate sense of the product's personality.

### Recommended Onboarding Flow for donedonadone

```
Screen 1: Welcome + value prop (illustration of 4 people working at a cafe)
Screen 2: "What brings you here?" [Cards: Focus buddy / Social motivation / New city, new friends / All of the above]
Screen 3: Name + selfie (for trust/safety, explained upfront)
Screen 4: "When do you usually work?" [Visual time picker: morning/afternoon/evening]
Screen 5: "Your ideal cafe vibe?" [Illustrated cards: Buzzy & social / Calm & focused / Don't care, surprise me]
Screen 6: Neighborhood preference [Map-based picker of Bangalore areas]
Screen 7: "Almost there!" -- preview of a sample match group + first available session
Screen 8: Book your first session (collapse sign-up and first action into one flow)
```

**Implementation notes:**
- Show "Step 3 of 7" not "Question 5 of 10" -- group multiple questions on one screen to reduce perceived length.
- Every screen should have a skip option (fill in later via progressive profiling).
- Use smooth slide transitions (Framer Motion or equivalent).
- Playful microcopy between steps ("Great taste!", "Almost there!", "You sound fun to work with").

**Target: 8 screens, under 3 minutes, under 15% drop-off.**

---

## 2. Booking UX

### Patterns from ClassPass

ClassPass is the closest analog to donedonadone's booking model and offers several proven patterns:

**Credit-based dynamic pricing:**
- ClassPass charges variable credits per class based on demand, time of day, and studio popularity. More credits are required when venues make fewer spots available, creating natural urgency.
- Credit costs can change day-to-day, encouraging users to book when they see a good rate.
- For donedonadone: consider a simple credit/token system where popular time slots at high-demand cafes cost slightly more, nudging users toward off-peak times and helping balance cafe capacity.

**Search and filter UX:**
- Map + list dual view for browsing. Users can toggle between a map showing cafe locations and a scrollable list of upcoming sessions.
- Key filters: date, time, location, class type. ClassPass redesigns showed that adding a "save filter" feature for commonly used filter combinations was well-received.
- For donedonadone: filters should include neighborhood, date/time, group size, and work vibe (focused vs. social).

**Cancellation policy as UX lever:**
- Reservations can be cancelled up to 12 hours before with no charge; credits auto-return.
- Late cancellation fees are shown at multiple touchpoints: the booking page, the confirmation pop-up, and the confirmation email. This transparency reduces disputes.
- A double-confirmation system ensures users cancel the right reservation.
- For donedonadone: cancellation policy is critical because no-shows break the group experience. Consider a 24-hour cancellation window and a "reliability score" visible on profiles.

### Patterns from BookMyShow

BookMyShow's India-specific mobile UX provides several relevant patterns:

**Urgency and scarcity indicators using color:**
- Green = many spots available
- Orange/Amber = half sold (2-5 spots)
- Red = few remaining (1 spot)
- Gray = full (with "Join waitlist" option)
- This traffic-light system communicates urgency instantly without requiring users to read numbers. It leverages the universal color associations that Indian users already understand from daily life.
- Important: always show **actual** spots remaining, not fake urgency. Ethical scarcity builds long-term trust. Optionally show "X people viewing" but only if actually true (achievable via real-time presence with Supabase Realtime or similar).

**Streamlined booking flow:**
- One redesign reduced movie booking from **14 steps to 7**, yielding a **50% increase in conversions**. The lesson: ruthlessly cut steps.
- User research found that most frequent users have strong preferences (specific cinema, showtime, seats) and will change dates to get what they want. For donedonadone, this suggests users will develop "regular" session preferences -- favorite cafe, favorite time, even favorite group members.

**Friction points to avoid:**
- Terms and Conditions mid-flow interrupt momentum; move them to sign-up.
- Upsell screens (BookMyShow's "Grab a Bite" add-ons) after seat selection obstruct checkout. If donedonadone offers cafe pre-orders (coffee waiting on arrival), present this BEFORE final confirmation, not as a pop-up interruption.

### Patterns from Cult.fit

Cult.fit (India-specific, highly relevant) demonstrates:

**Slot-based booking:**
- Users select city, center, time slot, and format. Bookings are mandatory because classes have limited capacity.
- This maps directly to donedonadone: session slots at specific cafes with limited group sizes.

**Subscription tiers:**
- Different pass levels (cultpass ELITE, cultpass PRO) with different access. Consider whether donedonadone needs a free tier (1 session/week) and a paid tier (unlimited + priority booking).

### Recommended Booking Flow for donedonadone

```
Step 1: Home screen shows "Upcoming Sessions Near You"
        -- Date strip at top (horizontal scrollable pills for next 7 days)
        -- Filter chips below (time of day, neighborhood, vibe)
        -- Personalized by neighborhood and preferred times
        -- Color-coded availability (green/orange/red)
        -- "Tomorrow morning at Third Wave, Koramangala -- 2 spots left"

Step 2: Tap a session card to see details
        -- Venue photos + vibe tags (in a bottom sheet, not a new page)
        -- Group size (e.g., "3/4 joined")
        -- Who's in the group (anonymized: "2 designers, 1 developer" or avatar silhouettes)
        -- Distance from user + commute estimate
        -- Compatibility reasons: "Matched on: work style, noise preference"
        -- Price breakdown + UPI/payment option

Step 3: One-tap book
        -- If returning user with saved payment: single "Book" button
        -- Confirmation with calendar add + cafe directions
        -- "Your group will be revealed 2 hours before the session"
        -- Optional: "Share with a friend" card for Instagram Stories

Step 4: Post-booking
        -- Push notification 2 hours before: group reveal with names + photos
        -- 30 min before: "Head to Third Wave! Your group is arriving"
        -- Optional: pre-order coffee through the app
```

**Target: 3 taps from home screen to confirmed booking.**

### Bottom Navigation Structure (4 tabs)

```
Home (dashboard) | Sessions (browse) | Bookings (my sessions) | Profile
```

---

## 3. Group Matching UX

### How Lunchclub Handles Matching

Lunchclub is the most directly relevant precedent -- AI-powered matching for IRL/virtual networking meetings:

**Profile + goals input:**
- Users provide professional background, interests, and networking goals.
- The algorithm combines self-reported data with public data sources to identify compatible matches.
- Crucially, the algorithm **learns from post-meeting feedback** -- both meeting duration and explicit ratings improve future matches.

**The reveal mechanic:**
- Users receive a match notification with the other person's profile. They can accept or decline.
- Lunchclub auto-schedules the meeting (45 minutes), reducing coordination friction.
- For donedonadone: auto-scheduling is a strength to adopt. Remove "when are you free?" negotiation entirely.

**Exclusivity as anticipation:**
- Lunchclub used invite-only access to create demand. Exclusive fireside chats with founders and product experts were only available to Lunchclub members.
- This exclusivity made matches feel more valuable -- "you're meeting someone curated, not random."

### How Bumble BFF Approaches Group Formation

**Activity-driven visibility:**
- In BFF Groups, members become more visible by initiating events, attending meetups, commenting, and creating surveys.
- This solves the "lurker problem" -- passive members don't get surfaced for matching.
- For donedonadone: users who attend sessions regularly, leave reviews, and book ahead should receive matching priority.

**Reducing stranger anxiety:**
- Bumble found that the primary obstacle is awkwardness about planning face-to-face meetings with strangers.
- Their solution: **mutual connections as a bridge**. Matching through a "mutual friend" (or in donedonadone's case, having previously been in a group with someone who's in the new group) reduces the "cold stranger" feeling.
- Profile redesign to emphasize shared interests over appearance.

**Event creation simplicity:**
- Events require only: photo, name, date, location -- all on a single page.
- Minimal friction to organize means more events get created.

### Focusmate's Accountability Model

Focusmate is the closest product analog to donedonadone (matching strangers for work sessions):

- **9+ million sessions facilitated** across 150+ countries.
- Partners greet each other, share session goals, work together, then check in and celebrate progress at the end.
- This **structured ritual** (greet, declare, work, debrief) is critical -- it transforms an awkward stranger encounter into a productive format.
- Neurodivergent members report a **161% increase in productivity**, suggesting that external accountability from matched strangers is genuinely powerful.

### Meetup's Attendance Patterns

- Events without fees see **40-50% show-up rates**; events with fees see **70-85%**.
- In a 200-member Meetup group, only about 22.5% attended at least one event, and just 12% attended more than one.
- An active and engaged organizer makes a significant difference in getting people to show up.
- Lesson for donedonadone: financial commitment (even small) dramatically improves reliability. And having a "host" or facilitator role for early sessions could boost attendance and comfort.

### Group Reveal Mechanics: Building Anticipation

The "group reveal" is a unique UX opportunity for donedonadone. Here is a recommended approach based on patterns from dating apps, Lunchclub, and event platforms:

**The Reveal Timeline:**

| Timing | What's Revealed | Purpose |
|--------|----------------|---------|
| **At booking** | Group size + anonymized profiles ("2 designers, 1 writer") + compatibility reasons | Enough to feel good about the match |
| **24 hours before** | First names + "fun fact" from each member + trait badges ("Deep Focus", "Morning Person") | Build curiosity |
| **2 hours before** | Full profiles with photos + an icebreaker prompt | Reduce anxiety, give conversation starter |
| **At the cafe** | App shows "Your group is here!" with a table number or beacon | Eliminate the awkward "is that them?" moment |

**The reveal animation:**
- Countdown timer: "Your group reveals in 2h 34m"
- Silhouette tease: show number of group members as gray silhouettes
- Cards flip one by one to show profiles (borrowing from dating app card-flip mechanics)
- This creates anticipation and excitement -- not just a notification

**Icebreaker prompts delivered with the reveal:**
- "Today's conversation starter: What's the most interesting thing you've worked on this week?"
- "Fun fact about your group: collectively, you've been to 12 sessions this month."
- These prompts give people "permission" to speak and remove the burden of initiating conversation.

### Making Strangers Comfortable: Specific Tactics

1. **Structured session format.** Borrow from Focusmate: 5-minute intros (name, what you're working on today), 45-minute focus block, 10-minute wrap-up. This removes ambiguity about how to behave.

2. **Shared context before meeting.** Show something in common: "You and Priya both work from home and prefer morning sessions." Even one commonality reduces social distance.

3. **Small groups (3-5) are intentional.** Research on group dynamics shows that 3-5 is the sweet spot: enough people that one quiet person doesn't create awkwardness, but small enough for genuine connection. Pairs feel too intense for strangers; groups of 6+ fragment into sub-conversations.

4. **Physical environment matters.** Partner cafes should have designated tables/zones for donedonadone groups. A small table marker or tent card ("donedonadone session in progress") signals belonging and gives the group an identity.

5. **First names only initially.** Don't show last names until after the session. This reduces the "stalking risk" feeling and keeps the interaction appropriately casual.

6. **Post-session ritual.** Before people leave, prompt a 2-minute in-app check-in: "How was today?" with emoji reactions. This creates closure and generates data for better future matching.

### Matching Algorithm Display

- **Don't** show numerical match scores (feels too algorithmic, clinical).
- **Do** show compatibility reasons: "Matched on: work style, noise preference, similar hours."
- This makes the matching feel intentional and human, not random or robotic.

---

## 4. Retention

### What Brings People Back to Community Platforms

Community platform retention is fundamentally different from tool retention. People return for three reasons: **habit, obligation, and anticipation**.

### Habit: Streaks and Cadence

**Duolingo's streak lessons (and warnings):**

Duolingo's streak system is the most studied retention mechanic in consumer apps:

- By 2022, most of Duolingo's DAU were maintaining an active streak.
- Streaks increase commitment by **60%**.
- But there's a dark side: "People weren't logging in to learn anymore. They were logging in so they didn't lose." Users opened the app, tapped a few buttons, and bounced.
- Users reported anxiety about breaking streaks, even while on vacation: "I was on vacation in Italy -- actually using the language I'd been learning -- but still felt anxious about maintaining my Duolingo streak."

**How Duolingo fixed it (critical for donedonadone to learn from):**

- **Streak Freezes**: Allow users to "pause" their streak for a day without losing progress. Surprisingly, reducing anxiety about streak loss **increased** long-term engagement.
- **Earn Back**: Users who lost their streak could regain it by completing extra lessons within a specific window. This reduces rage-quitting after a broken streak.
- **Clear communication**: Adding a simple line of copy -- "Start a day to extend your streak, but miss a day and it resets" -- led to a massive retention win.
- **Shift from external pressure to internal motivation**: The old mechanic relied on fear; the new approach uses AI to build internal motivation through personalized learning paths.

**What this means for donedonadone:**
- A "session streak" (attend X sessions in a row) can work, but build in grace: allow one skip per month without breaking the streak ("streak freeze").
- Frame streaks positively: "3-session streak! You're building a work rhythm" rather than "Don't break your streak!"
- Weekly cadence (e.g., "Your Tuesday 10AM slot is available") may be more sustainable than daily streaks for an IRL product.
- Provide an "Earn Back" window: missed this week? Complete 2 sessions next week to restore the streak.

### Obligation: Social Accountability

Social obligation is the most powerful retention force for IRL community products:

- **Meetup data**: Events with fees see **70-85% show-up rates** vs. 40-50% for free events. The financial commitment creates obligation.
- **Group size creates accountability**: In a group of 4, your absence is noticed. In a group of 100, it's invisible. donedonadone's small group size (3-5) is a natural retention advantage.
- **Named, known groups**: If you've been in a group with someone before and enjoyed it, the social obligation to show up for "your people" is strong. Consider allowing users to "favorite" group members and prioritize rematching.
- **"Your group is counting on you"**: After booking, reinforce the social commitment. Show who else is in the group -- putting names and faces to the commitment makes cancellation feel costly.

### Anticipation: The Pre-Session Loop

The period between booking and session is an underutilized retention window:

1. **Booking confirmation** -- immediate dopamine hit, calendar integration, confirmation animation.
2. **24-hour reminder** -- first names and fun facts of group members.
3. **2-hour reveal** -- full profiles, icebreaker prompt, cafe details.
4. **30-minute nudge** -- "Your group is arriving! Head to [cafe]."

Each touchpoint builds anticipation and makes cancellation feel costly (you'd be letting down specific, named people).

### Post-Session Loop (Critical)

What happens after the session determines whether users return:

```
Session ends
  -> Rating prompt (in-app, within 5 minutes): "How was today?" emoji reaction + optional 1-line note
  -> "Would you cowork with them again?" per member (thumbs up/down, feeds matching algorithm)
  -> "Book your next session?" -- show next available at same cafe/time, pre-filled, one-tap rebook
  -> "Share your session" card (Instagram Stories format, shareable streak badge)
  -> Next day: Weekly digest email with upcoming sessions + "Your 3-session streak continues!"
```

### Referral Mechanics

- **Tiered referrals**: "Refer 1 friend: free session. Refer 3: free month." This creates progressive incentive.
- **Buddy referrals**: "Invite a friend to join YOUR next session." This is uniquely powerful for donedonadone because it lets the referrer be present, reducing the new user's stranger anxiety.
- **Social proof in referral messaging**: "Join [Friend Name] and 2 others for a cowork session at Dialogues, Koramangala" is far more compelling than a generic "Try donedonadone!"
- Customers acquired by referrals have a **37% higher retention rate** (Propel AI research), making referral the highest-quality acquisition channel.

### Weekly Rhythm and Ritual

- Offer "recurring bookings": same cafe, same time slot, every week. Auto-book unless cancelled.
- "Your Tuesday 10AM at Third Wave is available" -- push notification on Sunday evening.
- This transforms donedonadone from an occasional experiment into a weekly ritual, which is the goal state for retention.

---

## 5. Two-Sided Marketplace

### The Cold Start Problem

Andrew Chen's framework from "The Cold Start Problem" identifies five stages of networked products:

1. **Cold Start Problem**: No supply, no demand, no value.
2. **Tipping Point**: Enough density for network effects to activate.
3. **Escape Velocity**: Self-sustaining growth.
4. **Hitting the Ceiling**: Growth slows.
5. **The Moat**: Defensibility.

### The Atomic Network

The **atomic network** is the smallest network that can stand on its own -- enough density and stability to break through early anti-network effects and ultimately grow on its own. For donedonadone, this is:

> **One cafe in one Bangalore neighborhood with enough regular solo workers to fill 2-3 groups per week.**

This means the atomic network is roughly:
- 1 partner cafe (e.g., Third Wave Coffee, Koramangala)
- 15-20 active solo workers in that neighborhood
- 3-4 sessions per week filling groups of 3-5

Do NOT try to launch across all of Bangalore simultaneously. Achieve density in one neighborhood first. Uber launched in one city, Tinder launched at one university, Lunchclub launched in San Francisco tech circles.

### Supply-Side Strategy (Venues)

**Why cafes would participate:**
- **Guaranteed traffic during off-peak hours.** Position donedonadone sessions during 10am-12pm and 2pm-4pm when cafes are emptiest.
- **Higher per-table revenue.** A group of 4 coworkers each ordering coffee + snacks generates more revenue than one person nursing a single cappuccino for 3 hours.
- **Community branding.** Being a "donedonadone partner cafe" positions the venue as a community hub, which is valuable for their brand.
- **Zero cost to participate.** Don't ask cafes to install technology or change operations. They just reserve a table zone.

**Partner onboarding (keep it simple):**
- 30-minute onboarding call structured as: 5 minutes context, 20 minutes "the money slide" (revenue opportunity), 5 minutes next steps (per David Ciccarelli's marketplace playbook).
- Personally onboard first 5-10 cafes. Don't build a self-serve partner portal yet. Manual onboarding builds relationships and reveals friction.
- Start with cafes that already have a coworking-friendly reputation (power outlets, Wi-Fi, laptop-friendly policies).
- Use the "upside-down funnel" approach: get just one cafe fully activated with personalized attention before trying to scale.

**Show transparent value to partners:**
- Weekly earnings dashboard showing bookings, revenue, and peak times.
- Weekly payouts build trust and demonstrate real value.
- "Venues love donedonadone" social proof to attract more venues.
- Guarantee venues minimum bookings for the first month (subsidize if needed to build trust).

**Recommended initial partner targets in Bangalore:**
- Third Wave Coffee (multiple locations, strong laptop culture)
- Dialogues Cafe (known for social-impact positioning)
- Matteo Coffea (popular with remote workers)
- The Hole in the Wall Cafe (creative/startup crowd)

### Demand-Side Strategy (Solo Workers)

**Who are the early adopters?**
- Remote workers at startups who miss office energy.
- Freelancers (designers, developers, writers) who work alone.
- People new to Bangalore who want to build a social circle through work.

**Cold start tactics:**
1. **Seed the first groups manually.** Recruit 20-30 people from existing communities (Twitter/X tech Bangalore, freelancer Slack groups, Meetup groups). Run the first sessions yourself as the host/facilitator.
2. **Create single-player value.** Even without a group, the app should offer value: curated list of coworking-friendly cafes in Bangalore, cafe reviews, Wi-Fi speeds, outlet availability. This gives people a reason to download before network effects kick in.
3. **Use the "upside-down funnel" approach** (from Reforge): focus on getting just one person fully activated with personalized one-on-one onboarding, then use their experience to recruit the next.
4. **Concentrate geographically.** All early marketing should target a 5km radius: Koramangala, HSR Layout, Indiranagar. This is where the density of remote workers, cafes, and startup culture is highest.

### Balancing Supply and Demand

Key principle: **Excess demand is better than excess supply in early stages.** If 20 people want sessions but only 8 spots are available at partner cafes, that scarcity creates urgency and perceived value. If 20 cafe spots are available but only 3 people book, the product feels dead.

Metrics to monitor:
- **Utilization rate**: % of available session spots that are booked. Target: 70%+ for a healthy marketplace.
- **Buyer-to-supplier ratio**: Solo workers per cafe. Monitor if any cafe is consistently empty or overbooked.
- **Search-to-fill rate**: % of users who browse sessions and actually book one. Low rates suggest a mismatch between available sessions and user preferences.
- **Time to fill**: How quickly do session spots fill after being posted? Faster fill = healthier demand.

### The Sequencing Decision

Most successful two-sided marketplaces **seed supply first**. For donedonadone:

1. Sign 5-10 partner cafes before launching to users.
2. Manually curate the first 50-100 sessions with hand-picked early users.
3. Only begin open registration once sessions are reliably filling.
4. Expand to adjacent neighborhoods only when the first neighborhood has consistent 70%+ utilization.

---

## 6. Trust & Safety

### Identity Verification for IRL Meetups

Because donedonadone involves strangers meeting in person, trust and safety is table-stakes, not a nice-to-have.

**Bumble's verification playbook (directly applicable):**

1. **Photo Verification (mandatory):**
   - Users take a real-time selfie mimicking a randomly-chosen pose.
   - The selfie is compared against uploaded profile photos by technology or a human reviewer.
   - Verified users receive a blue shield badge.
   - Bumble made photo verification **mandatory in the USA** -- users cannot skip it.
   - For donedonadone: **make photo verification mandatory from day one.** This is an IRL product; people need to know who they're meeting.

2. **ID Verification (optional but encouraged):**
   - Users submit a government-issued ID to authenticate identity.
   - Verified users earn an additional trust badge.
   - Available in India (among other countries) on Bumble.
   - For donedonadone: consider making ID verification mandatory for the first session, then optional thereafter. Alternatively, offer it as an opt-in trust badge that signals higher commitment.

3. **LinkedIn/professional verification (unique to donedonadone):**
   - Allow users to link their LinkedIn profile. This serves dual purpose -- professional credibility AND gives group members context about each other's work.
   - This is especially relevant for a coworking platform where professional identity matters.

4. **Phone number verification (mandatory):**
   - Standard OTP-based verification at sign-up.
   - Ties account to a real phone number, which is the baseline for trust in India.

### Content Moderation and Reporting

**Bumble's approach adapted for donedonadone:**
- Technology sweeps all profile photos and text for inappropriate content.
- Block & Report feature with anonymous review by safety team.
- Reports never reveal the reporter's identity to the reported person.
- Explicit content auto-blurred (less relevant for coworking but good practice).

**For donedonadone specifically:**
- Implement anonymous reporting for any session attendee.
- After-session feedback should include a discrete "Report a concern" option alongside the normal rating.
- Any user reported by 2+ different people should be flagged for manual review.
- Clear community guidelines displayed during onboarding (not buried in T&C).
- Cancel rate tracking: high cancellers are deprioritized in matching (protects group reliability).

### Rating Systems for Small Groups

Small group ratings require careful design to avoid social pressure:

**The challenge:** In a group of 4, if you rate someone poorly, they might guess it was you. This chills honest feedback.

**Recommended approach:**

1. **Session rating, not person rating (primarily).** Ask "How was this session?" (1-5 stars or emoji scale) rather than "Rate each person." This feels less confrontational.

2. **Private compatibility signal.** Instead of rating individuals publicly, ask: "Would you like to be matched with these people again?" (Yes / Neutral / No). This is private, low-stakes, and directly useful for the matching algorithm.

3. **Aggregate, don't expose.** Never show a user their individual rating from specific people. Instead, use accumulated signals internally to improve matching. If someone consistently gets "No, don't match me with them again," reduce their matching priority and eventually intervene.

4. **Flag, don't rate, for safety issues.** Separate the "vibe" rating from safety concerns. "They were quiet and didn't talk much" is a compatibility issue, not a safety issue. "They made me uncomfortable" is a safety issue requiring immediate attention.

5. **Minimum review threshold.** First session for new users is curated/facilitated. They need at least 1 positive session review before being auto-grouped. This ensures a baseline quality bar.

### Safety Features for IRL Sessions

1. **Share session details.** Borrow Bumble's "Share Date" feature: let users share session details (who, when, where) with a trusted contact directly from the app.

2. **Cafe as neutral ground.** All sessions happen at partner cafes (public spaces with staff present). Never suggest sessions at homes, offices, or private spaces.

3. **Emergency contact integration.** Allow users to set an emergency contact who receives an automated check-in notification after each session ends.

4. **Session check-in / check-out.** Require users to "check in" on the app when they arrive at the cafe and "check out" when they leave. This creates a digital trail and confirms attendance.

5. **Partner cafe coordination.** Brief partner cafe staff that donedonadone groups meet at their venue. Staff awareness adds an implicit safety layer.

6. **Trait badges for comfort.** Show badges like "Deep Focus", "Chatty", "Morning Person" so people know what to expect from group members before meeting.

### Bad Actor Prevention

- Two "would not cowork again" ratings from different users triggers manual review.
- Report button accessible from group view at all times, not just post-session.
- Accounts with high cancellation rates are deprioritized in matching.
- Repeat offenders receive warnings, then temporary suspension, then permanent ban.

---

## 7. Gamification

### What Works

The most effective gamification aligns game mechanics with genuine product value. Research from Trophy, Thrico, and BuddyBoss converges on these principles:

**1. Align badges with meaningful actions.**
- Reward actions that benefit the ecosystem: attending sessions, giving helpful post-session feedback, referring friends who actually come.
- Bad example: Badge for "completing your profile" (busywork, no community value).
- Good example: Badge for "attended 5 sessions at 5 different cafes" (encourages exploration, benefits partner cafes).

**2. Blend individual and community recognition.**
- Individual: "You've completed 10 sessions!" (personal milestone).
- Community: "Your Koramangala crew has coworked for 50 hours together!" (group achievement).
- This balance between competition and camaraderie prevents gamification from feeling isolating.

**3. Streak design that is sticky but humane.**
- Borrowing from Duolingo's evolved approach: streaks should be forgiving.
- Allow streak freezes (1 per month free, additional earned through referrals).
- Provide "Earn Back" windows: missed this week? Complete 2 sessions next week to restore your streak.
- Never shame users for broken streaks. Frame it as: "Welcome back! Pick up where you left off."

**4. Seasonal themes and rotating challenges.**
- "January Focus Challenge: 8 sessions in January."
- "Cafe Explorer: Visit 3 new partner cafes this month."
- Rotating challenges prevent the gamification system from feeling stale. Retire old badges, introduce new themes quarterly.

### What Feels Forced

**1. Hollow rewards with no real value.**
- If badges mean nothing beyond a visual icon, engagement drops quickly. Pair badges with tangible perks: a "10-session" badge unlocks priority booking; a "Community Builder" badge (for referring 3+ friends) unlocks a free session.

**2. Unclear earning rules.**
- If users don't understand how to earn something, they ignore the system. Every badge should have a clear, one-sentence description visible before earning it.

**3. Over-gamification.**
- Resist the urge to gamify everything. Not every action needs points. If checking into a session earns points, writing a post-session note earns points, rating your group earns points, and referring a friend earns points, the point system becomes noise.
- Focus gamification on the **one behavior you most want to reinforce** at each growth stage. Early stage: attendance frequency. Growth stage: referrals. Maturity: community contribution.

**4. Public leaderboards without consent.**
- Leaderboards can motivate top users but demotivate everyone else. If used, make them opt-in or show relative position ("You're in the top 20%") rather than absolute rank.

**5. Points/XP systems for coworking.**
- These feel borrowed from gaming and don't fit the coworking context. A "People Met" counter or "Venues Explored" counter feels natural; a "500 XP" badge does not.

**6. Excessive notifications.**
- Gamification notifications ("You earned a badge!") can quickly erode trust if they feel spammy. Batch them into the post-session flow or weekly digest rather than sending separate push notifications for each.

### Recommended Gamification System for donedonadone

**Tier 1: Session Streaks (core habit mechanic)**
- Weekly streak: attend 1+ session per week.
- Visual: coffee cup that fills up week by week.
- Streak freeze: 1 free per month.
- Reward at milestones: 4-week streak = "Regular" badge; 12-week streak = "Local Legend" badge.
- Streak indicator shown subtly on profile (not a push notification).

**Tier 2: Exploration Badges (discovery mechanic)**
- "Cafe Hopper": 5 different partner cafes visited.
- "Early Bird": 5 sessions before 10am.
- "Night Owl": 5 evening sessions.
- "Connector": Been in groups with 20+ unique people.
- "Venues Explored" counter on profile -- encourages trying new places.

**Tier 3: Community Levels (long-term progression)**
- New Member -> Regular -> Community Builder -> donedonadone OG.
- Progression based on a weighted combination of: sessions attended, people matched with, referrals, and group compatibility ratings received.
- Each level unlocks a small but tangible perk:
  - **Regular**: Priority booking for popular time slots.
  - **Community Builder**: Can create "open sessions" (custom groups they host).
  - **donedonadone OG**: Input on new partner cafe selection + exclusive events.

**Social counters (not gamification, but community):**
- "People Met" counter -- feels social, not gamified.
- "Sessions Completed" counter -- personal milestone tracking.
- "Venues Explored" counter -- encourages café discovery.
- Shareable "cowork streak" badge for Instagram Stories.

---

## 8. Key Metrics to Track

### Stage 1: 0-100 Users (Proving the Concept)

At this stage, the only question is: **"Do people come back after their first session?"**

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Session completion rate** | >90% | Do people who book actually show up and stay? |
| **First-to-second session conversion** | >40% | The most critical early metric. If people try once and don't return, the product doesn't work. |
| **Post-session NPS / rating** | >8/10 | Are sessions genuinely enjoyable? |
| **Qualitative feedback themes** | N/A (track patterns) | What do people love? What's awkward? What would make them come back? |
| **Cafe partner satisfaction** | Qualitative | Are cafes happy with the groups? Any complaints from staff or other patrons? |
| **Organic word-of-mouth** | Any unprompted referrals | Are users telling friends without being prompted? |

**Do NOT track at this stage:** Total signups, app downloads, social media followers. These are vanity metrics that don't indicate product-market fit.

### Stage 2: 100-1,000 Users (Finding Product-Market Fit)

Now the questions are: **"Is this a habit?"** and **"Does the marketplace work?"**

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Weekly active users (WAU)** | Growing 15-25% MoM | Indicates organic traction. |
| **Repeat session rate** | >50% book a 2nd session within 2 weeks | Measures habit formation. |
| **30-day retention** | >35% | 20% is average, 35-40% is good, 50%+ is best in class for community platforms. |
| **Utilization rate** | >70% | Are available session slots filling up? |
| **Match satisfaction** | >4/5 average rating | Is the matching algorithm working? |
| **Time to first session** | <48 hours from signup | How quickly do new users experience value? |
| **No-show rate** | <15% | Critical for group experiences. High no-shows destroy trust. |
| **Referral rate** | >15% of new users from referrals | Organic growth signal. |
| **Cafe partner retention** | >90% month-over-month | Are cafes staying in the program? |

**Cohort analysis is essential at this stage.** Track 7-day, 14-day, and 30-day retention by signup cohort. Look for the "smile curve" where early cohorts retain poorly (pre-PMF) but later cohorts retain better as the product improves.

### Stage 3: 1,000+ Users (Scaling)

Now the questions are: **"Can this grow efficiently?"** and **"Are the unit economics sustainable?"**

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Monthly active users (MAU)** | Consistent growth | Top-line health. |
| **DAU/MAU ratio** | >15% | Measures engagement intensity. For a weekly-use product, 15%+ is strong. |
| **Customer acquisition cost (CAC)** | Decreasing over time | Efficiency of growth spend. |
| **Lifetime value (LTV)** | >3x CAC | Unit economics viability. |
| **Revenue per session** | Increasing or stable | Monetization health. |
| **Net revenue retention** | >100% | Are existing users spending more over time? |
| **Supply-demand ratio by neighborhood** | Balanced | Monitor for neighborhoods that are over or under-served. |
| **Liquidity (search-to-book rate)** | >30% | When someone browses sessions, do they find and book one? |
| **Cross-neighborhood booking** | Increasing | Users exploring beyond their home neighborhood indicates platform stickiness. |
| **Session frequency per active user** | >2/month and growing | Users deepening their habit. |
| **Viral coefficient (K-factor)** | >0.5, ideally >1 | Each user bringing in at least half a new user. K>1 means organic viral growth. |

### Marketplace-Specific Metrics to Monitor Continuously

Drawn from Sharetribe, Point Nine, and Bowery Capital research on marketplace liquidity:

1. **Buyer-to-supplier ratio**: Solo workers per partner cafe. If this drifts too high, expand cafe supply. If too low, focus on demand generation.

2. **Time to fill**: How quickly do new session slots get booked? Faster fill = healthier demand. If sessions post on Monday and fill by Tuesday, demand is strong.

3. **Provider utilization**: What % of a cafe's available donedonadone slots are actually booked? Low utilization means you're wasting partner goodwill.

4. **Match rate**: What % of users who request a session get successfully placed in a group? If this drops below 80%, the network isn't dense enough.

5. **Search-to-fill rate**: The ratio of browse sessions to actual bookings. Tells you if supply matches what users are looking for.

### The One Metric That Matters at Each Stage

| Stage | OMTM | Rationale |
|-------|------|-----------|
| **0-100** | First-to-second session conversion | Proves the core experience works |
| **100-1,000** | 30-day retention by cohort | Proves the product is a habit |
| **1,000+** | LTV/CAC ratio | Proves the business is sustainable |

---

## Appendix: Key Sources and Further Reading

### Onboarding & Quiz Design
- [Bumble Onboarding Flow](https://www.theappfuel.com/examples/bumble_onboarding) -- App Fuel
- [Hinge Onboarding Flow on iOS](https://pageflows.com/post/ios/onboarding/hinge/) -- Page Flows
- [UX Onboarding Best Practices](https://www.uxdesigninstitute.com/blog/ux-onboarding-best-practices-guide/) -- UX Design Institute
- [Best Mobile App Onboarding Examples 2026](https://www.plotline.so/blog/mobile-app-onboarding-examples) -- Plotline
- [How We Improved Our Onboarding Funnel & Increased Conversions by 200%](https://medium.com/@ridhisingh/how-we-improved-our-onboarding-funnel-increased-conversions-by-200-9a106b238247) -- Ridhi Singh, Medium
- [App Onboarding Guide - Top 10 Examples](https://uxcam.com/blog/10-apps-with-great-user-onboarding/) -- UXCam
- [UX Labyrinth: Designing Onboarding for Dating Services](https://www.datingpro.com/blog/ux-labyrinth-designing-the-perfect-onboarding-flow-for-a-dating-service/) -- PG Dating Pro
- [UIUX Audit: Bumble vs. CMB vs. Tinder](https://blog.snappymob.com/uiux-audit-bumble-vs-cmb-vs-tinder) -- Snappymob

### Booking UX
- [ClassPass Booking Flow: A UX Case Study](https://karloozaeta.com/work/classpass-booking-flow-redesign) -- Karlo Ozaeta
- [Improving the ClassPass Experience](https://uxdesign.cc/ux-case-study-classpass-1498af38fc1a) -- UX Collective
- [App Design for ClassPass](https://medium.com/@christinagajny/app-design-for-classpass-ux-case-study-dcbe5c2ba467) -- Christina Gajny, Medium
- [BookMyShow UX Case Study](https://www.behance.net/gallery/60959341/BookMyShow-UX-Case-Study) -- Danish Ahmed, Behance
- [Designing Booking Flow for BookMyShow](https://medium.com/@kiran6390/ui-ux-case-study-designing-1-click-booking-for-bookmyshow-bd2cd0e7845a) -- Kiran, Medium
- [BookMyShow Booking Page UI Redesign](https://medium.com/design-bootcamp/a-conceptual-redesign-of-the-bookmyshow-booking-page-ui-improving-user-experience-and-conversion-e66880d48a84) -- Shrey Trivedi, Medium
- [BookMyShow -- Improving the Booking Process](https://medium.com/design-bootcamp/bookmyshow-improving-the-booking-process-ux-design-assignment-6576942a4e30) -- Design Bootcamp

### Group Matching & Stranger Comfort
- [Bumble BFF Groups Case Study](https://www.natashamozgovaya.com/uxcasestudies/bumble-bff-groups) -- Natasha Mozgovaya
- [Creating a New Feature for Bumble BFF](https://medium.com/design-bootcamp/case-study-creating-a-brand-new-feature-for-bumble-bff-ad51cec3c865) -- Barbara Accioly, Medium
- [Apps Promising to Help People Make Friends](https://techcrunch.com/2025/12/26/as-people-look-for-ways-to-make-new-friends-here-are-the-apps-promising-to-help/) -- TechCrunch
- [How Lunchclub Works](https://canvasbusinessmodel.com/blogs/how-it-works/lunchclub-how-it-works) -- Canvas Business Model
- [How Lunchclub Leveraged Invite-Only Exclusivity](https://insidestartups.substack.com/p/quick-insights-how-lunchclub-leveraged) -- Inside Startups
- [Making Connections with AI](https://medium.com/lunchclubai/making-connections-with-ai-one-lunch-at-a-time-a3df58c0a7ed) -- Lunchclub Blog
- [Focusmate: How It Works](https://www.focusmate.com/how-it-works/) -- Focusmate
- [How Focusmate Boosts Productivity](https://www.nocode.mba/interviews/how-focusmate-is-boosting-productivity-with-virtual-coworking) -- NoCode MBA
- [How to Get People to Show Up to Your Events](https://www.meetup.com/blog/how-to-get-people-to-show-up-to-your-events/) -- Meetup Blog

### Retention & Engagement
- [The Psychology Behind Duolingo's Streak Feature](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature) -- Just Another PM
- [The Psychology of Hot Streak Game Design](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame) -- UX Magazine
- [Duolingo's Gamification Secrets: Streaks & XP Boost Engagement by 60%](https://www.orizon.co/blog/duolingos-gamification-secrets) -- Orizon
- [The Secret Behind Duolingo Streaks](https://darewell.co/en/duolingo-streaks-retention-secret/) -- Darewell
- [Duolingo Streak System Detailed Breakdown](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f) -- Premjit Singha, Medium
- [Creating Growth and Retention Loops with Community Engagement](https://www.likeminds.community/blog/creating-growth-and-retention-loops-with-community-engagement-an-in-depth-analysis) -- LikeMinds
- [Increase App Retention 2026: Benchmarks, Strategies & Examples](https://www.pushwoosh.com/blog/increase-user-retention-rate/) -- Pushwoosh

### Two-Sided Marketplace
- [Solving the Marketplace Cold-Start Problem](https://www.davidciccarelli.com/articles/product-marketing-playbook-for-two-sided-platforms/) -- David Ciccarelli
- [Andrew Chen on Marketplaces](https://stripe.com/guides/atlas/andrew-chen-marketplaces) -- Stripe Atlas
- [Beat the Cold Start Problem in a Marketplace](https://www.reforge.com/guides/beat-the-cold-start-problem-in-a-marketplace) -- Reforge
- [The Atomic Network](https://www.lennysnewsletter.com/p/atomic-network) -- Lenny Rachitsky
- [A Primer on Network Effects from The Cold Start Problem](https://www.sachinrekhi.com/p/andrew-chen-the-cold-start-problem) -- Sachin Rekhi
- [WTF is Marketplace Liquidity?](https://medium.com/point-nine-news/wtf-is-marketplace-liquidity-f2caca3802c0) -- Point Nine
- [Marketplace Metrics: 26 Key Metrics](https://www.sharetribe.com/academy/measure-your-success-key-marketplace-metrics/) -- Sharetribe
- [Two-Sided Marketplace Strategy](https://stripe.com/resources/more/two-sided-marketplace-strategy) -- Stripe

### Trust & Safety
- [Bumble Safety Features](https://support.bumble.com/hc/en-us/articles/28537051467293-Our-safety-features) -- Bumble Support
- [Bumble Heightens Safety with ID Verification](https://techcrunch.com/2025/03/17/bumble-heightens-safety-measures-with-new-id-verification-feature/) -- TechCrunch
- [Bumble Photo Verification](https://bumble.com/en/the-buzz/request-verification) -- Bumble
- [OfferUp Trust & Safety Commitment](https://about.offerup.com/trust-safety-commitment) -- OfferUp

### Gamification
- [10 Examples of Badges in Gamification](https://trophy.so/blog/badges-feature-gamification-examples) -- Trophy
- [The Psychology of Streaks: How Sylvi Weaponized Duolingo's Best Feature](https://trophy.so/blog/the-psychology-of-streaks-how-sylvi-weaponized-duolingos-best-feature-against-them) -- Trophy
- [Benefits of Points, Badges, Levels, and Engagement Loops](https://thrico.com/blog/benefits-of-points-badges-levels-and-engagement-loops/) -- Thrico
- [The Application of Gamification in Community Badge Design](https://www.gamedeveloper.com/design/the-application-of-gamification-in-community-badge-design) -- Game Developer
- [User Retention Gamification Examples](https://strivecloud.io/blog/user-retention-examples/) -- StriveCloud
- [Gamification for Online Communities](https://www.higherlogic.com/blog/gamification-in-online-communities/) -- Higher Logic

### Metrics & KPIs
- [Marketplace Metrics: 26 Key Metrics](https://www.sharetribe.com/academy/measure-your-success-key-marketplace-metrics/) -- Sharetribe
- [10 Marketplace KPIs for VC-Backed Companies](https://www.phoenixstrategy.group/blog/10-marketplace-kpis-for-vc-backed-companies) -- Phoenix Strategy Group
- [Key Metrics for Marketplaces Cheat Sheet](https://medium.com/samaipata-ventures/cheat-sheet-1-key-kpis-to-track-for-marketplaces-75827d9fc0a8) -- Samaipata Ventures
- [Measuring Community Success: What Metrics Matter](https://www.asaecenter.org/resources/articles/an_plus/2025/08-august/measuring-community-success-what-metrics-matter-and-why) -- ASAE
- [14 Metrics for Marketplace Success](https://meetmarkko.com/knowledge/14-metrics-for-marketplace-success/) -- Markko
- [Why Liquidity Should Be a Burning Priority](https://www.cobbleweb.co.uk/measure-grow-marketplace-liquidity/) -- Cobbleweb
- [Marketplace Liquidity](https://techcrunch.com/2017/07/11/marketplace-liquidity/) -- TechCrunch
