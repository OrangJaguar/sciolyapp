import { supabase } from './supabase'
import {
  adminErrorMessage,
  saveDraftQuestion,
  setQuestionStatus,
  type AdminQuestion,
  type AdminQuestionPatch,
} from './adminQuestions'
import type { QuestionOptions } from './types'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

const REVIEW_SELECT =
  'id, event_id, topic_id, concept_id, question_type, status, stem, options, correct_key, explanation, citation, created_at, needs_fix, critic_score, critic_notes, critic_routed_at, critic_route, critic_audit'

export type CriticRoute = 'auto_live' | 'human' | 'reject_regen'

export type ReviewQuestion = AdminQuestion & {
  needs_fix: boolean
  critic_score: number | null
  critic_notes: string | null
  critic_routed_at: string | null
  critic_route: CriticRoute | null
  critic_audit: boolean
}

export type CriticStats = {
  unrouted: number
  human: number
  auto_live: number
  reject_regen: number
  audit: number
  draft_total: number
  live_total: number
}

export type CriticTickResult = {
  processed?: number
  idle?: boolean
  routes?: Record<string, number>
  claimed?: number
  error?: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

function normalizeOptions(raw: unknown): QuestionOptions | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  for (const k of OPTION_KEYS) {
    if (typeof o[k] !== 'string' || !o[k]) return null
  }
  return { A: o.A as string, B: o.B as string, C: o.C as string, D: o.D as string }
}

function parseReviewQuestion(row: Record<string, unknown>): ReviewQuestion | null {
  const options = normalizeOptions(row.options)
  const key = row.correct_key as ReviewQuestion['correct_key']
  if (!options || !OPTION_KEYS.includes(key)) return null
  const route = row.critic_route as CriticRoute | null
  return {
    id: row.id as string,
    event_id: row.event_id as string,
    topic_id: (row.topic_id as string | null) ?? null,
    concept_id: (row.concept_id as string | null) ?? null,
    question_type: row.question_type as ReviewQuestion['question_type'],
    status: row.status as ReviewQuestion['status'],
    stem: row.stem as string,
    options,
    correct_key: key,
    explanation: (row.explanation as string) ?? '',
    citation: (row.citation as string) ?? '',
    created_at: row.created_at as string,
    needs_fix: Boolean(row.needs_fix),
    critic_score:
      row.critic_score == null || row.critic_score === ''
        ? null
        : Number(row.critic_score),
    critic_notes: (row.critic_notes as string | null) ?? null,
    critic_routed_at: (row.critic_routed_at as string | null) ?? null,
    critic_route:
      route === 'auto_live' || route === 'human' || route === 'reject_regen'
        ? route
        : null,
    critic_audit: Boolean(row.critic_audit),
  }
}

export async function fetchReviewQueue(
  eventId?: string | null,
): Promise<ReviewQuestion[]> {
  const { data, error } = await requireSupabase().rpc('admin_review_queue', {
    p_event_id: eventId || null,
    p_limit: 300,
  })
  if (error) throw error
  const out: ReviewQuestion[] = []
  for (const row of data ?? []) {
    const q = parseReviewQuestion(row as Record<string, unknown>)
    if (q) out.push(q)
  }
  return out
}

export async function fetchCriticStats(
  eventId?: string | null,
): Promise<CriticStats> {
  const { data, error } = await requireSupabase().rpc('admin_critic_stats', {
    p_event_id: eventId || null,
  })
  if (error) throw error
  const row = (data ?? {}) as Record<string, number>
  return {
    unrouted: Number(row.unrouted ?? 0),
    human: Number(row.human ?? 0),
    auto_live: Number(row.auto_live ?? 0),
    reject_regen: Number(row.reject_regen ?? 0),
    audit: Number(row.audit ?? 0),
    draft_total: Number(row.draft_total ?? 0),
    live_total: Number(row.live_total ?? 0),
  }
}

export async function bulkSetQuestionStatus(
  ids: string[],
  status: 'live' | 'draft' | 'archived',
): Promise<number> {
  const { data, error } = await requireSupabase().rpc(
    'admin_bulk_set_question_status',
    { p_ids: ids, p_status: status },
  )
  if (error) throw error
  return Number(data ?? 0)
}

export async function setNeedsFix(
  questionId: string,
  needs = true,
): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_set_needs_fix', {
    p_question_id: questionId,
    p_needs: needs,
  })
  if (error) throw error
}

export async function invokeCriticWorker(
  limit = 6,
): Promise<CriticTickResult> {
  const { data, error } = await requireSupabase().functions.invoke(
    'critic-worker',
    { body: { limit } },
  )
  if (error) {
    const msg = error.message ?? 'Critic invoke failed'
    if (/Failed to send|FunctionsFetchError|404|not found/i.test(msg)) {
      throw new Error(
        'critic-worker is not deployed. Run: supabase functions deploy critic-worker',
      )
    }
    throw new Error(msg)
  }
  return (data ?? {}) as CriticTickResult
}

/** Drain unrouted drafts through critic until idle or max ticks. */
export async function drainCritic(maxTicks = 40): Promise<{
  processed: number
  routes: Record<string, number>
}> {
  let processed = 0
  const routes: Record<string, number> = {
    auto_live: 0,
    human: 0,
    reject_regen: 0,
  }

  for (let i = 0; i < maxTicks; i += 1) {
    const tick = await invokeCriticWorker(6)
    if (tick.error) throw new Error(tick.error)
    if (tick.idle || !tick.processed) break
    processed += tick.processed
    for (const [k, v] of Object.entries(tick.routes ?? {})) {
      routes[k] = (routes[k] ?? 0) + Number(v)
    }
  }

  return { processed, routes }
}

export async function saveAndPublish(
  id: string,
  patch: AdminQuestionPatch,
): Promise<void> {
  await saveDraftQuestion(id, patch)
  await setQuestionStatus(id, 'live')
}

export async function saveAndReject(
  id: string,
  patch: AdminQuestionPatch,
): Promise<void> {
  await saveDraftQuestion(id, patch)
  await setQuestionStatus(id, 'archived')
}

export { adminErrorMessage, type AdminQuestionPatch }

/** Soft client lint — warn only. */
export function softLintClient(q: {
  stem: string
  explanation: string
  correct_key: string
  options: QuestionOptions
}): string[] {
  const flags: string[] = []
  if (q.stem.trim().length < 12) flags.push('short stem')
  if (q.explanation.trim().length < 8) flags.push('short explanation')
  if (!OPTION_KEYS.includes(q.correct_key as (typeof OPTION_KEYS)[number])) {
    flags.push('bad key')
  } else if (!q.options[q.correct_key as keyof QuestionOptions]?.trim()) {
    flags.push('key missing option')
  }
  return flags
}

export async function fetchAuditSample(
  eventId?: string | null,
  limit = 40,
): Promise<ReviewQuestion[]> {
  let query = requireSupabase()
    .from('questions')
    .select(REVIEW_SELECT)
    .eq('critic_audit', true)
    .eq('status', 'live')
    .order('critic_routed_at', { ascending: false })
    .limit(limit)

  if (eventId) query = query.eq('event_id', eventId)

  const { data, error } = await query
  if (error) throw error
  const out: ReviewQuestion[] = []
  for (const row of data ?? []) {
    const q = parseReviewQuestion(row as Record<string, unknown>)
    if (q) out.push(q)
  }
  return out
}
