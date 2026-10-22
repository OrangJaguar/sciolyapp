-- Fill each selected event up to questionsPerEvent live questions.

CREATE OR REPLACE FUNCTION "public"."admin_explode_generation_plan"("p_config" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_mode TEXT := COALESCE(p_config->>'mode', 'fill_event');
  v_target INT := GREATEST(COALESCE((p_config->>'targetPerConcept')::INT, 30), 1);
  v_n_per_call INT := GREATEST(LEAST(COALESCE((p_config->>'questionsPerCall')::INT, 15), 30), 1);
  v_pass_mode TEXT := COALESCE(p_config->>'passMode', 'A_then_B');
  v_limit_raw INT := NULLIF(TRIM(COALESCE(p_config->>'limitConcepts', '')), '')::INT;
  v_limit_concepts INT;
  v_event_ids TEXT[];
  v_concept_ids TEXT[];
  v_blockers JSONB := '[]'::jsonb;
  v_items JSONB := '[]'::jsonb;
  v_events JSONB := '[]'::jsonb;
  v_concept RECORD;
  v_gap INT;
  v_coverage INT;
  v_q_cov INT;
  v_inflight INT;
  v_pass_row RECORD;
  v_request_count INT := 0;
  v_question_count INT := 0;
  v_concept_count INT := 0;
  v_skipped_full INT := 0;
  v_scanned INT := 0;
  v_inflight_total INT := 0;
  v_event_id TEXT;
  v_per_event INT := NULLIF((p_config->>'questionsPerEvent')::INT, 0);
  v_event_budget JSONB := '{}'::jsonb;
  v_left INT;
  v_have INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF v_limit_raw IS NULL OR v_limit_raw <= 0 THEN
    v_limit_concepts := NULL;
  ELSE
    v_limit_concepts := v_limit_raw;
  END IF;

  IF NOT public.admin_master_pack_ready() THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'type', 'master_pack',
      'message', 'Master prompt pack is missing or empty'
    ));
  END IF;

  IF v_mode = 'workbench' THEN
    SELECT COALESCE(array_agg(value::TEXT), ARRAY[]::TEXT[])
    INTO v_concept_ids
    FROM jsonb_array_elements_text(COALESCE(p_config->'conceptIds', '[]'::jsonb)) AS t(value);
  ELSE
    IF v_mode = 'fill_season' THEN
      SELECT COALESCE(array_agg(e.id ORDER BY e.name), ARRAY[]::TEXT[])
      INTO v_event_ids
      FROM public.taxonomy_events e
      WHERE e.studyable = TRUE AND e.active = TRUE;
    ELSE
      SELECT COALESCE(array_agg(value::TEXT), ARRAY[]::TEXT[])
      INTO v_event_ids
      FROM jsonb_array_elements_text(COALESCE(p_config->'eventIds', '[]'::jsonb)) AS t(value);
    END IF;

    IF COALESCE(array_length(v_event_ids, 1), 0) = 0 THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'type', 'scope',
        'message', 'No events selected for generation'
      ));
    END IF;

    FOREACH v_event_id IN ARRAY v_event_ids LOOP
      IF NOT public.admin_event_pack_ready(v_event_id) THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'type', 'event_pack',
          'event_id', v_event_id,
          'message', 'Event prompt pack missing or empty'
        ));
      END IF;
    END LOOP;
  END IF;

  -- questionsPerEvent: fill each selected event up to N live questions,
  -- 8-at-a-time across concepts, instead of N per concept.
  IF v_per_event IS NOT NULL AND v_per_event > 0 AND v_mode = 'fill_event' THEN
    FOREACH v_event_id IN ARRAY COALESCE(v_event_ids, ARRAY[]::TEXT[]) LOOP
      SELECT
        COALESCE((
          SELECT count(*)::INT FROM public.questions q
          WHERE q.event_id = v_event_id AND q.status = 'live'
        ), 0)
        + COALESCE((
          SELECT sum(i.n_outstanding)::INT
          FROM public.generation_job_items i
          JOIN public.generation_jobs j ON j.id = i.job_id
          WHERE i.event_id = v_event_id
            AND j.status IN ('queued', 'running', 'paused')
            AND i.status IN ('queued', 'running')
        ), 0)
      INTO v_have;
      v_event_budget := v_event_budget || jsonb_build_object(
        v_event_id,
        GREATEST(v_per_event - COALESCE(v_have, 0), 0)
      );
    END LOOP;
  END IF;

  FOR v_concept IN
    SELECT c.id, c.event_id, c.name
    FROM public.taxonomy_concepts c
    JOIN public.taxonomy_events e ON e.id = c.event_id
    WHERE e.active = TRUE
      AND (
        (v_mode = 'workbench' AND c.id = ANY(v_concept_ids))
        OR (
          v_mode <> 'workbench'
          AND c.event_id = ANY(v_event_ids)
          AND (v_mode <> 'top_up' OR public.admin_effective_concept_coverage(c.id) < v_target)
        )
      )
    ORDER BY c.event_id, c.sort_order, c.id
  LOOP
    IF v_limit_concepts IS NOT NULL AND v_concept_count >= v_limit_concepts THEN
      EXIT;
    END IF;

    v_scanned := v_scanned + 1;

    IF NOT public.admin_event_pack_ready(v_concept.event_id) THEN
      CONTINUE;
    END IF;

    v_q_cov := public.admin_concept_coverage(v_concept.id);
    v_inflight := public.admin_inflight_generation_count(v_concept.id);
    v_coverage := v_q_cov + v_inflight;

    IF v_per_event IS NOT NULL AND v_per_event > 0 AND v_mode = 'fill_event' THEN
      v_left := COALESCE((v_event_budget->>v_concept.event_id)::INT, 0);
      v_gap := LEAST(v_n_per_call, v_left);
      IF v_gap > 0 THEN
        v_event_budget := jsonb_set(
          v_event_budget,
          ARRAY[v_concept.event_id],
          to_jsonb(v_left - v_gap)
        );
      END IF;
    ELSE
      v_gap := GREATEST(v_target - v_coverage, 0);
      IF v_mode = 'workbench' AND COALESCE((p_config->>'fillGap')::BOOLEAN, TRUE) = FALSE THEN
        v_gap := v_n_per_call;
      END IF;
    END IF;

    IF v_gap <= 0 THEN
      IF v_per_event IS NULL OR v_mode <> 'fill_event' THEN
        v_skipped_full := v_skipped_full + 1;
      END IF;
      CONTINUE;
    END IF;

    v_concept_count := v_concept_count + 1;
    v_inflight_total := v_inflight_total + v_inflight;

    FOR v_pass_row IN
      SELECT * FROM public.admin_split_concept_passes(v_gap, v_n_per_call, v_pass_mode)
    LOOP
      v_request_count := v_request_count + 1;
      v_question_count := v_question_count + v_pass_row.n_requested;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'event_id', v_concept.event_id,
        'concept_id', v_concept.id,
        'concept_name', v_concept.name,
        'pass', v_pass_row.pass,
        'n_requested', v_pass_row.n_requested,
        'coverage_before', v_coverage,
        'questions_before', v_q_cov,
        'inflight_before', v_inflight
      ));
    END LOOP;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name)), '[]'::jsonb)
  INTO v_events
  FROM public.taxonomy_events e
  WHERE (
    (v_mode = 'workbench' AND e.id IN (
      SELECT DISTINCT c.event_id FROM public.taxonomy_concepts c WHERE c.id = ANY(v_concept_ids)
    ))
    OR (v_mode <> 'workbench' AND e.id = ANY(v_event_ids))
  );

  RETURN jsonb_build_object(
    'blockers', v_blockers,
    'events', v_events,
    'concept_count', v_concept_count,
    'request_count', v_request_count,
    'question_count', v_question_count,
    'skipped_full', v_skipped_full,
    'scanned', v_scanned,
    'inflight_reserved', v_inflight_total,
    'items', v_items,
    'eta_minutes', CEIL(v_request_count * 1.8 / 60.0)
  );
END;
$$;
