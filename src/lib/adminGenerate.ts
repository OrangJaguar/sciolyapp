import { supabase } from './supabase'

export type GenerationPassMode = 'A_only' | 'A_then_B' | 'top_up'
export type GenerationMode =
  | 'fill_season'
  | 'fill_event'
  | 'top_up'
  | 'workbench'
export type GenerationProvider = 'nim' | 'deepseek_flash' | 'deepseek_pro' | 'auto'

export type GenerationWindowConfig = {
  enabled: boolean
  tz: string
  start: string
  end: string
}

export type GenerationJobConfig = {
  mode: GenerationMode
  eventIds?: string[]
  conceptIds?: string[]
  targetPerConcept: number
  questionsPerCall: number
  passMode: GenerationPassMode
  difficultyMix: { easy: number; medium: number; hard: number }
  provider: GenerationProvider
  includeGuide: boolean
  includeMedia: boolean
  fillGap?: boolean
  /** Blank / undefined / 0 = all gap concepts (campaign season default). */
  limitConcepts?: number
  /** Parallel NIM calls while draining a job (default 3). Claim stays A→B ordered. */
  concurrency?: number
  window: GenerationWindowConfig
}

export type GenerationBlocker = {
  type: string
  message: string
  event_id?: string
}

export type GenerationPreview = {
  blockers: GenerationBlocker[]
  events: Array<{ id: string; name: string }>
  concept_count: number
  request_count: number
  question_count: number
  eta_minutes: number
  /** Concepts already at/above target that were skipped while filling the limit. */
  skipped_full?: number
  scanned?: number
  /** Q slots reserved by paused/running job items (not rows in questions). */
  inflight_reserved?: number
  items: Array<{
    event_id: string
    concept_id: string
    concept_name: string
    pass: string
    n_requested: number
    coverage_before: number
    questions_before?: number
    inflight_before?: number
  }>
}

export type GenerationJob = {
  id: string
  kind: 'campaign' | 'workbench'
  status: 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled'
  pause_reason: string | null
  config: GenerationJobConfig
  items_total: number
  items_done: number
  items_failed: number
  items_partial: number
  questions_written: number
  blockers: GenerationBlocker[]
  token_usage: Record<string, number>
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export type GenerationJobItem = {
  id: string
  job_id: string
  event_id: string
  concept_id: string
  pass: 'A' | 'B' | 'C'
  n_requested: number
  n_outstanding: number
  n_written: number
  n_rejected: number
  shortfall_retries: number
  status: 'queued' | 'running' | 'done' | 'failed' | 'skipped' | 'partial'
  error: string | null
  raw_excerpt: string | null
  finish_reason: string | null
  diagnosis: string | null
  token_usage: Record<string, number>
  created_at: string
  started_at: string | null
  last_claimed_at: string | null
  finished_at: string | null
}

export type WorkerTickResult = {
  processed?: boolean
  done?: boolean
  paused?: boolean
  outsideWindow?: boolean
  failed?: boolean
  idle?: boolean
  written?: number
  rejected?: number
  error?: string
  itemId?: string
  status?: string
  reason?: string
  finishReason?: string | null
  usage?: Record<string, number>
  truncated?: boolean
  requeued?: boolean
  partial?: boolean
  need?: number
  cumulativeWritten?: number
  outstanding?: number
  rejectSamples?: string[]
}

export const DEFAULT_GENERATION_CONFIG: GenerationJobConfig = {
  mode: 'fill_event',
  eventIds: ['chem_lab'],
  targetPerConcept: 30,
  questionsPerCall: 8,
  passMode: 'A_then_B',
  difficultyMix: { easy: 20, medium: 50, hard: 30 },
  provider: 'nim',
  includeGuide: true,
  includeMedia: true,
  fillGap: true,
  // undefined = all concepts below target (season GO)
  limitConcepts: undefined,
  concurrency: 3,
  window: {
    enabled: false,
    tz: 'America/Chicago',
    start: '08:00',
    end: '22:00',
  },
}

export const GENERATION_CONCURRENCY_MIN = 1
export const GENERATION_CONCURRENCY_MAX = 8

export function clampConcurrency(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 3
  return Math.min(
    GENERATION_CONCURRENCY_MAX,
    Math.max(GENERATION_CONCURRENCY_MIN, Math.round(n)),
  )
}

/** Strip limitConcepts from RPC payload when blank so SQL treats as unlimited. */
export function serializeGenerationConfig(
  config: GenerationJobConfig,
): GenerationJobConfig {
  const next = { ...config }
  if (next.limitConcepts == null || next.limitConcepts <= 0) {
    delete next.limitConcepts
  }
  return next
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

export async function previewGeneration(
  config: GenerationJobConfig,
): Promise<GenerationPreview> {
  const { data, error } = await requireSupabase().rpc('admin_preview_generation', {
    p_config: serializeGenerationConfig(config),
  })
  if (error) throw error
  return data as GenerationPreview
}

export async function createGenerationJob(
  config: GenerationJobConfig,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc('admin_create_generation_job', {
    p_config: serializeGenerationConfig(config),
  })
  if (error) throw error
  return data as string
}

export async function fetchGenerationJobs(): Promise<GenerationJob[]> {
  const { data, error } = await requireSupabase()
    .from('generation_jobs')
    .select(
      'id, kind, status, pause_reason, config, items_total, items_done, items_failed, items_partial, questions_written, blockers, token_usage, created_at, started_at, finished_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...(row as GenerationJob),
    items_partial: Number((row as GenerationJob).items_partial ?? 0),
    token_usage: ((row as GenerationJob).token_usage ?? {}) as Record<string, number>,
  }))
}

