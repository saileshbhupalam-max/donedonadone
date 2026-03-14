-- Expand analytics_events CHECK constraint to support all funnel tracking events.
-- The original constraint only allowed 8 event types; the codebase already sends 17+
-- and this migration adds full funnel coverage for onboarding, session, referral,
-- venue nomination, and retention flows.

ALTER TABLE public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_event_type_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_event_type_check
  CHECK (event_type IN (
    -- Original events
    'page_view', 'share_click', 'qr_scan', 'referral_visit',
    'signup', 'onboarding_complete', 'first_rsvp', 'first_feedback',
    -- Events already sent by code but missing from CHECK
    'rsvp', 'rsvp_cancel', 'checkin', 'profile_view',
    'prompt_answer', 'props_sent', 'nudge_acted', 'nudge_dismissed',
    'referral_signup',
    -- Onboarding funnel
    'onboarding_step_1', 'onboarding_step_2', 'onboarding_step_3', 'onboarding_step_4',
    -- Session funnel
    'view_events', 'view_event_detail', 'session_complete',
    -- Referral funnel
    'invite_click', 'invite_signup', 'invite_first_session',
    -- Venue nomination funnel
    'view_nominate', 'submit_nomination', 'vouch_cast', 'venue_activated',
    -- Retention
    'streak_lost', 'comeback_visit', 'session_repeat'
  ));
