SELECT jsonb_build_object(
  'functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid)
    )), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('complete_onboarding', 'join_team_by_code')
  ),
  'recent_users', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'email', u.email,
      'created', u.created_at,
      'handle', pr.handle,
      'onboarded', pr.onboarding_complete,
      'team_id', pr.team_id,
      'division', pr.division
    ) ORDER BY u.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 8
    ) u
    LEFT JOIN public.profiles pr ON pr.id = u.id
  ),
  'roster', (
    SELECT count(*)::int FROM public.team_roster
    WHERE team_id = 'c7d91285-793c-4295-a2c1-84ad44fd83dc'
  ),
  'codes', (
    SELECT jsonb_build_object(
      'student', join_code_student,
      'coach', join_code_admin
    )
    FROM public.teams
    WHERE id = 'c7d91285-793c-4295-a2c1-84ad44fd83dc'
  )
) AS snapshot;
