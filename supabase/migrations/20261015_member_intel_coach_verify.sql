-- Plan 05: team_member_intel + light coach verification.

-- ---------------------------------------------------------------------------
-- teams.verified (set on approve when applicant coaches that team)
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teams.verified IS
  'True after platform admin approves a coach verification for this team.';

-- ---------------------------------------------------------------------------
-- coach_verifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  school_name text NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_verifications_status
  ON public.coach_verifications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_verifications_user
  ON public.coach_verifications (user_id, created_at DESC);

ALTER TABLE public.coach_verifications OWNER TO postgres;
ALTER TABLE public.coach_verifications ENABLE ROW LEVEL SECURITY;

-- Applicants read own rows; platform admins read all via RPC.
DROP POLICY IF EXISTS coach_verifications_select_own ON public.coach_verifications;
CREATE POLICY coach_verifications_select_own
  ON public.coach_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

GRANT SELECT ON TABLE public.coach_verifications TO authenticated;

-- ---------------------------------------------------------------------------
-- team_member_intel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_member_intel(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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

  IF NOT EXISTS (
    SELECT 1 FROM public.team_roster
    WHERE team_id = tid AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  SELECT jsonb_build_object(
    'user_id', p.id,
    'handle', p.handle,
    'display_name', p.display_name,
    'school_name', p.school_name,
    'division', p.division,
    'xp', p.xp,
    'current_streak', p.current_streak,
    'questions_answered', p.questions_answered,
    'last_activity_on', p.last_activity_on,
    'role', r.role,
    'coverage', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_id', c.event_id,
          'event_name', e.name,
          'status', c.status
        )
        ORDER BY e.name
      )
      FROM public.team_event_coverage c
      LEFT JOIN public.taxonomy_events e ON e.id = c.event_id
      WHERE c.team_id = tid AND c.user_id = p.id
    ), '[]'::jsonb),
    'missions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'title', m.title,
          'goal_type', m.goal_type,
          'target_value', m.target_value,
          'current_value', COALESCE(ump.current_value, 0),
          'completed', COALESCE(ump.completed, false),
          'deadline', m.deadline
        )
        ORDER BY m.deadline
      )
      FROM public.team_missions m
      LEFT JOIN public.user_mission_progress ump
        ON ump.mission_id = m.id AND ump.user_id = p.id
      WHERE m.team_id = tid
        AND m.deadline > now()
    ), '[]'::jsonb),
    'badge_count', (
      SELECT count(*)::integer FROM public.user_badges ub WHERE ub.user_id = p.id
    )
  )
  INTO result
  FROM public.profiles p
  JOIN public.team_roster r ON r.team_id = tid AND r.user_id = p.id
  WHERE p.id = p_user_id;

  RETURN result;
END;
$$;

ALTER FUNCTION public.team_member_intel(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.team_member_intel(uuid) TO authenticated;

COMMENT ON FUNCTION public.team_member_intel(uuid) IS
  'Captain+ intel bundle for a teammate: profile, coverage, active missions, badges.';

-- ---------------------------------------------------------------------------
-- request_coach_verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_coach_verification(
  p_school_name text,
  p_note text DEFAULT ''
)
RETURNS public.coach_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  school_clean text;
  note_clean text;
  row public.coach_verifications;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;

  IF tid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.team_roster
    WHERE team_id = tid AND user_id = uid AND role = 'coach'
  ) THEN
    RAISE EXCEPTION 'Only coaches on a team can request verification';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coach_verifications
    WHERE user_id = uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending verification request';
  END IF;

  school_clean := trim(COALESCE(p_school_name, ''));
  IF length(school_clean) < 1 OR length(school_clean) > 80 THEN
    RAISE EXCEPTION 'School name must be 1–80 characters';
  END IF;

  note_clean := trim(COALESCE(p_note, ''));
  IF length(note_clean) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or fewer';
  END IF;

  INSERT INTO public.coach_verifications (
    user_id, team_id, school_name, note, status
  ) VALUES (
    uid, tid, school_clean, note_clean, 'pending'
  )
  RETURNING * INTO row;

  RETURN row;
END;
$$;

ALTER FUNCTION public.request_coach_verification(text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.request_coach_verification(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_list_coach_verifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_coach_verifications(
  p_status text DEFAULT 'pending'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  handle text,
  display_name text,
  team_id uuid,
  team_name text,
  school_name text,
  note text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  status_filter text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  status_filter := lower(trim(COALESCE(p_status, 'pending')));
  IF status_filter = '' OR status_filter = 'all' THEN
    status_filter := NULL;
  ELSIF status_filter NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'status must be pending, approved, rejected, or all';
  END IF;

  RETURN QUERY
  SELECT
    cv.id,
    cv.user_id,
    p.handle,
    p.display_name,
    cv.team_id,
    t.name AS team_name,
    cv.school_name,
    cv.note,
    cv.status,
    cv.created_at,
    cv.reviewed_at
  FROM public.coach_verifications cv
  JOIN public.profiles p ON p.id = cv.user_id
  LEFT JOIN public.teams t ON t.id = cv.team_id
  WHERE status_filter IS NULL OR cv.status = status_filter
  ORDER BY cv.created_at DESC;
END;
$$;

ALTER FUNCTION public.admin_list_coach_verifications(text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.admin_list_coach_verifications(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- admin_review_coach_verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_coach_verification(
  p_id uuid,
  p_status text
)
RETURNS public.coach_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  status_norm text;
  row public.coach_verifications;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  status_norm := lower(trim(COALESCE(p_status, '')));
  IF status_norm NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'status must be approved or rejected';
  END IF;

  SELECT * INTO row FROM public.coach_verifications WHERE id = p_id FOR UPDATE;
  IF row.id IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  IF row.status <> 'pending' THEN
    RAISE EXCEPTION 'Verification already reviewed';
  END IF;

  UPDATE public.coach_verifications
  SET
    status = status_norm,
    reviewed_by = uid,
    reviewed_at = now()
  WHERE id = p_id
  RETURNING * INTO row;

  IF status_norm = 'approved' AND row.team_id IS NOT NULL THEN
    UPDATE public.teams SET verified = true WHERE id = row.team_id;
  END IF;

  RETURN row;
END;
$$;

ALTER FUNCTION public.admin_review_coach_verification(uuid, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.admin_review_coach_verification(uuid, text) TO authenticated;
