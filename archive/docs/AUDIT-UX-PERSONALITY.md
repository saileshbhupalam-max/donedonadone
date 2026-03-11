# UX & Personality Coverage Audit

**Audited:** 2026-03-09 | **Codebase:** focusclub-find-your-people

## Critical Finding: Most personality constants are DEAD CODE

personality.ts defines rich constants but the vast majority are never imported or used:

### Never Used At All
- `COMMUNITY_LANG` — term mapping dictionary never imported
- `CELEBRATIONS` — streak/milestone copy never used (components hardcode own strings)
- `ONBOARDING` — full conversation flow never imported (steps hardcode copy)
- `NOTIFICATION_COPY` — 11 notification templates never used
- `REFRESH_MESSAGES` / `getRefreshMessage()` — never shown
- `checkEasterEgg()` — never called
- `getCareSignal()` — never called
- `PAGE_TITLES` — never imported (pages hardcode identical strings)

### Barely Used (1-2 places, mostly inline duplication)
- `ERROR_STATES` — only used in NotFound.tsx (1 constant out of 9)
- `EMPTY_STATES` — copy appears inline but not imported as constants
- `CONFIRMATIONS` — matching text appears inline but not imported
- `getLoadingMessage()` — imported in Home.tsx but never rendered

## Community Language Violations — 17+ instances of "event/events"

### HIGH severity (prominent, user-facing):
- Index.tsx:26 — "Meetups & Events" (landing page!)
- EventDetail.tsx:70,171,172,173 — "Event not found", "Back to Events"
- Events.tsx:656 — "All Events" filter chip
- ProfileView.tsx:263 — "{count} events"

### MEDIUM severity:
- Events.tsx:268,370 — "Failed to create event", "Women-only event"
- Events.tsx:687 — "No past events yet"
- Session.tsx:305 — "This event doesn't have..."
- Partners.tsx:80 — "events hosted"
- GivePropsFlow.tsx:285,289 — "attend an event", "event(s)"

## Loading States — BIGGEST PERSONALITY GAP

No page uses personality loading messages. All 10 authenticated pages render silent Skeleton blocks. The 7 rotating loading messages in personality.ts never appear to any user.

## Error Toasts — ALL GENERIC

Every error toast uses developer-style text ("Something went wrong", "Failed to...") instead of ERROR_STATES constants. **SECURITY ISSUE:** Profile.tsx:304 exposes raw error.message to users.

## Success Toasts — MIXED

Some great personality ("Locked in. Now go make it happen.") but many generic ("Props sent!", "Photo saved!") that should use CONFIRMATIONS constants.

## Missing Page Titles
- Admin.tsx — no usePageTitle call
- Onboarding.tsx — no usePageTitle call
- NotFound.tsx — no usePageTitle call

## Greeting Context — Incomplete
getContextualGreeting() is used but `isFirstVisit`, `afterFirstSession`, `daysSinceActive`, `monthsAsMember` are never passed, making 3 special greetings unreachable.
