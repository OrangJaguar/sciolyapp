SELECT jsonb_build_object(
  'anatomy_sample', (
    SELECT coalesce(jsonb_agg(name ORDER BY name), '[]'::jsonb)
    FROM (
      SELECT name FROM public.taxonomy_concepts
      WHERE event_id = 'anatomy'
      ORDER BY name
      LIMIT 6
    ) s
  ),
  'counts', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('event_id', event_id, 'concepts', n) ORDER BY event_id), '[]'::jsonb)
    FROM (
      SELECT event_id, count(*)::int AS n
      FROM public.taxonomy_concepts
      GROUP BY event_id
    ) c
  )
) AS snapshot;
