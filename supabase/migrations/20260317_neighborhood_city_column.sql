-- Add city column to neighborhood_stats for location inference.
--
-- WHY: locationUtils.inferCityFromNeighborhood() needs to know which city
-- a neighborhood belongs to. Seed neighborhoods are mapped to "Bangalore"
-- in code, but user-created neighborhoods (global expansion) need DB storage.
-- This column is populated during onboarding when geolocation resolves a city,
-- and by the neighborhood-growth-manager edge function.

ALTER TABLE public.neighborhood_stats
  ADD COLUMN IF NOT EXISTS city text;

-- Backfill seed neighborhoods to Bangalore
UPDATE public.neighborhood_stats
SET city = 'Bangalore'
WHERE city IS NULL
  AND neighborhood IN (
    'hsr-layout', 'koramangala', 'indiranagar', 'btm-layout',
    'jp-nagar', 'jayanagar', 'whitefield', 'electronic-city',
    'marathahalli', 'sarjapur-road'
  );

-- Index for city-based queries (e.g., "all neighborhoods in Mumbai")
CREATE INDEX IF NOT EXISTS idx_neighborhood_stats_city
  ON public.neighborhood_stats (city)
  WHERE city IS NOT NULL;
