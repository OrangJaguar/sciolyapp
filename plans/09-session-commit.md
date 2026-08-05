# Plan 09 — Session Commit

## Goal
End-of-session commit from Arena: history, weakness, reinjection, XP/streak — server RPC, idempotent.

## Prerequisites
- Plan 03 progression constants
- Plan 07–08 Arena + serving
- `last_activity_on` from `20260804_progression.sql`

## Build
- Migration `20260804_session_commit.sql`:
  - `casual_session_commits` (idempotency by `session_token`)
  - RPC `submit_casual_session(p_session_token, p_event_id, p_topic_id, p_answers jsonb)`
- XP: correct +10 / incorrect +2 (mirrors `XP_AWARDS`); skipped = no XP / no weakness
- Wrong → bump weakness + enqueue reinjection (`unlock_at = now() + 1 day`)
- Streak via UTC `last_activity_on`
- Arena: generate `sessionToken` per run; commit once on finish; refresh profile; show XP gained
- Re-submit same token returns prior result (no double XP)

## Out of scope
Clinic interrupt UI (10).

## Acceptance
- [x] Completing a session changes XP in DB (via RPC)
- [x] Wrong answers raise concept weakness + reinjection +1d
- [x] Serving reads weakness (Plan 08) — prefers weak after commit
- [x] Idempotent via `session_token` / `casual_session_commits`

## Status
**CODE DONE** — you must run `supabase/migrations/20260804_session_commit.sql` (look for `SCIOLY-0804-SESSION`).

## Manual
1. Paste/run session commit SQL in Supabase
2. Finish one Casual set → see +XP on summary + TopBar
3. Optional: Table Editor → `user_history`, `user_weakness_map`, `casual_session_commits`
