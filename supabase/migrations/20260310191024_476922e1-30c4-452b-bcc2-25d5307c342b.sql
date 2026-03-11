
-- Table: ai_providers
CREATE TABLE public.ai_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_env TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read providers" ON public.ai_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write providers" ON public.ai_providers FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- Table: ai_task_config
CREATE TABLE public.ai_task_config (
  task_type TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES public.ai_providers(id),
  model TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 200,
  system_prompt TEXT,
  is_active BOOLEAN DEFAULT true,
  fallback_to_template BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_task_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read task config" ON public.ai_task_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write task config" ON public.ai_task_config FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- Table: match_templates
CREATE TABLE public.match_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type TEXT NOT NULL,
  template TEXT NOT NULL,
  icebreaker_template TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.match_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read templates" ON public.match_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write templates" ON public.match_templates FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- Table: ai_usage_log
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  provider_id TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  source TEXT NOT NULL DEFAULT 'template',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read usage log" ON public.ai_usage_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));
CREATE POLICY "Service insert usage log" ON public.ai_usage_log FOR INSERT WITH CHECK (true);

-- Seed providers
INSERT INTO public.ai_providers (id, display_name, base_url, api_key_env) VALUES
  ('openai', 'OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY'),
  ('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', 'ANTHROPIC_API_KEY'),
  ('google', 'Google AI', 'https://generativelanguage.googleapis.com/v1beta', 'GOOGLE_AI_KEY');

-- Seed task configs
INSERT INTO public.ai_task_config (task_type, provider_id, model, max_tokens, fallback_to_template, system_prompt) VALUES
  ('match_explanation', 'openai', 'gpt-4o-mini', 150, true, 'You explain why two coworkers are a good match for working together at a cafe. Be warm, specific, and concise (1-2 sentences). Reference their actual traits.'),
  ('icebreaker', 'openai', 'gpt-4o-mini', 80, true, 'Generate a natural conversation starter for two coworkers meeting at a cafe coworking session. Be specific to their interests. One sentence only.');

-- Seed templates
INSERT INTO public.match_templates (match_type, template, icebreaker_template, priority) VALUES
  ('same_vibe', 'You both thrive in {{vibe}} environments — expect a productive session together.', 'Compare your favorite focus playlists or work routines', 5),
  ('complementary_skills', '{{user_name}} is looking for {{user_need}} — {{match_name}} can offer exactly that.', 'Ask about their experience with {{match_skill}}', 10),
  ('same_industry', 'You''re both in {{industry}} — plenty of shared context to build on.', 'What''s the most interesting problem you''re solving in {{industry}} right now?', 8),
  ('same_goals', 'You''re both here to {{goal}} — great accountability partners.', 'Share what you''re working on today and set a mini-goal together', 6),
  ('repeat_match', 'You''ve worked together before — familiar faces make great focus partners.', 'Catch up on what''s changed since your last session', 4),
  ('new_member', '{{match_name}} is new to FocusClub — help them feel welcome!', 'Share your favorite thing about coworking sessions', 3),
  ('cross_industry', 'Different industries, shared values — fresh perspectives guaranteed.', 'What does a typical workday look like in your field?', 7),
  ('skill_swap', '{{user_name}} can help with {{user_skill}} and {{match_name}} brings {{match_skill}} — a natural skill swap.', 'What skill are you most excited to learn right now?', 9);
