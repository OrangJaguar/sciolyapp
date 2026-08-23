import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  buildSystemPrompt,
  buildUserPrompt,
  callNim,
  createUserClient,
  emitCount,
  extractJsonArray,
  isInsideRunWindow,
  parseMcq,
  repairJson,
  type GenerationContext,
  type ParsedMcq,
} from '../_shared/generation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RAW_STORE_CAP = 200_000

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let claimedItemId: string | null = null
  let supabase: ReturnType<typeof createUserClient> | null = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const jobId = body.jobId as string | undefined
    if (!jobId) {
      return json({ error: 'jobId is required' }, 400)
    }

    supabase = createUserClient(authHeader)

    const { data: jobRow, error: jobError } = await supabase
      .from('generation_jobs')
      .select('id, status, config, pause_reason')
      .eq('id', jobId)
      .single()

    if (jobError || !jobRow) {
      return json({ error: jobError?.message ?? 'Job not found' }, 404)
    }

    if (jobRow.status === 'paused') {
      return json({ processed: false, paused: true, reason: jobRow.pause_reason })
    }

    if (jobRow.status === 'cancelled' || jobRow.status === 'done' || jobRow.status === 'failed') {
      return json({ processed: false, done: true, status: jobRow.status })
    }

    const config = (jobRow.config ?? {}) as Record<string, unknown>
    if (!isInsideRunWindow(config)) {
      return json({ processed: false, outsideWindow: true })
    }

    const { data: claimed, error: claimError } = await supabase.rpc(
      'admin_generation_claim_item',
      { p_job_id: jobId },
    )

    if (claimError) {
      return json({ error: claimError.message }, 500)
    }

    if (!claimed) {
      // Parallel pool: empty queue may just mean siblings still hold running items.
      const { data: jobNow } = await supabase
        .from('generation_jobs')
        .select('status')
        .eq('id', jobId)
        .single()

      if (jobNow?.status === 'running') {
        return json({ processed: false, idle: true })
      }

      return json({
        processed: false,
        done: true,
        status: jobNow?.status ?? 'done',
      })
    }

    const item = claimed as { id: string }
    claimedItemId = item.id

    const { data: contextRaw, error: contextError } = await supabase.rpc(
      'admin_generation_get_context',
      { p_item_id: item.id },
    )

    if (contextError || !contextRaw) {
      await failItem(supabase, item.id, {
        error: contextError?.message ?? 'Failed to load generation context',
        diagnosis: 'context_fail',
      })
      return json({ processed: true, failed: true, error: contextError?.message })
    }

    const ctx = contextRaw as GenerationContext
    const systemPrompt = buildSystemPrompt(ctx)
    const userPrompt = buildUserPrompt(ctx)
    const provider = String(config.provider ?? 'nim')
    const usePro = provider === 'deepseek_pro' || provider === 'pro'
    const need = emitCount(ctx)

    let rawContent = ''
    let tokenUsage: Record<string, number> = {}
    let finishReason: string | null = null

    try {
      if (provider.startsWith('deepseek')) {
        throw new Error(
          'Paid DeepSeek provider is not wired yet — use provider=nim for Plan 23 tests',
        )
      }

      const nim = await callNim(systemPrompt, userPrompt, usePro)
      rawContent = nim.content
      tokenUsage = nim.usage
      finishReason = nim.finishReason
    } catch (err) {
      const message = err instanceof Error ? err.message : 'NIM request failed'
      const diagnosis = /timeout|aborted|AbortError/i.test(message)
        ? 'nim_timeout'
        : 'nim_error'
      await failItem(supabase, item.id, {
        error: message,
        finishReason,
        tokenUsage,
        diagnosis,
      })
      return json({
        processed: true,
        failed: true,
        error: message,
        diagnosis,
        finishReason,
        usage: tokenUsage,
      })
    }

    let parsedRows: ParsedMcq[] = []
    let cotRejected = 0
    let schemaRejected = 0
    try {
      let arrayRaw: unknown
      try {
        arrayRaw = extractJsonArray(rawContent)
      } catch (parseErr) {
        const repaired = await repairJson(
          rawContent,
          parseErr instanceof Error ? parseErr.message : 'parse error',
        )
        arrayRaw = extractJsonArray(repaired)
      }

      if (!Array.isArray(arrayRaw)) {
        throw new Error('Model output was not a JSON array')
      }

      for (const row of arrayRaw) {
        const parsed = parseMcq(row)
        if (parsed) {
          parsedRows.push(parsed)
          continue
        }
        if (looksLikeCotDump(row)) cotRejected += 1
        else schemaRejected += 1
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON from model'
      const truncated =
        finishReason === 'length'
          ? ` (finish_reason=length — output hit max_tokens; got partial JSON)`
          : ''
      await failItem(supabase, item.id, {
        error: `${message}${truncated}`,
        rawExcerpt: rawContent.slice(0, RAW_STORE_CAP),
        tokenUsage,
        finishReason,
        diagnosis: finishReason === 'length' ? 'truncated' : 'parse_fail',
      })
      return json({
        processed: true,
        failed: true,
        error: message,
        diagnosis: finishReason === 'length' ? 'truncated' : 'parse_fail',
        finishReason,
        usage: tokenUsage,
      })
    }

    let written = 0
    let rejected = 0
    let dupRejected = 0
    const rejectSamples: string[] = []
    const batchStems = new Set<string>()

    for (const question of parsedRows) {
      const norm = question.stem.toLowerCase().replace(/\s+/g, ' ').trim()
      if (batchStems.has(norm)) {
        rejected += 1
        dupRejected += 1
        if (rejectSamples.length < 3) rejectSamples.push('duplicate in batch')
        continue
      }

      const payload = {
        stem: question.stem,
        options: question.options,
        correct_key: question.correct_key,
        explanation: question.explanation,
        citation: question.citation ?? null,
        difficulty: question.difficulty ?? null,
        media_id: question.media_id ?? null,
      }

      const { error: insertError } = await supabase.rpc(
        'admin_insert_generated_question',
        { p_item_id: item.id, p_question: payload },
      )

      if (insertError) {
        rejected += 1
        const msg = insertError.message ?? 'insert failed'
        if (/duplicate/i.test(msg)) dupRejected += 1
        if (rejectSamples.length < 3) rejectSamples.push(msg)
        continue
      }

      batchStems.add(norm)
      written += 1
    }

    const parseRejected = cotRejected + schemaRejected
    rejected += parseRejected

    const diagnosis = classifyBatchDiagnosis({
      written,
      need,
      finishReason,
      cotRejected,
      dupRejected,
      schemaRejected,
      rejectSamples,
    })

    if (written === 0 && parsedRows.length === 0) {
      const detail =
        rejectSamples.length > 0 ? ` Examples: ${rejectSamples.join(' | ')}` : ''
      await failItem(supabase, item.id, {
        error: `No valid questions parsed (${rejected} rejected; cot=${cotRejected} schema=${schemaRejected}).${detail}`,
        rawExcerpt: rawContent.slice(0, RAW_STORE_CAP),
        tokenUsage,
        finishReason,
        diagnosis: diagnosis ?? 'empty_batch',
      })
      return json({
        processed: true,
        failed: true,
        written: 0,
        rejected,
        error: 'All candidates rejected',
        diagnosis,
        finishReason,
        usage: tokenUsage,
      })
    }

    const { data: completeRaw, error: completeError } = await supabase.rpc(
      'admin_generation_complete_item',
      {
        p_item_id: item.id,
        p_written: written,
        p_rejected: rejected,
        p_raw_excerpt: rawContent.slice(0, RAW_STORE_CAP),
        p_token_usage: tokenUsage,
        p_finish_reason: finishReason,
        p_diagnosis: diagnosis,
      },
    )

    if (completeError) {
      await failItem(supabase, item.id, {
        error: `complete_item failed after writing ${written}: ${completeError.message}`,
        rawExcerpt: rawContent.slice(0, RAW_STORE_CAP),
        tokenUsage,
        finishReason,
        diagnosis: 'complete_fail',
      })
      return json({ error: completeError.message, diagnosis: 'complete_fail' }, 500)
    }

    const complete = (completeRaw ?? {}) as {
      status?: string
      requeued?: boolean
      n_written?: number
      n_outstanding?: number
      diagnosis?: string
    }

    const truncated = finishReason === 'length'
    return json({
      processed: true,
      itemId: item.id,
      written,
      rejected,
      need,
      finishReason,
      usage: tokenUsage,
      truncated,
      requeued: Boolean(complete.requeued),
      partial: complete.status === 'partial',
      status: complete.status ?? null,
      cumulativeWritten: complete.n_written ?? written,
      outstanding: complete.n_outstanding ?? 0,
      diagnosis: complete.diagnosis ?? diagnosis,
      cotRejected,
      dupRejected,
      schemaRejected,
      done: false,
      rejectSamples: rejectSamples.slice(0, 3),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Worker failed'
    if (claimedItemId && supabase) {
      try {
        await failItem(supabase, claimedItemId, {
          error: message,
          diagnosis: 'worker_crash',
        })
      } catch {
        // best-effort — stale reclaim is the backstop
      }
    }
    return json({ error: message, diagnosis: 'worker_crash' }, 500)
  }
})

