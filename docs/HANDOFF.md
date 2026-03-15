# DanaDone — Session Handoff (2026-03-15)

> Read this file first when resuming work. It tells you exactly what's done,
> what's next, and where every piece lives.

## What Was Done This Session

### Track A: Map World — COMPLETE (A1-A9)

| Item | What | Key Files |
|------|------|-----------|
| A1 | Quick Questions taste engine (60 questions, 5 types, FC rewards) | `src/components/home/QuickQuestionsCard.tsx`, `supabase/migrations/20260315_taste_engine.sql` |
| A2 | Venue Detail page (`/venue/:id`) | `src/pages/VenueDetail.tsx` |
| A3 | Content seeding (25 HSR venues in `locations` table) | `supabase/migrations/20260315_seed_hsr_venues.sql` |
| A4 | MapSwapToggle on Home, Discover, Events | `src/components/map/MapSwapToggle.tsx` (shared), wired into Home/Discover/Events |
| A5 | Venue popup links to `/venue/:id` | `src/components/map/SessionMap.tsx` — venues from `locations` table get "View venue" button |
| A6 | Exhaustive venue data model (8 new contribution types) | `src/lib/venueContributions.ts` — wall_photo, ambient_noise, lighting, temperature, restroom, desk_layout, outlet_locations, menu_photo |
| A7 | "Your Places" on Profile Journey tab | `src/components/home/YourPlaces.tsx`, wired into `src/pages/Profile/index.tsx` |
| A8 | First-mover FC bonuses (2x for first contribution per type per venue) | `src/lib/venueContributions.ts` — `submitVenueContribution()` checks existing contributions |
| A9 | Map enrichment (type icons, search, venue type filter, activity badges) | `src/components/map/SessionMap.tsx` — `createVenueIcon()`, search/filter in filter panel, check-in counts on markers |

### Track C: Wow Moment — MOSTLY COMPLETE

| Item | Status | Key Files |
|------|--------|-----------|
| C1 | DONE — SmartIntroCard wired into EventDetail | `src/components/session/SmartIntroCard.tsx`, `src/pages/EventDetail.tsx` line ~442 |
| C2 | BLOCKED — needs push notifications (Track B) | — |
| C3 | ALREADY BUILT — SpaceInsights.tsx at `/space/:id/insights` | `src/pages/SpaceInsights.tsx`, `src/pages/SpaceLive.tsx` |

### Track D: Value Depth — MOSTLY COMPLETE

| Item | Status | Key Files |
|------|--------|-----------|
| D1 | DONE (80% was pre-built) — Companies page + Home card | `src/pages/Companies.tsx`, `src/components/home/CompanyHomeCard.tsx`, `src/components/home/MatchNudgeCard.tsx` |
| D2 | BLOCKED — needs day pass purchase flow (Track B) | — |
| D3 | DONE — Needs board + Home NeedsMatchCard | `src/pages/Needs.tsx`, `src/components/home/NeedsMatchCard.tsx` (wired into Home) |
| D4 | DONE (70% was pre-built) — mentorMatch + MentorSection | `src/lib/mentorMatch.ts`, `src/components/discover/MentorSection.tsx` |

### Track E: AI + Scale — PARTIALLY COMPLETE

| Item | Status | Key Files |
|------|--------|-----------|
| E1 | NOT BUILT — AI community manager needs Claude Edge Functions | — |
| E2 | NOT BUILT — LLM search needs Claude Edge Functions | — |
| E3 | NOT BUILT — AI session debrief needs Claude Edge Functions | — |
| E4 | ALREADY BUILT — session templates + Admin TemplatesTab | `src/lib/sessionTemplates.ts`, `src/components/admin/TemplatesTab.tsx` |
| E5 | LATER — cross-space network needs 10+ active spaces | — |

---

## What To Do Next

### Priority 1: Track B — Revenue + Communications (LAUNCH BLOCKER)

This is the only track that blocks launch AND unblocks C2 + D2.

| Item | What | Dependencies | Notes |
|------|------|-------------|-------|
| B1 | **Razorpay payment integration** | Razorpay account + API keys | TD-001 in TECH-DEBT.md. `handleUpgrade()` currently shows a toast. Need real payment flow. `upiqr` package available for UPI QR MVP. |
| B2 | **Push notifications** | VAPID keys in production | TD-003 in TECH-DEBT.md. Edge Functions log "Would push". Need real web push via service worker. |
| B3 | **Email triggers** | Resend account + API key | Welcome email, session reminders, weekly digest. |
| B4 | **Day pass purchase flow** | B1 (payments) | Outsiders buy single sessions. Unblocks D2 (day pass → member conversion). |

**Technical prerequisites** (check `docs/IMPLEMENTATION-PLAN.md` "Technical Prerequisites"):
- [ ] Resend account + API key (for email)
- [ ] Razorpay account + API keys (for payment)
- [ ] VAPID keys in production (for push)
- [x] `upiqr` package installed (for UPI QR MVP)

### Priority 2: Track E (E1-E3) — AI Features

All need Supabase Edge Functions calling Claude API. The AI infrastructure exists:
- `ai_providers`, `ai_task_config`, `ai_usage_log` tables exist
- `ai_match_explanations` already uses Claude
- Edge Functions deploy via `supabase functions deploy <name>`

| Item | What to build |
|------|---------------|
| E1 | Edge Function: daily churn prediction + auto-welcome for new members + community prompt suggestions. Admin UI: "AI Suggestions" tab with approve/dismiss. |
| E2 | Edge Function: parse natural language query → map to taste graph → return ranked members. Wire into Discover search bar (Plus+ tier). |
| E3 | Edge Function: post-session, generate personalized debrief per member from group data. Push via notification (needs B2). |

---

## Architecture Reminders

- **Read CLAUDE.md first** — project conventions, gotchas, critical decisions
- **Neighborhoods are normalized slugs** — always use `normalizeNeighborhood()`
- **FC through focusCredits.ts only** — never insert into `focus_credits` directly
- **Event-based triggers over cron** — call functions after insert, cron is fallback
- **react-leaflet must stay on v4** while on React 18 (v5 needs React 19's `use` hook)
- **CartoDB dark tiles** — free, no auth (Stadia Maps broke)
- **esbuild keepNames=true** — for debuggable production errors

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (tsc + vite)
npx tsc --noEmit     # Type check
npm test             # Run Vitest (603+ tests)
supabase db push     # Apply migrations
supabase functions deploy <name>  # Deploy Edge Function
git push             # Pushes to both focusclub + donedonadone repos
```

## Git State

- Branch: `main`
- Both remotes in sync: `focusclub` + `donedonadone`
- Latest commit: `02802df` — feat: wire NeedsMatchCard into Home (Track D3)
- All changes committed and pushed. Clean working tree.
