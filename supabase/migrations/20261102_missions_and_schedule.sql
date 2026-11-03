-- Per-event missions (casual + timed) and officer-editable meeting / comp cards.

ALTER TABLE public.team_missions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS timed_seconds integer;

ALTER TABLE public.team_missions
  DROP CONSTRAINT IF EXISTS team_missions_kind_check;

ALTER TABLE public.team_missions
  ADD CONSTRAINT team_missions_kind_check
  CHECK (kind = ANY (ARRAY['casual'::text, 'timed'::text]));

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS next_meeting_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_meeting_place text,
  ADD COLUMN IF NOT EXISTS next_comp_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_comp_place text;

CREATE OR REPLACE FUNCTION public.create_event_missions(
  p_kind text,
  p_goal_type text,
  p_target_value integer,
  p_deadline timestamptz,
  p_event_ids text[],
  p_timed_seconds integer
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
      team_id, created_by, title, target_event_id, goal_type, target_value, deadline, kind, timed_seconds
    ) VALUES (
      tid,
      uid,
      title_text,
      event_id,
      goal_norm,
      p_target_value,
      p_deadline,
      kind_norm,
      CASE WHEN kind_norm = 'timed' THEN p_timed_seconds ELSE NULL END
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

ALTER FUNCTION public.create_event_missions(text, text, integer, timestamptz, text[], integer) OWNER TO postgres;
GRANT ALL ON FUNCTION public.create_event_missions(text, text, integer, timestamptz, text[], integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_team_schedule(
  p_which text,
  p_at timestamptz,
  p_place text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  which_norm text;
  place_norm text;
  row public.teams;
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

  which_norm := lower(trim(COALESCE(p_which, '')));
  place_norm := NULLIF(trim(COALESCE(p_place, '')), '');

  IF which_norm = 'meeting' THEN
    UPDATE public.teams
    SET next_meeting_at = p_at, next_meeting_place = place_norm
    WHERE id = tid
    RETURNING * INTO row;
  ELSIF which_norm = 'comp' THEN
    UPDATE public.teams
    SET next_comp_at = p_at, next_comp_place = place_norm
    WHERE id = tid
    RETURNING * INTO row;
  ELSE
    RAISE EXCEPTION 'which must be meeting or comp';
  END IF;

  RETURN jsonb_build_object(
    'next_meeting_at', row.next_meeting_at,
    'next_meeting_place', row.next_meeting_place,
    'next_comp_at', row.next_comp_at,
    'next_comp_place', row.next_comp_place
  );
END;
$$;

ALTER FUNCTION public.set_team_schedule(text, timestamptz, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.set_team_schedule(text, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_my_mission_progress_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
    IF v_mission.target_event_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM team_event_coverage c
      WHERE c.team_id = v_team_id
        AND c.user_id = p_user_id
        AND c.event_id = v_mission.target_event_id
    ) THEN
      CONTINUE;
    END IF;

    v_synced := v_synced + 1;

    SELECT completed INTO v_was_completed
    FROM user_mission_progress
    WHERE user_id = p_user_id AND mission_id = v_mission.id;

    IF v_mission.kind = 'timed' THEN
      SELECT COALESCE(MAX(cnt), 0)::integer INTO v_current
      FROM (
        SELECT COUNT(*)::integer AS cnt
        FROM practice_session_answers psa
        WHERE psa.user_id = p_user_id
          AND psa.mode = 'timed'
          AND psa.skipped = false
          AND psa.invalidated = false
          AND psa.created_at >= v_mission.created_at
          AND (v_mission.target_event_id IS NULL OR psa.event_id = v_mission.target_event_id)
        GROUP BY psa.session_token
      ) sessions;
    ELSIF v_mission.goal_type = 'correct' THEN
      SELECT COUNT(*)::integer INTO v_current
      FROM practice_session_answers psa
      WHERE psa.user_id = p_user_id
        AND psa.mode = 'casual'
        AND psa.skipped = false
        AND psa.invalidated = false
        AND psa.is_correct = true
        AND psa.created_at >= v_mission.created_at
        AND (v_mission.target_event_id IS NULL OR psa.event_id = v_mission.target_event_id);
    ELSE
      SELECT COUNT(*)::integer INTO v_current
      FROM practice_session_answers psa
      WHERE psa.user_id = p_user_id
        AND psa.mode = 'casual'
        AND psa.skipped = false
        AND psa.invalidated = false
        AND psa.created_at >= v_mission.created_at
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

  RETURN jsonb_build_object(
    'synced', v_synced,
    'newly_completed', v_newly,
    'xp_awarded', v_xp,
    'newly_unlocked', '[]'::jsonb
  );
END;
$$;

ALTER FUNCTION public.sync_my_mission_progress_for_user(uuid) OWNER TO postgres;
