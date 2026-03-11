
CREATE OR REPLACE FUNCTION validate_compatibility_score()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.compatibility_score IS NOT NULL AND (NEW.compatibility_score < 0 OR NEW.compatibility_score > 100) THEN
    RAISE EXCEPTION 'compatibility_score must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$;
