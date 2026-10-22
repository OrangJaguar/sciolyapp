SELECT jsonb_build_object(
  'topics', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'event_id', event_id,
      'n', n
    ) ORDER BY event_id), '[]'::jsonb)
    FROM (
      SELECT event_id, count(*)::int AS n
      FROM public.taxonomy_topics
      GROUP BY event_id
    ) t
  ),
  'events', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'studyable', studyable,
      'test_component', test_component
    ) ORDER BY name), '[]'::jsonb)
    FROM public.taxonomy_events
    WHERE season = 2027 AND division = 'C' AND active
  )
) AS snapshot;
