# Plan 02b — Aug 1 Initial Migration (2027 taxonomy + concept-first learning)

## Goal
Replace the July stub migration with a **single fresh-project SQL file** that:

1. Creates auth/team/portal schema (same as Plan 02 intent)
2. Seeds **2027 Division C** taxonomy from DETAILED EVENT PROFILES (not the master table)
3. Locks **concept-first Clinic / weakness / guides** into the data model

**File to run:** `supabase/migrations/20260801_initial.sql`  
**Do not run:** `20260731_initial.sql` (deprecated)

## Learning model (locked)

```
Event                    → Vault, lobby, leaderboard, missions
  └─ Official topic      → Casual mixer / coarse filters (profile §B)
       └─ Subtopic       → Chapters, admin batches, FALLBACK diagnosis (profile §C)
            └─ Concept   → Clinic trigger, guides, DO items, weakness map (profile §D)
```

| Behavior | Grain |
|---|---|
| Clinic interrupt (READ / SEE / DO) | **Concept** (2–3 misses / session, tunable) |
| Guide content (`concept_guides`) | **Concept** |
| Question primary tag | **`concept_id`** (required before status=`live` in Admin later) |
| `user_weakness_map` | **`concept_id`** |
| Fallback when concept data thin | Roll up via `user_subtopic_weakness` view → pick hottest concept inside |
| Serving bias | Prefer weak concepts; explore new concepts |

Subtopics are **not** the Clinic scalpel — they organize content and rescue cold-start diagnosis.

## Taxonomy seed contents

Source: `2027 Science Olympiad Research.pdf` → **DETAILED EVENT PROFILES**  
Machine-readable copy: `docs/taxonomy_2027_div_c.json`

| Set | Count |
|---|---|
| Studyable events (`studyable=true`) | **18** |
| Build-only events (`studyable=false`) | **5** (roster completeness; hidden from practice lobby) |
| Official topics | ~100 |
| Subtopics | **90** (5 per studyable event) |
| Concepts | **~310** (parsed from §D; refine anytime in Admin later) |

**Studyable 2027 C:** Anatomy, Astronomy, Botany, Chemistry Lab, Circuit Lab, Codebusters, Designer Genes, Disease Detectives, Dynamic Planet, Engineering CAD, Experimental Design, Forensics, Hovercraft, Protein Modeling, Remote Sensing, Rocks and Minerals, Thermodynamics, Water Quality  

**Excluded from study:** Boomilever, Electric Vehicle, Mission Possible, Ping-Pong Parachute, Wright Stuff  

Season default on questions: **`{2027}`**

## Schema deltas vs July stub

| Change | Why |
|---|---|
| `taxonomy_events.domain`, `test_component`, `studyable`, `season` | Accurate 2027 catalog + roster vs practice |
| `taxonomy_subtopics` table | Mid layer |
| `taxonomy_concepts` table | Clinic / guides / tags |
| `concept_guides` table | READ/SEE payloads (empty until Admin/Clinic plans) |
| `questions.concept_id` + `subtopic_id` | Replace free-text `sub_topic` |
| Weakness PK → `concept_id` | Matches Clinic |
| View `user_subtopic_weakness` | Fallback diagnosis without duplicating writes |

Auth RPCs (`complete_onboarding`, join/create team), RLS, grants: preserved/updated.

## Out of scope (later plans)

- Filling `concept_guides` (Plans 06 / 14)
- Live question bank generation (Plan 14)
- Division B taxonomy
- Perfect human-editing of every concept string (Admin polish)

## Acceptance

- [ ] Fresh Supabase project (or empty DB) runs `20260801_initial.sql` with no errors
- [ ] Table Editor shows 23 events; 18 with `studyable=true`
- [ ] `taxonomy_concepts` has hundreds of rows
- [ ] `.env.local` wired; signup → setup → Missions works
- [ ] July SQL never executed on this project

## Status
**SUPERSEDED by `plans/02c-aug3-migration.md` and `20260803_initial.sql`.** Do not run 0801.

