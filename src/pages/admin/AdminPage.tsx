import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminErrorMessage,
  fetchDraftQueue,
  fetchEventNameMap,
  saveDraftQuestion,
  setQuestionStatus,
  type AdminQuestion,
  type AdminQuestionPatch,
} from '../../lib/adminQuestions'
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

function toForm(q: AdminQuestion): DraftForm {
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

function toPatch(form: DraftForm): AdminQuestionPatch {
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

function formValid(form: DraftForm): boolean {
  return (
    form.stem.trim().length > 0 &&
    form.A.trim().length > 0 &&
    form.B.trim().length > 0 &&
    form.C.trim().length > 0 &&
    form.D.trim().length > 0 &&
    form.explanation.trim().length > 0
  )
}

export function AdminPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<DraftForm | null>(null)
  const [actionNote, setActionNote] = useState<string | null>(null)

  const queueQuery = useQuery({
    queryKey: ['admin-drafts'],
    queryFn: fetchDraftQueue,
    enabled: isSupabaseConfigured,
  })

  const eventsQuery = useQuery({
    queryKey: ['admin-event-names'],
    queryFn: fetchEventNameMap,
    enabled: isSupabaseConfigured,
  })

  const drafts = queueQuery.data ?? []
  const selected = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null,
    [drafts, selectedId],
  )

  useEffect(() => {
    if (!selected) {
      setForm(null)
      return
    }
    setSelectedId(selected.id)
    setForm(toForm(selected))
    setActionNote(null)
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- reset form when selection changes

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !form) throw new Error('Nothing selected')
      if (!formValid(form)) throw new Error('Fill stem, all options, and explanation')
      await saveDraftQuestion(selected.id, toPatch(form))
    },
    onSuccess: async () => {
      setActionNote('Saved draft')
      await qc.invalidateQueries({ queryKey: ['admin-drafts'] })
    },
    onError: (err) => setActionNote(adminErrorMessage(err)),
  })

  const statusMutation = useMutation({
    mutationFn: async (status: 'live' | 'archived') => {
      if (!selected || !form) throw new Error('Nothing selected')
      if (!formValid(form)) throw new Error('Fix fields before publish/reject')
      await saveDraftQuestion(selected.id, toPatch(form))
      await setQuestionStatus(selected.id, status)
      return status
    },
    onSuccess: async (status) => {
      setActionNote(status === 'live' ? 'Published → live' : 'Rejected → archived')
      setSelectedId(null)
      await qc.invalidateQueries({ queryKey: ['admin-drafts'] })
    },
    onError: (err) => setActionNote(adminErrorMessage(err)),
  })

  const busy = saveMutation.isPending || statusMutation.isPending
  const eventName = (id: string) => eventsQuery.data?.get(id) ?? id

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to use Admin Factory.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto lg:grid lg:grid-cols-[minmax(220px,280px)_1fr] lg:gap-2 lg:overflow-hidden">
      <aside className="hud-panel flex min-h-[16rem] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:shrink">
          <div className="shrink-0 border-b border-subtle px-3 py-2">
            <p className="label-caps text-[9px] text-dim">Drafts</p>
            <p className="mt-0.5 data-mono text-[9px] text-muted">
              {queueQuery.isLoading ? '…' : `${drafts.length} waiting`}
            </p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {queueQuery.isError ? (
              <li className="px-2 py-3 text-[10px] text-alert">
                {adminErrorMessage(queueQuery.error)}
              </li>
            ) : null}
            {!queueQuery.isLoading && drafts.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted">
                Queue empty. Generate and Import feed drafts here.
              </li>
            ) : null}
            {drafts.map((d) => {
              const active = selected?.id === d.id
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                      active
                        ? 'bg-cyan/10 text-foreground'
                        : 'text-muted hover:bg-[var(--surface-hover)] hover:text-foreground'
                    }`}
                  >
                    <p className="label-caps text-[8px] text-dim">
                      {eventName(d.event_id)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug">
                      {d.stem}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="hud-panel flex min-h-[26rem] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:shrink">
          {!selected || !form ? (
            <div className="flex flex-1 items-center justify-center p-6 text-xs text-muted">
              Select a draft to review.
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-subtle px-3 py-2">
                <p className="data-mono text-[9px] text-muted">
                  {eventName(selected.event_id)} · {selected.question_type} ·{' '}
                  {selected.citation || 'no citation'}
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                <Field label="Stem">
                  <textarea
                    value={form.stem}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, stem: e.target.value } : f))
                    }
                    rows={4}
                    className="field-input min-h-[6rem] resize-y"
                  />
                </Field>

                <div className="grid gap-2 sm:grid-cols-2">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => (
                    <Field key={key} label={`Option ${key}`}>
                      <input
                        value={form[key]}
                        onChange={(e) =>
                          setForm((f) =>
                            f ? { ...f, [key]: e.target.value } : f,
                          )
                        }
                        className="field-input"
                      />
                    </Field>
                  ))}
                </div>

                <Field label="Correct key">
                  <div className="flex flex-wrap gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setForm((f) => (f ? { ...f, correct_key: key } : f))
                        }
                        className={`hud-pill px-3 py-1 text-[10px] ${
                          form.correct_key === key ? 'hud-pill-active' : ''
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Explanation">
                  <textarea
                    value={form.explanation}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, explanation: e.target.value } : f,
                      )
                    }
                    rows={3}
                    className="field-input min-h-[4.5rem] resize-y"
                  />
                </Field>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Topic id (optional)">
                    <input
                      value={form.topic_id}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, topic_id: e.target.value } : f,
                        )
                      }
                      className="field-input data-mono text-[10px]"
                    />
                  </Field>
                  <Field label="Concept id (optional)">
                    <input
                      value={form.concept_id}
                      onChange={(e) =>
                        setForm((f) =>
                          f ? { ...f, concept_id: e.target.value } : f,
                        )
                      }
                      className="field-input data-mono text-[10px]"
                    />
                  </Field>
                </div>

                {actionNote ? (
                  <p
                    className={`text-[10px] ${
                      /denied|fail|error|fix/i.test(actionNote)
                        ? 'text-alert'
                        : 'text-cyan'
                    }`}
                  >
                    {actionNote}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-subtle px-3 py-2">
                <button
                  type="button"
                  disabled={busy || !formValid(form)}
                  onClick={() => saveMutation.mutate()}
                  className="hud-pill px-3 py-1 text-[10px] disabled:opacity-40"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy || !formValid(form)}
                  onClick={() => statusMutation.mutate('live')}
                  className="hud-pill hud-pill-active px-3 py-1 text-[10px] disabled:opacity-40"
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={busy || !formValid(form)}
                  onClick={() => statusMutation.mutate('archived')}
                  className="hud-pill px-3 py-1 text-[10px] text-alert disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </section>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="label-caps text-[9px] text-dim">{label}</span>
      {children}
    </label>
  )
}
