SELECT jsonb_build_object(
  'admin', public.is_platform_admin(),
  'roster', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'handle', p.handle,
      'role', r.role
    ) ORDER BY p.handle), '[]'::jsonb)
    FROM public.team_roster r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.team_id = 'c7d91285-793c-4295-a2c1-84ad44fd83dc'
  )
) AS snapshot;
