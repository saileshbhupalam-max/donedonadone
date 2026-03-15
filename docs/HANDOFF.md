# DanaDone — Session Handoff (2026-03-15)

> Read this file first when resuming work. It tells you exactly what's done,
> what's next, and where every piece lives.

## Track Status Overview

| Track | Status | Blocker |
|-------|--------|---------|
| A: Map World | COMPLETE | — |
| B: Revenue + Comms | INFRA BUILT, needs credentials | Razorpay keys, Resend key |
| C: Wow Moment | COMPLETE (C2 unblocked by B2) | — |
| D: Value Depth | COMPLETE (D2 unblocked by B1) | — |
| E: AI + Scale | BUILT, needs ANTHROPIC_API_KEY secret | `supabase secrets set` |

---

## Track B: Revenue + Communications — What's Actually Built

The previous handoff said these were "NOT BUILT" but they are. Every piece of infra exists — just needs credentials deployed.

### B1: Payments
- UPI QR flow works (E2E tested: Day Pass card → QR → UTR input → confirm)
- `upiqr` package installed and integrated
- **Still needs:** Razorpay account + API keys for auto-verify (manual UTR verification works now)

### B2: Push Notifications — FULLY BUILT
| Component | Status | File |
|-----------|--------|------|
| VAPID key generation | DONE | `scripts/generate-vapid-keys.mjs` |
| VAPID keys generated | DONE | `.env` has public key, private key printed for `supabase secrets set` |
| Service worker | DONE | `public/sw-push.js` (RFC 8291 encryption) |
| Web Push protocol | DONE | `supabase/functions/_shared/webpush.ts` (383 lines, pure Deno) |
| send-push Edge Function | DONE | `supabase/functions/send-push/index.ts` |
| send-notification orchestrator | DONE | `supabase/functions/send-notification/index.ts` (multi-channel: push + email + in-app) |
| Browser subscription hook | DONE | `src/hooks/usePushNotifications.ts` |
| Push opt-in card (Home) | DONE | `src/pages/Home/PushOptInCard.tsx` |
| Notification settings UI | DONE | `src/pages/Settings/NotificationSettingsCard.tsx` |
| Notification bell + list | DONE | `src/components/layout/TopBar.tsx` |
| Quiet hours logic | DONE | `src/lib/notificationLogic.ts` (IST 22:00-08:00 default) |
| Per-category toggles | DONE | `notification_preferences.channels` JSONB |
| DB tables | DONE | `push_subscriptions`, `notification_preferences`, `notification_log` |
| Cron schedules | DONE | `supabase/migrations/20260315_notification_crons_and_admin_seed.sql` |
| Trigger functions | DONE | `send-session-reminders`, `send-streak-warnings`, `match-nudges` |

**To activate push in production:**
```bash
supabase secrets set VAPID_PUBLIC_KEY="BFhMIfiAE_s9mRv-NkdeXEPCmtYMQq0nz2fLG39NtWIQwQxPOkGUj5O_Wo-SBGfJDVij1gfbVRpxc1mdO9eXcko"
supabase secrets set VAPID_PRIVATE_KEY="Inqd4w5p5PXUQ3wLhGo7vH_sNs9lhMhjPn3-L7y9mwQ"
supabase secrets set VAPID_SUBJECT="mailto:hello@danadone.club"
supabase db push           # Apply cron migration
supabase functions deploy send-push
supabase functions deploy send-notification
supabase functions deploy send-session-reminders
supabase functions deploy send-streak-warnings
supabase functions deploy match-nudges
```
Also add `VITE_VAPID_PUBLIC_KEY` to Vercel env vars for production.

### B3: Email — BUILT, needs Resend key
- `send-notification` Edge Function already dispatches to Resend API
- HTML email templates generated dynamically
- Respects quiet hours + per-category preferences
- `email_enabled` defaults to false (user opt-in in Settings)
- **To activate:** `supabase secrets set RESEND_API_KEY="re_xxxxx"`

### B4: Day Pass
- Purchase flow E2E tested (QR → UTR → confirm)
- `day_passes` migration exists
- **Still needs:** Razorpay for auto-verification

---

## Track E: AI Features — ALL EDGE FUNCTIONS BUILT

| Item | Edge Function | Status | Needs |
|------|-------------|--------|-------|
| E1 | `ai-community-manager` | BUILT | ANTHROPIC_API_KEY secret |
| E2 | `smart-search` | BUILT + client fallback | ANTHROPIC_API_KEY secret (fallback works without) |
| E3 | `session-debrief` | BUILT | ANTHROPIC_API_KEY secret |
| E4 | Session templates | BUILT | — |
| E5 | Cross-space network | LATER | 10+ active spaces |

**To activate AI features:**
```bash
supabase secrets set ANTHROPIC_API_KEY="sk-ant-xxxxx"
supabase functions deploy smart-search
supabase functions deploy ai-community-manager
supabase functions deploy session-debrief
supabase functions deploy generate-match-explanations
supabase functions deploy draft-intro
```

---

## E2E Testing — 44 Tests Passed, 11/12 Bugs Fixed

See `docs/HANDOFF-E2E-PASS3.md` for full details.

| Bug | Status |
|-----|--------|
| manifest.webmanifest missing | Fixed |
| SmartIntroCard RSVP crash | Fixed |
| Leaderboard slug display | Fixed |
| `update_reliability` RPC missing | Fixed |
| Venue nomination slug display | Fixed |
| Share message slug display | Fixed |
| Leaderboard local vs shared helper | Fixed |
| Needs Board hides own posts | Fixed |
| Admin `app_settings` 406 | Fixed |
| Auth session drops on navigation | Known (Playwright MCP limitation) |
| Discover search no text fallback | Fixed |
| profile_views 409 conflict | Fixed |

---

## What Actually Needs Doing

### Credentials to Deploy (user action)
1. `supabase secrets set VAPID_PUBLIC_KEY=...` + `VAPID_PRIVATE_KEY=...` + `VAPID_SUBJECT=...`
2. `supabase secrets set ANTHROPIC_API_KEY=...`
3. `supabase secrets set RESEND_API_KEY=...` (when ready)
4. Add `VITE_VAPID_PUBLIC_KEY` to Vercel env vars
5. Razorpay account + API keys (when ready)
6. `supabase db push` to apply cron migration

### Code Still Needed
- **Razorpay webhook handler** — Edge Function for auto-verifying payments (manual UTR works now)
- **WhatsApp integration** — currently stubbed, queues to notification_log
- **Day pass → member conversion funnel** — post-session upsell flow

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
