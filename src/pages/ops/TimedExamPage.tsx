import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  PracticeChrome,
  TIMED_PRACTICE_SHORTCUTS,
  type PracticeNavigatorItem,
} from '../../components/ops/practice/PracticeChrome'
import {
  fetchArenaQuestionBank,
  fetchQuestionsByIds,
  optionKeyFromIndex,
} from '../../lib/arenaBank'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
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
  const [shownAtMs, setShownAtMs] = useState<Record<string, number>>({})
  const [answeredAtMs, setAnsweredAtMs] = useState<Record<string, number>>({})
  const [index, setIndex] = useState(0)
  const [deadlineIso, setDeadlineIso] = useState<string | null>(null)
  const [startedAtIso, setStartedAtIso] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const [paused, setPaused] = useState(false)
  const [timerHidden, setTimerHidden] = useState(false)
  const submittedRef = useRef(false)
  const pausedRemainingRef = useRef<number | null>(null)

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

  const navigatorItems: PracticeNavigatorItem[] = useMemo(() => {
    return questions.map((q, i) => {
      if (i === index) return { index: i, state: 'current' as const }
      if (answers[q.id] != null) return { index: i, state: 'answered' as const }
      return { index: i, state: 'blank' as const }
    })
  }, [questions, index, answers])

  const persist = useCallback(
    (patch: Partial<TimedExamPersisted>) => {
      if (!session || !eventId || !deadlineIso || !startedAtIso) return
      const base: TimedExamPersisted = {
        v: 2,
        session,
        eventId,
        topicId,
        count,
        seconds,
        deadlineIso,
        startedAtIso,
        submittedAtIso: null,
        questionIds: questions.map((q) => q.id),
        answers,
        shownAtMs,
        answeredAtMs,
        index,
        status: 'active',
        pausedRemainingSec: paused ? (pausedRemainingRef.current ?? left) : null,
        timerHidden,
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
      startedAtIso,
      questions,
      answers,
      shownAtMs,
      answeredAtMs,
      index,
      paused,
      left,
      timerHidden,
    ],
  )

  const submitExam = useCallback(
    (reason: 'manual' | 'timeout') => {
      if (!session || submittedRef.current) return
      submittedRef.current = true
      const submittedAtIso = new Date().toISOString()
      persist({
        status: 'submitted',
        answers,
        index,
        shownAtMs,
        answeredAtMs,
        submittedAtIso,
        pausedRemainingSec: null,
      })
      navigate(
        `/ops/timed/autopsy?session=${encodeURIComponent(session)}&reason=${reason}`,
      )
    },
    [session, persist, answers, index, shownAtMs, answeredAtMs, navigate],
  )

  const setPausedSafe = useCallback(
    (next: boolean) => {
      if (next) {
        if (paused) return
        const rem =
          deadlineIso != null ? remainingSeconds(deadlineIso) : left
        pausedRemainingRef.current = rem
        setLeft(rem)
        setPaused(true)
        if (session && eventId && deadlineIso && startedAtIso) {
          saveTimedExam({
            v: 2,
            session,
            eventId,
            topicId,
            count,
            seconds,
            deadlineIso,
            startedAtIso,
            submittedAtIso: null,
            questionIds: questions.map((q) => q.id),
            answers,
            shownAtMs,
            answeredAtMs,
            index,
            status: 'active',
            pausedRemainingSec: rem,
            timerHidden,
          })
        }
        return
      }
      if (!paused) return
      const rem = pausedRemainingRef.current ?? left
      const nextDeadline = new Date(Date.now() + rem * 1000).toISOString()
      pausedRemainingRef.current = null
      setDeadlineIso(nextDeadline)
      setLeft(rem)
      setPaused(false)
      if (session && eventId && startedAtIso) {
        saveTimedExam({
          v: 2,
          session,
          eventId,
          topicId,
          count,
          seconds,
          deadlineIso: nextDeadline,
          startedAtIso,
          submittedAtIso: null,
          questionIds: questions.map((q) => q.id),
          answers,
          shownAtMs,
          answeredAtMs,
          index,
          status: 'active',
          pausedRemainingSec: null,
          timerHidden,
        })
      }
    },
    [
      paused,
      deadlineIso,
      left,
      session,
      eventId,
      startedAtIso,
      topicId,
      count,
      seconds,
      questions,
      answers,
      shownAtMs,
      answeredAtMs,
      index,
      timerHidden,
    ],
  )

  const onTimerHiddenChange = useCallback(
    (hidden: boolean) => {
      setTimerHidden(hidden)
      if (!session || !eventId || !deadlineIso || !startedAtIso) return
      saveTimedExam({
        v: 2,
        session,
        eventId,
        topicId,
        count,
        seconds,
        deadlineIso,
        startedAtIso,
        submittedAtIso: null,
        questionIds: questions.map((q) => q.id),
        answers,
        shownAtMs,
        answeredAtMs,
        index,
        status: 'active',
        pausedRemainingSec: paused
          ? (pausedRemainingRef.current ?? left)
          : null,
        timerHidden: hidden,
      })
    },
    [
      session,
      eventId,
      deadlineIso,
      startedAtIso,
      topicId,
      count,
      seconds,
      questions,
      answers,
      shownAtMs,
      answeredAtMs,
      index,
      paused,
      left,
    ],
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
          setShownAtMs(existing.shownAtMs ?? {})
          setAnsweredAtMs(existing.answeredAtMs ?? {})
          setIndex(
            Math.min(
              Math.max(0, existing.index),
              Math.max(0, qs.length - 1),
            ),
          )
          setStartedAtIso(existing.startedAtIso)
          setTimerHidden(Boolean(existing.timerHidden))

          const pausedRem =
            typeof existing.pausedRemainingSec === 'number'
              ? existing.pausedRemainingSec
              : null

          if (pausedRem != null) {
            pausedRemainingRef.current = pausedRem
            setPaused(true)
            setLeft(pausedRem)
            setDeadlineIso(existing.deadlineIso)
            if (pausedRem <= 0) {
              submittedRef.current = true
              const submittedAtIso = new Date().toISOString()
              saveTimedExam({
                ...existing,
                status: 'submitted',
                submittedAtIso,
                pausedRemainingSec: null,
              })
              navigate(
                `/ops/timed/autopsy?session=${encodeURIComponent(session!)}&reason=timeout`,
                { replace: true },
              )
              return
            }
          } else {
            setDeadlineIso(existing.deadlineIso)
            const rem = remainingSeconds(existing.deadlineIso)
            setLeft(rem)
            if (rem <= 0) {
              submittedRef.current = true
              const submittedAtIso = new Date().toISOString()
              saveTimedExam({
                ...existing,
                status: 'submitted',
                submittedAtIso,
                pausedRemainingSec: null,
              })
              navigate(
                `/ops/timed/autopsy?session=${encodeURIComponent(session!)}&reason=timeout`,
                { replace: true },
              )
              return
            }
          }
        } else {
          const qs = await fetchArenaQuestionBank({
            eventId: eventId!,
            topicId: topicId === 'all' ? 'all' : topicId,
            cap: count,
          })
          if (cancelled) return
          if (qs.length === 0) throw new Error('No live questions for this config')
          const now = Date.now()
          const started = new Date(now).toISOString()
          const deadline = new Date(now + seconds * 1000).toISOString()
          const firstId = qs[0]?.id
          const initialShown: Record<string, number> = firstId
            ? { [firstId]: now }
            : {}
          const initial: TimedExamPersisted = {
            v: 2,
            session: session!,
            eventId: eventId!,
            topicId,
            count,
            seconds,
            deadlineIso: deadline,
            startedAtIso: started,
            submittedAtIso: null,
            questionIds: qs.map((q) => q.id),
            answers: {},
            shownAtMs: initialShown,
            answeredAtMs: {},
            index: 0,
            status: 'active',
            pausedRemainingSec: null,
            timerHidden: false,
          }
          saveTimedExam(initial)
          setQuestions(qs)
          setAnswers({})
          setShownAtMs(initialShown)
          setAnsweredAtMs({})
          setIndex(0)
          setDeadlineIso(deadline)
          setStartedAtIso(started)
          setLeft(seconds)
          setPaused(false)
          setTimerHidden(false)
          pausedRemainingRef.current = null
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

  // Record first-seen timestamp when landing on a question
  useEffect(() => {
    if (booting || loading || !current || submittedRef.current) return
    setShownAtMs((prev) => {
      if (prev[current.id] != null) return prev
      return { ...prev, [current.id]: Date.now() }
    })
  }, [current, booting, loading])

  // Persist answers/index/timings while active
  useEffect(() => {
    if (
      booting ||
      loading ||
      !deadlineIso ||
      !startedAtIso ||
      !session ||
      questions.length === 0
    ) {
      return
    }
    persist({
      answers,
      index,
      shownAtMs,
      answeredAtMs,
      status: 'active',
      pausedRemainingSec: paused ? (pausedRemainingRef.current ?? left) : null,
      timerHidden,
    })
  }, [
    answers,
    index,
    shownAtMs,
    answeredAtMs,
    deadlineIso,
    startedAtIso,
    session,
    questions.length,
    booting,
    loading,
    persist,
    paused,
    left,
    timerHidden,
  ])

  // Tick (frozen while paused — hidden timer still ticks when not paused)
  useEffect(() => {
    if (!deadlineIso || submittedRef.current || paused) return
    const tick = () => {
      const rem = remainingSeconds(deadlineIso)
      setLeft(rem)
      if (rem <= 0) submitExam('timeout')
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [deadlineIso, submitExam, paused])

  const pick = useCallback(
    (key: Question['correct_key']) => {
      if (!current || submittedRef.current || paused) return
      const now = Date.now()
      setAnswers((prev) => ({ ...prev, [current.id]: key }))
      setAnsweredAtMs((prev) => ({ ...prev, [current.id]: now }))
      setShownAtMs((prev) =>
        prev[current.id] != null ? prev : { ...prev, [current.id]: now },
      )
    },
    [current, paused],
  )

  const go = useCallback(
    (delta: number) => {
      if (paused) return
      setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)))
    },
    [total, paused],
  )

  const jumpTo = useCallback(
    (target: number) => {
      if (paused) return
      setIndex(Math.min(total - 1, Math.max(0, target)))
    },
    [total, paused],
  )

  const endExam = useCallback(() => {
    if (paused || submittedRef.current) return
    const unanswered = total - answeredCount
    if (
      window.confirm(
        unanswered > 0
          ? `End with ${unanswered} unanswered?`
          : 'End Black Box and open your summary?',
      )
    ) {
      submitExam('manual')
    }
  }, [paused, total, answeredCount, submitExam])

  const onPrimary = useCallback(() => {
    if (paused) return
    if (index >= total - 1) {
      if (
        window.confirm(
          answeredCount < total
            ? `Submit with ${total - answeredCount} unanswered?`
            : 'Submit Black Box for autopsy?',
        )
      ) {
        submitExam('manual')
      }
      return
    }
    go(1)
  }, [paused, index, total, answeredCount, submitExam, go])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submittedRef.current || loading || booting) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        e.preventDefault()
        endExam()
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setPausedSafe(!paused)
        return
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        onTimerHiddenChange(!timerHidden)
        return
      }

      if (paused) return

      if (
        e.key === 'ArrowRight' ||
        e.key === 'n' ||
        e.key === 'N' ||
        e.key === ']'
      ) {
        e.preventDefault()
        go(1)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault()
        go(-1)
        return
      }

      // Enter = Next only (never silent Submit on last)
      if (e.key === 'Enter') {
        e.preventDefault()
        if (index < total - 1) go(1)
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
  }, [
    loading,
    booting,
    go,
    pick,
    endExam,
    paused,
    setPausedSafe,
    timerHidden,
    onTimerHiddenChange,
    index,
    total,
  ])

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
  const onLast = index >= total - 1

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PracticeChrome
        current={index + 1}
        total={total}
        progressRatio={total === 0 ? 0 : answeredCount / total}
        navigatorItems={navigatorItems}
        onJump={jumpTo}
        timerLabel={formatExamClock(left)}
        timerUrgent={urgent}
        timerHidden={timerHidden}
        onTimerHiddenChange={onTimerHiddenChange}
        paused={paused}
        onPausedChange={setPausedSafe}
        onExit={endExam}
        exitLabel="End"
        showBack={index > 0}
        onBack={() => go(-1)}
        primaryLabel={onLast ? 'Submit' : 'Next'}
        primaryDisabled={paused}
        onPrimary={onPrimary}
        shortcuts={TIMED_PRACTICE_SHORTCUTS}
      >
        <p className="text-xs text-dim">
          No mid-run feedback · crash-protected · {answeredCount}/{total}{' '}
          answered
        </p>
        <p className="mt-4 text-xl leading-snug font-medium text-foreground md:text-2xl">
          {current.stem}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {OPTION_KEYS.map((key, i) => {
            const isSelected = selected === key
            return (
              <button
                key={key}
                type="button"
                disabled={paused}
                onClick={() => pick(key)}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3.5 text-left transition md:px-4 md:py-4 ${
                  isSelected
                    ? 'border-cyan bg-cyan/10 shadow-[0_0_18px_var(--accent-dim)]'
                    : 'border-subtle hover:border-cyan/50'
                }`}
              >
                <span
                  className={`data-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                    isSelected
                      ? 'bg-cyan text-[var(--on-accent)]'
                      : 'bg-surface-high text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="pt-1 text-sm text-foreground md:text-base">
                  {current.options[key]}
                </span>
              </button>
            )
          })}
        </div>
      </PracticeChrome>
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
