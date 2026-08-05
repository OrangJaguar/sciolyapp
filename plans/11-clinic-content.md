# Plan 11 — Clinic Content

## Goal
Live `concept_guides` for all concepts covered by Plan 04’s 24 questions + Clinic DO awards +5 XP.

## Prerequisites
- Plan 10 Clinic overlay
- Plan 09 session commit / progression XP table

## Build
- Additive SQL: `do_prompt`, `do_options`, `do_correct_key` on `concept_guides`
- Seed **23** live guides (`citation`/`source` via comment, status=live) for every seeded-question concept
- SEE = simple HTML callout (not empty “visual slot”)
- DO uses seeded prompt/options when present
- RPC `complete_clinic_do(concept_id, session_token)` → +5 XP once per user/concept/session
- Overlay calls RPC on successful DO before returning to Arena

## Acceptance
- [x] Every seeded-question concept has a live guide (23)
- [x] Clinic shows real READ/SEE/DO from guides
- [x] Missing guide still soft-falls back
- [x] Completing DO grants +5 XP via `complete_clinic_do` (idempotent per session)

## Status
**CODE DONE** — run `supabase/migrations/20260804_clinic_guides.sql` (`SCIOLY-0804-CLINIC`).

## Manual
1. Paste/run clinic guides SQL in Supabase
2. Miss Boyle twice → Clinic should show real READ/SEE/DO
3. Clear DO → TopBar XP +5
