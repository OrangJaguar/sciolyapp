# Plan 03 — Timed free nav

**Track:** `plans/ui`  
**Depends on:** Plan 01 (chrome), Plan 02 (does not block)  
**Touches:** `TimedExamPage`, `timedExamStorage`, timed shortcuts

## Goal

Timed stays an **exam**: move freely, no per-question Check, countdown with hide, fair pause, navigator of all questions, Submit on the last question.

## Amendments after Plans 01–02

- Chrome already wired: countdown, Hide, Pause blur, Back/Next/Submit-on-last, full navigator, no Check CTA.
- **Gap:** pause/hide not refresh-safe — persist `pausedRemainingSec` + `timerHidden` on the timed snapshot.
- Keyboard polish: `Enter` = Next (not Submit); `[` / `]` = Back/Next; `P`/`H` already work.
- Autopsy bridge unchanged (Plan 04 replaces summary UX later).

## Decisions (locked)

- Progress: answered / N
- Pause freezes **remaining seconds** (rebuild deadline on resume)
- Hidden timer still counts down while **not** paused
- Refresh while paused restores pause + remaining; no silent drain

## Acceptance

- [x] Free Back/Next; Submit only as last primary (plus timeout)
- [x] Navigator jumps; answered marks work
- [x] Hide timer; pause freezes clock + blurs
- [x] No Casual Check UI in Timed
- [x] Refresh mid-exam / mid-pause resumes fairly (`pausedRemainingSec` + `timerHidden`)

**Shipped:** pause/hide persistence, Enter/bracket nav, autopsy still the submit target.
