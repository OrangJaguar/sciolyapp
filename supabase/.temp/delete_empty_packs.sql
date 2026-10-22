DELETE FROM public.prompt_packs
WHERE scope_type = 'event'
  AND length(btrim(system_body)) = 0
  AND length(btrim(coalesce(binder_criteria, ''))) = 0
  AND jsonb_array_length(few_shots) = 0;

SELECT scope_id, name,
  length(btrim(system_body)) AS body,
  length(btrim(binder_criteria)) AS binder,
  jsonb_array_length(few_shots) AS shots
FROM public.prompt_packs
WHERE scope_type = 'event'
ORDER BY name;
