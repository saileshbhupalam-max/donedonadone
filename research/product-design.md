# Product Design Research: UX Patterns & Best Practices

## 1. Onboarding Best Practices

### Quiz Length
- **Optimal: 5-8 questions** for completion rates >80%
- 10+ questions drops completion to ~60%
- **Recommendation**: Keep our 10 questions BUT make it feel like 6 by grouping:
  - Screen 1: Work type + industry (2 questions, 1 screen)
  - Screen 2: Work vibe (1 question)
  - Screen 3: Noise + breaks (2 questions, 1 screen)
  - Screen 4: Productivity times (1 question)
  - Screen 5: Social goals (1 question)
  - Screen 6: Personality + communication (2 questions, 1 screen)
  - Screen 7: Free-text bio (optional)
- Show "Step 3 of 7" not "Question 5 of 10"

### Making It Fun (Hinge/Bumble BFF Pattern)
- Large, tappable visual cards (not radio buttons)
- Emoji + short label + description for each option
- Playful microcopy between steps ("Almost there!", "Great taste!")
- Smooth slide transitions (Framer Motion)
- Skip option on every screen (fill in later)
- **Progressive profiling**: Let users skip quiz entirely and fill in after first session

### Key Pattern: The "Reveal" Moment
- After quiz completion, show a "Coworker Card" preview
- "Here's how others will see you" — creates investment
- Similar to Hinge profile preview or LinkedIn profile strength meter

## 2. Booking UX Patterns

### ClassPass/Cultfit Model (Best fit for us)
- Date strip at top (horizontal scrollable pills for next 7 days)
- Filter chips below (time, duration, area)
- Vertical list of session cards
- Each card: venue photo, time, spots left, price, CTA
- Urgency via spots indicator: "4 spots left" in amber
- Bottom sheet for booking confirmation (not a new page)

### Ethical Scarcity Indicators
- Show actual spots remaining (not fake urgency)
- Color coding: green (>5 spots), amber (2-5), red (1), gray (full)
- "Join waitlist" when full — creates FOMO without dishonesty
- "X people viewing" — only show if actually true (Supabase Realtime)

### Mobile-First Booking Flow
1. Tap "Book Seat" on card
2. Bottom sheet slides up with venue details + price breakdown
3. UPI QR code or "Pay Now" button
4. Confirmation with confetti animation
5. "Add to Calendar" + "Share with friend"
- **Total: 3 taps from discovery to booked**

## 3. Group/Matching UX

### Group Reveal (Key Differentiator)
Pattern from dating apps adapted for coworking:
- **Countdown timer**: "Your group reveals in 2h 34m"
- **Silhouette tease**: Show number of group members as gray silhouettes
- **Reveal animation**: Cards flip to show profiles one by one
- This creates anticipation and excitement — not just a notification

### Making Strangers Comfortable (Trust Patterns)
- First names only (no last names until they meet)
- Verified profiles (email + phone verified badge)
- Trait badges: "Deep Focus", "Chatty", "Morning Person"
- Shared interests highlighted: "You both prefer ambient noise"
- Icebreaker prompt: "Ask Priya about her design studio"
- Post-session: "Would you cowork with them again?" (builds trust signal)

### Matching Algorithm Display
- Don't show match scores (feels too algorithmic)
- DO show compatibility reasons: "Matched on: work style, noise preference"
- This makes the matching feel intentional, not random

## 4. Retention Mechanics

### What Makes People Come Back (Community Platform Research)
1. **Social obligation**: "Your group is counting on you" (after booking)
2. **Streak tracking**: "5 sessions in a row" (habit formation)
3. **Familiar faces**: Option to "rebook with same group" (relationship building)
4. **Discovery**: New venues, new people each time (novelty)
5. **Weekly rhythm**: "Your Tuesday 10AM slot is available" (ritual)

### Post-Session Loop (Critical)
```
Session ends → Rating prompt (in-app) → "Would cowork again?" per member →
"Your next session" suggestion → "Share your session" card →
Next day: "Weekly digest" email with upcoming sessions
```

### Referral Mechanic
- "Invite a friend" → both get ₹100 off next session
- Shareable session card for Instagram Stories
- "Cowork streak" shareable badge

## 5. Two-Sided Marketplace Design

### Chicken-and-Egg Strategy (Supply First)
1. Sign 5-10 venues BEFORE launching to users
2. Guarantee venues minimum bookings for first month (subsidize if needed)
3. Show "venues love donedonadone" social proof to attract more venues

### Venue Value Proposition
- "Fill empty seats during off-peak hours"
- "Get reliable, paying customers who order food/drinks"
- "Zero cost to join — we bring the customers"
- Show transparent earnings dashboard
- Weekly payouts build trust

## 6. Trust & Safety

### For In-Person Meetups
- Phone number verification (mandatory)
- Google account verification (optional but encouraged)
- Emergency contact option in profile settings
- Check-in system (so people know you arrived)
- Rating system (flag inappropriate behavior)
- Clear community guidelines displayed during onboarding

### Bad Actor Prevention
- Minimum 1 review needed to be auto-grouped (first session is curated)
- Two "would not cowork again" ratings → manual review
- Report button in group view → admin review
- Cancel rate tracking → high cancellers deprioritized in matching

## 7. Gamification (Light Touch)

### Do
- Session count badges: "First Session", "10 Sessions", "50 Sessions"
- "People Met" counter — feels social, not gamified
- "Venues Explored" counter — encourages trying new places
- Streak indicator on profile (subtle)

### Don't
- Points/XP systems (feels forced for coworking)
- Leaderboards (creates competition, not community)
- Excessive notifications (destroys trust)

## 8. Mobile-First Design Patterns

### Bottom Navigation (4 tabs)
- Home (dashboard) | Sessions (browse) | Bookings (my sessions) | Profile

### Card-Based Browsing
- Session cards: venue photo left, details right (compact)
- Swipeable date pills at top
- Pull-to-refresh for latest availability

### Touch Targets
- Minimum 44px tap targets
- Generous padding between interactive elements
- Swipe gestures for common actions (swipe to cancel booking)
