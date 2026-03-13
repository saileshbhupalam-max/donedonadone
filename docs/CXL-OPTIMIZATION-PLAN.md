# CXL Optimization Plan — donedonadone

> Systematic conversion optimization of every user-facing page and flow using the CXL ResearchXL framework. Each step produces a dated, auditable artifact in `docs/cxl-audits/`.

## Methodology

Every optimization follows this cycle:

```
AUDIT → DIAGNOSE → PRIORITIZE → IMPLEMENT → VERIFY → DOCUMENT
```

**Audit**: Run `/cxl:audit` or `/cxl:optimize` on the target. Score all 5 heuristic dimensions.
**Diagnose**: Identify specific violations of CXL principles (not vague "could be better").
**Prioritize**: Score each fix with PXL framework (binary, data-driven, not subjective).
**Implement**: Apply changes. Preserve all existing functionality.
**Verify**: Type check + build passes. Visual review. E2E tests pass.
**Document**: Write audit artifact to `docs/cxl-audits/[page]-audit.md` with before/after, principles applied, and expected impact.

---

## Priority Matrix

Ordered by conversion impact × traffic volume. Every user hits tiers 1-2. Tiers 3-4 are conditional.

### Tier 1 — Every User Sees This (Do First)

| # | Page/Flow | CXL Skill | Conversion Goal | Impact |
|---|-----------|-----------|-----------------|--------|
| 1 | **Landing Page** (`Index.tsx`) | `/cxl:landing-page` | Visitor → Sign-up | DONE |
| 2 | **Onboarding Flow** (4 steps) | `/cxl:onboarding` + `/cxl:forms` | Sign-up → Activated member | DONE |
| 3 | **Home Dashboard** (`Home/index.tsx`) | `/cxl:optimize` + `/cxl:copy` | Activated → First session booked | DONE |

### Tier 2 — Core Loop (Session Booking → Attendance → Retention)

| # | Page/Flow | CXL Skill | Conversion Goal | Impact |
|---|-----------|-----------|-----------------|--------|
| 4 | **Session Request Sheet** | `/cxl:forms` + `/cxl:copy` | Intent → Session booked | DONE |
| 5 | **Events Page** (`Events/index.tsx`) | `/cxl:optimize` | Browse → Book | DONE |
| 6 | **Session Page** (live + wrap-up) | `/cxl:optimize` | Attend → Give feedback + props | DONE |
| 7 | **Discover Page** (`Discover.tsx`) | `/cxl:optimize` + `/cxl:copy` | Browse → Connect/Request | DONE |

### Tier 3 — Revenue & Growth

| # | Page/Flow | CXL Skill | Conversion Goal | Impact |
|---|-----------|-----------|-----------------|--------|
| 8 | **Pricing Page** (`Pricing.tsx`) | `/cxl:pricing` | Free → Paid tier | DONE |
| 9 | **Profile Page** (edit mode) | `/cxl:forms` + `/cxl:onboarding` | Incomplete → Complete profile | MEDIUM |
| 10 | **Invite/Referral Flow** | `/cxl:copy` | Member → Inviter | HIGH (growth) |
| 11 | **Nominate Venue** (`NominateVenue.tsx`) | `/cxl:forms` | Member → Venue nominator | MEDIUM |

### Tier 4 — Partner & Company Flows

| # | Page/Flow | CXL Skill | Conversion Goal | Impact |
|---|-----------|-----------|-----------------|--------|
| 12 | **Partner Apply** (`PartnerApply.tsx`) | `/cxl:forms` + `/cxl:landing-page` | Venue → Partner application | MEDIUM |
| 13 | **Company Create** (`CompanyCreate.tsx`) | `/cxl:forms` | Member → Company creator | LOW |
| 14 | **Needs Page** (`Needs.tsx`) | `/cxl:copy` + `/cxl:optimize` | Browse → Create/respond to need | LOW |
| 15 | **Public Pages** (SpaceInsights, SpaceLive) | `/cxl:optimize` | Visitor → Sign-up | LOW |

---

## Execution Plan

### Phase 0: Landing Page [COMPLETE]
- **Status**: Done
- **Skill used**: `/cxl:landing-page` + `/frontend-design:frontend-design`
- **Changes**: Full redesign with Z-pattern hero, loss-framed copy, Von Restorff CTA, social proof near CTA, 3-step explainer, trust signals, dark warm aesthetic
- **Audit artifact**: To be written retroactively

### Phase 1: Onboarding Flow [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:onboarding`, `/cxl:forms`, `/cxl:copy`
- **Changes**: Removed 2 premature fields (tagline, what_i_do) via progressive profiling. Reordered Step 2 (work_vibe→neighborhood→gender). Step-specific CTAs. Contextual progress labels. All copy rewritten for benefit-framing. De-slugified neighborhood in preview. 30% field reduction → expected +15-30% completion rate increase.
- **Audit artifact**: `docs/cxl-audits/onboarding-audit.md`

