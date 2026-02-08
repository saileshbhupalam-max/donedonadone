# donedonadone — Developer Guide

Group coworking platform matching solo workers into groups of 3-5 at partner cafes/coworking spaces in HSR Layout, Bangalore.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (components in `components/ui/`)
- **Database & Auth:** Supabase (Postgres + RLS + Edge Functions)
- **Hosting:** Vercel
- **Charts:** Recharts
- **Data fetching:** SWR (client), Supabase server client (RSC)
- **Icons:** lucide-react
- **Payments:** UPI QR codes (MVP), Razorpay later

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build — must pass with zero errors
npm run lint         # ESLint
```

## Project Structure

```
app/
├── api/              # API routes (Next.js Route Handlers)
│   ├── admin/        # Admin-only endpoints
│   ├── bookings/     # Booking CRUD + cancel
│   ├── onboarding/   # Quiz save
│   ├── partner/      # Partner CRUD (venue, sessions, bookings, earnings, stats)
│   ├── session/      # Session-day endpoints (group, checkin, feedback)
│   └── sessions/     # Public session listing
├── admin/            # Admin dashboard (7 pages)
├── auth/             # Login, sign-up, error pages
├── dashboard/        # Coworker dashboard (home, sessions, bookings, profile)
├── onboarding/       # Onboarding quiz
├── partner/          # Partner dashboard (home, venue, sessions, bookings, earnings)
├── session/          # Session-day pages (group reveal, checkin, feedback)
├── globals.css       # Tailwind + CSS variables (theme tokens)
├── layout.tsx        # Root layout (Inter font, ThemeProvider)
└── page.tsx          # Landing page

components/
├── admin/            # Admin shell + sidebar + topbar + mobile nav + charts
├── dashboard/        # Coworker shell + session card + booking sheet
├── landing/          # Hero, how-it-works, pricing, navbar, footer
├── onboarding/       # Onboarding wizard
├── partner/          # Partner shell + venue form + session modal + charts
├── session/          # Session-day components (group, checkin, feedback)
└── ui/               # shadcn/ui primitives (button, card, badge, etc.)

lib/
├── admin.ts          # verifyAdmin() helper
├── config.ts         # Shared constants (pricing, vibes, statuses, amenities)
├── format.ts         # Date/time/currency formatting
├── partner.ts        # getPartnerVenue() helper
├── types.ts          # Shared TypeScript interfaces for all entities
├── utils.ts          # cn() class merge utility
└── supabase/
    ├── client.ts     # Browser Supabase client
    ├── proxy.ts      # Middleware: auth session refresh + route protection
    └── server.ts     # Server-side Supabase client (for RSC / Route Handlers)

scripts/
├── 001_schema.sql            # Full database schema + RLS
├── 002_partner_session_rls.sql  # Partner session/booking RLS
├── 003_admin_rls.sql         # Admin RLS policies
├── 004_auto_assign_groups.sql   # Auto-assign groups RPC
└── 005_session_day.sql       # Check-in RPC + policies
```

## Database Schema (Quick Reference)

| Table | Key Columns |
|-------|-------------|
| `profiles` | id (FK auth.users), display_name, user_type, work_type |
| `coworker_preferences` | user_id, work_vibe, noise_preference, communication_style, social_goals[], introvert_extrovert |
| `venues` | partner_id, name, address, area, amenities[], status |
| `sessions` | venue_id, date, start_time, end_time, duration_hours, platform_fee, venue_price, total_price (generated), max_spots, spots_filled, status |
| `bookings` | user_id, session_id, group_id, payment_amount, payment_status, checked_in |
| `groups` | session_id, group_number, table_assignment |
| `group_members` | group_id, user_id |
| `session_feedback` | booking_id, user_id, session_id, overall_rating, tags[], comment |
| `member_ratings` | from_user, to_user, session_id, would_cowork_again |

**Important:** The sessions table uses `date` (not `session_date`). Front-end may reference `session_date` from joined queries — this is a Supabase alias. Always use `date` in raw SQL.

## Naming Conventions

- **DB columns:** snake_case (`payment_status`, `venue_price`)
- **TS interfaces:** PascalCase (`Session`, `Booking`) in `lib/types.ts`
- **Route files:** `app/<section>/page.tsx` for pages, `app/api/<section>/route.ts` for APIs
- **Components:** PascalCase filenames in kebab-case dirs (`components/admin/kpi-card.tsx` exports `KpiCard`)

## How to Add a New Page

1. Create `app/<section>/<page-name>/page.tsx`
2. For server components: use `createClient()` from `lib/supabase/server`
3. For client pages: add `"use client"`, use SWR for data fetching
4. If it needs auth protection, ensure the path is covered in `lib/supabase/proxy.ts`

## How to Add a New API Route

1. Create `app/api/<section>/route.ts`
2. Import `createClient` from `@/lib/supabase/server`
3. Call `supabase.auth.getUser()` for auth
4. For admin routes: use `verifyAdmin()` from `lib/admin.ts`
5. For partner routes: use `getPartnerVenue()` from `lib/partner.ts`
6. Return `NextResponse.json()`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Three User Types

| Type | Dashboard | Guard |
|------|-----------|-------|
| `coworker` | `/dashboard` | Default, no extra check |
| `partner` | `/partner` | `profile.user_type === 'partner'` in layout |
| `admin` | `/admin` | `profile.user_type === 'admin'` in layout |

## Pricing Model

- **Platform fee:** ₹100 (2hr session) / ₹150 (4hr session) — goes to donedonadone
- **Venue price:** Set by partner — goes to venue
- **Total:** `platform_fee + venue_price` (generated column in DB)
- Use `platformFee()` from `lib/config.ts`, never hardcode
