UPDATE public.generation_jobs
SET
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{provider}',
        '"deepseek_flash"'::jsonb
      ),
      '{concurrency}',
      '64'::jsonb
    ),
    '{window}',
    '{"enabled":true,"mode":"deepseek_offpeak","allowPeak":false,"tz":"UTC","start":"00:00","end":"23:59"}'::jsonb
  ),
  updated_at = now()
WHERE id = (
  SELECT id
  FROM public.generation_jobs
  WHERE coalesce(config->>'provider', 'nim') = 'nim'
    AND items_failed > 0
    AND questions_written = 0
  ORDER BY created_at DESC
  LIMIT 1
)
RETURNING id, status, items_failed, config->>'provider' AS provider, (config->>'concurrency') AS concurrency;
