import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCatalogSnapshot } from '../../lib/adminCatalog'
import {
  adminErrorMessage,
  bulkSetQuestionStatus,
  drainCritic,
  fetchAuditSample,
  fetchCriticStats,
  fetchReviewQueue,
  saveAndPublish,
  saveAndReject,
  setNeedsFix,
  softLintClient,
  type ReviewQuestion,
} from '../../lib/adminReview'
import { saveDraftQuestion } from '../../lib/adminQuestions'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { QuestionOptions } from '../../lib/types'

type DraftForm = {
  stem: string
  A: string
  B: string
  C: string
  D: string
  correct_key: 'A' | 'B' | 'C' | 'D'
  explanation: string
  topic_id: string
  concept_id: string
}

function toForm(q: ReviewQuestion): DraftForm {
  return {
    stem: q.stem,
    A: q.options.A,
    B: q.options.B,
    C: q.options.C,
    D: q.options.D,
    correct_key: q.correct_key,
    explanation: q.explanation,
    topic_id: q.topic_id ?? '',
    concept_id: q.concept_id ?? '',
  }
}

function toPatch(form: DraftForm) {
  const options: QuestionOptions = {
    A: form.A.trim(),
    B: form.B.trim(),
    C: form.C.trim(),
    D: form.D.trim(),
  }
  return {
    stem: form.stem,
    options,
    correct_key: form.correct_key,
    explanation: form.explanation,
    topic_id: form.topic_id.trim() || null,
    concept_id: form.concept_id.trim() || null,
  }
}

type QueueMode = 'waiting' | 'human' | 'audit'

function parseQueueMode(raw: string | null): QueueMode {
  if (raw === 'human' || raw === 'audit') return raw
  return 'waiting'
}

