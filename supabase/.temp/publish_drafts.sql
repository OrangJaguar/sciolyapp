WITH bad AS (
  SELECT q.id
  FROM public.questions q
  WHERE q.status = 'draft'
    AND q.critic_route IS NULL
    AND (
      (
        substring(q.explanation FROM '(?i)correct answer is ([A-D])') IS NOT NULL
        AND upper(substring(q.explanation FROM '(?i)correct answer is ([A-D])')) <> q.correct_key
      )
      OR q.explanation ~* (
        'option ' || q.correct_key || ' (omits|is incorrect|is wrong|reverses|confuses|forgets)'
      )
    )
)
UPDATE public.questions q
SET
  needs_fix = true,
  critic_route = 'human',
  critic_notes = 'Explanation disagrees with the keyed letter. Left for a person.'
FROM bad
WHERE q.id = bad.id;

UPDATE public.questions
SET status = 'live',
    needs_fix = false
WHERE status = 'draft'
  AND critic_route IS NULL;

SELECT jsonb_build_object(
  'live', (SELECT count(*) FROM public.questions WHERE status = 'live'),
  'still_waiting', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND critic_route IS NULL
  ),
  'needs_you', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND (critic_route = 'human' OR needs_fix)
  ),
  'live_by_event', (
    SELECT coalesce(jsonb_object_agg(event_id, n), '{}'::jsonb)
    FROM (
      SELECT event_id, count(*) AS n
      FROM public.questions
      WHERE status = 'live'
      GROUP BY event_id
    ) s
  )
) AS published;
