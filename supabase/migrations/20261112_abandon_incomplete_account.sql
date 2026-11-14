-- Let the signed-in user delete their own account only while setup is unfinished
-- and they are not on a team. Deletes auth.users so the email can sign up again.
-- Finished accounts and team members are refused.

CREATE OR REPLACE FUNCTION public.abandon_incomplete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  finished boolean;
  tid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT p.onboarding_complete, p.team_id
    INTO finished, tid
  FROM public.profiles AS p
  WHERE p.id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an unfinished account can be deleted here';
  END IF;

  IF finished THEN
    RAISE EXCEPTION 'Only an unfinished account can be deleted here';
  END IF;

  IF tid IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.team_roster AS r WHERE r.user_id = uid
  ) THEN
    RAISE EXCEPTION 'This account is already on a team';
  END IF;

  -- These FKs do not cascade, and an unfinished account should not own them.
  UPDATE public.import_batches
     SET created_by = NULL
   WHERE created_by = uid;
  UPDATE public.team_vault_resources
     SET created_by = NULL
   WHERE created_by = uid;

  -- Storage ownership blocks deleting auth.users. A new signup has no files.
  BEGIN
    DELETE FROM storage.objects WHERE owner = uid;
  EXCEPTION
    WHEN undefined_table OR undefined_column OR invalid_schema_name OR insufficient_privilege THEN
      NULL;
  END;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

ALTER FUNCTION public.abandon_incomplete_account() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.abandon_incomplete_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abandon_incomplete_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.abandon_incomplete_account() TO authenticated;
