import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { fetchCatalogSnapshot } from '../../lib/adminCatalog'
import {
  addCustomSection,
  binderPublicUrl,
  coverageStats,
  createPendingBinderAudit,
  deleteBinderAudit,
  deleteCustomSection,
  deleteStuckBinderAudits,
  displayBinderOverallScore,
  fetchBinderAudits,
  fetchBinderConcepts,
  fetchConceptMarks,
  fetchCustomSections,
  nextMarkStatus,
  runBinderAudit,
  setConceptMark,
  syncMarksFromAudits,
  updateCustomSection,
  uploadBinderImage,
  type BinderAudit,
  type BinderAuditResult,
  type BinderMarkStatus,
  type BinderTrace,
} from '../../lib/binder'
import { adminErrorMessage } from '../../lib/adminQuestions'
import { isSupabaseConfigured } from '../../lib/supabase'

type Phase = 'idle' | 'uploading' | 'edge' | 'done'
type View = 'audit' | 'planner' | 'history'

const LOAD_HINTS: Array<{ match: string; label: string }> = [
  { match: 'client_created', label: 'Queued audit' },
  { match: 'auth', label: 'Auth' },
  { match: 'load_catalog', label: 'Load prompts + concepts' },
  { match: 'ensure_audit_row', label: 'Save pending row' },
  { match: 'run_sync', label: 'Run audit (sync)' },
  { match: 'download_images', label: 'Download images on server' },
  { match: 'call_nim_vision', label: 'Read pages (MiniMax vision)' },
  { match: 'nim_vision_ok', label: 'Vision read complete' },
  { match: 'call_nim_score', label: 'Score + gaps (text model)' },
  { match: 'nim_score_ok', label: 'Scorecard complete' },
  { match: 'call_nim', label: 'Call MiniMax (legacy)' },
  { match: 'nim_ok', label: 'NIM response received' },
  { match: 'parse_json', label: 'Parse JSON scorecard' },
  { match: 'done', label: 'Done' },
]

const MARK_STYLE: Record<BinderMarkStatus, string> = {
  empty: 'border-white/15 text-dim',
  thin: 'border-alert/40 text-alert',
  solid: 'border-success/50 text-success',
}

