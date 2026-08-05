# Plan 07 — Arena UI

## Goal
Cyan HUD quiz at `/ops/casual/arena` (quiz-ref layout, cyan language): stem, A–D options, progress, skip/next, keyboard.

## Prerequisites
- Plan 06 lobby handoff (`?event=&topic=`)
- Plan 04 live seed applied

## Build
- Replace arena placeholder with real Arena page
- Fetch live MCQs in event/topic scope; shuffle; **session cap 10** (short set)
- Temporary bank picker (random shuffle) — **Plan 08 replaces** with serving engine
- Local-only grade + explanation flash; no DB commit (Plan 09)
- Keys: `1–4` select · `Enter`/`Space` next · `S` skip · `Esc` exit confirm

## Out of scope
Weakness, session RPC, Clinic, Timed timer chrome.

## Acceptance
- [x] Cyan HUD (not grayscale Notion quiz)
- [x] Keyboard works
- [x] Progress updates
- [x] Can finish a short set from seeded Qs → local summary

## Status
**DONE** — Arena at `/ops/casual/arena`. Temp shuffle bank in `src/lib/arenaBank.ts` (Plan 08 replaces).

## Manual
Lobby → START → play a set (1–4, Enter/Space, S, Esc).
