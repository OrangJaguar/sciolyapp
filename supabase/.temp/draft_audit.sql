SELECT jsonb_build_object(
  'waiting', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND critic_route IS NULL
  ),
  'by_event', (
    SELECT coalesce(jsonb_object_agg(event_id, n), '{}'::jsonb)
    FROM (
      SELECT event_id, count(*) AS n
      FROM public.questions
      WHERE status = 'draft' AND critic_route IS NULL
      GROUP BY event_id
    ) s
  ),
  'short_stem', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND critic_route IS NULL
      AND length(trim(stem)) < 20
  ),
  'short_expl', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND critic_route IS NULL
      AND length(trim(coalesce(explanation, ''))) < 20
  ),
  'bad_key', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND critic_route IS NULL
      AND correct_key NOT IN ('A', 'B', 'C', 'D')
  ),
  'dup_options', (
    SELECT count(*) FROM public.questions q
    WHERE q.status = 'draft' AND q.critic_route IS NULL
      AND (
        lower(trim(q.options->>'A')) = lower(trim(q.options->>'B'))
        OR lower(trim(q.options->>'A')) = lower(trim(q.options->>'C'))
        OR lower(trim(q.options->>'A')) = lower(trim(q.options->>'D'))
        OR lower(trim(q.options->>'B')) = lower(trim(q.options->>'C'))
        OR lower(trim(q.options->>'B')) = lower(trim(q.options->>'D'))
        OR lower(trim(q.options->>'C')) = lower(trim(q.options->>'D'))
        OR length(trim(coalesce(q.options->>'A', ''))) = 0
        OR length(trim(coalesce(q.options->>'B', ''))) = 0
        OR length(trim(coalesce(q.options->>'C', ''))) = 0
        OR length(trim(coalesce(q.options->>'D', ''))) = 0
      )
  ),
  'placeholder', (
    SELECT count(*) FROM public.questions
    WHERE status = 'draft' AND critic_route IS NULL
      AND (
        stem ~* 'lorem|todo|tbd|\[insert\]|as an ai|placeholder|distractor'
        OR explanation ~* 'lorem|todo|tbd|\[insert\]|as an ai|placeholder'
      )
  ),
  'dup_stem_live', (
    SELECT count(*) FROM public.questions d
    WHERE d.status = 'draft' AND d.critic_route IS NULL
      AND EXISTS (
        SELECT 1 FROM public.questions l
        WHERE l.status = 'live'
          AND l.event_id = d.event_id
          AND lower(trim(l.stem)) = lower(trim(d.stem))
      )
  ),
  'dup_stem_draft', (
    SELECT count(*) FROM (
      SELECT lower(trim(stem)) AS s, event_id
      FROM public.questions
      WHERE status = 'draft' AND critic_route IS NULL
      GROUP BY event_id, lower(trim(stem))
      HAVING count(*) > 1
    ) d
  )
) AS audit;
