
DROP POLICY "Service insert usage log" ON public.ai_usage_log;
CREATE POLICY "Authenticated insert usage log" ON public.ai_usage_log FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
);
