-- Rank bench below member so it never passes officer checks.
CREATE OR REPLACE FUNCTION public.team_role_at_least(
  p_team_id uuid,
  p_min public.team_role
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  r public.team_role;
  rank_map int;
  need int;
BEGIN
  SELECT role INTO r FROM public.team_roster
  WHERE team_id = p_team_id AND user_id = auth.uid();
  IF r IS NULL THEN RETURN FALSE; END IF;
  rank_map := CASE r
    WHEN 'bench' THEN 0
    WHEN 'member' THEN 1
    WHEN 'officer' THEN 2
    WHEN 'captain' THEN 3
    WHEN 'coach' THEN 4
  END;
  need := CASE p_min
    WHEN 'bench' THEN 0
    WHEN 'member' THEN 1
    WHEN 'officer' THEN 2
    WHEN 'captain' THEN 3
    WHEN 'coach' THEN 4
  END;
  RETURN COALESCE(rank_map, 0) >= COALESCE(need, 99);
END;
$$;

-- Build events are not question banks. A setup script had marked every Div C event studyable.
UPDATE public.taxonomy_events
SET studyable = false
WHERE id IN (
  'boomilever',
  'electric_vehicle',
  'mission_possible',
  'ping_pong_parachute',
  'wright_stuff'
);
