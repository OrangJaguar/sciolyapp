-- Each answer fills one mission. The oldest mission that can take it fills first.
-- A weekly copy only sees answers inside its own week, so last week cannot fill this week.

ALTER TABLE public.team_missions
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS timed_seconds integer,
  ADD COLUMN IF NOT EXISTS deadline_policy text DEFAULT 'late',
  ADD COLUMN IF NOT EXISTS opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_id uuid;

ALTER TABLE public.user_mission_progress
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.mission_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('answered', 'correct')),
  target_value integer NOT NULL CHECK (target_value >= 1),
  due_isodow integer NOT NULL CHECK (due_isodow BETWEEN 1 AND 7),
  due_minute integer NOT NULL CHECK (due_minute BETWEEN 0 AND 1439),
  timezone text NOT NULL DEFAULT 'UTC',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, event_id)
);

ALTER TABLE public.team_missions
  DROP CONSTRAINT IF EXISTS team_missions_recurrence_id_fkey;

ALTER TABLE public.team_missions
  ADD CONSTRAINT team_missions_recurrence_id_fkey
  FOREIGN KEY (recurrence_id) REFERENCES public.mission_recurrences(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_missions_recurrence_deadline_uidx
  ON public.team_missions (recurrence_id, deadline)
  WHERE recurrence_id IS NOT NULL;

ALTER TABLE public.mission_recurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_recurrences_read ON public.mission_recurrences;
CREATE POLICY mission_recurrences_read ON public.mission_recurrences
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS mission_recurrences_write ON public.mission_recurrences;
CREATE POLICY mission_recurrences_write ON public.mission_recurrences
  FOR ALL TO authenticated
  USING (public.team_role_at_least(team_id, 'officer'))
  WITH CHECK (public.team_role_at_least(team_id, 'officer'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_recurrences TO authenticated;

CREATE OR REPLACE FUNCTION public.next_weekly_deadline(
  p_after timestamptz,
  p_isodow integer,
  p_minute integer,
  p_tz text
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  local_ts timestamp;
  dow integer;
  mins integer;
  delta integer;
  due_local timestamp;
BEGIN
  local_ts := p_after AT TIME ZONE p_tz;
  dow := EXTRACT(ISODOW FROM local_ts)::integer;
  mins := EXTRACT(HOUR FROM local_ts)::integer * 60
    + EXTRACT(MINUTE FROM local_ts)::integer;
  delta := (p_isodow - dow + 7) % 7;
  IF delta = 0 AND mins >= p_minute THEN
    delta := 7;
  END IF;
  due_local := date_trunc('day', local_ts)
    + make_interval(days => delta, mins => p_minute);
  RETURN due_local AT TIME ZONE p_tz;
END;
$$;

ALTER FUNCTION public.next_weekly_deadline(timestamptz, integer, integer, text) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.ensure_recurring_missions(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  opens timestamptz;
  due timestamptz;
  title_text text;
BEGIN
  IF p_team_id IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM public.mission_recurrences
    WHERE team_id = p_team_id AND active
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.team_missions
      WHERE recurrence_id = rec.id AND deadline > now()
    ) THEN
      CONTINUE;
    END IF;

    SELECT m.deadline INTO opens
    FROM public.team_missions m
    WHERE m.recurrence_id = rec.id
    ORDER BY m.deadline DESC
    LIMIT 1;

    IF opens IS NULL THEN
      -- First copy, even mid-week: this cycle only. The window opens at the
      -- previous deadline, so work already done this week counts and last week does not.
      due := public.next_weekly_deadline(now(), rec.due_isodow, rec.due_minute, rec.timezone);
      opens := due - interval '7 days';
    ELSE
      due := public.next_weekly_deadline(opens, rec.due_isodow, rec.due_minute, rec.timezone);
    END IF;
    IF due <= opens THEN
      due := public.next_weekly_deadline(
        GREATEST(opens, now()) + interval '1 minute',
        rec.due_isodow,
        rec.due_minute,
        rec.timezone
      );
    END IF;

    title_text := 'Every week · ' || rec.target_value || ' ' || rec.goal_type;

    INSERT INTO public.team_missions (
      team_id, created_by, title, target_event_id, goal_type, target_value,
      deadline, kind, deadline_policy, opens_at, recurrence_id
    ) VALUES (
      rec.team_id, rec.created_by, title_text, rec.event_id, rec.goal_type,
      rec.target_value, due, 'casual', 'close', opens, rec.id
    )
    ON CONFLICT (recurrence_id, deadline) WHERE recurrence_id IS NOT NULL DO NOTHING;
  END LOOP;
END;
$$;

ALTER FUNCTION public.ensure_recurring_missions(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ensure_recurring_missions(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_recurring_missions(
  p_goal_type text,
  p_target_value integer,
  p_due_isodow integer,
  p_due_minute integer,
  p_timezone text,
  p_event_ids text[]
) RETURNS SETOF public.mission_recurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  goal_norm text := lower(trim(COALESCE(p_goal_type, '')));
  tz text := NULLIF(trim(COALESCE(p_timezone, '')), '');
  event_id text;
  rule public.mission_recurrences;
  title_text text;
  opens timestamptz;
  due timestamptz;
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
  IF goal_norm NOT IN ('answered', 'correct') THEN
    RAISE EXCEPTION 'Goal must be answered or correct';
  END IF;
  IF p_target_value IS NULL OR p_target_value < 1 THEN
    RAISE EXCEPTION 'Question count has to be at least 1';
  END IF;
  IF p_due_isodow IS NULL OR p_due_isodow < 1 OR p_due_isodow > 7 THEN
    RAISE EXCEPTION 'Pick a day of the week';
  END IF;
  IF p_due_minute IS NULL OR p_due_minute < 0 OR p_due_minute > 1439 THEN
    RAISE EXCEPTION 'Pick a time';
  END IF;
  IF tz IS NULL THEN
    tz := 'UTC';
  END IF;
  IF p_event_ids IS NULL OR array_length(p_event_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Pick at least one event';
  END IF;

  PERFORM public.next_weekly_deadline(now(), p_due_isodow, p_due_minute, tz);

  FOREACH event_id IN ARRAY p_event_ids LOOP
    IF event_id IN (
      'boomilever', 'electric_vehicle', 'mission_possible',
      'ping_pong_parachute', 'wright_stuff'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.taxonomy_events
      WHERE id = event_id AND active AND studyable
    ) THEN
      RAISE EXCEPTION 'Unknown studyable event: %', event_id;
    END IF;

    INSERT INTO public.mission_recurrences (
      team_id, created_by, event_id, goal_type, target_value,
      due_isodow, due_minute, timezone, active
    ) VALUES (
      tid, uid, event_id, goal_norm, p_target_value,
      p_due_isodow, p_due_minute, tz, true
    )
    ON CONFLICT (team_id, event_id) DO UPDATE SET
      created_by = EXCLUDED.created_by,
      goal_type = EXCLUDED.goal_type,
      target_value = EXCLUDED.target_value,
      due_isodow = EXCLUDED.due_isodow,
      due_minute = EXCLUDED.due_minute,
      timezone = EXCLUDED.timezone,
      active = true
    RETURNING * INTO rule;

    due := public.next_weekly_deadline(now(), rule.due_isodow, rule.due_minute, rule.timezone);
    opens := due - interval '7 days';
    IF due <= opens THEN
      due := public.next_weekly_deadline(now() + interval '1 minute', rule.due_isodow, rule.due_minute, rule.timezone);
      opens := due - interval '7 days';
    END IF;
    title_text := 'Every week · ' || rule.target_value || ' ' || rule.goal_type;

    UPDATE public.team_missions
    SET goal_type = rule.goal_type,
        target_value = rule.target_value,
        title = title_text,
        deadline = due,
        opens_at = COALESCE(opens_at, opens),
        deadline_policy = 'close',
        kind = 'casual'
    WHERE recurrence_id = rule.id
      AND deadline > now();

    IF NOT FOUND THEN
      INSERT INTO public.team_missions (
        team_id, created_by, title, target_event_id, goal_type, target_value,
        deadline, kind, deadline_policy, opens_at, recurrence_id
      ) VALUES (
        tid, uid, title_text, rule.event_id, rule.goal_type, rule.target_value,
        due, 'casual', 'close', opens, rule.id
      )
      ON CONFLICT (recurrence_id, deadline) WHERE recurrence_id IS NOT NULL DO NOTHING;
    END IF;

    RETURN NEXT rule;
  END LOOP;

  PERFORM public.ensure_recurring_missions(tid);
END;
$$;

ALTER FUNCTION public.create_recurring_missions(text, integer, integer, integer, text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_recurring_missions(text, integer, integer, integer, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_recurring_missions(text, integer, integer, integer, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.stop_recurring_mission(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL OR NOT public.team_role_at_least(tid, 'officer') THEN
    RAISE EXCEPTION 'Officer role or higher required';
  END IF;

  UPDATE public.mission_recurrences
  SET active = false
  WHERE id = p_id AND team_id = tid;

  DELETE FROM public.team_missions
  WHERE recurrence_id = p_id
    AND team_id = tid
    AND deadline > now();
END;
$$;

ALTER FUNCTION public.stop_recurring_mission(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.stop_recurring_mission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stop_recurring_mission(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_my_mission_progress_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_answer record;
  v_session record;
  v_pick uuid;
  v_row record;
  v_synced integer := 0;
  v_newly integer := 0;
  v_xp integer := 0;
BEGIN
  SELECT team_id INTO v_team_id FROM public.profiles WHERE id = p_user_id;
  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object(
      'synced', 0, 'newly_completed', 0, 'xp_awarded', 0, 'newly_unlocked', '[]'::jsonb
    );
  END IF;

  PERFORM public.ensure_recurring_missions(v_team_id);

  DROP TABLE IF EXISTS mission_alloc;
  CREATE TEMP TABLE mission_alloc (
    mission_id uuid PRIMARY KEY,
    current_value integer NOT NULL,
    finish_at timestamptz,
    was_completed boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO mission_alloc (mission_id, current_value, finish_at, was_completed)
  SELECT m.id, 0, NULL, COALESCE(p.completed, false)
  FROM public.team_missions m
  LEFT JOIN public.user_mission_progress p
    ON p.mission_id = m.id AND p.user_id = p_user_id
  WHERE m.team_id = v_team_id
    AND (
      m.target_event_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.team_event_coverage c
        WHERE c.team_id = v_team_id
          AND c.user_id = p_user_id
          AND c.event_id = m.target_event_id
      )
    );

  -- Casual: one answer, one mission. Oldest incomplete mission in the window takes it.
  FOR v_answer IN
    SELECT psa.id, psa.created_at, psa.event_id, psa.is_correct
    FROM public.practice_session_answers psa
    WHERE psa.user_id = p_user_id
      AND psa.mode = 'casual'
      AND psa.skipped = false
      AND psa.invalidated = false
    ORDER BY psa.created_at, psa.id
  LOOP
    v_pick := NULL;
    SELECT a.mission_id INTO v_pick
    FROM mission_alloc a
    JOIN public.team_missions m ON m.id = a.mission_id
    WHERE COALESCE(m.kind, 'casual') = 'casual'
      AND a.current_value < m.target_value
      AND v_answer.created_at >= COALESCE(m.opens_at, m.created_at)
      AND (
        NOT (
          m.recurrence_id IS NOT NULL
          OR COALESCE(m.deadline_policy, 'late') = 'close'
        )
        OR v_answer.created_at < m.deadline
      )
      AND (m.target_event_id IS NULL OR m.target_event_id = v_answer.event_id)
      AND (m.goal_type <> 'correct' OR v_answer.is_correct IS TRUE)
    ORDER BY m.created_at, m.deadline, m.id
    LIMIT 1;

    IF v_pick IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE mission_alloc a
    SET current_value = a.current_value + 1,
        finish_at = CASE
          WHEN a.current_value + 1 >= m.target_value
            THEN COALESCE(a.finish_at, v_answer.created_at)
          ELSE a.finish_at
        END
    FROM public.team_missions m
    WHERE a.mission_id = v_pick
      AND m.id = v_pick;
  END LOOP;

  -- Timed: a whole sitting goes to the oldest test that is still open. It is not reused.
  FOR v_session IN
    SELECT
      psa.session_token,
      psa.event_id,
      MIN(psa.created_at) AS started,
      MAX(psa.created_at) AS ended,
      COUNT(*) FILTER (WHERE psa.is_correct)::integer AS correct_n,
      COUNT(*)::integer AS answered_n
    FROM public.practice_session_answers psa
    WHERE psa.user_id = p_user_id
      AND psa.mode = 'timed'
      AND psa.skipped = false
      AND psa.invalidated = false
    GROUP BY psa.session_token, psa.event_id
    ORDER BY MIN(psa.created_at), psa.session_token
  LOOP
    v_pick := NULL;
    SELECT a.mission_id INTO v_pick
    FROM mission_alloc a
    JOIN public.team_missions m ON m.id = a.mission_id
    WHERE m.kind = 'timed'
      AND a.current_value < m.target_value
      AND v_session.started >= COALESCE(m.opens_at, m.created_at)
      AND (
        NOT (COALESCE(m.deadline_policy, 'late') = 'close')
        OR v_session.started < m.deadline
      )
      AND (m.target_event_id IS NULL OR m.target_event_id = v_session.event_id)
    ORDER BY m.created_at, m.deadline, m.id
    LIMIT 1;

    IF v_pick IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE mission_alloc a
    SET current_value = GREATEST(
          a.current_value,
          CASE
            WHEN m.goal_type = 'correct' THEN v_session.correct_n
            ELSE v_session.answered_n
          END
        ),
        finish_at = CASE
          WHEN GREATEST(
            a.current_value,
            CASE
              WHEN m.goal_type = 'correct' THEN v_session.correct_n
              ELSE v_session.answered_n
            END
          ) >= m.target_value
            THEN COALESCE(a.finish_at, v_session.ended)
          ELSE a.finish_at
        END
    FROM public.team_missions m
    WHERE a.mission_id = v_pick
      AND m.id = v_pick;
  END LOOP;

  INSERT INTO public.user_mission_progress (
    user_id, mission_id, current_value, completed, completed_at
  )
  SELECT
    p_user_id,
    a.mission_id,
    a.current_value,
    a.current_value >= m.target_value,
    CASE
      WHEN a.current_value >= m.target_value THEN a.finish_at
      ELSE NULL
    END
  FROM mission_alloc a
  JOIN public.team_missions m ON m.id = a.mission_id
  ON CONFLICT (user_id, mission_id) DO UPDATE SET
    current_value = EXCLUDED.current_value,
    completed = EXCLUDED.completed,
    completed_at = CASE
      WHEN EXCLUDED.completed THEN COALESCE(
        user_mission_progress.completed_at,
        EXCLUDED.completed_at
      )
      ELSE NULL
    END;

  FOR v_row IN
    SELECT a.mission_id
    FROM mission_alloc a
    JOIN public.team_missions m ON m.id = a.mission_id
    WHERE a.current_value >= m.target_value
      AND NOT a.was_completed
  LOOP
    v_newly := v_newly + 1;
    v_xp := v_xp + public.award_non_practice_xp(p_user_id, 25);
  END LOOP;

  SELECT COUNT(*)::integer INTO v_synced FROM mission_alloc;

  RETURN jsonb_build_object(
    'synced', v_synced,
    'newly_completed', v_newly,
    'xp_awarded', v_xp,
    'newly_unlocked', '[]'::jsonb
  );
END;
$$;

ALTER FUNCTION public.sync_my_mission_progress_for_user(uuid) OWNER TO postgres;

-- One-off casual and tests start at the moment they are created, so earlier answers stay on older missions.
CREATE OR REPLACE FUNCTION public.create_event_missions(
  p_kind text,
  p_goal_type text,
  p_target_value integer,
  p_deadline timestamptz,
  p_event_ids text[],
  p_timed_seconds integer,
  p_deadline_policy text DEFAULT 'late'
) RETURNS SETOF public.team_missions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  kind_norm text;
  goal_norm text;
  policy_norm text;
  event_id text;
  title_text text;
  minutes integer;
  mission public.team_missions;
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

  kind_norm := lower(trim(COALESCE(p_kind, '')));
  IF kind_norm NOT IN ('casual', 'timed') THEN
    RAISE EXCEPTION 'kind must be casual or timed';
  END IF;

  goal_norm := lower(trim(COALESCE(p_goal_type, 'answered')));
  IF goal_norm NOT IN ('answered', 'correct') THEN
    RAISE EXCEPTION 'goal_type must be answered or correct';
  END IF;

  policy_norm := lower(trim(COALESCE(p_deadline_policy, 'late')));
  IF policy_norm NOT IN ('close', 'late', 'count') THEN
    RAISE EXCEPTION 'deadline policy must be close, late, or count';
  END IF;

  IF p_target_value IS NULL OR p_target_value < 1 THEN
    RAISE EXCEPTION 'target_value must be >= 1';
  END IF;
  IF p_deadline IS NULL OR p_deadline <= now() THEN
    RAISE EXCEPTION 'deadline must be in the future';
  END IF;
  IF p_event_ids IS NULL OR array_length(p_event_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Pick at least one event';
  END IF;

  IF kind_norm = 'timed' THEN
    IF p_timed_seconds IS NULL OR p_timed_seconds < 60 THEN
      RAISE EXCEPTION 'Test length must be at least 1 minute';
    END IF;
    minutes := p_timed_seconds / 60;
    title_text := format('Test · %s Q · %s min', p_target_value, minutes);
  ELSE
    title_text := format('Casual · %s %s', p_target_value, goal_norm);
  END IF;

  FOREACH event_id IN ARRAY p_event_ids LOOP
    IF event_id IN (
      'boomilever', 'electric_vehicle', 'mission_possible',
      'ping_pong_parachute', 'wright_stuff'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.taxonomy_events
      WHERE id = event_id AND active AND studyable
    ) THEN
      RAISE EXCEPTION 'Unknown studyable event: %', event_id;
    END IF;

    INSERT INTO public.team_missions (
      team_id, created_by, title, target_event_id, goal_type, target_value,
      deadline, kind, timed_seconds, deadline_policy, opens_at
    ) VALUES (
      tid, uid, title_text, event_id, goal_norm, p_target_value, p_deadline,
      kind_norm,
      CASE WHEN kind_norm = 'timed' THEN p_timed_seconds ELSE NULL END,
      policy_norm,
      now()
    )
    RETURNING * INTO mission;

    INSERT INTO public.user_mission_progress (mission_id, user_id, current_value, completed)
    SELECT mission.id, c.user_id, 0, false
    FROM public.team_event_coverage c
    WHERE c.team_id = tid AND c.event_id = event_id
    ON CONFLICT DO NOTHING;

    RETURN NEXT mission;
  END LOOP;
END;
$$;

ALTER FUNCTION public.create_event_missions(text, text, integer, timestamptz, text[], integer, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_event_missions(text, text, integer, timestamptz, text[], integer, text) TO authenticated;

