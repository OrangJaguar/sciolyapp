/**
 * Server-side drain pump for generation_jobs.
 * Cron (or admin) invokes this; it fans out generate-worker calls up to each
 * job's config.concurrency while respecting off-peak windows.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  createServiceClient,
  isInsideRunWindow,
} from '../_shared/generation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-drain-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    assertAuthorized(req)

    const body = await req.json().catch(() => ({}))
    const jobIdFilter = typeof body.jobId === 'string' ? body.jobId : null
    const burstCap = clamp(
      Number(body.burstCap ?? Deno.env.get('GENERATION_DISPATCH_BURST') ?? 50),
      1,
      200,
    )

    const supabase = createServiceClient()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Supabase service env missing' }, 500)
    }

    let query = supabase
      .from('generation_jobs')
      .select('id, status, config')
      .in('status', ['running', 'queued'])
      .order('updated_at', { ascending: true })
      .limit(20)

    if (jobIdFilter) {
      query = query.eq('id', jobIdFilter)
    }

    const { data: jobs, error: jobsError } = await query
    if (jobsError) {
      return json({ error: jobsError.message }, 500)
    }

    const summaries: Array<Record<string, unknown>> = []
    let totalLaunched = 0

    for (const job of jobs ?? []) {
      const config = (job.config ?? {}) as Record<string, unknown>
      const provider = String(config.provider ?? 'nim')
      const concurrency = maxConcurrencyForProvider(
        provider,
        Number(config.concurrency ?? 3),
      )

      if (!isInsideRunWindow(config)) {
        summaries.push({
          jobId: job.id,
          launched: 0,
          outsideWindow: true,
          concurrency,
        })
        continue
      }

      const backoffUntil = String(config.drain_backoff_until ?? '')
      if (backoffUntil) {
        const until = Date.parse(backoffUntil)
        if (Number.isFinite(until) && until > Date.now()) {
          summaries.push({
            jobId: job.id,
            launched: 0,
            backoff: true,
            backoffUntil,
            concurrency,
          })
          continue
        }
      }

      // Promote queued → running so claim path is active.
      if (job.status === 'queued') {
        await supabase
          .from('generation_jobs')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .eq('status', 'queued')
      }

      const { count: runningCount } = await supabase
        .from('generation_job_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .eq('status', 'running')

      const { count: queuedCount } = await supabase
        .from('generation_job_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .eq('status', 'queued')

      const running = runningCount ?? 0
      const queued = queuedCount ?? 0
      const need = Math.min(
        Math.max(concurrency - running, 0),
        queued,
        burstCap,
      )

      if (need <= 0) {
        summaries.push({
          jobId: job.id,
          launched: 0,
          running,
          queued,
          concurrency,
          idle: true,
        })
        continue
      }

      const workerUrl = `${supabaseUrl}/functions/v1/generate-worker`
      const settled = await Promise.allSettled(
        Array.from({ length: need }, () =>
          fetch(workerUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId: job.id }),
          }).then(async (res) => {
            const text = await res.text()
            let parsed: Record<string, unknown> = {}
            try {
              parsed = JSON.parse(text) as Record<string, unknown>
            } catch {
              parsed = { raw: text.slice(0, 200) }
            }
            return { ok: res.ok, status: res.status, body: parsed }
          }),
        ),
      )

      let launched = 0
      let rateLimited = 0
      let errors = 0
      for (const result of settled) {
        if (result.status !== 'fulfilled') {
          errors += 1
          continue
        }
        const tick = result.value
        if (!tick.ok) {
          errors += 1
          continue
        }
        const diagnosis = String(tick.body.diagnosis ?? '')
        if (diagnosis === 'deepseek_429' || tick.status === 429) {
          rateLimited += 1
        }
        if (tick.body.processed || tick.body.idle || tick.body.outsideWindow) {
          launched += 1
        } else if (tick.body.done || tick.body.paused) {
          launched += 1
        } else {
          launched += 1
        }
      }

      if (rateLimited >= Math.max(2, Math.floor(need / 2))) {
        await supabase
          .from('generation_jobs')
          .update({
            config: {
              ...config,
              drain_backoff_until: new Date(Date.now() + 45_000).toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
      }

      totalLaunched += launched
      summaries.push({
        jobId: job.id,
        launched,
        running,
        queued,
        concurrency,
        need,
        rateLimited,
        errors,
      })
    }

    return json({
      ok: true,
      jobs: summaries.length,
      totalLaunched,
      summaries,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Dispatcher failed'
    const status = /unauthorized|forbidden|secret/i.test(message) ? 401 : 500
    return json({ error: message }, status)
  }
})

function assertAuthorized(req: Request) {
  const drainSecret = Deno.env.get('GENERATION_DRAIN_SECRET')?.trim()
  const headerSecret = req.headers.get('x-drain-secret')?.trim()
  if (drainSecret && headerSecret && headerSecret === drainSecret) {
    return
  }

  const auth = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (serviceKey && auth === `Bearer ${serviceKey}`) {
    return
  }

  // Platform admin JWT: gateway already verified when verify_jwt=true;
  // still require a bearer so anonymous calls fail closed if JWT verify is off.
  if (auth.startsWith('Bearer ') && auth.length > 20) {
    return
  }

  throw new Error('Unauthorized — pass service role bearer or x-drain-secret')
}

function maxConcurrencyForProvider(provider: string, requested: number): number {
  const p = provider.toLowerCase()
  let max = 8
  if (p === 'deepseek_flash' || p === 'deepseek' || p === 'auto') max = 2500
  else if (p === 'deepseek_pro' || p === 'pro') max = 500
  const n = Number.isFinite(requested) ? Math.round(requested) : 3
  return Math.min(max, Math.max(1, n))
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
