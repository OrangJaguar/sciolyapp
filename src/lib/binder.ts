import { requireSupabase } from './supabase'

export type BinderTrace = {
  checkpoints?: Array<{ at: string; t: number; detail?: string }>
  model?: string
  systemChars?: number
  userChars?: number
  criteriaRawChars?: number
  criteriaSlimChars?: number
  conceptListChars?: number
  visionSystemChars?: number
  visionUserChars?: number
  scoreSystemChars?: number
  scoreUserChars?: number
  twoPhase?: boolean
  conceptCount?: number
  imageCount?: number
  imageBytes?: number[]
  frontUrl?: string
  backUrl?: string | null
  nimMs?: number | null
  nimVisionMs?: number | null
  nimScoreMs?: number | null
  rawExcerpt?: string | null
  error?: string | null
}

export type BinderAuditResult = {
  status?: string
  reject_reason?: string | null
  overall_score?: number
  scores?: Record<string, number>
  summary?: string
  strengths?: string[]
  gaps?: Array<{ concept_id: string; name: string; why: string }>
  fixes?: Array<{ priority: number; action: string; where_on_page: string }>
  seen_concepts?: string[]
  confidence?: number
  _trace?: BinderTrace
}

export type BinderAudit = {
  id: string
  event_id: string
  front_path: string
  back_path: string | null
  status: string
  overall_score: number | null
  result: BinderAuditResult
  model: string
  error: string | null
  created_at: string
}

export type BinderConcept = {
  id: string
  name: string
  topic_id: string
  topic_name: string
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 8 * 1024 * 1024
/** NIM free-tier rejects huge base64 payloads; keep each image well under ~400KB. */
const NIM_MAX_EDGE = 1600
const NIM_JPEG_QUALITY = 0.72
const NIM_TARGET_BYTES = 380_000

export function validateBinderImage(file: File): void {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Use JPEG, PNG, or WebP only')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Each image must be ≤ 8 MB')
  }
}

/** Downscale + JPEG-compress for NIM (phone photos are often 2–5MB each). */
export async function compressBinderImage(file: File): Promise<File> {
  validateBinderImage(file)
  if (typeof createImageBitmap === 'undefined') return file

  const bitmap = await createImageBitmap(file)
  try {
    let { width, height } = bitmap
    const scale = Math.min(1, NIM_MAX_EDGE / Math.max(width, height))
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    let quality = NIM_JPEG_QUALITY
    let blob: Blob | null = await canvasToJpeg(canvas, quality)
    while (blob && blob.size > NIM_TARGET_BYTES && quality > 0.4) {
      quality -= 0.08
      blob = await canvasToJpeg(canvas, quality)
    }
    if (!blob) return file

    // Prefer compressed only when it actually helps
    if (blob.size >= file.size && file.type === 'image/jpeg' && file.size < NIM_TARGET_BYTES) {
      return file
    }

    return new File(
      [blob],
      file.name.replace(/\.\w+$/, '') + '.jpg',
      { type: 'image/jpeg' },
    )
  } finally {
    bitmap.close()
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })
}

export function binderPublicUrl(path: string): string {
  const { data } = requireSupabase().storage.from('binder-notes').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadBinderImage(
  userId: string,
  side: 'front' | 'back',
  file: File,
): Promise<string> {
  const compressed = await compressBinderImage(file)
  const path = `${userId}/${crypto.randomUUID()}-${side}.jpg`
  const { error } = await requireSupabase().storage
    .from('binder-notes')
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

export async function fetchBinderConcepts(
  eventId: string,
): Promise<BinderConcept[]> {
  const db = requireSupabase()
  const [concepts, topics] = await Promise.all([
    db
      .from('taxonomy_concepts')
      .select('id, name, topic_id, sort_order')
      .eq('event_id', eventId)
      .order('sort_order'),
    db.from('taxonomy_topics').select('id, name').eq('event_id', eventId),
  ])
  if (concepts.error) throw concepts.error
  if (topics.error) throw topics.error
  const topicName = new Map(
    (topics.data ?? []).map((t) => [t.id as string, t.name as string]),
  )
  return ((concepts.data ?? []) as Array<{
    id: string
    name: string
    topic_id: string
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    topic_id: c.topic_id,
    topic_name: topicName.get(c.topic_id) ?? c.topic_id,
  }))
}

export async function fetchBinderAudits(eventId?: string): Promise<BinderAudit[]> {
  let q = requireSupabase()
    .from('binder_audits')
    .select(
      'id, event_id, front_path, back_path, status, overall_score, result, model, error, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(30)
  if (eventId) q = q.eq('event_id', eventId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...(row as BinderAudit),
    result: (row.result ?? {}) as BinderAuditResult,
  }))
}

