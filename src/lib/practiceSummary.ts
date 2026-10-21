import type { PracticeSessionCommitResult } from './practiceCommit'
import type { Question, QuestionOptions } from './types'

export type PracticeSummaryItemStatus = 'correct' | 'incorrect' | 'blank'

export type PracticeSummaryItem = {
  index: number
  questionId: string
  stem: string
  options: QuestionOptions
  correctKey: Question['correct_key']
  selected: Question['correct_key'] | null
  status: PracticeSummaryItemStatus
  explanation: string
  conceptId: string | null
  conceptName: string | null
}

export type PracticeSummaryPayload = {
  v: 1
  mode: 'casual' | 'timed'
  eventId: string
  topicId: string
  durationSec: number
  items: PracticeSummaryItem[]
  commit: PracticeSessionCommitResult
  createdAt: string
  timedReason?: string
}

export type PracticeSummaryFilter = 'all' | 'wrong' | 'correct' | 'blank'

const STORAGE_KEY = 'scioly.practiceSummary.v1'

export function savePracticeSummary(payload: PracticeSummaryPayload): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // quota / private mode — modal simply won't open
  }
}

export function loadPracticeSummary(): PracticeSummaryPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PracticeSummaryPayload
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) return null
    if (!parsed.commit || (parsed.mode !== 'casual' && parsed.mode !== 'timed')) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPracticeSummary(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function filterSummaryItems(
  items: PracticeSummaryItem[],
  filter: PracticeSummaryFilter,
): PracticeSummaryItem[] {
  if (filter === 'all') return items
  if (filter === 'wrong') return items.filter((i) => i.status === 'incorrect')
  if (filter === 'correct') return items.filter((i) => i.status === 'correct')
  return items.filter((i) => i.status === 'blank')
}

export function summaryAccuracy(items: PracticeSummaryItem[]): {
  correct: number
  incorrect: number
  blank: number
  answered: number
  total: number
  pct: number | null
} {
  const correct = items.filter((i) => i.status === 'correct').length
  const incorrect = items.filter((i) => i.status === 'incorrect').length
  const blank = items.filter((i) => i.status === 'blank').length
  const answered = correct + incorrect
  const total = items.length
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : null
  return { correct, incorrect, blank, answered, total, pct }
}

/** Miss counts by concept label, highest first. */
export function weakTopicsFromItems(
  items: PracticeSummaryItem[],
): { name: string; misses: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (item.status !== 'incorrect') continue
    const name =
      item.conceptName?.trim() ||
      item.conceptId?.replace(/_/g, ' ') ||
      'Unknown concept'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, misses]) => ({ name, misses }))
    .sort((a, b) => b.misses - a.misses || a.name.localeCompare(b.name))
}

export function itemFromQuestion(
  question: Question,
  selected: Question['correct_key'] | null,
  index: number,
  conceptName: string | null = null,
): PracticeSummaryItem {
  let status: PracticeSummaryItemStatus = 'blank'
  if (selected != null) {
    status = selected === question.correct_key ? 'correct' : 'incorrect'
  }
  return {
    index,
    questionId: question.id,
    stem: question.stem,
    options: question.options,
    correctKey: question.correct_key,
    selected,
    status,
    explanation: question.explanation ?? '',
    conceptId: question.concept_id,
    conceptName:
      conceptName ??
      (question.concept_id ? question.concept_id.replace(/_/g, ' ') : null),
  }
}

export function formatSummaryDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const rm = m % 60
    return `${h}h ${rm}m`
  }
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
