SELECT jsonb_build_object(
  'letter_mismatch', (
    SELECT count(*)
    FROM public.questions q
    WHERE q.status = 'draft' AND q.critic_route IS NULL
      AND substring(q.explanation from '(?i)correct answer is ([A-D])') IS NOT NULL
      AND upper(substring(q.explanation from '(?i)correct answer is ([A-D])')) <> q.correct_key
  ),
  'says_correct', (
    SELECT count(*)
    FROM public.questions q
    WHERE q.status = 'draft' AND q.critic_route IS NULL
      AND q.explanation ~* 'correct answer is [A-D]'
  ),
  'examples', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'event', event_id,
      'key', correct_key,
      'said', upper(substring(explanation from '(?i)correct answer is ([A-D])')),
      'stem', left(stem, 140)
    )), '[]'::jsonb)
    FROM (
      SELECT event_id, correct_key, explanation, stem
      FROM public.questions
      WHERE status = 'draft' AND critic_route IS NULL
        AND substring(explanation from '(?i)correct answer is ([A-D])') IS NOT NULL
        AND upper(substring(explanation from '(?i)correct answer is ([A-D])')) <> correct_key
      LIMIT 12
    ) s
  )
) AS review;
