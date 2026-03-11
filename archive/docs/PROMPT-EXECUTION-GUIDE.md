# Prompt Execution Guide (Prompts 23-27)

## Overview

| # | Prompt | Priority | External Setup Needed |
|---|--------|----------|----------------------|
| 23 | Admin Moderation & Content Safety | P1 | None |
| 24 | Email Notifications (Resend) | P0 | Resend account + API key |
| 25 | Payments (Razorpay) | P0 | Razorpay account + API keys |
| 26 | Partner Self-Service Portal | P1 | None |
| 27 | Backend Automation (Autopilot, Streaks, Push, Missed-You) | P1-P2 | VAPID keys for push notifications |

## Recommended Order

### Start immediately (no external dependencies):
1. **Prompt 23** — Admin Moderation. Pure DB + UI work. No external services.

### After creating accounts:
2. **Prompt 25** — Payments. Do this early because Prompt 27's autopilot references payments.
   - Before running: Create Razorpay account, get test mode API keys
   - Set as Supabase secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - Set as env var: `VITE_RAZORPAY_KEY_ID`

3. **Prompt 24** — Email Notifications.
   - Before running: Create Resend account, verify domain, get API key
   - Set as Supabase secret: `RESEND_API_KEY`

### After payments and email work:
4. **Prompt 26** — Partner Portal. Benefits from having payments (earnings view) and email (partner notifications).

5. **Prompt 27** — Backend Automation. Benefits from everything above.
   - Before running: Generate VAPID keys (`npx web-push generate-vapid-keys`)
   - Set as Supabase secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - Set as env var: `VITE_VAPID_PUBLIC_KEY`

## What Lovable Builds vs What You Set Up

### You do (external services):
- Create Razorpay account at https://dashboard.razorpay.com
- Create Resend account at https://resend.com
- Create Sentry project at https://sentry.io (for later)
- Generate VAPID keys via CLI
- Set all API keys as Supabase secrets in the Supabase dashboard
- Set VITE_* env vars in Lovable's environment settings

### Lovable builds (all code):
- Database migrations (new tables, columns, RLS, triggers)
- Supabase Edge Functions (payment order, webhook, email sending, cron jobs)
- Frontend UI (checkout flow, partner portal, admin moderation, push permission)
- RPC functions (streak insurance, auto-escalation, system notifications)
- Service worker push handler

## What's NOT Covered (Do Later, Not Via Lovable)

| Item | Why Not Lovable | How to Do It |
|------|----------------|--------------|
| CI/CD pipeline | GitHub Actions config, not app code | Write `.github/workflows/ci.yml` manually or with Claude |
| E2E tests (Playwright) | Testing framework, needs running app | Set up Playwright separately, write tests with Claude |
| Sentry production setup | Account config + env vars | Create project, add DSN to env |
| Load testing | External tool (k6/artillery) | Run separately against staging |
| OWASP security scan | External tool | Run ZAP or similar against staging |
| iOS Safari testing | Manual QA | Test on real iOS devices |
| Lighthouse audit | Chrome DevTools | Run manually, optimize based on results |
