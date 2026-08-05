# Plan 24 — Review Factory

## Goal
**Page 3: Review** — replace Plan 21’s thin list/form with a high-speed review cockpit for someone who will live here for hours.

## Depends on
- Plan 21 SQL (admin UPDATE) — already done
- Plan 22 shell + Catalog (nav)
- Drafts from seeds / Plan 23 / Plan 25

**No NIM key required** to use Review (only need drafts in DB).

## Product — make it genuinely usable

### Queue intelligence
- Group by **event → topic → concept** (collapsible)
- Filters: status draft|needs_fix; job id; citation prefix (`nim:`, `seed:`, `import:`); missing explanation; low option quality heuristics
- Sort: oldest first / newest / concept name
- Coverage chip: how many live Qs already on this concept

### Review surface
- **Keyboard-first**: J/K next/prev, A approve(publish), R reject(archive), E focus stem, S save, U needs-fix
- Split: stem+options left; explanation + taxonomy + guide peek right
- One-click correct_key
- “Compare to guide” panel (READ snippet) for factual sniff test
- Flag `needs_fix` (new status or boolean) instead of only archive — send back without losing work

### Bulk tools
- Multi-select within a concept → Publish all / Reject all / Assign concept
- “Publish all passing lint” (has 4 options, key set, explanation ≥ N chars)
- Soft lint warnings: duplicate correct text, “all of the above”, stem too short, etc. (warn, don’t block)

### Quality loop
- Optional: mark few-shot candidates → “Promote to event prompt pack few-shot” (writes Catalog pack JSON) — tight loop between Review and Generate quality

## Schema tweaks
- `questions.needs_fix boolean default false` OR status stays draft + flag
- Index for admin queue filters
- Keep Publish = `live`, Reject = `archived` (Plan 21 lock)

## Out of scope
NIM generate, import parser.

## Acceptance
- [ ] Review 20 drafts via keyboard without touching mouse for publish/reject/next
- [ ] Bulk publish one concept’s drafts
- [ ] Non-admin still blocked
- [ ] Published items serve in Casual

## Status
pending
