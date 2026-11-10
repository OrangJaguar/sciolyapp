-- Deadline policy, finish time, and a frozen progress snapshot at the deadline.
-- Older missions on the same event fill before newer ones.

ALTER TABLE public.team_missions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS timed_seconds integer,
  ADD COLUMN IF NOT EXISTS deadline_policy text NOT NULL DEFAULT 'late';

ALTER TABLE public.team_missions
  DROP CONSTRAINT IF EXISTS team_missions_kind_check;
ALTER TABLE public.team_missions
  ADD CONSTRAINT team_missions_kind_check
  CHECK (kind = ANY (ARRAY['casual'::text, 'timed'::text]));

ALTER TABLE public.team_missions
  DROP CONSTRAINT IF EXISTS team_missions_deadline_policy_check;
ALTER TABLE public.team_missions
  ADD CONSTRAINT team_missions_deadline_policy_check
  CHECK (deadline_policy = ANY (ARRAY['close'::text, 'late'::text, 'count'::text]));

ALTER TABLE public.user_mission_progress
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_value integer,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz;

DROP FUNCTION IF EXISTS public.create_event_missions(text, text, integer, timestamptz, text[], integer);
DROP FUNCTION IF EXISTS public.create_event_missions(text, text, integer, timestamptz, text[], integer, text);

