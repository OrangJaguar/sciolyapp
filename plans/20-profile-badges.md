# Plan 20 — Profile + Badges Lite

## Goal
`/profile`: handle, rank, XP, streak, badge shelf (~8 milestones from MASTER).

## Product notes (locked this session)
- **No separate “quests” UI** — the 8 badges *are* the app-wide milestones
- **No custom PNG art** — static catalog in code with simple HUD SVG marks
- **No badge XP** — flair only (profile shelf; leaderboard flair later if wanted)
- Award via `sync_my_badges()` on profile load (backfill) so we don’t patch every RPC

## Build
- SQL: `user_badges` + `sync_my_badges`
- `src/lib/badges.ts` catalog (8 ids from MASTER)
- Profile page HUD: identity, rank/XP bar, live streak, badge grid (earned vs locked)
- Sign out stays

## Acceptance
- [x] Badges earn on real triggers (sync evaluates history/awards/team)
- [x] Streak displays with break if last activity >1 day ago
- [x] Rank matches progression helper

## Manual
1. Run `20260804_badges.sql` (`SCIOLY-0804-BADGES`) — **Role: postgres**
2. Open Profile (radar icon) — sync awards; grind if needed to unlock more

## Status
**code done** — run SQL above.
