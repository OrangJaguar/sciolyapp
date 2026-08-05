import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ClinicOverlay,
  clinicMissThreshold,
  type ClinicPayload,
} from '../../components/ops/ClinicOverlay'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  ARENA_SESSION_CAP,
  fetchArenaQuestionBank,
  optionIndexFromKey,
  optionKeyFromIndex,
} from '../../lib/arenaBank'
import {
  submitCasualSession,
  type SubmitCasualSessionResult,
} from '../../lib/casualCommit'
import { formatXp, rankFromXp } from '../../lib/progression'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { Question } from '../../lib/types'

type LocalAnswer = {
  questionId: string
  selected: Question['correct_key'] | null
  skipped: boolean
  correct: boolean | null
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

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
  const [selected, setSelected] = useState<Question['correct_key'] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<LocalAnswer[]>([])
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
  /** After clinic closes, advance using this pending entry path */
  const clinicResume = useRef<'advance' | 'finish' | null>(null)
  const answersSnapshot = useRef<LocalAnswer[]>([])

  const current = questions[index] ?? null
  const total = questions.length
  const progress = total === 0 ? 0 : (index + (revealed || done ? 1 : 0)) / total

  const summary = useMemo(() => {
    const graded = answers.filter((a) => !a.skipped)
    const correct = graded.filter((a) => a.correct).length
    return {
      correct,
      answered: graded.length,
      skipped: answers.filter((a) => a.skipped).length,
      total: answers.length,
    }
  }, [answers])

  const resetQuestionState = useCallback(() => {
    setSelected(null)
    setRevealed(false)
  }, [])

  const finalizeSession = useCallback(
    async (finalAnswers: LocalAnswer[]) => {
      if (!eventId || commitLock.current) return
      commitLock.current = true
      setCommitting(true)
      setCommitError(null)
      try {
        const result = await submitCasualSession({
          sessionToken,
          eventId,
          topicId: topicId === 'all' ? 'all' : topicId,
          answers: finalAnswers.map((a) => ({
            question_id: a.questionId,
            skipped: a.skipped,
            is_correct: a.correct,
          })),
        })
        setCommitResult(result)
        await refreshProfile()
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
    [eventId, topicId, sessionToken, refreshProfile],
  )

  const commitAndAdvance = useCallback(
    (entry: LocalAnswer, fromQuestion: Question | null = current) => {
      const nextAnswers = [...answers, entry]
      setAnswers(nextAnswers)
      answersSnapshot.current = nextAnswers

      const conceptId = fromQuestion?.concept_id
      const missed =
        !entry.skipped && entry.correct === false && Boolean(conceptId)

      if (
        missed &&
        conceptId &&
        !clinicCleared.includes(conceptId) &&
        !clinic
      ) {
        const nextMiss = (conceptMisses[conceptId] ?? 0) + 1
        const nextMisses = { ...conceptMisses, [conceptId]: nextMiss }
        setConceptMisses(nextMisses)

        const inBank = questions.filter((q) => q.concept_id === conceptId)
          .length
        const threshold = clinicMissThreshold(inBank)

        if (nextMiss >= threshold) {
          clinicResume.current = index + 1 >= total ? 'finish' : 'advance'
          setClinic({
            conceptId,
            conceptName: conceptId.replace(/_/g, ' '),
            sessionToken,
            lastStem: fromQuestion?.stem,
          })
          return
        }
      }

      if (index + 1 >= total) {
        setDone(true)
        void finalizeSession(nextAnswers)
        return
      }
      setIndex((i) => i + 1)
      resetQuestionState()
    },
    [
      answers,
      index,
      total,
      current,
      clinic,
      clinicCleared,
      conceptMisses,
      questions,
      finalizeSession,
      resetQuestionState,
      sessionToken,
    ],
  )

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
      resetQuestionState()

      if (resume === 'finish') {
        setDone(true)
        void finalizeSession(answersSnapshot.current)
        return
      }
      if (resume === 'advance') {
        setIndex((i) => i + 1)
      }
    },
    [clinic, finalizeSession, resetQuestionState, refreshProfile],
  )

  const revealOrGrade = useCallback(() => {
    if (!current || revealed) return
    if (!selected) return
    setRevealed(true)
  }, [current, revealed, selected])

  const goNext = useCallback(() => {
    if (!current) return
    if (!revealed) {
      revealOrGrade()
      return
    }
    commitAndAdvance({
      questionId: current.id,
      selected,
      skipped: false,
      correct: selected === current.correct_key,
    })
  }, [current, revealed, selected, revealOrGrade, commitAndAdvance])

  const skip = useCallback(() => {
    if (!current || revealed) return
    commitAndAdvance({
      questionId: current.id,
      selected: null,
      skipped: true,
      correct: null,
    })
  }, [current, revealed, commitAndAdvance])

  const pick = useCallback(
    (key: Question['correct_key']) => {
      if (!current || revealed) return
      setSelected(key)
    },
    [current, revealed],
  )

  const restart = useCallback(() => {
    commitLock.current = false
    clinicResume.current = null
    setSessionToken(crypto.randomUUID())
    setCommitResult(null)
    setCommitError(null)
    setIndex(0)
    setAnswers([])
    setDone(false)
    setClinic(null)
    setConceptMisses({})
    setClinicCleared([])
    resetQuestionState()
    void bankQuery.refetch()
  }, [bankQuery, resetQuestionState])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || clinic) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        e.preventDefault()
        if (window.confirm('Exit arena and return to lobby?')) {
          navigate('/ops/casual')
        }
        return
      }

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        skip()
        return
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        goNext()
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
  }, [done, clinic, goNext, skip, pick, navigate])

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
        body="No live MCQs for this event/topic. Re-run Plan 04 seed."
        actionTo="/ops/casual"
        actionLabel="Back to lobby"
      />
    )
  }

  if (done) {
    const xpLine = commitResult
      ? `+${commitResult.xp_awarded} XP · total ${formatXp(commitResult.xp_total)} · ${rankFromXp(commitResult.xp_total)}`
      : committing
        ? 'Saving progress…'
        : null

    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <div className="hud-panel w-full max-w-lg p-8 text-center">
          <p className="label-caps">Session complete</p>
          <p className="mt-4 text-3xl font-medium text-white">
            {summary.correct}
            <span className="text-muted"> / </span>
            {summary.answered}
          </p>
          <p className="mt-2 text-sm text-muted">
            Correct of answered · {summary.skipped} skipped
          </p>
          {xpLine && (
            <p className="mt-4 data-mono text-sm text-cyan">{xpLine}</p>
          )}
          {commitResult && (
            <p className="mt-1 text-xs text-dim">
              Streak {commitResult.streak}
              {commitResult.already_committed ? ' · replay ignored' : ''}
            </p>
          )}
          {commitError && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-alert">{commitError}</p>
              <p className="text-xs text-dim">
                If RPC missing, run 20260804_session_commit.sql in Supabase.
              </p>
              <button
                type="button"
                onClick={() => void finalizeSession(answers)}
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
              className="hud-pill bg-cyan px-5 py-2.5 text-sm font-bold text-black"
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {clinic && (
        <ClinicOverlay payload={clinic} onComplete={onClinicComplete} />
      )}
      <div className="flex shrink-0 items-center gap-3 pb-3">
        <p className="data-mono shrink-0 text-sm text-white">
          Q {index + 1}/{total}
        </p>
        <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-high">
          <div
            className="absolute inset-y-0 left-0 rounded-pill bg-cyan transition-[width] duration-300"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <p className="data-mono hidden shrink-0 text-[10px] text-dim sm:block">
          cap {ARENA_SESSION_CAP}
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Exit arena and return to lobby?')) {
              navigate('/ops/casual')
            }
          }}
          className="shrink-0 text-sm text-muted transition hover:text-cyan"
        >
          Exit
        </button>
      </div>

      <div className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
          <p className="text-xl leading-snug font-medium text-white md:text-2xl md:leading-snug">
            {current.stem}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {OPTION_KEYS.map((key, i) => {
              const label = current.options[key]
              const isSelected = selected === key
              const showResult = revealed
              const isCorrect = key === current.correct_key
              let stateClass =
                'border-white/20 hover:border-cyan/50 hover:bg-white/[0.03]'
              if (isSelected && !showResult) {
                stateClass =
                  'border-cyan bg-cyan/10 shadow-[0_0_20px_rgba(0,240,255,0.12)]'
              }
              if (showResult && isCorrect) {
                stateClass =
                  'border-success bg-success/10 shadow-[0_0_18px_rgba(0,255,102,0.12)]'
              } else if (showResult && isSelected && !isCorrect) {
                stateClass = 'border-alert bg-alert/10'
              } else if (showResult) {
                stateClass = 'border-white/10 opacity-50'
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={revealed}
                  onClick={() => pick(key)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition md:px-4 md:py-3.5 ${stateClass}`}
                >
                  <span
                    className={`data-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                      isSelected && !showResult
                        ? 'bg-cyan text-black'
                        : showResult && isCorrect
                          ? 'bg-success text-black'
                          : showResult && isSelected
                            ? 'bg-alert text-white'
                            : 'bg-surface-high text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1 text-sm text-white md:text-base">
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          {revealed && (
            <div className="mt-5 rounded-lg border border-cyan/25 bg-cyan/5 px-4 py-3">
              <p className="label-caps text-cyan">
                {selected === current.correct_key ? 'Correct' : 'Incorrect'}
                {selected !== current.correct_key && correctIdx >= 0
                  ? ` · answer ${correctIdx + 1}`
                  : ''}
              </p>
              {current.explanation && (
                <p className="mt-2 text-sm text-muted">{current.explanation}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={revealed}
              onClick={skip}
              className="hud-pill border border-white/20 px-5 py-2.5 text-sm text-white transition hover:border-cyan/40 disabled:opacity-40"
            >
              Skip Question
            </button>
            <span className="hidden text-xs text-dim sm:inline">
              Press <span className="text-muted">S</span> to skip
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-dim sm:inline">
              <span className="text-muted">1–4</span> select ·{' '}
              <span className="text-muted">Enter</span> /{' '}
              <span className="text-muted">Space</span> advance
            </span>
            <button
              type="button"
              disabled={!selected && !revealed}
              onClick={goNext}
              className="hud-pill bg-cyan px-6 py-2.5 text-sm font-bold tracking-wide text-black shadow-[0_0_18px_var(--cyan-dim)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-dim disabled:shadow-none"
            >
              {revealed ? (index + 1 >= total ? 'Finish' : 'Next') : 'Check'}
            </button>
          </div>
        </div>
      </div>
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
