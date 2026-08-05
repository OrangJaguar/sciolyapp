# Plan 08 — Serving Engine

## Goal
Pick Casual questions by priority: reinjection → weakness → uncovered → fallback. Wire Arena to it.

## Prerequisites
- Plan 07 Arena + `arenaBank` shuffle (replaced here)
- Weakness / reinjection / history tables exist (writes still Plan 09 — engine reads them)

## Rules (locked start)
1. Due `reinjection_queue` rows first (`unlock_at <= now`, unresolved, Q in scope)
2. Else highest weakness score in scope (`misses / max(attempts,1)`, then more attempts)
3. Else uncovered / least-seen concepts (fewest history touches)
4. Never repeat `question_id` inside one session
5. Fall back to any remaining live in-scope Q
6. Ties broken by stable `question.id` sort (deterministic)

## Build
- Pure `src/lib/serving.ts` + self-check tests
- `fetchArenaQuestionBank` loads bank + user signals, builds ordered session via engine
- Arena keeps using bank query (no UI change required)

## Out of scope
Writing weakness / reinjection (09), Clinic (10).

## Acceptance
- [x] Deterministic tests for priority order (`npm run test:serving`)
- [x] Arena uses this picker (`fetchArenaQuestionBank` → `buildSessionQueue`)
- [x] Empty bank returns empty list (Arena already shows empty-bank UI)

## Status
**DONE** — `src/lib/serving.ts` + wired bank fetch. Weakness writes still Plan 09.

## Manual
None. After Plan 09, weak concepts should surface first automatically.
