DO $$
DECLARE
  v_before date;
  v_after date;
BEGIN
  SELECT last_activity_on INTO v_before
  FROM public.profiles
  WHERE id = 'c0e7b355-cb77-4336-a269-b95cc7da3c4e';

  PERFORM public.touch_user_streak(
    'c0e7b355-cb77-4336-a269-b95cc7da3c4e',
    'America/New_York'
  );

  SELECT last_activity_on INTO v_after
  FROM public.profiles
  WHERE id = 'c0e7b355-cb77-4336-a269-b95cc7da3c4e';

  IF v_after IS NULL THEN
    RAISE EXCEPTION 'streak write did not set a date';
  END IF;

  UPDATE public.profiles
  SET last_activity_on = v_before
  WHERE id = 'c0e7b355-cb77-4336-a269-b95cc7da3c4e';
END $$;

SELECT position(
  'v_local::text' in pg_get_functiondef('public.touch_user_streak(uuid, text)'::regprocedure)
) AS still_text_cast,
position(
  'user_history' in pg_get_functiondef(
    'public.process_session_answers(uuid, text, text, text, text, jsonb, text, integer, integer, integer, integer)'::regprocedure
  )
) AS history_pos;
