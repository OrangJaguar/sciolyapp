SELECT jsonb_build_object(
  'me', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'handle', p.handle,
      'display_name', p.display_name,
      'school_name', p.school_name,
      'platform_role', p.platform_role,
      'team_id', p.team_id,
      'division', p.division,
      'onboarding_complete', p.onboarding_complete
    )), '[]'::jsonb)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.email = 'sansgupta64@gmail.com'
  ),
  'teams', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'school_name', t.school_name,
      'division', t.division,
      'student_code', t.join_code_student,
      'coach_code', t.join_code_admin
    ) ORDER BY t.name), '[]'::jsonb)
    FROM public.teams t
  ),
  'events', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'studyable', e.studyable,
      'active', e.active,
      'concepts', (
        SELECT count(*)::int FROM public.taxonomy_concepts c WHERE c.event_id = e.id
      ),
      'live', (
        SELECT count(*)::int FROM public.questions q
        WHERE q.event_id = e.id AND q.status = 'live'
      )
    ) ORDER BY e.name), '[]'::jsonb)
    FROM public.taxonomy_events e
    WHERE e.division = 'C' AND e.season = 2027
  )
) AS snapshot;
