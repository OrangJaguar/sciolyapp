# Plan 01 — Shared practice chrome

**Track:** `plans/ui`  
**Depends on:** none (first)  
**Touches:** new practice shell components, CasualArena + TimedExam layout wrappers, theme tokens for soft correct/wrong glow, shortcuts help

## Goal

One open, calm practice frame both modes sit inside — Q#, progress, timer cluster, pause blur, bottom nav, `?` shortcuts — without boxing the whole viewport in a harsh panel.

## Work items

### A. `PracticeChrome` (or split: `PracticeTopBar` / `PracticeBottomBar` / `PracticePauseOverlay`)
- Full-bleed on theme `--bg` / surface; **no** outer `hud-panel` wrapping stem+choices
- **Left:** clickable `Q n/N` + thin progress bar (props: `current`, `total`, `progressRatio`, `onOpenNavigator`)
- **Right:** timer display (string) + Hide/Show + Pause/Resume; Exit stays available
- **Bottom:** Back (hidden/disabled on first), primary Next/Submit (label + disabled props), End slot (Casual only later)
- **Bottom-left:** `?` opens shortcuts popover/modal
- **Pause overlay:** when paused, blur/obscure question region + clear “Paused — click to resume” (timer frozen by parent)

### B. Question navigator modal (shared shell, mode feeds items)
- Compact popover/modal anchored near Q#
- Grid of number buttons; `onJump(index)`
- Item state props: `neutral | current | answered | correct | incorrect | blank` (Timed won’t use correct/incorrect until Plan 03/04)

### C. Theme tokens
- Soft `--glow-correct` / `--glow-wrong` (low alpha, readable on hud/sleek/paper)
- Utility classes for choice glow after grade (used in Plan 02)

### D. Wire shells into pages (behavior still old where needed)
- `CasualArenaPage` + `TimedExamPage` use chrome for layout; keep existing grade/timer logic working until 02/03
- Remove skip affordance from chrome API (Casual drop in 02; Timed never had meaningful skip)

### E. Shortcuts help content (baseline)
- Document: `1–4` choices, `Enter` check/submit (mode note), `←/→` or letters for back/next if we add them, `P` pause, `H` hide timer, `Esc` exit confirm
- Implement key handlers that exist today; extend in 02/03

## Acceptance

- [x] Arena/exam no longer feel “inside a heavy box”; open on theme bg
- [x] Q# + bar + timer hide + pause blur render in both modes
- [x] Navigator modal opens/closes; jump works with stub item list
- [x] `?` shows shortcut list
- [x] hud / sleek / paper tokens include soft glow (verify visually)

**Shipped:** `PracticeChrome`, glow tokens/utilities, Casual + Timed wired. Skip still present (removed in Plan 02).

## Notes for you (Sanskar)

React to spacing, type size, and how loud the chrome is **before** we dig into Casual Check behavior in 02.
