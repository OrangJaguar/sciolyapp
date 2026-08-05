# Plan 06 — Casual Lobby

## Goal
`/ops/casual` lobby: pick studyable event → topic (or all topics) → start Arena handoff.

## Prerequisites
- Plan 04 seed applied (24 live Qs) — Start disables if bank empty for selection
- Plan 05 OPS hub done

## Build
- Fetch `taxonomy_events` (studyable first, others disabled/coming soon)
- Topics for selected event from `taxonomy_topics`
- Live question counts per event/topic from `questions` where `status=live`
- Start → `/ops/casual/arena?event=…&topic=…` (`topic=all` allowed)
- Thin arena placeholder route (Plan 07 replaces body) that reads params

## Out of scope
Serving algorithm, Clinic, XP commit, full Arena HUD.

## Acceptance
- [x] Only anatomy / chem_lab / water_quality startable
- [x] Topic list loads from DB
- [x] Start disabled if zero live questions for selection
- [x] Start navigates with event (+ optional topic) params

## Status
**DONE** — lobby at `/ops/casual`, arena handoff placeholder at `/ops/casual/arena`.

## Manual
Open `/ops/casual` logged in. Confirm 3 studyable events + topic counts. START → arena placeholder.
