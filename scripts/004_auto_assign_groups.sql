-- Auto-assign groups RPC: greedy compatibility-scored grouping algorithm.
-- Picks a seed user, repeatedly adds highest-compatibility unassigned user.
-- Scoring: work_vibe match = 3pts, noise_pref match = 2pts, comm_style match = 2pts,
--          social_goals overlap = 1pt each, introvert_extrovert within 1 = 1pt.
-- Remainder users merge into last group.

CREATE OR REPLACE FUNCTION auto_assign_groups(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_session sessions;
  v_group_size INTEGER;
  v_bookings RECORD;
  v_users UUID[];
  v_prefs JSONB := '{}';
  v_assigned UUID[] := '{}';
  v_group_num INTEGER := 1;
  v_current_group UUID[];
  v_seed UUID;
  v_best_user UUID;
  v_best_score INTEGER;
  v_score INTEGER;
  v_user UUID;
  v_candidate UUID;
  v_pref_a JSONB;
  v_pref_b JSONB;
  v_group_id UUID;
  v_result JSONB := '[]';
  v_overlap INTEGER;
  v_goals_a TEXT[];
  v_goals_b TEXT[];
  v_g TEXT;
BEGIN
  -- Get session details
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  v_group_size := v_session.group_size;

  -- Get all confirmed/paid booking user IDs
  SELECT array_agg(user_id) INTO v_users
  FROM bookings
  WHERE session_id = p_session_id
    AND payment_status IN ('paid', 'confirmed')
    AND cancelled_at IS NULL;

  IF v_users IS NULL OR array_length(v_users, 1) < 2 THEN
    RETURN '{"error": "Not enough users to form groups"}'::JSONB;
  END IF;

  -- Load all preferences into a JSONB map
  FOR v_bookings IN
    SELECT cp.user_id, cp.work_vibe, cp.noise_preference, cp.communication_style,
           cp.social_goals, cp.introvert_extrovert
    FROM coworker_preferences cp
    WHERE cp.user_id = ANY(v_users)
  LOOP
    v_prefs := v_prefs || jsonb_build_object(
      v_bookings.user_id::TEXT,
      jsonb_build_object(
        'work_vibe', v_bookings.work_vibe,
        'noise', v_bookings.noise_preference,
        'comm', v_bookings.communication_style,
        'goals', to_jsonb(v_bookings.social_goals),
        'ie', v_bookings.introvert_extrovert
      )
    );
  END LOOP;

  -- Delete existing groups for this session
  DELETE FROM group_members WHERE group_id IN (
    SELECT id FROM groups WHERE session_id = p_session_id
  );
  DELETE FROM groups WHERE session_id = p_session_id;

  -- Greedy grouping loop
  WHILE array_length(v_users, 1) - array_length(v_assigned, 1) > 0 LOOP
    v_current_group := '{}';

    -- Pick seed: first unassigned user
    v_seed := NULL;
    FOREACH v_user IN ARRAY v_users LOOP
      IF NOT (v_user = ANY(v_assigned)) THEN
        v_seed := v_user;
        EXIT;
      END IF;
    END LOOP;

    IF v_seed IS NULL THEN EXIT; END IF;

    v_current_group := array_append(v_current_group, v_seed);
    v_assigned := array_append(v_assigned, v_seed);

    -- Fill group to group_size
    WHILE array_length(v_current_group, 1) < v_group_size
      AND array_length(v_assigned, 1) < array_length(v_users, 1) LOOP

      v_best_user := NULL;
      v_best_score := -1;

      -- Score each unassigned candidate against seed
      FOREACH v_candidate IN ARRAY v_users LOOP
        IF v_candidate = ANY(v_assigned) THEN CONTINUE; END IF;

        v_pref_a := v_prefs -> v_seed::TEXT;
        v_pref_b := v_prefs -> v_candidate::TEXT;
        v_score := 0;

        -- work_vibe match = 3pts
        IF v_pref_a IS NOT NULL AND v_pref_b IS NOT NULL THEN
          IF (v_pref_a ->> 'work_vibe') = (v_pref_b ->> 'work_vibe') THEN
            v_score := v_score + 3;
          END IF;
          -- noise match = 2pts
          IF (v_pref_a ->> 'noise') = (v_pref_b ->> 'noise') THEN
            v_score := v_score + 2;
          END IF;
          -- comm_style match = 2pts
          IF (v_pref_a ->> 'comm') = (v_pref_b ->> 'comm') THEN
            v_score := v_score + 2;
          END IF;
          -- introvert_extrovert within 1 = 1pt
          IF (v_pref_a ->> 'ie') IS NOT NULL AND (v_pref_b ->> 'ie') IS NOT NULL THEN
            IF ABS((v_pref_a ->> 'ie')::INT - (v_pref_b ->> 'ie')::INT) <= 1 THEN
              v_score := v_score + 1;
            END IF;
          END IF;
          -- social_goals overlap = 1pt each
          IF v_pref_a -> 'goals' IS NOT NULL AND v_pref_b -> 'goals' IS NOT NULL THEN
            SELECT array_agg(g) INTO v_goals_a FROM jsonb_array_elements_text(v_pref_a -> 'goals') AS g;
            SELECT array_agg(g) INTO v_goals_b FROM jsonb_array_elements_text(v_pref_b -> 'goals') AS g;
            IF v_goals_a IS NOT NULL AND v_goals_b IS NOT NULL THEN
              SELECT count(*) INTO v_overlap FROM unnest(v_goals_a) g WHERE g = ANY(v_goals_b);
              v_score := v_score + v_overlap;
            END IF;
          END IF;
        END IF;

        IF v_score > v_best_score THEN
          v_best_score := v_score;
          v_best_user := v_candidate;
        END IF;
      END LOOP;

      IF v_best_user IS NULL THEN EXIT; END IF;

      v_current_group := array_append(v_current_group, v_best_user);
      v_assigned := array_append(v_assigned, v_best_user);
    END LOOP;

    -- If remaining users < group_size, merge into this group
    IF array_length(v_users, 1) - array_length(v_assigned, 1) > 0
       AND array_length(v_users, 1) - array_length(v_assigned, 1) < v_group_size THEN
      FOREACH v_candidate IN ARRAY v_users LOOP
        IF NOT (v_candidate = ANY(v_assigned)) THEN
          v_current_group := array_append(v_current_group, v_candidate);
          v_assigned := array_append(v_assigned, v_candidate);
        END IF;
      END LOOP;
    END IF;

    -- Create group in DB
    INSERT INTO groups (session_id, group_number)
    VALUES (p_session_id, v_group_num)
    RETURNING id INTO v_group_id;

    -- Insert members
    FOREACH v_user IN ARRAY v_current_group LOOP
      INSERT INTO group_members (group_id, user_id) VALUES (v_group_id, v_user);
      -- Update booking with group_id
      UPDATE bookings SET group_id = v_group_id
      WHERE session_id = p_session_id AND user_id = v_user;
    END LOOP;

    v_result := v_result || jsonb_build_object(
      'group_number', v_group_num,
      'group_id', v_group_id,
      'members', to_jsonb(v_current_group),
      'size', array_length(v_current_group, 1)
    );

    v_group_num := v_group_num + 1;
  END LOOP;

  RETURN jsonb_build_object('groups', v_result, 'total_groups', v_group_num - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
