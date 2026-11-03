import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchMemberPrep,
  fetchMemberSession,
  formatResponse,
  prepNotes,
  type PrepSession,
} from '../../lib/memberPrep'
import { formatDeadline } from '../../lib/missions'

function errText(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Could not load preparation'
  if (/team_member_prep|team_member_session|does not exist|schema cache/i.test(message)) {
    return 'Session history is not on the database yet. Run the member prep migration, then open this again.'
  }
  return message
}

function accuracy(correct: number, answered: number): string {
  if (answered <= 0) return '—'
  return `${Math.round((correct / answered) * 100)}%`
}

export function MemberPrepModal({
  userId,
  name,
  onClose,
}: {
  userId: string
  name: string
  onClose: () => void
}) {
  const [session, setSession] = useState<PrepSession | null>(null)
  const prepQuery = useQuery({
    queryKey: ['member-prep', userId],
    queryFn: () => fetchMemberPrep(userId),
  })
  const detailQuery = useQuery({
    queryKey: ['member-session', userId, session?.session_token, session?.mode],
    queryFn: () => fetchMemberSession(userId, session!.session_token),
    enabled: Boolean(session),
  })

  const prep = prepQuery.data
  const notes = prep ? prepNotes(prep) : []
  const summary = prep?.summary

  return (
    <div
      className="fade-in fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} preparation`}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="hud-panel rise-in flex max-h-[min(92dvh,860px)] w-full max-w-5xl flex-col overflow-hidden border-cyan/30 shadow-[0_0_48px_var(--accent-dim)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps">Preparation</p>
            <h2 className="mt-1 truncate text-2xl font-medium text-[var(--text)]">
              {name}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="hud-pill px-4 py-2 text-xs">
            Close
          </button>
        </div>

        {prepQuery.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted">Loading sessions…</p>
        ) : prepQuery.error ? (
          <p className="px-5 py-6 text-sm text-alert">{errText(prepQuery.error)}</p>
        ) : prep && summary ? (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-6">
                <Stat
                  label="Accuracy"
                  value={accuracy(summary.correct, summary.answered)}
                />
                <Stat
                  label="Answered"
                  value={String(summary.answered)}
                />
                <Stat
                  label="Median time"
                  value={formatResponse(summary.median_response_ms)}
                />
                <Stat label="Sessions" value={String(summary.sessions)} />
              </div>
              {notes.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {notes.map((note) => (
                    <li key={note} className="text-sm text-muted">
                      {note}
                    </li>
                  ))}
                </ul>
              )}

              <p className="label-caps mt-6">Sessions</p>
              {prep.sessions.length === 0 ? (
                <p className="mt-2 text-sm text-dim">No sessions yet.</p>
              ) : (
                <ul className="mt-2">
                  {prep.sessions.map((item) => {
                    const active = session?.session_token === item.session_token
                    return (
                        <li
                          key={`${item.mode}-${item.session_token}`}
                          className="border-b border-subtle"
                        >
                        <button
                          type="button"
                          onClick={() => setSession(item)}
                          className={`flex w-full items-baseline justify-between gap-3 py-2.5 text-left ${
                            active ? 'text-cyan' : 'text-[var(--text)]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm">
                              {item.event_name ?? item.event_id ?? 'Session'}
                              {' · '}
                              {item.mode === 'timed' ? 'Test' : 'Casual'}
                            </span>
                            <span className="text-xs text-dim">
                              {formatDeadline(item.started_at)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right data-mono text-xs">
                            {item.correct}/{item.answered}
                            <span className="block text-dim">
                              {formatResponse(item.elapsed_ms ?? item.median_response_ms)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto border-t border-subtle px-5 py-4 lg:border-t-0 lg:border-l">
              {session ? (
                <>
                  <p className="label-caps">
                    {session.event_name ?? 'Session'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {session.correct}/{session.answered} correct
                    {session.skipped > 0 ? ` · ${session.skipped} skipped` : ''}
                  </p>
                  {detailQuery.isLoading ? (
                    <p className="mt-4 text-sm text-muted">Loading questions…</p>
                  ) : detailQuery.error ? (
                    <p className="mt-4 text-sm text-alert">
                      {errText(detailQuery.error)}
                    </p>
                  ) : (
                    <ol className="mt-4 space-y-3">
                      {(detailQuery.data ?? []).map((answer, index) => (
                        <li key={`${answer.created_at}-${index}`}>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-xs text-dim">
                              {answer.skipped
                                ? 'Skipped'
                                : answer.is_correct
                                  ? 'Correct'
                                  : 'Missed'}
                              {answer.topic_name ? ` · ${answer.topic_name}` : ''}
                            </p>
                            <p className="data-mono text-xs text-cyan">
                              {formatResponse(answer.response_ms)}
                            </p>
                          </div>
                          {answer.stem ? (
                            <p className="mt-1 text-sm text-[var(--text)]">
                              {answer.stem}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              ) : (
                <>
                  <p className="label-caps">Missions</p>
                  {prep.missions.length === 0 ? (
                    <p className="mt-2 text-sm text-dim">No missions for their events.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {prep.missions.map((mission) => (
                        <li key={mission.id}>
                          <p className="text-sm text-[var(--text)]">
                            {mission.event_name ?? mission.title}
                          </p>
                          <p className="text-xs text-dim">
                            {mission.current_value}/{mission.target_value}{' '}
                            {mission.goal_type === 'correct' ? 'correct' : 'answered'}
                            {mission.completed ? ' · done' : ''}
                            {' · '}
                            {formatDeadline(mission.deadline)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-6 text-sm text-dim">
                    Open a session to see each question and how long it took.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps text-dim">{label}</p>
      <p className="mt-1 data-mono text-2xl text-[var(--text)]">{value}</p>
    </div>
  )
}
