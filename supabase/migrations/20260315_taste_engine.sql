-- Taste Engine: Quick Questions system for continuous preference collection.
-- Replaces the one-shot TasteGraphBuilder as the primary data collection method.
-- Users answer 2-3 questions per app open → earns FC → feeds matching algorithm.

-- ─── Tables ──────────────────────────────────────────

CREATE TABLE taste_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'this_or_that', 'emoji_pick', 'chip_select', 'slider', 'quick_text'
  )),
  options JSONB,
  category TEXT NOT NULL CHECK (category IN ('work_dna', 'personality', 'lifestyle', 'contextual')),
  taste_graph_field TEXT,
  priority INT DEFAULT 50,
  fc_reward INT DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  seasonal_start DATE,
  seasonal_end DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE taste_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  question_id UUID NOT NULL REFERENCES taste_questions(id),
  answer JSONB NOT NULL,
  credits_awarded INT DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

-- ─── RLS ──────────────────────────────────────────

ALTER TABLE taste_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active questions" ON taste_questions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can read own answers" ON taste_answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers" ON taste_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own answers" ON taste_answers
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────

CREATE INDEX idx_taste_answers_user ON taste_answers(user_id);
CREATE INDEX idx_taste_questions_active ON taste_questions(is_active, priority DESC);

-- ─── Seed Questions (~60) ──────────────────────────────────────────
-- Priority: work_dna 90-100, personality 50-70, lifestyle 30-50, contextual 20-40

INSERT INTO taste_questions (question, question_type, options, category, taste_graph_field, priority) VALUES

-- ══════ WORK DNA (priority 90-100, feeds taste_graph directly) ══════

('What best describes your work?', 'emoji_pick',
 '[{"id":"founder","emoji":"🚀","label":"Founder"},{"id":"employee","emoji":"💼","label":"Employee"},{"id":"freelancer","emoji":"🎯","label":"Freelancer"},{"id":"student","emoji":"📚","label":"Student"}]',
 'work_dna', 'role_type', 100),

('Your top skills?', 'chip_select',
 '["Coding","Design","Marketing","Writing","Sales","Finance","Data","Product","Operations","Strategy"]',
 'work_dna', 'skills', 95),

('What are you looking for from coworkers?', 'chip_select',
 '["Accountability","Feedback","Clients","Co-founder","Mentor","Friends","Collaborators","Investors"]',
 'work_dna', 'work_looking_for', 95),

('What can you help others with?', 'chip_select',
 '["Code reviews","Design feedback","Introductions","Mentoring","Domain expertise","Accountability","Hiring help"]',
 'work_dna', 'work_can_offer', 95),

('Industries you know well?', 'chip_select',
 '["Tech","Fintech","Edtech","Healthtech","Ecommerce","Media","Consulting","SaaS","AI/ML","Crypto"]',
 'work_dna', 'industries', 90),

('When do you do your best work?', 'emoji_pick',
 '[{"id":"morning","emoji":"🌅","label":"Morning"},{"id":"afternoon","emoji":"☀️","label":"Afternoon"},{"id":"evening","emoji":"🌙","label":"Evening"},{"id":"night","emoji":"🦉","label":"Night"}]',
 'work_dna', 'peak_hours', 90),

('Topics you''d chat about over coffee?', 'chip_select',
 '["Startups","AI","Crypto","Design","Fitness","Travel","Books","Music","Food","Gaming","Investing","Writing"]',
 'work_dna', 'topics', 90),

('What drives you most?', 'chip_select',
 '["Impact","Growth","Learning","Fun","Freedom","Money","Creativity","Community"]',
 'work_dna', 'values', 90),

-- ══════ PERSONALITY (priority 50-70) ══════

('Coffee or chai?', 'this_or_that',
 '[{"label":"Coffee","emoji":"☕"},{"label":"Chai","emoji":"🫖"}]',
 'personality', NULL, 70),

('Morning person or night owl?', 'this_or_that',
 '[{"label":"Morning person","emoji":"🌅"},{"label":"Night owl","emoji":"🦉"}]',
 'personality', NULL, 68),

('Introvert recharging or extrovert energizing?', 'this_or_that',
 '[{"label":"Introvert","emoji":"🧘"},{"label":"Extrovert","emoji":"🎉"}]',
 'personality', NULL, 66),

('Music while working?', 'emoji_pick',
 '[{"id":"silence","emoji":"🤫","label":"Silence"},{"id":"lofi","emoji":"🎵","label":"Lo-fi"},{"id":"anything","emoji":"🎸","label":"Anything goes"},{"id":"podcasts","emoji":"🎧","label":"Podcasts"}]',
 'personality', NULL, 65),

('Your ideal noise level?', 'emoji_pick',
 '[{"id":"silent","emoji":"🤫","label":"Library quiet"},{"id":"buzz","emoji":"🎵","label":"Cafe buzz"},{"id":"lively","emoji":"🔊","label":"Lively chatter"}]',
 'personality', NULL, 64),

