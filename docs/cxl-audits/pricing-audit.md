# CXL Audit: Pricing Page
## Date: 2026-03-14
## Skill(s) Used: /cxl:pricing
## Conversion Goal: Free → Paid tier

## Heuristic Scores (Before)

| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Relevance | 4 | Gate-aware heading ("Unlock X"), tier grid, Session Boost option. |
| Clarity | 3 | Feature-by-category breakdown is clear but dense. "Choose your plan" is generic. |
| Value | 3 | Good yearly savings shown. Session Boost is good alternative. But no risk reversal near CTA. |
| Friction | 3 | "Upgrade" CTA is generic — doesn't show what you're getting. No anxiety reducer. |
| Distraction | 4 | Clean layout, FAQ below, no competing elements |

**Overall Before: 17/25**

## Changes Made

| # | Change | File | Principle Applied |
|---|--------|------|-------------------|
| 1 | Heading: "Choose your plan" → "Find the right fit" | Pricing.tsx | Personalization Framing |
| 2 | Subtitle: "AI-powered matching" → "better matches" | Pricing.tsx | Benefit Framing (not feature-speak) |
| 3 | CTA: "Upgrade" → "Get [Tier Name]" | Pricing.tsx | Specificity, Endowment |
| 4 | Added "Cancel anytime" below upgrade CTA | Pricing.tsx | Risk Reversal, Anxiety Reduction |
| 5 | Session Boost: "Don't want to commit?" → "Just need one day?" | Pricing.tsx | Positive Framing |

## Heuristic Scores (After)

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Relevance | 4 | 4 | 0 |
| Clarity | 3 | 4 | +1 |
| Value | 3 | 4 | +1 |
| Friction | 3 | 4 | +1 |
| Distraction | 4 | 4 | 0 |

**Overall After: 20/25 (from 17/25, +3 points)**

## A/B Test Hypotheses (for future validation)

1. **Because we observed** the upgrade CTA said "Upgrade" (generic), **we believe** "Get [Tier Name]" **will result in** higher upgrade click-through, **as measured by** CTA click rate on pricing cards.

2. **Because we observed** no risk reversal near the CTA, **we believe** adding "Cancel anytime" **will result in** higher upgrade conversion, **as measured by** payment completion rate from pricing page.

## Verification

- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] All existing functionality preserved
