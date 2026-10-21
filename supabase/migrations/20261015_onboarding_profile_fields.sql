-- Plan 02: onboarding profile fields + safer complete_onboarding.
-- Run in Supabase SQL editor if CLI migrate is not used.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_name text;

COMMENT ON COLUMN public.profiles.display_name IS 'Preferred display name (roster / HUD), set at onboarding';
COMMENT ON COLUMN public.profiles.school_name IS 'School name from onboarding; defaults team create school';

-- Drop old 3-arg signature so PostgREST picks up the new one cleanly.
DROP FUNCTION IF EXISTS public.complete_onboarding(text, public.division_type, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_handle text,
  p_division public.division_type,
  p_join_code text DEFAULT NULL,
  p_display_name text DEFAULT NULL,
  p_school_name text DEFAULT NULL,
  p_timezone text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  cleaned text;
  display_clean text;
  school_clean text;
  code_clean text;
  tz_clean text;
  prof public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  cleaned := lower(regexp_replace(trim(p_handle), '^@', ''));
  IF cleaned !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Handle must be 3-24 chars: a-z, 0-9, underscore';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(handle) = cleaned AND id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Handle already taken';
  END IF;

  display_clean := trim(COALESCE(p_display_name, ''));
  IF length(display_clean) < 1 OR length(display_clean) > 48 THEN
    RAISE EXCEPTION 'Preferred name must be 1–48 characters';
  END IF;

  school_clean := trim(COALESCE(p_school_name, ''));
  IF length(school_clean) < 1 OR length(school_clean) > 80 THEN
    RAISE EXCEPTION 'School name must be 1–80 characters';
  END IF;

  tz_clean := nullif(trim(COALESCE(p_timezone, '')), '');

  -- Join first so a bad code aborts the whole transaction (no “complete but teamless”).
  code_clean := nullif(upper(trim(COALESCE(p_join_code, ''))), '');
  IF code_clean IS NOT NULL THEN
    PERFORM public.join_team_by_code(code_clean);
  END IF;

  UPDATE public.profiles
  SET
    handle = cleaned,
    division = p_division,
    display_name = display_clean,
    school_name = school_clean,
    timezone = COALESCE(tz_clean, timezone),
    onboarding_complete = TRUE
  WHERE id = auth.uid();

  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  RETURN prof;
END;
$$;

ALTER FUNCTION public.complete_onboarding(
  text, public.division_type, text, text, text, text
) OWNER TO postgres;

GRANT ALL ON FUNCTION public.complete_onboarding(
  text, public.division_type, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.complete_onboarding(
  text, public.division_type, text, text, text, text
) IS 'Finish onboarding; optional join code runs before onboarding_complete is set.';
