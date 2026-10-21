-- Plan 04: roster admin RPCs + harden set_event_coverage (max 2 per event).

-- ---------------------------------------------------------------------------
-- set_event_coverage: keep signatures; add partner cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_event_coverage(
  p_user_id uuid,
  p_event_id text,
  p_status text
)
RETURNS public.team_event_coverage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  row public.team_event_coverage;
  status_norm text;
  partner_count integer;
  already boolean;
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

  status_norm := lower(trim(COALESCE(p_status, '')));
  IF status_norm = '' OR status_norm = 'off' OR status_norm = 'none' THEN
    DELETE FROM public.team_event_coverage
    WHERE team_id = tid AND user_id = p_user_id AND event_id = p_event_id;
    RETURN NULL;
  END IF;

  IF status_norm NOT IN ('assigned', 'training', 'ready') THEN
    RAISE EXCEPTION 'status must be assigned, training, ready, or off';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.team_event_coverage
    WHERE team_id = tid AND user_id = p_user_id AND event_id = p_event_id
  ) INTO already;

  IF NOT already THEN
    SELECT count(*)::integer INTO partner_count
    FROM public.team_event_coverage
    WHERE team_id = tid AND event_id = p_event_id;

    IF partner_count >= 2 THEN
      RAISE EXCEPTION 'Event already has 2 partners';
    END IF;
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

ALTER FUNCTION public.set_event_coverage(uuid, text, text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.set_event_coverage(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.set_event_coverage(uuid, text, text) IS
  'Set coverage status (assigned/training/ready) or off to clear. Max 2 partners per event.';

-- ---------------------------------------------------------------------------
-- set_team_member_role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_team_member_role(
  p_user_id uuid,
  p_role public.team_role
)
RETURNS public.team_roster
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  caller_role public.team_role;
  target_role public.team_role;
  coach_count integer;
  row public.team_roster;
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

  SELECT role INTO caller_role
  FROM public.team_roster
  WHERE team_id = tid AND user_id = uid;

  IF p_user_id = uid THEN
    RAISE EXCEPTION 'Cannot change your own role here';
  END IF;

  SELECT role INTO target_role
  FROM public.team_roster
  WHERE team_id = tid AND user_id = p_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  IF p_role = 'coach' AND caller_role <> 'coach' THEN
    RAISE EXCEPTION 'Only a coach can grant coach';
  END IF;

  IF caller_role = 'captain' AND target_role = 'coach' THEN
    RAISE EXCEPTION 'Captains cannot change a coach''s role';
  END IF;

  IF target_role = 'coach' AND p_role <> 'coach' THEN
    SELECT count(*)::integer INTO coach_count
    FROM public.team_roster
    WHERE team_id = tid AND role = 'coach';
    IF coach_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last coach';
    END IF;
  END IF;

  UPDATE public.team_roster
  SET role = p_role
  WHERE team_id = tid AND user_id = p_user_id
  RETURNING * INTO row;

  RETURN row;
END;
$$;

ALTER FUNCTION public.set_team_member_role(uuid, public.team_role) OWNER TO postgres;
GRANT ALL ON FUNCTION public.set_team_member_role(uuid, public.team_role) TO authenticated;

COMMENT ON FUNCTION public.set_team_member_role(uuid, public.team_role) IS
  'Captain+ sets another member role. Only coaches grant coach; last coach protected.';

-- ---------------------------------------------------------------------------
-- remove_team_member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_team_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  caller_role public.team_role;
  target_role public.team_role;
  coach_count integer;
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

  IF p_user_id = uid THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  SELECT role INTO caller_role
  FROM public.team_roster
  WHERE team_id = tid AND user_id = uid;

  SELECT role INTO target_role
  FROM public.team_roster
  WHERE team_id = tid AND user_id = p_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'User not on this team';
  END IF;

  IF caller_role = 'captain' AND target_role = 'coach' THEN
    RAISE EXCEPTION 'Captains cannot remove a coach';
  END IF;

  IF target_role = 'coach' THEN
    SELECT count(*)::integer INTO coach_count
    FROM public.team_roster
    WHERE team_id = tid AND role = 'coach';
    IF coach_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last coach';
    END IF;
  END IF;

  DELETE FROM public.team_event_coverage
  WHERE team_id = tid AND user_id = p_user_id;

  DELETE FROM public.team_roster
  WHERE team_id = tid AND user_id = p_user_id;

  UPDATE public.profiles
  SET team_id = NULL
  WHERE id = p_user_id AND team_id = tid;
END;
$$;

ALTER FUNCTION public.remove_team_member(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.remove_team_member(uuid) TO authenticated;

COMMENT ON FUNCTION public.remove_team_member(uuid) IS
  'Captain+ removes a member: roster row, coverage, and profiles.team_id.';