('Mac, Windows, or Linux?', 'emoji_pick',
 '[{"id":"mac","emoji":"🍎","label":"Mac"},{"id":"windows","emoji":"🪟","label":"Windows"},{"id":"linux","emoji":"🐧","label":"Linux"}]',
 'personality', NULL, 60),

('Tabs or spaces?', 'this_or_that',
 '[{"label":"Tabs","emoji":"⭾"},{"label":"Spaces","emoji":"␣"}]',
 'personality', NULL, 58),

('Meetings: love them or avoid them?', 'this_or_that',
 '[{"label":"Love them","emoji":"📅"},{"label":"Avoid them","emoji":"🏃"}]',
 'personality', NULL, 56),

('Solo focus or collaborative work?', 'this_or_that',
 '[{"label":"Solo focus","emoji":"🎧"},{"label":"Collaborative","emoji":"🤝"}]',
 'personality', NULL, 55),

('Plan everything or wing it?', 'this_or_that',
 '[{"label":"Plan everything","emoji":"📋"},{"label":"Wing it","emoji":"🪂"}]',
 'personality', NULL, 54),

('Minimalist desk or organized chaos?', 'this_or_that',
 '[{"label":"Minimalist","emoji":"🧊"},{"label":"Organized chaos","emoji":"🌪️"}]',
 'personality', NULL, 53),

('Video calls: camera on or off?', 'this_or_that',
 '[{"label":"Camera on","emoji":"📸"},{"label":"Camera off","emoji":"🙈"}]',
 'personality', NULL, 52),

('Notifications: all on or DND?', 'this_or_that',
 '[{"label":"All on","emoji":"🔔"},{"label":"Do not disturb","emoji":"🔕"}]',
 'personality', NULL, 51),

('How open are you to meeting strangers?', 'slider',
 '{"min":1,"max":5,"minLabel":"😰 Nervous","maxLabel":"🤗 Love it"}',
 'personality', NULL, 60),

('Finish early or last-minute rush?', 'this_or_that',
 '[{"label":"Finish early","emoji":"✅"},{"label":"Last minute","emoji":"⏰"}]',
 'personality', NULL, 50),

('Preferred communication?', 'emoji_pick',
 '[{"id":"text","emoji":"💬","label":"Text"},{"id":"call","emoji":"📞","label":"Call"},{"id":"inperson","emoji":"🤝","label":"In person"}]',
 'personality', NULL, 55),

('How do you take feedback?', 'this_or_that',
 '[{"label":"Direct and blunt","emoji":"🎯"},{"label":"Gentle and wrapped","emoji":"🎁"}]',
 'personality', NULL, 52),

('Startup energy or big company stability?', 'this_or_that',
 '[{"label":"Startup energy","emoji":"🚀"},{"label":"Big company","emoji":"🏢"}]',
 'personality', NULL, 54),

('Remote-first or office-first?', 'this_or_that',
 '[{"label":"Remote-first","emoji":"🏠"},{"label":"Office-first","emoji":"🏢"}]',
 'personality', NULL, 53),

-- ══════ LIFESTYLE (priority 30-50) ══════

('Weekend plans usually involve...', 'chip_select',
 '["Hiking","Reading","Gaming","Cooking","Socializing","Sleeping in","Side projects","Gym","Netflix","Exploring"]',
 'lifestyle', NULL, 48),

('Book, podcast, or newsletter?', 'emoji_pick',
 '[{"id":"book","emoji":"📚","label":"Books"},{"id":"podcast","emoji":"🎧","label":"Podcasts"},{"id":"newsletter","emoji":"📧","label":"Newsletters"},{"id":"videos","emoji":"🎬","label":"Videos"}]',
 'lifestyle', NULL, 45),

('Travel: adventure or relaxation?', 'this_or_that',
 '[{"label":"Adventure","emoji":"🧗"},{"label":"Relaxation","emoji":"🏖️"}]',
 'lifestyle', NULL, 44),

('Cook or order in?', 'this_or_that',
 '[{"label":"Cook","emoji":"👨‍🍳"},{"label":"Order in","emoji":"📱"}]',
 'lifestyle', NULL, 42),

('Fitness routine?', 'emoji_pick',
 '[{"id":"gym","emoji":"🏋️","label":"Gym"},{"id":"running","emoji":"🏃","label":"Running"},{"id":"yoga","emoji":"🧘","label":"Yoga"},{"id":"skip","emoji":"😅","label":"What routine?"}]',
 'lifestyle', NULL, 40),

('What matters most?', 'emoji_pick',
 '[{"id":"impact","emoji":"🌍","label":"Impact"},{"id":"growth","emoji":"📈","label":"Growth"},{"id":"fun","emoji":"🎉","label":"Fun"},{"id":"freedom","emoji":"🦅","label":"Freedom"}]',
 'lifestyle', NULL, 42),

('Social battery recharge?', 'this_or_that',
 '[{"label":"Alone time","emoji":"🧘"},{"label":"More people","emoji":"👥"}]',
 'lifestyle', NULL, 38),

('Your go-to stress buster?', 'chip_select',
 '["Music","Exercise","Friends","Food","Sleep","Nature","Gaming","Meditation","Walking","Cooking"]',
 'lifestyle', NULL, 36),

