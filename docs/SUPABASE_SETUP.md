# Supabase setup

1. Create a Supabase project.
2. Copy `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into `.env.local` (see `.env.example`).
3. Auth: disable **Confirm email** for local dev; set Site URL + redirect to `http://localhost:5173`.
4. Schema is already applied on the linked project. For a fresh DB, use Supabase dashboard backups or your own SQL export.

**Edge functions** (deploy from repo root after code changes — secrets alone are not enough):

```bash
supabase functions deploy generate-worker
supabase functions deploy generate-dispatcher
supabase functions deploy critic-worker
supabase functions deploy binder-audit
```

Also run migration `supabase/migrations/20261015_generation_drain_runner.sql` (SQL editor or `supabase db push`) so `is_platform_admin()` accepts `service_role` and `admin_generation_requeue_item` exists.

### Generation drain cron (Plan 03)

Jobs keep draining with the Admin tab closed when `generate-dispatcher` is invoked on a schedule during DeepSeek off-peak.

**Option A — pg_cron + pg_net** (Supabase Dashboard → Database → Extensions: enable `pg_cron` and `pg_net`):

```sql
-- Replace PROJECT_REF and SERVICE_ROLE_KEY
select cron.schedule(
  'generation-dispatcher-drain',
  '* * * * *', -- every minute; dispatcher no-ops outside window / when idle
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/generate-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object('burstCap', 50)
  );
  $$
);
```

**Option B — external cron** (GitHub Actions / Cloudflare Worker) POSTing the same URL with `Authorization: Bearer <service_role>` or header `x-drain-secret: <GENERATION_DRAIN_SECRET>`.

Optional secret: `GENERATION_DRAIN_SECRET` (Edge Function secrets) — if set, cron may auth via `x-drain-secret` instead of the service role bearer. `GENERATION_DISPATCH_BURST` caps launches per job per tick (default 50).

Admin → Generate → Jobs → **Pump dispatcher** for a manual tick. Concurrency caps: Flash **2500**, Pro **500**, NIM **8**. Browser Live boost ≤ **32**.

## Edge Function secrets

Supabase → Project Settings → Edge Functions → Secrets.

### DeepSeek (paid generation — Plan 01+)

| Secret | Required | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | yes for DeepSeek jobs | Also accepts `DEEPSEEK_KEY` |
| `DEEPSEEK_BASE_URL` | no | Default `https://api.deepseek.com` |
| `DEEPSEEK_FLASH_MODEL` | no | Default `deepseek-chat` (override to current Flash id if needed) |
| `DEEPSEEK_PRO_MODEL` | no | Default `deepseek-reasoner` |
| `DEEPSEEK_TIMEOUT_MS` | no | Default `180000` |

Admin → Generate → provider **DeepSeek Flash** / **DeepSeek Pro** / **Auto**.

### NVIDIA NIM (free test + critic / binder vision)

| Secret | Required | Notes |
|---|---|---|
| `NVIDIA_NIM_API_KEY` | yes for NIM jobs | |
| `NVIDIA_NIM_BASE_URL` | no | Default NVIDIA integrate API |
| `NVIDIA_NIM_FLASH_MODEL` | no | |
| `NVIDIA_NIM_PRO_MODEL` | no | |
| `NVIDIA_NIM_VISION_MODEL` | for binder-audit | e.g. MiniMax |
| `NVIDIA_NIM_TIMEOUT_MS` | no | |

Always redeploy `generate-worker` after changing shared generation code under `supabase/functions/`.
