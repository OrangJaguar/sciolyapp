# Plan 04 — Fullscreen practice summary

**Track:** `plans/ui`  
**Depends on:** Plans 02–03  
**Touches:** `practiceSummary` lib, `PracticeSummaryModal`, `AppShell` host, Casual arena exit, Timed autopsy → redirect

## Goal

After Casual End or Timed Submit, land on **CMD** with a **fullscreen modal**: stats → question review scrubber → weak topics / XP. Explanations in review. X closes to the live dashboard underneath.

## Amendments after Plans 01–03

- CMD “dashboard” = `/cmd/missions` (no separate dashboard route).
- Host modal from **AppShell** whenever a sessionStorage payload exists (works on any CMD page).
- Casual already has per-index grades + explanations — build payload on successful commit, drop in-arena done panel on success.
- Timed autopsy becomes **commit + redirect** (keep retry UI on commit failure); review lives in the modal.
- Reuse `PracticeCommitFeedback` in the modal footer.

## Acceptance

- [x] Both modes open fullscreen summary on CMD after success
- [x] Filter wrong + flick through; explanations when present
- [x] X / Esc → dashboard usable
- [x] XP/badges visible (`PracticeCommitFeedback`)
- [x] Weak topics honest

**Shipped:** `practiceSummary` storage, `PracticeSummaryModal` in AppShell, Casual/Timed redirect to `/cmd/missions`.
