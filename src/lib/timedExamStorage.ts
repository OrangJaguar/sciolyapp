import type { Question } from './types'

export type TimedAnswerMap = Record<string, Question['correct_key'] | null>

/** First-seen / last-answer timestamps (epoch ms), keyed by question id. */
export type TimedTimingMap = Record<string, number>

export type TimedExamPersisted = {
  v: 2
  session: string
  eventId: string
  topicId: string
  count: number
  seconds: number
  deadlineIso: string
  /** Exam clock start (for elapsed_ms). */
  startedAtIso: string
  /** Set when exam is submitted (manual or timeout). */
  submittedAtIso: string | null
  questionIds: string[]
  answers: TimedAnswerMap
  /** First time each question was shown. */
  shownAtMs: TimedTimingMap
  /** Last time an answer key was selected for each question. */
  answeredAtMs: TimedTimingMap
  index: number
  status: 'active' | 'submitted'
  /**
   * When set, the exam is paused and this many seconds remain.
   * Deadline is rebuilt on resume so refresh doesn't drain the clock.
   */
  pausedRemainingSec?: number | null
  /** UI preference — countdown still runs unless paused. */
  timerHidden?: boolean
}

type TimedExamV1 = {
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

function startedFromDeadline(deadlineIso: string, seconds: number): string {
  const end = Date.parse(deadlineIso)
  if (!Number.isFinite(end)) return new Date().toISOString()
  return new Date(end - Math.max(0, seconds) * 1000).toISOString()
}

/** Normalize v1 → v2; reject unknown shapes. */
export function normalizeTimedExam(
  raw: unknown,
  session: string,
): TimedExamPersisted | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as TimedExamV1 | TimedExamPersisted
  if (parsed.session !== session) return null

  if (parsed.v === 2) {
    const pausedRemainingSec =
      typeof parsed.pausedRemainingSec === 'number' &&
      Number.isFinite(parsed.pausedRemainingSec)
        ? Math.max(0, Math.floor(parsed.pausedRemainingSec))
        : null
    return {
      ...parsed,
      startedAtIso:
        parsed.startedAtIso ||
        startedFromDeadline(parsed.deadlineIso, parsed.seconds),
      submittedAtIso: parsed.submittedAtIso ?? null,
      shownAtMs: parsed.shownAtMs ?? {},
      answeredAtMs: parsed.answeredAtMs ?? {},
      pausedRemainingSec,
      timerHidden: Boolean(parsed.timerHidden),
    }
  }

  if (parsed.v === 1) {
    return {
      v: 2,
      session: parsed.session,
      eventId: parsed.eventId,
      topicId: parsed.topicId,
      count: parsed.count,
      seconds: parsed.seconds,
      deadlineIso: parsed.deadlineIso,
      startedAtIso: startedFromDeadline(parsed.deadlineIso, parsed.seconds),
      submittedAtIso:
        parsed.status === 'submitted' ? parsed.deadlineIso : null,
      questionIds: parsed.questionIds,
      answers: parsed.answers ?? {},
      shownAtMs: {},
      answeredAtMs: {},
      index: parsed.index,
      status: parsed.status,
      pausedRemainingSec: null,
      timerHidden: false,
    }
  }

  return null
}

export function loadTimedExam(session: string): TimedExamPersisted | null {
  try {
    const raw = localStorage.getItem(timedStorageKey(session))
    if (!raw) return null
    return normalizeTimedExam(JSON.parse(raw) as unknown, session)
  } catch {
    return null
  }
}

export function saveTimedExam(state: TimedExamPersisted): void {
  const pausedRemainingSec =
    typeof state.pausedRemainingSec === 'number' &&
    Number.isFinite(state.pausedRemainingSec)
      ? Math.max(0, Math.floor(state.pausedRemainingSec))
      : null
  const normalized: TimedExamPersisted = {
    ...state,
    v: 2,
    shownAtMs: state.shownAtMs ?? {},
    answeredAtMs: state.answeredAtMs ?? {},
    submittedAtIso: state.submittedAtIso ?? null,
    startedAtIso:
      state.startedAtIso ||
      startedFromDeadline(state.deadlineIso, state.seconds),
    pausedRemainingSec,
    timerHidden: Boolean(state.timerHidden),
  }
  localStorage.setItem(
    timedStorageKey(state.session),
    JSON.stringify(normalized),
  )
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

/** Elapsed ms for ghost badge / RPC, capped at time limit. */
export function timedElapsedMs(snap: TimedExamPersisted, now = Date.now()): number {
  const limit = Math.max(0, snap.seconds) * 1000
  const start = Date.parse(snap.startedAtIso)
  const end = snap.submittedAtIso
    ? Date.parse(snap.submittedAtIso)
    : now
  if (!Number.isFinite(start) || !Number.isFinite(end)) return limit
  return Math.min(limit, Math.max(0, end - start))
}

export function timedResponseMs(
  snap: TimedExamPersisted,
  questionId: string,
): number | null {
  const shown = snap.shownAtMs?.[questionId]
  const answered = snap.answeredAtMs?.[questionId]
  if (shown == null || answered == null) return null
  return Math.max(0, answered - shown)
}
