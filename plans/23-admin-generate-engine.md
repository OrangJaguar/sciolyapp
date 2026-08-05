# Plan 23 — Generation Engine (NIM job runner)

## Goal
**Page 2: Generate** — a real batch planner + efficient worker that respects NVIDIA NIM rate limits, assembles prompts from Catalog DB, and writes validated `questions` drafts.

## Manual **BEFORE this plan** (hard gate)
1. NVIDIA NIM API key → Supabase Edge Function **secrets** (never `VITE_*`)
2. Confirm DeepSeek V4 **Flash** + **Pro** model IDs in your NIM catalog
3. In Catalog (Plan 22): `master` pack filled + event pack for any event you will generate
4. Optional: few-shot gold MCQs in the event pack (huge quality lever)

**You do not need prompts in code.** Engine reads `prompt_packs` at job start.

### Secret names (locked)
Set these in Supabase Dashboard → Edge Functions → Secrets (or with
`supabase secrets set`):

```text
NVIDIA_NIM_API_KEY=nvapi-...
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_FLASH_MODEL=deepseek-ai/deepseek-v4-flash
NVIDIA_NIM_PRO_MODEL=deepseek-ai/deepseek-v4-pro
```

Copy model slugs from the live NVIDIA Build code sample before saving; if the
catalog changes, store its current slugs here rather than changing frontend code.

### Provider swap (NIM → DeepSeek direct)
Both providers are OpenAI-compatible, so the engine only ever reads base URL +
model + key from the four secrets above. Moving off NIM's free 5,000-request
lifetime allowance to a paid DeepSeek key is a **secrets edit, no code change**:

```text
NVIDIA_NIM_BASE_URL=https://api.deepseek.com/v1
NVIDIA_NIM_FLASH_MODEL=deepseek-v4-flash
NVIDIA_NIM_PRO_MODEL=deepseek-v4-pro
NVIDIA_NIM_API_KEY=sk-...
```

### Credit-aware batching
- **Batch size is a job config knob (1–5 MCQs per request), default 4.** NIM's
  free tier bills per request, so batching multiplies question yield per credit;
  DeepSeek bills per token, where batching mainly amortizes the cached prefix.
- Keep the system prompt **byte-identical across a job** (master + event pack
  first, per-concept payload last) so prefix caching hits.
- Request **non-thinking mode** for volume generation; reasoning tokens bill as
  output. Reserve thinking mode for Pro repair passes and calc-heavy concepts.
- Store `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` / output tokens per
  item so the job UI can show real spend, not guesses.

## Product — Page 2 features (make it strong)

### Planner
- Pick **event** → multi-select **concepts** (filter by topic, missing-coverage, no-guide)
- Per-concept **count** (or “N each” / paste distribution)
- Difficulty mix (easy/med/hard weights)
- Model: Flash (volume) | Pro (calc/hard) | Auto (Pro if concept tags imply calc)
- Options: include guide text in context (yes/no), require citation field, reject near-duplicates vs existing stems
- **Plan preview**: total Qs, estimated minutes at ~2s/request (40 RPM budget), cost-ish call count

### Job system (DB)
- `generation_jobs` — status: queued|running|paused|done|failed; config jsonb; progress counters
- `generation_job_items` — one row per intended question (concept_id, attempt, status, error, question_id)
- Resume after refresh; Pause / Cancel; Retry failed only

### Worker (Edge Function) — efficiency rules
- Single worker loop (or cron tick) claims next item
- **Throttle: default 1800ms between calls** (configurable). The 40 RPM limit is
  account-wide across models, so one global throttle governs every job.
- Exponential backoff on 429
- Hard JSON schema validate before INSERT draft
- On invalid JSON: one repair pass (Pro optional) then mark item failed with raw excerpt
- Dedup: cheap stem similarity vs event’s existing live+draft (skip or flag)
- Idempotent: item success writes exactly one draft `questions` row (`citation` like `nim:job:{id}`)

### Prompt assembly (runtime)
```
system = master.system_body
       + event_pack.system_body
       + optional topic_pack.system_body
user   = concept {id,name,description,depth_tags}
       + optional guide READ excerpt
       + few_shot from event_pack
       + “emit exactly N MCQs as JSON [{stem,options,correct_key,explanation,citation}]”
```
Stable prefix first, volatile concept payload last — required for cache hits.

### Live UI
- Job list + active job progress bar (items done/failed/left, ETA)
- Stream of last errors
- “Open in Review” deep link filtered to this job’s drafts

## Models (MASTER lock)
| Job | Model |
|---|---|
| Volume | DeepSeek V4 Flash |
| Harder / calc / repair | DeepSeek V4 Pro |
| Vision | **not** this plan |

## Out of scope
Review bulk UX (24), raw import parser (25), vision stems.

## Acceptance
- [ ] Plan 50 Qs across multiple concepts → job runs without hammering RPM
- [ ] Drafts appear in Review with correct concept_ids
- [ ] Pause/resume/retry works
- [ ] Missing event prompt pack → clear block before start (no silent garbage)
- [ ] Key missing → clear Edge error in UI

## Status
pending
