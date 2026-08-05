# Plan 17 — CMD Comms

## Goal
Roster sidebar + Pinned / Stream posts on real `team_posts` (+ `team_roster` handles).

## Prerequisites
- Auth + team membership (Plan 15 path)
- Shell layout settled (full-bleed + desktop type scale)

## Build
- SQL: officer UPDATE/DELETE on `team_posts` (pin toggle + remove) — INSERT already officer+
- Roster rail: real teammates (handle + role), squad label = team name
- Pinned section + Active Stream (poll ~30s ok; no Slack threads)
- Officer+: compose post, pin/unpin, delete
- Members: read-only stream
- Freelancer: same join-code CTA as Missions/Vault
- Reuse `fetchTeamContext` / `isOfficerPlus` / `joinTeamByCode`

## Acceptance
- [x] Mockup structure preserved (roster | pinned + stream)
- [x] Real roster + posts
- [x] Officers can post / pin / delete
- [x] Poll refresh (no realtime required)

## Manual
1. Run `20260804_comms_posts.sql` (`SCIOLY-0804-COMMS`) — **Role: postgres** (needed for pin/delete)
2. As coach post a message → pin it → confirm Pinned vs Stream

## Status
**code done** — run SQL for pin/delete; read + create work after existing schema grants if you already have INSERT.
