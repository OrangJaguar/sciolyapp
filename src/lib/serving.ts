import type { Question } from './types'

export type WeaknessRow = {
  concept_id: string
  total_attempts: number
  correct_attempts: number
}

export type ReinjectionRow = {
  id: string
  question_id: string
  unlock_at: string
  resolved: boolean
}

export type HistoryTouch = {
  question_id: string
  concept_id: string | null
}

export type ServingInput = {
  bank: Question[]
  /** Question ids already used this session */
  usedQuestionIds: ReadonlySet<string>
  weakness: WeaknessRow[]
  reinjections: ReinjectionRow[]
  /** Prior history for coverage (concept / question touch counts) */
  history: HistoryTouch[]
  /** ISO timestamp — inject for tests */
  nowIso: string
}

export function weaknessScore(row: WeaknessRow): number {
  const total = Math.max(0, row.total_attempts)
  const correct = Math.max(0, row.correct_attempts)
  const misses = Math.max(0, total - correct)
  if (total === 0) return 0
  return misses / total
}

function available(bank: Question[], used: ReadonlySet<string>): Question[] {
  return bank.filter((q) => !used.has(q.id))
}

function byId(a: Question, b: Question): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Pick the next Casual question.
 * Pure + deterministic for a fixed input (ties → question id).
 */
export function pickNextQuestion(input: ServingInput): Question | null {
  const pool = available(input.bank, input.usedQuestionIds)
  if (pool.length === 0) return null

  const now = Date.parse(input.nowIso)
  const poolById = new Map(pool.map((q) => [q.id, q]))

  // 1) Due reinjections (oldest unlock first, then id)
  const due = input.reinjections
    .filter(
      (r) =>
        !r.resolved &&
        Date.parse(r.unlock_at) <= now &&
        poolById.has(r.question_id),
    )
    .sort((a, b) => {
      const ta = Date.parse(a.unlock_at) - Date.parse(b.unlock_at)
      if (ta !== 0) return ta
      return a.question_id < b.question_id ? -1 : a.question_id > b.question_id ? 1 : 0
    })

  if (due.length > 0) {
    return poolById.get(due[0].question_id) ?? null
  }

  const weaknessByConcept = new Map(
    input.weakness.map((w) => [w.concept_id, w]),
  )

  const conceptTouch = new Map<string, number>()
  for (const h of input.history) {
    if (!h.concept_id) continue
    conceptTouch.set(h.concept_id, (conceptTouch.get(h.concept_id) ?? 0) + 1)
  }

  // Group pool by concept (null concept → own bucket)
  const byConcept = new Map<string, Question[]>()
  for (const q of pool) {
    const key = q.concept_id ?? `__none__:${q.id}`
    const list = byConcept.get(key) ?? []
    list.push(q)
    byConcept.set(key, list)
  }
  for (const list of byConcept.values()) list.sort(byId)

  type Candidate = {
    conceptKey: string
    score: number
    attempts: number
    touches: number
    question: Question
  }

  const candidates: Candidate[] = []
  for (const [conceptKey, qs] of byConcept) {
    const conceptId = qs[0]?.concept_id
    const w = conceptId ? weaknessByConcept.get(conceptId) : undefined
    const score = w ? weaknessScore(w) : 0
    const attempts = w?.total_attempts ?? 0
    const touches = conceptId ? (conceptTouch.get(conceptId) ?? 0) : 0
    candidates.push({
      conceptKey,
      score,
      attempts,
      touches,
      question: qs[0],
    })
  }

  // 2) Highest weakness (miss rate), then more attempts (confidence), then id
  const weak = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.attempts !== a.attempts) return b.attempts - a.attempts
    return byId(a.question, b.question)
  })

  if (weak[0] && weak[0].score > 0) {
    return weak[0].question
  }

  // 3) Uncovered / least-seen concepts
  const coverage = [...candidates].sort((a, b) => {
    if (a.touches !== b.touches) return a.touches - b.touches
    if (a.attempts !== b.attempts) return a.attempts - b.attempts
    return byId(a.question, b.question)
  })
  if (coverage[0]) return coverage[0].question

  // 5) Fallback any remaining
  return [...pool].sort(byId)[0] ?? null
}

/** Build an ordered session queue (cap length). */
export function buildSessionQueue(
  input: Omit<ServingInput, 'usedQuestionIds'>,
  cap: number,
): Question[] {
  const used = new Set<string>()
  const queue: Question[] = []
  while (queue.length < cap) {
    const next = pickNextQuestion({ ...input, usedQuestionIds: used })
    if (!next) break
    queue.push(next)
    used.add(next.id)
  }
  return queue
}
