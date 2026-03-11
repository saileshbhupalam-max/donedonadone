# Data Flow & Business Logic Audit

**Audited:** 2026-03-09 | **Codebase:** focusclub-find-your-people

## 1. MATCHING LOGIC — BROKEN (both defined, neither called)

Two competing functions exist:
- `createSmartGroups()` in `src/lib/antifragile.ts` — considers gender, experience, captain status, does swap-based gender balancing.
- `createBalancedGroups()` in `src/lib/personality.ts` — simpler, gender-only round-robin distribution.

**Neither function is called anywhere in the app.** The `Session.tsx` page loads group statuses from `member_status` but never creates groups. `createSmartGroups` is the superior version and should be the one wired in.

## 2. FOCUS HOURS — PARTIAL (wired in 2 places, double-count risk)

`addFocusHours` is called in:
1. **Events.tsx** (~line 425) — in `submitFeedback()` after rating a past event.
2. **Home.tsx** (~line 510) — in the pending feedback emoji handler.

Both paths insert into `event_feedback` first, then call `addFocusHours`. Double-count risk if no unique constraint on `(event_id, user_id)` in `event_feedback`. Also uses non-atomic read-then-write pattern.

## 3. MILESTONES — PARTIAL (called once on Home load, mostly safe)

`checkMilestones()` called from Home.tsx on page load. Has internal dedup via DB unique constraint. But concurrent calls could race. Only awards ONE milestone per call.

## 4. RELIABILITY — BROKEN (defined but never called)

`updateReliability()` in `src/lib/antifragile.ts` has **zero call sites**. The entire reliability system (warnings, restrictions, graduated notifications) is dead code.

## 5. WAITLIST — PARTIAL (join works, promote never called)

- `joinWaitlist()` is called in EventDetail.tsx when sessions are full. Works correctly.
- `promoteWaitlist()` is **never called**. When a user un-RSVPs, the spot is freed but waitlisted users are never promoted.

## 6. RE-ENGAGEMENT — PARTIAL (circular dependency on last_active_at)

`checkReEngagement()` called from Home.tsx. Reads and updates `last_active_at`, but that column is not updated anywhere else. Users who never visit Home appear permanently inactive.

## 7. REFERRAL TRACKING — WORKING

Full flow properly wired: Index.tsx → localStorage → Onboarding.tsx → profile update → notification.

## 8. ANALYTICS — BROKEN (only 1 event tracked)

`trackAnalyticsEvent()` only called for `page_view` on Home. All other events (share_click, qr_scan, signup, rsvp, feedback, etc.) are not tracked.

## Summary

| # | Flow | Status | Key Issue |
|---|------|--------|-----------|
| 1 | Matching Logic | **BROKEN** | Both grouping functions defined, neither called |
| 2 | Focus Hours | **PARTIAL** | Double-count risk without DB constraint |
| 3 | Milestones | **PARTIAL** | Works; race condition risk; 1 per visit |
| 4 | Reliability | **BROKEN** | Zero call sites |
| 5 | Waitlist | **PARTIAL** | Join works; promote never called |
| 6 | Re-engagement | **PARTIAL** | last_active_at only updated inside the check |
| 7 | Referral Tracking | **WORKING** | Full flow wired |
| 8 | Analytics | **BROKEN** | Only Home page_view tracked |
