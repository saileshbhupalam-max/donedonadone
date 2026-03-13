# CXL Audit: Discover Page
## Date: 2026-03-14
## Skill(s) Used: /cxl:optimize, /cxl:copy
## Conversion Goal: Browse → Connect/Request

## Heuristic Scores (Before)

| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Relevance | 4 | Two tabs (People/Companies), active locations, suggested connections, mentors. Rich. |
| Clarity | 3 | Subtitle "See who's around and find your people" is vague. DNA prompt is company-centric. |
| Value | 3 | Good match scores shown, but empty states don't motivate action |
| Friction | 4 | One-tap connect, search + filter on companies. Low friction. |
| Distraction | 3 | Multiple sections compete — locations, suggestions, mentors, connections, venue nomination |

**Overall Before: 17/25**

## Changes Made

| # | Change | File | Principle Applied |
|---|--------|------|-------------------|
| 1 | Subtitle: "See who's around and find your people" → "Find people to work with" | Discover.tsx | Specificity, Action-Oriented |
| 2 | Section: "Where people are working" → "People working right now" | Discover.tsx | Urgency (truthful), FOMO |
| 3 | Connections empty: "will appear here as you meet people" → "No connections yet — attend a session to start building your circle" | Discover.tsx | Loss Aversion, Next Step |
| 4 | DNA prompt: "Complete your Work DNA to get connection suggestions" → "Better matches start with your Work DNA" | Discover.tsx | Benefit Framing |
| 5 | DNA CTA: "Build your DNA" → "Start matching" | Discover.tsx | Benefit-Oriented CTA |
| 6 | Venue: "Know a great work spot? Nominate it for the community" → "Know a great cafe to work from? Help others discover it" | Discover.tsx | Specificity, Social Impact |
| 7 | Venue CTA: "Nominate a Venue" → "Suggest a spot" | Discover.tsx | Lower Commitment, Conversational |

## Heuristic Scores (After)

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Relevance | 4 | 4 | 0 |
| Clarity | 3 | 4 | +1 |
| Value | 3 | 4 | +1 |
| Friction | 4 | 4 | 0 |
| Distraction | 3 | 3 | 0 |

**Overall After: 19/25 (from 17/25, +2 points)**

## Verification

- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] All existing functionality preserved
