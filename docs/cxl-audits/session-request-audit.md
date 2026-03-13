# CXL Audit: Session Request Sheet
## Date: 2026-03-14
## Skill(s) Used: /cxl:forms, /cxl:copy
## Conversion Goal: Intent -> Session booked (request submitted)

## Heuristic Scores (Before)

| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Relevance | 3 | Fields match the need but labels are form-like, not conversational |
| Clarity | 3 | Clear fields but sheet title "Request a Session" is generic |
| Value | 2 | Trigger "Can't find a session?" frames failure. CTA "Submit Request" is generic. |
| Friction | 3 | 5 fields but neighborhood not pre-filled from profile. Asterisk adds form anxiety. |
| Distraction | 4 | Clean bottom sheet, focused form. Good. |

**Overall Before: 15/25**

## Changes Made

| # | Change | File | Principle Applied |
|---|--------|------|-------------------|
| 1 | Pre-fill neighborhood from profile | SessionRequestSheet.tsx | Smart Defaults (reduce fields) |
| 2 | Trigger: "Can't find a session?" -> "Want a session on your schedule?" | SessionRequestSheet.tsx | Positive Framing |
| 3 | Trigger CTA: "Request a Session ->" -> "Tell us when ->" | SessionRequestSheet.tsx | Lower Commitment, Conversational |
| 4 | Sheet title: "Request a Session" -> "When do you want to cowork?" | SessionRequestSheet.tsx | Benefit Framing |
| 5 | Labels: "Preferred Days" -> "When works for you?", "Preferred Time" -> "What time of day?" | SessionRequestSheet.tsx | Conversational Tone |
| 6 | Removed asterisk from "Neighborhood *" -> "Where?" | SessionRequestSheet.tsx | Reduced Form Anxiety |
| 7 | CTA: "Submit Request" -> "Find my table" | SessionRequestSheet.tsx | Benefit-Oriented CTA |
| 8 | Submitting state: "Submitting..." -> "Matching you..." | SessionRequestSheet.tsx | Anticipation, Value |
| 9 | Added friction reducer: "We'll match you when enough people want the same slot" | SessionRequestSheet.tsx | Anxiety Reduction |

## Heuristic Scores (After)

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Relevance | 3 | 4 | +1 |
| Clarity | 3 | 5 | +2 |
| Value | 2 | 4 | +2 |
| Friction | 3 | 5 | +2 |
| Distraction | 4 | 5 | +1 |

**Overall After: 23/25 (from 15/25, +8 points)**

## Verification

- [x] TypeScript compiles
- [x] Vite build succeeds
- [x] All existing functionality preserved
