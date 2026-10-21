import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ClinicOverlay,
  clinicMissThreshold,
  type ClinicPayload,
} from '../../components/ops/ClinicOverlay'
import { PracticeCommitFeedback } from '../../components/ops/PracticeCommitFeedback'
import {
  CASUAL_PRACTICE_SHORTCUTS,
  PracticeChrome,
  type PracticeNavigatorItem,
} from '../../components/ops/practice/PracticeChrome'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  fetchArenaQuestionBank,
  optionIndexFromKey,
  optionKeyFromIndex,
} from '../../lib/arenaBank'
import {
  submitCasualSession,
  type SubmitCasualSessionResult,
} from '../../lib/casualCommit'
import { playPracticeSfx } from '../../lib/practiceSfx'
import {
  itemFromQuestion,
  savePracticeSummary,
} from '../../lib/practiceSummary'
import { isSupabaseConfigured } from '../../lib/supabase'
import { formatExamClock } from '../../lib/timedExamStorage'
import type { Question } from '../../lib/types'

type GradedAnswer = {
  questionId: string
  selected: Question['correct_key']
  correct: boolean
  responseMs: number
}

type CommitAnswer = {
  questionId: string
  selected: Question['correct_key'] | null
  skipped: boolean
  correct: boolean | null
  responseMs: number | null
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

function gradesToCommitList(
  grades: Record<number, GradedAnswer>,
): CommitAnswer[] {
  return Object.keys(grades)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => {
      const g = grades[i]!
      return {
        questionId: g.questionId,
        selected: g.selected,
        skipped: false,
        correct: g.correct,
        responseMs: g.responseMs,
      }
    })
}

