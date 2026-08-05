import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchArenaQuestionBank,
  fetchQuestionsByIds,
  optionKeyFromIndex,
} from '../../lib/arenaBank'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  clearTimedExam,
  formatExamClock,
  loadTimedExam,
  remainingSeconds,
  saveTimedExam,
  type TimedAnswerMap,
  type TimedExamPersisted,
} from '../../lib/timedExamStorage'
import type { Question } from '../../lib/types'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export function TimedExamPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = params.get('session')
  const eventId = params.get('event')
  const topicId = params.get('topic') ?? 'all'
  const count = Number(params.get('count') ?? 0)
  const seconds = Number(params.get('seconds') ?? 0)

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<TimedAnswerMap>({})
  const [index, setIndex] = useState(0)
  const [deadlineIso, setDeadlineIso] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const submittedRef = useRef(false)

  const configOk =
    Boolean(session) &&
    Boolean(eventId) &&
    count >= 1 &&
    seconds >= 60 &&
    isSupabaseConfigured

  const current = questions[index] ?? null
  const total = questions.length
  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v != null).length,
    [answers],
  )

  const persist = useCallback(
    (patch: Partial<TimedExamPersisted>) => {
      if (!session || !eventId || !deadlineIso) return
      const base: TimedExamPersisted = {
        v: 1,
        session,
        eventId,
        topicId,
        count,
        seconds,
        deadlineIso,
        questionIds: questions.map((q) => q.id),
        answers,
        index,
        status: 'active',
        ...patch,
      }
      saveTimedExam(base)
    },
    [
      session,
      eventId,
      topicId,
      count,
      seconds,
      deadlineIso,
      questions,
      answers,
      index,
    ],
  )

  const submitExam = useCallback(
    (reason: 'manual' | 'timeout') => {
      if (!session || submittedRef.current) return
      submittedRef.current = true
      persist({ status: 'submitted', answers, index })
      navigate(`/ops/timed/autopsy?session=${encodeURIComponent(session)}&reason=${reason}`)
    },
    [session, persist, answers, index, navigate],
  )

  // Boot: resume or fresh
  useEffect(() => {
    if (!configOk || !session || !eventId) {
      setBooting(false)
      setLoading(false)
      return
    }

    let cancelled = false

    async function boot() {
      setLoading(true)
      setError(null)
      try {
        const existing = loadTimedExam(session!)
        if (existing?.status === 'submitted') {
          navigate(
            `/ops/timed/autopsy?session=${encodeURIComponent(session!)}&reason=resume`,
            { replace: true },
          )
          return
        }

        if (
          existing &&
          existing.eventId === eventId &&
          existing.questionIds.length > 0
        ) {
          const qs = await fetchQuestionsByIds(existing.questionIds)
          if (cancelled) return
          if (qs.length === 0) throw new Error('Could not restore question set')
          setQuestions(qs)
          setAnswers(existing.answers ?? {})
          setIndex(
            Math.min(
              Math.max(0, existing.index),
              Math.max(0, qs.length - 1),
            ),
          )
          setDeadlineIso(existing.deadlineIso)
          const rem = remainingSeconds(existing.deadlineIso)
          setLeft(rem)
          if (rem <= 0) {
            submittedRef.current = true
            saveTimedExam({ ...existing, status: 'submitted' })
            navigate(
              `/ops/timed/autopsy?session=${encodeURIComponent(session!)}&reason=timeout`,
              { replace: true },
            )
            return
          }
        } else {
          const qs = await fetchArenaQuestionBank({
            eventId: eventId!,
            topicId: topicId === 'all' ? 'all' : topicId,
            cap: count,
          })
          if (cancelled) return
          if (qs.length === 0) throw new Error('No live questions for this config')
          const deadline = new Date(Date.now() + seconds * 1000).toISOString()
          const initial: TimedExamPersisted = {
            v: 1,
            session: session!,
            eventId: eventId!,
            topicId,
            count,
            seconds,
            deadlineIso: deadline,
            questionIds: qs.map((q) => q.id),
            answers: {},
            index: 0,
            status: 'active',
          }
          saveTimedExam(initial)
          setQuestions(qs)
          setAnswers({})
          setIndex(0)
          setDeadlineIso(deadline)
          setLeft(seconds)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start exam')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setBooting(false)
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [configOk, session, eventId, topicId, count, seconds, navigate])

  // Persist answers/index while active
  useEffect(() => {
    if (booting || loading || !deadlineIso || !session || questions.length === 0) {
      return
    }
    persist({ answers, index, status: 'active' })
  }, [answers, index, deadlineIso, session, questions.length, booting, loading, persist])

  // Tick
  useEffect(() => {
    if (!deadlineIso || submittedRef.current) return
    const tick = () => {
      const rem = remainingSeconds(deadlineIso)
      setLeft(rem)
      if (rem <= 0) submitExam('timeout')
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [deadlineIso, submitExam])

  const pick = useCallback(
    (key: Question['correct_key']) => {
      if (!current || submittedRef.current) return
      setAnswers((prev) => ({ ...prev, [current.id]: key }))
    },
    [current],
  )

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)))
    },
    [total],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submittedRef.current || loading || booting) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        e.preventDefault()
        if (
          window.confirm(
            'Abandon Black Box? Progress for this session will be cleared.',
          )
        ) {
          if (session) clearTimedExam(session)
          navigate('/ops/timed')
        }
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        go(1)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        go(-1)
        return
      }

      const num = Number(e.key)
      if (num >= 1 && num <= 4) {
        e.preventDefault()
        const key = optionKeyFromIndex(num - 1)
        if (key) pick(key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loading, booting, go, pick, session, navigate])

  if (!session || !eventId || count < 1 || seconds < 60) {
    return (
      <Message
        title="Missing exam config"
        body="Start from Timed Practice setup."
        to="/ops/timed"
      />
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <Message
        title="Not configured"
        body="Supabase env required."
        to="/ops/timed"
      />
    )
  }

  if (loading || booting) {
    return <Message title="Sealing Black Box…" body="Loading locked question set." />
  }

  if (error) {
    return <Message title="Exam error" body={error} to="/ops/timed" />
  }

  if (!current || total === 0) {
    return (
      <Message
        title="Empty set"
        body="No questions loaded."
        to="/ops/timed"
      />
    )
  }

  const selected = answers[current.id] ?? null
  const urgent = left <= 60

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <p className="label-caps text-cyan">Black Box</p>
        <p className="data-mono text-sm text-white">
          Q {index + 1}/{total}
        </p>
        <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-high">
          <div
            className="absolute inset-y-0 left-0 rounded-pill bg-cyan/80 transition-[width] duration-200"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <p
          className={`data-mono text-lg font-bold tabular-nums ${
            urgent ? 'text-alert' : 'text-cyan'
          }`}
        >
          {formatExamClock(left)}
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                answeredCount < total
                  ? `Submit with ${total - answeredCount} unanswered?`
                  : 'Submit Black Box for autopsy?',
              )
            ) {
              submitExam('manual')
            }
          }}
          className="hud-pill bg-cyan px-4 py-2 text-sm font-bold text-black"
        >
          Submit
        </button>
      </div>

      <div className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden border-cyan/30">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8">
          <p className="text-xs text-dim">
            No Clinic · no mid-run feedback · crash-protected
          </p>
          <p className="mt-3 text-xl leading-snug font-medium text-white md:text-2xl">
            {current.stem}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {OPTION_KEYS.map((key, i) => {
              const isSelected = selected === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition md:px-4 ${
                    isSelected
                      ? 'border-cyan bg-cyan/10 shadow-[0_0_18px_rgba(0,240,255,0.12)]'
                      : 'border-white/20 hover:border-cyan/50'
                  }`}
                >
                  <span
                    className={`data-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                      isSelected
                        ? 'bg-cyan text-black'
                        : 'bg-surface-high text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1 text-sm text-white md:text-base">
                    {current.options[key]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => go(-1)}
              className="hud-pill border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={() => go(1)}
              className="hud-pill border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Next
            </button>
            <span className="hidden text-xs text-dim sm:inline">
              {answeredCount}/{total} answered · 1–4 select
            </span>
          </div>
          <div className="flex max-w-full flex-wrap gap-1">
            {questions.map((q, i) => {
              const marked = answers[q.id] != null
              const active = i === index
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`data-mono h-7 w-7 rounded-md text-[10px] font-bold transition ${
                    active
                      ? 'bg-cyan text-black'
                      : marked
                        ? 'bg-cyan/25 text-cyan'
                        : 'bg-surface-high text-dim'
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Message({
  title,
  body,
  to,
}: {
  title: string
  body: string
  to?: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4">
      <div className="hud-panel w-full max-w-lg p-8 text-center">
        <p className="label-caps">{title}</p>
        <p className="mt-4 text-sm text-muted">{body}</p>
        {to && (
          <Link
            to={to}
            className="mt-8 inline-flex hud-pill border border-cyan/40 px-5 py-2 text-sm text-cyan"
          >
            Timed config
          </Link>
        )}
      </div>
    </div>
  )
}
