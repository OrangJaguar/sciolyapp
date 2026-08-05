# Plan 18 — CMD Leaderboard

## Goal
Filters (metric / event / window) + ranked list from real team stats.

## Prerequisites
- Team membership
- Practice writing `user_history` + profile XP

## Build
- SQL: `team_leaderboard` SECURITY DEFINER RPC (history is own-RLS; teammates can’t SELECT raw history)
- Metrics: `xp` (all-time profiles) · `correct` · `answered`
- Event filter + window (`all` / `season` / `30d` / `7d`) apply to correct/answered; XP ignores them (no XP ledger yet)
- HUD rows; highlight current user
- Freelancer join CTA (same as other CMD pages)

## Acceptance
- [x] Ordering correct (score desc, handle tie-break)
- [x] Filters work
- [x] Current user highlighted

## Manual
1. Run `20260804_leaderboard.sql` (`SCIOLY-0804-LEADERBOARD`) — **Role: postgres**
2. Open Leaderboard as a team member; flip metric/event/time

## Status
**code done** — run SQL above before filters beyond empty team list.
