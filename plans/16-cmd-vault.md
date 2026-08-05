# Plan 16 — CMD Vault

## Goal
Folder explorer + Active Loadout. Links/docs metadata only — **no binary upload**.

## Prerequisites
- Auth + team (Plan 15 path: user on a team as member+)
- `team_vault_resources` already in `20260803_initial` with officer write RLS

## Build
- SQL: `user_vault_loadout` pin table + `category` check (`doc`|`video`|`link`)
- Folders = active taxonomy events (+ **General** for `event_id` null)
- Search filters resource titles
- Officer+: add / delete resources (URL + title + category)
- Any team member: pin/unpin to personal Active Loadout
- Freelancer (no team): same join-code CTA pattern as Missions
- Reuse `fetchTeamContext` / `isOfficerPlus` from missions helpers

## Acceptance
- [x] Mockup structure preserved (search + folders + loadout column)
- [x] Loadout persists per user
- [x] Members read resources; only officer+ mutate vault rows

## Manual
1. Run `20260804_vault_loadout.sql` (`SCIOLY-0804-VAULT`) — **Role: postgres**
2. As coach/officer add a link → pin it → refresh; confirm loadout sticks

## Status
**code done** — run SQL above before pin/loadout works (resource CRUD uses existing table RLS).
