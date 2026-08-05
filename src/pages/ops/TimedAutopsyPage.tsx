import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { fetchQuestionsByIds } from '../../lib/arenaBank'
import { formatXp, rankFromXp } from '../../lib/progression'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  submitTimedSession,
  type SubmitTimedSessionResult,
} from '../../lib/timedCommit'
import {
  clearTimedExam,
  loadTimedExam,
  type TimedExamPersisted,
} from '../../lib/timedExamStorage'
import type { Question } from '../../lib/types'

type RowGrade = {
  question: Question
  selected: Question['correct_key'] | null
  status: 'correct' | 'incorrect' | 'blank'
  conceptName: string | null
}

export function TimedAutopsyPage() {
  const { refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const session = params.get('session')
  const reason = params.get('reason') ?? 'manual'

  const [snapshot] = useState<TimedExamPersisted | null>(() =>
    session ? loadTimedExam(session) : null,
  )

  const [questions, setQuestions] = useState<Question[]>([])
  const [conceptNames, setConceptNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commitResult, setCommitResult] =
    useState<SubmitTimedSessionResult | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const commitLock = useRef(false)

  useEffect(() => {
    if (!snapshot?.questionIds.length) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const qs = await fetchQuestionsByIds(snapshot!.questionIds)
        if (cancelled) return
        setQuestions(qs)

        const conceptIds = [
          ...new Set(qs.map((q) => q.concept_id).filter(Boolean) as string[]),
        ]
        if (supabase && conceptIds.length) {
          const { data, error: cErr } = await supabase
            .from('taxonomy_concepts')
            .select('id, name')
            .in('id', conceptIds)
          if (cErr) throw cErr
          const map: Record<string, string> = {}
          for (const row of data ?? []) {
            map[row.id as string] = row.name as string
          }
          if (!cancelled) setConceptNames(map)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load autopsy')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [snapshot])

  const grades: RowGrade[] = useMemo(() => {
    if (!snapshot) return []
    return questions.map((q) => {
      const selected = snapshot.answers[q.id] ?? null
      let status: RowGrade['status'] = 'blank'
      if (selected != null) {
        status = selected === q.correct_key ? 'correct' : 'incorrect'
      }
      return {
        question: q,
        selected,
        status,
        conceptName: q.concept_id
          ? (conceptNames[q.concept_id] ?? q.concept_id)
          : null,
      }
    })
  }, [questions, snapshot, conceptNames])

  const summary = useMemo(() => {
    const correct = grades.filter((g) => g.status === 'correct').length
    const incorrect = grades.filter((g) => g.status === 'incorrect').length
    const blank = grades.filter((g) => g.status === 'blank').length
    const weak = [
      ...new Set(
        grades
          .filter((g) => g.status === 'incorrect' && g.conceptName)
          .map((g) => g.conceptName as string),
      ),
    ]
    return { correct, incorrect, blank, total: grades.length, weak }
  }, [grades])

  async function runCommit(snap: TimedExamPersisted, qs: Question[]) {
    if (!isSupabaseConfigured) {
      setCommitError('Supabase not configured')
      return
    }
    if (commitLock.current) return
    commitLock.current = true
    setCommitting(true)
    setCommitError(null)
    try {
      const byId = new Map(qs.map((q) => [q.id, q]))
      const payload = snap.questionIds.map((id) => {
        const q = byId.get(id)
        const selected = snap.answers[id] ?? null
        if (!q || selected == null) {
          return { question_id: id, skipped: true, is_correct: null }
        }
        return {
          question_id: id,
          skipped: false,
          is_correct: selected === q.correct_key,
        }
      })

      const result = await submitTimedSession({
        sessionToken: snap.session,
        eventId: snap.eventId,
        topicId: snap.topicId === 'all' ? 'all' : snap.topicId,
        answers: payload,
      })
      setCommitResult(result)
      await refreshProfile()
      clearTimedExam(snap.session)
    } catch (err) {
      commitLock.current = false
      setCommitError(
        err instanceof Error ? err.message : 'Failed to commit timed session',
      )
    } finally {
      setCommitting(false)
    }
  }

  useEffect(() => {
    if (!snapshot || questions.length === 0) return
    if (commitResult || commitError || committing) return
    void runCommit(snapshot, questions)
    // one-shot on graded load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, questions])

  if (!session) {
    return (
      <Shell
        title="Missing session"
        body="No autopsy session id. Start from Timed config."
      />
    )
  }

  if (!snapshot) {
    return (
      <Shell
        title="Snapshot missing"
        body="No local Black Box snapshot (already cleared or different browser). If XP already committed, you are fine."
      />
    )
  }

  if (loading) {
    return <Shell title="Running autopsy…" body="Grading sealed answers." />
  }

  if (error) {
    return <Shell title="Autopsy error" body={error} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/ops/timed"
            className="text-xs tracking-wide text-muted hover:text-cyan"
          >
            ← Timed
          </Link>
          <h1 className="mt-1 text-2xl font-medium text-white md:text-3xl">
            Autopsy
          </h1>
          <p className="mt-1 text-sm text-muted">
            Submit · <span className="text-cyan">{reason}</span> · session{' '}
            {session.slice(0, 8)}…
          </p>
        </div>
        <div className="text-right">
          <p className="data-mono text-3xl font-semibold text-cyan">
            {summary.correct}
            <span className="text-muted">/{summary.total}</span>
          </p>
          <p className="text-xs text-dim">
            {summary.incorrect} wrong · {summary.blank} blank
          </p>
        </div>
      </div>

      <div className="hud-panel shrink-0 px-5 py-4">
        {committing && (
          <p className="data-mono text-sm text-cyan">Committing timed XP…</p>
        )}
        {commitResult && (
          <p className="data-mono text-sm text-cyan">
            +{commitResult.xp_awarded} XP · total{' '}
            {formatXp(commitResult.xp_total)} ·{' '}
            {rankFromXp(commitResult.xp_total)} · streak {commitResult.streak}
            {commitResult.already_committed ? ' · already saved' : ''}
          </p>
        )}
        {commitError && (
          <div className="space-y-2">
            <p className="text-sm text-alert">{commitError}</p>
            <p className="text-xs text-dim">
              If RPC missing, run 20260804_timed_commit.sql (SCIOLY-0804-TIMED).
            </p>
            <button
              type="button"
              onClick={() => {
                commitLock.current = false
                setCommitError(null)
                void runCommit(snapshot, questions)
              }}
              className="hud-pill border border-alert/40 px-4 py-2 text-sm text-alert"
            >
              Retry save
            </button>
          </div>
        )}
        {summary.weak.length > 0 && (
          <div className={commitResult || commitError || committing ? 'mt-3' : ''}>
            <p className="label-caps mb-2">Weak concepts this run</p>
            <div className="flex flex-wrap gap-2">
              {summary.weak.map((name) => (
                <span
                  key={name}
                  className="rounded-pill border border-alert/40 bg-alert/10 px-3 py-1 text-xs text-alert"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hud-panel min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-white/10">
          {grades.map((g, i) => (
            <li key={g.question.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="data-mono text-xs text-dim">Q{i + 1}</p>
                <StatusPill status={g.status} />
              </div>
              <p className="mt-2 text-sm text-white">{g.question.stem}</p>
              {g.conceptName && (
                <p className="mt-2 text-xs text-cyan">
                  Concept · {g.conceptName}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                Your answer:{' '}
                {g.selected
                  ? `${g.selected}. ${g.question.options[g.selected]}`
                  : '— blank —'}
              </p>
              {g.status !== 'correct' && (
                <p className="mt-1 text-xs text-success">
                  Correct: {g.question.correct_key}.{' '}
                  {g.question.options[g.question.correct_key]}
                </p>
              )}
              {g.question.explanation && (
                <p className="mt-2 text-xs text-dim">{g.question.explanation}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex shrink-0 flex-wrap gap-3">
        <Link
          to="/ops/timed"
          className="hud-pill bg-cyan px-5 py-2.5 text-sm font-bold text-black"
        >
          Run again
        </Link>
        <Link
          to="/ops"
          className="hud-pill border border-white/20 px-5 py-2.5 text-sm text-muted"
        >
          OPS
        </Link>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: RowGrade['status'] }) {
  if (status === 'correct') {
    return (
      <span className="rounded-pill bg-success/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-success uppercase">
        Correct
      </span>
    )
  }
  if (status === 'incorrect') {
    return (
      <span className="rounded-pill bg-alert/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-alert uppercase">
        Incorrect
      </span>
    )
  }
  return (
    <span className="rounded-pill bg-surface-high px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-dim uppercase">
      Blank
    </span>
  )
}

function Shell({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center p-4">
      <div className="hud-panel w-full max-w-lg p-8 text-center">
        <p className="label-caps">{title}</p>
        <p className="mt-4 text-sm text-muted">{body}</p>
        <Link
          to="/ops/timed"
          className="mt-8 inline-flex hud-pill border border-cyan/40 px-5 py-2 text-sm text-cyan"
        >
          Timed config
        </Link>
      </div>
    </div>
  )
}
