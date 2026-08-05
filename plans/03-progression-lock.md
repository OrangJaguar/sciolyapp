# Plan 03 — Progression Lock (ranks / XP / streak)

## Goal
Single source of truth for rank titles, level bands, XP awards, streak rules. Profile TopBar always shows **derived** rank from XP.

## Out of scope
Badges, leaderboard, granting XP from sessions (Plan 09+).

## Build
- Expand `src/lib/progression.ts` with locked tables from `00-MASTER`
- Optional: DB trigger or RPC helper later; for now client + commit RPCs will import same numbers via shared constants mirrored in SQL comments/RPC
- Ensure `profiles.rank_title` updates when XP changes (RPC or generated on read — prefer **derive on read**, store XP only)

## Acceptance
- [x] Rank titles match MASTER table for sample XP values
- [x] XP award constants exported and documented
- [x] TopBar uses derivation (no stale hardcoded SPECIALIST for logged-in users with 0 XP)

## Status
**DONE** — `src/lib/progression.ts` is SSOT. Run `supabase/migrations/20260804_progression.sql` once in SQL Editor (adds `last_activity_on`). Do not start Plan 04 until that additive migration is applied (or apply it with 04).

## Manual
Run `20260804_progression.sql` in Supabase SQL Editor (safe additive).
