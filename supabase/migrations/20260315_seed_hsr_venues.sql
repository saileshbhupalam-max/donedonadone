-- Seed 25 popular HSR Layout workspaces into locations table.
-- Makes the map feel alive on day 1. All coordinates are for HSR Layout, Bangalore.
-- Sourced from market research (archive/research/market-research.md).
-- Marked as verified but NOT partner (community-discovered).

INSERT INTO locations (name, location_type, latitude, longitude, neighborhood, city, is_partner, verified, radius_meters) VALUES

-- ══════ CAFES (~12) ══════
('Third Wave Coffee HSR', 'cafe', 12.9116, 77.6389, 'hsr-layout', 'Bangalore', false, true, 50),
('Blue Tokai Coffee HSR', 'cafe', 12.9135, 77.6370, 'hsr-layout', 'Bangalore', false, true, 50),
('Starbucks HSR Layout', 'cafe', 12.9141, 77.6401, 'hsr-layout', 'Bangalore', false, true, 50),
('Dialogues Cafe HSR', 'cafe', 12.9148, 77.6352, 'hsr-layout', 'Bangalore', false, true, 50),
('Toit HSR', 'cafe', 12.9162, 77.6385, 'hsr-layout', 'Bangalore', false, true, 80),
('Hole in the Wall Cafe', 'cafe', 12.9155, 77.6410, 'hsr-layout', 'Bangalore', false, true, 50),
('Matteo Coffea HSR', 'cafe', 12.9128, 77.6345, 'hsr-layout', 'Bangalore', false, true, 50),
('Atta Galatta HSR', 'cafe', 12.9170, 77.6365, 'hsr-layout', 'Bangalore', false, true, 50),
('Cafe Azzure HSR', 'cafe', 12.9138, 77.6420, 'hsr-layout', 'Bangalore', false, true, 50),
('Chai Point HSR', 'cafe', 12.9145, 77.6378, 'hsr-layout', 'Bangalore', false, true, 40),
('Glen''s Bakehouse HSR', 'cafe', 12.9133, 77.6395, 'hsr-layout', 'Bangalore', false, true, 50),
('Yogisthaan Cafe HSR', 'cafe', 12.9120, 77.6360, 'hsr-layout', 'Bangalore', false, true, 50),

-- ══════ COWORKING SPACES (~8) ══════
('BHive Workspace HSR', 'coworking_space', 12.9158, 77.6372, 'hsr-layout', 'Bangalore', false, true, 100),
('Innov8 HSR Layout', 'coworking_space', 12.9175, 77.6398, 'hsr-layout', 'Bangalore', false, true, 100),
('WeWork HSR Layout', 'coworking_space', 12.9140, 77.6415, 'hsr-layout', 'Bangalore', false, true, 150),
('91springboard HSR', 'coworking_space', 12.9165, 77.6340, 'hsr-layout', 'Bangalore', false, true, 100),
('Cowrks HSR Layout', 'coworking_space', 12.9150, 77.6430, 'hsr-layout', 'Bangalore', false, true, 100),
('GoWork HSR', 'coworking_space', 12.9180, 77.6355, 'hsr-layout', 'Bangalore', false, true, 100),
('JEEF Coworking HSR', 'coworking_space', 12.9125, 77.6380, 'hsr-layout', 'Bangalore', false, true, 80),
('The Hive Space HSR', 'coworking_space', 12.9168, 77.6410, 'hsr-layout', 'Bangalore', false, true, 100),

-- ══════ INDEPENDENT / OTHER (~5) ══════
('Ministry of New HSR', 'other', 12.9130, 77.6350, 'hsr-layout', 'Bangalore', false, true, 60),
('WorkBench HSR', 'other', 12.9172, 77.6375, 'hsr-layout', 'Bangalore', false, true, 60),
('The Hub HSR Layout', 'other', 12.9143, 77.6365, 'hsr-layout', 'Bangalore', false, true, 60),
('Social Offline HSR', 'cafe', 12.9152, 77.6395, 'hsr-layout', 'Bangalore', false, true, 80),
('Koramangala Club Library', 'other', 12.9185, 77.6345, 'hsr-layout', 'Bangalore', false, true, 60);
