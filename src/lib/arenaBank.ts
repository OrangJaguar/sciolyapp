import { buildSessionQueue } from './serving'
import { supabase } from './supabase'
import type { Question, QuestionOptions } from './types'
import type { HistoryTouch, ReinjectionRow, WeaknessRow } from './serving'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

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
  /** Default ARENA_SESSION_CAP (10). Timed passes config count. */
  cap?: number
}): Promise<Question[]> {
  if (!supabase) throw new Error('Supabase not configured')

  let query = supabase
    .from('questions')
    .select(
      'id, event_id, topic_id, concept_id, question_type, status, stem, options, correct_key, explanation',
    )
    .eq('status', 'live')
    .eq('event_id', input.eventId)
    .eq('question_type', 'mcq')

  if (input.topicId !== 'all') {
    query = query.eq('topic_id', input.topicId)
  }

  const { data: questionRows, error: qErr } = await query
  if (qErr) throw qErr

  const bank = parseQuestions((questionRows ?? []) as Array<Record<string, unknown>>)
  if (bank.length === 0) return []

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

    const [weakRes, reinjRes, histRes] = await Promise.all([
      conceptIds.length
        ? supabase
            .from('user_weakness_map')
            .select('concept_id, total_attempts, correct_attempts')
            .eq('user_id', user.id)
            .in('concept_id', conceptIds)
        : Promise.resolve({ data: [], error: null }),
      questionIds.length
        ? supabase
            .from('reinjection_queue')
            .select('id, question_id, unlock_at, resolved')
            .eq('user_id', user.id)
            .eq('resolved', false)
            .in('question_id', questionIds)
        : Promise.resolve({ data: [], error: null }),
      questionIds.length
        ? supabase
            .from('user_history')
            .select('question_id')
            .eq('user_id', user.id)
            .in('question_id', questionIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (weakRes.error) throw weakRes.error
    if (reinjRes.error) throw reinjRes.error
    if (histRes.error) throw histRes.error

    weakness = (weakRes.data ?? []) as WeaknessRow[]
    reinjections = (reinjRes.data ?? []) as ReinjectionRow[]

    const conceptByQuestion = new Map(
      bank.map((q) => [q.id, q.concept_id] as const),
    )
    history = ((histRes.data ?? []) as Array<{ question_id: string }>).map(
      (h) => ({
        question_id: h.question_id,
        concept_id: conceptByQuestion.get(h.question_id) ?? null,
      }),
    )
  }

  const cap = Math.max(1, input.cap ?? ARENA_SESSION_CAP)
  return buildSessionQueue(
    {
      bank,
      weakness,
      reinjections,
      history,
      nowIso: new Date().toISOString(),
    },
    cap,
  )
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
