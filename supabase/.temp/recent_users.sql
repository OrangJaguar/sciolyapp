SELECT coalesce(jsonb_agg(jsonb_build_object(
  'handle', p.handle,
  'onboarded', p.onboarding_complete,
  'team', p.team_id IS NOT NULL,
  'created', u.created_at
) ORDER BY u.created_at DESC), '[]'::jsonb) AS users
FROM (
  SELECT id, created_at FROM auth.users ORDER BY created_at DESC LIMIT 12
) u
LEFT JOIN public.profiles p ON p.id = u.id;
