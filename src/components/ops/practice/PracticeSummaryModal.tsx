import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PracticeCommitFeedback } from '../PracticeCommitFeedback'
import {
  filterSummaryItems,
  formatSummaryDuration,
  summaryAccuracy,
  weakTopicsFromItems,
  type PracticeSummaryFilter,
  type PracticeSummaryItem,
  type PracticeSummaryPayload,
} from '../../../lib/practiceSummary'

type Props = {
  payload: PracticeSummaryPayload
  onClose: () => void
}

const FILTERS: { id: PracticeSummaryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wrong', label: 'Wrong' },
  { id: 'correct', label: 'Correct' },
  { id: 'blank', label: 'Blank' },
]

export function PracticeSummaryModal({ payload, onClose }: Props) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [filter, setFilter] = useState<PracticeSummaryFilter>('all')
  const [cursor, setCursor] = useState(0)

  const stats = useMemo(() => summaryAccuracy(payload.items), [payload.items])
  const weak = useMemo(() => weakTopicsFromItems(payload.items), [payload.items])
  const filtered = useMemo(
    () => filterSummaryItems(payload.items, filter),
    [payload.items, filter],
  )

  useEffect(() => {
    setCursor(0)
  }, [filter])

  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0)
  }, [filtered.length, cursor])

  const current = filtered[cursor] ?? null

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (filtered.length === 0) return
        e.preventDefault()
        setCursor((c) => (c + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (filtered.length === 0) return
        e.preventDefault()
        setCursor((c) => (c - 1 + filtered.length) % filtered.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, filtered.length])

  const modeLabel = payload.mode === 'casual' ? 'Casual' : 'Timed'
  const accuracyLabel =
    stats.pct != null ? `${stats.pct}%` : stats.total === 0 ? '—' : '0%'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-[var(--overlay)] p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-subtle bg-[var(--void)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="label-caps text-[9px] text-dim">Session summary</p>
            <h2
              id={titleId}
              className="mt-1 font-display text-xl font-semibold tracking-wide text-foreground sm:text-2xl"
            >
              {modeLabel} · {payload.eventId.replace(/_/g, ' ')}
            </h2>
            <p className="mt-1 data-mono text-[10px] text-muted">
              {payload.topicId === 'all' ? 'All topics' : payload.topicId.replace(/_/g, ' ')}
              {payload.timedReason ? ` · ${payload.timedReason}` : ''}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-subtle text-lg text-muted transition hover:border-cyan/40 hover:text-cyan"
            aria-label="Close summary"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Stats */}
          <section className="grid grid-cols-2 gap-2 border-b border-subtle px-4 py-4 sm:grid-cols-4 sm:px-6">
            <Stat label="Accuracy" value={accuracyLabel} />
            <Stat
              label="Score"
              value={`${stats.correct}/${stats.answered || stats.total}`}
            />
            <Stat
              label="Time"
              value={formatSummaryDuration(payload.durationSec)}
            />
            <Stat
              label="Blank"
              value={String(stats.blank)}
              muted={stats.blank === 0}
            />
          </section>

          {/* Review */}
          <section className="border-b border-subtle px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="label-caps text-[9px] text-dim">Review</p>
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded-pill px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase transition ${
                      filter === f.id
                        ? 'bg-cyan text-[var(--on-accent)]'
                        : 'bg-surface-high text-muted hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No questions in this filter.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {filtered.map((item, i) => (
                    <button
                      key={item.questionId}
                      type="button"
                      onClick={() => setCursor(i)}
                      className={`data-mono flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-bold transition ${
                        i === cursor
                          ? 'bg-cyan text-[var(--on-accent)]'
                          : item.status === 'correct'
                            ? 'bg-success/20 text-success'
                            : item.status === 'incorrect'
                              ? 'bg-alert/20 text-alert'
                              : 'bg-surface-high text-dim'
                      }`}
                    >
                      {item.index + 1}
                    </button>
                  ))}
                </div>

                {current ? (
                  <div
                    className={`mt-4 rounded-xl border px-4 py-4 ${
                      current.status === 'correct'
                        ? 'choice-glow-correct border-transparent'
                        : current.status === 'incorrect'
                          ? 'choice-glow-wrong border-transparent'
                          : 'border-subtle'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="data-mono text-[10px] text-dim">
                        Q{current.index + 1} · {cursor + 1}/{filtered.length}
                      </p>
                      <StatusPill status={current.status} />
                    </div>
                    <p className="mt-3 text-base leading-snug text-foreground sm:text-lg">
                      {current.stem}
                    </p>
                    {current.conceptName ? (
                      <p className="mt-2 text-xs text-cyan">
                        {current.conceptName}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-muted">
                      Your answer:{' '}
                      {current.selected
                        ? `${current.selected}. ${current.options[current.selected]}`
                        : '— blank —'}
                    </p>
                    {current.status !== 'correct' ? (
                      <p className="mt-1 text-sm text-success">
                        Correct: {current.correctKey}.{' '}
                        {current.options[current.correctKey]}
                      </p>
                    ) : null}
                    <div className="mt-3 border-t border-subtle/70 pt-3">
                      <p className="label-caps text-[9px] text-dim">
                        Explanation
                      </p>
                      <p className="mt-1.5 text-sm text-muted">
                        {current.explanation?.trim()
                          ? current.explanation
                          : 'No explanation for this item yet.'}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={filtered.length < 2}
                        onClick={() =>
                          setCursor(
                            (c) => (c - 1 + filtered.length) % filtered.length,
                          )
                        }
                        className="hud-pill border border-subtle px-3 py-1.5 text-[10px] disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={filtered.length < 2}
                        onClick={() =>
                          setCursor((c) => (c + 1) % filtered.length)
                        }
                        className="hud-pill border border-subtle px-3 py-1.5 text-[10px] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* Weak + XP */}
          <section className="space-y-4 px-4 py-4 sm:px-6">
            <div>
              <p className="label-caps text-[9px] text-dim">Weakest this run</p>
              {weak.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No missed concepts in this session.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {weak.map((w) => (
                    <li
                      key={w.name}
                      className="rounded-pill border border-alert/35 bg-alert/10 px-3 py-1 text-xs text-alert"
                    >
                      {w.name}
                      {w.misses > 1 ? (
                        <span className="data-mono text-dim"> · {w.misses}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="label-caps text-[9px] text-dim">Progress</p>
              <PracticeCommitFeedback result={payload.commit} compact />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                to={payload.mode === 'casual' ? '/ops/casual' : '/ops/timed'}
                onClick={onClose}
                className="hud-pill bg-cyan px-4 py-2 text-sm font-bold text-[var(--on-accent)]"
              >
                Practice again
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="hud-pill border border-subtle px-4 py-2 text-sm text-muted"
              >
                Stay on CMD
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="rounded-xl border border-subtle/80 px-3 py-2.5">
      <p className="label-caps text-[8px] text-dim">{label}</p>
      <p
        className={`mt-1 data-mono text-lg font-semibold ${
          muted ? 'text-dim' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function StatusPill({ status }: { status: PracticeSummaryItem['status'] }) {
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
