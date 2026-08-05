-- ============================================================================
-- scioly.app — Plan 20 badges lite
-- PASTE-CHECK: SCIOLY-0804-BADGES
-- Prerequisites: 20260803 + addons (history, clinic_do_awards, timed_session_commits,
--   mission_complete_awards when present)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS badges_own_select ON public.user_badges;
CREATE POLICY badges_own_select ON public.user_badges
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles them ON them.id = user_badges.user_id
      WHERE me.id = auth.uid()
        AND me.team_id IS NOT NULL
        AND them.team_id = me.team_id
    )
  );

-- Inserts only via SECURITY DEFINER sync
GRANT SELECT ON public.user_badges TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_my_badges()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  prof public.profiles%ROWTYPE;
  correct_n INT := 0;
  event_max INT := 0;
  clinic_n INT := 0;
  timed_n INT := 0;
  mission_n INT := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid;
  IF prof.id IS NULL THEN
    RAISE EXCEPTION 'Profile missing';
  END IF;

  SELECT count(*)::int INTO correct_n
  FROM public.user_history
  WHERE user_id = uid AND is_correct = true;

  SELECT COALESCE(max(c), 0)::int INTO event_max
  FROM (
    SELECT count(*)::int AS c
    FROM public.user_history h
    JOIN public.questions q ON q.id = h.question_id
    WHERE h.user_id = uid AND h.is_correct = true
    GROUP BY q.event_id
  ) s;

  IF to_regclass('public.clinic_do_awards') IS NOT NULL THEN
    SELECT count(*)::int INTO clinic_n
    FROM public.clinic_do_awards WHERE user_id = uid;
  END IF;

  IF to_regclass('public.timed_session_commits') IS NOT NULL THEN
    SELECT count(*)::int INTO timed_n
    FROM public.timed_session_commits WHERE user_id = uid;
  END IF;

  IF to_regclass('public.mission_complete_awards') IS NOT NULL THEN
    SELECT count(*)::int INTO mission_n
    FROM public.mission_complete_awards WHERE user_id = uid;
  END IF;

  IF correct_n >= 1 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'first_blood') ON CONFLICT DO NOTHING;
  END IF;

  IF COALESCE(prof.current_streak, 0) >= 7 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'week_streak') ON CONFLICT DO NOTHING;
  END IF;

  IF event_max >= 50 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'event_specialist') ON CONFLICT DO NOTHING;
  END IF;

  IF clinic_n >= 5 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'clinic_graduate') ON CONFLICT DO NOTHING;
  END IF;

  IF timed_n >= 1 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'timed_survivor') ON CONFLICT DO NOTHING;
  END IF;

  IF mission_n >= 3 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'mission_runner') ON CONFLICT DO NOTHING;
  END IF;

  IF prof.team_id IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'team_anchor') ON CONFLICT DO NOTHING;
  END IF;

  IF correct_n >= 100 THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (uid, 'centurion') ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'correct', correct_n,
    'event_max_correct', event_max,
    'clinic', clinic_n,
    'timed', timed_n,
    'missions', mission_n,
    'badges', (
      SELECT COALESCE(jsonb_agg(badge_id ORDER BY badge_id), '[]'::jsonb)
      FROM public.user_badges WHERE user_id = uid
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_my_badges() TO authenticated;
