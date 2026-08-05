# Plan 15 — CMD Missions

## Goal
Missions page (mockup layout) on real `team_missions` + `user_mission_progress`, with officer create + progress sync from practice history.

## Prerequisites
- Auth + team onboarding
- Casual/Timed writing `user_history`

## Build
- SQL: officer INSERT/UPDATE on missions, `create_team_mission`, `sync_my_mission_progress` (counts event answers/corrects since mission created, marks complete, +50 XP once)
- `goal_type`: `answered` | `correct` (history can’t split Casual vs Timed yet — title carries intent)
- Missions UI: unit/squad, upcoming/old lists, create form (officer+), freelancer join-code CTA
- Targeted Practice panel from weakest studyable topic (or fallback); Casual deep-link `?event=&topic=`
- Meeting/Comp cards stay layout placeholders (“Schedule TBD”)

## Acceptance
- [x] Mockup structure preserved
- [x] Team members see real missions + synced progress
- [x] Freelancers see join CTA (not mock demo data)
- [x] Officers can create a mission

## Manual
1. Run `20260804_missions.sql` (`SCIOLY-0804-MISSIONS`)
2. As officer/captain create a mission → grind Casual → refresh Missions progress

## Status
**code done** — run SQL above before testing create/sync.