### Phase 2: Home Dashboard [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:optimize`, `/cxl:copy`
- **Changes**: Moved PrimaryActionCard from position #9 to #2 (serial position). Loss-framed empty states ("You haven't booked yet this week"). Benefit-framed profile completion ("Members with complete profiles get better matches"). Urgency labels for suggested events. Pushed growth/gamification cards below primary action.
- **Audit artifact**: `docs/cxl-audits/home-audit.md`

### Phase 3: Session Request Flow [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:forms`, `/cxl:copy`
- **Changes**: Pre-filled neighborhood from profile (smart default). Conversational labels ("When works for you?" not "Preferred Days"). Benefit-oriented CTA ("Find my table"). Positive trigger framing. Friction reducer near CTA. Removed asterisk form anxiety.
- **Audit artifact**: `docs/cxl-audits/session-request-audit.md`

### Phase 4: Events Page [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:optimize`, `/cxl:copy`
- **Changes**: CTA "RSVP" → "I'm in" (conversational, lower commitment). Filled button for non-RSVP'd (Von Restorff). "Going ✓" → "You're in" (endowment). Truthful scarcity "Only X left" at >60% capacity. Low-attendance reframed from problem → agency ("Bring a friend and make this happen"). Loss-framed empty states. Feedback prompt uses endowment ("your session").
- **Audit artifact**: `docs/cxl-audits/events-audit.md`

### Phase 5: Session Page (Live + Wrap-up) [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:optimize`, `/cxl:copy`
- **Changes**: Pre-start "Ready to start?" → "Your table is ready" (endowment). "Start Session" → "Let's go" (conversational). Intention "Set your intention" → "What's your one thing for today?" (Zeigarnik + specificity). "Lock it in" CTA (commitment). Quick feedback "How was the session?" → "How was your session?" (endowment). "Submit & Go" → "Done" (fluency). Post-submit copy reframed from company-centric to user-agency.
- **Audit artifact**: `docs/cxl-audits/session-audit.md`

### Phase 6: Discover Page [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:optimize`, `/cxl:copy`
- **Changes**: Subtitle → "Find people to work with" (specificity). "People working right now" (urgency). Connections empty state adds next step ("attend a session"). DNA prompt benefit-framed. "Start matching" CTA. Venue nomination → "Suggest a spot" (lower commitment).
- **Audit artifact**: `docs/cxl-audits/discover-audit.md`

### Phase 7: Pricing Page [COMPLETE]
- **Status**: Done
- **Skills used**: `/cxl:pricing`
- **Changes**: "Choose your plan" → "Find the right fit" (personalization). "Upgrade" → "Get [Tier Name]" (specificity + endowment). Added "Cancel anytime" risk reversal below CTA. Subtitle reframed from feature-speak to benefit. Session Boost positive framing.
- **Audit artifact**: `docs/cxl-audits/pricing-audit.md`

### Phase 8: Profile Page
- **Target files**: `src/pages/Profile/index.tsx`
- **Skills**: `/cxl:forms`, `/cxl:onboarding`
- **Goals**:
  - Progressive profiling: show completion % ("Your profile is 70% complete")
  - Zeigarnik effect: highlight what's missing
  - Endowment effect: show how their profile looks to others
  - Social proof: "Members with complete profiles get 3x more matches"
- **Audit steps**:
  1. `/cxl:forms` — Audit profile fields
  2. `/cxl:onboarding` — Treat profile completion as micro-onboarding
  3. Implement changes
  4. Write `docs/cxl-audits/profile-audit.md`

### Phase 9: Invite/Referral Flow
- **Target files**: Profile invite section, referral link components
- **Skills**: `/cxl:copy`
- **Goals**:
  - Loss-framed invite copy: "Your friend is working alone. Fix that."
  - Specific social proof: "Members who invite get 2x more session variety"
  - Easy share mechanics (one-tap copy, native share API)
  - Reciprocity: referrer gets credits, invitee gets welcome
- **Audit steps**:
  1. `/cxl:copy` — Rewrite all invite copy
  2. Implement changes
  3. Write `docs/cxl-audits/referral-audit.md`

### Phase 10: Venue Nomination + Partner Apply
- **Target files**: `NominateVenue.tsx`, `PartnerApply.tsx`
- **Skills**: `/cxl:forms`, `/cxl:copy`
- **Goals**:
  - Nomination: minimize fields, show community impact ("You're helping X members")
  - Partner apply: B2B form — strategic friction OK here (qualifies leads)
  - Social proof: "47 venues already partner with us"
- **Audit steps**:
  1. `/cxl:forms` — Audit both forms
  2. `/cxl:copy` — Rewrite CTAs and supporting copy
  3. Implement changes
  4. Write `docs/cxl-audits/venue-forms-audit.md`

