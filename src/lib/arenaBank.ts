import { buildSessionQueue } from './serving'
import { supabase } from './supabase'
import type { Question, QuestionOptions } from './types'
import type { HistoryTouch, ReinjectionRow, WeaknessRow } from './serving'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export type ArenaBank = {
  questions: Question[]
  liveCount: number
}

async function fetchAnsweredIds(userId: string): Promise<Set<string>> {
  if (!supabase) return new Set()
  const ids = new Set<string>()
  const pageSize = 1000
  for (let from = 0; from < 50_000; from += pageSize) {
    const { data, error } = await supabase
      .from('user_history')
      .select('question_id')
      .eq('user_id', userId)
      .order('answered_at', { ascending: true })
      .order('question_id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const batch = (data ?? []) as Array<{ question_id: string }>
    for (const row of batch) ids.add(row.question_id)
    if (batch.length < pageSize) break
  }
  return ids
}

export const ARENA_SESSION_CAP = 10

function normalizeOptions(raw: unknown): QuestionOptions | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  for (const k of OPTION_KEYS) {
    if (typeof o[k] !== 'string' || !o[k]) return null
  }
  return { A: o.A as string, B: o.B as string, C: o.C as string, D: o.D as string }
}

function parseQuestions(
  rows: Array<Record<string, unknown>>,
): Question[] {
  const parsed: Question[] = []
  for (const row of rows) {
    const options = normalizeOptions(row.options)
    const key = row.correct_key as Question['correct_key']
    if (!options || !OPTION_KEYS.includes(key)) continue
    parsed.push({
      id: row.id as string,
      event_id: row.event_id as string,
      topic_id: (row.topic_id as string | null) ?? null,
      concept_id: (row.concept_id as string | null) ?? null,
      question_type: row.question_type as Question['question_type'],
      status: row.status as Question['status'],
      stem: row.stem as string,
      options,
      correct_key: key,
      explanation: (row.explanation as string) ?? '',
    })
  }
  return parsed
}

/**
 * Load live bank in scope + user serving signals, then order via Plan 08 engine.
 */
export async function fetchArenaQuestionBank(input: {
  eventId: string
  topicId: string | 'all'
  /** Default ARENA_SESSION_CAP (10). Timed passes config count. Casual passes uncapped. */
  cap?: number
  /** Serve the full live bank. Casual keeps going until the player ends. */
  uncapped?: boolean
  /** Drop questions this user has already answered. Casual uses this. */
  excludeAnswered?: boolean
}): Promise<ArenaBank> {
  if (!supabase) throw new Error('Supabase not configured')

  const questionRows: Array<Record<string, unknown>> = []
  const pageSize = 1000
  for (let from = 0; from < 20_000; from += pageSize) {
    let query = supabase
      .from('questions')
      .select(
        'id, event_id, topic_id, concept_id, question_type, status, stem, options, correct_key, explanation',
      )
      .eq('status', 'live')
      .eq('event_id', input.eventId)
      .eq('question_type', 'mcq')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (input.topicId !== 'all') {
      query = query.eq('topic_id', input.topicId)
    }

    const { data, error: qErr } = await query
    if (qErr) throw qErr
    const batch = (data ?? []) as Array<Record<string, unknown>>
    questionRows.push(...batch)
    if (batch.length < pageSize) break
  }

  const bank = parseQuestions(questionRows)
  if (bank.length === 0) return { questions: [], liveCount: 0 }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let weakness: WeaknessRow[] = []
  let reinjections: ReinjectionRow[] = []
  let history: HistoryTouch[] = []

  if (user) {
    const conceptIds = [
      ...new Set(bank.map((q) => q.concept_id).filter(Boolean) as string[]),
    ]
    const questionIds = bank.map((q) => q.id)

    const bankIds = new Set(questionIds)
    const [weakRes, reinjRes, answeredIds] = await Promise.all([
      conceptIds.length
        ? supabase
            .from('user_weakness_map')
            .select('concept_id, total_attempts, correct_attempts')
            .eq('user_id', user.id)
            .in('concept_id', conceptIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('reinjection_queue')
        .select('id, question_id, unlock_at, resolved')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .limit(1000),
      fetchAnsweredIds(user.id),
    ])

    if (weakRes.error) throw weakRes.error
    if (reinjRes.error) throw reinjRes.error

    weakness = (weakRes.data ?? []) as WeaknessRow[]
    reinjections = ((reinjRes.data ?? []) as ReinjectionRow[]).filter((row) =>
      bankIds.has(row.question_id),
    )

    const conceptByQuestion = new Map(
      bank.map((q) => [q.id, q.concept_id] as const),
    )
    history = [...answeredIds]
      .filter((id) => bankIds.has(id))
      .map((id) => ({
        question_id: id,
        concept_id: conceptByQuestion.get(id) ?? null,
      }))
  }

  const answered = new Set(history.map((row) => row.question_id))
  const servingBank = input.excludeAnswered
    ? bank.filter((question) => !answered.has(question.id))
    : bank
  const cap = input.uncapped
    ? servingBank.length
    : Math.max(1, Math.min(input.cap ?? ARENA_SESSION_CAP, servingBank.length || 1))
  return {
    liveCount: bank.length,
    questions:
      servingBank.length === 0
        ? []
        : buildSessionQueue(
            {
              bank: servingBank,
              weakness,
              reinjections: input.excludeAnswered ? [] : reinjections,
              history: input.excludeAnswered ? [] : history,
              nowIso: new Date().toISOString(),
              seed: Math.floor(Math.random() * 0x7fffffff),
            },
            cap,
          ),
  }
}

/** Load live questions by id, preserving `ids` order. */
export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!supabase) throw new Error('Supabase not configured')
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('questions')
    .select(
      'id, event_id, topic_id, concept_id, question_type, status, stem, options, correct_key, explanation',
    )
    .in('id', ids)
    .eq('status', 'live')

  if (error) throw error
  const parsed = parseQuestions((data ?? []) as Array<Record<string, unknown>>)
  const byId = new Map(parsed.map((q) => [q.id, q]))
  return ids.map((id) => byId.get(id)).filter(Boolean) as Question[]
}

export function optionKeyFromIndex(index: number): Question['correct_key'] | null {
  if (index < 0 || index > 3) return null
  return OPTION_KEYS[index]
}

export function optionIndexFromKey(key: string): number {
  return OPTION_KEYS.indexOf(key as (typeof OPTION_KEYS)[number])
}
