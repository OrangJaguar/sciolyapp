-- Plan 03: harden create_team + join_team_by_code (no silent team switches).

CREATE OR REPLACE FUNCTION public.create_team(
  p_name text,
  p_school_name text,
  p_division public.division_type DEFAULT 'C'::public.division_type
)
RETURNS public.teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  new_team public.teams;
  code_s text;
  code_a text;
  name_clean text;
  school_clean text;
  current_team uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT team_id INTO current_team FROM public.profiles WHERE id = auth.uid();
  IF current_team IS NOT NULL THEN
    RAISE EXCEPTION 'Already on a team. Leave your current team before creating a new one.';
  END IF;

  name_clean := trim(COALESCE(p_name, ''));
  IF length(name_clean) < 2 OR length(name_clean) > 60 THEN
    RAISE EXCEPTION 'Team name must be 2–60 characters';
  END IF;

  school_clean := trim(COALESCE(p_school_name, ''));
  IF length(school_clean) < 1 OR length(school_clean) > 80 THEN
    RAISE EXCEPTION 'School name must be 1–80 characters';
  END IF;

  LOOP
    code_s := public.generate_join_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teams
      WHERE join_code_student = code_s OR join_code_admin = code_s
    );
  END LOOP;

  LOOP
    code_a := public.generate_join_code();
    EXIT WHEN code_a <> code_s
      AND NOT EXISTS (
        SELECT 1 FROM public.teams
        WHERE join_code_student = code_a OR join_code_admin = code_a
      );
  END LOOP;

  INSERT INTO public.teams (name, school_name, division, join_code_student, join_code_admin)
  VALUES (name_clean, school_clean, p_division, code_s, code_a)
  RETURNING * INTO new_team;

  INSERT INTO public.team_roster (team_id, user_id, role)
  VALUES (new_team.id, auth.uid(), 'coach');

  UPDATE public.profiles
  SET team_id = new_team.id, division = p_division
  WHERE id = auth.uid();

  RETURN new_team;
END;
$$;

ALTER FUNCTION public.create_team(
  text, text, public.division_type
) OWNER TO postgres;

GRANT ALL ON FUNCTION public.create_team(
  text, text, public.division_type
) TO authenticated;

COMMENT ON FUNCTION public.create_team(
  text, text, public.division_type
) IS 'Create a team; caller becomes coach. Fails if already on a team.';

CREATE OR REPLACE FUNCTION public.join_team_by_code(p_code text)
RETURNS public.teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  t public.teams;
  assigned_role public.team_role;
  normalized text;
  current_team uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  normalized := upper(trim(COALESCE(p_code, '')));
  IF length(normalized) <> 6 THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  SELECT * INTO t FROM public.teams
  WHERE join_code_student = normalized OR join_code_admin = normalized;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Join code not found';
  END IF;

  SELECT team_id INTO current_team FROM public.profiles WHERE id = auth.uid();
  IF current_team IS NOT NULL AND current_team <> t.id THEN
    RAISE EXCEPTION 'Leave your current team before joining another';
  END IF;

  IF normalized = t.join_code_admin THEN
    assigned_role := 'coach';
  ELSE
    assigned_role := 'member';
  END IF;

  INSERT INTO public.team_roster (team_id, user_id, role)
  VALUES (t.id, auth.uid(), assigned_role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.profiles
  SET team_id = t.id, division = t.division
  WHERE id = auth.uid();

  RETURN t;
END;
$$;

ALTER FUNCTION public.join_team_by_code(text) OWNER TO postgres;

GRANT ALL ON FUNCTION public.join_team_by_code(text) TO authenticated;

COMMENT ON FUNCTION public.join_team_by_code(text) IS
  'Join by student (member) or coach invite code. Same team is idempotent; other team is blocked.';