function looksLikeCotDump(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  const explanation = String((row as Record<string, unknown>).explanation ?? '')
  if (explanation.length > 600) return true
  return /\b(wait,? recalc|let me |i think|error in setup|revised stem|abandon|overcomplicating|start over)\b/i
    .test(explanation)
}

function classifyBatchDiagnosis(args: {
  written: number
  need: number
  finishReason: string | null
  cotRejected: number
  dupRejected: number
  schemaRejected: number
  rejectSamples: string[]
}): string | null {
  if (args.finishReason === 'length') return 'truncated'
  if (args.written >= args.need) return null
  if (args.cotRejected > 0 && args.cotRejected >= args.dupRejected) return 'cot_leak'
  if (args.dupRejected > 0) return 'dup_reject'
  if (args.schemaRejected > 0) return 'schema_reject'
  if (args.written === 0) return 'empty_batch'
  return 'shortfall'
}

async function failItem(
  supabase: ReturnType<typeof createUserClient>,
  itemId: string,
  args: {
    error: string
    rawExcerpt?: string
    tokenUsage?: Record<string, number>
    finishReason?: string | null
    diagnosis?: string
  },
) {
  await supabase.rpc('admin_generation_fail_item', {
    p_item_id: itemId,
    p_error: args.error,
    p_raw_excerpt: args.rawExcerpt ?? null,
    p_token_usage: args.tokenUsage ?? {},
    p_finish_reason: args.finishReason ?? null,
    p_diagnosis: args.diagnosis ?? null,
  })
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