export async function fetchGenerationJobItems(
  jobId: string,
): Promise<GenerationJobItem[]> {
  const { data, error } = await requireSupabase()
    .from('generation_job_items')
    .select(
      'id, job_id, event_id, concept_id, pass, n_requested, n_outstanding, n_written, n_rejected, shortfall_retries, status, error, raw_excerpt, finish_reason, diagnosis, token_usage, created_at, started_at, last_claimed_at, finished_at',
    )
    .eq('job_id', jobId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => {
    const item = row as GenerationJobItem
    return {
      ...item,
      n_outstanding: Number(item.n_outstanding ?? 0),
      shortfall_retries: Number(item.shortfall_retries ?? 0),
      finish_reason: item.finish_reason ?? null,
      token_usage: (item.token_usage ?? {}) as Record<string, number>,
    }
  })
}

export async function setGenerationJobStatus(
  jobId: string,
  status: GenerationJob['status'],
  pauseReason?: string,
) {
  const { error } = await requireSupabase().rpc('admin_generation_set_job_status', {
    p_job_id: jobId,
    p_status: status,
    p_pause_reason: pauseReason ?? null,
  })
  if (error) throw error
}

export async function deleteGenerationJob(jobId: string) {
  const { error } = await requireSupabase().rpc('admin_delete_generation_job', {
    p_job_id: jobId,
  })
  if (error) throw error
}

export async function clearIncompleteGeneration(): Promise<{
  jobs_cancelled: number
  items_cleared: number
  orphan_fingerprints_deleted?: number
}> {
  const { data, error } = await requireSupabase().rpc(
    'admin_clear_incomplete_generation',
  )
  if (error) throw error
  const row = (data ?? {}) as Record<string, number | string>
  return {
    jobs_cancelled: Number(row.jobs_cancelled ?? 0),
    items_cleared: Number(row.items_cleared ?? 0),
    orphan_fingerprints_deleted: Number(row.orphan_fingerprints_deleted ?? 0),
  }
}

export async function recoverStaleGenerationItems(
  jobId?: string,
  staleSeconds = 240,
): Promise<{ recovered: number; stale_seconds: number }> {
  const { data, error } = await requireSupabase().rpc(
    'admin_generation_recover_stale_items',
    {
      p_job_id: jobId ?? null,
      p_stale_seconds: staleSeconds,
    },
  )
  if (error) throw error
  const row = (data ?? {}) as Record<string, number>
  return {
    recovered: Number(row.recovered ?? 0),
    stale_seconds: Number(row.stale_seconds ?? staleSeconds),
  }
}

export function diagnoseGenerationItem(item: GenerationJobItem): string | null {
  if (item.diagnosis) return item.diagnosis
  if (item.status === 'running') {
    const claimed = item.last_claimed_at ?? item.started_at
    if (claimed) {
      const ageSec = (Date.now() - new Date(claimed).getTime()) / 1000
      if (ageSec > 240) return 'stale_suspected'
    }
    return 'running'
  }
  if (item.error?.includes('Shortfall')) return 'shortfall'
  if (item.finish_reason === 'length') return 'truncated'
  if (/timeout/i.test(item.error ?? '')) return 'nim_timeout'
  return null
}

