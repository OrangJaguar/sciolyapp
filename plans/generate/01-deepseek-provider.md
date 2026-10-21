# Plan 01 — DeepSeek provider wire

**Track:** `plans/generate`  
**Depends on:** Secrets already in Supabase Edge Functions  
**Touches:** `supabase/functions/_shared/generation.ts`, `generate-worker`, `src/lib/adminGenerate.ts`, GeneratePage labels, `docs/SUPABASE_SETUP.md`

## Goal

Stop throwing “DeepSeek not wired.” Selecting Flash/Pro in Admin actually hits DeepSeek’s OpenAI-compatible chat API and writes questions the same path NIM uses today.

## Current gap

```ts
// generate-worker today
if (provider.startsWith('deepseek')) {
  throw new Error('Paid DeepSeek provider is not wired yet…')
}
```

NIM path (`callNim`) is complete. Shared prompt/parse/insert stays unchanged.

## Work items

### A. Shared `callDeepseek`

In `_shared/generation.ts`:

- Read secrets (names flexible — detect what you already set; document the canonical set):
  - `DEEPSEEK_API_KEY` (required)
  - `DEEPSEEK_BASE_URL` default `https://api.deepseek.com`
  - `DEEPSEEK_FLASH_MODEL` / `DEEPSEEK_PRO_MODEL` (defaults to current V4 flash/pro model ids from DeepSeek docs)
  - `DEEPSEEK_TIMEOUT_MS` (generous; long generations)
- OpenAI-style `POST /chat/completions` with `messages`, `max_tokens`, `temperature`
- Return same `NimCallResult` shape `{ content, usage, finishReason }` so the worker stays provider-agnostic
- Map HTTP 429 → clear error string including `deepseek_429` diagnosis hook for Plan 03

### B. Worker routing

`generate-worker`:

```
provider nim → callNim
provider deepseek_flash → callDeepseek(flash)
provider deepseek_pro → callDeepseek(pro)
provider auto → prefer deepseek_flash if key present else nim
```

`repairJson` should use the **same provider** as the parent call (or flash) — not always NIM pro.

### C. Client / Admin copy

- GeneratePage: remove “(wire later)”; show Flash / Pro as live
- Cost helper already assumes DeepSeek rates — refresh to **current** peak/off-peak table (Plan 02 will split peak vs off-peak estimate)
- Error messages mention DeepSeek secrets, not only `NVIDIA_NIM_*`

### D. Docs

Update `docs/SUPABASE_SETUP.md`:

```bash
supabase functions deploy generate-worker
```

List required secrets. Note: redeploy after code change even if secrets already exist.

## Acceptance

- [x] Job with `provider: deepseek_flash` completes ≥1 item against live API *(code wired — redeploy worker + run a small job to confirm secrets)*
- [x] Job with `provider: deepseek_pro` works (lower concurrency later)
- [x] NIM path unchanged
- [x] Deploy notes updated; build passes

## Shipped

- `callDeepseek` / `callChatModel` / `resolveChatProvider` in `_shared/generation.ts`
- `generate-worker` routes Flash/Pro/Auto; `repairJson` follows provider; `deepseek_429` diagnosis tag
- Admin Generate provider labels live; cost uses off-peak rates; docs + `.env.example`

## Deploy

```bash
supabase functions deploy generate-worker
```

## Out of scope

- Off-peak calendar (Plan 02)
- Concurrency > 8 / server drain (Plan 03)
- Critic-worker on DeepSeek