### Phase 11: Public Pages (SpaceInsights, SpaceLive)
- **Target files**: `SpaceInsights.tsx`, `SpaceLive.tsx`
- **Skills**: `/cxl:optimize`, `/cxl:landing-page`
- **Goals**:
  - These are public entry points — should funnel visitors to sign-up
  - CTA: "Join the community at [Venue Name]"
  - Social proof: session activity, member count
  - Authority: venue verification badge
- **Audit steps**:
  1. `/cxl:optimize` — Audit as acquisition pages
  2. Implement CTA and social proof additions
  3. Write `docs/cxl-audits/public-pages-audit.md`

### Phase 12: Cross-Cutting Copy Audit
- **Target**: All error messages, empty states, loading states, toast messages, microcopy
- **Skills**: `/cxl:copy`
- **Goals**:
  - Every error message: specific + actionable
  - Every empty state: show value + next step
  - Every loading state: brand personality
  - Every success state: celebrate + next action
  - Every CTA: action verb + value
- **Audit steps**:
  1. `/cxl:copy` — Audit all microcopy patterns
  2. Implement changes across components
  3. Write `docs/cxl-audits/microcopy-audit.md`

---

## Audit Artifact Format

Every phase produces a file at `docs/cxl-audits/[name]-audit.md` with this structure:

```markdown
# CXL Audit: [Page/Flow Name]
## Date: YYYY-MM-DD
## Skill(s) Used: /cxl:[skill]
## Conversion Goal: [specific goal]

## Heuristic Scores (Before)
| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Relevance | | |
| Clarity   | | |
| Value     | | |
| Friction  | | |
| Distraction | | |

## Issues Found
### [Issue 1 - Specific description]
- **Principle violated**: [CXL principle name]
- **Current state**: [what it looks like now]
- **PXL Score**: [0-5]
- **Recommendation**: [specific change]

### [Issue 2] ...

## Changes Made
| # | Change | File | Line | Principle Applied |
|---|--------|------|------|-------------------|
| 1 | Changed CTA from "X" to "Y" | path.tsx | 42 | Von Restorff + CTA copy |
| 2 | ... | | | |

## Heuristic Scores (After)
| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Relevance | | | |
| Clarity   | | | |
| Value     | | | |
| Friction  | | | |
| Distraction | | | |

## A/B Test Hypotheses (for future validation)
1. Because we observed [X], we believe [change] will result in [Y], as measured by [Z].
2. ...

## Verification
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Vite build succeeds (`npm run build`)
- [ ] E2E tests pass (if applicable)
- [ ] Visual review on mobile (375px)
- [ ] Visual review on desktop (1440px)
- [ ] All existing functionality preserved
```

---

## Success Metrics

Track these before and after the full optimization:

| Metric | Measures | Baseline | Target |
|--------|----------|----------|--------|
| Landing → Sign-up rate | Phase 0 (Landing) | TBD | +30% |
| Onboarding completion rate | Phase 1 (Onboarding) | TBD | +20% |
| Time to first session | Phases 1-4 | TBD | -40% |
| Sessions booked / active member / week | Phases 2-5 | TBD | +25% |
| Free → Paid conversion | Phase 7 (Pricing) | TBD | +15% |
| Referral rate (invites sent / member) | Phase 9 (Referral) | TBD | +50% |
| Profile completion rate | Phase 8 (Profile) | TBD | +25% |
| Post-session feedback completion | Phase 5 (Session) | TBD | +30% |

---

## Skill Integrity Checklist

Each CXL skill must enforce:

- [ ] **No shallow analysis**: Every recommendation must cite a specific CXL principle + explain WHY it applies
- [ ] **No vague suggestions**: "Improve the headline" is not allowed. "Change headline from X to Y because [principle]" is required
- [ ] **Quantifiable where possible**: Include expected impact or reference CXL research data
- [ ] **PXL scoring**: Every recommendation gets a PXL priority score (binary, not subjective)
- [ ] **Before/after**: Every audit shows the state before AND after changes
- [ ] **Preservation check**: Verify all existing functionality still works
- [ ] **Build verification**: TypeScript + Vite build must pass after every phase

---

## Execution Notes

- **Do not optimize pages in isolation**: Changes to the landing page affect onboarding expectations. Changes to onboarding affect Home page expectations. Maintain message match across the funnel.
- **One phase at a time**: Complete the audit cycle fully before moving to the next phase. Half-done optimization is worse than none.
- **Dark patterns are forbidden**: No fake scarcity, no fake urgency, no manipulative countdown timers. All social proof must use real data. All scarcity must reflect actual availability.
- **Mobile-first**: Every change must be designed for mobile first, then enhanced for desktop. 60%+ of traffic will be mobile.
- **Accessibility is conversion**: WCAG AA compliance is not optional. Accessible = more users = more conversions.