export function ReviewPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = parseQueueMode(params.get('v'))
  const setMode = (next: QueueMode) =>
    navigate(`/admin/review?v=${next}`, { replace: true })
  const [eventFilter, setEventFilter] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [form, setForm] = useState<DraftForm | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [stemFocused, setStemFocused] = useState(false)

  const catalogQuery = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: fetchCatalogSnapshot,
    enabled: isSupabaseConfigured,
  })

  const queueQuery = useQuery({
    queryKey: ['admin-review-queue', eventFilter || null],
    queryFn: () => fetchReviewQueue(eventFilter || null),
    enabled: isSupabaseConfigured && mode !== 'audit',
  })

  const auditQuery = useQuery({
    queryKey: ['admin-review-audit', eventFilter || null],
    queryFn: () => fetchAuditSample(eventFilter || null),
    enabled: isSupabaseConfigured && mode === 'audit',
  })

  const statsQuery = useQuery({
    queryKey: ['admin-critic-stats', eventFilter || null],
    queryFn: () => fetchCriticStats(eventFilter || null),
    enabled: isSupabaseConfigured,
    refetchInterval: 8000,
  })

  const waitingItems = useMemo(
    () => (queueQuery.data ?? []).filter((q) => q.critic_route == null),
    [queueQuery.data],
  )
  const humanItems = useMemo(
    () =>
      (queueQuery.data ?? []).filter(
        (q) => q.critic_route === 'human' || q.needs_fix,
      ),
    [queueQuery.data],
  )

  const waitingBreakdown = useMemo(() => {
    const byEvent = new Map<string, number>()
    const byConcept = new Map<string, number>()
    for (const q of waitingItems) {
      byEvent.set(q.event_id, (byEvent.get(q.event_id) ?? 0) + 1)
      if (q.concept_id) {
        byConcept.set(q.concept_id, (byConcept.get(q.concept_id) ?? 0) + 1)
      }
    }
    return { byEvent, byConcept }
  }, [waitingItems])

  const items =
    mode === 'waiting'
      ? waitingItems
      : mode === 'human'
        ? humanItems
        : (auditQuery.data ?? [])
  const selected = useMemo(
    () => items.find((q) => q.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setForm(null)
      return
    }
    setSelectedId(selected.id)
    setForm(toForm(selected))
  }, [selected?.id])

  const conceptName = useMemo(() => {
    const map = new Map(
      (catalogQuery.data?.concepts ?? []).map((c) => [c.id, c.name]),
    )
    return (id: string | null) => (id ? map.get(id) ?? id : '—')
  }, [catalogQuery.data?.concepts])

  const eventName = useMemo(() => {
    const map = new Map(
      (catalogQuery.data?.events ?? []).map((e) => [e.id, e.name]),
    )
    return (id: string) => map.get(id) ?? id
  }, [catalogQuery.data?.events])

  const studyableEvents = useMemo(
    () => (catalogQuery.data?.events ?? []).filter((e) => e.studyable),
    [catalogQuery.data?.events],
  )

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['admin-review-queue'] })
    await qc.invalidateQueries({ queryKey: ['admin-review-audit'] })
    await qc.invalidateQueries({ queryKey: ['admin-critic-stats'] })
    await qc.invalidateQueries({ queryKey: ['admin-catalog'] })
  }

  const moveRelative = (delta: number) => {
    if (items.length === 0) return
    const idx = Math.max(
      0,
      items.findIndex((q) => q.id === (selected?.id ?? selectedId)),
    )
    const next = items[Math.min(items.length - 1, Math.max(0, idx + delta))]
    if (next) setSelectedId(next.id)
  }

  const criticMutation = useMutation({
    mutationFn: () => drainCritic(50),
    onSuccess: async (result) => {
      setNote(
        `Critic done: ${result.processed} routed · auto ${result.routes.auto_live ?? 0} · human ${result.routes.human ?? 0} · reject ${result.routes.reject_regen ?? 0}`,
      )
      await invalidate()
      if ((result.routes.human ?? 0) > 0) setMode('human')
      else setMode('waiting')
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !form) return
      await saveAndPublish(selected.id, toPatch(form))
    },
    onSuccess: async () => {
      setNote('Published')
      await invalidate()
      moveRelative(1)
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !form) return
      await saveAndReject(selected.id, toPatch(form))
    },
    onSuccess: async () => {
      setNote('Archived')
      await invalidate()
      moveRelative(1)
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !form) return
      await saveDraftQuestion(selected.id, toPatch(form))
    },
    onSuccess: async () => {
      setNote('Saved')
      await invalidate()
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const needsFixMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return
      await setNeedsFix(selected.id, true)
    },
    onSuccess: async () => {
      setNote('Flagged needs_fix')
      await invalidate()
      moveRelative(1)
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const bulkMutation = useMutation({
    mutationFn: async (status: 'live' | 'archived') => {
      const ids = selectedIds.length > 0 ? selectedIds : selected ? [selected.id] : []
      if (ids.length === 0) return 0
      return bulkSetQuestionStatus(ids, status)
    },
    onSuccess: async (n, status) => {
      setNote(`Bulk ${status}: ${n}`)
      setSelectedIds([])
      await invalidate()
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        moveRelative(1)
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        moveRelative(-1)
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        publishMutation.mutate()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        rejectMutation.mutate()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        saveMutation.mutate()
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault()
        needsFixMutation.mutate()
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        setStemFocused(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!stemFocused) return
    const el = document.getElementById('review-stem')
    el?.focus()
    setStemFocused(false)
  }, [stemFocused])

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to use Review.
      </div>
    )
  }

  const stats = statsQuery.data
  const waitingCount = stats?.unrouted ?? waitingItems.length
  const humanCount = stats?.human ?? humanItems.length
  const lint =
    form != null
      ? softLintClient({
          stem: form.stem,
          explanation: form.explanation,
          correct_key: form.correct_key,
          options: {
            A: form.A,
            B: form.B,
            C: form.C,
            D: form.D,
          },
        })
      : []

  const waitingEventLines = [...waitingBreakdown.byEvent.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field-input py-1 text-[11px]"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            aria-label="Event filter"
          >
            <option value="">All events</option>
            {studyableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <span className="data-mono text-[10px] text-dim">
            {waitingCount} waiting · {humanCount} needs you
            {stats
              ? ` · live ${stats.live_total} · auto ${stats.auto_live}`
              : ''}
            {waitingEventLines.length > 0
              ? ` · ${waitingEventLines
                  .map(([id, n]) => `${eventName(id)} (${n})`)
                  .join(', ')}`
              : ''}
          </span>
        </div>
        <button
          type="button"
          className={`hud-pill px-4 py-2 text-[11px] ${
            waitingCount > 0 ? 'hud-pill-active' : 'opacity-40'
          }`}
          disabled={criticMutation.isPending || waitingCount === 0}
          onClick={() => {
            setMode('waiting')
            criticMutation.mutate()
          }}
        >
          {criticMutation.isPending
            ? 'Critic running…'
            : waitingCount > 0
              ? `Run critic (${waitingCount})`
              : 'Nothing to critique'}
        </button>
      </div>

      {note ? <p className="shrink-0 text-xs text-cyan">{note}</p> : null}

      {mode === 'human' ? (
        <p className="shrink-0 text-[10px] text-dim">
          Keys: J/K next/prev · A approve · R reject · S save · U needs-fix · E
          edit stem
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="hud-panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-subtle px-3 py-2">
            <p className="label-caps text-[9px] text-dim">
              {mode === 'waiting'
                ? 'Waiting for critic'
                : mode === 'human'
                  ? 'Needs you'
                  : 'Audit (already live)'}
            </p>
            {mode === 'human' ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="hud-pill px-2 py-0.5 text-[9px]"
                  disabled={bulkMutation.isPending || selectedIds.length === 0}
                  onClick={() => bulkMutation.mutate('live')}
                >
                  Publish
                </button>
                <button
                  type="button"
                  className="hud-pill px-2 py-0.5 text-[9px]"
                  disabled={bulkMutation.isPending || selectedIds.length === 0}
                  onClick={() => bulkMutation.mutate('archived')}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-[11px] text-muted">
                {mode === 'waiting'
                  ? 'No uncritiqued drafts. Generate more, or check Needs you.'
                  : mode === 'human'
                    ? 'Nothing needs you — critic auto-published the rest.'
                    : 'No audit flags yet.'}
              </li>
            ) : (
              items.map((q) => {
                const active = q.id === selected?.id
                const checked = selectedIds.includes(q.id)
                return (
                  <li key={q.id}>
                    <div
                      className={`flex items-start gap-1 rounded-lg px-1 py-1 ${
                        active ? 'bg-cyan/10' : 'hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {mode === 'human' ? (
                        <input
                          type="checkbox"
                          className="mt-2"
                          checked={checked}
                          onChange={() =>
                            setSelectedIds((cur) =>
                              checked
                                ? cur.filter((id) => id !== q.id)
                                : [...cur, q.id],
                            )
                          }
                        />
                      ) : null}
                      <button
                        type="button"
                        className="min-w-0 flex-1 px-1 py-1 text-left"
                        onClick={() => setSelectedId(q.id)}
                      >
                        <p className="label-caps text-[8px] text-dim">
                          {eventName(q.event_id)} ·{' '}
                          {conceptName(q.concept_id)}
                          {q.needs_fix ? ' · fix' : ''}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-foreground">
                          {q.stem}
                        </p>
                      </button>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div className="hud-panel min-h-0 overflow-y-auto p-4">
          {mode === 'waiting' && !selected ? (
            <p className="text-sm text-muted">
              Pick a draft to preview, or hit Run critic when the count above is
              &gt; 0.
            </p>
          ) : !selected || !form ? (
            <p className="text-sm text-muted">Select a question.</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <p className="label-caps text-[9px] text-dim">Stem + options</p>
                <textarea
                  id="review-stem"
                  className="field-input min-h-[7rem]"
                  value={form.stem}
                  onChange={(e) => setForm({ ...form, stem: e.target.value })}
                  readOnly={mode === 'waiting'}
                />
                {(['A', 'B', 'C', 'D'] as const).map((key) => (
                  <label key={key} className="flex items-start gap-2">
                    <button
                      type="button"
                      className={`hud-pill mt-1 px-2 py-0.5 text-[10px] ${
                        form.correct_key === key ? 'hud-pill-active' : ''
                      }`}
                      disabled={mode === 'waiting'}
                      onClick={() => setForm({ ...form, correct_key: key })}
                    >
                      {key}
                    </button>
                    <input
                      className="field-input flex-1"
                      value={form[key]}
                      readOnly={mode === 'waiting'}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {mode !== 'waiting' ? (
                  lint.length > 0 ? (
                    <p className="text-[10px] text-alert">
                      Soft lint (warn only): {lint.join(', ')}
                    </p>
                  ) : (
                    <p className="text-[10px] text-dim">Soft lint: clean</p>
                  )
                ) : (
                  <p className="text-[10px] text-dim">
                    Preview only — run critic to route this draft.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <p className="label-caps text-[9px] text-dim">Meta + critic</p>
                <p className="text-[11px] text-muted">
                  {eventName(selected.event_id)}
                  <br />
                  {conceptName(selected.concept_id)}
                </p>
                <p className="data-mono text-[10px] text-cyan">
                  route {selected.critic_route ?? 'waiting'}
                  {selected.critic_score != null
                    ? ` · score ${selected.critic_score.toFixed(2)}`
                    : ''}
                  {selected.critic_audit ? ' · audit' : ''}
                </p>
                {selected.critic_notes ? (
                  <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-[var(--surface-high)] p-2 text-[10px] text-muted">
                    {selected.critic_notes}
                  </pre>
                ) : null}
                <label className="flex flex-col gap-1">
                  <span className="label-caps text-[9px] text-dim">Explanation</span>
                  <textarea
                    className="field-input min-h-[6rem]"
                    value={form.explanation}
                    readOnly={mode === 'waiting'}
                    onChange={(e) =>
                      setForm({ ...form, explanation: e.target.value })
                    }
                  />
                </label>
                <p className="text-[10px] text-dim">
                  Citation: {selected.citation || '—'}
                </p>
                {mode === 'human' || mode === 'audit' ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      className="hud-pill hud-pill-active px-3 py-1.5 text-[10px]"
                      onClick={() => publishMutation.mutate()}
                    >
                      Approve (A)
                    </button>
                    <button
                      type="button"
                      className="hud-pill px-3 py-1.5 text-[10px]"
                      onClick={() => saveMutation.mutate()}
                    >
                      Save (S)
                    </button>
                    <button
                      type="button"
                      className="hud-pill px-3 py-1.5 text-[10px] text-alert"
                      onClick={() => rejectMutation.mutate()}
                    >
                      Reject (R)
                    </button>
                    <button
                      type="button"
                      className="hud-pill px-3 py-1.5 text-[10px]"
                      onClick={() => needsFixMutation.mutate()}
                    >
                      Needs fix (U)
                    </button>
                    {selected.concept_id ? (
                      <Link
                        to={`/admin/generate?concept=${encodeURIComponent(selected.concept_id)}&event=${encodeURIComponent(selected.event_id)}`}
                        className="hud-pill px-3 py-1.5 text-[10px]"
                      >
                        Regen concept
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="shrink-0 text-[10px] text-dim">
        Run SQL{' '}
        <span className="data-mono text-muted">SCIOLY-0815-ADMIN-REVIEW</span>
        {' '}then deploy{' '}
        <span className="data-mono text-muted">critic-worker</span>
        .
      </p>
    </div>
  )
}
