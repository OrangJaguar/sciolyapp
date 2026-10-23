


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."division_type" AS ENUM (
    'B',
    'C'
);


ALTER TYPE "public"."division_type" OWNER TO "postgres";


CREATE TYPE "public"."question_status" AS ENUM (
    'draft',
    'live',
    'archived'
);


ALTER TYPE "public"."question_status" OWNER TO "postgres";


CREATE TYPE "public"."question_type" AS ENUM (
    'mcq',
    'diagram',
    'calc'
);


ALTER TYPE "public"."question_type" OWNER TO "postgres";


CREATE TYPE "public"."team_role" AS ENUM (
    'coach',
    'captain',
    'officer',
    'member'
);


ALTER TYPE "public"."team_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_append_raw_excerpt"("p_existing" "text", "p_incoming" "text", "p_attempt" integer, "p_finish_reason" "text" DEFAULT NULL::"text", "p_cap" integer DEFAULT 200000) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_header TEXT;
  v_combined TEXT;
BEGIN
  IF p_incoming IS NULL OR length(trim(p_incoming)) = 0 THEN
    RETURN LEFT(COALESCE(p_existing, ''), p_cap);
  END IF;

  v_header := format(
    E'\n\n===== NIM attempt %s%s =====\n',
    GREATEST(COALESCE(p_attempt, 1), 1),
    CASE
      WHEN p_finish_reason IS NOT NULL AND p_finish_reason <> ''
      THEN format(' · finish_reason=%s', p_finish_reason)
      ELSE ''
    END
  );

  IF COALESCE(p_existing, '') = '' THEN
    v_combined := v_header || p_incoming;
  ELSE
    v_combined := p_existing || v_header || p_incoming;
  END IF;

  RETURN LEFT(v_combined, p_cap);
END;
$$;


ALTER FUNCTION "public"."admin_append_raw_excerpt"("p_existing" "text", "p_incoming" "text", "p_attempt" integer, "p_finish_reason" "text", "p_cap" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_apply_critic_result"("p_question_id" "uuid", "p_score" numeric, "p_notes" "text", "p_route" "text", "p_audit" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_q public.questions;
  v_route TEXT := lower(trim(COALESCE(p_route, 'auto_live')));
  v_new_status TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF v_route NOT IN ('auto_live', 'human', 'reject_regen') THEN
    v_route := 'auto_live';
  END IF;

  SELECT * INTO v_q FROM public.questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found';
  END IF;

  IF v_q.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_draft');
  END IF;

  IF v_route = 'auto_live' THEN
    v_new_status := 'live';
  ELSIF v_route = 'reject_regen' THEN
    v_new_status := 'archived';
  ELSE
    v_new_status := 'draft';
  END IF;

  UPDATE public.questions
  SET
    status = v_new_status,
    critic_score = p_score,
    critic_notes = LEFT(COALESCE(p_notes, ''), 4000),
    critic_route = v_route,
    critic_routed_at = NOW(),
    critic_audit = COALESCE(p_audit, FALSE),
    needs_fix = CASE WHEN v_route = 'human' THEN needs_fix ELSE FALSE END
  WHERE id = p_question_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'route', v_route,
    'status', v_new_status,
    'audit', COALESCE(p_audit, FALSE)
  );
END;
$$;


