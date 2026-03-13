# CXL Audit: Home Dashboard
## Date: 2026-03-14
## Skill(s) Used: /cxl:optimize, /cxl:copy
## Conversion Goal: Activated member -> First session booked

## Heuristic Scores (Before)

| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Relevance | 3 | Many sections are relevant but fight for attention equally |
| Clarity | 2 | 30+ cards on one page. Primary action (book a session) buried at position #9 behind 7 growth/gamification cards |
| Value | 3 | Good content (sessions, matches, circle, streaks) but no clear hierarchy of value |
| Friction | 3 | Easy to tap cards but hard to FIND the right card to tap |
| Distraction | 1 | Everything competes equally. Credits, growth nudges, neighborhood leaderboard, company card, milestone celebration ALL appear before "what should I do now?" |

**Overall Before: 12/25**

## Issues Found

### 1. Primary Action Card buried at position #9
- **Principle violated**: Serial Position Effect, Hick's Law
- **Current state**: PrimaryActionCard (the most important card — "What should I do right now?") appears AFTER Credits Badge, Growth Nudge, Contribution Milestone, Company Card, Neighborhood Unlock, Neighborhood Leaderboard, and Milestone Celebration. A new user sees 7 growth/gamification cards before seeing what to do next.
- **PXL Score**: 5 (above fold, all users, noticeable, adds/removes elements, independent)
- **Recommendation**: Move PrimaryActionCard to position #2, immediately after the greeting. Growth and gamification cards go below.

### 2. Empty state is neutral, not loss-framed
- **Principle violated**: Loss Aversion
- **Current state**: "No sessions on the board" + "Browse sessions ->" — neutral, descriptive, no urgency.
- **PXL Score**: 5 (all users without bookings, above fold)
- **Recommendation**: "You haven't booked yet this week" + "Find your table ->" — loss-framed (you're missing out) + benefit-oriented CTA.

### 3. Profile completion uses humor instead of social proof
- **Principle violated**: Social Proof, Benefit Framing
- **Current state**: "Your profile is... a work in progress. Like all great art." — cute but doesn't motivate action.
- **PXL Score**: 4 (users with < 80% completion, noticeable)
- **Recommendation**: "Members with complete profiles get better matches" — social proof + benefit framing. Tells user WHY they should complete it.

### 4. Suggested event uses generic "Upcoming" label
- **Principle violated**: Loss Aversion, Urgency
- **Current state**: When showing an event the user hasn't RSVP'd to: "Upcoming" label.
- **PXL Score**: 3 (conditional, users without RSVPs)
- **Recommendation**: "Don't miss this" — creates soft urgency without being manipulative.

### 5. "Find your next session" is company-centric
- **Principle violated**: Benefit Framing
- **Current state**: PrimaryActionCard shows "Find your next session" when there's an upcoming event.
- **PXL Score**: 3
- **Recommendation**: "Don't miss out" — loss-framed, user-centric.

### 6. "Community pulse" is generic
- **Principle violated**: Endowment Effect
- **Current state**: Section header "Community pulse" — clinical, distant.
- **PXL Score**: 2
- **Recommendation**: "Your community" — personal, endowment effect (this is YOUR community).

## Changes Made

| # | Change | File | Principle Applied |
|---|--------|------|-------------------|
| 1 | Moved PrimaryActionCard from position #9 to position #2 (right after greeting) | Home/index.tsx | Serial Position Effect, Hick's Law |
| 2 | Moved Milestone Celebration to position #3 (celebrate before growth cards) | Home/index.tsx | Variable Rewards, Emotional Peak |
| 3 | Pushed Credits, Growth Nudge, Contribution Milestone, Company Card below primary action | Home/index.tsx | Hick's Law (reduce competing elements above primary action) |
| 4 | Empty state: "No sessions on the board" -> "You haven't booked yet this week" | PrimaryActionCard.tsx, Home/index.tsx | Loss Aversion |
| 5 | CTA: "Browse sessions ->" -> "Find your table ->" | PrimaryActionCard.tsx, Home/index.tsx | Benefit Framing, Specificity |
| 6 | Event suggestion: "Find your next session" -> "Don't miss out" | PrimaryActionCard.tsx | Loss Aversion |
| 7 | Event label: "Upcoming" -> "Don't miss this" | Home/index.tsx | Urgency (truthful) |
| 8 | Profile: "work in progress. Like all great art." -> "Members with complete profiles get better matches" | Home/index.tsx | Social Proof, Benefit Framing |
| 9 | Section: "Community pulse" -> "Your community" | Home/index.tsx | Endowment Effect |

## Heuristic Scores (After)

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Relevance | 3 | 4 | +1 |
| Clarity | 2 | 4 | +2 |
| Value | 3 | 4 | +1 |
| Friction | 3 | 4 | +1 |
| Distraction | 1 | 3 | +2 |

**Overall After: 19/25 (from 12/25, +7 points)**

Note: The Home page still has 30+ sections. A deeper optimization pass would consolidate duplicate sections (e.g., PrimaryActionCard and Card 2 both show next meetup), move more cards into the "Show more" collapsible, and add a clear visual hierarchy with primary/secondary/tertiary card styles. This audit focused on the highest-impact changes with lowest risk.

## A/B Test Hypotheses (for future validation)

1. **Because we observed** the PrimaryActionCard was buried below 7 growth cards, **we believe** moving it to position #2 **will result in** higher session booking rate from the Home page, **as measured by** click-through rate on the primary action card.

2. **Because we observed** the empty state "No sessions on the board" was neutral, **we believe** "You haven't booked yet this week" (loss-framed) **will result in** higher click-through to the events page, **as measured by** navigation rate from Home to Events for users without bookings.

3. **Because we observed** the profile completion card used humor instead of social proof, **we believe** "Members with complete profiles get better matches" **will result in** higher profile completion rate, **as measured by** % of users clicking through to edit their profile.

## Verification

- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] Vite build succeeds (`npm run build`)
- [ ] Visual review on mobile (375px) — pending dev server check
- [ ] Visual review on desktop (1440px) — pending dev server check
- [x] All existing functionality preserved (all cards still render, same data, same navigation)
