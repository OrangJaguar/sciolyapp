# Plan 02c — Aug 3 Initial Migration (locked taxonomy)

## File
`supabase/migrations/20260803_initial.sql` — **only** migration to run.

Deleted: `20260731_initial.sql`, `20260801_initial.sql`.

## Model
```
Event → Topic → Concept
```
- Clinic / weakness / guides / question tags → **concept**
- Topic rollup view: `user_topic_weakness`
- No subtopics

## Seed
| Set | Details |
|---|---|
| Studyable | `anatomy`, `chem_lab`, `water_quality` — topics+concepts from `JSON Concepts/` (18 topics, 245 concepts) |
| Coming soon | 15 other Div C events (`studyable=false`) |
| Build-only | 5 events (`studyable=false`, `test_component=build_only`) |

## Also includes
Lean profiles, teams, roster, questions, progress tables, CMD tables, concept_guides (empty), auth RPCs, RLS.

## Wipe required
If you already ran 0801, wipe public schema first (see `docs/BEFORE_PLAN_03.md`). Do not layer 0803 on top of 0801.
