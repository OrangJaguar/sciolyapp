# Plan 02 — Casual check + session

**Track:** `plans/ui`  
**Depends on:** Plan 01 (shipped)  
**Touches:** `CasualArenaPage`, choice UI, practice SFX, shortcuts, End → interim summary (Plan 04 later)

## Goal

Casual feels like deliberate practice: pick → **Check** → feedback → Next. No skip. Session stopwatch. Growing green/red navigator. Soft glow + sound. Clear explanations.

## Amendments after Plan 01

- `PracticeChrome` already has stopwatch wiring, pause blur, navigator, Back/Next — **reuse**; stop putting Check on the primary chrome button.
- Temporary Skip in `bottomLeftExtra` — **remove**.
- Glow utility classes (`choice-glow-*`) already exist — use on grade.
- Choice rows must not nest `<button>` in `<button>` — use selectable row + inner Check button.
- Interim session-complete panel stays until Plan 04 (no CMD modal yet).

## Decisions (locked)

- Progress: `Q n / N`; bar = **checked count / N**
- Stopwatch: session-wide (already); pauses with Pause
- Select = highlight only; **Check** on right of selected choice; Enter checks when selected
- Next disabled until current checked; revisiting graded Q: Next on, Check gone
- No Skip / no `S`
- Last Q after Check: primary = **End session**; separate **End** for early quit
- Per-index grades map for navigator + commit
- Clinic still on miss threshold; fire after Check (before needing Next)

## Acceptance

- [x] Cannot advance without Check; no Skip
- [x] Check only on selected choice; glow + sound on grade
- [x] Navigator grows; green/red accurate
- [x] Stopwatch session-wide; pause blurs + freezes
- [x] End / last-End commits; explanations after Check

**Shipped:** per-index grades, inline Check CTA, `practiceSfx`, End + End session, Skip removed. Interim complete panel until Plan 04.