export function CasualArenaPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const eventId = params.get('event')
  const topicId = (params.get('topic') as string | null) ?? 'all'

  const bankQuery = useQuery({
    queryKey: ['arena-bank', eventId, topicId],
    enabled: isSupabaseConfigured && Boolean(eventId),
    queryFn: () =>
      fetchArenaQuestionBank({
        eventId: eventId!,
        topicId: topicId === 'all' ? 'all' : topicId,
      }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const questions = bankQuery.data ?? []
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<
    Record<number, Question['correct_key'] | null>
  >({})
  const [grades, setGrades] = useState<Record<number, GradedAnswer>>({})
  const [maxReached, setMaxReached] = useState(0)
  const [done, setDone] = useState(false)
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID())
  const [commitResult, setCommitResult] =
    useState<SubmitCasualSessionResult | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const commitLock = useRef(false)
  const [clinic, setClinic] = useState<ClinicPayload | null>(null)
  const [conceptMisses, setConceptMisses] = useState<Record<string, number>>(
    {},
  )
  const [clinicCleared, setClinicCleared] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const [timerHidden, setTimerHidden] = useState(false)
  const [elapsedTick, setElapsedTick] = useState(0)
  const clinicResume = useRef<'advance' | 'finish' | null>(null)
  const gradesSnapshot = useRef<Record<number, GradedAnswer>>({})
  const shownAtByIndex = useRef<Record<number, number>>({})
  const sessionStartedAtRef = useRef(Date.now())
  const pausedAtRef = useRef<number | null>(null)
  const pausedTotalRef = useRef(0)

  const current = questions[index] ?? null
  const total = questions.length
  const grade = grades[index] ?? null
  const selected = grade?.selected ?? drafts[index] ?? null
  const revealed = grade != null
  const checkedCount = Object.keys(grades).length
  const progress = total === 0 ? 0 : checkedCount / total
  const onLast = index >= total - 1

  const sessionElapsedSec = useMemo(() => {
    void elapsedTick
    const now =
      paused && pausedAtRef.current != null ? pausedAtRef.current : Date.now()
    return Math.max(
      0,
      Math.floor(
        (now - sessionStartedAtRef.current - pausedTotalRef.current) / 1000,
      ),
    )
  }, [elapsedTick, paused])

  const navigatorItems: PracticeNavigatorItem[] = useMemo(() => {
    const reach = Math.min(total - 1, Math.max(maxReached, index))
    const items: PracticeNavigatorItem[] = []
    for (let i = 0; i <= reach; i += 1) {
      if (i === index) {
        items.push({ index: i, state: 'current' })
        continue
      }
      const g = grades[i]
      if (!g) {
        items.push({ index: i, state: 'neutral' })
      } else if (g.correct) {
        items.push({ index: i, state: 'correct' })
      } else {
        items.push({ index: i, state: 'incorrect' })
      }
    }
    return items
  }, [total, maxReached, index, grades])

  const summary = useMemo(() => {
    const list = gradesToCommitList(grades)
    const correct = list.filter((a) => a.correct).length
    return {
      correct,
      answered: list.length,
      skipped: 0,
      total: list.length,
    }
  }, [grades])

  useEffect(() => {
    if (shownAtByIndex.current[index] == null) {
      shownAtByIndex.current[index] = Date.now()
    }
    setMaxReached((m) => Math.max(m, index))
  }, [index])

  useEffect(() => {
    if (done || clinic) return
    const id = window.setInterval(() => setElapsedTick((t) => t + 1), 250)
    return () => window.clearInterval(id)
  }, [done, clinic])

  const setPausedSafe = useCallback((next: boolean) => {
    if (next) {
      if (pausedAtRef.current == null) pausedAtRef.current = Date.now()
      setPaused(true)
      return
    }
    if (pausedAtRef.current != null) {
      pausedTotalRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
    }
    setPaused(false)
  }, [])

  const sessionDurationSec = useCallback(() => {
    const now =
      paused && pausedAtRef.current != null ? pausedAtRef.current : Date.now()
    return Math.max(
      0,
      Math.floor(
        (now - sessionStartedAtRef.current - pausedTotalRef.current) / 1000,
      ),
    )
  }, [paused])

  const finalizeSession = useCallback(
    async (finalGrades: Record<number, GradedAnswer>) => {
      if (!eventId || commitLock.current) return
      commitLock.current = true
      setCommitting(true)
      setCommitError(null)
      const list = gradesToCommitList(finalGrades)
      try {
        const result = await submitCasualSession({
          sessionToken,
          eventId,
          topicId: topicId === 'all' ? 'all' : topicId,
          answers: list.map((a) => ({
            question_id: a.questionId,
            skipped: a.skipped,
            is_correct: a.correct,
            response_ms: a.responseMs,
          })),
        })
        setCommitResult(result)
        await refreshProfile()

        const items = Object.keys(finalGrades)
          .map(Number)
          .sort((a, b) => a - b)
          .flatMap((i) => {
            const q = questions[i]
            const g = finalGrades[i]
            if (!q || !g) return []
            return [itemFromQuestion(q, g.selected, i)]
          })

        savePracticeSummary({
          v: 1,
          mode: 'casual',
          eventId,
          topicId: topicId === 'all' ? 'all' : topicId,
          durationSec: sessionDurationSec(),
          items,
          commit: result,
          createdAt: new Date().toISOString(),
        })
        navigate('/cmd/missions')
      } catch (err) {
        commitLock.current = false
        const msg =
          err instanceof Error ? err.message : 'Failed to commit session'
        setCommitError(msg)
        console.error('submit_casual_session', err)
      } finally {
        setCommitting(false)
      }
    },
    [
      eventId,
      topicId,
      sessionToken,
      refreshProfile,
      questions,
      sessionDurationSec,
      navigate,
    ],
  )

  const endSession = useCallback(
    (finalGrades: Record<number, GradedAnswer> = grades) => {
      gradesSnapshot.current = finalGrades
      setDone(true)
      void finalizeSession(finalGrades)
    },
    [grades, finalizeSession],
  )

  const maybeOpenClinic = useCallback(
    (
      entry: GradedAnswer,
      fromQuestion: Question,
      atIndex: number,
      nextGrades: Record<number, GradedAnswer>,
    ): boolean => {
      const conceptId = fromQuestion.concept_id
      if (entry.correct || !conceptId) return false
      if (clinicCleared.includes(conceptId) || clinic) return false

      const nextMiss = (conceptMisses[conceptId] ?? 0) + 1
      setConceptMisses((prev) => ({ ...prev, [conceptId]: nextMiss }))

      const inBank = questions.filter((q) => q.concept_id === conceptId).length
      const threshold = clinicMissThreshold(inBank)
      if (nextMiss < threshold) return false

      clinicResume.current = atIndex + 1 >= total ? 'finish' : 'advance'
      gradesSnapshot.current = nextGrades
      setClinic({
        conceptId,
        conceptName: conceptId.replace(/_/g, ' '),
        sessionToken,
        lastStem: fromQuestion.stem,
      })
      return true
    },
    [
      clinic,
      clinicCleared,
      conceptMisses,
      questions,
      total,
      sessionToken,
    ],
  )

  const checkAnswer = useCallback(() => {
    if (!current || revealed || paused || clinic) return
    if (!selected) return

    const shownAt = shownAtByIndex.current[index] ?? Date.now()
    const responseMs = Math.max(0, Date.now() - shownAt)
    const correct = selected === current.correct_key
    const entry: GradedAnswer = {
      questionId: current.id,
      selected,
      correct,
      responseMs,
    }
    const nextGrades = { ...grades, [index]: entry }
    setGrades(nextGrades)
    gradesSnapshot.current = nextGrades
    playPracticeSfx(correct ? 'correct' : 'wrong')

    maybeOpenClinic(entry, current, index, nextGrades)
  }, [
    current,
    revealed,
    paused,
    clinic,
    selected,
    index,
    grades,
    maybeOpenClinic,
  ])

  const onClinicComplete = useCallback(
    (_xpAwarded: number) => {
      if (!clinic) return
      const clearedId = clinic.conceptId
      setClinicCleared((prev) =>
        prev.includes(clearedId) ? prev : [...prev, clearedId],
      )
      setConceptMisses((prev) => ({ ...prev, [clearedId]: 0 }))
      setClinic(null)
      void refreshProfile()

      const resume = clinicResume.current
      clinicResume.current = null

      if (resume === 'finish') {
        endSession(gradesSnapshot.current)
        return
      }
      if (resume === 'advance') {
        setIndex((i) => Math.min(i + 1, Math.max(0, total - 1)))
      }
    },
    [clinic, endSession, refreshProfile, total],
  )

  const goNext = useCallback(() => {
    if (!current || paused || clinic) return
    if (!revealed) return
    if (onLast) {
      endSession()
      return
    }
    setIndex((i) => i + 1)
  }, [current, paused, clinic, revealed, onLast, endSession])

  const pick = useCallback(
    (key: Question['correct_key']) => {
      if (!current || revealed || paused || clinic) return
      setDrafts((prev) => ({ ...prev, [index]: key }))
    },
    [current, revealed, paused, clinic, index],
  )

  const requestEnd = useCallback(() => {
    if (paused || clinic) return
    const n = Object.keys(grades).length
    if (
      !window.confirm(
        n === 0
          ? 'End session with no checked answers?'
          : `End session with ${n} checked answer${n === 1 ? '' : 's'}?`,
      )
    ) {
      return
    }
    endSession()
  }, [paused, clinic, grades, endSession])

  const restart = useCallback(() => {
    commitLock.current = false
    clinicResume.current = null
    sessionStartedAtRef.current = Date.now()
    pausedAtRef.current = null
    pausedTotalRef.current = 0
    shownAtByIndex.current = {}
    gradesSnapshot.current = {}
    setPaused(false)
    setTimerHidden(false)
    setSessionToken(crypto.randomUUID())
    setCommitResult(null)
    setCommitError(null)
    setIndex(0)
    setDrafts({})
    setGrades({})
    setMaxReached(0)
    setDone(false)
    setClinic(null)
    setConceptMisses({})
    setClinicCleared([])
    void bankQuery.refetch()
  }, [bankQuery])

  const exitArena = useCallback(() => {
    if (window.confirm('Exit arena and return to lobby?')) {
      navigate('/ops/casual')
    }
  }, [navigate])

  const jumpTo = useCallback(
    (target: number) => {
      if (paused || clinic) return
      if (target < 0 || target >= total) return
      if (target > maxReached) return
      setIndex(target)
    },
    [paused, clinic, total, maxReached],
  )

  const goBack = useCallback(() => {
    if (index <= 0) return
    jumpTo(index - 1)
  }, [index, jumpTo])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || clinic) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        e.preventDefault()
        exitArena()
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setPausedSafe(!paused)
        return
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        setTimerHidden((v) => !v)
        return
      }

      if (paused) return

      if (e.key === 'Enter') {
        e.preventDefault()
        if (!revealed) {
          checkAnswer()
        } else {
          goNext()
        }
        return
      }

      // Space only advances after check (avoid accidental check)
      if (e.key === ' ') {
        if (revealed) {
          e.preventDefault()
          goNext()
        }
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
    done,
    clinic,
    paused,
    revealed,
    checkAnswer,
    goNext,
    pick,
    exitArena,
    setPausedSafe,
  ])

  if (!eventId) {
    return (
      <ArenaMessage
        title="Missing session"
        body="No event in URL. Start from the Casual lobby."
        actionTo="/ops/casual"
        actionLabel="Back to lobby"
      />
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <ArenaMessage
        title="Not configured"
        body="Supabase env required to load questions."
        actionTo="/ops/casual"
        actionLabel="Back to lobby"
      />
    )
  }

  if (bankQuery.isLoading) {
    return (
      <ArenaMessage title="Loading bank…" body="Pulling live questions in scope." />
    )
  }

  if (bankQuery.error) {
    return (
      <ArenaMessage
        title="Bank error"
        body="Could not load live questions. Check seed + RLS."
        actionTo="/ops/casual"
        actionLabel="Back to lobby"
      />
    )
  }

  if (total === 0) {
    return (
      <ArenaMessage
        title="Empty bank"
        body="No live MCQs for this event/topic. Seed live questions in Supabase or pick another scope."
        actionTo="/ops/casual"
        actionLabel="Back to lobby"
      />
    )
  }

  if (done) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <div className="hud-panel w-full max-w-lg p-8 text-center">
          <p className="label-caps">
            {commitError ? 'Could not save' : 'Saving session…'}
          </p>
          <p className="mt-4 text-3xl font-medium text-foreground">
            {summary.correct}
            <span className="text-muted"> / </span>
            {summary.answered}
          </p>
          <p className="mt-2 text-sm text-muted">
            {commitError
              ? 'Fix the save, then your summary opens on CMD.'
              : 'Opening summary on CMD…'}
          </p>
          <div className="mx-auto mt-4 max-w-md">
            <PracticeCommitFeedback
              result={commitResult}
              committing={committing}
            />
          </div>
          {commitError && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-alert">{commitError}</p>
              <p className="text-xs text-dim">
                Could not save session — check Supabase RPCs / network, then
                retry.
              </p>
              <button
                type="button"
                onClick={() => void finalizeSession(gradesSnapshot.current)}
                className="hud-pill border border-alert/40 px-4 py-2 text-sm text-alert"
              >
                Retry save
              </button>
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/ops/casual"
              className="hud-pill border border-cyan/40 px-5 py-2.5 text-sm text-cyan transition hover:bg-cyan/10"
            >
              Lobby
            </Link>
            <button
              type="button"
              onClick={restart}
              className="hud-pill bg-cyan px-5 py-2.5 text-sm font-bold text-[var(--on-accent)]"
            >
              Run again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!current) return null

  const correctIdx = optionIndexFromKey(current.correct_key)
  const primaryLabel = onLast ? 'End session' : 'Next'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {clinic && (
        <ClinicOverlay payload={clinic} onComplete={onClinicComplete} />
      )}
      <PracticeChrome
        current={index + 1}
        total={total}
        progressRatio={progress}
        navigatorItems={navigatorItems}
        onJump={jumpTo}
        timerLabel={formatExamClock(sessionElapsedSec)}
        timerHidden={timerHidden}
        onTimerHiddenChange={setTimerHidden}
        paused={paused}
        onPausedChange={setPausedSafe}
        onExit={exitArena}
        showBack={index > 0}
        onBack={goBack}
        primaryLabel={primaryLabel}
        primaryDisabled={!revealed || paused}
        onPrimary={goNext}
        shortcuts={CASUAL_PRACTICE_SHORTCUTS}
        endSlot={
          <button
            type="button"
            disabled={paused}
            onClick={requestEnd}
            className="hud-pill border border-subtle px-4 py-2 text-sm text-muted transition hover:border-alert/40 hover:text-alert disabled:opacity-40"
          >
            End
          </button>
        }
      >
        <p className="text-xl leading-snug font-medium text-foreground md:text-2xl md:leading-snug">
          {current.stem}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {OPTION_KEYS.map((key, i) => {
            const label = current.options[key]
            const isSelected = selected === key
            const isCorrect = key === current.correct_key
            let stateClass =
              'border-subtle hover:border-cyan/50 hover:bg-[var(--surface-hover)]'
            if (isSelected && !revealed) {
              stateClass =
                'border-cyan bg-cyan/10 shadow-[0_0_20px_var(--accent-dim)]'
            }
            if (revealed && isCorrect) {
              stateClass = 'choice-glow-correct'
            } else if (revealed && isSelected && !isCorrect) {
              stateClass = 'choice-glow-wrong'
            } else if (revealed) {
              stateClass = 'border-subtle opacity-50'
            }

            return (
              <div
                key={key}
                role="button"
                tabIndex={revealed || paused ? -1 : 0}
                aria-disabled={revealed || paused}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!revealed && !paused) pick(key)
                }}
                onKeyDown={(e) => {
                  if (revealed || paused) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pick(key)
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3.5 text-left transition md:px-4 md:py-4 ${stateClass} ${
                  revealed || paused ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`data-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                    isSelected && !revealed
                      ? 'bg-cyan text-[var(--on-accent)]'
                      : revealed && isCorrect
                        ? 'bg-success text-[var(--on-accent)]'
                        : revealed && isSelected
                          ? 'bg-alert text-foreground'
                          : 'bg-surface-high text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 text-sm text-foreground md:text-base">
                  {label}
                </span>
                {isSelected && !revealed && !paused ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      checkAnswer()
                    }}
                    className="hud-pill shrink-0 bg-cyan px-3 py-1.5 text-[10px] font-bold tracking-wide text-[var(--on-accent)] shadow-[0_0_14px_var(--cyan-dim)]"
                  >
                    Check
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        {revealed && (
          <div className="mt-6 rounded-xl border border-subtle/80 px-4 py-3">
            <p className="label-caps text-cyan">
              {grade?.correct ? 'Correct' : 'Incorrect'}
              {!grade?.correct && correctIdx >= 0
                ? ` · answer ${correctIdx + 1}`
                : ''}
            </p>
            {current.explanation ? (
              <p className="mt-2 text-sm text-muted">{current.explanation}</p>
            ) : (
              <p className="mt-2 text-sm text-dim">
                No explanation for this item yet.
              </p>
            )}
          </div>
        )}
      </PracticeChrome>
    </div>
  )
}

function ArenaMessage({
  title,
  body,
  actionTo,
  actionLabel,
}: {
  title: string
  body: string
  actionTo?: string
  actionLabel?: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4">
      <div className="hud-panel w-full max-w-lg p-8 text-center">
        <p className="label-caps">{title}</p>
        <p className="mt-4 text-sm text-muted">{body}</p>
        {actionTo && actionLabel && (
          <Link
            to={actionTo}
            className="mt-8 inline-flex hud-pill border border-cyan/40 px-5 py-2 text-sm text-cyan transition hover:bg-cyan/10"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
