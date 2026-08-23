import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  callNim,
  callNimVision,
  createUserClient,
  extractJsonObject,
  type VisionImage,
} from '../_shared/generation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type ConceptRow = { id: string; name: string; topic: string }

type Trace = {
  checkpoints: Array<{ at: string; t: number; detail?: string }>
  model: string
  systemChars: number
  userChars: number
  criteriaRawChars: number
  criteriaSlimChars: number
  conceptListChars: number
  visionSystemChars: number
  visionUserChars: number
  scoreSystemChars: number
  scoreUserChars: number
  twoPhase: boolean
  conceptCount: number
  imageCount: number
  imageBytes: number[]
  frontUrl: string
  backUrl: string | null
  nimMs: number | null
  nimVisionMs: number | null
  nimScoreMs: number | null
  rawExcerpt: string | null
  error: string | null
}

type UserClient = ReturnType<typeof createUserClient>

const VISION_SYSTEM = `You read Science Olympiad binder cheat-sheet photos. OCR may be noisy; describe ONLY what is visible.

Return one JSON object (no markdown):
{
  "status": "ok" | "rejected" | "low_confidence",
  "reject_reason": string | null,
  "page_observations": string,
  "seen_concept_ids": string[],
  "confidence": number
}

Rules:
- page_observations: detailed bullets of visible headings, equations, tables, diagrams, regions (front/back).
- seen_concept_ids: ONLY ids from the checklist that are clearly addressed on the page.
- rejected + reject_reason for blank, wrong subject, unreadable, or non-notes.
- low_confidence if handwriting is messy but partially readable.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const t0 = Date.now()
  const trace: Trace = {
    checkpoints: [],
    model: Deno.env.get('NVIDIA_NIM_VISION_MODEL') ?? 'minimaxai/minimax-m3',
    systemChars: 0,
    userChars: 0,
    criteriaRawChars: 0,
    criteriaSlimChars: 0,
    conceptListChars: 0,
    visionSystemChars: 0,
    visionUserChars: 0,
    scoreSystemChars: 0,
    scoreUserChars: 0,
    twoPhase: true,
    conceptCount: 0,
    imageCount: 0,
    imageBytes: [],
    frontUrl: '',
    backUrl: null,
    nimMs: null,
    nimVisionMs: null,
    nimScoreMs: null,
    rawExcerpt: null,
    error: null,
  }

  const mark = (at: string, detail?: string) => {
    trace.checkpoints.push({ at, t: Date.now() - t0, detail })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header', trace }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const eventId = String(body.eventId ?? '').trim()
    const frontPath = String(body.frontPath ?? '').trim()
    const backPath = body.backPath ? String(body.backPath).trim() : ''
    let rowId = body.auditId ? String(body.auditId).trim() : ''

    if (!eventId || !frontPath) {
      return json({ error: 'eventId and frontPath required', trace }, 400)
    }

    mark('auth')
    const supabase = createUserClient(authHeader)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Unauthorized', trace }, 401)
    }

    if (!frontPath.startsWith(`${user.id}/`)) {
      return json({ error: 'Invalid front path', trace }, 403)
    }
    if (backPath && !backPath.startsWith(`${user.id}/`)) {
      return json({ error: 'Invalid back path', trace }, 403)
    }

    mark('load_catalog')
    const [
      { data: master },
      { data: eventPack },
      { data: event },
      conceptsRes,
      topicsRes,
    ] = await Promise.all([
      supabase
        .from('prompt_packs')
        .select('system_body')
        .eq('id', 'binder_master')
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('prompt_packs')
        .select('binder_criteria')
        .eq('id', `event:${eventId}`)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('taxonomy_events')
        .select('id, name, studyable')
        .eq('id', eventId)
        .maybeSingle(),
      supabase
        .from('taxonomy_concepts')
        .select('id, name, topic_id')
        .eq('event_id', eventId)
        .order('sort_order'),
      supabase
        .from('taxonomy_topics')
        .select('id, name')
        .eq('event_id', eventId),
    ])

    if (!event?.id || !event.studyable) {
      return json({ error: 'Event not found or not studyable', trace }, 400)
    }
    if (conceptsRes.error) {
      return json({ error: conceptsRes.error.message, trace }, 500)
    }

    const topicName = new Map(
      ((topicsRes.data ?? []) as Array<{ id: string; name: string }>).map(
        (t) => [t.id, t.name],
      ),
    )

    const concepts: ConceptRow[] = (
      (conceptsRes.data ?? []) as Array<{
        id: string
        name: string
        topic_id: string
      }>
    ).map((c) => ({
      id: c.id,
      name: c.name,
      topic: topicName.get(c.topic_id) ?? c.topic_id,
    }))

    trace.conceptCount = concepts.length
    if (concepts.length === 0) {
      return json({ error: 'No concepts for this event', trace }, 400)
    }

    const masterBody = String(master?.system_body ?? '').trim()
    const criteriaRaw = String(
      (eventPack as { binder_criteria?: string } | null)?.binder_criteria ?? '',
    ).trim()

    if (!masterBody) {
      return json(
        {
          error: 'Binder Master Critic pack is empty — author it in Catalog',
          trace,
        },
        400,
      )
    }

    const criteriaSlim = slimEventCriteria(criteriaRaw)
    const conceptList = formatConceptChecklist(concepts)

    trace.criteriaRawChars = criteriaRaw.length
    trace.criteriaSlimChars = criteriaSlim.length
    trace.conceptListChars = conceptList.length

    const visionUserText = [
      `Event: ${event.name}`,
      backPath
        ? 'Images: FRONT then BACK of the cheat sheet.'
        : 'Image: FRONT only.',
      'Concept checklist (id|name by topic):',
      conceptList,
      'Describe visible content; list seen_concept_ids from this checklist only.',
    ].join('\n\n')

    const scoreSystemPrompt = [
      masterBody,
      criteriaSlim
        ? `\n\n--- EVENT CRITERIA (${event.name}, abbreviated) ---\n${criteriaSlim}`
        : `\n\n--- EVENT ---\n${event.name}`,
    ].join('')

    const scoreUserText = [
      `Score this ${event.name} binder audit using ONLY the vision observations below (do not invent content).`,
      'Concept checklist (id|name by topic):',
      conceptList,
      'Return the full Binder Master JSON schema.',
      'IMPORTANT: overall_score is 0–100 (not 1–5). Convert each 1–5 subscore with (score−1)×25, then apply the weighted formula from the Master contract.',
    ].join('\n\n')

    trace.visionSystemChars = VISION_SYSTEM.length
    trace.visionUserChars = visionUserText.length
    trace.scoreSystemChars = scoreSystemPrompt.length
    trace.scoreUserChars = scoreUserText.length
    trace.systemChars = trace.visionSystemChars + trace.scoreSystemChars
    trace.userChars = trace.visionUserChars + trace.scoreUserChars
    trace.frontUrl = publicUrl(frontPath)
    trace.backUrl = backPath ? publicUrl(backPath) : null

    mark('ensure_audit_row')
    if (!rowId) {
      const { data: inserted, error: insErr } = await supabase
        .from('binder_audits')
        .insert({
          user_id: user.id,
          event_id: eventId,
          front_path: frontPath,
          back_path: backPath || null,
          status: 'pending',
          model: trace.model,
          result: { _trace: trace },
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        return json(
          { error: insErr?.message ?? 'Failed to create audit', trace },
          500,
        )
      }
      rowId = inserted.id as string
    } else {
      await supabase
        .from('binder_audits')
        .update({
          status: 'pending',
          model: trace.model,
          result: { _trace: trace },
          error: null,
        })
        .eq('id', rowId)
        .eq('user_id', user.id)
    }

    const persistTrace = async (extra?: Record<string, unknown>) => {
      await supabase
        .from('binder_audits')
        .update({
          result: { _trace: trace, ...extra },
        })
        .eq('id', rowId)
        .eq('user_id', user.id)
    }

    mark('run_sync')
    await persistTrace()

    await runVisionJob({
      supabase,
      userId: user.id,
      rowId,
      frontPath,
      backPath,
      visionSystem: VISION_SYSTEM,
      visionUserText,
      scoreSystemPrompt,
      scoreUserText,
      conceptCount: concepts.length,
      trace,
      mark,
      persistTrace,
    })

    const { data: row } = await supabase
      .from('binder_audits')
      .select('status, overall_score, result, error')
      .eq('id', rowId)
      .maybeSingle()

    if (row?.error || row?.status === 'error') {
      return json(
        {
          error: row.error ?? 'Audit failed',
          auditId: rowId,
          status: 'error',
          result: row.result,
          trace,
          async: false,
        },
        500,
      )
    }

    return json({
      auditId: rowId,
      status: row?.status ?? 'ok',
      overall_score: row?.overall_score ?? null,
      result: row?.result ?? {},
      concept_count: concepts.length,
      trace,
      async: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    trace.error = message
    mark('fatal', message)
    return json({ error: message, trace }, 500)
  }
})

async function runVisionJob(input: {
  supabase: UserClient
  userId: string
  rowId: string
  frontPath: string
  backPath: string
  visionSystem: string
  visionUserText: string
  scoreSystemPrompt: string
  scoreUserText: string
  conceptCount: number
  trace: Trace
  mark: (at: string, detail?: string) => void
  persistTrace: (extra?: Record<string, unknown>) => Promise<void>
}) {
  const {
    supabase,
    userId,
    rowId,
    frontPath,
    backPath,
    visionSystem,
    visionUserText,
    scoreSystemPrompt,
    scoreUserText,
    trace,
    mark,
    persistTrace,
  } = input

  try {
    mark('download_images')
    await persistTrace()

    const images: VisionImage[] = []
    try {
      const front = await downloadAsBase64(supabase, frontPath)
      images.push(front.image)
      trace.imageBytes.push(front.bytes)
      if (backPath) {
        const back = await downloadAsBase64(supabase, backPath)
        images.push(back.image)
        trace.imageBytes.push(back.bytes)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      trace.error = message
      mark('download_failed', message)
      await supabase
        .from('binder_audits')
        .update({
          status: 'error',
          error: message.slice(0, 800),
          result: { _trace: trace },
        })
        .eq('id', rowId)
        .eq('user_id', userId)
      return
    }

    trace.imageCount = images.length

    // Phase 1: vision-only read (small prompt + images → fast on NIM)
    mark('call_nim_vision', `model=${trace.model} imgs=${images.length}`)
    await persistTrace()

    const visionStart = Date.now()
    const { content: visionRaw, usage: visionUsage } = await callNimVision(
      visionSystem,
      visionUserText,
      images,
      { maxTokens: 2048 },
    )
    trace.nimVisionMs = Date.now() - visionStart
    mark('nim_vision_ok', `${trace.nimVisionMs}ms`)
    await persistTrace()

    const vision = extractJsonObject(visionRaw) as Record<string, unknown>
    const visionStatus = normalizeStatus(vision.status)

    if (visionStatus === 'rejected') {
      const rejectReason = String(
        vision.reject_reason ?? 'Page rejected',
      ).slice(0, 500)
      const parsed = {
        status: 'rejected',
        reject_reason: rejectReason,
        overall_score: 0,
        scores: {
          coverage: 1,
          density: 1,
          accuracy_risk: 1,
          test_readiness: 1,
          structure: 1,
          visuals: 1,
        },
        summary: String(vision.page_observations ?? rejectReason).slice(
          0,
          1200,
        ),
        strengths: [] as string[],
        gaps: [] as unknown[],
        fixes: [] as unknown[],
        seen_concepts: Array.isArray(vision.seen_concept_ids)
          ? vision.seen_concept_ids.map(String)
          : [],
        confidence: Number(vision.confidence) || 0,
      }
      mark('done')
      await supabase
        .from('binder_audits')
        .update({
          status: 'rejected',
          overall_score: 0,
          result: {
            ...parsed,
            _vision: vision,
            _usage: visionUsage,
            _trace: trace,
          },
          model: trace.model,
          error: null,
        })
        .eq('id', rowId)
        .eq('user_id', userId)
      return
    }

    // Phase 2: text scorecard from observations (no images — much faster)
    const scoreUserWithVision = [
      scoreUserText,
      '--- VISION OBSERVATIONS (authoritative; do not invent beyond this) ---',
      JSON.stringify({
        status: visionStatus,
        page_observations: vision.page_observations ?? '',
        seen_concept_ids: vision.seen_concept_ids ?? [],
        confidence: vision.confidence ?? null,
      }),
    ].join('\n\n')

    mark('call_nim_score', 'text-only scorecard')
    await persistTrace()

    const scoreStart = Date.now()
    const { content: scoreRaw, usage: scoreUsage } = await callNim(
      scoreSystemPrompt,
      scoreUserWithVision,
      false,
    )
    trace.nimScoreMs = Date.now() - scoreStart
    trace.nimMs = (trace.nimVisionMs ?? 0) + trace.nimScoreMs
    trace.rawExcerpt = scoreRaw.slice(0, 1200)
    mark('nim_score_ok', `${trace.nimScoreMs}ms`)

    const parsed = extractJsonObject(scoreRaw) as Record<string, unknown>
    mark('parse_json')
    const status = normalizeStatus(parsed.status ?? visionStatus)
    const scores = parsed.scores as Record<string, unknown> | undefined
    const computed = scores ? computeOverallScore(scores) : null
    const modelOverall = Number(parsed.overall_score)
    const score =
      computed !== null
        ? computed
        : Number.isFinite(modelOverall)
          ? normalizeOverallScore(modelOverall, scores)
          : null

    if (score !== null) {
      parsed.overall_score = score
      if (
        Number.isFinite(modelOverall) &&
        Math.abs(modelOverall - score) > 2
      ) {
        parsed._model_overall_score = modelOverall
      }
    }

    mark('done')
    await supabase
      .from('binder_audits')
      .update({
        status,
        overall_score: score,
        result: {
          ...parsed,
          _vision: vision,
          _usage: { vision: visionUsage, score: scoreUsage },
          _trace: trace,
        },
        model: trace.model,
        error: null,
      })
      .eq('id', rowId)
      .eq('user_id', userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    trace.error = message
    mark('nim_or_parse_failed', message)
    await supabase
      .from('binder_audits')
      .update({
        status: 'error',
        error: message.slice(0, 800),
        result: { _trace: trace },
      })
      .eq('id', rowId)
      .eq('user_id', userId)
  }
}

/** Compact checklist — much smaller than JSON.stringify(63 concepts). */
function formatConceptChecklist(concepts: ConceptRow[]): string {
  const byTopic = new Map<string, ConceptRow[]>()
  for (const c of concepts) {
    const list = byTopic.get(c.topic) ?? []
    list.push(c)
    byTopic.set(c.topic, list)
  }
  const lines: string[] = []
  for (const [topic, rows] of byTopic) {
    lines.push(`[${topic}]`)
    for (const r of rows) {
      lines.push(`${r.id}|${r.name}`)
    }
  }
  return lines.join('\n')
}

/** Keep bullet highlights from Catalog criteria; drop prose bloat for API. */
function slimEventCriteria(raw: string): string {
  if (!raw.trim()) return ''
  const maxChars = Number(Deno.env.get('BINDER_CRITERIA_MAX_CHARS') ?? 1800)
  const bullets = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*•]|\d+\./.test(l) || l.startsWith('**'))
    .map((l) => l.replace(/\*\*/g, ''))
  const picked: string[] = []
  let len = 0
  for (const line of bullets) {
    if (len + line.length + 1 > maxChars) break
    picked.push(line.startsWith('-') ? line : `- ${line}`)
    len += line.length + 1
  }
  if (picked.length === 0) {
    return raw.replace(/\s+/g, ' ').slice(0, maxChars)
  }
  const suffix =
    raw.length > maxChars
      ? '\n(Full event criteria live in Catalog; this is an abbreviated API excerpt.)'
      : ''
  return picked.join('\n') + suffix
}

function publicUrl(path: string): string {
  const base = Deno.env.get('SUPABASE_URL') ?? ''
  return `${base}/storage/v1/object/public/binder-notes/${path}`
}

async function downloadAsBase64(
  supabase: UserClient,
  path: string,
): Promise<{ image: VisionImage; bytes: number }> {
  const { data, error } = await supabase.storage
    .from('binder-notes')
    .download(path)
  if (error || !data) {
    throw new Error(
      `Storage download failed for ${path}: ${error?.message ?? 'empty'}`,
    )
  }
  const buf = new Uint8Array(await data.arrayBuffer())
  const mime =
    data.type && data.type.startsWith('image/')
      ? data.type
      : path.endsWith('.png')
        ? 'image/png'
        : path.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'
  return {
    image: { kind: 'base64', mimeType: mime, data: bytesToBase64(buf) },
    bytes: buf.byteLength,
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function normalizeStatus(raw: unknown): string {
  const s = String(raw ?? 'ok').toLowerCase()
  if (s === 'rejected' || s === 'low_confidence' || s === 'ok') return s
  return 'ok'
}

const SCORE_WEIGHTS: Record<string, number> = {
  coverage: 0.3,
  test_readiness: 0.25,
  accuracy_risk: 0.2,
  structure: 0.1,
  density: 0.1,
  visuals: 0.05,
}

function clamp15(n: number): number {
  return Math.max(1, Math.min(5, n))
}

/** Master contract: (score−1)×25 per dimension, then weighted sum → 0–100. */
function computeOverallScore(scores: Record<string, unknown>): number | null {
  let total = 0
  let weightSum = 0
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const raw = Number(scores[key])
    if (!Number.isFinite(raw)) continue
    const pct = (clamp15(raw) - 1) * 25
    total += weight * pct
    weightSum += weight
  }
  if (weightSum < 0.99) return null
  return Math.round(Math.max(0, Math.min(100, total)))
}

/** If model returned 1–5 scale by mistake, map to 0–100. */
function normalizeOverallScore(
  raw: number,
  scores?: Record<string, unknown>,
): number {
  if (raw > 0 && raw <= 5 && scores) {
    const fromScores = computeOverallScore(scores)
    if (fromScores !== null) return fromScores
    return Math.round((raw - 1) * 25)
  }
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
