# Prompt 14C — Code Quality Cleanup (Type Safety + Dead Code)

Final cleanup pass. Remove unnecessary type casts that suppress TypeScript's error checking, fix a circular dependency, and clean up dead code.

---

## 1. Remove ALL unnecessary `as any` casts on Supabase queries

Every Supabase `.from("table_name" as any)` cast in the codebase is unnecessary — all tables exist in the generated types file at `src/integrations/supabase/types.ts`. These casts suppress TypeScript's ability to catch typos, removed columns, and type mismatches.

**Remove `as any` from `.from()` calls in these files:**

- `GrowthTab.tsx` — `analytics_events`, `member_milestones`
- `EnergyCheck.tsx` — `energy_checks`
- `IcebreakersTab.tsx` — `icebreaker_questions`
- `GivePropsFlow.tsx` — `peer_props`
- `sessionPhases.ts` — `session_phases`
- `PhotoMoment.tsx` — `session_photos`
- `EventDetail.tsx` — `session_photos`
- `PartnersTab.tsx` — `venue_partners`, `venue_reviews`, `venue_scans`
- `Events.tsx` — `venue_partners`
- `Index.tsx` — `venue_scans`, `venue_partners`
- `Partners.tsx` — `venue_partners`, `venue_reviews`
- `antifragile.ts` — `session_waitlist`
- `growth.ts` — `analytics_events`, `member_milestones`
- `icebreakers.ts` — `icebreaker_questions`
- `badges.ts` — `peer_props`
- `Profile.tsx` — `peer_props`

Change: `supabase.from("table_name" as any)` → `supabase.from("table_name")`

**Remove `as any` from profile field access in these files:**

- `Session.tsx` — `(profile as any).is_table_captain` → `profile.is_table_captain`
- `CaptainCard.tsx` — `(profile as any).is_table_captain`, `(profile as any).captain_sessions`
- `ProfileView.tsx` — `(profile as any).current_streak`, `(profile as any).show_linkedin/instagram/twitter`
- `SessionWrapUp.tsx` — `(profile as any).current_streak`, `(profile as any).intentions_completed`
- `Profile.tsx` — `(profile as any).show_linkedin/instagram/twitter`
- `HorizontalCard.tsx` — `(profile as any).focus_hours`
- `MemberCard.tsx` — `(profile as any).focus_hours`
- `Events.tsx` — `(prof as any).events_attended`, `(prof as any).events_no_show`
- `Home.tsx` — `(eventData as any).session_format`, `(prof as any)` patterns
- `EventDetail.tsx` — `(event as any).session_format`
- `antifragile.ts` — `(profile as any).sessions_rsvpd` etc.

All of these fields exist in the `profiles` and `events` type definitions. Remove the casts so TypeScript can verify correctness.

**Remove `as any` from insert/upsert payloads:**

- `Session.tsx` — `member_status` upsert, `session_intentions` upsert/update
- `CaptainCard.tsx` — `profiles` update
- `FlagMemberForm.tsx` — `member_flags` insert
- `PhotoMoment.tsx` — `session_photos` insert
- `EnergyCheck.tsx` — `energy_checks` upsert
- `VenueReviewCard.tsx` — `venue_reviews` insert
- `SessionWrapUp.tsx` — `profiles` update

## 2. Fix `OnboardingData` circular dependency

Currently `Onboarding.tsx` exports the `OnboardingData` interface, and all 6 step components (`Step1Identity` through `Step6Summary`) import it from the page file, creating a circular import.

Fix:
1. Move the `OnboardingData` interface from `src/pages/Onboarding.tsx` to `src/lib/types.ts`
2. Update the import in `Onboarding.tsx`: `import type { OnboardingData } from '@/lib/types'`
3. Update the import in all 6 step components: `import type { OnboardingData } from '@/lib/types'`

## 3. Remove unused imports and dead code

- `Session.tsx` — remove the unused `motion` import from `framer-motion` (imported but never used in JSX)
- `src/components/NavLink.tsx` — delete this file entirely (custom NavLink wrapper that is never imported; BottomNav uses react-router-dom's NavLink directly)
- `src/components/ui/use-toast.ts` — delete this file (1-line re-export of `@/hooks/use-toast` that nothing imports)

## 4. Remove the dynamic import inconsistency

In `Onboarding.tsx` (~line 176), there's a `const { toast } = await import("sonner")` inside a catch block. Since `sonner` is already statically imported by many files and is in the bundle anyway, change this to a static import at the top of the file:

```ts
import { toast } from "sonner";
```

And use it directly in the catch block without the dynamic import.
