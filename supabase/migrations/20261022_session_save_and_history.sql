-- Fix streak date cast and record answered questions so the next run can rotate.

CREATE OR REPLACE FUNCTION "public"."process_session_answers"("p_user_id" "uuid", "p_session_token" "text", "p_mode" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_tz" "text", "p_min_response_ms" integer, "p_correct_xp" integer, "p_incorrect_xp" integer, "p_flawless_bonus" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_answer jsonb;
  v_skipped boolean;
  v_is_correct boolean;
  v_response_ms integer;
  v_invalidated boolean;
  v_base_xp integer := 0;
  v_valid_count integer := 0;
  v_valid_correct integer := 0;
  v_invalidated_count integer := 0;
  v_skipped_count integer := 0;
  v_answered_count integer := 0;
  v_correct_count integer := 0;
  v_flawless boolean := false;
  v_has_invalid_or_skip boolean := false;
  v_has_incorrect boolean := false;
  v_xp_result record;
  v_streak integer;
  v_xp_total integer;
  v_badge jsonb;
  v_question_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM practice_session_commits
    WHERE user_id = p_user_id AND session_token = p_session_token AND mode = p_mode
  ) THEN
    SELECT xp, current_streak INTO v_xp_total, v_streak FROM profiles WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'already_committed', true,
      'xp_awarded', 0,
      'xp_total', COALESCE(v_xp_total, 0),
      'streak', COALESCE(v_streak, 0),
      'answered', 0,
      'correct', 0,
      'skipped', 0,
      'invalidated', 0,
      'flawless', false,
      'cap_hit', false,
      'newly_unlocked', '[]'::jsonb
    );
  END IF;

  FOR v_answer IN SELECT value FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb))
  LOOP
    v_skipped := COALESCE((v_answer->>'skipped')::boolean, false);

    IF v_skipped THEN
      v_skipped_count := v_skipped_count + 1;
      v_has_invalid_or_skip := true;
      INSERT INTO practice_session_answers (
        user_id, session_token, mode, question_id, event_id, topic_id,
        is_correct, skipped, invalidated, response_ms
      ) VALUES (
        p_user_id, p_session_token, p_mode,
        (v_answer->>'question_id'), p_event_id, p_topic_id,
        NULL, true, false, NULL
      );
      CONTINUE;
    END IF;

    v_response_ms := NULLIF(v_answer->>'response_ms', '')::integer;
    v_is_correct := COALESCE((v_answer->>'is_correct')::boolean, false);
    v_invalidated := v_response_ms IS NOT NULL AND v_response_ms < p_min_response_ms;

    IF v_invalidated THEN
      v_invalidated_count := v_invalidated_count + 1;
      v_has_invalid_or_skip := true;
      INSERT INTO invalidated_answer_events (user_id, question_id, mode, response_ms)
      VALUES (p_user_id, v_answer->>'question_id', p_mode, v_response_ms);
      INSERT INTO practice_session_answers (
        user_id, session_token, mode, question_id, event_id, topic_id,
        is_correct, skipped, invalidated, response_ms
      ) VALUES (
        p_user_id, p_session_token, p_mode,
        (v_answer->>'question_id'), p_event_id, p_topic_id,
        NULL, false, true, v_response_ms
      );
      CONTINUE;
    END IF;

    v_valid_count := v_valid_count + 1;
    v_answered_count := v_answered_count + 1;

    IF v_is_correct THEN
      v_valid_correct := v_valid_correct + 1;
      v_correct_count := v_correct_count + 1;
      v_base_xp := v_base_xp + p_correct_xp;
    ELSE
      v_has_incorrect := true;
      v_base_xp := v_base_xp + p_incorrect_xp;
    END IF;

    INSERT INTO practice_session_answers (
      user_id, session_token, mode, question_id, event_id, topic_id,
      is_correct, skipped, invalidated, response_ms
    ) VALUES (
      p_user_id, p_session_token, p_mode,
      (v_answer->>'question_id'), p_event_id, p_topic_id,
      v_is_correct, false, false, v_response_ms
    );

    BEGIN
      v_question_id := NULLIF(v_answer->>'question_id', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_question_id := NULL;
    END;

    IF v_question_id IS NOT NULL THEN
      INSERT INTO user_history (user_id, question_id, answered_at, is_correct)
      VALUES (p_user_id, v_question_id, clock_timestamp(), v_is_correct);

      INSERT INTO user_weakness_map (user_id, concept_id, total_attempts, correct_attempts)
      SELECT p_user_id, q.concept_id, 1, CASE WHEN v_is_correct THEN 1 ELSE 0 END
      FROM questions q
      WHERE q.id = v_question_id
        AND q.concept_id IS NOT NULL
      ON CONFLICT (user_id, concept_id) DO UPDATE
      SET total_attempts = user_weakness_map.total_attempts + 1,
          correct_attempts = user_weakness_map.correct_attempts + EXCLUDED.correct_attempts;

      IF NOT v_is_correct THEN
        INSERT INTO reinjection_queue (user_id, question_id, unlock_at)
        VALUES (p_user_id, v_question_id, now() + interval '6 hours');
      END IF;
    END IF;
  END LOOP;

  IF v_valid_count >= 5
     AND NOT v_has_invalid_or_skip
     AND NOT v_has_incorrect
     AND v_valid_correct = v_valid_count THEN
    v_flawless := true;
    v_base_xp := v_base_xp + p_flawless_bonus;
  END IF;

  IF v_valid_count >= 1 THEN
    v_streak := touch_user_streak(p_user_id, p_tz);
  ELSE
    SELECT current_streak INTO v_streak FROM profiles WHERE id = p_user_id;
  END IF;

  SELECT * INTO v_xp_result FROM apply_practice_xp(p_user_id, v_base_xp, p_tz);

  INSERT INTO practice_session_commits (user_id, session_token, mode, flawless)
  VALUES (p_user_id, p_session_token, p_mode, v_flawless);

  UPDATE profiles
  SET questions_answered = COALESCE(questions_answered, 0) + v_answered_count
  WHERE id = p_user_id;

  PERFORM sync_my_mission_progress_for_user(p_user_id);
  v_badge := sync_my_badges_for_user(p_user_id);

  SELECT xp INTO v_xp_total FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'already_committed', false,
    'xp_awarded', COALESCE(v_xp_result.xp_awarded, 0) + COALESCE(NULLIF(v_badge->>'xp_awarded','')::integer, 0),
    'xp_total', COALESCE(v_xp_total, 0),
    'streak', COALESCE(v_streak, 0),
    'answered', v_answered_count,
    'correct', v_correct_count,
    'skipped', v_skipped_count,
    'invalidated', v_invalidated_count,
    'flawless', v_flawless,
    'cap_hit', COALESCE(v_xp_result.cap_hit, false),
    'newly_unlocked', COALESCE(v_badge->'newly_unlocked', '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."touch_user_streak"("p_user_id" "uuid", "p_tz" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_local date := scioly_local_date(p_tz);
  v_streak integer;
  v_last date;
BEGIN
  SELECT current_streak, last_activity_on::date
  INTO v_streak, v_last
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_last IS NULL THEN
    v_streak := 1;
  ELSIF v_last = v_local THEN
    v_streak := GREATEST(COALESCE(v_streak, 0), 1);
  ELSIF v_last = v_local - 1 THEN
    v_streak := GREATEST(COALESCE(v_streak, 0), 0) + 1;
  ELSE
    v_streak := 1;
  END IF;

  UPDATE profiles
  SET
    current_streak = v_streak,
    last_activity_on = v_local,
    timezone = COALESCE(NULLIF(trim(p_tz), ''), timezone, 'UTC')
  WHERE id = p_user_id;

  RETURN v_streak;
END;
$$;