const TERMINAL = new Set(['ok', 'rejected', 'low_confidence', 'error'])

export async function runBinderAudit(input: {
  eventId: string
  frontPath: string
  backPath?: string | null
  auditId?: string
  onTrace?: (trace: BinderTrace) => void
}): Promise<{
  auditId: string
  status: string
  overall_score: number | null
  result: BinderAuditResult
  concept_count: number
  trace?: BinderTrace
}> {
  const { data, error } = await requireSupabase().functions.invoke(
    'binder-audit',
    {
      body: {
        eventId: input.eventId,
        frontPath: input.frontPath,
        backPath: input.backPath || null,
        auditId: input.auditId || null,
      },
    },
  )

  const payload = (data ?? {}) as {
    error?: string
    auditId?: string
    status?: string
    overall_score?: number | null
    result?: BinderAuditResult
    concept_count?: number
    trace?: BinderTrace
    async?: boolean
  }

  if (payload.trace) input.onTrace?.(payload.trace)

  const auditId = String(payload.auditId ?? input.auditId ?? '')

  if (error) {
    const detail = await readFunctionsError(error, payload)
    if (auditId) {
      const row = await fetchAuditRow(auditId)
      if (row?.result?._trace) input.onTrace?.(row.result._trace)
      // Async path may have already accepted; poll instead of failing hard.
      if (row && (row.status === 'pending' || payload.async)) {
        return pollAuditUntilDone(auditId, input.onTrace, payload.concept_count)
      }
      if (row?.error) throw new Error(row.error)
      if (row && TERMINAL.has(row.status) && row.status !== 'error') {
        return {
          auditId,
          status: row.status,
          overall_score: row.overall_score,
          result: row.result,
          concept_count: Number(payload.concept_count ?? 0),
          trace: row.result._trace,
        }
      }
    }
    throw new Error(detail)
  }

  if (payload.error) {
    throw new Error(payload.error)
  }

  if (!auditId) throw new Error('binder-audit returned no auditId')

  // Background job: poll row until NIM finishes (or errors).
  if (payload.async || payload.status === 'pending') {
    return pollAuditUntilDone(auditId, input.onTrace, payload.concept_count)
  }

  return {
    auditId,
    status: String(payload.status ?? 'ok'),
    overall_score:
      payload.overall_score === undefined || payload.overall_score === null
        ? null
        : Number(payload.overall_score),
    result: payload.result ?? {},
    concept_count: Number(payload.concept_count ?? 0),
    trace: payload.trace,
  }
}

async function fetchAuditRow(auditId: string): Promise<BinderAudit | null> {
  const { data, error } = await requireSupabase()
    .from('binder_audits')
    .select(
      'id, event_id, front_path, back_path, status, overall_score, result, model, error, created_at',
    )
    .eq('id', auditId)
    .maybeSingle()
  if (error || !data) return null
  return {
    ...(data as BinderAudit),
    result: (data.result ?? {}) as BinderAuditResult,
  }
}

