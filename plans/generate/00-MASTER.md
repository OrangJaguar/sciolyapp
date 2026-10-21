# Generate · DeepSeek pipeline — Master index

**Goal:** Run the existing question factory on **DeepSeek** at scale — off-peak pricing by default, concurrency pickable up to provider limits (Flash **2500** / Pro **500**), fully controllable from Admin → Generate. Secrets are already in Supabase Edge Function secrets.

**Baseline already in repo:** `generation_jobs` / items, claim/complete RPCs, `generate-worker`, browser parallel drain (`invokeGenerateWorkerBatch`), run-window check (`isInsideRunWindow`), Admin Generate UI (NIM live; DeepSeek options stubbed).

---

## Product decisions (locked)

| Topic | Decision |
|---|---|
| **Provider** | Wire `deepseek_flash` + `deepseek_pro`. Keep `nim` for free tests. |
| **Off-peak** | DeepSeek **peak** = Mon–Fri UTC `01:00–04:00` and `06:00–10:00`. Everything else is off-peak (½ price). Default: **only run in off-peak**. Admin can override (“Allow peak” / disable window). |
| **Concurrency** | Admin picker with presets + custom. Caps: Flash **2500**, Pro **500**, NIM keep low (e.g. 8). Respect 429 with backoff. |
| **Drain architecture** | Browser open is **not** required for big jobs. Server-side dispatcher/cron maintains the in-flight pool during off-peak. Browser drain remains a “boost while watching” option. |
| **Models** | Env-configurable; defaults to current DeepSeek V4 flash/pro chat IDs once secrets are confirmed. |
| **Critic** | Stay on NIM for now unless Plan 03 leftover time; same job system later. |

---

## Build order (3 plans — not 5)

| Plan | Name | Outcome |
|---|---|---|
| **01** | DeepSeek provider wire | `callDeepseek` in shared edge code; worker routes by `config.provider`; cost/ETA labels accurate |
| **02** | Off-peak windows | DeepSeek peak calendar as first-class window mode; jobs idle outside window; clear Admin UI |
| **03** | High concurrency + server drain | Concurrency up to 2500/500; dispatcher so jobs run without the tab open; 429/backoff |

**How to use:** `build plan 01` → check-in → adjust → continue.

---

## What you already did

- Put DeepSeek (and related) secrets in Supabase Edge Function secrets.

## What still needs shipping (this track)

1. Code path that actually calls DeepSeek (today worker throws “not wired”).
2. Off-peak default tied to DeepSeek’s UTC peak windows (not the old Chicago 08–22 heuristic alone).
3. Concurrency UI/clamp raised past **8**, plus a **server** fan-out so 100–2500 isn’t “open a laptop and hope.”
4. Docs: which secrets, deploy commands, how to start a night run.

---

## Out of scope

- Redesigning prompt packs / few-shots (already exist)
- Landing page / student UX
- Team/roster track (done)
- Raising DeepSeek account quota beyond published limits (expansion request is manual with DeepSeek)

---

## Progress

- [x] Plan 01 — DeepSeek provider wire (redeploy `generate-worker` to pick up)
- [x] Plan 02 — Off-peak windows (redeploy `generate-worker` again)
- [x] Plan 03 — High concurrency + server drain (code landed; deploy migration + functions)

## Verify after track

- [ ] Create job with `deepseek_flash`, window = DeepSeek off-peak only → worker returns `outsideWindow` during peak UTC weekdays
- [ ] Same job during off-peak → writes draft questions
- [ ] Concurrency 32+ progresses with tab closed (dispatcher/cron)
- [ ] Pro capped at 500; Flash allows higher presets up to 2500
- [ ] 429s pause/backoff instead of hard-failing the whole job
