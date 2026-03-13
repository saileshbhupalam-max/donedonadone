# CLAUDE.md — LLM Context for FocusClub Codebase

> This file is the **first thing any LLM should read** when working on this project.
> It exists to overcome the context-window limitations of vibe-coding tools.
> When in doubt, **overcommunicate**. Write as if the next developer is an LLM
> that has never seen this codebase before.

## Project Identity

**FocusClub** is a social coworking platform that matches solo workers into groups
of 3-5 at cafes/coworking spaces. Launching in HSR Layout, Bangalore. Target: 1000
bookings/day. The platform is designed to grow itself via permissionless mechanics —
no admin bottleneck for venue discovery, session creation, or quality control.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth, Postgres DB, Storage, Realtime, Edge Functions, RPCs)
- **Hosting:** Vercel (Vite SPA)
- **Payments:** UPI QR (upiqr npm) for MVP, Razorpay later
- **PWA:** Service worker, offline cache (IndexedDB), installable

## Essential Reading Order

When starting work on this codebase, read these files in order:

1. **This file** (CLAUDE.md) — orientation, conventions, gotchas
2. **docs/PRODUCT-VISION.md** — north star, value props, growth loops, gap analysis
3. **src/ARCHITECTURE.md** — directory map, DB schema, data flows, component patterns
4. **docs/TECH-DEBT.md** — what's resolved, what's still open (TD-001, TD-003, TD-019)
5. **docs/IMPLEMENTATION-PLAN.md** — prioritized phases with technical approach

## Directory Structure (Mental Model)

```
src/
  lib/            — Business logic. Pure functions. No React. Heavily documented.
                    ALWAYS read the module JSDoc header at the top of each file.
  pages/          — Route-level components (lazy-loaded in App.tsx)
  components/     — Feature-grouped UI components
  hooks/          — React hooks (useAuth, useSubscription, useFocusCredits, etc.)
  contexts/       — React contexts (Auth, Personality, FeatureFlags)
  integrations/   — Supabase client + generated types

supabase/
  migrations/     — SQL migrations (apply via `supabase db push`)
  functions/      — Edge Functions (deploy via `supabase functions deploy <name>`)

docs/             — Product vision, implementation plan, tech debt register
```

## Key Architectural Decisions

### 1. Neighborhoods are Normalized Slugs
All neighborhood values stored in DB are normalized via `normalizeNeighborhood()`
from `src/lib/neighborhoods.ts`. Example: "HSR Layout" → "hsr-layout".
**NEVER** store raw user input as a neighborhood. Always normalize first.
The `NeighborhoodInput` component handles this in the UI layer.

**Why:** We had a critical bug where Onboarding stored "HSR Layout" but
SessionRequests stored "hsr_layout" — they never matched, so demand clusters
never formed and auto-sessions never triggered.

### 2. Event-Based Triggers Over Cron
Prefer event-based triggers (call function after insert) over cron jobs.
Example: `onNewSessionRequest()` is called immediately after inserting a
session_request. If the 3rd request completes a cluster, the session is
created instantly. The Edge Function cron is a fallback sweep, not primary.

**Why:** Cron introduces 6+ hour latency. A user who requests at 2pm shouldn't
wait until 8pm to know their session was created.

### 3. Permissionless Growth System
The platform's core growth engine requires zero admin intervention:
- **Neighborhood Unlock:** 10 members in an area → area unlocks → members can nominate venues
- **Venue Nominations:** Any member nominates, 3 others vouch → venue goes live
- **Auto-Sessions:** 3+ demand signals cluster → session auto-created with captain
- **Health Checks:** Members verify venues; 3+ bad checks → auto-deactivate
- **Self-Correcting:** Bad venues die from low ratings, good venues get more sessions

Key files: `autoSession.ts`, `venueNomination.ts`, `venueHealthCheck.ts`,
`neighborhoods.ts`, `NominateVenue.tsx`, `NeighborhoodUnlock.tsx`

