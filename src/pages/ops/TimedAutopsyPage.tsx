import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { fetchQuestionsByIds } from '../../lib/arenaBank'
import {
  itemFromQuestion,
  savePracticeSummary,
} from '../../lib/practiceSummary'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { submitTimedSession } from '../../lib/timedCommit'
import {
  clearTimedExam,
  loadTimedExam,
  timedElapsedMs,
  timedResponseMs,
  type TimedExamPersisted,
} from '../../lib/timedExamStorage'
import type { Question } from '../../lib/types'

/**
 * Thin commit bridge after Black Box submit.
 * On success → CMD + PracticeSummaryModal (Plan 04).
 * On failure → retry UI stays here.
 */
export function TimedAutopsyPage() {
  const navigate = useNavigate()
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
  const [commitError, setCommitError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const commitLock = useRef(false)
  const navigatedRef = useRef(false)

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

  async function runCommit(snap: TimedExamPersisted, qs: Question[]) {
    if (!isSupabaseConfigured) {
      setCommitError('Supabase not configured')
      return
    }
    if (commitLock.current || navigatedRef.current) return
    commitLock.current = true
    setCommitting(true)
    setCommitError(null)
    try {
      const byId = new Map(qs.map((q) => [q.id, q]))
      const payload = snap.questionIds.map((id) => {
        const q = byId.get(id)
        const selected = snap.answers[id] ?? null
        if (!q || selected == null) {
          return {
            question_id: id,
            skipped: true,
            is_correct: null,
            response_ms: null,
          }
        }
        return {
          question_id: id,
          skipped: false,
          is_correct: selected === q.correct_key,
          response_ms: timedResponseMs(snap, id),
        }
      })

      const timeLimitMs = Math.max(0, snap.seconds) * 1000
      const result = await submitTimedSession({
        sessionToken: snap.session,
        eventId: snap.eventId,
        topicId: snap.topicId === 'all' ? 'all' : snap.topicId,
        answers: payload,
        elapsedMs: timedElapsedMs(snap),
        timeLimitMs,
      })
      await refreshProfile()

      const items = snap.questionIds.map((id, index) => {
        const q = byId.get(id)
        if (!q) {
          return itemFromQuestion(
            {
              id,
              event_id: snap.eventId,
              topic_id: null,
              concept_id: null,
              question_type: 'mcq',
              status: 'live',
              stem: 'Question unavailable',
              options: { A: '', B: '', C: '', D: '' },
              correct_key: 'A',
              explanation: '',
            },
            snap.answers[id] ?? null,
            index,
          )
        }
        return itemFromQuestion(
          q,
          snap.answers[id] ?? null,
          index,
          q.concept_id ? (conceptNames[q.concept_id] ?? null) : null,
        )
      })

      const durationSec = Math.max(
        0,
        Math.round(timedElapsedMs(snap) / 1000),
      )

      savePracticeSummary({
        v: 1,
        mode: 'timed',
        eventId: snap.eventId,
        topicId: snap.topicId === 'all' ? 'all' : snap.topicId,
        durationSec,
        items,
        commit: result,
        createdAt: new Date().toISOString(),
        timedReason: reason,
      })
      clearTimedExam(snap.session)
      navigatedRef.current = true
      navigate('/cmd/missions', { replace: true })
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
    if (commitError || committing || navigatedRef.current) return
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

  if (loading || (committing && !commitError)) {
    return (
      <Shell
        title={loading ? 'Running autopsy…' : 'Saving session…'}
        body={
          loading
            ? 'Grading sealed answers.'
            : 'Writing XP, then opening your summary on CMD.'
        }
      />
    )
  }

  if (error) {
    return <Shell title="Autopsy error" body={error} />
  }

  if (commitError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <div className="hud-panel w-full max-w-lg p-8 text-center">
          <p className="label-caps">Could not save</p>
          <p className="mt-4 text-sm text-alert">{commitError}</p>
          <p className="mt-2 text-xs text-dim">
            Check Supabase RPCs / network, then retry. Your sealed answers are
            still on this device.
          </p>
          <button
            type="button"
            onClick={() => {
              commitLock.current = false
              setCommitError(null)
              void runCommit(snapshot, questions)
            }}
            className="mt-6 hud-pill border border-alert/40 px-4 py-2 text-sm text-alert"
          >
            Retry save
          </button>
          <div className="mt-4">
            <Link
              to="/cmd/missions"
              className="text-sm text-muted hover:text-cyan"
            >
              CMD
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Shell
      title="Opening summary…"
      body="Redirecting to CMD."
    />
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
