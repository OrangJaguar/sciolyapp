-- Time and event filters apply to XP, correct, and answered.
-- A score of 0 has no place.

CREATE OR REPLACE FUNCTION public.team_leaderboard(
  p_metric text DEFAULT 'xp',
  p_event_id text DEFAULT NULL,
  p_window text DEFAULT 'all'
) RETURNS TABLE (
  user_id uuid,
  handle text,
  avatar_id text,
  score bigint,
  place integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  answers AS (
    SELECT
      psa.user_id AS uid,
      count(*)::bigint AS answered_n,
      count(*) FILTER (WHERE psa.is_correct)::bigint AS correct_n
    FROM public.practice_session_answers psa
    JOIN roster r ON r.id = psa.user_id
    CROSS JOIN params par
    WHERE psa.skipped = false
      AND psa.invalidated = false
      AND (par.since IS NULL OR psa.created_at >= par.since)
      AND (par.event_id IS NULL OR psa.event_id = par.event_id)
    GROUP BY psa.user_id
  ),
  xp_bits AS (
    SELECT c.user_id, c.event_id, c.xp_awarded, c.created_at
    FROM public.casual_session_commits c
    UNION ALL
    SELECT t.user_id, t.event_id, t.xp_awarded, t.created_at
    FROM public.timed_session_commits t
    UNION ALL
    SELECT d.user_id, NULL::text, d.xp_awarded, d.created_at
    FROM public.clinic_do_awards d
    UNION ALL
    SELECT a.user_id, m.target_event_id, a.xp_awarded, a.created_at
    FROM public.mission_complete_awards a
    LEFT JOIN public.team_missions m ON m.id = a.mission_id
  ),
  xp_window AS (
    SELECT b.user_id AS uid, COALESCE(SUM(b.xp_awarded), 0)::bigint AS xp_n
    FROM xp_bits b
    JOIN roster r ON r.id = b.user_id
    CROSS JOIN params par
    WHERE (par.since IS NULL OR b.created_at >= par.since)
      AND (par.event_id IS NULL OR b.event_id = par.event_id)
    GROUP BY b.user_id
  ),
  scored AS (
    SELECT
      r.id AS uid,
      r.handle AS uname,
      r.avatar_id AS uavatar,
      CASE
        WHEN (SELECT metric FROM params) = 'xp'
          AND (SELECT since FROM params) IS NULL
          AND (SELECT event_id FROM params) IS NULL
          THEN r.xp::bigint
        WHEN (SELECT metric FROM params) = 'xp'
          THEN COALESCE(x.xp_n, 0)
        WHEN (SELECT metric FROM params) = 'correct'
          THEN COALESCE(a.correct_n, 0)
        ELSE COALESCE(a.answered_n, 0)
      END AS uscore
    FROM roster r
    LEFT JOIN answers a ON a.uid = r.id
    LEFT JOIN xp_window x ON x.uid = r.id
    WHERE EXISTS (SELECT 1 FROM me WHERE tid IS NOT NULL)
      AND (SELECT metric FROM params) IN ('xp', 'correct', 'answered')
  ),
  ranked AS (
    SELECT
      s.uid,
      s.uname,
      s.uavatar,
      s.uscore,
      CASE
        WHEN s.uscore > 0 THEN
          RANK() OVER (ORDER BY s.uscore DESC, lower(s.uname) ASC)
        ELSE NULL
      END::int AS uplace
    FROM scored s
  )
  SELECT
    ranked.uid,
    ranked.uname,
    ranked.uavatar,
    ranked.uscore,
    ranked.uplace
  FROM ranked
  ORDER BY (ranked.uplace IS NULL), ranked.uplace, lower(ranked.uname);
$$;

ALTER FUNCTION public.team_leaderboard(text, text, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.team_leaderboard(text, text, text) TO authenticated;
