-- Venue Quality Score ("donedonadone Score")
-- Multi-dimensional: WiFi (20%), Ambiance (20%), F&B (20%), Service (15%),
--                    Power (10%), Noise (10%), Cleanliness (5%)

-- Add venue-specific rating dimensions to session_feedback
ALTER TABLE session_feedback
  ADD COLUMN IF NOT EXISTS venue_wifi INTEGER CHECK (venue_wifi BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS venue_ambiance INTEGER CHECK (venue_ambiance BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS venue_fnb INTEGER CHECK (venue_fnb BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS venue_service INTEGER CHECK (venue_service BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS venue_power INTEGER CHECK (venue_power BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS venue_noise INTEGER CHECK (venue_noise BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS venue_cleanliness INTEGER CHECK (venue_cleanliness BETWEEN 1 AND 5);

-- Compute venue quality score
CREATE OR REPLACE FUNCTION compute_venue_score(p_venue_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_wifi NUMERIC;
  v_ambiance NUMERIC;
  v_fnb NUMERIC;
  v_service NUMERIC;
  v_power NUMERIC;
  v_noise NUMERIC;
  v_cleanliness NUMERIC;
  v_composite NUMERIC;
  v_total_reviews INTEGER;
BEGIN
  SELECT
    coalesce(avg(sf.venue_wifi), 0),
    coalesce(avg(sf.venue_ambiance), 0),
    coalesce(avg(sf.venue_fnb), 0),
    coalesce(avg(sf.venue_service), 0),
    coalesce(avg(sf.venue_power), 0),
    coalesce(avg(sf.venue_noise), 0),
    coalesce(avg(sf.venue_cleanliness), 0),
    count(*)
  INTO v_wifi, v_ambiance, v_fnb, v_service, v_power, v_noise, v_cleanliness, v_total_reviews
  FROM session_feedback sf
  JOIN sessions s ON s.id = sf.session_id
  WHERE s.venue_id = p_venue_id
    AND sf.venue_wifi IS NOT NULL;

  IF v_total_reviews = 0 THEN
    RETURN jsonb_build_object('score', 0, 'total_reviews', 0);
  END IF;

  v_composite := (
    v_wifi * 0.20 +
    v_ambiance * 0.20 +
    v_fnb * 0.20 +
    v_service * 0.15 +
    v_power * 0.10 +
    v_noise * 0.10 +
    v_cleanliness * 0.05
  );

  RETURN jsonb_build_object(
    'score', round(v_composite, 1),
    'wifi', round(v_wifi, 1),
    'ambiance', round(v_ambiance, 1),
    'fnb', round(v_fnb, 1),
    'service', round(v_service, 1),
    'power', round(v_power, 1),
    'noise', round(v_noise, 1),
    'cleanliness', round(v_cleanliness, 1),
    'total_reviews', v_total_reviews
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