### 4. Focus Credits Economy
Event-sourced ledger in `focus_credits` table. Every transaction is a row.
Balance = SUM(amount). Negative amounts = spending. Has daily caps,
diminishing returns, and quality gates to prevent inflation.

Key files: `focusCredits.ts`, `growthConfig.ts`, `venueContributions.ts`

### 5. International Expansion by Design
No hardcoded city lists. Neighborhoods self-register from user profiles.
`SEED_NEIGHBORHOODS` in `neighborhoods.ts` bootstraps Bangalore; after that,
any neighborhood typed by any user becomes available system-wide.
All neighborhood comparisons use normalized slugs.

## Conventions for LLM Contributors

### When Writing New Code
1. **Module header:** Every `.ts` lib file MUST start with a JSDoc block listing:
   module name, description, key exports, dependencies, tables used.
2. **WHY comments:** Comment the reasoning, not the code. "// Skip weekends" is bad.
   "// Skip weekends — sessions only happen on workdays to avoid empty venues" is good.
3. **Explicit types:** Export interfaces for all function params and returns.
   Never rely on type inference for public APIs.
4. **Normalize neighborhoods:** Any code that reads/writes neighborhood data MUST
   use `normalizeNeighborhood()` from `src/lib/neighborhoods.ts`.
5. **Award FC through focusCredits.ts:** Never insert into `focus_credits` directly.
   Always use `awardCredits()` which enforces caps and diminishing returns.

### When Modifying Existing Code
1. **Read the file first.** Always. The module header tells you everything.
2. **Check ARCHITECTURE.md** for the component's role in the system.
3. **Check TECH-DEBT.md** — the item might already be resolved.
4. **Update docs** if you change behavior. Stale docs are worse than no docs.

### When Adding New Pages/Components
1. Add lazy import + route in `App.tsx`
2. Add to the Directory Map in `src/ARCHITECTURE.md`
3. Use `AppShell` wrapper for authenticated pages
4. Use `usePageTitle()` for document title

### Database Conventions
- All tables use RLS. New tables MUST enable RLS + add policies.
- Use `gen_random_uuid()` for primary keys (not `uuid_generate_v4()`)
- Neighborhoods stored as normalized slugs (see Decision #1)
- `created_at` defaults to `now()`, always `timestamptz`
- Edge Functions use service_role_key, client uses anon key

## Critical Gotchas

1. **`profiles.neighborhood` may contain legacy unnormalized values.** Old users
   might have "HSR Layout" instead of "hsr-layout". The `NeighborhoodInput`
   component handles this on read, but bulk queries should normalize.

2. **`events.auto_created` column exists** — filter it out when showing
   admin-created events, or include it when showing all events.

3. **Vouch quality gate:** `vouchForVenue()` requires `events_attended >= 1`.
   This prevents fake accounts but also blocks brand-new legitimate users.
   This is intentional — attend one session first, then contribute.

4. **The `check_nomination_activation()` SQL function** sets status to 'verified',
   NOT 'active'. The `activateVenue()` TypeScript function then promotes to
   'active' and creates the locations table entry. Two-step process.

5. **growthConfig `neighborhoodLaunchThreshold`** is set to 10 (was 100).
   This is the threshold for neighborhood unlock. Change in `growthConfig.ts`.

## Open Tech Debt (Blocking Production)

- **TD-001:** No payment integration. `handleUpgrade()` shows a toast. Need Razorpay.
- **TD-003:** No outbound notifications. In-app only. Need push + email + WhatsApp.
- **TD-019:** No E2E tests. 555 unit tests exist but no Playwright flows.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Production build (tsc + vite build)
npm test             # Run Vitest tests
npx tsc --noEmit     # Type check without emitting
supabase db push     # Apply migrations
supabase functions deploy <name>  # Deploy Edge Function
```
