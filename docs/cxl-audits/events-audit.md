# CXL Audit: Events Page
## Date: 2026-03-14
## Skill(s) Used: /cxl:optimize, /cxl:copy
## Conversion Goal: Browse → Book (RSVP to a session)

## Heuristic Scores (Before)

| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Relevance | 4 | Good filters (neighborhood, format, women-only), default neighborhood from profile |
| Clarity | 3 | Event cards are dense — title, date, venue, badges, vibe, spots, avatars, circle, CTA all compete |
| Value | 2 | RSVP CTA says "RSVP" (corporate jargon). Empty state is passive. No urgency on low-stock sessions. |
| Friction | 4 | One-tap RSVP, pull-to-refresh, map view, session request sheet. Good. |
| Distraction | 3 | Two filter rows (neighborhood + format) take visual space. View mode toggle adds cognitive load. |

**Overall Before: 16/25**

## Changes Made

| # | Change | File | Principle Applied |
|---|--------|------|-------------------|
| 1 | CTA: "RSVP" → "I'm in" | EventCard.tsx | Conversational Tone, Lower Commitment |
| 2 | CTA variant: outline → default (filled) for non-RSVP'd users | EventCard.tsx | Von Restorff, CTA Prominence |
| 3 | Confirmed state: "Going ✓" → "You're in" | EventCard.tsx | Endowment Effect |
| 4 | Waitlist: "Join Waitlist" → "Get on the waitlist" | EventCard.tsx | Conversational Tone |
| 5 | Spots: show "Only X left" when >60% full (truthful) | EventCard.tsx | Truthful Scarcity |
| 6 | Low attendance: "needs more people" → "Bring a friend and make this session happen" | EventCard.tsx | Positive Framing, Agency |
| 7 | Empty state (upcoming): "No upcoming sessions" → "No sessions near you yet" + "Request one below — we'll match you" | index.tsx | Loss Aversion, Next Step |
| 8 | Empty state (past): "No past sessions yet" → "You haven't been to a session yet" | index.tsx | Loss Aversion |
| 9 | Feedback: "How was {title}?" → "How was your session at {title}?" | FeedbackCard.tsx | Endowment Effect |
| 10 | "I didn't attend" → "I wasn't there" | FeedbackCard.tsx | Conversational Tone |

## Heuristic Scores (After)

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Relevance | 4 | 4 | 0 |
| Clarity | 3 | 4 | +1 |
| Value | 2 | 4 | +2 |
| Friction | 4 | 4 | 0 |
| Distraction | 3 | 3 | 0 |

**Overall After: 19/25 (from 16/25, +3 points)**

## A/B Test Hypotheses (for future validation)

1. **Because we observed** the RSVP CTA used corporate jargon ("RSVP") with low visual weight (outline), **we believe** "I'm in" with a filled button **will result in** higher RSVP rate per event card view, **as measured by** RSVP click-through rate.

2. **Because we observed** spots indicators were neutral even when sessions were filling up, **we believe** "Only X left" for sessions >60% full **will result in** faster RSVP decisions, **as measured by** time-to-RSVP and RSVP rate for high-occupancy sessions.

3. **Because we observed** the low-attendance warning focused on the problem ("needs more people"), **we believe** "Bring a friend and make this session happen" **will result in** higher invite sharing rate, **as measured by** share-link clicks from low-attendance event cards.

## Verification

- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] Vite build succeeds (`npm run build`)
- [x] All existing functionality preserved
