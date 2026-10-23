SELECT jsonb_build_object(
  'keys', (
    SELECT jsonb_object_agg(correct_key, n)
    FROM (
      SELECT correct_key, count(*) AS n
      FROM public.questions
      WHERE status = 'draft' AND critic_route IS NULL
      GROUP BY correct_key
    ) s
  ),
  'blames_key', (
    SELECT count(*)
    FROM public.questions q
    WHERE q.status = 'draft' AND q.critic_route IS NULL
      AND q.explanation ~* ('option ' || q.correct_key || ' (omits|is incorrect|is wrong|reverses|confuses|forgets)')
  )
) AS extra;
