
-- Table: ai_match_explanations
CREATE TABLE ai_match_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  matched_user_id UUID NOT NULL REFERENCES profiles(id),
  session_id UUID REFERENCES events(id),
  explanation TEXT NOT NULL,
  icebreaker TEXT,
  compatibility_score SMALLINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, matched_user_id, session_id)
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION validate_compatibility_score()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.compatibility_score IS NOT NULL AND (NEW.compatibility_score < 0 OR NEW.compatibility_score > 100) THEN
    RAISE EXCEPTION 'compatibility_score must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_compatibility_score
  BEFORE INSERT OR UPDATE ON ai_match_explanations
  FOR EACH ROW EXECUTE FUNCTION validate_compatibility_score();

-- RLS
ALTER TABLE ai_match_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own explanations" ON ai_match_explanations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin full access" ON ai_match_explanations
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

-- RPC: get_match_explanation
CREATE OR REPLACE FUNCTION get_match_explanation(
  p_matched_user_id UUID,
  p_session_id UUID DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSON;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT json_build_object(
    'explanation', explanation,
    'icebreaker', icebreaker,
    'compatibility_score', compatibility_score
  ) INTO v_result
  FROM ai_match_explanations
  WHERE user_id = v_user_id
    AND matched_user_id = p_matched_user_id
    AND (p_session_id IS NULL OR session_id = p_session_id)
  ORDER BY created_at DESC LIMIT 1;

  RETURN COALESCE(v_result, '{"explanation": null}'::JSON);
END;
$$;
