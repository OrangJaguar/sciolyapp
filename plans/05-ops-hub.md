# Plan 05 — OPS Hub Elevates

## Goal
Keep **3-column** OPS home (Stitch). Fill empty rectangles: visual top (~55%) + title + 2–3 bullets.

## Prerequisites
- Shell + auth working
- Plans 03–04 done (progression + 24 live Qs seeded — hub itself does not query Qs yet)

## UX (locked)
| Card | Visual | Bullets | Route |
|---|---|---|---|
| Binder | schematic pages | Structure your binder · Track section gaps · Vision audit later | `/ops/binder` (stub until 23–24) |
| Casual | radar / target | Adaptive concept practice · Clinic on repeat misses · 24 live Qs ready | `/ops/casual` |
| Timed | chronograph / black box | Exam conditions · No mid-run Clinic · Autopsy after | `/ops/timed` |

Casual keeps **MOST POPULAR** pill. Distinct SVG/CSS visuals — no stock photos. Cards fill shell height, stack on mobile.

## Out of scope
Lobby, Arena, session start, Binder logic.

## Acceptance
- [x] Three cards side-by-side on desktop; stack on mobile
- [x] Each has distinct SVG visual + title + bullets
- [x] Casual marked popular; routes to stubs
- [x] Fits fixed chrome (`h-full min-h-0`)

## Status
**DONE** — elevated OPS hub shipped. Visual QA at `/ops`.

## Manual
None required (optional: refresh app and click all three cards).
