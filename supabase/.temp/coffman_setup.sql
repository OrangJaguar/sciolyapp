DO $$
DECLARE
  code_s text;
  code_a text;
BEGIN
  LOOP
    code_s := public.generate_join_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teams
      WHERE join_code_student = code_s OR join_code_admin = code_s
    );
  END LOOP;
  LOOP
    code_a := public.generate_join_code();
    EXIT WHEN code_a <> code_s AND NOT EXISTS (
      SELECT 1 FROM public.teams
      WHERE join_code_student = code_a OR join_code_admin = code_a
    );
  END LOOP;

  UPDATE public.teams
  SET
    name = 'Dublin Coffman',
    school_name = 'Dublin Coffman High School',
    division = 'C',
    join_code_student = code_s,
    join_code_admin = code_a
  WHERE id = 'c7d91285-793c-4295-a2c1-84ad44fd83dc';

  UPDATE public.profiles
  SET school_name = 'Dublin Coffman High School', division = 'C'
  WHERE id = 'c0e7b355-cb77-4336-a269-b95cc7da3c4e';

  UPDATE public.taxonomy_events
  SET studyable = true
  WHERE division = 'C' AND season = 2027 AND active = true;
END $$;

SELECT jsonb_build_object(
  'team', (
    SELECT jsonb_build_object(
      'name', t.name,
      'school_name', t.school_name,
      'division', t.division,
      'student_code', t.join_code_student,
      'coach_code', t.join_code_admin,
      'my_role', (
        SELECT r.role FROM public.team_roster r
        WHERE r.team_id = t.id AND r.user_id = 'c0e7b355-cb77-4336-a269-b95cc7da3c4e'
      ),
      'members', (
        SELECT count(*)::int FROM public.team_roster r WHERE r.team_id = t.id
      )
    )
    FROM public.teams t
    WHERE t.id = 'c7d91285-793c-4295-a2c1-84ad44fd83dc'
  ),
  'studyable', (
    SELECT count(*)::int FROM public.taxonomy_events
    WHERE division = 'C' AND season = 2027 AND active AND studyable
  ),
  'events_total', (
    SELECT count(*)::int FROM public.taxonomy_events
    WHERE division = 'C' AND season = 2027 AND active
  ),
  'packs', (
    SELECT coalesce(jsonb_agg(p.scope_id ORDER BY p.scope_id), '[]'::jsonb)
    FROM public.prompt_packs p
    WHERE p.scope_type = 'event' AND p.active AND length(trim(p.system_body)) > 0
  ),
  'tokens', (
    SELECT coalesce(jsonb_build_object(
      'jobs', count(*)::int,
      'prompt', coalesce(sum(COALESCE((token_usage->>'prompt_tokens')::bigint, 0)), 0),
      'completion', coalesce(sum(COALESCE((token_usage->>'completion_tokens')::bigint, 0)), 0)
    ), '{}'::jsonb)
    FROM public.generation_jobs
  )
) AS result;
