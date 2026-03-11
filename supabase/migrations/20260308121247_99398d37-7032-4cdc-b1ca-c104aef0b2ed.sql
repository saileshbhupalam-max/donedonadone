
-- App settings table
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Seed settings
INSERT INTO public.app_settings (key, value) VALUES
  ('min_event_attendance_to_host', '{"value": 10, "description": "Minimum events attended before a member can create paid events"}'::jsonb),
  ('host_revenue_share_percent', '{"value": 70, "description": "Percentage of ticket revenue that goes to the host"}'::jsonb),
  ('platform_fee_percent', '{"value": 30, "description": "Platform''s cut of ticket revenue"}'::jsonb),
  ('min_session_threshold', '{"value": 3, "description": "Minimum RSVPs needed 24hrs before event or it gets flagged"}'::jsonb),
  ('merge_suggestion_threshold', '{"value": 5, "description": "If two events same day, same area, both under this number, suggest merging"}'::jsonb),
  ('max_no_show_warnings', '{"value": 3, "description": "Number of no-shows before reliability warning"}'::jsonb),
  ('women_only_enabled', '{"value": true, "description": "Enable women-only event features"}'::jsonb);
