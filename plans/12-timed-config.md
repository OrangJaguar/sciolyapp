# Plan 12 — Timed Config

## Goal
`/ops/timed` setup: studyable event, topic focus, question count, time limit → start Black Box exam handoff.

## Prerequisites
- Plan 04 live questions
- Casual lobby patterns (reuse taxonomy query cache)

## Build
- `TimedConfigPage` HUD (mirrors Casual lobby language, exam-focused copy)
- Params: event, topic (`all`|id), count, seconds, session token
- Block start if live Qs &lt; requested count
- Navigate → `/ops/timed/exam?...`
- Thin exam placeholder until Plan 13 (shows armed params)

## Out of scope
Exam runtime, localStorage, autopsy, Clinic (Timed never uses Clinic).

## Acceptance
- [x] Invalid configs blocked
- [x] Start navigates to exam route with params
- [x] Coming-soon events locked

## Status
**DONE** — Timed config at `/ops/timed`, exam placeholder at `/ops/timed/exam`.

## Manual
OPS → Timed → configure → ENTER BLACK BOX → confirm params on placeholder.