('Dogs or cats?', 'this_or_that',
 '[{"label":"Dogs","emoji":"🐕"},{"label":"Cats","emoji":"🐈"}]',
 'lifestyle', NULL, 35),

('Beach or mountains?', 'this_or_that',
 '[{"label":"Beach","emoji":"🏖️"},{"label":"Mountains","emoji":"🏔️"}]',
 'lifestyle', NULL, 34),

('Sweet or savory?', 'this_or_that',
 '[{"label":"Sweet","emoji":"🍰"},{"label":"Savory","emoji":"🧀"}]',
 'lifestyle', NULL, 32),

('Cinema or OTT at home?', 'this_or_that',
 '[{"label":"Cinema","emoji":"🎬"},{"label":"At home","emoji":"🛋️"}]',
 'lifestyle', NULL, 30),

('How adventurous with food?', 'slider',
 '{"min":1,"max":5,"minLabel":"🍞 Comfort zone","maxLabel":"🌶️ Try everything"}',
 'lifestyle', NULL, 33),

-- ══════ CONTEXTUAL (priority 20-40) ══════

('What are you building right now?', 'quick_text',
 '{"placeholder":"A SaaS tool for...","maxLength":80}',
 'contextual', NULL, 40),

('One skill you want to learn this year?', 'quick_text',
 '{"placeholder":"e.g. Rust, watercolors, public speaking","maxLength":80}',
 'contextual', NULL, 38),

('What''s your superpower at work?', 'quick_text',
 '{"placeholder":"The thing people always come to you for","maxLength":80}',
 'contextual', NULL, 36),

('Ideal coworking buddy in 3 words?', 'quick_text',
 '{"placeholder":"e.g. quiet, focused, funny","maxLength":60}',
 'contextual', NULL, 35),

('What would you teach in a 5-minute talk?', 'quick_text',
 '{"placeholder":"Your unexpected expertise","maxLength":80}',
 'contextual', NULL, 34),

('Best productivity hack?', 'quick_text',
 '{"placeholder":"The one trick that actually works","maxLength":80}',
 'contextual', NULL, 32),

('The app you can''t live without?', 'quick_text',
 '{"placeholder":"Besides DanaDone obviously 😉","maxLength":60}',
 'contextual', NULL, 30),

('Your Monday motivation level?', 'slider',
 '{"min":1,"max":5,"minLabel":"😴 Zero","maxLabel":"🔥 Let''s go"}',
 'contextual', NULL, 28),

('Hours of deep work you can do?', 'slider',
 '{"min":1,"max":8,"minLabel":"1h","maxLabel":"8h+"}',
 'contextual', NULL, 30),

('How many coffees per day?', 'emoji_pick',
 '[{"id":"one","emoji":"☕","label":"Just 1"},{"id":"two_three","emoji":"☕☕","label":"2-3"},{"id":"four_plus","emoji":"☕☕☕","label":"4+"},{"id":"tea","emoji":"🫖","label":"Tea only"}]',
 'contextual', NULL, 28),

('Ideal workspace vibe?', 'emoji_pick',
 '[{"id":"library","emoji":"📚","label":"Library"},{"id":"cafe","emoji":"☕","label":"Cafe"},{"id":"office","emoji":"🏢","label":"Office"},{"id":"outdoors","emoji":"🌳","label":"Outdoors"}]',
 'contextual', NULL, 32),

('How often do you want to cowork?', 'emoji_pick',
 '[{"id":"daily","emoji":"📅","label":"Daily"},{"id":"few","emoji":"📆","label":"3-4x/week"},{"id":"weekly","emoji":"🗓️","label":"1-2x/week"},{"id":"monthly","emoji":"📋","label":"Monthly"}]',
 'contextual', NULL, 34),

('Rate your networking skills', 'slider',
 '{"min":1,"max":5,"minLabel":"😬 Awkward","maxLabel":"🤝 Natural"}',
 'contextual', NULL, 26),

('Your work-life balance?', 'slider',
 '{"min":1,"max":5,"minLabel":"💼 All work","maxLabel":"🌴 All life"}',
 'contextual', NULL, 24),

('Ideal group size for a session?', 'emoji_pick',
 '[{"id":"three","emoji":"👥","label":"3 people"},{"id":"four_five","emoji":"👥👥","label":"4-5"},{"id":"six_plus","emoji":"👥👥👥","label":"6+"}]',
 'contextual', NULL, 35),

('Biggest professional challenge right now?', 'quick_text',
 '{"placeholder":"What keeps you up at night?","maxLength":80}',
 'contextual', NULL, 22),

('Your hot take about work culture?', 'quick_text',
 '{"placeholder":"The opinion that gets people talking","maxLength":80}',
 'contextual', NULL, 20),

('Describe your work style in one emoji', 'quick_text',
 '{"placeholder":"Just one emoji 🎯","maxLength":4}',
 'contextual', NULL, 25),

('What''s your work anthem?', 'quick_text',
 '{"placeholder":"Song that gets you in the zone","maxLength":80}',
 'contextual', NULL, 22);
