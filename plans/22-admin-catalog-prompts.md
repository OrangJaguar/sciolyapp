# Plan 22 — Admin Factory shell + Catalog Studio

## Goal
Replace the thin single-panel `/admin` with an **Admin Factory shell** (4 tabs) and ship **Page 1: Catalog** fully usable — taxonomy, Clinic guides, **prompt packs (DB-edited, not code)**, and event media stubs.

## Why this first
You can spend real time authoring guides + prompts **before** any NIM key. Generation (23) only consumes what Catalog stores.

## Routes / IA (locked)
```
/admin              → redirect to /admin/catalog
/admin/catalog      → Page 1 (this plan)
/admin/generate     → hollow stub → Plan 23
/admin/review       → keep current thin queue usable → Plan 24 upgrades
/admin/import       → hollow stub → Plan 25
```

Admin subnav (shell): **Catalog · Generate · Review · Import**

## Page 1 — Catalog Studio (powerful)

### A. Taxonomy browser
- Event list (studyable flag toggle for admins)
- Drill: Event → Topics → Concepts
- Concept detail: name, description, depth_tags (edit), link to guide + coverage counts (live/draft/archived Qs)

### B. Clinic guides (READ / SEE / DO)
- Edit `concept_guides` in-place (draft/live)
- Preview as Clinic would see it
- Bulk: filter concepts missing guides

### C. Prompt packs (same page — tab or split panel, **not a 5th top-level page**)
Store in DB so you never hand-edit Vite/Edge source for prompt text.

| Pack | Grain | Purpose |
|---|---|---|
| `master` | global | JSON contract, distractor rules, anti-hallucination, difficulty bands |
| `event:{event_id}` | per studyable event | Style bible + 2–4 gold few-shot MCQs |
| `topic:{topic_id}` | optional overlay | Only when a topic is weird (diagram-heavy, etc.) |

UI: list packs → Monaco-or-textarea editor → version stamp → “active” flag.  
Generate engine (23) assembles: **master + event pack + optional topic + concept fill-ins**.

### D. Event media library (v1)
- Table `event_media` (event_id, label, url/storage_path, tags, notes)
- Admin can register URLs (Supabase Storage upload optional same plan if quick; else URL-first)
- Used later by Generate/Import when a stem needs a figure reference

## SQL (this plan)
- `prompt_packs` + RLS admin-only write
- `event_media` + RLS
- Admin INSERT/UPDATE on `concept_guides`, UPDATE taxonomy fields admins need
- Admin INSERT on `questions` (needed for 23–25)
- Seed empty `master` row + empty packs for studyable events (you fill text in UI)

## Out of scope
NIM calls, job runner, bulk review UX, raw-test parser.

## Manual
- Run `20260805_admin_catalog.sql` (`SCIOLY-0805-ADMIN-CATALOG`) as **postgres**
- **No NVIDIA key yet**
- After code: open Catalog → write/paste **master** prompt + at least **one event pack** (e.g. chem_lab) before you expect good Generate output
- You can author all event packs over days; Generate still works pack-by-pack

## Acceptance
- [x] 4-tab Admin shell; non-admin still blocked
- [x] Edit guide + save; toggle studyable
- [x] Edit prompt pack in UI; persists in DB; no code deploy to change prompts
- [x] Register ≥1 event media URL
- [x] Generate/Import pages show “coming in Plan 23/25” stubs

## Status
**code done** — run `SCIOLY-0805-ADMIN-CATALOG`, then test Catalog.
