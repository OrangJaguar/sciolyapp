import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  clampConcurrency,
  createGenerationJob,
  clearIncompleteGeneration,
  DEFAULT_GENERATION_CONFIG,
  deleteGenerationJob,
  describeGenerationJob,
  diagnoseGenerationItem,
  estimateEtaMinutes,
  estimatePaidUsd,
  fetchGenerationJobItems,
  fetchGenerationJobs,
  formatRunningAge,
  formatTokenUsage,
  invokeGenerateWorkerBatch,
  jobProgress,
  previewGeneration,
  retryFailedGenerationItems,
  setGenerationJobStatus,
  sleep,
  summarizeWorkerBatch,
  type GenerationJob,
  type GenerationJobConfig,
  type GenerationMode,
  type GenerationPreview,
} from '../../lib/adminGenerate'
import { fetchCatalogSnapshot } from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'
import { isSupabaseConfigured } from '../../lib/supabase'
import { EventBankModal } from './EventBankModal'
import { ConceptPickModal } from './ConceptPickModal'

type GenerateTab = 'workbench' | 'jobs'

function buildConfig(
  base: GenerationJobConfig,
  overrides: Partial<GenerationJobConfig>,
): GenerationJobConfig {
  return {
    ...base,
    ...overrides,
    difficultyMix: { ...base.difficultyMix, ...overrides.difficultyMix },
    window: { ...base.window, ...overrides.window },
    // Always auto-split gap into calls of questionsPerCall (A then B).
    passMode: 'A_then_B',
  }
}

