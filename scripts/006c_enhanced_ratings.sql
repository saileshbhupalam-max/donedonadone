-- Enhanced Member Ratings: add tags and energy_match for richer peer feedback
-- Tags: helpful, focused, fun, great-conversation, good-energy
-- Energy match: 1-5 scale (how well energy levels matched)

ALTER TABLE member_ratings
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS energy_match INTEGER CHECK (energy_match BETWEEN 1 AND 5);
