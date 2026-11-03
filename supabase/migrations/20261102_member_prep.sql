-- Captain+ can read a teammate's sessions, question times, and missions.
-- Session rows are otherwise private to the person who took them.

CREATE OR REPLACE FUNCTION public.team_member_prep(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  target_tid uuid;
  result jsonb;
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

  SELECT team_id INTO target_tid FROM public.profiles WHERE id = p_user_id;
  IF target_tid IS NULL OR target_tid <> tid THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  WITH answers AS (
    SELECT *
    FROM public.practice_session_answers
    WHERE user_id = p_user_id
      AND invalidated = false
  ),
  summary AS (
    SELECT
      count(DISTINCT session_token)::int AS session_count,
      count(*) FILTER (WHERE NOT skipped)::int AS answered,
      count(*) FILTER (WHERE is_correct)::int AS correct,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY response_ms)
        FILTER (WHERE response_ms IS NOT NULL AND NOT skipped) AS median_ms,
      count(*) FILTER (
        WHERE NOT skipped AND response_ms IS NOT NULL AND response_ms < 8000
      )::int AS fast_answered,
      count(*) FILTER (
        WHERE is_correct AND response_ms IS NOT NULL AND response_ms < 8000
      )::int AS fast_correct
    FROM answers
  ),
  by_event AS (
    SELECT
      a.event_id,
      e.name AS event_name,
      count(*) FILTER (WHERE NOT a.skipped)::int AS answered,
      count(*) FILTER (WHERE a.is_correct)::int AS correct
    FROM answers a
    LEFT JOIN public.taxonomy_events e ON e.id = a.event_id
    GROUP BY a.event_id, e.name
    ORDER BY count(*) DESC
    LIMIT 12
  ),
  sessions AS (
    SELECT
      a.session_token,
      a.mode,
      (array_agg(a.event_id ORDER BY a.created_at))[1] AS event_id,
      (array_agg(e.name ORDER BY a.created_at))[1] AS event_name,
      min(a.created_at) AS started_at,
      count(*) FILTER (WHERE NOT a.skipped)::int AS answered,
      count(*) FILTER (WHERE a.is_correct)::int AS correct,
      count(*) FILTER (WHERE a.skipped)::int AS skipped,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY a.response_ms)
        FILTER (WHERE a.response_ms IS NOT NULL AND NOT a.skipped) AS median_ms,
      max(c.elapsed_ms) AS elapsed_ms
    FROM answers a
    LEFT JOIN public.taxonomy_events e ON e.id = a.event_id
    LEFT JOIN public.practice_session_commits c
      ON c.user_id = p_user_id
     AND c.session_token = a.session_token
     AND c.mode = a.mode
    GROUP BY a.session_token, a.mode
    ORDER BY min(a.created_at) DESC
    LIMIT 40
  ),
  missions AS (
    SELECT
      m.id,
      m.title,
      m.goal_type,
      m.target_value,
      m.deadline,
      m.target_event_id,
      e.name AS event_name,
      COALESCE(ump.current_value, 0) AS current_value,
      COALESCE(ump.completed, false) AS completed
    FROM public.team_missions m
    LEFT JOIN public.taxonomy_events e ON e.id = m.target_event_id
    LEFT JOIN public.user_mission_progress ump
      ON ump.mission_id = m.id AND ump.user_id = p_user_id
    WHERE m.team_id = tid
      AND (
        m.target_event_id IS NULL
        OR m.target_event_id IN (
          SELECT c.event_id
          FROM public.team_event_coverage c
          WHERE c.team_id = tid AND c.user_id = p_user_id
        )
      )
    ORDER BY m.deadline DESC
    LIMIT 24
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'sessions', s.session_count,
        'answered', s.answered,
        'correct', s.correct,
        'median_response_ms', round(s.median_ms)::int,
        'fast_answered', s.fast_answered,
        'fast_correct', s.fast_correct
      )
      FROM summary s
    ),
    'by_event', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_id', event_id,
          'event_name', event_name,
          'answered', answered,
          'correct', correct
        )
        ORDER BY answered DESC
      )
      FROM by_event
    ), '[]'::jsonb),
    'sessions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'session_token', session_token,
          'mode', mode,
          'event_id', event_id,
          'event_name', event_name,
          'started_at', started_at,
          'answered', answered,
          'correct', correct,
          'skipped', skipped,
          'median_response_ms', round(median_ms)::int,
          'elapsed_ms', elapsed_ms
        )
        ORDER BY started_at DESC
      )
      FROM sessions
    ), '[]'::jsonb),
    'missions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'goal_type', goal_type,
          'target_value', target_value,
          'deadline', deadline,
          'event_name', event_name,
          'current_value', current_value,
          'completed', completed
        )
        ORDER BY deadline DESC
      )
      FROM missions
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.team_member_session(
  p_user_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  target_tid uuid;
  result jsonb;
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

  SELECT team_id INTO target_tid FROM public.profiles WHERE id = p_user_id;
  IF target_tid IS NULL OR target_tid <> tid THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q) ORDER BY q.created_at), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      a.created_at,
      a.is_correct,
      a.skipped,
      a.response_ms,
      t.name AS topic_name,
      left(regexp_replace(coalesce(qs.stem, ''), '\s+', ' ', 'g'), 160) AS stem
    FROM public.practice_session_answers a
    LEFT JOIN public.taxonomy_topics t ON t.id = a.topic_id
    LEFT JOIN public.questions qs ON qs.id::text = a.question_id
    WHERE a.user_id = p_user_id
      AND a.session_token = p_session_token
      AND a.invalidated = false
    ORDER BY a.created_at
    LIMIT 80
  ) q;

  RETURN result;
END;
$$;

ALTER FUNCTION public.team_member_prep(uuid) OWNER TO postgres;
ALTER FUNCTION public.team_member_session(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.team_member_prep(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_member_session(uuid, text) TO authenticated;
