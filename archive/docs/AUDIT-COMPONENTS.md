# Component Integration Audit

**Audited:** 2026-03-09 | **Codebase:** focusclub-find-your-people

## MEDIUM Issues (11)

### Dead Code — Components/Functions Defined but Never Called

1. **`FlagMemberForm`** — member flagging UI is unreachable. No page mounts it despite backend logic existing.
2. **`promoteWaitlist()`** — users can join waitlist but are never promoted when spots open.
3. **`createSmartGroups()`** — smart grouping algorithm is dead code, never invoked.
4. **`updateReliability()`** — no-show tracking, warnings, restrictions never fire.
5. **`usePersonality()`** — PersonalityProvider runs DB query on every app load but hook is never called by any component.
6. **`getPopularityLabel()`** — exported but Events.tsx has its own inline logic.
7. **5 sharing utility functions** dead: `shareLinkedIn`, `shareWhatsApp`, `copyToClipboard`, `getPostRsvpMessage`, `getRefLink`.
8. **`InviteSuggestion`** component — exported but never imported.

### Architecture Issues

9. **No lazy loading** — all 13 pages eagerly imported in App.tsx, bloating initial bundle.
10. **50+ unnecessary `as any` casts** — every table/column exists in generated types; casts suppress type safety.
11. **Circular dependency** — Onboarding.tsx <-> 6 Step components via `OnboardingData` interface. Fix: move to types.ts.

### Security

12. **No admin role guard at route level** — admin check happens inside Admin.tsx, not at router level. Shows loading skeleton briefly to non-admins.

## LOW Issues (6)

1. 18 unused shadcn/ui components installed
2. Custom `NavLink` component never used
3. `CaptainBadge` export never imported
4. Duplicate `use-toast.ts` files
5. Unused `motion` import in Session.tsx
6. Dynamic `import("sonner")` in Onboarding.tsx inconsistent with static imports elsewhere

## All Imports Verified Clean

- No broken imports — every file path resolves correctly
- All context providers correctly wired (AuthProvider, PersonalityProvider)
- All routes valid and properly connected
