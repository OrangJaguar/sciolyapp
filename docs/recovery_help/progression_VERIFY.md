# Progression track — verify on live Supabase

SSOT one-liner: **Server awards XP; client mirrors formulas for HUD; badges are SQL-authoritative.**

Client SSOT: `src/lib/progression.ts`, `src/lib/badges.tsx`  
Recovery specs: `docs/recovery_help/scioly.app.md`, `docs/recovery_help/scioly.app (1).md`  
Rank SQL migration: `supabase/migrations/20261013_rank_title_from_xp.sql`

---

## 1. Confirm Plan 01 rank migration applied

In Supabase SQL editor:

```sql
select public.rank_title_from_xp(0) as r0,
       public.rank_title_from_xp(1000) as r1000,
       public.rank_title_from_xp(4000) as r4000,
       public.rank_title_from_xp(40000) as r40000;
```

Expect:

| XP | Result |
|---|---|
| 0 | `Recruit Lv 1` |
| 1000 | `Specialist Lv 11` |
| 4000 | `Tactician Lv 31` |
| 40000 | `National Legend Lv 133` |

If you still see old titles like `Recruit Level 1` / short Specialist bands, re-run the migration file.

---

## 2. RPC sanity

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'apply_practice_xp',
    'submit_casual_session',
    'submit_timed_session',
    'complete_clinic_do',
    'sync_my_badges_for_user',
    'progression_streak_multiplier',
    'rank_title_from_xp'
  )
order by 1;
```

All seven should exist.

---

## 3. Manual playtest checklist

Run against the deployed/dev app with a real login:

1. [ ] Casual: answer slowly → XP rises (~+5/correct path under cap); TopBar rank/XP updates without full reload  
2. [ ] Casual: answer in &lt;3s → “too fast” / invalidated messaging; that answer grants 0 XP  
3. [ ] Grind toward 200 base practice XP → `cap_hit` message appears  
4. [ ] Clinic DO clear → ~+10 practice XP if under cap  
5. [ ] Timed submit → XP commit returns; ghost badge only if 10/10 under half time  
6. [ ] Profile badge shelf → unlock a foundational badge end-to-end; progress numbers move  
7. [ ] Mission complete (if on a team) → +25 once (not under daily practice cap)  
8. [ ] Profile “Practice today” shows `N/200` for the local day  

---

## 4. Optional appendix — answer-key distribution

Not part of progression track; useful before content launch:

```sql
select correct_key, count(*)
from public.questions
where status = 'live' and question_type = 'mcq'
group by 1
order by 1;
```

Healthy banks should not pile entirely on one letter (shuffle exists on insert).

---

## 5. Local CI commands

```bash
npm run test:progression
npm run test:serving
npm run build
```
