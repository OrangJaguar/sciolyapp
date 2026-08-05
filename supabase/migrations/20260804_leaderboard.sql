-- ============================================================================
-- scioly.app — Plan 18 team leaderboard RPC (fixed OUT-column shadowing)
-- PASTE-CHECK: SCIOLY-0804-LEADERBOARD
-- Prerequisites: 20260803 (+ addons if fresh). History is own-RLS; this RPC is DEFINER.
-- Re-run this file (postgres) to replace a broken earlier version.
-- ============================================================================

DROP FUNCTION IF EXISTS public.team_leaderboard(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.team_leaderboard(
  p_metric TEXT DEFAULT 'xp',
  p_event_id TEXT DEFAULT NULL,
  p_window TEXT DEFAULT 'all'
)
RETURNS TABLE (
  user_id UUID,
  handle TEXT,
  avatar_id TEXT,
  score BIGINT,
  place INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH
  me AS (
    SELECT p.team_id AS tid
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ),
  params AS (
    SELECT
      lower(trim(COALESCE(p_metric, 'xp'))) AS metric,
      lower(trim(COALESCE(p_window, 'all'))) AS win,
      NULLIF(trim(COALESCE(p_event_id, '')), '') AS event_id,
      CASE lower(trim(COALESCE(p_window, 'all')))
        WHEN '7d' THEN now() - INTERVAL '7 days'
        WHEN '30d' THEN now() - INTERVAL '30 days'
        WHEN 'season' THEN TIMESTAMPTZ '2026-09-01 00:00:00+00'
        ELSE NULL
      END AS since
    FROM me
  ),
  roster AS (
    SELECT p.id, p.handle, p.avatar_id, p.xp
    FROM public.profiles p
    JOIN me ON me.tid IS NOT NULL AND p.team_id = me.tid
  ),
  agg AS (
    SELECT
      h.user_id AS uid,
      count(*)::bigint AS answered_n,
      count(*) FILTER (WHERE h.is_correct)::bigint AS correct_n
    FROM public.user_history h
    JOIN public.questions q ON q.id = h.question_id
    JOIN roster r ON r.id = h.user_id
    CROSS JOIN params par
    WHERE (par.since IS NULL OR h.answered_at >= par.since)
      AND (par.event_id IS NULL OR q.event_id = par.event_id)
    GROUP BY h.user_id
  ),
  scored AS (
    SELECT
      r.id AS uid,
      r.handle AS uname,
      r.avatar_id AS uavatar,
      CASE
        WHEN (SELECT metric FROM params) = 'xp' THEN r.xp::bigint
        WHEN (SELECT metric FROM params) = 'correct' THEN COALESCE(a.correct_n, 0)
        ELSE COALESCE(a.answered_n, 0)
      END AS uscore
    FROM roster r
    LEFT JOIN agg a ON a.uid = r.id
    WHERE EXISTS (SELECT 1 FROM me WHERE tid IS NOT NULL)
      AND (SELECT metric FROM params) IN ('xp', 'correct', 'answered')
  )
  SELECT
    s.uid,
    s.uname,
    s.uavatar,
    s.uscore,
    (RANK() OVER (ORDER BY s.uscore DESC, lower(s.uname) ASC))::int
  FROM scored s
  ORDER BY s.uscore DESC, lower(s.uname) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.team_leaderboard(TEXT, TEXT, TEXT) TO authenticated;
