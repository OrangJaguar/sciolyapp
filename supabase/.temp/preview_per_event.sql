WITH cfg AS (
  SELECT
    set_config(
      'request.jwt.claims',
      '{"sub":"c0e7b355-cb77-4336-a269-b95cc7da3c4e","role":"authenticated"}',
      true
    ) AS claims,
    set_config('request.jwt.claim.sub', 'c0e7b355-cb77-4336-a269-b95cc7da3c4e', true) AS sub,
    set_config('request.jwt.claim.role', 'authenticated', true) AS role
)
SELECT CASE
  WHEN public.is_platform_admin() THEN (
    SELECT jsonb_build_object(
      'uid', auth.uid(),
      'questions', plan->'question_count',
      'requests', plan->'request_count',
      'concepts', plan->'concept_count',
      'blockers', plan->'blockers',
      'by_event', (
        SELECT coalesce(jsonb_object_agg(event_id, n), '{}'::jsonb)
        FROM (
          SELECT item->>'event_id' AS event_id, sum((item->>'n_requested')::int) AS n
          FROM jsonb_array_elements(plan->'items') AS item
          GROUP BY 1
        ) g
      )
    )
    FROM (
      SELECT public.admin_preview_generation(
        '{"mode":"fill_event","eventIds":["anatomy","chem_lab","botany"],"questionsPerEvent":50,"questionsPerCall":8,"targetPerConcept":50,"passMode":"A_then_B"}'::jsonb
      ) AS plan
    ) s
  )
  ELSE jsonb_build_object('admin', false, 'uid', auth.uid(), 'sub', cfg.sub)
END AS preview
FROM cfg;