export function formatRunningAge(item: GenerationJobItem): string | null {
  if (item.status !== 'running') return null
  const claimed = item.last_claimed_at ?? item.started_at
  if (!claimed) return 'running'
  const ageSec = Math.max(0, Math.floor((Date.now() - new Date(claimed).getTime()) / 1000))
  if (ageSec < 60) return `running ${ageSec}s`
  return `running ${Math.floor(ageSec / 60)}m ${ageSec % 60}s`
}

export async function retryFailedGenerationItems(jobId: string) {
  const { data, error } = await requireSupabase().rpc(
    'admin_generation_retry_incomplete',
    { p_job_id: jobId },
  )
  if (error) throw error
  return Number(data ?? 0)
}

export async function invokeGenerateWorker(
  jobId: string,
): Promise<WorkerTickResult> {
  const { data, error } = await requireSupabase().functions.invoke('generate-worker', {
    body: { jobId },
  })

  if (error) {
    const msg = error.message ?? 'Edge function invoke failed'
    if (/Failed to send a request to the Edge Function|FunctionsFetchError|Failed to fetch|404|not found/i.test(msg)) {
      throw new Error(
        'generate-worker is not deployed (or not reachable). Run: supabase login && supabase link --project-ref ormtobpwgmmeanqctduz && supabase functions deploy generate-worker — then set NVIDIA_NIM_* secrets in Supabase → Edge Functions → Secrets.',
      )
    }
    if (/NVIDIA_NIM_API_KEY|401|403|FunctionsRelayError/i.test(msg)) {
      throw new Error(
        `${msg} — set NVIDIA_NIM_* secrets in Supabase → Edge Functions → Secrets`,
      )
    }
    throw new Error(msg)
  }

  return (data ?? {}) as WorkerTickResult
}

export type ParallelDrainBatch = {
  ticks: WorkerTickResult[]
  errors: string[]
  anyProcessed: boolean
  allOutsideWindow: boolean
  paused: boolean
  finished: boolean
}

/** Fire up to `concurrency` worker ticks in parallel (SKIP LOCKED claims). */
export async function invokeGenerateWorkerBatch(
  jobId: string,
  concurrency: number,
): Promise<ParallelDrainBatch> {
  // Unstick zombies before draining (also happens inside claim SQL)
  try {
    await recoverStaleGenerationItems(jobId, 240)
  } catch {
    // non-fatal if migration not applied yet
  }

  const n = clampConcurrency(concurrency)
  const settled = await Promise.allSettled(
    Array.from({ length: n }, () => invokeGenerateWorker(jobId)),
  )

  const ticks: WorkerTickResult[] = []
  const errors: string[] = []

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      ticks.push(result.value)
    } else {
      const reason = result.reason
      errors.push(
        reason instanceof Error ? reason.message : 'Worker invoke failed',
      )
    }
  }

  const anyProcessed = ticks.some((t) => t.processed)
  const paused = ticks.some((t) => t.paused) && !anyProcessed
  const allOutsideWindow =
    ticks.length > 0 && ticks.every((t) => t.outsideWindow)
  // Job is finished only when every tick reports done/paused and none worked.
  // Idle ticks (parallel pool, siblings still running) must NOT end the drain.
  const finished =
    errors.length === 0 &&
    !anyProcessed &&
    ticks.length > 0 &&
    ticks.every((t) => t.done || t.paused) &&
    !ticks.some((t) => t.idle) &&
    !allOutsideWindow

  return {
    ticks,
    errors,
    anyProcessed,
    allOutsideWindow,
    paused,
    finished,
  }
}

