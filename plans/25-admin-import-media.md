# Plan 25 — Import + Media pipeline

## Goal
**Page 4: Import** — turn raw practice-test text (and structured files) into draft MCQs mapped to taxonomy; deepen event media so stems can reference stored figures.

## Depends on
- Plan 22 Catalog (media table + admin shell)
- Plan 21/24 review path for cleanup after import

**No NIM key required** for pure parse→draft. Optional: NIM “assist map this stem to a concept” later — defer unless trivial.

## Product — Page 4

### A. Raw test importer
- Paste zone (or .txt/.md upload) for a practice test chunk
- Parser heuristics:
  - Split numbered stems
  - Detect A/B/C/D (and A–E → drop/flag E)
  - Detect answer keys if present (`Answers: 1B 2C…`) separate pass
- Review grid before commit: each row editable; **concept picker** (search); event locked from session
- Commit → `questions` drafts with `citation = import:{batch_id}`
- Batch log table for undo (“archive this import batch”)

### B. Structured import
- JSON/CSV template download + upload (stem, A–D, key, explanation, concept_id)
- Validate + dry-run counts → commit

### C. Event media (deepen Plan 22)
- Upload to Supabase Storage bucket `event-media` (admin-only write)
- Tag images (e.g. `titration_curve`, `periodic_table_excerpt`)
- From Review/Generate later: insert `media_url` on question from picker
- Don’t build a public CDN browser for students this plan — admin library only

### D. Assistive mapping (lite, no full NIM factory)
- If key present: keyword/depth_tag overlap suggests top-3 concepts (local, no API)
- Manual confirm still required for MVP

## Out of scope
Full OCR of PDFs (future), vision model stem generation (binder/vision plans).

## Acceptance
- [ ] Paste a 10-Q answer-key practice chunk → 10 drafts mapped → show in Review
- [ ] CSV import dry-run + commit
- [ ] Upload ≥1 image to an event library; attach URL on a draft
- [ ] Import batch can be archived as a unit

## Status
pending
