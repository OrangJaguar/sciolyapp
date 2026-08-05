# Plan 10 — Clinic Interrupt

## Goal
After enough in-session misses on the **same concept**, interrupt Arena with Clinic: READ → SEE → DO. Must finish DO to return.

## Prerequisites
- Plan 07–09 Arena + commit
- Guide content may be empty until Plan 11 — use soft fallbacks

## Trigger (locked)
- Target: **3 wrong** on same `concept_id` in the current session
- Pragmatic: `threshold = min(3, max(1, count of that concept in session bank))`  
  so 2 Boyle seeded Qs still can fire Clinic at 2 misses
- Once per concept per session (after clear, misses for that concept reset)
- Skips do not count

## Build
- `ClinicOverlay` HUD: READ → SEE → DO (mini check)
- Fetch `concept_guides` if live; else concept description fallback
- Wire into Arena after incorrect **Next**/advance
- Block Escape/backdrop dismiss until DO passed

## Out of scope
Guide seed + Clinic XP RPC (Plan 11).

## Acceptance
- [x] Trigger only on rule (3, or all in-bank for concept)
- [x] Cannot leave without completing DO (Esc / backdrop blocked)
- [x] Cyan HUD language
- [x] Returns to Arena on next Q (or session commit if last)

## Status
**DONE** — `ClinicOverlay` + Arena wiring. Guide copy soft-fallback until Plan 11.

## Manual
Chem Lab → miss both Boyle questions → Clinic → READ/SEE/DO → return.