async function pollAuditUntilDone(
  auditId: string,
  onTrace?: (trace: BinderTrace) => void,
  conceptCount?: number,
): Promise<{
  auditId: string
  status: string
  overall_score: number | null
  result: BinderAuditResult
  concept_count: number
  trace?: BinderTrace
}> {
  const deadline = Date.now() + 3 * 60_000
  while (Date.now() < deadline) {
    const row = await fetchAuditRow(auditId)
    if (row?.result?._trace) onTrace?.(row.result._trace)

    if (row && TERMINAL.has(row.status)) {
      if (row.status === 'error') {
        throw new Error(row.error || row.result._trace?.error || 'Audit failed')
      }
      return {
        auditId,
        status: row.status,
        overall_score: row.overall_score,
        result: row.result,
        concept_count: Number(conceptCount ?? 0),
        trace: row.result._trace,
      }
    }

    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(
    'Binder audit timed out waiting for MiniMax (3 min). Delete the pending row in History and retry.',
  )
}

export async function createPendingBinderAudit(input: {
  eventId: string
  frontPath: string
  backPath?: string | null
}): Promise<string> {
  const {
    data: { user },
  } = await requireSupabase().auth.getUser()
  if (!user) throw new Error('Sign in required')
  const { data, error } = await requireSupabase()
    .from('binder_audits')
    .insert({
      user_id: user.id,
      event_id: input.eventId,
      front_path: input.frontPath,
      back_path: input.backPath || null,
      status: 'pending',
      model: '',
      result: { _trace: { checkpoints: [{ at: 'client_created', t: 0 }] } },
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function deleteBinderAudit(auditId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('binder_audits')
    .delete()
    .eq('id', auditId)
  if (error) throw error
}

/** Delete every pending/error row for the current user (optionally one event). */
export async function deleteStuckBinderAudits(eventId?: string): Promise<number> {
  let q = requireSupabase()
    .from('binder_audits')
    .delete()
    .in('status', ['pending', 'error'])
  if (eventId) q = q.eq('event_id', eventId)
  const { data, error } = await q.select('id')
  if (error) throw error
  return (data ?? []).length
}

async function readFunctionsError(
  error: unknown,
  payload: { error?: string },
): Promise<string> {
  if (payload?.error) return payload.error
  const err = error as {
    message?: string
    context?: Response
  }
  if (err.context && typeof err.context.json === 'function') {
    try {
      const body = (await err.context.json()) as { error?: string; trace?: BinderTrace }
      if (body?.error) return body.error
    } catch {
      /* ignore */
    }
  }
  return err.message ?? 'Edge function returned non-2xx status code'
}

const BINDER_SCORE_WEIGHTS: Record<string, number> = {
  coverage: 0.3,
  test_readiness: 0.25,
  accuracy_risk: 0.2,
  structure: 0.1,
  density: 0.1,
  visuals: 0.05,
}

/** Recompute 0–100 overall from 1–5 subscores (Master contract formula). */
export function displayBinderOverallScore(result: BinderAuditResult): number | null {
  if (result.status === 'rejected') return 0
  const scores = result.scores
  if (!scores) {
    const raw = result.overall_score
    return raw === undefined || raw === null ? null : Math.round(Number(raw))
  }
  let total = 0
  let weightSum = 0
  for (const [key, weight] of Object.entries(BINDER_SCORE_WEIGHTS)) {
    const raw = Number(scores[key])
    if (!Number.isFinite(raw)) continue
    const clamped = Math.max(1, Math.min(5, raw))
    total += weight * (clamped - 1) * 25
    weightSum += weight
  }
  if (weightSum < 0.99) {
    const raw = result.overall_score
    return raw === undefined || raw === null ? null : Math.round(Number(raw))
  }
  return Math.round(Math.max(0, Math.min(100, total)))
}

export type BinderMarkStatus = 'empty' | 'thin' | 'solid'

export type BinderConceptMark = {
  concept_id: string
  status: BinderMarkStatus
  source: 'auto' | 'manual'
  updated_at: string
}

export type BinderCustomSection = {
  id: string
  event_id: string
  label: string
  notes: string
  sort_order: number
  updated_at: string
}

const STATUS_RANK: Record<BinderMarkStatus, number> = {
  empty: 0,
  thin: 1,
  solid: 2,
}

export function betterMark(
  a: BinderMarkStatus,
  b: BinderMarkStatus,
): BinderMarkStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b
}

export async function fetchConceptMarks(
  eventId: string,
): Promise<BinderConceptMark[]> {
  const { data, error } = await requireSupabase()
    .from('binder_concept_marks')
    .select('concept_id, status, source, updated_at')
    .eq('event_id', eventId)
  if (error) throw error
  return (data ?? []) as BinderConceptMark[]
}

export async function setConceptMark(input: {
  eventId: string
  conceptId: string
  status: BinderMarkStatus
  source?: 'auto' | 'manual'
}): Promise<void> {
  const {
    data: { user },
  } = await requireSupabase().auth.getUser()
  if (!user) throw new Error('Sign in required')
  const { error } = await requireSupabase().from('binder_concept_marks').upsert(
    {
      user_id: user.id,
      event_id: input.eventId,
      concept_id: input.conceptId,
      status: input.status,
      source: input.source ?? 'manual',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,event_id,concept_id' },
  )
  if (error) throw error
}

/** Cycle empty → thin → solid → empty (always manual). */
export function nextMarkStatus(current: BinderMarkStatus): BinderMarkStatus {
  if (current === 'empty') return 'thin'
  if (current === 'thin') return 'solid'
  return 'empty'
}

/**
 * Merge audit results into marks.
 * force=true overwrites manual; otherwise skips manual rows.
 */
export async function syncMarksFromAudits(input: {
  eventId: string
  conceptIds: string[]
  audits: BinderAudit[]
  force?: boolean
}): Promise<number> {
  const {
    data: { user },
  } = await requireSupabase().auth.getUser()
  if (!user) throw new Error('Sign in required')

  const existing = await fetchConceptMarks(input.eventId)
  const existingMap = new Map(existing.map((m) => [m.concept_id, m]))

  const rebuilt = new Map<string, BinderMarkStatus>()
  for (const id of input.conceptIds) rebuilt.set(id, 'empty')

  for (const audit of input.audits) {
    if (audit.status !== 'ok' && audit.status !== 'low_confidence') continue
    const r = audit.result ?? {}
    const gapMap = new Map((r.gaps ?? []).map((g) => [g.concept_id, g.why]))
    const seen = new Set(r.seen_concepts ?? [])

    for (const id of seen) {
      if (!rebuilt.has(id)) continue
      const why = gapMap.get(id)
      const mark: BinderMarkStatus =
        why === 'thin' || why === 'wrong' ? 'thin' : 'solid'
      rebuilt.set(id, betterMark(rebuilt.get(id)!, mark))
    }

    for (const [id, why] of gapMap) {
      if (!rebuilt.has(id) || seen.has(id)) continue
      const mark: BinderMarkStatus = why === 'thin' ? 'thin' : 'empty'
      const cur = rebuilt.get(id)!
      if (STATUS_RANK[mark] > STATUS_RANK[cur]) rebuilt.set(id, mark)
    }
  }

  const rows = []
  for (const [conceptId, status] of rebuilt) {
    const prev = existingMap.get(conceptId)
    if (prev?.source === 'manual' && !input.force) continue
    rows.push({
      user_id: user.id,
      event_id: input.eventId,
      concept_id: conceptId,
      status,
      source: 'auto' as const,
      updated_at: new Date().toISOString(),
    })
  }

  if (rows.length === 0) return 0
  const { error } = await requireSupabase()
    .from('binder_concept_marks')
    .upsert(rows, { onConflict: 'user_id,event_id,concept_id' })
  if (error) throw error
  return rows.length
}

export async function fetchCustomSections(
  eventId: string,
): Promise<BinderCustomSection[]> {
  const { data, error } = await requireSupabase()
    .from('binder_custom_sections')
    .select('id, event_id, label, notes, sort_order, updated_at')
    .eq('event_id', eventId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data ?? []) as BinderCustomSection[]
}

export async function addCustomSection(input: {
  eventId: string
  label: string
}): Promise<string> {
  const {
    data: { user },
  } = await requireSupabase().auth.getUser()
  if (!user) throw new Error('Sign in required')
  const { data, error } = await requireSupabase()
    .from('binder_custom_sections')
    .insert({
      user_id: user.id,
      event_id: input.eventId,
      label: input.label.trim() || 'Custom section',
      notes: '',
      sort_order: Date.now() % 100000,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateCustomSection(input: {
  id: string
  label?: string
  notes?: string
}): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.label !== undefined) patch.label = input.label
  if (input.notes !== undefined) patch.notes = input.notes
  const { error } = await requireSupabase()
    .from('binder_custom_sections')
    .update(patch)
    .eq('id', input.id)
  if (error) throw error
}

export async function deleteCustomSection(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('binder_custom_sections')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export function coverageStats(
  conceptIds: string[],
  marks: BinderConceptMark[],
): { empty: number; thin: number; solid: number; pctSolid: number } {
  const map = new Map(marks.map((m) => [m.concept_id, m.status]))
  let empty = 0
  let thin = 0
  let solid = 0
  for (const id of conceptIds) {
    const s = map.get(id) ?? 'empty'
    if (s === 'solid') solid += 1
    else if (s === 'thin') thin += 1
    else empty += 1
  }
  const total = conceptIds.length || 1
  return {
    empty,
    thin,
    solid,
    pctSolid: Math.round((solid / total) * 100),
  }
}
