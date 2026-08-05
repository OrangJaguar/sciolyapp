# Plan 14 — Timed Autopsy

## Goal
Post-exam breakdown from Black Box localStorage: score, per-Q correct/wrong/blank, concept tags, timed XP commit (+12 / +2).

## Prerequisites
- Plan 13 exam writes `scioly.timed.{session}` then navigates here
- Plan 03 XP: timedCorrect 12, timedIncorrect 2

## Build
- `TimedAutopsyPage` grades frozen question set vs answers
- SQL `submit_timed_session` + `timed_session_commits` (idempotent by session token)
- Blank = skipped (no XP / no weakness); wrong → weakness + reinjection +1d
- Clear localStorage after successful commit (keep on failure for retry)
- Thin deploy note remains optional (Vercel later)

## Out of scope
CMD screens, Vercel setup (manual optional).

## Acceptance
- [x] Score matches answers
- [x] XP applied once (revisit / retry safe via session token)
- [x] Weak concepts listed on autopsy

## Status
**CODE DONE** — run `supabase/migrations/20260804_timed_commit.sql` (`SCIOLY-0804-TIMED`).

## Manual
1. Paste/run timed commit SQL
2. Finish Timed exam → autopsy score + XP
3. Optional later: Vercel deploy (not required for local)
