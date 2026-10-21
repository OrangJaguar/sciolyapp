# Plan 03 — High concurrency + server-side drain

**Track:** `plans/generate`  
**Depends on:** Plans 01–02 (deployed)  
**Touches:** concurrency clamps/UI, `generate-dispatcher`, generation RPCs (service_role runner), worker 429 requeue, cron docs

## Goal

Use DeepSeek headroom (**Flash 2500**, **Pro 500**) with an Admin picker — jobs keep draining **with the laptop closed** during off-peak.

## Amendments after Plans 01–02

- Off-peak window already enforced in worker — dispatcher must call the same `isInsideRunWindow`.
- `deepseek_429` diagnosis already tagged — **requeue** the item (don’t permanently fail the job).
- Browser drain stays a **Live boost** capped at **32** so it doesn’t fight the server pool.
- Generation RPCs require `is_platform_admin()` — broaden it so **service_role** JWT (dispatcher) can claim/complete (no separate runner role).
- Default Flash concurrency **64** (not 2500 on first click).

## Work items

### A. Concurrency caps + Admin presets
### B. `generate-dispatcher` + cron SQL docs  
### C. 429 requeue + light backoff  
### D. Jobs UX (in-flight, server drain hint, confirm ≥500)  
### E. Docs

## Acceptance

- [x] Flash ≤2500, Pro ≤500, NIM ≤8 (`maxConcurrencyForProvider` + presets)
- [x] `generate-dispatcher` + `is_platform_admin` service_role + docs/cron SQL
- [x] Outside window → 0 launches (dispatcher uses `isInsideRunWindow`)
- [x] 429 → `admin_generation_requeue_item` + backoff; Jobs UX (in-flight, Pump dispatcher, ≥500 confirm)
- [ ] **You:** run migration + deploy worker/dispatcher + optional cron (see Apply)

## Apply

```bash
# 1) Run migration SQL in Supabase SQL editor:
#    supabase/migrations/20261015_generation_drain_runner.sql
# 2) Deploy:
supabase functions deploy generate-worker
supabase functions deploy generate-dispatcher
# 3) Optional cron: docs/generation_drain_cron.sql (or docs/SUPABASE_SETUP.md)
```