CREATE FUNCTION public.create_event_missions(
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
SET search_path TO public
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
    IF NOT EXISTS (
      SELECT 1 FROM public.taxonomy_events
      WHERE id = event_id AND active AND studyable
    ) THEN
      RAISE EXCEPTION 'Unknown studyable event: %', event_id;
    END IF;

    INSERT INTO public.team_missions (
      team_id, created_by, title, target_event_id, goal_type, target_value,
      deadline, kind, timed_seconds, deadline_policy
    ) VALUES (
      tid, uid, title_text, event_id, goal_norm, p_target_value, p_deadline,
      kind_norm,
      CASE WHEN kind_norm = 'timed' THEN p_timed_seconds ELSE NULL END,
      policy_norm
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
GRANT ALL ON FUNCTION public.create_event_missions(text, text, integer, timestamptz, text[], integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_my_mission_progress_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_team_id uuid;
  bucket record;
  mrec record;
  answers timestamptz[];
  idx integer;
  n integer;
  ts timestamptz;
  taken integer;
  due_taken integer;
  finish_at timestamptz;
  v_was boolean;
  v_old_finished timestamptz;
  v_snap_at timestamptz;
  v_snap_val integer;
  v_finished timestamptz;
  v_synced integer := 0;
  v_newly integer := 0;
  v_xp integer := 0;
  session record;
  ids uuid[];
  targets integer[];
  deadlines timestamptz[];
  createds timestamptz[];
  policies text[];
  lives integer[];
  dues integer[];
  finishes timestamptz[];
  locked boolean[];
  i integer;
  mission_count integer;
  applied boolean;
BEGIN
  SELECT team_id INTO v_team_id FROM public.profiles WHERE id = p_user_id;
  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('synced', 0, 'newly_completed', 0, 'xp_awarded', 0, 'newly_unlocked', '[]'::jsonb);
  END IF;

  FOR bucket IN
    SELECT
      m.target_event_id AS event_id,
      CASE
        WHEN COALESCE(m.kind, 'casual') = 'timed' OR m.title ILIKE 'Test%' THEN 'timed'
        ELSE 'casual'
      END AS kind,
      m.goal_type AS goal_type
    FROM public.team_missions m
    WHERE m.team_id = v_team_id
      AND (
        m.target_event_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.team_event_coverage c
          WHERE c.team_id = v_team_id
            AND c.user_id = p_user_id
            AND c.event_id = m.target_event_id
        )
      )
    GROUP BY 1, 2, 3
  LOOP
    IF bucket.kind = 'casual' THEN
      SELECT COALESCE(array_agg(psa.created_at ORDER BY psa.created_at), '{}'::timestamptz[])
      INTO answers
      FROM public.practice_session_answers psa
      WHERE psa.user_id = p_user_id
        AND psa.mode = 'casual'
        AND psa.skipped = false
        AND psa.invalidated = false
        AND (bucket.goal_type <> 'correct' OR psa.is_correct = true)
        AND (bucket.event_id IS NULL OR psa.event_id = bucket.event_id);

      idx := 1;
      n := COALESCE(array_length(answers, 1), 0);

      FOR mrec IN
        SELECT m.*
        FROM public.team_missions m
        WHERE m.team_id = v_team_id
          AND m.target_event_id IS NOT DISTINCT FROM bucket.event_id
          AND m.goal_type = bucket.goal_type
          AND (
            CASE
              WHEN COALESCE(m.kind, 'casual') = 'timed' OR m.title ILIKE 'Test%' THEN 'timed'
              ELSE 'casual'
            END
          ) = 'casual'
        ORDER BY m.deadline, m.created_at, m.id
      LOOP
        taken := 0;
        due_taken := 0;
        finish_at := NULL;

        WHILE taken < mrec.target_value AND idx <= n LOOP
          ts := answers[idx];
          IF ts < mrec.created_at THEN
            idx := idx + 1;
            CONTINUE;
          END IF;
          IF COALESCE(mrec.deadline_policy, 'late') = 'close' AND ts > mrec.deadline THEN
            EXIT;
          END IF;
          taken := taken + 1;
          IF ts <= mrec.deadline THEN
            due_taken := due_taken + 1;
          END IF;
          IF taken >= mrec.target_value THEN
            finish_at := ts;
          END IF;
          idx := idx + 1;
        END LOOP;

        v_synced := v_synced + 1;
        SELECT ump.completed, ump.completed_at, ump.snapshot_at, ump.snapshot_value
        INTO v_was, v_old_finished, v_snap_at, v_snap_val
        FROM public.user_mission_progress ump
        WHERE ump.user_id = p_user_id AND ump.mission_id = mrec.id;

        IF NOT FOUND THEN
          v_was := false;
          v_old_finished := NULL;
          v_snap_at := NULL;
          v_snap_val := NULL;
        END IF;

        IF v_snap_at IS NULL AND now() > mrec.deadline THEN
          v_snap_val := due_taken;
          v_snap_at := now();
        END IF;

        IF taken >= mrec.target_value THEN
          v_finished := COALESCE(v_old_finished, finish_at, now());
        ELSE
          v_finished := NULL;
        END IF;

        INSERT INTO public.user_mission_progress (
          user_id, mission_id, current_value, completed, completed_at, snapshot_value, snapshot_at
        ) VALUES (
          p_user_id, mrec.id, taken, taken >= mrec.target_value, v_finished, v_snap_val, v_snap_at
        )
        ON CONFLICT (user_id, mission_id) DO UPDATE SET
          current_value = EXCLUDED.current_value,
          completed = EXCLUDED.completed,
          completed_at = EXCLUDED.completed_at,
          snapshot_value = COALESCE(public.user_mission_progress.snapshot_value, EXCLUDED.snapshot_value),
          snapshot_at = COALESCE(public.user_mission_progress.snapshot_at, EXCLUDED.snapshot_at);

        IF taken >= mrec.target_value AND NOT COALESCE(v_was, false) THEN
          v_newly := v_newly + 1;
          v_xp := v_xp + public.award_non_practice_xp(p_user_id, 25);
        END IF;
      END LOOP;
    ELSE
      ids := ARRAY[]::uuid[];
      targets := ARRAY[]::integer[];
      deadlines := ARRAY[]::timestamptz[];
      createds := ARRAY[]::timestamptz[];
      policies := ARRAY[]::text[];
      lives := ARRAY[]::integer[];
      dues := ARRAY[]::integer[];
      finishes := ARRAY[]::timestamptz[];
      locked := ARRAY[]::boolean[];

      FOR mrec IN
        SELECT m.*
        FROM public.team_missions m
        WHERE m.team_id = v_team_id
          AND m.target_event_id IS NOT DISTINCT FROM bucket.event_id
          AND m.goal_type = bucket.goal_type
          AND (
            CASE
              WHEN COALESCE(m.kind, 'casual') = 'timed' OR m.title ILIKE 'Test%' THEN 'timed'
              ELSE 'casual'
            END
          ) = 'timed'
        ORDER BY m.deadline, m.created_at, m.id
      LOOP
        ids := array_append(ids, mrec.id);
        targets := array_append(targets, mrec.target_value);
        deadlines := array_append(deadlines, mrec.deadline);
        createds := array_append(createds, mrec.created_at);
        policies := array_append(policies, COALESCE(mrec.deadline_policy, 'late'));
        lives := array_append(lives, 0);
        dues := array_append(dues, 0);
        finishes := array_append(finishes, NULL::timestamptz);
        locked := array_append(locked, false);
      END LOOP;

      mission_count := COALESCE(array_length(ids, 1), 0);

      FOR session IN
        SELECT
          min(psa.created_at) AS started,
          count(*) FILTER (
            WHERE psa.skipped = false
              AND psa.invalidated = false
              AND (bucket.goal_type <> 'correct' OR psa.is_correct = true)
          )::integer AS cnt
        FROM public.practice_session_answers psa
        WHERE psa.user_id = p_user_id
          AND psa.mode = 'timed'
          AND (bucket.event_id IS NULL OR psa.event_id = bucket.event_id)
        GROUP BY psa.session_token
        ORDER BY min(psa.created_at)
      LOOP
        applied := false;
        FOR i IN 1..mission_count LOOP
          IF locked[i] THEN
            CONTINUE;
          END IF;
          IF session.started < createds[i] THEN
            CONTINUE;
          END IF;
          IF policies[i] = 'close' AND session.started > deadlines[i] THEN
            CONTINUE;
          END IF;
          IF session.cnt > lives[i] THEN
            lives[i] := session.cnt;
          END IF;
          IF session.started <= deadlines[i] AND session.cnt > dues[i] THEN
            dues[i] := session.cnt;
          END IF;
          IF lives[i] >= targets[i] THEN
            locked[i] := true;
            finishes[i] := session.started;
          END IF;
          applied := true;
          EXIT;
        END LOOP;
        IF NOT applied THEN
          NULL;
        END IF;
      END LOOP;

      FOR i IN 1..mission_count LOOP
        v_synced := v_synced + 1;
        SELECT ump.completed, ump.completed_at, ump.snapshot_at, ump.snapshot_value
        INTO v_was, v_old_finished, v_snap_at, v_snap_val
        FROM public.user_mission_progress ump
        WHERE ump.user_id = p_user_id AND ump.mission_id = ids[i];

        IF NOT FOUND THEN
          v_was := false;
          v_old_finished := NULL;
          v_snap_at := NULL;
          v_snap_val := NULL;
        END IF;

        IF v_snap_at IS NULL AND now() > deadlines[i] THEN
          v_snap_val := dues[i];
          v_snap_at := now();
        END IF;

        IF lives[i] >= targets[i] THEN
          v_finished := COALESCE(v_old_finished, finishes[i], now());
        ELSE
          v_finished := NULL;
        END IF;

        INSERT INTO public.user_mission_progress (
          user_id, mission_id, current_value, completed, completed_at, snapshot_value, snapshot_at
        ) VALUES (
          p_user_id, ids[i], lives[i], lives[i] >= targets[i], v_finished, v_snap_val, v_snap_at
        )
        ON CONFLICT (user_id, mission_id) DO UPDATE SET
          current_value = EXCLUDED.current_value,
          completed = EXCLUDED.completed,
          completed_at = EXCLUDED.completed_at,
          snapshot_value = COALESCE(public.user_mission_progress.snapshot_value, EXCLUDED.snapshot_value),
          snapshot_at = COALESCE(public.user_mission_progress.snapshot_at, EXCLUDED.snapshot_at);

        IF lives[i] >= targets[i] AND NOT COALESCE(v_was, false) THEN
          v_newly := v_newly + 1;
          v_xp := v_xp + public.award_non_practice_xp(p_user_id, 25);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'synced', v_synced,
    'newly_completed', v_newly,
    'xp_awarded', v_xp,
    'newly_unlocked', '[]'::jsonb
  );
END;
$$;

ALTER FUNCTION public.sync_my_mission_progress_for_user(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.refresh_team_mission_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  member record;
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

  FOR member IN
    SELECT user_id FROM public.team_roster WHERE team_id = tid
  LOOP
    PERFORM public.sync_my_mission_progress_for_user(member.user_id);
  END LOOP;
END;
$$;

ALTER FUNCTION public.refresh_team_mission_progress() OWNER TO postgres;
GRANT ALL ON FUNCTION public.refresh_team_mission_progress() TO authenticated;
