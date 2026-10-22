SELECT jsonb_build_object(
  'packs', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'scope_type', scope_type,
      'scope_id', scope_id,
      'name', name,
      'body', length(btrim(system_body)),
      'binder', length(btrim(binder_criteria)),
      'shots', jsonb_array_length(few_shots),
      'active', active,
      'version', version,
      'updated_at', updated_at
    ) ORDER BY scope_type, name), '[]'::jsonb)
    FROM public.prompt_packs
  ),
  'concepts', (SELECT count(*)::int FROM public.taxonomy_concepts),
  'topics', (SELECT count(*)::int FROM public.taxonomy_topics)
) AS snapshot;