export function BinderPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [eventId, setEventId] = useState('chem_lab')
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [note, setNote] = useState<string | null>(null)
  const [active, setActive] = useState<BinderAudit | null>(null)
  const [view, setView] = useState<View>('planner')
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [trace, setTrace] = useState<BinderTrace | null>(null)
  const [showTrace, setShowTrace] = useState(true)

  const catalogQuery = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: fetchCatalogSnapshot,
    enabled: isSupabaseConfigured,
  })

  const conceptsQuery = useQuery({
    queryKey: ['binder-concepts', eventId],
    queryFn: () => fetchBinderConcepts(eventId),
    enabled: isSupabaseConfigured && Boolean(eventId),
  })

  const historyQuery = useQuery({
    queryKey: ['binder-audits', eventId],
    queryFn: () => fetchBinderAudits(eventId),
    enabled: isSupabaseConfigured && Boolean(eventId),
  })

  const marksQuery = useQuery({
    queryKey: ['binder-marks', eventId],
    queryFn: () => fetchConceptMarks(eventId),
    enabled: isSupabaseConfigured && Boolean(eventId),
  })

  const sectionsQuery = useQuery({
    queryKey: ['binder-sections', eventId],
    queryFn: () => fetchCustomSections(eventId),
    enabled: isSupabaseConfigured && Boolean(eventId),
  })

  const studyableEvents = useMemo(
    () => (catalogQuery.data?.events ?? []).filter((e) => e.studyable),
    [catalogQuery.data?.events],
  )

  const conceptIds = useMemo(
    () => (conceptsQuery.data ?? []).map((c) => c.id),
    [conceptsQuery.data],
  )

  const markMap = useMemo(() => {
    const map = new Map<string, { status: BinderMarkStatus; source: string }>()
    for (const m of marksQuery.data ?? []) {
      map.set(m.concept_id, { status: m.status, source: m.source })
    }
    return map
  }, [marksQuery.data])

  const coverage = useMemo(
    () => coverageStats(conceptIds, marksQuery.data ?? []),
    [conceptIds, marksQuery.data],
  )

  const conceptsByTopic = useMemo(() => {
    const map = new Map<string, NonNullable<typeof conceptsQuery.data>>()
    for (const c of conceptsQuery.data ?? []) {
      const list = map.get(c.topic_name) ?? []
      list.push(c)
      map.set(c.topic_name, list)
    }
    return [...map.entries()] as Array<
      [string, NonNullable<typeof conceptsQuery.data>]
    >
  }, [conceptsQuery.data])

  const invalidatePlanner = async () => {
    await qc.invalidateQueries({ queryKey: ['binder-marks', eventId] })
    await qc.invalidateQueries({ queryKey: ['binder-sections', eventId] })
    await qc.invalidateQueries({ queryKey: ['binder-audits', eventId] })
  }

  const setSide = (side: 'front' | 'back', file: File | null) => {
    if (!file) {
      if (side === 'front') {
        setFrontFile(null)
        setFrontPreview(null)
      } else {
        setBackFile(null)
        setBackPreview(null)
      }
      return
    }
    const url = URL.createObjectURL(file)
    if (side === 'front') {
      setFrontFile(file)
      setFrontPreview(url)
    } else {
      setBackFile(file)
      setBackPreview(url)
    }
  }

  const auditMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sign in required')
      if (!eventId) throw new Error('Pick an event')
      if (!frontFile) throw new Error('Upload the front of your sheet')

      setTrace(null)
      setPhase('uploading')
      const frontPath = await uploadBinderImage(user.id, 'front', frontFile)
      let backPath: string | null = null
      if (backFile) {
        backPath = await uploadBinderImage(user.id, 'back', backFile)
      }

      const auditId = await createPendingBinderAudit({
        eventId,
        frontPath,
        backPath,
      })

      setPhase('edge')
      const result = await runBinderAudit({
        eventId,
        frontPath,
        backPath,
        auditId,
        onTrace: setTrace,
      })

      const audit: BinderAudit = {
        id: result.auditId,
        event_id: eventId,
        front_path: frontPath,
        back_path: backPath,
        status: result.status,
        overall_score: result.overall_score,
        result: { ...result.result, _trace: result.trace ?? result.result._trace },
        model: result.trace?.model ?? '',
        error: null,
        created_at: new Date().toISOString(),
      }

      if (result.trace) setTrace(result.trace)

      const audits = [audit, ...(historyQuery.data ?? [])]
      await syncMarksFromAudits({
        eventId,
        conceptIds,
        audits,
        force: false,
      })

      return audit
    },
    onSuccess: async (audit) => {
      setActive(audit)
      setPhase('done')
      setNote(null)
      await invalidatePlanner()
    },
    onError: (err) => {
      setPhase('idle')
      setNote(adminErrorMessage(err))
      setShowTrace(true)
    },
  })

  const syncMutation = useMutation({
    mutationFn: (force: boolean) =>
      syncMarksFromAudits({
        eventId,
        conceptIds,
        audits: historyQuery.data ?? [],
        force,
      }),
    onSuccess: async (n) => {
      setNote(`Synced ${n} concept mark(s) from audits`)
      await qc.invalidateQueries({ queryKey: ['binder-marks', eventId] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const markMutation = useMutation({
    mutationFn: ({
      conceptId,
      status,
    }: {
      conceptId: string
      status: BinderMarkStatus
    }) =>
      setConceptMark({
        eventId,
        conceptId,
        status,
        source: 'manual',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['binder-marks', eventId] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const addSectionMutation = useMutation({
    mutationFn: () =>
      addCustomSection({ eventId, label: newSectionLabel || 'Custom section' }),
    onSuccess: async () => {
      setNewSectionLabel('')
      await qc.invalidateQueries({ queryKey: ['binder-sections', eventId] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const result: BinderAuditResult | null = active?.result ?? null
  const displayScore =
    result != null
      ? displayBinderOverallScore(result)
      : active?.overall_score ?? null
  const showLoading = phase !== 'idle' && phase !== 'done'
  const liveTrace = trace ?? result?._trace ?? null
  const lastCheckpoint =
    liveTrace?.checkpoints?.[liveTrace.checkpoints.length - 1]?.at ?? ''

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to use Binder.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <select
          className="field-input max-w-xs"
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value)
            setActive(null)
            setPhase('idle')
          }}
          aria-label="Event"
        >
          {studyableEvents.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {(['planner', 'audit', 'history'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`hud-pill px-2.5 py-1 text-[10px] ${
              view === item ? 'hud-pill-active' : ''
            }`}
            onClick={() => setView(item)}
          >
            {item === 'planner'
              ? 'Planner'
              : item === 'audit'
                ? 'Audit'
                : `History (${historyQuery.data?.length ?? 0})`}
          </button>
        ))}
        <span className="data-mono text-[9px] text-dim">
          {coverage.pctSolid}% solid · {coverage.thin} thin · {coverage.empty}{' '}
          empty
        </span>
      </div>

      {note ? (
        <p className="shrink-0 text-xs text-alert">
          {note}{' '}
          <button
            type="button"
            className="underline text-cyan"
            onClick={() => setShowTrace(true)}
          >
            Show trace
          </button>
        </p>
      ) : null}

      {showTrace && liveTrace ? (
        <div className="hud-panel shrink-0 max-h-48 overflow-y-auto p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="label-caps text-[9px] text-dim">Binder audit trace</p>
            <button
              type="button"
              className="text-[9px] text-dim hover:text-muted"
              onClick={() => setShowTrace(false)}
            >
              Hide
            </button>
          </div>
          <p className="mt-1 data-mono text-[9px] text-muted">
            model={liveTrace.model ?? '?'} · concepts={liveTrace.conceptCount ?? '?'}
            {liveTrace.twoPhase ? ' · 2-phase' : ''}
            {liveTrace.criteriaRawChars != null
              ? ` · criteria ${liveTrace.criteriaSlimChars ?? '?'}c/${liveTrace.criteriaRawChars}c`
              : ''}
            {liveTrace.visionUserChars != null
              ? ` · vision=${(liveTrace.visionSystemChars ?? 0) + (liveTrace.visionUserChars ?? 0)}c`
              : liveTrace.systemChars != null
                ? ` · sys=${liveTrace.systemChars}c`
                : ''}
            {liveTrace.scoreUserChars != null
              ? ` · score=${(liveTrace.scoreSystemChars ?? 0) + (liveTrace.scoreUserChars ?? 0)}c`
              : liveTrace.userChars != null
                ? ` · user=${liveTrace.userChars}c`
                : ''}
            {' · '}imgs={liveTrace.imageCount ?? '?'}
            {liveTrace.imageBytes
              ? ` (${liveTrace.imageBytes.map((b) => `${Math.round(b / 1024)}kb`).join('+')})`
              : ''}
            {liveTrace.nimVisionMs != null ? ` · vision=${liveTrace.nimVisionMs}ms` : ''}
            {liveTrace.nimScoreMs != null ? ` · score=${liveTrace.nimScoreMs}ms` : ''}
            {liveTrace.nimMs != null && liveTrace.nimVisionMs == null
              ? ` · nim=${liveTrace.nimMs}ms`
              : ''}
          </p>
          {liveTrace.error ? (
            <p className="mt-1 text-[10px] text-alert">{liveTrace.error}</p>
          ) : null}
          <ul className="mt-2 space-y-0.5 data-mono text-[9px] text-dim">
            {(liveTrace.checkpoints ?? []).map((c, i) => (
              <li key={`${c.at}-${i}`}>
                +{c.t}ms · {c.at}
                {c.detail ? ` — ${c.detail}` : ''}
              </li>
            ))}
          </ul>
          {liveTrace.rawExcerpt ? (
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-[8px] text-dim">
              {liveTrace.rawExcerpt}
            </pre>
          ) : null}
        </div>
      ) : null}

      {view === 'planner' ? (
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[1fr_minmax(240px,300px)]">
          <div className="hud-panel min-h-0 space-y-4 overflow-y-auto p-4">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="label-caps text-[9px] text-dim">Coverage</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="hud-pill px-2 py-0.5 text-[9px]"
                    disabled={syncMutation.isPending}
                    onClick={() => syncMutation.mutate(false)}
                  >
                    Sync from audits
                  </button>
                  <button
                    type="button"
                    className="hud-pill px-2 py-0.5 text-[9px] text-alert"
                    disabled={syncMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Overwrite manual marks too? Sync will reset them from audits.',
                        )
                      ) {
                        syncMutation.mutate(true)
                      }
                    }}
                  >
                    Force sync
                  </button>
                </div>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="bg-success/80"
                  style={{
                    width: `${(coverage.solid / (conceptIds.length || 1)) * 100}%`,
                  }}
                />
                <div
                  className="bg-alert/70"
                  style={{
                    width: `${(coverage.thin / (conceptIds.length || 1)) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-dim">
                Tap a mark to cycle empty → thin → solid (manual). Sync fills
                from vision audits without wiping your manual picks.
              </p>
            </div>

            {conceptsByTopic.map(([topic, list]) => (
              <div key={topic}>
                <p className="text-[11px] text-cyan">{topic}</p>
                <ul className="mt-1.5 space-y-1">
                  {(list ?? []).map((c) => {
                    const mark = markMap.get(c.id)
                    const status = mark?.status ?? 'empty'
                    return (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/5 px-2 py-1.5"
                      >
                        <span className="min-w-0 truncate text-[11px] text-white">
                          {c.name}
                          {mark?.source === 'manual' ? (
                            <span className="ml-1 text-[8px] text-dim">
                              manual
                            </span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          className={`hud-pill shrink-0 px-2 py-0.5 text-[9px] ${MARK_STYLE[status]}`}
                          disabled={markMutation.isPending}
                          onClick={() =>
                            markMutation.mutate({
                              conceptId: c.id,
                              status: nextMarkStatus(status),
                            })
                          }
                        >
                          {status}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="hud-panel min-h-0 space-y-3 overflow-y-auto p-4">
            <p className="label-caps text-[9px] text-dim">Custom sections</p>
            <p className="text-[10px] text-muted">
              Extra binder chunks beyond the taxonomy (lab tips, mnemonic pages,
              etc.).
            </p>
            <div className="flex gap-2">
              <input
                className="field-input flex-1 text-[11px]"
                value={newSectionLabel}
                onChange={(e) => setNewSectionLabel(e.target.value)}
                placeholder="Section label"
              />
              <button
                type="button"
                className="hud-pill hud-pill-active px-2.5 py-1 text-[9px]"
                disabled={addSectionMutation.isPending}
                onClick={() => addSectionMutation.mutate()}
              >
                Add
              </button>
            </div>
            <ul className="space-y-3">
              {(sectionsQuery.data ?? []).map((section) => (
                <li
                  key={section.id}
                  className="rounded-xl border border-white/10 p-2.5"
                >
                  <input
                    className="field-input text-[11px]"
                    defaultValue={section.label}
                    onBlur={(e) => {
                      if (e.target.value !== section.label) {
                        void updateCustomSection({
                          id: section.id,
                          label: e.target.value,
                        }).then(() =>
                          qc.invalidateQueries({
                            queryKey: ['binder-sections', eventId],
                          }),
                        )
                      }
                    }}
                  />
                  <textarea
                    className="field-input mt-2 min-h-[4rem] text-[10px]"
                    defaultValue={section.notes}
                    placeholder="Notes for this section…"
                    onBlur={(e) => {
                      if (e.target.value !== section.notes) {
                        void updateCustomSection({
                          id: section.id,
                          notes: e.target.value,
                        }).then(() =>
                          qc.invalidateQueries({
                            queryKey: ['binder-sections', eventId],
                          }),
                        )
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="mt-1 text-[9px] text-alert hover:underline"
                    onClick={() => {
                      if (window.confirm('Delete this section?')) {
                        void deleteCustomSection(section.id).then(() =>
                          qc.invalidateQueries({
                            queryKey: ['binder-sections', eventId],
                          }),
                        )
                      }
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : view === 'history' ? (
        <div className="hud-panel min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10px] text-dim">
              Pending rows are stuck jobs — safe to delete.
            </p>
            {(historyQuery.data ?? []).some(
              (r) => r.status === 'pending' || r.status === 'error',
            ) ? (
              <button
                type="button"
                className="text-[10px] text-alert hover:underline"
                onClick={() => {
                  if (
                    !window.confirm(
                      'Delete all pending/error audits for this event?',
                    )
                  ) {
                    return
                  }
                  void deleteStuckBinderAudits(eventId || undefined)
                    .then(() => {
                      if (active?.status === 'pending' || active?.status === 'error') {
                        setActive(null)
                        setPhase('idle')
                      }
                      return historyQuery.refetch()
                    })
                    .catch((err) => setNote(adminErrorMessage(err)))
                }}
              >
                Clear stuck
              </button>
            ) : null}
          </div>
          {(historyQuery.data ?? []).length === 0 ? (
            <p className="text-[11px] text-muted">No audits yet for this event.</p>
          ) : (
            <ul className="space-y-2">
              {(historyQuery.data ?? []).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left hover:text-cyan"
                    onClick={() => {
                      setActive(row)
                      setPhase('done')
                      setView('audit')
                      if (row.result?._trace) {
                        setTrace(row.result._trace)
                        setShowTrace(true)
                      }
                    }}
                  >
                    <span className="block text-[11px] text-white">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                    <span className="data-mono text-[10px] text-cyan">
                      {row.status}
                      {(displayBinderOverallScore(row.result) ??
                        row.overall_score) != null
                        ? ` · ${displayBinderOverallScore(row.result) ?? row.overall_score}`
                        : ''}
                      {row.error ? ` · ${row.error.slice(0, 60)}` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] text-alert hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!window.confirm('Delete this audit?')) return
                      void deleteBinderAudit(row.id)
                        .then(() => {
                          if (active?.id === row.id) {
                            setActive(null)
                            setPhase('idle')
                          }
                          return historyQuery.refetch()
                        })
                        .catch((err) => setNote(adminErrorMessage(err)))
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : showLoading ? (
        <div className="hud-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-8">
          <div className="relative h-24 w-24">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan/30 border-t-cyan" />
            <div className="absolute inset-3 animate-pulse rounded-full bg-cyan/10" />
          </div>
          <p className="text-sm text-cyan">
            {phase === 'uploading'
              ? 'Uploading photos…'
              : lastCheckpoint
                ? `Working: ${lastCheckpoint.replace(/_/g, ' ')}`
                : 'Calling binder-audit…'}
          </p>
          <ul className="space-y-1 text-center text-[11px] text-dim">
            {LOAD_HINTS.map((step) => {
              const hit = (liveTrace?.checkpoints ?? []).some(
                (c) => c.at === step.match,
              )
              const current = lastCheckpoint === step.match
              return (
                <li
                  key={step.match}
                  className={
                    current ? 'text-cyan' : hit ? 'text-muted' : 'text-dim'
                  }
                >
                  {step.label}
                  {current ? '…' : hit ? ' ✓' : ''}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="text-[11px] text-alert hover:underline"
            onClick={() => {
              auditMutation.reset()
              setPhase('idle')
              setNote(
                'Stopped waiting locally. If History still shows pending, use Clear stuck / Delete.',
              )
              setView('history')
              void historyQuery.refetch()
            }}
          >
            Cancel / go to History
          </button>
        </div>
      ) : active && result ? (
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(240px,32%)_1fr]">
          <div className="hud-panel min-h-0 overflow-y-auto p-4">
            <p className="data-mono text-[10px] text-dim">{active.status}</p>
            <p className="mt-1 font-display text-3xl text-white">
              {displayScore ?? '—'}
              <span className="text-base text-muted"> / 100</span>
            </p>
            {result.summary ? (
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {result.summary}
              </p>
            ) : null}
            {result.reject_reason ? (
              <p className="mt-2 text-[11px] text-alert">{result.reject_reason}</p>
            ) : null}

            {result.scores ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Object.entries(result.scores).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg border border-white/10 px-2 py-1.5"
                  >
                    <p className="label-caps text-[8px] text-dim">{k}</p>
                    <p className="data-mono text-sm text-cyan">{v}/5</p>
                  </div>
                ))}
              </div>
            ) : null}

            {result.strengths && result.strengths.length > 0 ? (
              <section className="mt-4">
                <p className="label-caps text-[9px] text-dim">Strengths</p>
                <ul className="mt-1 space-y-1 text-[11px] text-muted">
                  {result.strengths.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.gaps && result.gaps.length > 0 ? (
              <section className="mt-4">
                <p className="label-caps text-[9px] text-dim">Gaps</p>
                <ul className="mt-1 space-y-1.5 text-[11px] text-muted">
                  {result.gaps.map((g) => (
                    <li key={`${g.concept_id}-${g.why}`}>
                      <span className="text-white">{g.name}</span>
                      <span className="text-dim"> · {g.why}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.fixes && result.fixes.length > 0 ? (
              <section className="mt-4">
                <p className="label-caps text-[9px] text-dim">Fix next</p>
                <ol className="mt-1 list-decimal space-y-1.5 pl-4 text-[11px] text-muted">
                  {[...result.fixes]
                    .sort((a, b) => a.priority - b.priority)
                    .map((f) => (
                      <li key={`${f.priority}-${f.action}`}>
                        {f.action}
                        {f.where_on_page ? (
                          <span className="text-dim"> ({f.where_on_page})</span>
                        ) : null}
                      </li>
                    ))}
                </ol>
              </section>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="hud-pill px-3 py-1.5 text-[10px]"
                onClick={() => {
                  setActive(null)
                  setPhase('idle')
                }}
              >
                New audit
              </button>
              <button
                type="button"
                className="hud-pill px-3 py-1.5 text-[10px]"
                onClick={() => setView('planner')}
              >
                Open planner
              </button>
            </div>
          </div>

          <div className="hud-panel min-h-0 overflow-y-auto p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <img
                src={
                  frontPreview ??
                  (active.front_path
                    ? binderPublicUrl(active.front_path)
                    : undefined)
                }
                alt="Front"
                className="w-full rounded-lg border border-white/10 object-contain"
              />
              {(backPreview || active.back_path) && (
                <img
                  src={
                    backPreview ??
                    (active.back_path
                      ? binderPublicUrl(active.back_path)
                      : undefined)
                  }
                  alt="Back"
                  className="w-full rounded-lg border border-white/10 object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="hud-panel min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-white/15 bg-white/[0.03] p-3 transition-colors hover:border-cyan/40">
              <span className="label-caps text-[9px] text-dim">Front</span>
              <span className="hud-pill hud-pill-active w-fit px-2.5 py-1 text-[9px]">
                Choose photo
              </span>
              <span className="truncate text-[11px] text-muted">
                {frontFile?.name ?? 'Required — front of cheat sheet'}
              </span>
              {frontPreview ? (
                <img
                  src={frontPreview}
                  alt="Front preview"
                  className="mt-1 max-h-40 rounded-lg object-contain"
                />
              ) : null}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={!eventId}
                onChange={(e) => setSide('front', e.target.files?.[0] ?? null)}
              />
            </label>

            <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-cyan/30 bg-cyan/[0.04] p-3 transition-colors hover:border-cyan/60">
              <span className="label-caps text-[9px] text-dim">Back</span>
              <span className="hud-pill hud-pill-active w-fit px-2.5 py-1 text-[9px]">
                Choose photo
              </span>
              <span className="truncate text-[11px] text-muted">
                {backFile?.name ?? 'Strongly recommended — other side'}
              </span>
              {backPreview ? (
                <img
                  src={backPreview}
                  alt="Back preview"
                  className="mt-1 max-h-40 rounded-lg object-contain"
                />
              ) : null}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={!eventId}
                onChange={(e) => setSide('back', e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {!backFile && frontFile ? (
            <p className="text-[11px] text-cyan">
              Cheat sheets usually have two sides — add the back for a full
              audit (you can still run with front only).
            </p>
          ) : null}

          <button
            type="button"
            className="hud-pill hud-pill-active px-4 py-2 text-[11px]"
            disabled={!frontFile || !eventId || auditMutation.isPending}
            onClick={() => {
              if (!backFile) {
                const ok = window.confirm(
                  'You only uploaded the front. Audits are much better with front + back. Run with front only?',
                )
                if (!ok) return
              }
              auditMutation.mutate()
            }}
          >
            Run binder audit
          </button>
        </div>
      )}
    </div>
  )
}
