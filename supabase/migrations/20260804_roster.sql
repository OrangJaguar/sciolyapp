-- ============================================================================
-- scioly.app — Plan 19 pivot: Comms roster admin + simple event assigns
-- PASTE-CHECK: SCIOLY-0804-ROSTER
-- Replaces War Room status matrix. Safe to re-run (postgres).
-- Max 2 assignees per event per team. Captain/coach manage roster.
-- ============================================================================

DROP FUNCTION IF EXISTS public.set_event_coverage(UUID, TEXT, TEXT);

CREATE TABLE IF NOT EXISTS public.team_event_coverage (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES public.taxonomy_events(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (team_id, user_id, event_id)
);

ALTER TABLE public.team_event_coverage
  DROP CONSTRAINT IF EXISTS team_event_coverage_status_check;
ALTER TABLE public.team_event_coverage
  DROP COLUMN IF EXISTS status;

CREATE INDEX IF NOT EXISTS idx_coverage_team_event
  ON public.team_event_coverage(team_id, event_id);

ALTER TABLE public.team_event_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coverage_team_read ON public.team_event_coverage;
CREATE POLICY coverage_team_read ON public.team_event_coverage
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS coverage_team_write ON public.team_event_coverage;
CREATE POLICY coverage_team_write ON public.team_event_coverage
  FOR ALL TO authenticated
  USING (public.team_role_at_least(team_id, 'captain'))
  WITH CHECK (public.team_role_at_least(team_id, 'captain'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_event_coverage TO authenticated;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_team_event(
  p_user_id UUID,
  p_event_id TEXT
)
RETURNS public.team_event_coverage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  n INT;
  row public.team_event_coverage;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Not on a team'; END IF;
  IF NOT public.team_role_at_least(tid, 'captain') THEN
    RAISE EXCEPTION 'Captain or coach required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_roster WHERE team_id = tid AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.taxonomy_events WHERE id = p_event_id AND active
  ) THEN
    RAISE EXCEPTION 'Unknown event';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_event_coverage
    WHERE team_id = tid AND user_id = p_user_id AND event_id = p_event_id
  ) THEN
    SELECT * INTO row FROM public.team_event_coverage
    WHERE team_id = tid AND user_id = p_user_id AND event_id = p_event_id;
    RETURN row;
  END IF;

  SELECT count(*)::int INTO n
  FROM public.team_event_coverage
  WHERE team_id = tid AND event_id = p_event_id;
  IF n >= 2 THEN
    RAISE EXCEPTION 'Event already has 2 partners (max 2 per team)';
  END IF;

  INSERT INTO public.team_event_coverage (team_id, user_id, event_id, updated_by)
  VALUES (tid, p_user_id, p_event_id, uid)
  RETURNING * INTO row;
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unassign_team_event(
  p_user_id UUID,
  p_event_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Not on a team'; END IF;
  IF NOT public.team_role_at_least(tid, 'captain') THEN
    RAISE EXCEPTION 'Captain or coach required';
  END IF;

  DELETE FROM public.team_event_coverage
  WHERE team_id = tid AND user_id = p_user_id AND event_id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_team_member_role(
  p_user_id UUID,
  p_role public.team_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  my_role public.team_role;
  target_role public.team_role;
  coach_count INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Not on a team'; END IF;
  IF NOT public.team_role_at_least(tid, 'captain') THEN
    RAISE EXCEPTION 'Captain or coach required';
  END IF;
  IF p_user_id = uid THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  SELECT role INTO my_role FROM public.team_roster
  WHERE team_id = tid AND user_id = uid;
  SELECT role INTO target_role FROM public.team_roster
  WHERE team_id = tid AND user_id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  -- Only coaches may grant/revoke coach
  IF (p_role = 'coach' OR target_role = 'coach') AND my_role <> 'coach' THEN
    RAISE EXCEPTION 'Only a coach can change coach roles';
  END IF;

  IF target_role = 'coach' AND p_role <> 'coach' THEN
    SELECT count(*)::int INTO coach_count
    FROM public.team_roster WHERE team_id = tid AND role = 'coach';
    IF coach_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last coach';
    END IF;
  END IF;

  UPDATE public.team_roster
  SET role = p_role
  WHERE team_id = tid AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tid UUID;
  target_role public.team_role;
  coach_count INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT team_id INTO tid FROM public.profiles WHERE id = uid;
  IF tid IS NULL THEN RAISE EXCEPTION 'Not on a team'; END IF;
  IF NOT public.team_role_at_least(tid, 'captain') THEN
    RAISE EXCEPTION 'Captain or coach required';
  END IF;
  IF p_user_id = uid THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  SELECT role INTO target_role FROM public.team_roster
  WHERE team_id = tid AND user_id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  IF target_role = 'coach' THEN
    SELECT count(*)::int INTO coach_count
    FROM public.team_roster WHERE team_id = tid AND role = 'coach';
    IF coach_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last coach';
    END IF;
  END IF;

  DELETE FROM public.team_event_coverage
  WHERE team_id = tid AND user_id = p_user_id;
  DELETE FROM public.team_roster
  WHERE team_id = tid AND user_id = p_user_id;
  UPDATE public.profiles SET team_id = NULL WHERE id = p_user_id AND team_id = tid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_team_event(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_team_event(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_team_member_role(UUID, public.team_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID) TO authenticated;
