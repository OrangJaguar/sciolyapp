SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) AS samples
FROM (
  SELECT DISTINCT ON (q.event_id)
    q.event_id,
    q.stem,
    q.options,
    q.correct_key,
    left(q.explanation, 280) AS explanation
  FROM public.questions q
  WHERE q.status = 'draft' AND q.critic_route IS NULL
  ORDER BY q.event_id, q.created_at
) s;
