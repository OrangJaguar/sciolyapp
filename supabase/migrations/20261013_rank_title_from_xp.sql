-- Plan 01: align rank_title_from_xp with recovery XP hierarchy (scioly.app.md §6).
-- Run in Supabase SQL editor if CLI migrate is not used.
--
-- Client SSOT: src/lib/progression.ts (formatRankHud / rankTitleFromXp / levelFromXp).
-- profiles.rank_title is legacy display cache only; UI derives rank from xp.

CREATE OR REPLACE FUNCTION public.rank_title_from_xp(p_xp integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  xp integer := GREATEST(COALESCE(p_xp, 0), 0);
  lvl integer;
  rank_name text;
  entry_xp integer;
  cost integer;
  start_lvl integer;
BEGIN
  -- Pick band by entry XP (same thresholds as src/lib/progression.ts RANK_CURVE).
  IF xp >= 40000 THEN
    rank_name := 'National Legend';
    entry_xp := 40000;
    cost := 750;
    start_lvl := 133;
  ELSIF xp >= 25000 THEN
    rank_name := 'National Contender';
    entry_xp := 25000;
    cost := 500;
    start_lvl := 103;
  ELSIF xp >= 15200 THEN
    rank_name := 'Elite';
    entry_xp := 15200;
    cost := 350;
    start_lvl := 75;
  ELSIF xp >= 8000 THEN
    rank_name := 'Master';
    entry_xp := 8000;
    cost := 300;
    start_lvl := 51;
  ELSIF xp >= 4000 THEN
    rank_name := 'Tactician';
    entry_xp := 4000;
    cost := 200;
    start_lvl := 31;
  ELSIF xp >= 1000 THEN
    rank_name := 'Specialist';
    entry_xp := 1000;
    cost := 150;
    start_lvl := 11;
  ELSE
    rank_name := 'Recruit';
    entry_xp := 0;
    cost := 100;
    start_lvl := 1;
  END IF;

  lvl := start_lvl + ((xp - entry_xp) / cost);
  RETURN rank_name || ' Lv ' || lvl::text;
END;
$$;

COMMENT ON FUNCTION public.rank_title_from_xp(integer) IS
  'Derive HUD rank string from XP (Recruit Lv 1 … National Legend). Mirrors src/lib/progression.ts formatRankHud.';

COMMENT ON COLUMN public.profiles.rank_title IS
  'Legacy/display cache only. Prefer public.rank_title_from_xp(xp) or client progression.ts.';

-- Optional: refresh cache for existing rows (safe; UI does not trust this column).
UPDATE public.profiles
SET rank_title = public.rank_title_from_xp(COALESCE(xp, 0));

ALTER TABLE public.profiles
  ALTER COLUMN rank_title SET DEFAULT 'Recruit Lv 1';
