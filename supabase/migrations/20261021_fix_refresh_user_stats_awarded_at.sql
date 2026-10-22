-- Casual/timed commit calls refresh_user_stats, which counted today's clinic
-- clears with clinic_do_awards.awarded_at. That column was never created;
-- the table uses created_at. Postgres 42703 aborted the whole save.
-- Run in the Supabase SQL editor if this migration is not applied remotely.

CREATE OR REPLACE FUNCTION public.refresh_user_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
