# Plan 13 — Timed Exam (Black Box)

## Goal
Full timed run from Plan 12 params: no Clinic, countdown timer, answer navigation, **localStorage crash protect**, submit → autopsy handoff.

## Prerequisites
- Plan 12 config → `/ops/timed/exam?session&event&topic&count&seconds`

## Build
- `TimedExamPage` Black Box HUD (select only — no mid-run reveal/Clinic)
- Persist: deadline, question id order, answers, index under `scioly.timed.{session}`
- Resume on reload if same session URL; auto-submit if past deadline
- Fetch bank via serving engine with `cap=count`; freeze id order in LS
- Submit → `/ops/timed/autopsy?session=…` (thin placeholder until Plan 14)
- Clear path: abandon → confirm → back to config (optional wipe LS)

## Out of scope
XP commit / scored autopsy UI (Plan 14).

## Acceptance
- [x] Refresh mid-exam restores answers + timer
- [x] Timer expiry auto-submits
- [x] No Clinic interrupt path

## Status
**DONE** — Black Box at `/ops/timed/exam`, autopsy handoff placeholder at `/ops/timed/autopsy`.

## Manual
Start Timed → answer → refresh (resume) → Submit or let clock hit 0.
