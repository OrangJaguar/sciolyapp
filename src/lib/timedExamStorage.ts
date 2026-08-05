import type { Question } from './types'

export type TimedAnswerMap = Record<string, Question['correct_key'] | null>

export type TimedExamPersisted = {
  v: 1
  session: string
  eventId: string
  topicId: string
  count: number
  seconds: number
  deadlineIso: string
  questionIds: string[]
  answers: TimedAnswerMap
  index: number
  status: 'active' | 'submitted'
}

const PREFIX = 'scioly.timed.'

export function timedStorageKey(session: string): string {
  return `${PREFIX}${session}`
}

export function loadTimedExam(session: string): TimedExamPersisted | null {
  try {
    const raw = localStorage.getItem(timedStorageKey(session))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TimedExamPersisted
    if (parsed?.v !== 1 || parsed.session !== session) return null
    return parsed
  } catch {
    return null
  }
}

export function saveTimedExam(state: TimedExamPersisted): void {
  localStorage.setItem(timedStorageKey(state.session), JSON.stringify(state))
}

export function clearTimedExam(session: string): void {
  localStorage.removeItem(timedStorageKey(session))
}

export function remainingSeconds(deadlineIso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineIso) - now) / 1000))
}

export function formatExamClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