ALTER FUNCTION "public"."admin_apply_critic_result"("p_question_id" "uuid", "p_score" numeric, "p_notes" "text", "p_route" "text", "p_audit" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_archive_import_batch"("p_batch_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INT;
  v_citation TEXT := 'import:' || p_batch_id::TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.questions
  SET status = 'archived'
  WHERE citation = v_citation
    AND status IN ('draft', 'live');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.import_batches
  SET status = 'archived', archived_at = NOW()
  WHERE id = p_batch_id;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."admin_archive_import_batch"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_bulk_set_question_status"("p_ids" "uuid"[], "p_status" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF p_status NOT IN ('live', 'draft', 'archived') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.questions
  SET status = p_status,
      needs_fix = CASE WHEN p_status = 'live' THEN FALSE ELSE needs_fix END
  WHERE id = ANY (p_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."admin_bulk_set_question_status"("p_ids" "uuid"[], "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_clear_incomplete_generation"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_jobs INT;
  v_items INT;
  v_stale JSONB;
  v_orphans JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  v_stale := public.admin_generation_recover_stale_items(NULL, 60);

  UPDATE public.generation_job_items i
  SET
    status = 'failed',
    diagnosis = COALESCE(diagnosis, 'cleared_incomplete'),
    error = COALESCE(error, 'Cleared: incomplete generation reset'),
    finished_at = COALESCE(finished_at, NOW())
  FROM public.generation_jobs j
  WHERE i.job_id = j.id
    AND i.status IN ('queued', 'running')
    AND j.status IN ('queued', 'running', 'paused');

  GET DIAGNOSTICS v_items = ROW_COUNT;

  UPDATE public.generation_jobs
  SET
    status = 'cancelled',
    pause_reason = 'cleared_incomplete',
    finished_at = COALESCE(finished_at, NOW()),
    updated_at = NOW()
  WHERE status IN ('queued', 'running', 'paused');

  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  v_orphans := public.admin_clear_orphan_fingerprints();

  RETURN jsonb_build_object(
    'jobs_cancelled', v_jobs,
    'items_cleared', v_items,
    'stale_recovered_first', v_stale,
    'orphan_fingerprints_deleted', v_orphans->>'orphan_fingerprints_deleted'
  );
END;
$$;


ALTER FUNCTION "public"."admin_clear_incomplete_generation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_clear_orphan_fingerprints"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  DELETE FROM public.question_fingerprints f
  WHERE NOT EXISTS (
    SELECT 1 FROM public.questions q WHERE q.id = f.question_id
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('orphan_fingerprints_deleted', v_deleted);
END;
$$;


ALTER FUNCTION "public"."admin_clear_orphan_fingerprints"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_commit_import_batch"("p_event_id" "text", "p_source" "text", "p_label" "text", "p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_batch_id UUID;
  v_event public.taxonomy_events;
  v_row JSONB;
  v_concept public.taxonomy_concepts;
  v_stem TEXT;
  v_options JSONB;
  v_key TEXT;
  v_expl TEXT;
  v_concept_id TEXT;
  v_count INT := 0;
  v_skipped INT := 0;
  v_citation TEXT;
  v_shuffled JSONB;
  v_question_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_event FROM public.taxonomy_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not found';
  END IF;

  IF p_source NOT IN ('paste', 'pdf', 'csv', 'json') THEN
    RAISE EXCEPTION 'invalid source';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'no rows to import';
  END IF;

  INSERT INTO public.import_batches (event_id, source, label, row_count, created_by)
  VALUES (
    p_event_id,
    p_source,
    COALESCE(NULLIF(trim(p_label), ''), p_source || ' import'),
    0,
    auth.uid()
  )
  RETURNING id INTO v_batch_id;

  v_citation := 'import:' || v_batch_id::TEXT;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) AS t(value)
  LOOP
    v_stem := trim(COALESCE(v_row->>'stem', ''));
    v_options := v_row->'options';
    v_key := upper(trim(COALESCE(v_row->>'correct_key', '')));
    v_expl := trim(COALESCE(v_row->>'explanation', 'Imported practice item.'));
    v_concept_id := trim(COALESCE(v_row->>'concept_id', ''));

    IF v_stem = '' OR v_key NOT IN ('A', 'B', 'C', 'D') THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_options IS NULL
       OR trim(COALESCE(v_options->>'A', '')) = ''
       OR trim(COALESCE(v_options->>'B', '')) = ''
       OR trim(COALESCE(v_options->>'C', '')) = ''
       OR trim(COALESCE(v_options->>'D', '')) = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_concept
    FROM public.taxonomy_concepts
    WHERE id = v_concept_id AND event_id = p_event_id;

    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF public.admin_fingerprint_is_dup(v_concept_id, v_stem) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_shuffled := public.admin_shuffle_mcq_options(v_options, v_key);

    INSERT INTO public.questions (
      season_ids, division, event_id, topic_id, concept_id,
      question_type, status, stem, options, correct_key, explanation, citation
    ) VALUES (
      ARRAY[v_event.season],
      v_event.division,
      p_event_id,
      v_concept.topic_id,
      v_concept_id,
      'mcq',
      'draft',
      v_stem,
      v_shuffled->'options',
      v_shuffled->>'correct_key',
      v_expl,
      v_citation
    )
    RETURNING id INTO v_question_id;

    INSERT INTO public.question_fingerprints (
      event_id, concept_id, question_id, stem_norm, exact_hash
    ) VALUES (
      p_event_id,
      v_concept_id,
      v_question_id,
      public.admin_normalize_stem(v_stem),
      public.admin_stem_exact_hash(v_stem)
    );

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    DELETE FROM public.import_batches WHERE id = v_batch_id;
    RAISE EXCEPTION 'No valid rows imported (check concept_ids and options)';
  END IF;

  UPDATE public.import_batches SET row_count = v_count WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'imported', v_count,
    'skipped', v_skipped,
    'citation', v_citation
  );
END;
$$;


ALTER FUNCTION "public"."admin_commit_import_batch"("p_event_id" "text", "p_source" "text", "p_label" "text", "p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_concept_coverage"("p_concept_id" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::INT
    FROM public.questions q
    WHERE q.concept_id = p_concept_id
      AND q.status IN ('live', 'draft')
  ), 0);
$$;


ALTER FUNCTION "public"."admin_concept_coverage"("p_concept_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_generation_job"("p_config" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan JSONB;
  v_job_id UUID;
  v_kind TEXT;
  v_item JSONB;
  v_n INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  v_plan := public.admin_explode_generation_plan(p_config);

  IF jsonb_array_length(COALESCE(v_plan->'blockers', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Generation blocked: %', v_plan->'blockers';
  END IF;

  IF COALESCE((v_plan->>'request_count')::INT, 0) = 0 THEN
    RAISE EXCEPTION 'Nothing to generate — all concepts at or above target';
  END IF;

  v_kind := CASE
    WHEN COALESCE(p_config->>'mode', '') = 'workbench' THEN 'workbench'
    ELSE 'campaign'
  END;

  INSERT INTO public.generation_jobs (
    kind, status, config, items_total, blockers, created_by, started_at
  ) VALUES (
    v_kind,
    'running',
    p_config,
    COALESCE((v_plan->>'request_count')::INT, 0),
    COALESCE(v_plan->'blockers', '[]'::jsonb),
    auth.uid(),
    NOW()
  )
  RETURNING id INTO v_job_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_plan->'items') AS t(value)
  LOOP
    v_n := (v_item->>'n_requested')::INT;
    INSERT INTO public.generation_job_items (
      job_id, event_id, concept_id, pass, n_requested, n_outstanding, status
    ) VALUES (
      v_job_id,
      v_item->>'event_id',
      v_item->>'concept_id',
      v_item->>'pass',
      v_n,
      v_n,
      'queued'
    );
  END LOOP;

  RETURN v_job_id;
END;
$$;


ALTER FUNCTION "public"."admin_create_generation_job"("p_config" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_ids" integer[] DEFAULT '{2027}'::integer[] NOT NULL,
    "division" "public"."division_type" DEFAULT 'C'::"public"."division_type" NOT NULL,
    "event_id" "text" NOT NULL,
    "topic_id" "text",
    "concept_id" "text",
    "question_type" "public"."question_type" DEFAULT 'mcq'::"public"."question_type" NOT NULL,
    "status" "public"."question_status" DEFAULT 'draft'::"public"."question_status" NOT NULL,
    "stem" "text" NOT NULL,
    "media_url" "text",
    "options" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "correct_key" character varying(1) NOT NULL,
    "explanation" "text" DEFAULT ''::"text" NOT NULL,
    "citation" "text" DEFAULT ''::"text" NOT NULL,
    "times_served" integer DEFAULT 0 NOT NULL,
    "global_accuracy" double precision DEFAULT 0.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "needs_fix" boolean DEFAULT false NOT NULL,
    "critic_score" numeric,
    "critic_notes" "text",
    "critic_routed_at" timestamp with time zone,
    "critic_route" "text",
    "critic_audit" boolean DEFAULT false NOT NULL,
    "media_id" "uuid",
    CONSTRAINT "questions_critic_route_check" CHECK ((("critic_route" IS NULL) OR ("critic_route" = ANY (ARRAY['auto_live'::"text", 'human'::"text", 'reject_regen'::"text"]))))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."questions"."media_id" IS 'Optional figure from event_media; when set, arena must resolve source_url or quarantine the question.';



CREATE OR REPLACE FUNCTION "public"."admin_critic_claim_batch"("p_limit" integer DEFAULT 8) RETURNS SETOF "public"."questions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.questions q
    WHERE q.status = 'draft'
      AND q.critic_route IS NULL
      AND (
        q.critic_routed_at IS NULL
        OR q.critic_routed_at < NOW() - INTERVAL '5 minutes'
      )
    ORDER BY q.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(LEAST(COALESCE(p_limit, 8), 20), 1)
  ),
  claimed AS (
    UPDATE public.questions q
    SET critic_routed_at = NOW()
    FROM picked p
    WHERE q.id = p.id
    RETURNING q.*
  )
  SELECT * FROM claimed;
END;
$$;


ALTER FUNCTION "public"."admin_critic_claim_batch"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_critic_stats"("p_event_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'unrouted', COUNT(*) FILTER (WHERE status = 'draft' AND critic_route IS NULL),
    'human', COUNT(*) FILTER (
      WHERE status = 'draft' AND (critic_route = 'human' OR needs_fix)
    ),
    'auto_live', COUNT(*) FILTER (WHERE critic_route = 'auto_live'),
    'reject_regen', COUNT(*) FILTER (WHERE critic_route = 'reject_regen'),
    'audit', COUNT(*) FILTER (WHERE critic_audit),
    'draft_total', COUNT(*) FILTER (WHERE status = 'draft'),
    'live_total', COUNT(*) FILTER (WHERE status = 'live')
  )
  FROM public.questions
  WHERE p_event_id IS NULL OR event_id = p_event_id;
$$;


ALTER FUNCTION "public"."admin_critic_stats"("p_event_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_generation_job"("p_job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  DELETE FROM public.generation_jobs WHERE id = p_job_id;
END;
$$;


ALTER FUNCTION "public"."admin_delete_generation_job"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_effective_concept_coverage"("p_concept_id" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.admin_concept_coverage(p_concept_id)
       + public.admin_inflight_generation_count(p_concept_id);
$$;


ALTER FUNCTION "public"."admin_effective_concept_coverage"("p_concept_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_media_menu"("p_event_id" "text", "p_concept_id" "text", "p_limit" integer DEFAULT 8) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  FROM (
    SELECT
      m.id,
      m.label,
      COALESCE(NULLIF(trim(m.description), ''), NULLIF(trim(m.notes), ''), m.label)
        AS description,
      m.tags,
      m.specificity
    FROM public.event_media m
    JOIN public.taxonomy_concepts c ON c.id = p_concept_id
    WHERE m.event_id = p_event_id
      AND m.active = TRUE
      AND (
        COALESCE(cardinality(m.tags), 0) = 0
        OR m.tags && COALESCE(c.depth_tags, ARRAY[]::TEXT[])
      )
    ORDER BY
      CASE m.specificity WHEN 'specific' THEN 0 ELSE 1 END,
      m.created_at DESC
    LIMIT GREATEST(LEAST(COALESCE(p_limit, 8), 20), 1)
  ) t;
$$;


ALTER FUNCTION "public"."admin_event_media_menu"("p_event_id" "text", "p_concept_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_media_usage"("p_event_id" "text") RETURNS TABLE("media_id" "uuid", "live_count" bigint, "draft_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    m.id AS media_id,
    COUNT(*) FILTER (WHERE q.status = 'live') AS live_count,
    COUNT(*) FILTER (WHERE q.status = 'draft') AS draft_count
  FROM public.event_media m
  LEFT JOIN public.questions q ON q.media_id = m.id
  WHERE m.event_id = p_event_id
  GROUP BY m.id;
$$;


ALTER FUNCTION "public"."admin_event_media_usage"("p_event_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_pack_ready"("p_event_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prompt_packs p
    WHERE p.id = 'event:' || p_event_id
      AND p.active = TRUE
      AND length(trim(p.system_body)) > 0
  );
$$;


ALTER FUNCTION "public"."admin_event_pack_ready"("p_event_id" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."admin_explode_generation_plan"("p_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_fingerprint_is_dup"("p_concept_id" "text", "p_stem" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_norm TEXT := public.admin_normalize_stem(p_stem);
  v_hash TEXT := public.admin_stem_exact_hash(p_stem);
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF v_norm = '' THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_fingerprints f
    WHERE f.concept_id = p_concept_id
      AND (
        f.exact_hash = v_hash
        OR similarity(f.stem_norm, v_norm) > 0.82
      )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.questions q
    WHERE q.concept_id = p_concept_id
      AND q.status IN ('live', 'draft')
      AND (
        public.admin_stem_exact_hash(q.stem) = v_hash
        OR similarity(public.admin_normalize_stem(q.stem), v_norm) > 0.82
      )
  );
END;
$$;


ALTER FUNCTION "public"."admin_fingerprint_is_dup"("p_concept_id" "text", "p_stem" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_job_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "concept_id" "text" NOT NULL,
    "pass" "text" NOT NULL,
    "n_requested" integer NOT NULL,
    "n_written" integer DEFAULT 0 NOT NULL,
    "n_rejected" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "error" "text",
    "raw_excerpt" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "n_outstanding" integer DEFAULT 0 NOT NULL,
    "shortfall_retries" integer DEFAULT 0 NOT NULL,
    "finish_reason" "text",
    "token_usage" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_claimed_at" timestamp with time zone,
    "diagnosis" "text",
    "required_media_id" "uuid",
    CONSTRAINT "generation_job_items_n_requested_check" CHECK ((("n_requested" > 0) AND ("n_requested" <= 30))),
    CONSTRAINT "generation_job_items_pass_check" CHECK (("pass" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"]))),
    CONSTRAINT "generation_job_items_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'done'::"text", 'failed'::"text", 'skipped'::"text", 'partial'::"text"])))
);


ALTER TABLE "public"."generation_job_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."generation_job_items"."diagnosis" IS 'Machine-readable fail/shortfall class: stale_timeout, cot_leak, parse_fail, nim_error, shortfall, dup_reject, empty_batch, worker_crash';



COMMENT ON COLUMN "public"."generation_job_items"."required_media_id" IS 'When set, generation context narrows media_menu and prompts require attach.';



CREATE OR REPLACE FUNCTION "public"."admin_generation_claim_item"("p_job_id" "uuid") RETURNS "public"."generation_job_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item public.generation_job_items;
  v_job public.generation_jobs;
  v_inflight INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_job FROM public.generation_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;

  IF v_job.status IN ('cancelled', 'failed', 'done') THEN
    RETURN NULL;
  END IF;

  IF v_job.status = 'paused' THEN
    RETURN NULL;
  END IF;

  -- Unstick zombies before taking the next queued row
  PERFORM public.admin_generation_recover_stale_items(p_job_id, 240);

  SELECT * INTO v_item
  FROM public.generation_job_items
  WHERE job_id = p_job_id AND status = 'queued'
  ORDER BY
    CASE pass WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,
    created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT COUNT(*) INTO v_inflight
    FROM public.generation_job_items
    WHERE job_id = p_job_id
      AND status IN ('queued', 'running');

    IF v_inflight = 0 THEN
      UPDATE public.generation_jobs
      SET status = 'done', finished_at = NOW(), updated_at = NOW()
      WHERE id = p_job_id AND status = 'running';
    END IF;

    RETURN NULL;
  END IF;

  UPDATE public.generation_job_items
  SET
    status = 'running',
    attempt_count = attempt_count + 1,
    started_at = COALESCE(started_at, NOW()),
    last_claimed_at = NOW(),
    error = NULL
  WHERE id = v_item.id
  RETURNING * INTO v_item;

  IF v_job.status = 'queued' THEN
    UPDATE public.generation_jobs
    SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  RETURN v_item;
END;
$$;


ALTER FUNCTION "public"."admin_generation_claim_item"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_generation_complete_item"("p_item_id" "uuid", "p_written" integer, "p_rejected" integer, "p_raw_excerpt" "text" DEFAULT NULL::"text", "p_token_usage" "jsonb" DEFAULT '{}'::"jsonb", "p_finish_reason" "text" DEFAULT NULL::"text", "p_diagnosis" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item public.generation_job_items;
  v_written_this INT := GREATEST(COALESCE(p_written, 0), 0);
  v_rejected_this INT := GREATEST(COALESCE(p_rejected, 0), 0);
  v_new_written INT;
  v_new_outstanding INT;
  v_new_rejected INT;
  v_status TEXT;
  v_merged_usage JSONB;
  v_attempt INT;
  v_diag TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_item FROM public.generation_job_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  v_new_written := v_item.n_written + v_written_this;
  v_new_rejected := v_item.n_rejected + v_rejected_this;
  v_new_outstanding := GREATEST(v_item.n_requested - v_new_written, 0);
  v_merged_usage := public.admin_merge_token_usage(
    COALESCE(v_item.token_usage, '{}'::jsonb),
    COALESCE(p_token_usage, '{}'::jsonb)
  );
  v_attempt := GREATEST(COALESCE(v_item.shortfall_retries, 0) + 1, 1);
  v_diag := NULLIF(TRIM(COALESCE(p_diagnosis, '')), '');

  IF v_new_outstanding > 0 AND v_item.shortfall_retries < 2 THEN
    UPDATE public.generation_job_items
    SET
      status = 'queued',
      n_written = v_new_written,
      n_rejected = v_new_rejected,
      n_outstanding = v_new_outstanding,
      shortfall_retries = shortfall_retries + 1,
      finish_reason = p_finish_reason,
      token_usage = v_merged_usage,
      diagnosis = COALESCE(v_diag, 'shortfall'),
      raw_excerpt = public.admin_append_raw_excerpt(
        v_item.raw_excerpt,
        p_raw_excerpt,
        v_attempt,
        p_finish_reason,
        200000
      ),
      error = format(
        'Shortfall: %s/%s written (%s rejected this call) — requeued for %s more (retry %s/2)%s',
        v_new_written,
        v_item.n_requested,
        v_rejected_this,
        v_new_outstanding,
        v_item.shortfall_retries + 1,
        CASE WHEN v_diag IS NOT NULL THEN format(' [%s]', v_diag) ELSE '' END
      ),
      finished_at = NULL
    WHERE id = p_item_id;

    UPDATE public.generation_jobs j
    SET
      questions_written = questions_written + v_written_this,
      token_usage = public.admin_merge_token_usage(
        COALESCE(j.token_usage, '{}'::jsonb),
        COALESCE(p_token_usage, '{}'::jsonb)
      ),
      updated_at = NOW()
    WHERE id = v_item.job_id;

    RETURN jsonb_build_object(
      'status', 'queued',
      'requeued', TRUE,
      'n_written', v_new_written,
      'n_outstanding', v_new_outstanding,
      'shortfall_retries', v_item.shortfall_retries + 1,
      'diagnosis', COALESCE(v_diag, 'shortfall')
    );
  END IF;

  IF v_new_outstanding <= 0 THEN
    v_status := 'done';
  ELSIF v_new_written > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'failed';
  END IF;

  UPDATE public.generation_job_items
  SET
    status = v_status,
    n_written = v_new_written,
    n_rejected = v_new_rejected,
    n_outstanding = v_new_outstanding,
    finish_reason = p_finish_reason,
    token_usage = v_merged_usage,
    diagnosis = CASE
      WHEN v_status = 'done' THEN COALESCE(v_diag, diagnosis)
      WHEN v_status = 'partial' THEN COALESCE(v_diag, 'shortfall_exhausted')
      ELSE COALESCE(v_diag, 'empty_batch')
    END,
    raw_excerpt = public.admin_append_raw_excerpt(
      v_item.raw_excerpt,
      p_raw_excerpt,
      v_attempt,
      p_finish_reason,
      200000
    ),
    error = CASE
      WHEN v_status = 'done' THEN NULL
      WHEN v_status = 'partial' THEN format(
        'Partial after %s shortfall retries: %s/%s written, %s rejected total',
        v_item.shortfall_retries,
        v_new_written,
        v_item.n_requested,
        v_new_rejected
      )
      ELSE format('No questions written (%s rejected)', v_new_rejected)
    END,
    finished_at = NOW()
  WHERE id = p_item_id;

  UPDATE public.generation_jobs j
  SET
    items_done = items_done + CASE WHEN v_status = 'done' THEN 1 ELSE 0 END,
    items_partial = items_partial + CASE WHEN v_status = 'partial' THEN 1 ELSE 0 END,
    items_failed = items_failed + CASE WHEN v_status = 'failed' THEN 1 ELSE 0 END,
    questions_written = questions_written + v_written_this,
    token_usage = public.admin_merge_token_usage(
      COALESCE(j.token_usage, '{}'::jsonb),
      COALESCE(p_token_usage, '{}'::jsonb)
    ),
    updated_at = NOW()
  WHERE id = v_item.job_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'requeued', FALSE,
    'n_written', v_new_written,
    'n_outstanding', v_new_outstanding,
    'diagnosis', COALESCE(v_diag, v_status)
  );
END;
$$;


ALTER FUNCTION "public"."admin_generation_complete_item"("p_item_id" "uuid", "p_written" integer, "p_rejected" integer, "p_raw_excerpt" "text", "p_token_usage" "jsonb", "p_finish_reason" "text", "p_diagnosis" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_generation_fail_item"("p_item_id" "uuid", "p_error" "text", "p_raw_excerpt" "text" DEFAULT NULL::"text", "p_token_usage" "jsonb" DEFAULT '{}'::"jsonb", "p_finish_reason" "text" DEFAULT NULL::"text", "p_diagnosis" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item public.generation_job_items;
  v_merged_usage JSONB;
  v_attempt INT;
  v_status TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_item FROM public.generation_job_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  v_merged_usage := public.admin_merge_token_usage(
    COALESCE(v_item.token_usage, '{}'::jsonb),
    COALESCE(p_token_usage, '{}'::jsonb)
  );
  v_attempt := GREATEST(COALESCE(v_item.attempt_count, v_item.shortfall_retries + 1, 1), 1);
  v_status := CASE WHEN v_item.n_written > 0 THEN 'partial' ELSE 'failed' END;

  UPDATE public.generation_job_items
  SET
    status = v_status,
    error = LEFT(p_error, 2000),
    diagnosis = COALESCE(NULLIF(TRIM(p_diagnosis), ''), diagnosis, 'worker_fail'),
    finish_reason = COALESCE(p_finish_reason, finish_reason),
    token_usage = v_merged_usage,
    raw_excerpt = public.admin_append_raw_excerpt(
      v_item.raw_excerpt,
      p_raw_excerpt,
      v_attempt,
      p_finish_reason,
      200000
    ),
    finished_at = NOW()
  WHERE id = p_item_id;

  UPDATE public.generation_jobs
  SET
    items_partial = items_partial + CASE WHEN v_status = 'partial' THEN 1 ELSE 0 END,
    items_failed = items_failed + CASE WHEN v_status = 'failed' THEN 1 ELSE 0 END,
    token_usage = public.admin_merge_token_usage(
      COALESCE(token_usage, '{}'::jsonb),
      COALESCE(p_token_usage, '{}'::jsonb)
    ),
    updated_at = NOW()
  WHERE id = v_item.job_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'requeued', FALSE,
    'diagnosis', COALESCE(NULLIF(TRIM(p_diagnosis), ''), 'worker_fail')
  );
END;
$$;


ALTER FUNCTION "public"."admin_generation_fail_item"("p_item_id" "uuid", "p_error" "text", "p_raw_excerpt" "text", "p_token_usage" "jsonb", "p_finish_reason" "text", "p_diagnosis" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_generation_get_context"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item public.generation_job_items;
  v_job public.generation_jobs;
  v_concept public.taxonomy_concepts;
  v_master public.prompt_packs;
  v_event_pack public.prompt_packs;
  v_guide public.concept_guides;
  v_config JSONB;
  v_media JSONB := '[]'::jsonb;
  v_stems JSONB := '[]'::jsonb;
  v_emit INT;
  v_menu_limit INT := 12;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_item FROM public.generation_job_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  SELECT * INTO v_job FROM public.generation_jobs WHERE id = v_item.job_id;
  SELECT * INTO v_concept FROM public.taxonomy_concepts WHERE id = v_item.concept_id;
  SELECT * INTO v_master FROM public.prompt_packs WHERE id = 'master' AND active = TRUE;
  SELECT * INTO v_event_pack FROM public.prompt_packs WHERE id = 'event:' || v_item.event_id AND active = TRUE;

  SELECT * INTO v_guide
  FROM public.concept_guides
  WHERE concept_id = v_item.concept_id AND status = 'live'
  LIMIT 1;

  v_config := v_job.config;
  v_emit := GREATEST(COALESCE(v_item.n_outstanding, v_item.n_requested - v_item.n_written), 1);

  IF COALESCE((v_config->>'includeMedia')::BOOLEAN, TRUE) THEN
    IF v_item.required_media_id IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(row ORDER BY row->>'specificity', row->>'label'), '[]'::jsonb)
      INTO v_media
      FROM (
        SELECT jsonb_build_object(
          'id', m.id,
          'label', m.label,
          'description', COALESCE(NULLIF(trim(m.description), ''), NULLIF(trim(m.notes), ''), m.label),
          'tags', to_jsonb(m.tags),
          'specificity', m.specificity
        ) AS row
        FROM public.event_media m
        WHERE m.event_id = v_item.event_id
          AND m.active = TRUE
          AND COALESCE(TRIM(m.source_url), '') <> ''
          AND (
            m.id = v_item.required_media_id
            OR (
              m.specificity = 'broad'
              AND m.id <> v_item.required_media_id
            )
          )
        ORDER BY CASE WHEN m.id = v_item.required_media_id THEN 0 ELSE 1 END,
          m.created_at DESC
        LIMIT 3
      ) sub;
    ELSE
      SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'specificity') DESC, row->>'label'), '[]'::jsonb)
      INTO v_media
      FROM (
        SELECT jsonb_build_object(
          'id', m.id,
          'label', m.label,
          'description', COALESCE(NULLIF(trim(m.description), ''), NULLIF(trim(m.notes), ''), m.label),
          'tags', to_jsonb(m.tags),
          'specificity', m.specificity
        ) AS row
        FROM public.event_media m
        WHERE m.event_id = v_item.event_id
          AND m.active = TRUE
          AND COALESCE(TRIM(m.source_url), '') <> ''
          AND (
            COALESCE(array_length(m.tags, 1), 0) = 0
            OR m.tags && v_concept.depth_tags
            OR EXISTS (
              SELECT 1 FROM public.taxonomy_topics t
              WHERE t.id = v_concept.topic_id
                AND EXISTS (
                  SELECT 1 FROM unnest(m.tags) tag
                  WHERE tag ILIKE '%' || regexp_replace(lower(t.name), '[^a-z0-9]+', '_', 'g') || '%'
                )
            )
          )
        ORDER BY
          CASE m.specificity WHEN 'specific' THEN 0 ELSE 1 END,
          m.created_at DESC
        LIMIT v_menu_limit
      ) sub;
    END IF;
  END IF;

  IF v_item.pass IN ('B', 'C') OR v_item.shortfall_retries > 0 OR v_item.n_written > 0 THEN
    SELECT COALESCE(jsonb_agg(stem ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_stems
    FROM (
      SELECT q.stem, q.created_at
      FROM public.questions q
      WHERE q.concept_id = v_item.concept_id
        AND q.status IN ('live', 'draft')
      ORDER BY q.created_at DESC
      LIMIT 30
    ) existing;
  END IF;

  RETURN jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_item.id,
      'job_id', v_item.job_id,
      'event_id', v_item.event_id,
      'concept_id', v_item.concept_id,
      'pass', v_item.pass,
      'n_requested', v_item.n_requested,
      'n_outstanding', v_emit,
      'n_written', v_item.n_written,
      'shortfall_retries', v_item.shortfall_retries,
      'required_media_id', v_item.required_media_id
    ),
    'job', jsonb_build_object(
      'id', v_job.id,
      'config', v_job.config
    ),
    'concept', jsonb_build_object(
      'id', v_concept.id,
      'event_id', v_concept.event_id,
      'topic_id', v_concept.topic_id,
      'name', v_concept.name,
      'description', v_concept.description,
      'depth_tags', to_jsonb(v_concept.depth_tags)
    ),
    'master', jsonb_build_object(
      'system_body', COALESCE(v_master.system_body, '')
    ),
    'event_pack', jsonb_build_object(
      'system_body', COALESCE(v_event_pack.system_body, ''),
      'few_shots', COALESCE(v_event_pack.few_shots, '[]'::jsonb)
    ),
    'guide', CASE
      WHEN COALESCE((v_config->>'includeGuide')::BOOLEAN, TRUE) AND v_guide.concept_id IS NOT NULL
      THEN jsonb_build_object('read_body', v_guide.read_body)
      ELSE NULL
    END,
    'media_menu', v_media,
    'existing_stems', v_stems
  );
END;
$$;


ALTER FUNCTION "public"."admin_generation_get_context"("p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_generation_recover_stale_items"("p_job_id" "uuid" DEFAULT NULL::"uuid", "p_stale_seconds" integer DEFAULT 240) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_stale INT := GREATEST(COALESCE(p_stale_seconds, 240), 60);
  v_count INT := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.generation_job_items i
  SET
    status = 'queued',
    diagnosis = 'stale_timeout',
    error = format(
      'Recovered from stale running (>%ss with no worker finish — likely Edge timeout/crash). Requeued.',
      v_stale
    ),
    finished_at = NULL
  WHERE i.status = 'running'
    AND COALESCE(i.last_claimed_at, i.started_at, i.created_at)
        < NOW() - make_interval(secs => v_stale)
    AND (p_job_id IS NULL OR i.job_id = p_job_id)
    AND EXISTS (
      SELECT 1 FROM public.generation_jobs j
      WHERE j.id = i.job_id
        AND j.status IN ('queued', 'running', 'paused')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'recovered', v_count,
    'stale_seconds', v_stale
  );
END;
$$;


ALTER FUNCTION "public"."admin_generation_recover_stale_items"("p_job_id" "uuid", "p_stale_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_generation_retry_incomplete"("p_job_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.generation_job_items
  SET
    status = 'queued',
    error = NULL,
    finished_at = NULL,
    shortfall_retries = 0,
    n_outstanding = GREATEST(n_requested - n_written, 1)
  WHERE job_id = p_job_id
    AND status IN ('failed', 'partial')
    AND n_written < n_requested;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE public.generation_jobs
    SET
      status = 'running',
      pause_reason = NULL,
      finished_at = NULL,
      updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."admin_generation_retry_incomplete"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_generation_set_job_status"("p_job_id" "uuid", "p_status" "text", "p_pause_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.generation_jobs
  SET
    status = p_status,
    pause_reason = CASE WHEN p_status = 'paused' THEN p_pause_reason ELSE NULL END,
    finished_at = CASE WHEN p_status IN ('done', 'failed', 'cancelled') THEN NOW() ELSE finished_at END,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;


ALTER FUNCTION "public"."admin_generation_set_job_status"("p_job_id" "uuid", "p_status" "text", "p_pause_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_inflight_generation_count"("p_concept_id" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT SUM(
      GREATEST(
        COALESCE(i.n_outstanding, i.n_requested - COALESCE(i.n_written, 0)),
        0
      )
    )::INT
    FROM public.generation_job_items i
    JOIN public.generation_jobs j ON j.id = i.job_id
    WHERE i.concept_id = p_concept_id
      AND i.status IN ('queued', 'running')
      AND j.status IN ('queued', 'running', 'paused')
  ), 0);
$$;


ALTER FUNCTION "public"."admin_inflight_generation_count"("p_concept_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_insert_generated_question"("p_item_id" "uuid", "p_question" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item public.generation_job_items;
  v_concept public.taxonomy_concepts;
  v_event public.taxonomy_events;
  v_stem TEXT;
  v_options JSONB;
  v_correct_key TEXT;
  v_explanation TEXT;
  v_citation TEXT;
  v_media_raw TEXT;
  v_media_id UUID;
  v_question_id UUID;
  v_shuffled JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_item FROM public.generation_job_items WHERE id = p_item_id;
  SELECT * INTO v_concept FROM public.taxonomy_concepts WHERE id = v_item.concept_id;
  SELECT * INTO v_event FROM public.taxonomy_events WHERE id = v_item.event_id;

  v_stem := trim(p_question->>'stem');
  v_options := p_question->'options';
  v_correct_key := upper(trim(p_question->>'correct_key'));
  v_explanation := trim(COALESCE(p_question->>'explanation', ''));
  v_citation := trim(COALESCE(
    p_question->>'citation',
    format('nim:job:%s:concept:%s:pass:%s', v_item.job_id, v_item.concept_id, v_item.pass)
  ));

  IF v_stem = '' OR v_explanation = '' THEN
    RAISE EXCEPTION 'invalid question: missing stem or explanation';
  END IF;

  IF v_correct_key NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'invalid correct_key';
  END IF;

  IF v_options IS NULL
    OR trim(v_options->>'A') = ''
    OR trim(v_options->>'B') = ''
    OR trim(v_options->>'C') = ''
    OR trim(v_options->>'D') = '' THEN
    RAISE EXCEPTION 'invalid options';
  END IF;

  IF public.admin_fingerprint_is_dup(v_item.concept_id, v_stem) THEN
    RAISE EXCEPTION 'duplicate stem';
  END IF;

  v_media_raw := NULLIF(trim(COALESCE(p_question->>'media_id', '')), '');
  IF v_media_raw IS NOT NULL AND lower(v_media_raw) <> 'null' THEN
    BEGIN
      v_media_id := v_media_raw::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid media_id';
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.event_media m
      WHERE m.id = v_media_id
        AND m.event_id = v_item.event_id
        AND m.active = TRUE
        AND COALESCE(TRIM(m.source_url), '') <> ''
    ) THEN
      RAISE EXCEPTION 'invalid media_id';
    END IF;

    IF v_item.required_media_id IS NOT NULL AND v_media_id <> v_item.required_media_id THEN
      RAISE EXCEPTION 'media_id must match required figure for this top-up item';
    END IF;
  ELSIF v_item.required_media_id IS NOT NULL THEN
    RAISE EXCEPTION 'media_id required for this top-up item';
  END IF;

  v_shuffled := public.admin_shuffle_mcq_options(v_options, v_correct_key);
  v_options := v_shuffled->'options';
  v_correct_key := v_shuffled->>'correct_key';

  INSERT INTO public.questions (
    season_ids,
    division,
    event_id,
    topic_id,
    concept_id,
    question_type,
    status,
    stem,
    media_id,
    options,
    correct_key,
    explanation,
    citation
  ) VALUES (
    ARRAY[v_event.season],
    v_event.division,
    v_item.event_id,
    v_concept.topic_id,
    v_item.concept_id,
    'mcq',
    'draft',
    v_stem,
    v_media_id,
    v_options,
    v_correct_key,
    v_explanation,
    v_citation
  )
  RETURNING id INTO v_question_id;

  INSERT INTO public.question_fingerprints (
    event_id, concept_id, question_id, stem_norm, exact_hash
  ) VALUES (
    v_item.event_id,
    v_item.concept_id,
    v_question_id,
    public.admin_normalize_stem(v_stem),
    public.admin_stem_exact_hash(v_stem)
  );

  RETURN v_question_id;
END;
$$;


ALTER FUNCTION "public"."admin_insert_generated_question"("p_item_id" "uuid", "p_question" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_master_pack_ready"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prompt_packs p
    WHERE p.id = 'master'
      AND p.active = TRUE
      AND length(trim(p.system_body)) > 0
  );
$$;


ALTER FUNCTION "public"."admin_master_pack_ready"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_merge_token_usage"("p_existing" "jsonb", "p_incoming" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT jsonb_build_object(
    'prompt_tokens',
      COALESCE((p_existing->>'prompt_tokens')::INT, 0)
      + COALESCE((p_incoming->>'prompt_tokens')::INT, 0)
      + COALESCE((p_incoming->>'input_tokens')::INT, 0),
    'completion_tokens',
      COALESCE((p_existing->>'completion_tokens')::INT, 0)
      + COALESCE((p_incoming->>'completion_tokens')::INT, 0)
      + COALESCE((p_incoming->>'output_tokens')::INT, 0),
    'total_tokens',
      COALESCE((p_existing->>'total_tokens')::INT, 0)
      + COALESCE((p_incoming->>'total_tokens')::INT, 0)
  );
$$;


ALTER FUNCTION "public"."admin_merge_token_usage"("p_existing" "jsonb", "p_incoming" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_normalize_stem"("p_stem" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT lower(regexp_replace(trim(coalesce(p_stem, '')), '\s+', ' ', 'g'));
$$;


ALTER FUNCTION "public"."admin_normalize_stem"("p_stem" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_pick_concept_for_media"("p_event_id" "text", "p_media_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tags TEXT[];
  v_concept_id TEXT;
BEGIN
  SELECT tags INTO v_tags FROM public.event_media WHERE id = p_media_id;

  SELECT c.id INTO v_concept_id
  FROM public.taxonomy_concepts c
  WHERE c.event_id = p_event_id
    AND (
      COALESCE(array_length(v_tags, 1), 0) = 0
      OR c.depth_tags && v_tags
    )
  ORDER BY c.sort_order, c.id
  LIMIT 1;

  IF v_concept_id IS NULL THEN
    SELECT c.id INTO v_concept_id
    FROM public.taxonomy_concepts c
    WHERE c.event_id = p_event_id
    ORDER BY c.sort_order, c.id
    LIMIT 1;
  END IF;

  RETURN v_concept_id;
END;
$$;


ALTER FUNCTION "public"."admin_pick_concept_for_media"("p_event_id" "text", "p_media_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_preview_generation"("p_config" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN public.admin_explode_generation_plan(p_config);
END;
$$;


ALTER FUNCTION "public"."admin_preview_generation"("p_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_question_coverage"() RETURNS TABLE("concept_id" "text", "live_count" bigint, "draft_count" bigint, "archived_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    q.concept_id,
    COUNT(*) FILTER (WHERE q.status = 'live') AS live_count,
    COUNT(*) FILTER (WHERE q.status = 'draft') AS draft_count,
    COUNT(*) FILTER (WHERE q.status = 'archived') AS archived_count
  FROM public.questions q
  WHERE public.is_platform_admin() AND q.concept_id IS NOT NULL
  GROUP BY q.concept_id;
$$;


ALTER FUNCTION "public"."admin_question_coverage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_question_soft_lint"("p_question" "public"."questions") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_flags TEXT[] := ARRAY[]::TEXT[];
  v_opts JSONB := p_question.options;
  v_key TEXT := upper(trim(p_question.correct_key::TEXT));
BEGIN
  IF length(trim(COALESCE(p_question.stem, ''))) < 12 THEN
    v_flags := array_append(v_flags, 'short_stem');
  END IF;
  IF length(trim(COALESCE(p_question.explanation, ''))) < 8 THEN
    v_flags := array_append(v_flags, 'short_explanation');
  END IF;
  IF v_key NOT IN ('A', 'B', 'C', 'D') THEN
    v_flags := array_append(v_flags, 'bad_key');
  ELSIF trim(COALESCE(v_opts->>v_key, '')) = '' THEN
    v_flags := array_append(v_flags, 'key_missing_option');
  END IF;
  IF trim(COALESCE(v_opts->>'A', '')) = ''
     OR trim(COALESCE(v_opts->>'B', '')) = ''
     OR trim(COALESCE(v_opts->>'C', '')) = ''
     OR trim(COALESCE(v_opts->>'D', '')) = '' THEN
    v_flags := array_append(v_flags, 'empty_option');
  END IF;
  IF p_question.explanation ~* '(wait,? recalc|let me |revised stem|abandon|as an ai|overcomplicating)' THEN
    v_flags := array_append(v_flags, 'cot_leak');
  END IF;

  RETURN jsonb_build_object('flags', to_jsonb(v_flags), 'hard_fail', (
    'bad_key' = ANY (v_flags)
    OR 'key_missing_option' = ANY (v_flags)
    OR 'empty_option' = ANY (v_flags)
    OR 'cot_leak' = ANY (v_flags)
    OR 'short_stem' = ANY (v_flags)
  ));
END;
$$;


ALTER FUNCTION "public"."admin_question_soft_lint"("p_question" "public"."questions") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_queue_media_topup"("p_event_id" "text", "p_min_live" integer DEFAULT 3, "p_per_asset" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_job_id UUID;
  v_min INT := GREATEST(COALESCE(p_min_live, 3), 1);
  v_per INT := GREATEST(COALESCE(p_per_asset, 3), 1);
  v_media RECORD;
  v_concept_id TEXT;
  v_items INT := 0;
  v_media_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF NOT public.admin_event_pack_ready(p_event_id) THEN
    RAISE EXCEPTION 'event prompt pack missing for %', p_event_id;
  END IF;

  INSERT INTO public.generation_jobs (kind, status, config, items_total)
  VALUES (
    'workbench',
    'queued',
    jsonb_build_object(
      'mode', 'media_topup',
      'eventIds', jsonb_build_array(p_event_id),
      'targetPerConcept', v_per,
      'questionsPerCall', v_per,
      'passMode', 'A_only',
      'difficultyMix', jsonb_build_object('easy', 20, 'medium', 50, 'hard', 30),
      'provider', 'deepseek_flash',
      'includeGuide', TRUE,
      'includeMedia', TRUE,
      'mediaAttachRate', 100,
      'fillGap', FALSE,
      'concurrency', 4,
      'window', jsonb_build_object(
        'enabled', FALSE,
        'tz', 'America/Chicago',
        'start', '08:00',
        'end', '22:00'
      )
    ),
    0
  )
  RETURNING id INTO v_job_id;

  FOR v_media IN
    SELECT m.id, m.label
    FROM public.event_media m
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS live_n
      FROM public.questions q
      WHERE q.media_id = m.id AND q.status = 'live'
    ) usage ON TRUE
    WHERE m.event_id = p_event_id
      AND m.active = TRUE
      AND m.specificity = 'broad'
      AND COALESCE(TRIM(m.source_url), '') <> ''
      AND COALESCE(usage.live_n, 0) < v_min
    ORDER BY usage.live_n ASC, m.created_at ASC
    LIMIT 24
  LOOP
    v_concept_id := public.admin_pick_concept_for_media(p_event_id, v_media.id);
    IF v_concept_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.generation_job_items (
      job_id,
      event_id,
      concept_id,
      pass,
      n_requested,
      n_outstanding,
      status,
      required_media_id
    ) VALUES (
      v_job_id,
      p_event_id,
      v_concept_id,
      'A',
      v_per,
      v_per,
      'queued',
      v_media.id
    );

    v_items := v_items + 1;
    v_media_ids := array_append(v_media_ids, v_media.id);
  END LOOP;

  IF v_items = 0 THEN
    DELETE FROM public.generation_jobs WHERE id = v_job_id;
    RETURN jsonb_build_object(
      'job_id', NULL,
      'items_created', 0,
      'media_ids', '[]'::jsonb,
      'message', 'No thin broad assets found'
    );
  END IF;

  UPDATE public.generation_jobs
  SET items_total = v_items, updated_at = NOW()
  WHERE id = v_job_id;

  RETURN jsonb_build_object(
    'job_id', v_job_id,
    'items_created', v_items,
    'media_ids', to_jsonb(v_media_ids)
  );
END;
$$;


ALTER FUNCTION "public"."admin_queue_media_topup"("p_event_id" "text", "p_min_live" integer, "p_per_asset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_queue"("p_event_id" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 200) RETURNS SETOF "public"."questions"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT q.*
  FROM public.questions q
  WHERE q.status = 'draft'
    AND (
      q.critic_route IS NULL
      OR q.critic_route = 'human'
      OR q.needs_fix = TRUE
    )
    AND (p_event_id IS NULL OR q.event_id = p_event_id)
  ORDER BY
    CASE WHEN q.critic_route = 'human' OR q.needs_fix THEN 0 ELSE 1 END,
    q.created_at ASC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 200), 500), 1);
END;
$$;


ALTER FUNCTION "public"."admin_review_queue"("p_event_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_needs_fix"("p_question_id" "uuid", "p_needs" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.questions
  SET needs_fix = COALESCE(p_needs, TRUE),
      status = 'draft',
      critic_route = COALESCE(critic_route, 'human')
  WHERE id = p_question_id;
END;
$$;


ALTER FUNCTION "public"."admin_set_needs_fix"("p_question_id" "uuid", "p_needs" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_question_media"("p_question_id" "uuid", "p_media_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_q public.questions;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_q FROM public.questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found';
  END IF;

  IF v_q.status <> 'draft' THEN
    RAISE EXCEPTION 'only draft questions can change media';
  END IF;

  IF p_media_id IS NULL THEN
    UPDATE public.questions
    SET media_id = NULL, needs_fix = FALSE
    WHERE id = p_question_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_media m
    WHERE m.id = p_media_id
      AND m.event_id = v_q.event_id
      AND m.active = TRUE
      AND COALESCE(TRIM(m.source_url), '') <> ''
  ) THEN
    RAISE EXCEPTION 'invalid media_id for this event';
  END IF;

  UPDATE public.questions
  SET media_id = p_media_id, needs_fix = FALSE
  WHERE id = p_question_id;
END;
$$;


ALTER FUNCTION "public"."admin_set_question_media"("p_question_id" "uuid", "p_media_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_shuffle_mcq_options"("p_options" "jsonb", "p_correct_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_keys TEXT[] := ARRAY['A', 'B', 'C', 'D'];
  v_perm TEXT[];
  v_i INT;
  v_j INT;
  v_tmp TEXT;
  v_old TEXT;
  v_new_options JSONB := '{}'::jsonb;
  v_new_key TEXT;
  v_seed INT;
BEGIN
  v_perm := v_keys;
  -- Deterministic-ish shuffle from stem-ish content hash of options
  v_seed := abs(hashtext(COALESCE(p_options::TEXT, '') || COALESCE(p_correct_key, '')));
  FOR v_i IN REVERSE 4..2 LOOP
    v_j := 1 + (v_seed % v_i);
    v_seed := abs(hashtext(v_seed::TEXT || v_i::TEXT));
    v_tmp := v_perm[v_i];
    v_perm[v_i] := v_perm[v_j];
    v_perm[v_j] := v_tmp;
  END LOOP;

  -- v_perm[i] = old key that moves to letter v_keys[i]
  FOR v_i IN 1..4 LOOP
    v_old := v_perm[v_i];
    v_new_options := v_new_options || jsonb_build_object(
      v_keys[v_i],
      trim(COALESCE(p_options->>v_old, ''))
    );
    IF upper(trim(p_correct_key)) = v_old THEN
      v_new_key := v_keys[v_i];
    END IF;
  END LOOP;

  IF v_new_key IS NULL THEN
    v_new_key := upper(trim(p_correct_key));
  END IF;

  RETURN jsonb_build_object(
    'options', v_new_options,
    'correct_key', v_new_key
  );
END;
$$;


ALTER FUNCTION "public"."admin_shuffle_mcq_options"("p_options" "jsonb", "p_correct_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_split_concept_passes"("p_gap" integer, "p_n_per_call" integer, "p_pass_mode" "text") RETURNS TABLE("pass" "text", "n_requested" integer)
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_remaining INT := GREATEST(p_gap, 0);
  v_chunk INT;
  v_pass_idx INT := 0;
  v_pass_labels TEXT[] := ARRAY['A', 'B', 'C'];
BEGIN
  IF v_remaining <= 0 THEN
    RETURN;
  END IF;

  IF p_pass_mode = 'A_only' THEN
    WHILE v_remaining > 0 LOOP
      v_chunk := LEAST(v_remaining, p_n_per_call);
      pass := v_pass_labels[LEAST(v_pass_idx + 1, 3)];
      n_requested := v_chunk;
      RETURN NEXT;
      v_remaining := v_remaining - v_chunk;
      v_pass_idx := v_pass_idx + 1;
    END LOOP;
    RETURN;
  END IF;

  -- A_then_B (default) and top_up share two-pass preference.
  IF v_remaining > 0 THEN
    v_chunk := LEAST(v_remaining, p_n_per_call);
    pass := CASE WHEN p_pass_mode = 'top_up' AND p_gap <= p_n_per_call THEN 'A' ELSE 'A' END;
    n_requested := v_chunk;
    RETURN NEXT;
    v_remaining := v_remaining - v_chunk;
  END IF;

  IF v_remaining > 0 THEN
    v_chunk := LEAST(v_remaining, p_n_per_call);
    pass := 'B';
    n_requested := v_chunk;
    RETURN NEXT;
    v_remaining := v_remaining - v_chunk;
  END IF;

  WHILE v_remaining > 0 LOOP
    v_chunk := LEAST(v_remaining, p_n_per_call);
    pass := 'C';
    n_requested := v_chunk;
    RETURN NEXT;
    v_remaining := v_remaining - v_chunk;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."admin_split_concept_passes"("p_gap" integer, "p_n_per_call" integer, "p_pass_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_stem_exact_hash"("p_stem" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT md5(public.admin_normalize_stem(p_stem));
$$;


ALTER FUNCTION "public"."admin_stem_exact_hash"("p_stem" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_practice_xp"("p_user_id" "uuid", "p_base_amount" integer, "p_tz" "text") RETURNS TABLE("xp_awarded" integer, "cap_hit" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_local date := scioly_local_date(p_tz);
  v_base_today integer;
  v_streak integer;
  v_awardable integer;
  v_mult numeric;
  v_final integer;
  v_cap_hit boolean;
BEGIN
  SELECT practice_xp_base, current_streak
  INTO v_base_today, v_streak
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    xp_awarded := 0;
    cap_hit := false;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE profiles
  SET
    practice_xp_date = v_local,
    practice_xp_base = CASE
      WHEN practice_xp_date IS DISTINCT FROM v_local THEN 0
      ELSE practice_xp_base
    END,
    timezone = COALESCE(NULLIF(trim(p_tz), ''), timezone, 'UTC')
  WHERE id = p_user_id;

  SELECT practice_xp_base, current_streak
  INTO v_base_today, v_streak
  FROM profiles
  WHERE id = p_user_id;

  v_awardable := LEAST(GREATEST(p_base_amount, 0), GREATEST(0, 200 - COALESCE(v_base_today, 0)));
  v_cap_hit := v_awardable < GREATEST(p_base_amount, 0);
  v_mult := progression_streak_multiplier(v_streak);
  v_final := floor(v_awardable * v_mult)::integer;

  UPDATE profiles
  SET
    xp = COALESCE(xp, 0) + v_final,
    practice_xp_base = COALESCE(v_base_today, 0) + v_awardable,
    practice_xp_date = v_local
  WHERE id = p_user_id;

  xp_awarded := v_final;
  cap_hit := v_cap_hit;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."apply_practice_xp"("p_user_id" "uuid", "p_base_amount" integer, "p_tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_badge"("p_user_id" "uuid", "p_badge_id" "text", "p_xp" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO user_badges (user_id, badge_id, earned_at)
  VALUES (p_user_id, p_badge_id, now());

  PERFORM award_non_practice_xp(p_user_id, GREATEST(p_xp, 0));
  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."award_badge"("p_user_id" "uuid", "p_badge_id" "text", "p_xp" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_non_practice_xp"("p_user_id" "uuid", "p_amount" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_amount <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE profiles SET xp = COALESCE(xp, 0) + p_amount WHERE id = p_user_id;
  RETURN p_amount;
END;
$$;


ALTER FUNCTION "public"."award_non_practice_xp"("p_user_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_clinic_do"("p_concept_id" "text", "p_session_token" "text", "p_timezone" "text" DEFAULT 'UTC'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_xp_result record;
  v_streak integer;
  v_xp_total integer;
  v_badge jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM clinic_do_awards
    WHERE user_id = v_user_id
      AND concept_id = p_concept_id
      AND session_token = p_session_token
  ) THEN
    SELECT xp, current_streak INTO v_xp_total, v_streak FROM profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'already_awarded', true,
      'xp_awarded', 0,
      'xp_total', COALESCE(v_xp_total, 0),
      'streak', COALESCE(v_streak, 0),
      'cap_hit', false,
      'concept_id', p_concept_id,
      'newly_unlocked', '[]'::jsonb
    );
  END IF;

  v_streak := touch_user_streak(v_user_id, p_timezone);
  SELECT * INTO v_xp_result FROM apply_practice_xp(v_user_id, 10, p_timezone);

  INSERT INTO clinic_do_awards (user_id, concept_id, session_token)
  VALUES (v_user_id, p_concept_id, p_session_token);

  v_badge := sync_my_badges_for_user(v_user_id);
  SELECT xp INTO v_xp_total FROM profiles WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'already_awarded', false,
    'xp_awarded', COALESCE(v_xp_result.xp_awarded, 0) + COALESCE(NULLIF(v_badge->>'xp_awarded','')::integer, 0),
    'xp_total', COALESCE(v_xp_total, 0),
    'streak', COALESCE(v_streak, 0),
    'cap_hit', COALESCE(v_xp_result.cap_hit, false),
    'concept_id', p_concept_id,
    'newly_unlocked', COALESCE(v_badge->'newly_unlocked', '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."complete_clinic_do"("p_concept_id" "text", "p_session_token" "text", "p_timezone" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text" NOT NULL,
    "division" "public"."division_type" DEFAULT 'C'::"public"."division_type" NOT NULL,
    "platform_role" "text" DEFAULT 'user'::"text" NOT NULL,
    "avatar_id" "text" DEFAULT 'default_atom'::"text" NOT NULL,
    "team_id" "uuid",
    "xp" integer DEFAULT 0 NOT NULL,
    "rank_title" "text" DEFAULT 'Recruit Level 1'::"text" NOT NULL,
    "current_streak" integer DEFAULT 0 NOT NULL,
    "questions_answered" integer DEFAULT 0 NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "onboarding_complete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_on" "date",
    "practice_xp_date" "date",
    "practice_xp_base" integer DEFAULT 0 NOT NULL,
    "timezone" "text",
    CONSTRAINT "profiles_platform_role_check" CHECK (("platform_role" = ANY (ARRAY['user'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."xp" IS 'Authoritative progression currency. Rank = f(xp); do not invent ad-hoc awards.';



COMMENT ON COLUMN "public"."profiles"."rank_title" IS 'Legacy/display cache only. Prefer derive: level=floor(xp/100)+1 → Recruit/Specialist/Tactician/Master/National Legend.';



COMMENT ON COLUMN "public"."profiles"."current_streak" IS 'Consecutive UTC calendar days with graded activity. Does not multiply XP (MVP).';



COMMENT ON COLUMN "public"."profiles"."last_activity_on" IS 'Local calendar date (YYYY-MM-DD) of last graded activity';



COMMENT ON COLUMN "public"."profiles"."practice_xp_date" IS 'Local date key for daily practice XP cap';



COMMENT ON COLUMN "public"."profiles"."practice_xp_base" IS 'Base practice XP earned on practice_xp_date (pre-multiplier)';



CREATE OR REPLACE FUNCTION "public"."complete_onboarding"("p_handle" "text", "p_division" "public"."division_type", "p_join_code" "text" DEFAULT NULL::"text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  cleaned TEXT;
  prof public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  cleaned := lower(regexp_replace(trim(p_handle), '^@', ''));
  IF cleaned !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Handle must be 3-24 chars: a-z, 0-9, underscore';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(handle) = cleaned AND id <> auth.uid()) THEN
    RAISE EXCEPTION 'Handle already taken';
  END IF;
  UPDATE public.profiles
  SET handle = cleaned, division = p_division, onboarding_complete = TRUE
  WHERE id = auth.uid();
  IF p_join_code IS NOT NULL AND length(trim(p_join_code)) > 0 THEN
    PERFORM public.join_team_by_code(p_join_code);
  END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  RETURN prof;
END;
$_$;


ALTER FUNCTION "public"."complete_onboarding"("p_handle" "text", "p_division" "public"."division_type", "p_join_code" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "school_name" "text" NOT NULL,
    "division" "public"."division_type" DEFAULT 'C'::"public"."division_type" NOT NULL,
    "join_code_student" character varying(6) NOT NULL,
    "join_code_admin" character varying(6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team"("p_name" "text", "p_school_name" "text", "p_division" "public"."division_type" DEFAULT 'C'::"public"."division_type") RETURNS "public"."teams"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_team public.teams;
  code_s TEXT;
  code_a TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  LOOP
    code_s := public.generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams WHERE join_code_student = code_s OR join_code_admin = code_s);
  END LOOP;
  LOOP
    code_a := public.generate_join_code();
    EXIT WHEN code_a <> code_s
      AND NOT EXISTS (SELECT 1 FROM public.teams WHERE join_code_student = code_a OR join_code_admin = code_a);
  END LOOP;
  INSERT INTO public.teams (name, school_name, division, join_code_student, join_code_admin)
  VALUES (p_name, p_school_name, p_division, code_s, code_a)
  RETURNING * INTO new_team;
  INSERT INTO public.team_roster (team_id, user_id, role) VALUES (new_team.id, auth.uid(), 'coach');
  UPDATE public.profiles SET team_id = new_team.id, division = p_division WHERE id = auth.uid();
  RETURN new_team;
END;
$$;


ALTER FUNCTION "public"."create_team"("p_name" "text", "p_school_name" "text", "p_division" "public"."division_type") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "target_event_id" "text",
    "goal_type" "text" NOT NULL,
    "target_value" integer NOT NULL,
    "deadline" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_missions_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['answered'::"text", 'correct'::"text"])))
);


ALTER TABLE "public"."team_missions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team_mission"("p_title" "text", "p_target_event_id" "text", "p_goal_type" "text", "p_target_value" integer, "p_deadline" timestamp with time zone) RETURNS "public"."team_missions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  mission public.team_missions;
  member RECORD;
  event_id TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Not on a team';
  END IF;

  IF NOT public.team_role_at_least(tid, 'officer') THEN
    RAISE EXCEPTION 'Officer role or higher required';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) < 2 THEN
    RAISE EXCEPTION 'Title required';
  END IF;

  IF p_goal_type NOT IN ('answered', 'correct') THEN
    RAISE EXCEPTION 'goal_type must be answered or correct';
  END IF;

  IF p_target_value IS NULL OR p_target_value < 1 THEN
    RAISE EXCEPTION 'target_value must be >= 1';
  END IF;

  IF p_deadline IS NULL OR p_deadline <= now() THEN
    RAISE EXCEPTION 'deadline must be in the future';
  END IF;

  event_id := NULLIF(trim(COALESCE(p_target_event_id, '')), '');
  IF event_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.taxonomy_events WHERE id = event_id) THEN
      RAISE EXCEPTION 'Unknown event';
    END IF;
  END IF;

  INSERT INTO public.team_missions (
    team_id, created_by, title, target_event_id, goal_type, target_value, deadline
  ) VALUES (
    tid, uid, trim(p_title), event_id, p_goal_type, p_target_value, p_deadline
  )
  RETURNING * INTO mission;

  FOR member IN
    SELECT user_id FROM public.team_roster WHERE team_id = tid
  LOOP
    INSERT INTO public.user_mission_progress (mission_id, user_id, current_value, completed)
    VALUES (mission.id, member.user_id, 0, false)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN mission;
END;
$$;


ALTER FUNCTION "public"."create_team_mission"("p_title" "text", "p_target_event_id" "text", "p_goal_type" "text", "p_target_value" integer, "p_deadline" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."event_media_deactivate_dependents"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.active = TRUE AND NEW.active = FALSE THEN
    UPDATE public.questions
    SET
      needs_fix = TRUE,
      status = CASE WHEN status = 'live' THEN 'draft' ELSE status END
    WHERE media_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."event_media_deactivate_dependents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flag_questions_broken_media"("p_question_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_question_ids IS NULL OR array_length(p_question_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.questions
  SET
    needs_fix = TRUE,
    status = CASE WHEN status = 'live' THEN 'draft'::text ELSE status END
  WHERE id = ANY (p_question_ids)
    AND media_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."flag_questions_broken_media"("p_question_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_join_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_join_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  temp_handle TEXT;
BEGIN
  temp_handle := 'recruit_' || substr(replace(NEW.id::text, '-', ''), 1, 10);
  INSERT INTO public.profiles (id, handle, onboarding_complete)
  VALUES (NEW.id, temp_handle, FALSE);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_handle_available"("p_handle" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(handle) = lower(regexp_replace(trim(p_handle), '^@', ''))
      AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;


ALTER FUNCTION "public"."is_handle_available"("p_handle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_roster
    WHERE team_id = p_team_id AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_team_member"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_team_by_code"("p_code" "text") RETURNS "public"."teams"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  t public.teams;
  assigned_role public.team_role;
  normalized TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  normalized := upper(trim(p_code));
  IF length(normalized) <> 6 THEN RAISE EXCEPTION 'Invalid join code'; END IF;
  SELECT * INTO t FROM public.teams
  WHERE join_code_student = normalized OR join_code_admin = normalized;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Join code not found'; END IF;
  IF normalized = t.join_code_admin THEN assigned_role := 'coach'; ELSE assigned_role := 'member'; END IF;
  INSERT INTO public.team_roster (team_id, user_id, role)
  VALUES (t.id, auth.uid(), assigned_role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.profiles SET team_id = t.id, division = t.division WHERE id = auth.uid();
  RETURN t;
END;
$$;


ALTER FUNCTION "public"."join_team_by_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."note_team_join"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND (OLD.team_id IS NULL OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    INSERT INTO user_stats (user_id, team_joined_at)
    VALUES (NEW.id, now())
    ON CONFLICT (user_id) DO UPDATE SET
      team_joined_at = COALESCE(user_stats.team_joined_at, EXCLUDED.team_joined_at),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."note_team_join"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."process_session_answers"("p_user_id" "uuid", "p_session_token" "text", "p_mode" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_tz" "text", "p_min_response_ms" integer, "p_correct_xp" integer, "p_incorrect_xp" integer, "p_flawless_bonus" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."progression_streak_multiplier"("p_streak" integer) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN COALESCE(p_streak, 0) >= 120 THEN 1.5
    WHEN COALESCE(p_streak, 0) >= 90 THEN 1.4
    WHEN COALESCE(p_streak, 0) >= 60 THEN 1.3
    WHEN COALESCE(p_streak, 0) >= 30 THEN 1.2
    WHEN COALESCE(p_streak, 0) >= 7 THEN 1.1
    ELSE 1.0
  END;
$$;


ALTER FUNCTION "public"."progression_streak_multiplier"("p_streak" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rank_title_from_xp"("p_xp" integer) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  lvl INT;
BEGIN
  lvl := (GREATEST(p_xp, 0) / 100) + 1;
  IF lvl <= 5 THEN
    RETURN 'Recruit Level ' || lvl::text;
  ELSIF lvl <= 10 THEN
    RETURN 'Specialist';
  ELSIF lvl <= 20 THEN
    RETURN 'Tactician';
  ELSIF lvl <= 35 THEN
    RETURN 'Master';
  ELSE
    RETURN 'National Legend';
  END IF;
END;
$$;


ALTER FUNCTION "public"."rank_title_from_xp"("p_xp" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_user_stats"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_correct integer;
  v_event_max integer;
  v_distinct integer;
  v_clinic integer;
  v_timed integer;
  v_fc integer;
  v_ft integer;
  v_missions integer;
  v_binder integer;
  v_ghost integer;
  v_tz text;
  v_local date;
  v_clinic_today integer;
  v_team_id uuid;
BEGIN
  SELECT COALESCE(timezone, 'UTC'), team_id INTO v_tz, v_team_id
  FROM profiles WHERE id = p_user_id;

  v_local := scioly_local_date(v_tz);

  SELECT COUNT(*)::integer INTO v_total_correct
  FROM practice_session_answers
  WHERE user_id = p_user_id
    AND skipped = false AND invalidated = false AND is_correct = true;

  SELECT COALESCE(MAX(c), 0)::integer INTO v_event_max
  FROM (
    SELECT COUNT(*)::integer AS c
    FROM practice_session_answers
    WHERE user_id = p_user_id
      AND skipped = false AND invalidated = false AND is_correct = true
    GROUP BY event_id
  ) s;

  SELECT COUNT(DISTINCT event_id)::integer INTO v_distinct
  FROM practice_session_answers
  WHERE user_id = p_user_id
    AND skipped = false AND invalidated = false AND is_correct = true;

  SELECT COUNT(*)::integer INTO v_clinic
  FROM clinic_do_awards WHERE user_id = p_user_id;

  SELECT COUNT(*)::integer INTO v_clinic_today
  FROM clinic_do_awards
  WHERE user_id = p_user_id
    AND scioly_local_date(v_tz, created_at) = v_local;

  SELECT COUNT(*)::integer INTO v_timed
  FROM practice_session_commits
  WHERE user_id = p_user_id AND mode = 'timed';

  SELECT COUNT(*)::integer INTO v_fc
  FROM practice_session_commits
  WHERE user_id = p_user_id AND mode = 'casual' AND flawless = true;

  SELECT COUNT(*)::integer INTO v_ft
  FROM practice_session_commits
  WHERE user_id = p_user_id AND mode = 'timed' AND flawless = true;

  SELECT COUNT(*)::integer INTO v_ghost
  FROM practice_session_commits
  WHERE user_id = p_user_id AND mode = 'timed' AND ghost_speed = true;

  SELECT COUNT(*)::integer INTO v_missions
  FROM user_mission_progress
  WHERE user_id = p_user_id AND completed = true;

  BEGIN
    SELECT COUNT(DISTINCT event_id)::integer INTO v_binder
    FROM binder_audits
    WHERE user_id = p_user_id
      AND status IN ('ok', 'rejected', 'low_confidence');
  EXCEPTION
    WHEN undefined_table OR undefined_column OR others THEN
      v_binder := 0;
  END;

  INSERT INTO user_stats AS us (
    user_id, total_correct, event_max_correct, distinct_events,
    clinic_clears, clinic_clears_today, clinic_clears_on,
    timed_sets, flawless_casual, flawless_timed, missions_completed,
    binder_events, ghost_speed_clears, team_joined_at, updated_at
  ) VALUES (
    p_user_id, v_total_correct, v_event_max, v_distinct,
    v_clinic, v_clinic_today, v_local,
    v_timed, v_fc, v_ft, v_missions,
    v_binder, v_ghost,
    CASE WHEN v_team_id IS NOT NULL THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_correct = EXCLUDED.total_correct,
    event_max_correct = EXCLUDED.event_max_correct,
    distinct_events = EXCLUDED.distinct_events,
    clinic_clears = EXCLUDED.clinic_clears,
    clinic_clears_today = EXCLUDED.clinic_clears_today,
    clinic_clears_on = EXCLUDED.clinic_clears_on,
    timed_sets = EXCLUDED.timed_sets,
    flawless_casual = EXCLUDED.flawless_casual,
    flawless_timed = EXCLUDED.flawless_timed,
    missions_completed = EXCLUDED.missions_completed,
    binder_events = EXCLUDED.binder_events,
    ghost_speed_clears = EXCLUDED.ghost_speed_clears,
    team_joined_at = COALESCE(us.team_joined_at, EXCLUDED.team_joined_at),
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."refresh_user_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scioly_local_date"("p_tz" "text", "p_ts" timestamp with time zone DEFAULT "now"()) RETURNS "date"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT (timezone(COALESCE(NULLIF(trim(p_tz), ''), 'UTC'), p_ts))::date;
$$;


ALTER FUNCTION "public"."scioly_local_date"("p_tz" "text", "p_ts" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_event_coverage" (
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "team_event_coverage_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'training'::"text", 'ready'::"text"])))
);


ALTER TABLE "public"."team_event_coverage" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_coverage"("p_user_id" "uuid", "p_event_id" "text", "p_status" "text") RETURNS "public"."team_event_coverage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  row public.team_event_coverage;
  status_norm TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Not on a team';
  END IF;

  IF NOT public.team_role_at_least(tid, 'captain') THEN
    RAISE EXCEPTION 'Captain or coach required';
  END IF;

  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.team_roster
    WHERE team_id = tid AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  IF p_event_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.taxonomy_events WHERE id = p_event_id AND active
  ) THEN
    RAISE EXCEPTION 'Unknown event';
  END IF;

  -- NULL / empty / 'off' clears the cell
  status_norm := lower(trim(COALESCE(p_status, '')));
  IF status_norm = '' OR status_norm = 'off' OR status_norm = 'none' THEN
    DELETE FROM public.team_event_coverage
    WHERE team_id = tid AND user_id = p_user_id AND event_id = p_event_id;
    RETURN NULL;
  END IF;

  IF status_norm NOT IN ('assigned', 'training', 'ready') THEN
    RAISE EXCEPTION 'status must be assigned, training, ready, or off';
  END IF;

  INSERT INTO public.team_event_coverage (
    team_id, user_id, event_id, status, updated_at, updated_by
  ) VALUES (
    tid, p_user_id, p_event_id, status_norm, now(), uid
  )
  ON CONFLICT (team_id, user_id, event_id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now(),
    updated_by = uid
  RETURNING * INTO row;

  RETURN row;
END;
$$;


ALTER FUNCTION "public"."set_event_coverage"("p_user_id" "uuid", "p_event_id" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_my_avatar"("p_avatar_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_badge_id text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  IF p_avatar_id IN (
    'default_atom',
    'default_brain',
    'default_dna',
    'default_flask',
    'default_microscope',
    'default_rocket'
  ) THEN
    UPDATE profiles SET avatar_id = p_avatar_id WHERE id = v_uid;
    RETURN jsonb_build_object('ok', true, 'avatar_id', p_avatar_id);
  END IF;

  IF p_avatar_id LIKE 'badge:%' THEN
    v_badge_id := substring(p_avatar_id from 7);
    IF v_badge_id IS NULL OR v_badge_id = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid badge avatar');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM user_badges
      WHERE user_id = v_uid AND badge_id = v_badge_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'badge not earned');
    END IF;
    UPDATE profiles SET avatar_id = p_avatar_id WHERE id = v_uid;
    RETURN jsonb_build_object('ok', true, 'avatar_id', p_avatar_id);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'invalid avatar');
END;
$$;


ALTER FUNCTION "public"."set_my_avatar"("p_avatar_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_casual_session"("p_session_token" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_timezone" "text" DEFAULT 'UTC'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN process_session_answers(
    v_user_id,
    p_session_token,
    'casual',
    p_event_id,
    p_topic_id,
    p_answers,
    p_timezone,
    3000,
    5,
    1,
    10
  );
END;
$$;


ALTER FUNCTION "public"."submit_casual_session"("p_session_token" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_timed_session"("p_session_token" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_timezone" "text" DEFAULT 'UTC'::"text", "p_elapsed_ms" integer DEFAULT NULL::integer, "p_time_limit_ms" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_valid integer := 0;
  v_correct integer := 0;
  v_ghost boolean := false;
  v_answer jsonb;
  v_skipped boolean;
  v_response_ms integer;
  v_is_correct boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Pre-scan for ghost eligibility (10 valid correct, elapsed < 50% limit)
  FOR v_answer IN SELECT value FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb))
  LOOP
    v_skipped := COALESCE((v_answer->>'skipped')::boolean, false);
    IF v_skipped THEN CONTINUE; END IF;
    v_response_ms := NULLIF(v_answer->>'response_ms', '')::integer;
    IF v_response_ms IS NOT NULL AND v_response_ms < 4000 THEN CONTINUE; END IF;
    v_valid := v_valid + 1;
    v_is_correct := COALESCE((v_answer->>'is_correct')::boolean, false);
    IF v_is_correct THEN v_correct := v_correct + 1; END IF;
  END LOOP;

  IF v_valid = 10
     AND v_correct = 10
     AND p_elapsed_ms IS NOT NULL
     AND p_time_limit_ms IS NOT NULL
     AND p_time_limit_ms > 0
     AND p_elapsed_ms < (p_time_limit_ms * 0.5) THEN
    v_ghost := true;
  END IF;

  v_result := process_session_answers(
    v_user_id,
    p_session_token,
    'timed',
    p_event_id,
    p_topic_id,
    p_answers,
    p_timezone,
    4000,
    6,
    1,
    15
  );

  UPDATE practice_session_commits
  SET
    elapsed_ms = p_elapsed_ms,
    time_limit_ms = p_time_limit_ms,
    ghost_speed = v_ghost OR ghost_speed
  WHERE user_id = v_user_id
    AND session_token = p_session_token
    AND mode = 'timed';

  IF v_ghost AND NOT COALESCE((v_result->>'already_committed')::boolean, false) THEN
    -- Re-sync so ghost badge can award after flag set
    v_result := v_result || jsonb_build_object(
      'newly_unlocked',
      COALESCE((sync_my_badges_for_user(v_user_id))->'newly_unlocked', '[]'::jsonb)
    );
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."submit_timed_session"("p_session_token" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_timezone" "text", "p_elapsed_ms" integer, "p_time_limit_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_my_badges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN sync_my_badges_for_user(v_user_id);
END;
$$;


ALTER FUNCTION "public"."sync_my_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_my_badges_for_user"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  s record;
  v_streak integer;
  v_team_id uuid;
  v_newly jsonb := '[]'::jsonb;
  v_xp integer := 0;
  v_badges text[];
  v_unlocked boolean;
  v_sleeper boolean := false;
BEGIN
  PERFORM refresh_user_stats(p_user_id);

  SELECT current_streak, team_id INTO v_streak, v_team_id
  FROM profiles WHERE id = p_user_id;

  SELECT * INTO s FROM user_stats WHERE user_id = p_user_id;

  IF s IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'badges', '[]'::jsonb,
      'newly_unlocked', '[]'::jsonb,
      'xp_awarded', 0,
      'stats', '{}'::jsonb
    );
  END IF;

  -- Accuracy
  IF s.total_correct >= 1 THEN
    v_unlocked := award_badge(p_user_id, 'first_blood', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','first_blood','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.total_correct >= 100 THEN
    v_unlocked := award_badge(p_user_id, 'centurion', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','centurion','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.total_correct >= 1000 THEN
    v_unlocked := award_badge(p_user_id, 'praetorian', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','praetorian','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;
  IF s.total_correct >= 2500 THEN
    v_unlocked := award_badge(p_user_id, 'national_vanguard', 500);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','national_vanguard','xp',500)); v_xp := v_xp + 500; END IF;
  END IF;

  -- Streak
  IF COALESCE(v_streak, 0) >= 7 THEN
    v_unlocked := award_badge(p_user_id, 'week_streak', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','week_streak','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF COALESCE(v_streak, 0) >= 30 THEN
    v_unlocked := award_badge(p_user_id, 'iron_streak', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','iron_streak','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF COALESCE(v_streak, 0) >= 90 THEN
    v_unlocked := award_badge(p_user_id, 'season_streak', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','season_streak','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;
  IF COALESCE(v_streak, 0) >= 120 THEN
    v_unlocked := award_badge(p_user_id, 'unbroken', 500);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','unbroken','xp',500)); v_xp := v_xp + 500; END IF;
  END IF;

  -- Timed / flawless
  IF s.timed_sets >= 1 THEN
    v_unlocked := award_badge(p_user_id, 'timed_survivor', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','timed_survivor','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.timed_sets >= 10 THEN
    v_unlocked := award_badge(p_user_id, 'black_box_veteran', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','black_box_veteran','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.timed_sets >= 50 THEN
    v_unlocked := award_badge(p_user_id, 'black_box_operator', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','black_box_operator','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;
  IF s.flawless_casual >= 1 THEN
    v_unlocked := award_badge(p_user_id, 'flawless_operator', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','flawless_operator','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.flawless_timed >= 1 THEN
    v_unlocked := award_badge(p_user_id, 'blackout', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','blackout','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.flawless_timed >= 10 THEN
    v_unlocked := award_badge(p_user_id, 'whiteout', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','whiteout','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;
  IF s.flawless_timed >= 50 THEN
    v_unlocked := award_badge(p_user_id, 'blackout_protocol', 500);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','blackout_protocol','xp',500)); v_xp := v_xp + 500; END IF;
  END IF;

  -- Clinic
  IF s.clinic_clears >= 5 THEN
    v_unlocked := award_badge(p_user_id, 'clinic_graduate', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','clinic_graduate','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.clinic_clears >= 25 THEN
    v_unlocked := award_badge(p_user_id, 'clinic_resident', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','clinic_resident','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.clinic_clears >= 100 THEN
    v_unlocked := award_badge(p_user_id, 'clinic_chief', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','clinic_chief','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;

  -- Event depth / breadth
  IF s.event_max_correct >= 50 THEN
    v_unlocked := award_badge(p_user_id, 'event_specialist', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','event_specialist','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.event_max_correct >= 150 THEN
    v_unlocked := award_badge(p_user_id, 'event_authority', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','event_authority','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.event_max_correct >= 300 THEN
    v_unlocked := award_badge(p_user_id, 'event_dominator', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','event_dominator','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;
  IF s.distinct_events >= 3 THEN
    v_unlocked := award_badge(p_user_id, 'event_generalist', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','event_generalist','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.distinct_events >= 7 THEN
    v_unlocked := award_badge(p_user_id, 'event_polymath', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','event_polymath','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;
  IF s.distinct_events >= 12 THEN
    v_unlocked := award_badge(p_user_id, 'event_omnivore', 500);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','event_omnivore','xp',500)); v_xp := v_xp + 500; END IF;
  END IF;

  -- Team / missions
  IF v_team_id IS NOT NULL OR s.team_joined_at IS NOT NULL THEN
    v_unlocked := award_badge(p_user_id, 'team_anchor', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','team_anchor','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.missions_completed >= 3 THEN
    v_unlocked := award_badge(p_user_id, 'mission_runner', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','mission_runner','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.missions_completed >= 10 THEN
    v_unlocked := award_badge(p_user_id, 'field_agent', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','field_agent','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;
  IF s.missions_completed >= 30 THEN
    v_unlocked := award_badge(p_user_id, 'unit_operator', 250);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','unit_operator','xp',250)); v_xp := v_xp + 250; END IF;
  END IF;

  -- Binder
  IF s.binder_events >= 1 THEN
    v_unlocked := award_badge(p_user_id, 'binder_initiate', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','binder_initiate','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;
  IF s.binder_events >= 3 THEN
    v_unlocked := award_badge(p_user_id, 'binder_ready', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','binder_ready','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;

  -- Hidden: sleeper_cell
  IF s.team_joined_at IS NOT NULL AND s.missions_completed >= 1 THEN
    SELECT EXISTS (
      SELECT 1
      FROM user_mission_progress ump
      WHERE ump.user_id = p_user_id
        AND ump.completed = true
        AND ump.mission_id IS NOT NULL
        AND now() <= s.team_joined_at + interval '24 hours'
    ) INTO v_sleeper;
    -- Prefer: any mission completed while within 24h of join (check completed timing via updated progress isn't stored)
    -- Use: team_joined_at within 24h of now AND missions >= 1 as approximation if no mission timestamp.
    -- Better: if first mission completed and join was <24h ago at sync time after mission.
    IF now() <= s.team_joined_at + interval '24 hours' AND s.missions_completed >= 1 THEN
      v_sleeper := true;
    END IF;
  END IF;
  IF v_sleeper THEN
    v_unlocked := award_badge(p_user_id, 'sleeper_cell', 50);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','sleeper_cell','xp',50)); v_xp := v_xp + 50; END IF;
  END IF;

  -- Hidden: ghost_in_the_machine
  IF s.ghost_speed_clears >= 1 THEN
    v_unlocked := award_badge(p_user_id, 'ghost_in_the_machine', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','ghost_in_the_machine','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;

  -- Hidden: autodidact
  IF s.clinic_clears_today >= 5 THEN
    v_unlocked := award_badge(p_user_id, 'autodidact', 100);
    IF v_unlocked THEN v_newly := v_newly || jsonb_build_array(jsonb_build_object('id','autodidact','xp',100)); v_xp := v_xp + 100; END IF;
  END IF;

  SELECT array_agg(badge_id ORDER BY earned_at) INTO v_badges
  FROM user_badges WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'badges', to_jsonb(COALESCE(v_badges, ARRAY[]::text[])),
    'newly_unlocked', v_newly,
    'xp_awarded', v_xp,
    'stats', jsonb_build_object(
      'total_correct', s.total_correct,
      'streak', COALESCE(v_streak, 0),
      'timed_sets', s.timed_sets,
      'flawless_casual', s.flawless_casual,
      'flawless_timed', s.flawless_timed,
      'clinic_clears', s.clinic_clears,
      'event_max_correct', s.event_max_correct,
      'distinct_events', s.distinct_events,
      'missions', s.missions_completed,
      'binder_events', s.binder_events,
      'team_joined', CASE WHEN v_team_id IS NOT NULL OR s.team_joined_at IS NOT NULL THEN 1 ELSE 0 END
    )
  );
END;
$$;


ALTER FUNCTION "public"."sync_my_badges_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_my_mission_progress"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mission jsonb;
  v_badge jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  v_mission := sync_my_mission_progress_for_user(v_user_id);
  v_badge := sync_my_badges_for_user(v_user_id);
  RETURN jsonb_build_object(
    'synced', COALESCE(NULLIF(v_mission->>'synced','')::integer, 0),
    'newly_completed', COALESCE(NULLIF(v_mission->>'newly_completed','')::integer, 0),
    'xp_awarded',
      COALESCE(NULLIF(v_mission->>'xp_awarded','')::integer, 0)
      + COALESCE(NULLIF(v_badge->>'xp_awarded','')::integer, 0),
    'newly_unlocked', COALESCE(v_badge->'newly_unlocked', '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "public"."sync_my_mission_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_my_mission_progress_for_user"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_team_id uuid;
  v_mission record;
  v_current integer;
  v_was_completed boolean;
  v_synced integer := 0;
  v_newly integer := 0;
  v_xp integer := 0;
BEGIN
  SELECT team_id INTO v_team_id FROM profiles WHERE id = p_user_id;
  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('synced', 0, 'newly_completed', 0, 'xp_awarded', 0, 'newly_unlocked', '[]'::jsonb);
  END IF;

  FOR v_mission IN
    SELECT * FROM team_missions WHERE team_id = v_team_id
  LOOP
    v_synced := v_synced + 1;

    SELECT completed INTO v_was_completed
    FROM user_mission_progress
    WHERE user_id = p_user_id AND mission_id = v_mission.id;

    IF v_mission.goal_type = 'correct' THEN
      SELECT COUNT(*)::integer INTO v_current
      FROM practice_session_answers psa
      WHERE psa.user_id = p_user_id
        AND psa.skipped = false
        AND psa.invalidated = false
        AND psa.is_correct = true
        AND (v_mission.target_event_id IS NULL OR psa.event_id = v_mission.target_event_id);
    ELSE
      SELECT COUNT(*)::integer INTO v_current
      FROM practice_session_answers psa
      WHERE psa.user_id = p_user_id
        AND psa.skipped = false
        AND psa.invalidated = false
        AND (v_mission.target_event_id IS NULL OR psa.event_id = v_mission.target_event_id);
    END IF;

    INSERT INTO user_mission_progress (user_id, mission_id, current_value, completed)
    VALUES (
      p_user_id,
      v_mission.id,
      v_current,
      v_current >= v_mission.target_value
    )
    ON CONFLICT (user_id, mission_id) DO UPDATE SET
      current_value = EXCLUDED.current_value,
      completed = EXCLUDED.completed;

    IF v_current >= v_mission.target_value AND NOT COALESCE(v_was_completed, false) THEN
      v_newly := v_newly + 1;
      v_xp := v_xp + award_non_practice_xp(p_user_id, 25);
    END IF;
  END LOOP;

  -- Badge sync is owned by callers (process_session_answers / sync_my_mission_progress)
  -- so newly_unlocked is not swallowed by nested PERFORMs.

  RETURN jsonb_build_object(
    'synced', v_synced,
    'newly_completed', v_newly,
    'xp_awarded', v_xp,
    'newly_unlocked', '[]'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."sync_my_mission_progress_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_leaderboard"("p_metric" "text" DEFAULT 'xp'::"text", "p_event_id" "text" DEFAULT NULL::"text", "p_window" "text" DEFAULT 'all'::"text") RETURNS TABLE("user_id" "uuid", "handle" "text", "avatar_id" "text", "score" bigint, "place" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH
  me AS (
    SELECT p.team_id AS tid
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ),
  params AS (
    SELECT
      lower(trim(COALESCE(p_metric, 'xp'))) AS metric,
      lower(trim(COALESCE(p_window, 'all'))) AS win,
      NULLIF(trim(COALESCE(p_event_id, '')), '') AS event_id,
      CASE lower(trim(COALESCE(p_window, 'all')))
        WHEN '7d' THEN now() - INTERVAL '7 days'
        WHEN '30d' THEN now() - INTERVAL '30 days'
        WHEN 'season' THEN TIMESTAMPTZ '2026-09-01 00:00:00+00'
        ELSE NULL
      END AS since
    FROM me
  ),
  roster AS (
    SELECT p.id, p.handle, p.avatar_id, p.xp
    FROM public.profiles p
    JOIN me ON me.tid IS NOT NULL AND p.team_id = me.tid
  ),
  agg AS (
    SELECT
      h.user_id AS uid,
      count(*)::bigint AS answered_n,
      count(*) FILTER (WHERE h.is_correct)::bigint AS correct_n
    FROM public.user_history h
    JOIN public.questions q ON q.id = h.question_id
    JOIN roster r ON r.id = h.user_id
    CROSS JOIN params par
    WHERE (par.since IS NULL OR h.answered_at >= par.since)
      AND (par.event_id IS NULL OR q.event_id = par.event_id)
    GROUP BY h.user_id
  ),
  scored AS (
    SELECT
      r.id AS uid,
      r.handle AS uname,
      r.avatar_id AS uavatar,
      CASE
        WHEN (SELECT metric FROM params) = 'xp' THEN r.xp::bigint
        WHEN (SELECT metric FROM params) = 'correct' THEN COALESCE(a.correct_n, 0)
        ELSE COALESCE(a.answered_n, 0)
      END AS uscore
    FROM roster r
    LEFT JOIN agg a ON a.uid = r.id
    WHERE EXISTS (SELECT 1 FROM me WHERE tid IS NOT NULL)
      AND (SELECT metric FROM params) IN ('xp', 'correct', 'answered')
  )
  SELECT
    s.uid,
    s.uname,
    s.uavatar,
    s.uscore,
    (RANK() OVER (ORDER BY s.uscore DESC, lower(s.uname) ASC))::int
  FROM scored s
  ORDER BY s.uscore DESC, lower(s.uname) ASC;
$$;


ALTER FUNCTION "public"."team_leaderboard"("p_metric" "text", "p_event_id" "text", "p_window" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."team_role_at_least"("p_team_id" "uuid", "p_min" "public"."team_role") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r public.team_role;
  rank_map INT;
  need INT;
BEGIN
  SELECT role INTO r FROM public.team_roster
  WHERE team_id = p_team_id AND user_id = auth.uid();
  IF r IS NULL THEN RETURN FALSE; END IF;
  rank_map := CASE r WHEN 'member' THEN 1 WHEN 'officer' THEN 2 WHEN 'captain' THEN 3 WHEN 'coach' THEN 4 END;
  need := CASE p_min WHEN 'member' THEN 1 WHEN 'officer' THEN 2 WHEN 'captain' THEN 3 WHEN 'coach' THEN 4 END;
  RETURN rank_map >= need;
END;
$$;


ALTER FUNCTION "public"."team_role_at_least"("p_team_id" "uuid", "p_min" "public"."team_role") OWNER TO "postgres";


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


ALTER FUNCTION "public"."touch_user_streak"("p_user_id" "uuid", "p_tz" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."binder_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "topic_id" "text",
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "payload_html" "text" NOT NULL,
    "preview_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."binder_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."binder_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "front_path" "text" NOT NULL,
    "back_path" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "overall_score" integer,
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model" "text" DEFAULT ''::"text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "binder_audits_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ok'::"text", 'rejected'::"text", 'low_confidence'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."binder_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."binder_concept_marks" (
    "user_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "concept_id" "text" NOT NULL,
    "status" "text" DEFAULT 'empty'::"text" NOT NULL,
    "source" "text" DEFAULT 'auto'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "binder_concept_marks_source_check" CHECK (("source" = ANY (ARRAY['auto'::"text", 'manual'::"text"]))),
    CONSTRAINT "binder_concept_marks_status_check" CHECK (("status" = ANY (ARRAY['empty'::"text", 'thin'::"text", 'solid'::"text"])))
);


ALTER TABLE "public"."binder_concept_marks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."binder_custom_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."binder_custom_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."casual_session_commits" (
    "session_token" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "topic_id" "text",
    "xp_awarded" integer DEFAULT 0 NOT NULL,
    "answered_count" integer DEFAULT 0 NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."casual_session_commits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_do_awards" (
    "user_id" "uuid" NOT NULL,
    "concept_id" "text" NOT NULL,
    "session_token" "uuid" NOT NULL,
    "xp_awarded" integer DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clinic_do_awards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."concept_guides" (
    "concept_id" "text" NOT NULL,
    "read_body" "text" DEFAULT ''::"text" NOT NULL,
    "see_html" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "do_prompt" "text" DEFAULT ''::"text" NOT NULL,
    "do_options" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "do_correct_key" character varying(1),
    CONSTRAINT "concept_guides_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'live'::"text"])))
);


ALTER TABLE "public"."concept_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "source_url" "text",
    "storage_path" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "specificity" "text" DEFAULT 'broad'::"text" NOT NULL,
    CONSTRAINT "event_media_source" CHECK (((NULLIF("btrim"("source_url"), ''::"text") IS NOT NULL) OR (NULLIF("btrim"("storage_path"), ''::"text") IS NOT NULL))),
    CONSTRAINT "event_media_specificity_check" CHECK (("specificity" = ANY (ARRAY['broad'::"text", 'specific'::"text"])))
);


ALTER TABLE "public"."event_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "pause_reason" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "items_total" integer DEFAULT 0 NOT NULL,
    "items_done" integer DEFAULT 0 NOT NULL,
    "items_failed" integer DEFAULT 0 NOT NULL,
    "questions_written" integer DEFAULT 0 NOT NULL,
    "token_usage" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "blockers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "items_partial" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "generation_jobs_kind_check" CHECK (("kind" = ANY (ARRAY['campaign'::"text", 'workbench'::"text"]))),
    CONSTRAINT "generation_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'paused'::"text", 'done'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."generation_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "source" "text" DEFAULT 'paste'::"text" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "row_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'committed'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "import_batches_source_check" CHECK (("source" = ANY (ARRAY['paste'::"text", 'pdf'::"text", 'csv'::"text", 'json'::"text"]))),
    CONSTRAINT "import_batches_status_check" CHECK (("status" = ANY (ARRAY['committed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invalidated_answer_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "text",
    "mode" "text" NOT NULL,
    "response_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invalidated_answer_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_complete_awards" (
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "xp_awarded" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mission_complete_awards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_session_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" "text" NOT NULL,
    "mode" "text" NOT NULL,
    "question_id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "topic_id" "text",
    "is_correct" boolean,
    "skipped" boolean DEFAULT false NOT NULL,
    "invalidated" boolean DEFAULT false NOT NULL,
    "response_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "practice_session_answers_mode_check" CHECK (("mode" = ANY (ARRAY['casual'::"text", 'timed'::"text"])))
);


ALTER TABLE "public"."practice_session_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_session_commits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" "text" NOT NULL,
    "mode" "text" NOT NULL,
    "elapsed_ms" integer,
    "time_limit_ms" integer,
    "committed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "flawless" boolean DEFAULT false NOT NULL,
    "ghost_speed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "practice_session_commits_mode_check" CHECK (("mode" = ANY (ARRAY['casual'::"text", 'timed'::"text"])))
);


ALTER TABLE "public"."practice_session_commits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_packs" (
    "id" "text" NOT NULL,
    "scope_type" "text" NOT NULL,
    "scope_id" "text",
    "name" "text" NOT NULL,
    "system_body" "text" DEFAULT ''::"text" NOT NULL,
    "few_shots" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "binder_criteria" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "prompt_packs_few_shots_array" CHECK (("jsonb_typeof"("few_shots") = 'array'::"text")),
    CONSTRAINT "prompt_packs_scope_shape" CHECK (((("scope_type" = ANY (ARRAY['master'::"text", 'binder_master'::"text"])) AND ("scope_id" IS NULL)) OR (("scope_type" = ANY (ARRAY['event'::"text", 'topic'::"text"])) AND ("scope_id" IS NOT NULL)))),
    CONSTRAINT "prompt_packs_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['master'::"text", 'event'::"text", 'topic'::"text", 'binder_master'::"text"]))),
    CONSTRAINT "prompt_packs_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."prompt_packs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_fingerprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "concept_id" "text" NOT NULL,
    "question_id" "uuid",
    "stem_norm" "text" NOT NULL,
    "exact_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."question_fingerprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reinjection_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "unlock_at" timestamp with time zone NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reinjection_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_concepts" (
    "id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "topic_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "depth_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."taxonomy_concepts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_events" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "division" "public"."division_type" DEFAULT 'C'::"public"."division_type" NOT NULL,
    "domain" "text" DEFAULT ''::"text" NOT NULL,
    "test_component" "text" DEFAULT 'written'::"text" NOT NULL,
    "studyable" boolean DEFAULT false NOT NULL,
    "season" integer DEFAULT 2027 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "official_scope" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."taxonomy_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."taxonomy_topics" (
    "id" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."taxonomy_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_roster" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."team_role" DEFAULT 'member'::"public"."team_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_roster" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_vault_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "event_id" "text",
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "team_vault_resources_category_check" CHECK (("category" = ANY (ARRAY['doc'::"text", 'video'::"text", 'link'::"text"])))
);


ALTER TABLE "public"."team_vault_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timed_session_commits" (
    "session_token" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "text" NOT NULL,
    "topic_id" "text",
    "xp_awarded" integer DEFAULT 0 NOT NULL,
    "answered_count" integer DEFAULT 0 NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."timed_session_commits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "user_id" "uuid" NOT NULL,
    "badge_id" "text" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_history" (
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_correct" boolean NOT NULL
);


ALTER TABLE "public"."user_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_mission_progress" (
    "mission_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_mission_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "user_id" "uuid" NOT NULL,
    "total_correct" integer DEFAULT 0 NOT NULL,
    "event_max_correct" integer DEFAULT 0 NOT NULL,
    "distinct_events" integer DEFAULT 0 NOT NULL,
    "clinic_clears" integer DEFAULT 0 NOT NULL,
    "clinic_clears_today" integer DEFAULT 0 NOT NULL,
    "clinic_clears_on" "date",
    "timed_sets" integer DEFAULT 0 NOT NULL,
    "flawless_casual" integer DEFAULT 0 NOT NULL,
    "flawless_timed" integer DEFAULT 0 NOT NULL,
    "missions_completed" integer DEFAULT 0 NOT NULL,
    "binder_events" integer DEFAULT 0 NOT NULL,
    "team_joined_at" timestamp with time zone,
    "ghost_speed_clears" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_weakness_map" (
    "user_id" "uuid" NOT NULL,
    "concept_id" "text" NOT NULL,
    "total_attempts" integer DEFAULT 0 NOT NULL,
    "correct_attempts" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."user_weakness_map" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_topic_weakness" AS
 SELECT "w"."user_id",
    "c"."topic_id",
    "c"."event_id",
    "sum"("w"."total_attempts") AS "total_attempts",
    "sum"("w"."correct_attempts") AS "correct_attempts",
        CASE
            WHEN ("sum"("w"."total_attempts") = 0) THEN NULL::double precision
            ELSE (("sum"("w"."correct_attempts"))::double precision / ("sum"("w"."total_attempts"))::double precision)
        END AS "accuracy"
   FROM ("public"."user_weakness_map" "w"
     JOIN "public"."taxonomy_concepts" "c" ON (("c"."id" = "w"."concept_id")))
  GROUP BY "w"."user_id", "c"."topic_id", "c"."event_id";


ALTER VIEW "public"."user_topic_weakness" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_vault_loadout" (
    "user_id" "uuid" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "pinned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_vault_loadout" OWNER TO "postgres";


ALTER TABLE ONLY "public"."binder_assets"
    ADD CONSTRAINT "binder_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."binder_audits"
    ADD CONSTRAINT "binder_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."binder_concept_marks"
    ADD CONSTRAINT "binder_concept_marks_pkey" PRIMARY KEY ("user_id", "event_id", "concept_id");



ALTER TABLE ONLY "public"."binder_custom_sections"
    ADD CONSTRAINT "binder_custom_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."casual_session_commits"
    ADD CONSTRAINT "casual_session_commits_pkey" PRIMARY KEY ("session_token");



ALTER TABLE ONLY "public"."clinic_do_awards"
    ADD CONSTRAINT "clinic_do_awards_pkey" PRIMARY KEY ("user_id", "concept_id", "session_token");



ALTER TABLE ONLY "public"."concept_guides"
    ADD CONSTRAINT "concept_guides_pkey" PRIMARY KEY ("concept_id");



ALTER TABLE ONLY "public"."event_media"
    ADD CONSTRAINT "event_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_job_items"
    ADD CONSTRAINT "generation_job_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invalidated_answer_events"
    ADD CONSTRAINT "invalidated_answer_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_complete_awards"
    ADD CONSTRAINT "mission_complete_awards_pkey" PRIMARY KEY ("user_id", "mission_id");



ALTER TABLE ONLY "public"."practice_session_answers"
    ADD CONSTRAINT "practice_session_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_session_commits"
    ADD CONSTRAINT "practice_session_commits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_session_commits"
    ADD CONSTRAINT "practice_session_commits_user_id_session_token_mode_key" UNIQUE ("user_id", "session_token", "mode");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_packs"
    ADD CONSTRAINT "prompt_packs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_fingerprints"
    ADD CONSTRAINT "question_fingerprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reinjection_queue"
    ADD CONSTRAINT "reinjection_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_concepts"
    ADD CONSTRAINT "taxonomy_concepts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_events"
    ADD CONSTRAINT "taxonomy_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."taxonomy_topics"
    ADD CONSTRAINT "taxonomy_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_event_coverage"
    ADD CONSTRAINT "team_event_coverage_pkey" PRIMARY KEY ("team_id", "user_id", "event_id");



ALTER TABLE ONLY "public"."team_missions"
    ADD CONSTRAINT "team_missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_posts"
    ADD CONSTRAINT "team_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_roster"
    ADD CONSTRAINT "team_roster_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_roster"
    ADD CONSTRAINT "team_roster_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."team_vault_resources"
    ADD CONSTRAINT "team_vault_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_join_code_admin_key" UNIQUE ("join_code_admin");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_join_code_student_key" UNIQUE ("join_code_student");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timed_session_commits"
    ADD CONSTRAINT "timed_session_commits_pkey" PRIMARY KEY ("session_token");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_history"
    ADD CONSTRAINT "user_history_pkey" PRIMARY KEY ("user_id", "question_id", "answered_at");



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_pkey" PRIMARY KEY ("mission_id", "user_id");



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_user_id_mission_id_key" UNIQUE ("user_id", "mission_id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_vault_loadout"
    ADD CONSTRAINT "user_vault_loadout_pkey" PRIMARY KEY ("user_id", "resource_id");



ALTER TABLE ONLY "public"."user_weakness_map"
    ADD CONSTRAINT "user_weakness_map_pkey" PRIMARY KEY ("user_id", "concept_id");



CREATE INDEX "idx_binder_audits_user_event" ON "public"."binder_audits" USING "btree" ("user_id", "event_id", "created_at" DESC);



CREATE INDEX "idx_binder_custom_user_event" ON "public"."binder_custom_sections" USING "btree" ("user_id", "event_id", "sort_order");



CREATE INDEX "idx_binder_marks_user_event" ON "public"."binder_concept_marks" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_casual_commits_user" ON "public"."casual_session_commits" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_clinic_awards_user" ON "public"."clinic_do_awards" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_concepts_event" ON "public"."taxonomy_concepts" USING "btree" ("event_id");



CREATE INDEX "idx_concepts_topic" ON "public"."taxonomy_concepts" USING "btree" ("topic_id");



CREATE INDEX "idx_coverage_team_event" ON "public"."team_event_coverage" USING "btree" ("team_id", "event_id");



CREATE INDEX "idx_event_media_event" ON "public"."event_media" USING "btree" ("event_id", "active");



CREATE INDEX "idx_events_studyable" ON "public"."taxonomy_events" USING "btree" ("studyable", "division", "season");



CREATE INDEX "idx_generation_job_items_concept" ON "public"."generation_job_items" USING "btree" ("concept_id", "status");



CREATE INDEX "idx_generation_job_items_job" ON "public"."generation_job_items" USING "btree" ("job_id", "status", "created_at");



CREATE INDEX "idx_generation_jobs_status" ON "public"."generation_jobs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_import_batches_event" ON "public"."import_batches" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_practice_session_answers_user_event" ON "public"."practice_session_answers" USING "btree" ("user_id", "event_id", "created_at" DESC);



CREATE INDEX "idx_profiles_handle_lower" ON "public"."profiles" USING "btree" ("lower"("handle"));



CREATE INDEX "idx_profiles_team" ON "public"."profiles" USING "btree" ("team_id");



CREATE UNIQUE INDEX "idx_prompt_packs_scope" ON "public"."prompt_packs" USING "btree" ("scope_type", COALESCE("scope_id", ''::"text"));



CREATE INDEX "idx_question_fingerprints_concept_hash" ON "public"."question_fingerprints" USING "btree" ("concept_id", "exact_hash");



CREATE INDEX "idx_question_fingerprints_stem_trgm" ON "public"."question_fingerprints" USING "gin" ("stem_norm" "public"."gin_trgm_ops");



CREATE INDEX "idx_questions_concept" ON "public"."questions" USING "btree" ("concept_id") WHERE ("concept_id" IS NOT NULL);



CREATE INDEX "idx_questions_critic_queue" ON "public"."questions" USING "btree" ("status", "critic_route", "needs_fix", "created_at" DESC);



CREATE INDEX "idx_questions_critic_unrouted" ON "public"."questions" USING "btree" ("created_at") WHERE (("status" = 'draft'::"public"."question_status") AND ("critic_route" IS NULL));



CREATE INDEX "idx_questions_event_status" ON "public"."questions" USING "btree" ("event_id", "status");



CREATE INDEX "idx_reinjection_open" ON "public"."reinjection_queue" USING "btree" ("user_id", "unlock_at") WHERE ("resolved" = false);



CREATE INDEX "idx_team_roster_user" ON "public"."team_roster" USING "btree" ("user_id");



CREATE INDEX "idx_timed_commits_user" ON "public"."timed_session_commits" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_topics_event" ON "public"."taxonomy_topics" USING "btree" ("event_id");



CREATE INDEX "idx_user_badges_user" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_vault_loadout_user" ON "public"."user_vault_loadout" USING "btree" ("user_id");



CREATE INDEX "questions_event_media_idx" ON "public"."questions" USING "btree" ("event_id", "media_id") WHERE ("media_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "event_media_deactivate_dependents_trg" AFTER UPDATE OF "active" ON "public"."event_media" FOR EACH ROW EXECUTE FUNCTION "public"."event_media_deactivate_dependents"();



CREATE OR REPLACE TRIGGER "profiles_note_team_join" AFTER UPDATE OF "team_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."note_team_join"();



ALTER TABLE ONLY "public"."binder_assets"
    ADD CONSTRAINT "binder_assets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_assets"
    ADD CONSTRAINT "binder_assets_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."taxonomy_topics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."binder_audits"
    ADD CONSTRAINT "binder_audits_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_audits"
    ADD CONSTRAINT "binder_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_concept_marks"
    ADD CONSTRAINT "binder_concept_marks_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_concept_marks"
    ADD CONSTRAINT "binder_concept_marks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_concept_marks"
    ADD CONSTRAINT "binder_concept_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_custom_sections"
    ADD CONSTRAINT "binder_custom_sections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."binder_custom_sections"
    ADD CONSTRAINT "binder_custom_sections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."casual_session_commits"
    ADD CONSTRAINT "casual_session_commits_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id");



ALTER TABLE ONLY "public"."casual_session_commits"
    ADD CONSTRAINT "casual_session_commits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_do_awards"
    ADD CONSTRAINT "clinic_do_awards_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_do_awards"
    ADD CONSTRAINT "clinic_do_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."concept_guides"
    ADD CONSTRAINT "concept_guides_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_media"
    ADD CONSTRAINT "event_media_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_media"
    ADD CONSTRAINT "event_media_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_job_items"
    ADD CONSTRAINT "generation_job_items_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_job_items"
    ADD CONSTRAINT "generation_job_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_job_items"
    ADD CONSTRAINT "generation_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generation_job_items"
    ADD CONSTRAINT "generation_job_items_required_media_id_fkey" FOREIGN KEY ("required_media_id") REFERENCES "public"."event_media"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invalidated_answer_events"
    ADD CONSTRAINT "invalidated_answer_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_complete_awards"
    ADD CONSTRAINT "mission_complete_awards_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."team_missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_complete_awards"
    ADD CONSTRAINT "mission_complete_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_session_answers"
    ADD CONSTRAINT "practice_session_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_session_commits"
    ADD CONSTRAINT "practice_session_commits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prompt_packs"
    ADD CONSTRAINT "prompt_packs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."question_fingerprints"
    ADD CONSTRAINT "question_fingerprints_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_fingerprints"
    ADD CONSTRAINT "question_fingerprints_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."event_media"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."taxonomy_topics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reinjection_queue"
    ADD CONSTRAINT "reinjection_queue_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reinjection_queue"
    ADD CONSTRAINT "reinjection_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."taxonomy_concepts"
    ADD CONSTRAINT "taxonomy_concepts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."taxonomy_concepts"
    ADD CONSTRAINT "taxonomy_concepts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."taxonomy_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."taxonomy_topics"
    ADD CONSTRAINT "taxonomy_topics_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_event_coverage"
    ADD CONSTRAINT "team_event_coverage_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_event_coverage"
    ADD CONSTRAINT "team_event_coverage_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_event_coverage"
    ADD CONSTRAINT "team_event_coverage_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_event_coverage"
    ADD CONSTRAINT "team_event_coverage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_missions"
    ADD CONSTRAINT "team_missions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_missions"
    ADD CONSTRAINT "team_missions_target_event_id_fkey" FOREIGN KEY ("target_event_id") REFERENCES "public"."taxonomy_events"("id");



ALTER TABLE ONLY "public"."team_missions"
    ADD CONSTRAINT "team_missions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_posts"
    ADD CONSTRAINT "team_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_posts"
    ADD CONSTRAINT "team_posts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_roster"
    ADD CONSTRAINT "team_roster_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_roster"
    ADD CONSTRAINT "team_roster_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_vault_resources"
    ADD CONSTRAINT "team_vault_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."team_vault_resources"
    ADD CONSTRAINT "team_vault_resources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id");



ALTER TABLE ONLY "public"."team_vault_resources"
    ADD CONSTRAINT "team_vault_resources_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timed_session_commits"
    ADD CONSTRAINT "timed_session_commits_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."taxonomy_events"("id");



ALTER TABLE ONLY "public"."timed_session_commits"
    ADD CONSTRAINT "timed_session_commits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_history"
    ADD CONSTRAINT "user_history_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_history"
    ADD CONSTRAINT "user_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."team_missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_vault_loadout"
    ADD CONSTRAINT "user_vault_loadout_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."team_vault_resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_vault_loadout"
    ADD CONSTRAINT "user_vault_loadout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_weakness_map"
    ADD CONSTRAINT "user_weakness_map_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."taxonomy_concepts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_weakness_map"
    ADD CONSTRAINT "user_weakness_map_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "badges_own_select" ON "public"."user_badges" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."profiles" "me"
     JOIN "public"."profiles" "them" ON (("them"."id" = "user_badges"."user_id")))
  WHERE (("me"."id" = "auth"."uid"()) AND ("me"."team_id" IS NOT NULL) AND ("them"."team_id" = "me"."team_id"))))));



ALTER TABLE "public"."binder_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."binder_audits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "binder_audits_delete_own" ON "public"."binder_audits" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "binder_audits_own" ON "public"."binder_audits" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."binder_concept_marks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "binder_custom_own" ON "public"."binder_custom_sections" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."binder_custom_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "binder_marks_own" ON "public"."binder_concept_marks" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "binder_read" ON "public"."binder_assets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "casual_commits_own" ON "public"."casual_session_commits" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."casual_session_commits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clinic_awards_own" ON "public"."clinic_do_awards" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."clinic_do_awards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clinic_do_awards_own" ON "public"."clinic_do_awards" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."concept_guides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "concept_guides_admin_insert" ON "public"."concept_guides" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "concept_guides_admin_update" ON "public"."concept_guides" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "concept_guides_read_live" ON "public"."concept_guides" FOR SELECT TO "authenticated" USING ((("status" = 'live'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."platform_role" = 'admin'::"text"))))));



CREATE POLICY "coverage_team_read" ON "public"."team_event_coverage" FOR SELECT TO "authenticated" USING ("public"."is_team_member"("team_id"));



CREATE POLICY "coverage_team_write" ON "public"."team_event_coverage" TO "authenticated" USING ("public"."team_role_at_least"("team_id", 'captain'::"public"."team_role")) WITH CHECK ("public"."team_role_at_least"("team_id", 'captain'::"public"."team_role"));



ALTER TABLE "public"."event_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_media_admin_all" ON "public"."event_media" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."generation_job_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "generation_job_items_admin_all" ON "public"."generation_job_items" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "generation_jobs_admin_all" ON "public"."generation_jobs" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "history_own_insert" ON "public"."user_history" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "history_own_select" ON "public"."user_history" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."import_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_batches_admin_all" ON "public"."import_batches" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."invalidated_answer_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invalidated_answer_events_own" ON "public"."invalidated_answer_events" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "mission_awards_own" ON "public"."mission_complete_awards" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."mission_complete_awards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mission_progress_own_or_team" ON "public"."user_mission_progress" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_missions" "m"
  WHERE (("m"."id" = "user_mission_progress"."mission_id") AND "public"."is_team_member"("m"."team_id"))))));



CREATE POLICY "mission_progress_own_write" ON "public"."user_mission_progress" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "missions_team_read" ON "public"."team_missions" FOR SELECT TO "authenticated" USING ("public"."is_team_member"("team_id"));



CREATE POLICY "missions_team_write" ON "public"."team_missions" TO "authenticated" USING ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role")) WITH CHECK ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role"));



CREATE POLICY "posts_team_delete" ON "public"."team_posts" FOR DELETE TO "authenticated" USING ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role"));



CREATE POLICY "posts_team_insert" ON "public"."team_posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND "public"."team_role_at_least"("team_id", 'officer'::"public"."team_role")));



CREATE POLICY "posts_team_read" ON "public"."team_posts" FOR SELECT TO "authenticated" USING ("public"."is_team_member"("team_id"));



CREATE POLICY "posts_team_update" ON "public"."team_posts" FOR UPDATE TO "authenticated" USING ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role")) WITH CHECK ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role"));



ALTER TABLE "public"."practice_session_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "practice_session_answers_own" ON "public"."practice_session_answers" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."practice_session_commits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "practice_session_commits_own" ON "public"."practice_session_commits" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("visibility" = 'public'::"text") OR ("id" = "auth"."uid"()) OR (("team_id" IS NOT NULL) AND "public"."is_team_member"("team_id"))));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK ((("id" = "auth"."uid"()) AND ("platform_role" = ( SELECT "p"."platform_role"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))));



ALTER TABLE "public"."prompt_packs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_packs_admin_all" ON "public"."prompt_packs" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."question_fingerprints" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "question_fingerprints_admin_all" ON "public"."question_fingerprints" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_admin_insert" ON "public"."questions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "questions_admin_update" ON "public"."questions" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "questions_read_live" ON "public"."questions" FOR SELECT TO "authenticated" USING ((("status" = 'live'::"public"."question_status") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."platform_role" = 'admin'::"text"))))));



CREATE POLICY "reinjection_own" ON "public"."reinjection_queue" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."reinjection_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roster_select_members" ON "public"."team_roster" FOR SELECT TO "authenticated" USING ("public"."is_team_member"("team_id"));



ALTER TABLE "public"."taxonomy_concepts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomy_concepts_admin_update" ON "public"."taxonomy_concepts" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "taxonomy_concepts_read" ON "public"."taxonomy_concepts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."taxonomy_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomy_events_admin_update" ON "public"."taxonomy_events" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "taxonomy_events_read" ON "public"."taxonomy_events" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."taxonomy_topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "taxonomy_topics_read" ON "public"."taxonomy_topics" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."team_event_coverage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_roster" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_vault_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_select_members" ON "public"."teams" FOR SELECT TO "authenticated" USING ("public"."is_team_member"("id"));



CREATE POLICY "timed_commits_own" ON "public"."timed_session_commits" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."timed_session_commits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_badges_own" ON "public"."user_badges" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_mission_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_stats_own" ON "public"."user_stats" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_vault_loadout" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_weakness_map" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vault_loadout_own" ON "public"."user_vault_loadout" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."team_vault_resources" "r"
  WHERE (("r"."id" = "user_vault_loadout"."resource_id") AND "public"."is_team_member"("r"."team_id"))))));



CREATE POLICY "vault_team_read" ON "public"."team_vault_resources" FOR SELECT TO "authenticated" USING ("public"."is_team_member"("team_id"));



CREATE POLICY "vault_team_write" ON "public"."team_vault_resources" TO "authenticated" USING ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role")) WITH CHECK ("public"."team_role_at_least"("team_id", 'officer'::"public"."team_role"));



CREATE POLICY "weakness_own" ON "public"."user_weakness_map" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";






















































































































































GRANT ALL ON FUNCTION "public"."admin_append_raw_excerpt"("p_existing" "text", "p_incoming" "text", "p_attempt" integer, "p_finish_reason" "text", "p_cap" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_apply_critic_result"("p_question_id" "uuid", "p_score" numeric, "p_notes" "text", "p_route" "text", "p_audit" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_archive_import_batch"("p_batch_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_bulk_set_question_status"("p_ids" "uuid"[], "p_status" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_clear_incomplete_generation"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_clear_orphan_fingerprints"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_commit_import_batch"("p_event_id" "text", "p_source" "text", "p_label" "text", "p_rows" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_concept_coverage"("p_concept_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_create_generation_job"("p_config" "jsonb") TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."questions" TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_critic_claim_batch"("p_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_critic_stats"("p_event_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_delete_generation_job"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_effective_concept_coverage"("p_concept_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_event_media_menu"("p_event_id" "text", "p_concept_id" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_event_media_usage"("p_event_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_event_media_usage"("p_event_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_event_pack_ready"("p_event_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_explode_generation_plan"("p_config" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_fingerprint_is_dup"("p_concept_id" "text", "p_stem" "text") TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."generation_job_items" TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_claim_item"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_complete_item"("p_item_id" "uuid", "p_written" integer, "p_rejected" integer, "p_raw_excerpt" "text", "p_token_usage" "jsonb", "p_finish_reason" "text", "p_diagnosis" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_fail_item"("p_item_id" "uuid", "p_error" "text", "p_raw_excerpt" "text", "p_token_usage" "jsonb", "p_finish_reason" "text", "p_diagnosis" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_get_context"("p_item_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_recover_stale_items"("p_job_id" "uuid", "p_stale_seconds" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_retry_incomplete"("p_job_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_generation_set_job_status"("p_job_id" "uuid", "p_status" "text", "p_pause_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_inflight_generation_count"("p_concept_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_insert_generated_question"("p_item_id" "uuid", "p_question" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_master_pack_ready"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_merge_token_usage"("p_existing" "jsonb", "p_incoming" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_normalize_stem"("p_stem" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_preview_generation"("p_config" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_question_coverage"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_queue_media_topup"("p_event_id" "text", "p_min_live" integer, "p_per_asset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_queue_media_topup"("p_event_id" "text", "p_min_live" integer, "p_per_asset" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_review_queue"("p_event_id" "text", "p_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_set_needs_fix"("p_question_id" "uuid", "p_needs" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_question_media"("p_question_id" "uuid", "p_media_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_question_media"("p_question_id" "uuid", "p_media_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_shuffle_mcq_options"("p_options" "jsonb", "p_correct_key" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_split_concept_passes"("p_gap" integer, "p_n_per_call" integer, "p_pass_mode" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_stem_exact_hash"("p_stem" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."complete_clinic_do"("p_concept_id" "text", "p_session_token" "text", "p_timezone" "text") TO "authenticated";



GRANT SELECT,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON FUNCTION "public"."complete_onboarding"("p_handle" "text", "p_division" "public"."division_type", "p_join_code" "text") TO "authenticated";



GRANT SELECT ON TABLE "public"."teams" TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_team"("p_name" "text", "p_school_name" "text", "p_division" "public"."division_type") TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_missions" TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_team_mission"("p_title" "text", "p_target_event_id" "text", "p_goal_type" "text", "p_target_value" integer, "p_deadline" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."flag_questions_broken_media"("p_question_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."flag_questions_broken_media"("p_question_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_handle_available"("p_handle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_handle_available"("p_handle" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."join_team_by_code"("p_code" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rank_title_from_xp"("p_xp" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."refresh_user_stats"("p_user_id" "uuid") TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_event_coverage" TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_event_coverage"("p_user_id" "uuid", "p_event_id" "text", "p_status" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_my_avatar"("p_avatar_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."submit_casual_session"("p_session_token" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_timezone" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."submit_timed_session"("p_session_token" "text", "p_event_id" "text", "p_topic_id" "text", "p_answers" "jsonb", "p_timezone" "text", "p_elapsed_ms" integer, "p_time_limit_ms" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_my_badges"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_my_mission_progress"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."team_leaderboard"("p_metric" "text", "p_event_id" "text", "p_window" "text") TO "authenticated";


















GRANT SELECT ON TABLE "public"."binder_assets" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."binder_audits" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."binder_concept_marks" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."binder_custom_sections" TO "authenticated";



GRANT SELECT ON TABLE "public"."casual_session_commits" TO "authenticated";



GRANT SELECT ON TABLE "public"."clinic_do_awards" TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."concept_guides" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."event_media" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."generation_jobs" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."import_batches" TO "authenticated";



GRANT SELECT ON TABLE "public"."mission_complete_awards" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."prompt_packs" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."question_fingerprints" TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."reinjection_queue" TO "authenticated";



GRANT SELECT,UPDATE ON TABLE "public"."taxonomy_concepts" TO "authenticated";



GRANT SELECT,UPDATE ON TABLE "public"."taxonomy_events" TO "authenticated";



GRANT SELECT ON TABLE "public"."taxonomy_topics" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_posts" TO "authenticated";



GRANT SELECT ON TABLE "public"."team_roster" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."team_vault_resources" TO "authenticated";



GRANT SELECT ON TABLE "public"."timed_session_commits" TO "authenticated";



GRANT SELECT ON TABLE "public"."user_badges" TO "authenticated";



GRANT SELECT,INSERT ON TABLE "public"."user_history" TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."user_mission_progress" TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."user_weakness_map" TO "authenticated";



GRANT SELECT ON TABLE "public"."user_topic_weakness" TO "authenticated";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."user_vault_loadout" TO "authenticated";


