export function summarizeWorkerBatch(
  batch: ParallelDrainBatch,
  requestedConcurrency: number,
): string {
  const processed = batch.ticks.filter((t) => t.processed)
  const idle = batch.ticks.filter((t) => t.idle || (t.done && !t.processed)).length
  const n = clampConcurrency(requestedConcurrency)

  if (batch.errors.length > 0 && processed.length === 0) {
    return batch.errors[0] ?? 'Worker batch failed'
  }

  if (batch.allOutsideWindow) return 'Outside run window — waiting 60s'
  if (batch.paused) return 'Job paused'
  if (batch.finished) return 'Job finished'

  if (processed.length === 0) {
    return batch.errors[0] ?? 'Waiting for queue…'
  }

  const written = processed.reduce((sum, t) => sum + (t.written ?? 0), 0)
  const rejected = processed.reduce((sum, t) => sum + (t.rejected ?? 0), 0)
  const requeued = processed.filter((t) => t.requeued).length
  const partial = processed.filter((t) => t.partial).length
  const truncated = processed.filter((t) => t.truncated).length

  const bits = [
    `×${n} pool`,
    `claimed ${processed.length}`,
    idle > 0 ? `${idle} idle` : null,
    `wrote ${written}`,
    rejected ? `${rejected} rejected` : null,
    requeued ? `${requeued} shortfall requeued` : null,
    partial ? `${partial} partial` : null,
    truncated ? `${truncated} hit max_tokens` : null,
    batch.errors.length ? `${batch.errors.length} invoke error(s)` : null,
  ].filter(Boolean)

  return bits.join(' · ')
}

export function estimatePaidUsd(preview: GenerationPreview, provider: GenerationProvider) {
  if (provider === 'nim') return null
  const requests = preview.request_count
  // Short explanations ~200 tokens/Q after Plan 27 packs
  const outputTokens = preview.question_count * 200
  const inputTokens = requests * 6000
  const outputRate = provider === 'deepseek_pro' ? 1.98 : 0.66
  const inputRate = provider === 'deepseek_pro' ? 0.66 : 0.22
  return ((inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate)
}

export function jobProgress(job: GenerationJob): number {
  if (job.items_total <= 0) return 0
  const terminal =
    job.items_done + job.items_failed + (job.items_partial ?? 0)
  return Math.round((terminal / job.items_total) * 100)
}

export function formatTokenUsage(usage: Record<string, number> | null | undefined) {
  if (!usage) return null
  const prompt = usage.prompt_tokens ?? usage.input_tokens
  const completion = usage.completion_tokens ?? usage.output_tokens
  const total = usage.total_tokens
  if (prompt == null && completion == null && total == null) return null
  if (prompt != null && completion != null) {
    return `${prompt} in / ${completion} out`
  }
  if (total != null) return `${total} total`
  return null
}

/** One-line human summary for Recent jobs list. */
export function describeGenerationJob(
  job: GenerationJob,
  eventNameById?: Map<string, string>,
): { title: string; detail: string } {
  const config = job.config ?? ({} as GenerationJobConfig)
  const mode = config.mode ?? 'fill_event'
  const eventIds = config.eventIds ?? []
  const eventLabel =
    mode === 'fill_season'
      ? 'All studyable'
      : eventIds.length === 0
        ? '—'
        : eventIds
            .map((id) => eventNameById?.get(id) ?? id)
            .join(', ')

  const passDivisor = 2
  const conceptEstimate = Math.max(
    1,
    Math.round(job.items_total / Math.max(passDivisor, 1)),
  )
  const limit =
    config.limitConcepts != null && config.limitConcepts > 0
      ? `max ${config.limitConcepts}`
      : `${conceptEstimate} concepts`

  const title =
    mode === 'workbench'
      ? `Workbench · ${eventLabel}`
      : mode === 'fill_season'
        ? 'Fill season'
        : mode === 'top_up'
          ? `Top-up · ${eventLabel}`
          : `Fill · ${eventLabel}`

  const detail = [
    mode === 'workbench' && (config.conceptIds?.length ?? 0) > 0
      ? `${config.conceptIds!.length} picked`
      : limit,
    `${config.questionsPerCall ?? 8}/call`,
    `×${clampConcurrency(config.concurrency ?? 3)}`,
    `target ${config.targetPerConcept ?? 30}`,
    `${job.questions_written} drafts`,
    `${jobProgress(job)}%`,
  ].join(' · ')

  return { title, detail }
}

/** Wall-clock ETA from request count + concurrency (NIM ~45–90s/call). */
export function estimateEtaMinutes(
  requestCount: number,
  concurrency = 3,
  secondsPerCall = 60,
): number {
  const c = clampConcurrency(concurrency)
  if (requestCount <= 0) return 0
  return Math.max(1, Math.ceil((requestCount * secondsPerCall) / c / 60))
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
