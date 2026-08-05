# Plan 04 — Seed Test Questions

## Goal
Insert **24** `live` MCQs so Casual/Timed can run against real rows. Prefer chem_lab depth. No NIM.

## Prerequisites
- `20260803_initial.sql` applied (taxonomy + empty `questions`)
- `20260804_progression.sql` applied (done)

## Count (locked)
| Event | Rule | Count |
|---|---|---|
| chem_lab | 2 per topic × 6 topics | 12 |
| anatomy | 1 per topic × 6 | 6 |
| water_quality | 1 per topic × 6 | 6 |
| **Total** | | **24** |

**Clinic/weakness test tweak:** For chem_lab *Gas variables and named gas laws*, both questions share concept `chem_lab_boyles_law` so Plan 08–10 can hit the same concept twice in-bank. Other chem topics use two different concepts.

## Schema contract (`questions`)
| Column | Value |
|---|---|
| `question_type` | `mcq` |
| `status` | `live` |
| `options` | JSONB `{"A":"...","B":"...","C":"...","D":"..."}` |
| `correct_key` | `A` \| `B` \| `C` \| `D` |
| `event_id` / `topic_id` / `concept_id` | Real taxonomy FKs |
| `division` | `C` |
| `season_ids` | `{2027}` |
| `citation` | `seed:plan04` (re-run = delete then insert) |

No raw `;` inside dollar-quoted strings (SQL editor safety).

## Build
- File: `supabase/migrations/20260804_seed_questions.sql`
- Hand-authored, SciOly-plausible Div C items

## Acceptance
- [x] Seed file written: `supabase/migrations/20260804_seed_questions.sql` (24 MCQs, `citation=seed:plan04`)
- [x] ≥2 rows share `chem_lab_boyles_law`
- [ ] **You:** run SQL → `SELECT count(*) FROM questions WHERE citation='seed:plan04'` = 24

## Status
**CODE/SQL DONE** — paste `20260804_seed_questions.sql` in Supabase (look for `SCIOLY-0804-QSEED`). Re-runnable (deletes prior plan04 seed first).

## Manual
Run the seed SQL. Spot-check Table Editor → `questions`.
