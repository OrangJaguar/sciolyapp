# Plan 05 — Shell, OPS, bugs, badges

**Track:** `plans/ui`  
**Depends on:** Plans 01–04 (practice track mostly done)  
**Touches:** `TopBar`, `XpBar`, `progression`, `OpsHubPage`, `MissionsPage` / `missions.ts`, `ProfilePage`, `badges.tsx`

## Goal

Polish around practice: rank/level presentation, XP copy, Casual OPS art, missions empty ≠ error, badge sync tone, unique badge icons.

## Amendments after Plans 01–04

- Missions “Failed to load” is often `sync_my_mission_progress` throwing while the list would be fine — **soft-fail sync**, hard-fail only on `fetchMyMissions`.
- Badge shelf already loads via `fetchMyBadges` — sync failure → soft note, not “unavailable.”
- Rank/`Lv` and Casual OPS hover are independent of arena chrome.

## Acceptance

- [x] Rank boxed level; no `Lv`
- [x] XP fraction quieter than “N to next”
- [x] Casual OPS hover in-bounds
- [x] Empty missions ≠ failed load (soft-fail sync)
- [x] Soft badge sync note only
- [x] Distinct visible badge icons

**Shipped:** TopBar/Profile rank chip, XpBar band fraction, CasualVisual needle fix, missions soft sync, unique `BadgeMark`s.
