# Plan 19 — CMD Roster (pivoted into Comms)

## Goal
No separate Roster page. Squad management lives on **Comms**: thin roster rail + captain/coach **EDIT** modal.

## Build
- Removed `/cmd/roster` War Room matrix / status cycling
- SQL: simple `team_event_coverage` (no status) + RPCs assign / unassign / set role / remove member
- Max **2 partners per event** per team
- Comms: thinner roster; hover → role + events; EDIT modal for leadership
- Modal: promote/demote, add/remove events, remove member, show join codes

## Acceptance
- [x] No roster route/nav
- [x] Coach/captain can manage via Comms modal
- [x] Members see roster + hover details
- [x] 2-per-event enforced

## Manual
1. Re-run `20260804_roster.sql` (`SCIOLY-0804-ROSTER`) — **Role: postgres** (replaces old War Room SQL if you already ran it)
2. Comms → EDIT → assign events / change roles

## Status
**code done** — run SQL above.
