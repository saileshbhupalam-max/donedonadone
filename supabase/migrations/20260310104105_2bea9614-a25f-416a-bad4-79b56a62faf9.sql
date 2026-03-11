
-- Fix search_path on validation function
CREATE OR REPLACE FUNCTION public.trg_validate_user_settings()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.weekly_goal < 1 OR NEW.weekly_goal > 7 THEN
    RAISE EXCEPTION 'weekly_goal must be between 1 and 7';
  END IF;
  IF NEW.visibility NOT IN ('everyone', 'connections_only', 'hidden') THEN
    RAISE EXCEPTION 'visibility must be everyone, connections_only, or hidden';
  END IF;
  RETURN NEW;
END;
$$;