export function GeneratePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tab: GenerateTab =
    params.get('v') === 'jobs' ? 'jobs' : 'workbench'
  const setTab = (next: GenerateTab) =>
    navigate(`/admin/generate?v=${next}`, { replace: true })
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<GenerationPreview | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [traceItemId, setTraceItemId] = useState<string | null>(null)
  const [workerNote, setWorkerNote] = useState<string | null>(null)

  const [workbenchConfig, setWorkbenchConfig] = useState<GenerationJobConfig>({
    ...DEFAULT_GENERATION_CONFIG,
    mode: 'fill_event',
    eventIds: ['chem_lab'],
    limitConcepts: undefined,
    passMode: 'A_then_B',
  })
  const [pickedConceptIds, setPickedConceptIds] = useState<string[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [bankEventId, setBankEventId] = useState<string | null>(null)

  const catalogQuery = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: fetchCatalogSnapshot,
    enabled: isSupabaseConfigured,
  })

  const jobsQuery = useQuery({
    queryKey: ['admin-generation-jobs'],
    queryFn: fetchGenerationJobs,
    enabled: isSupabaseConfigured,
    refetchInterval: activeJobId ? 3000 : false,
  })

  const activeJob = useMemo(
    () => jobsQuery.data?.find((job) => job.id === activeJobId) ?? null,
    [jobsQuery.data, activeJobId],
  )

  const itemsQuery = useQuery({
    queryKey: ['admin-generation-items', activeJobId],
    queryFn: () => fetchGenerationJobItems(activeJobId!),
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      if (activeJob?.status === 'running') return 3000
      const rows = query.state.data
      if (rows?.some((item) => item.status === 'running')) return 3000
      return false
    },
  })

  const studyableEvents = useMemo(
    () => (catalogQuery.data?.events ?? []).filter((event) => event.studyable),
    [catalogQuery.data?.events],
  )

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of catalogQuery.data?.events ?? []) {
      map.set(event.id, event.name)
    }
    return map
  }, [catalogQuery.data?.events])

  const canPickConcepts =
    workbenchConfig.mode !== 'fill_season' &&
    Boolean(workbenchConfig.limitConcepts && workbenchConfig.limitConcepts > 0) &&
    Boolean(workbenchConfig.eventIds?.[0])

  const resolveJobConfig = (): GenerationJobConfig => {
    if (pickedConceptIds.length > 0) {
      return buildConfig(workbenchConfig, {
        mode: 'workbench',
        conceptIds: pickedConceptIds,
        eventIds: workbenchConfig.eventIds,
        limitConcepts: undefined,
      })
    }
    return buildConfig(workbenchConfig, {
      eventIds:
        workbenchConfig.mode === 'fill_season'
          ? undefined
          : workbenchConfig.eventIds,
      conceptIds: undefined,
    })
  }

  const previewMutation = useMutation({
    mutationFn: previewGeneration,
    onSuccess: (data) => {
      setPreview(data)
      setNote(null)
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const startMutation = useMutation({
    mutationFn: createGenerationJob,
    onSuccess: async (jobId) => {
      setActiveJobId(jobId)
      setTab('jobs')
      setNote('Job started — worker draining queue')
      await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const statusMutation = useMutation({
    mutationFn: async (input: {
      jobId: string
      status: GenerationJob['status']
      pauseReason?: string
    }) => {
      await setGenerationJobStatus(input.jobId, input.status, input.pauseReason)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGenerationJob,
    onSuccess: async (_data, jobId) => {
      if (activeJobId === jobId) setActiveJobId(null)
      await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const retryMutation = useMutation({
    mutationFn: retryFailedGenerationItems,
    onSuccess: async (_data, jobId) => {
      setActiveJobId(jobId)
      await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
      await qc.invalidateQueries({ queryKey: ['admin-generation-items', jobId] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const clearIncompleteMutation = useMutation({
    mutationFn: clearIncompleteGeneration,
    onSuccess: async (result) => {
      setNote(
        `Cleared incomplete generation: ${result.jobs_cancelled} job(s), ${result.items_cleared} item(s)${
          result.orphan_fingerprints_deleted
            ? `, ${result.orphan_fingerprints_deleted} orphan fingerprint(s)`
            : ''
        }. Preview again.`,
      )
      setPreview(null)
      await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
      await qc.invalidateQueries({ queryKey: ['admin-catalog'] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  useEffect(() => {
    if (!activeJobId || activeJob?.status !== 'running') return

    let cancelled = false
    let consecutiveFailures = 0
    const concurrency = clampConcurrency(activeJob.config?.concurrency ?? 3)

    const run = async () => {
      setWorkerNote(`Draining ×${concurrency} parallel…`)

      while (!cancelled) {
        try {
          const batch = await invokeGenerateWorkerBatch(activeJobId, concurrency)
          consecutiveFailures = 0

          await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
          await qc.invalidateQueries({
            queryKey: ['admin-generation-items', activeJobId],
          })

          if (batch.allOutsideWindow) {
            setWorkerNote('Outside run window — waiting 60s')
            await sleep(60_000)
            continue
          }

          if (batch.paused) {
            setWorkerNote('Job paused')
            break
          }

          if (batch.finished) {
            setWorkerNote('Job finished')
            break
          }

          // Pool workers found nothing queued while siblings still run
          if (
            !batch.anyProcessed &&
            batch.ticks.length > 0 &&
            batch.ticks.every((t) => t.idle)
          ) {
            setWorkerNote(`×${concurrency} pool · waiting on in-flight items`)
            await sleep(2000)
            continue
          }

          // All invokes threw (network / undeployed) — count as batch failure
          if (batch.ticks.length === 0 && batch.errors.length > 0) {
            throw new Error(batch.errors[0] ?? 'Worker batch failed')
          }

          setWorkerNote(summarizeWorkerBatch(batch, concurrency))

          if (batch.anyProcessed) {
            await qc.invalidateQueries({ queryKey: ['admin-drafts'] })
            await qc.invalidateQueries({ queryKey: ['admin-catalog'] })
          }

          // Brief pause between batches (NIM is slow; this is just courtesy)
          await sleep(400)
        } catch (err) {
          consecutiveFailures += 1
          const message = adminErrorMessage(err)
          setWorkerNote(message)

          if (consecutiveFailures >= 3) {
            await setGenerationJobStatus(
              activeJobId,
              'paused',
              'worker_unreachable',
            )
            setNote(
              'Worker paused after 3 failed batch invokes — no NIM calls were made. Deploy generate-worker, then Resume.',
            )
            await qc.invalidateQueries({ queryKey: ['admin-generation-jobs'] })
            break
          }

          await sleep(5000)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeJobId, activeJob?.status, activeJob?.config?.concurrency, qc])

  const currentPreviewCost = preview
    ? estimatePaidUsd(preview, workbenchConfig.provider)
    : null

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to use Generate.
      </div>
    )
  }

  if (catalogQuery.isLoading) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Loading catalog…
      </div>
    )
  }

  if (catalogQuery.isError || !catalogQuery.data) {
    return (
      <div className="hud-panel flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-alert">{adminErrorMessage(catalogQuery.error)}</p>
        <p className="text-xs text-dim">Run SCIOLY-0805-ADMIN-CATALOG SQL, then reload.</p>
      </div>
    )
  }

  const renderKnobs = (
    config: GenerationJobConfig,
    setConfig: (next: GenerationJobConfig) => void,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="flex flex-col gap-1.5">
        <span className="label-caps text-[9px] text-dim">Mode</span>
        <select
          value={config.mode === 'workbench' ? 'fill_event' : config.mode}
          onChange={(e) => {
            const mode = e.target.value as GenerationMode
            setConfig({ ...config, mode })
            if (mode === 'fill_season') setPickedConceptIds([])
          }}
          className="field-input"
        >
          <option value="fill_event">Fill event</option>
          <option value="fill_season">Fill season</option>
          <option value="top_up">Top-up below target</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-caps text-[9px] text-dim">Target / concept</span>
        <input
          type="number"
          min={1}
          max={60}
          value={config.targetPerConcept}
          onChange={(e) =>
            setConfig({
              ...config,
              targetPerConcept: Number(e.target.value) || 30,
            })
          }
          className="field-input"
        />
        <span className="text-[9px] text-dim">
          Calls auto-split: target ÷ Q per call (Pass A then B).
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-caps text-[9px] text-dim">Q per call</span>
        <input
          type="number"
          min={1}
          max={20}
          value={config.questionsPerCall}
          onChange={(e) =>
            setConfig({
              ...config,
              questionsPerCall: Math.min(20, Math.max(1, Number(e.target.value) || 8)),
            })
          }
          className="field-input"
        />
        <span className="text-[9px] text-dim">
          NIM sweet spot ~8. DeepSeek later can go lower if needed.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-caps text-[9px] text-dim">Parallel calls</span>
        <input
          type="number"
          min={1}
          max={8}
          value={config.concurrency ?? 3}
          onChange={(e) =>
            setConfig({
              ...config,
              concurrency: clampConcurrency(Number(e.target.value) || 3),
            })
          }
          className="field-input"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-caps text-[9px] text-dim">Provider</span>
        <select
          value={config.provider}
          onChange={(e) =>
            setConfig({
              ...config,
              provider: e.target.value as GenerationJobConfig['provider'],
            })
          }
          className="field-input"
        >
          <option value="nim">NIM (free test)</option>
          <option value="deepseek_flash">DeepSeek Flash (wire later)</option>
          <option value="deepseek_pro">DeepSeek Pro (wire later)</option>
        </select>
      </label>

      <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
        <span className="label-caps text-[9px] text-dim">Concepts to fill</span>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={500}
            placeholder="All"
            value={config.limitConcepts ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              const next =
                raw === '' ? undefined : Math.max(0, Number(raw) || 0) || undefined
              setConfig({ ...config, limitConcepts: next })
              if (!next) {
                setPickedConceptIds([])
              } else {
                setPickedConceptIds((ids) => ids.slice(0, next))
              }
            }}
            className="field-input flex-1"
          />
          <button
            type="button"
            className="hud-pill shrink-0 px-3 py-2 text-[10px] disabled:opacity-40"
            disabled={!canPickConcepts}
            title={
              canPickConcepts
                ? 'Pick exact concepts'
                : 'Type a Concepts to fill number first (not All)'
            }
            onClick={() => setPickOpen(true)}
          >
            Select concepts
          </button>
        </div>
        <span className="text-[9px] text-dim">
          {pickedConceptIds.length > 0
            ? `${pickedConceptIds.length} picked — exact set (not auto).`
            : 'Blank = all gaps. Number only = auto-pick that many with gaps. Select concepts locks exact IDs.'}
        </span>
      </div>

      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={config.includeGuide}
          onChange={(e) => setConfig({ ...config, includeGuide: e.target.checked })}
        />
        <span className="text-xs text-muted">Include Clinic guide</span>
      </label>

      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={config.includeMedia}
          onChange={(e) => setConfig({ ...config, includeMedia: e.target.checked })}
        />
        <span className="text-xs text-muted">Include media menu</span>
      </label>

      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={Boolean(config.window?.enabled)}
          onChange={(e) =>
            setConfig({
              ...config,
              window: {
                ...(config.window ?? DEFAULT_GENERATION_CONFIG.window),
                enabled: e.target.checked,
              },
            })
          }
        />
        <span className="text-xs text-muted">Run window (off-peak)</span>
      </label>
    </div>
  )

  const renderPreview = () => {
    if (!preview) return null
    return (
      <div className="mt-4 rounded-xl border border-subtle bg-[var(--surface-high)] p-4">
        <p className="label-caps text-[9px] text-dim">Preview</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Concepts" value={String(preview.concept_count)} />
          <Stat label="Requests" value={String(preview.request_count)} />
          <Stat label="Draft Qs" value={String(preview.question_count)} />
          <Stat
            label="ETA"
            value={`~${estimateEtaMinutes(
              preview.request_count,
              workbenchConfig.concurrency,
            )} min`}
          />
        </div>
        {(preview.inflight_reserved ?? 0) > 0 ? (
          <p className="mt-2 text-[10px] text-alert">
            {preview.inflight_reserved} slot(s) reserved by old paused/running jobs
            (not in the questions table). That shrinks Draft Qs below target×concepts.
            Use Clear incomplete jobs, then Preview again.
          </p>
        ) : null}
        {(preview.skipped_full ?? 0) > 0 ? (
          <p className="mt-2 text-[10px] text-muted">
            Skipped {preview.skipped_full} concept(s) already at/above target while
            filling the concepts-to-fill quota.
          </p>
        ) : null}
        <p className="mt-1 text-[10px] text-dim">
          Requests = auto chunks of Q-per-call until each concept hits target
          (Pass A then B). No separate passes knob.
        </p>
        {currentPreviewCost != null ? (
          <p className="mt-2 text-xs text-muted">
            Est. paid cost ~${currentPreviewCost.toFixed(2)} (off-peak heuristic)
          </p>
        ) : (
          <p className="mt-2 text-xs text-cyan">NIM test credits — not a paid run</p>
        )}
        {preview.blockers.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {preview.blockers.map((blocker, index) => (
              <li key={`${blocker.type}-${index}`} className="text-xs text-alert">
                {blocker.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      {note ? <p className="text-xs text-cyan">{note}</p> : null}
      {workerNote && tab === 'jobs' ? (
        <p className="text-xs text-muted">{workerNote}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'workbench' ? (
          <div className="hud-panel space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="flex flex-col gap-1.5">
                <span className="label-caps text-[9px] text-dim">Event</span>
                <select
                  value={workbenchConfig.eventIds?.[0] ?? ''}
                  disabled={workbenchConfig.mode === 'fill_season'}
                  onChange={(e) => {
                    setWorkbenchConfig({
                      ...workbenchConfig,
                      eventIds: e.target.value ? [e.target.value] : [],
                    })
                    setPickedConceptIds([])
                    setPreview(null)
                  }}
                  className="field-input"
                >
                  {studyableEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="hud-pill px-3 py-2 text-[10px]"
                  disabled={
                    workbenchConfig.mode === 'fill_season' ||
                    !workbenchConfig.eventIds?.[0]
                  }
                  onClick={() =>
                    setBankEventId(workbenchConfig.eventIds?.[0] ?? null)
                  }
                >
                  View bank
                </button>
              </div>
            </div>

            <div className="pt-1">{renderKnobs(workbenchConfig, setWorkbenchConfig)}</div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="hud-pill hud-pill-active px-3 py-1.5 text-[10px]"
                disabled={previewMutation.isPending}
                onClick={() => previewMutation.mutate(resolveJobConfig())}
              >
                Preview
              </button>
              <button
                type="button"
                className="hud-pill px-3 py-1.5 text-[10px]"
                disabled={
                  startMutation.isPending ||
                  !preview ||
                  preview.blockers.length > 0 ||
                  preview.request_count === 0
                }
                onClick={() => startMutation.mutate(resolveJobConfig())}
              >
                GO
              </button>
              <button
                type="button"
                className="hud-pill px-3 py-1.5 text-[10px] text-alert"
                disabled={clearIncompleteMutation.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Cancel all paused/running generation jobs and clear their queued items? Use this after wiping questions so Preview stops treating old jobs as coverage.',
                    )
                  ) {
                    return
                  }
                  clearIncompleteMutation.mutate()
                }}
              >
                Clear incomplete jobs
              </button>
            </div>

            {renderPreview()}
          </div>
        ) : null}

        {tab === 'jobs' ? (
          <div className="grid gap-2 lg:grid-cols-[minmax(240px,320px)_1fr]">
            <div className="hud-panel overflow-hidden">
              <div className="border-b border-subtle px-3 py-2">
                <p className="label-caps text-[9px] text-dim">Recent jobs</p>
              </div>
              <ul className="max-h-[32rem] overflow-y-auto p-2">
                {(jobsQuery.data ?? []).map((job) => {
                  const summary = describeGenerationJob(job, eventNameById)
                  return (
                  <li
                    key={job.id}
                    className={`mb-1 flex items-start gap-1 rounded-lg ${
                      activeJobId === job.id ? 'bg-cyan/10' : 'hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveJobId(job.id)}
                      className="min-w-0 flex-1 px-2 py-2 text-left"
                    >
                      <p className="label-caps text-[8px] text-dim">
                        {job.kind} · {job.status}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-foreground">
                        {summary.title}
                      </p>
                      <p className="mt-1 data-mono text-[9px] leading-snug text-muted">
                        {summary.detail}
                        {(job.items_partial ?? 0) > 0
                          ? ` · ${job.items_partial} partial`
                          : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      title="Delete job"
                      className="mt-2 mr-1 shrink-0 rounded px-1.5 py-1 text-[9px] text-dim hover:bg-alert/20 hover:text-alert"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (
                          window.confirm(
                            'Delete this job from Recent? Drafts already written stay in Review.',
                          )
                        ) {
                          deleteMutation.mutate(job.id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </li>
                  )
                })}
              </ul>
            </div>

            <div className="hud-panel p-4">
              {!activeJob ? (
                <p className="text-sm text-muted">Select a job to monitor progress.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="label-caps text-[9px] text-dim">Active job</p>
                      <h2 className="mt-1 font-display text-lg text-foreground">
                        {
                          describeGenerationJob(activeJob, eventNameById).title
                        }
                      </h2>
                      <p className="mt-1 data-mono text-[10px] text-muted">
                        {describeGenerationJob(activeJob, eventNameById).detail}
                      </p>
                      <p className="mt-0.5 data-mono text-[9px] text-dim">{activeJob.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeJob.status === 'running' ? (
                        <button
                          type="button"
                          className="hud-pill px-2 py-1 text-[10px]"
                          onClick={() =>
                            statusMutation.mutate({
                              jobId: activeJob.id,
                              status: 'paused',
                              pauseReason: 'manual',
                            })
                          }
                        >
                          Pause
                        </button>
                      ) : null}
                      {activeJob.status === 'paused' ? (
                        <button
                          type="button"
                          className="hud-pill px-2 py-1 text-[10px]"
                          onClick={() =>
                            statusMutation.mutate({
                              jobId: activeJob.id,
                              status: 'running',
                            })
                          }
                        >
                          Resume
                        </button>
                      ) : null}
                      {activeJob.status !== 'cancelled' && activeJob.status !== 'done' ? (
                        <button
                          type="button"
                          className="hud-pill px-2 py-1 text-[10px]"
                          onClick={() =>
                            statusMutation.mutate({
                              jobId: activeJob.id,
                              status: 'cancelled',
                            })
                          }
                        >
                          Cancel
                        </button>
                      ) : null}
                      {(activeJob.items_failed > 0 ||
                        (activeJob.items_partial ?? 0) > 0) ? (
                        <button
                          type="button"
                          className="hud-pill px-2 py-1 text-[10px]"
                          onClick={() => retryMutation.mutate(activeJob.id)}
                        >
                          Retry incomplete
                        </button>
                      ) : null}
                      <Link
                        to="/admin/review"
                        className="hud-pill px-2 py-1 text-[10px] text-cyan"
                      >
                        Open Review
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                    <div
                      className="h-full bg-cyan transition-all"
                      style={{ width: `${jobProgress(activeJob)}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <Stat
                      label="Done"
                      value={`${activeJob.items_done}/${activeJob.items_total}`}
                    />
                    <Stat
                      label="Partial"
                      value={String(activeJob.items_partial ?? 0)}
                    />
                    <Stat label="Failed" value={String(activeJob.items_failed)} />
                    <Stat label="Drafts" value={String(activeJob.questions_written)} />
                    <Stat
                      label="Job tokens"
                      value={
                        formatTokenUsage(activeJob.token_usage) ?? '—'
                      }
                    />
                  </div>

                  <p className="mt-3 text-xs text-muted">
                    Drafts landed ≠ live bank. Pass A drains before Pass B. Under-delivery
                    requeues up to 2 shortfall calls, then marks partial. Items stuck
                    running &gt;4 min auto-requeue on next claim (worker timeout/crash).
                  </p>

                  <ul className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto">
                    {(itemsQuery.data ?? []).map((item) => {
                      const open = traceItemId === item.id
                      const tokenLabel = formatTokenUsage(item.token_usage)
                      const diagnosis = diagnoseGenerationItem(item)
                      const runningAge = formatRunningAge(item)
                      return (
                        <li
                          key={item.id}
                          className="rounded-lg border border-subtle px-3 py-2 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-foreground">{item.concept_id}</span>
                            <span className="data-mono text-[9px] text-dim">
                              Pass {item.pass} · {item.status}
                              {runningAge ? ` · ${runningAge}` : ''}
                              {item.finish_reason
                                ? ` · ${item.finish_reason}`
                                : ''}
                            </span>
                          </div>
                          {diagnosis ? (
                            <p
                              className={`mt-1 data-mono text-[9px] ${
                                diagnosis === 'stale_suspected' ||
                                diagnosis === 'stale_timeout' ||
                                diagnosis === 'cot_leak' ||
                                diagnosis === 'nim_timeout'
                                  ? 'text-alert'
                                  : 'text-cyan'
                              }`}
                            >
                              diagnose: {diagnosis}
                            </p>
                          ) : null}
                          <p className="mt-1 text-muted">
                            {item.n_written}/{item.n_requested} written
                            {item.n_outstanding > 0 && item.status === 'queued'
                              ? ` · ${item.n_outstanding} outstanding`
                              : ''}
                            {item.n_rejected ? ` · ${item.n_rejected} rejected` : ''}
                            {item.shortfall_retries
                              ? ` · shortfall ${item.shortfall_retries}/2`
                              : ''}
                          </p>
                          {tokenLabel ? (
                            <p className="mt-0.5 data-mono text-[9px] text-dim">
                              tokens {tokenLabel}
                              {item.finish_reason === 'length'
                                ? ' · truncated at max_tokens'
                                : ''}
                            </p>
                          ) : null}
                          {item.error ? (
                            <p className="mt-1 text-alert">{item.error}</p>
                          ) : null}
                          {item.raw_excerpt || item.error || tokenLabel ? (
                            <button
                              type="button"
                              className="mt-1 text-[9px] text-cyan"
                              onClick={() =>
                                setTraceItemId(open ? null : item.id)
                              }
                            >
                              {open ? 'Hide NIM trace' : 'Show NIM trace'}
                            </button>
                          ) : null}
                          {open ? (
                            <div className="mt-2 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {tokenLabel ? (
                                  <p className="data-mono text-[9px] text-cyan">
                                    usage: {tokenLabel}
                                    {item.finish_reason
                                      ? ` · finish_reason=${item.finish_reason}`
                                      : ''}
                                    {diagnosis ? ` · ${diagnosis}` : ''}
                                  </p>
                                ) : null}
                                <button
                                  type="button"
                                  className="hud-pill px-2 py-0.5 text-[9px]"
                                  onClick={async () => {
                                    const text = [
                                      diagnosis ? `diagnosis: ${diagnosis}` : null,
                                      tokenLabel
                                        ? `usage: ${tokenLabel}${
                                            item.finish_reason
                                              ? ` · finish_reason=${item.finish_reason}`
                                              : ''
                                          }`
                                        : null,
                                      item.error ? `error: ${item.error}` : null,
                                      item.raw_excerpt?.trim() ||
                                        'No model output stored.',
                                    ]
                                      .filter(Boolean)
                                      .join('\n\n')
                                    try {
                                      await navigator.clipboard.writeText(text)
                                      setNote('NIM trace copied to clipboard')
                                    } catch {
                                      setNote('Clipboard copy failed — select the trace manually')
                                    }
                                  }}
                                >
                                  Copy trace
                                </button>
                              </div>
                              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-[var(--surface-high)] p-2 data-mono text-[9px] text-muted">
                                {item.raw_excerpt?.trim()
                                  ? item.raw_excerpt
                                  : 'No model output stored (failed before NIM, or excerpt empty).'}
                              </pre>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <p className="shrink-0 text-[10px] text-dim">
        Run SQL paste-check{' '}
        <span className="data-mono text-muted">SCIOLY-0814-GENERATE-DIAGNOSE</span>
        {' '}(+ 0812/0813 if not yet). Redeploy{' '}
        <span className="data-mono text-muted">generate-worker</span>
        {' '}after this for timeouts + crash fail + diagnose tags.
      </p>

      {bankEventId && catalogQuery.data ? (
        <EventBankModal
          open={Boolean(bankEventId)}
          onClose={() => setBankEventId(null)}
          eventId={bankEventId}
          eventName={
            studyableEvents.find((e) => e.id === bankEventId)?.name ?? bankEventId
          }
          snapshot={catalogQuery.data}
          targetPerConcept={workbenchConfig.targetPerConcept}
        />
      ) : null}

      {pickOpen &&
      catalogQuery.data &&
      workbenchConfig.eventIds?.[0] &&
      workbenchConfig.limitConcepts ? (
        <ConceptPickModal
          open={pickOpen}
          onClose={() => setPickOpen(false)}
          onConfirm={(ids) => {
            setPickedConceptIds(ids)
            setPreview(null)
            setNote(
              ids.length > 0
                ? `Locked ${ids.length} concept(s) for next Preview/GO`
                : 'Cleared picks — next Preview auto-selects gaps',
            )
          }}
          eventId={workbenchConfig.eventIds[0]}
          eventName={
            studyableEvents.find((e) => e.id === workbenchConfig.eventIds?.[0])
              ?.name ?? workbenchConfig.eventIds[0]
          }
          snapshot={catalogQuery.data}
          maxSelect={workbenchConfig.limitConcepts}
          initialSelected={pickedConceptIds}
          targetPerConcept={workbenchConfig.targetPerConcept}
        />
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-subtle px-3 py-2">
      <p className="label-caps text-[8px] text-dim">{label}</p>
      <p className="mt-1 data-mono text-sm text-foreground">{value}</p>
    </div>
  )
}
