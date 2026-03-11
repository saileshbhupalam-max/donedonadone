# donedonadone — Product Requirements

## What is it?
A group coworking platform that matches solo workers into small groups of 3-5 people to cowork together at partner cafes and coworking spaces in HSR Layout, Bangalore.

## How it works
1. User browses available sessions at nearby venues
2. User picks a time slot (2hr or 4hr) and pays
3. System auto-assigns them to a group of 3-5 based on work style compatibility
4. 1 hour before the session, group is revealed with member profiles
5. User arrives at venue, checks in, and coworks with their group
6. After session, user rates the experience and group members

## User Types
1. **Coworker** — Books sessions, gets grouped, coworks
2. **Venue Partner** — Manages venue, sets availability & pricing, views earnings
3. **Admin** — Manages all operations, users, venues, financials

## Revenue Model
- Per-session pricing, tiered by duration
- Platform fee: ₹100 (2hr session) / ₹150 (4hr session)
- Venue sets their own charge on top (covers food/drinks/space)
- User pays total: platform fee + venue charge

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Database, Storage, Edge Functions, Realtime)
- Vercel (Hosting)
- UPI QR Code for payments (upiqr npm package)

## Design System
- Primary: warm amber (#F59E0B / amber-500)
- Secondary: teal (#0D9488 / teal-600)
- Background: warm off-white (#FAFAF9 / stone-50)
- Text: slate-800 body, slate-900 headings
- Accent: violet-500 for matching/social features
- Cards: white with stone-200 borders
- Font: Inter
- Vibe: warm, community-driven, approachable — not corporate

## Scale Target
- 1000 bookings/day in HSR Layout
- 5-15 partner venues at launch
- Groups of 3-5 per table

## Key Pages
1. Landing page (marketing)
2. Session discovery + booking (core experience)
3. User onboarding + 10-question personalization quiz
4. User dashboard (upcoming sessions, group reveal, stats)
5. Venue partner dashboard (venue management, availability, earnings)
6. Admin dashboard (operations, users, venues, financials, group management)
7. Session day experience (group reveal, check-in, live session, feedback)

## Matching Dimensions (for auto-grouping)
- Work vibe: deep focus / casual social / balanced
- Noise preference: silent / ambient / lively
- Break frequency: pomodoro / hourly / deep stretch / flexible
- Productive times: morning / afternoon / evening / night
- Social goals: accountability / networking / friendship / collaboration / inspiration
- Introvert-extrovert scale (1-5)
- Communication style: minimal / moderate / chatty

## Payment Flow (MVP)
- Generate UPI QR code with amount and booking ID
- User scans QR with any UPI app, pays
- User clicks "I've paid" to confirm
- Admin verifies payment in admin dashboard
- Booking status: pending → paid → confirmed
