import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCatalogSnapshot } from '../../lib/adminCatalog'
import {
  archiveImportBatch,
  commitImportBatch,
  estimateTokens,
  extractPdfText,
  fetchImportBatches,
  parsePasteMcq,
  suggestConcepts,
  validateImportRows,
  type ImportDraftRow,
  type ImportSource,
} from '../../lib/adminImport'
import { adminErrorMessage } from '../../lib/adminQuestions'
import { isSupabaseConfigured } from '../../lib/supabase'

type Tab = 'import' | 'batches'

export function ImportPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tab: Tab = params.get('v') === 'batches' ? 'batches' : 'import'
  const [eventId, setEventId] = useState('chem_lab')
  const [label, setLabel] = useState('')
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<ImportDraftRow[]>([])
  const [source, setSource] = useState<ImportSource>('paste')
  const [note, setNote] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [testName, setTestName] = useState<string | null>(null)
  const [keyName, setKeyName] = useState<string | null>(null)

  const catalogQuery = useQuery({
    queryKey: ['admin-catalog'],
    queryFn: fetchCatalogSnapshot,
    enabled: isSupabaseConfigured,
  })

  const batchesQuery = useQuery({
    queryKey: ['admin-import-batches'],
    queryFn: fetchImportBatches,
    enabled: isSupabaseConfigured,
  })

  const studyableEvents = useMemo(
    () => (catalogQuery.data?.events ?? []).filter((e) => e.studyable),
    [catalogQuery.data?.events],
  )

  const concepts = useMemo(
    () =>
      (catalogQuery.data?.concepts ?? []).filter((c) => c.event_id === eventId),
    [catalogQuery.data?.concepts, eventId],
  )

  const eventName = useMemo(() => {
    const map = new Map(
      (catalogQuery.data?.events ?? []).map((e) => [e.id, e.name]),
    )
    return (id: string) => map.get(id) ?? id
  }, [catalogQuery.data?.events])

  const tokens = estimateTokens(raw)
  const readyCount = validateImportRows(rows, eventId, concepts).ok.length

  const runParse = () => {
    try {
      const parsed = parsePasteMcq(raw)
      setRows(parsed)
      setNote(
        parsed.length === 0
          ? '0 parsed — need numbered stems with A–D options'
          : `${parsed.length} parsed`,
      )
    } catch (err) {
      setNote(adminErrorMessage(err))
    }
  }

  const loadPdfs = async (testFile: File | null, keyFile: File | null) => {
    if (!testFile && !keyFile) return
    setPdfBusy(true)
    setNote(null)
    try {
      let text = ''
      if (testFile) {
        text = await extractPdfText(testFile)
      }
      if (keyFile) {
        const keyText = await extractPdfText(keyFile)
        text = text
          ? `${text}\n\nAnswers:\n${keyText}`
          : `Answers:\n${keyText}`
      }
      setRaw(text)
      setSource('pdf')
      setRows([])
      setNote('PDF text loaded — click Parse')
    } catch (err) {
      setNote(adminErrorMessage(err))
    } finally {
      setPdfBusy(false)
    }
  }

  const commitMutation = useMutation({
    mutationFn: async () => {
      const { ok, errors } = validateImportRows(rows, eventId, concepts)
      if (ok.length === 0) {
        throw new Error(
          errors[0] ?? 'Assign concepts and fix rows before commit',
        )
      }
      return commitImportBatch({
        eventId,
        source,
        label: label || `${source} · ${eventName(eventId)}`,
        rows: ok,
      })
    },
    onSuccess: async (result) => {
      setNote(`Committed ${result.imported} (${result.skipped} skipped)`)
      setRows([])
      setRaw('')
      setTestName(null)
      setKeyName(null)
      setSource('paste')
      await qc.invalidateQueries({ queryKey: ['admin-import-batches'] })
      await qc.invalidateQueries({ queryKey: ['admin-review-queue'] })
      await qc.invalidateQueries({ queryKey: ['admin-critic-stats'] })
      await qc.invalidateQueries({ queryKey: ['admin-catalog'] })
      navigate('/admin/import?v=batches', { replace: true })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveImportBatch,
    onSuccess: async (n) => {
      setNote(`Archived · ${n} questions`)
      await qc.invalidateQueries({ queryKey: ['admin-import-batches'] })
      await qc.invalidateQueries({ queryKey: ['admin-review-queue'] })
      await qc.invalidateQueries({ queryKey: ['admin-catalog'] })
    },
    onError: (err) => setNote(adminErrorMessage(err)),
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to use Import.
      </div>
    )
  }

  if (catalogQuery.isLoading) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      {note ? <p className="shrink-0 text-xs text-cyan">{note}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'import' ? (
          <div className="space-y-3">
            <div className="hud-panel space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  className="field-input"
                  value={eventId}
                  aria-label="Event"
                  onChange={(e) => {
                    setEventId(e.target.value)
                    setRows((cur) =>
                      cur.map((r) => ({ ...r, concept_id: '' })),
                    )
                  }}
                >
                  {studyableEvents.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Batch label"
                  aria-label="Batch label"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-white/15 bg-white/[0.04] px-3 py-2 transition-colors hover:border-cyan/40 hover:bg-cyan/5">
                  <span className="hud-pill hud-pill-active shrink-0 px-2.5 py-1 text-[9px]">
                    Choose
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {testName ?? 'Questions PDF'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={pdfBusy}
                    onChange={(e) => {
                      const test = e.target.files?.[0] ?? null
                      setTestName(test?.name ?? null)
                      void loadPdfs(test, null)
                    }}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-white/15 bg-white/[0.04] px-3 py-2 transition-colors hover:border-cyan/40 hover:bg-cyan/5">
                  <span className="hud-pill hud-pill-active shrink-0 px-2.5 py-1 text-[9px]">
                    Choose
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {keyName ?? 'Answer key PDF'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={pdfBusy}
                    onChange={async (e) => {
                      const key = e.target.files?.[0] ?? null
                      if (!key) return
                      setKeyName(key.name)
                      setPdfBusy(true)
                      try {
                        const keyText = await extractPdfText(key)
                        setRaw((prev) =>
                          prev.trim()
                            ? `${prev.trim()}\n\nAnswers:\n${keyText}`
                            : `Answers:\n${keyText}`,
                        )
                        setSource('pdf')
                        setRows([])
                        setNote('Key text appended — click Parse')
                      } catch (err) {
                        setNote(adminErrorMessage(err))
                      } finally {
                        setPdfBusy(false)
                      }
                    }}
                  />
                </label>
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute top-2 right-2 z-10 data-mono text-[9px] text-dim">
                  ~{tokens.toLocaleString()} tokens
                </span>
                <textarea
                  className="field-input min-h-[10rem] pt-6 data-mono text-[10px]"
                  value={raw}
                  onChange={(e) => {
                    setRaw(e.target.value)
                    if (source === 'pdf') setSource('paste')
                  }}
                  placeholder="1. Stem…&#10;A) …&#10;B) …&#10;C) …&#10;D) …&#10;&#10;Answers: 1B 2C …"
                  aria-label="Import text"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="hud-pill hud-pill-active px-3 py-1.5 text-[10px]"
                  disabled={!raw.trim() || pdfBusy}
                  onClick={runParse}
                >
                  Parse
                </button>
                <button
                  type="button"
                  className="hud-pill px-3 py-1.5 text-[10px]"
                  disabled={
                    commitMutation.isPending ||
                    rows.length === 0 ||
                    readyCount === 0
                  }
                  onClick={() => commitMutation.mutate()}
                >
                  Commit drafts
                  {readyCount > 0 ? ` (${readyCount})` : ''}
                </button>
                <button
                  type="button"
                  className="hud-pill ml-auto px-3 py-1.5 text-[10px] text-alert"
                  disabled={
                    !raw && rows.length === 0 && !testName && !keyName
                  }
                  onClick={() => {
                    setRaw('')
                    setRows([])
                    setNote(null)
                    setTestName(null)
                    setKeyName(null)
                    setSource('paste')
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {rows.length > 0 ? (
              <div className="hud-panel space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="data-mono text-[9px] text-dim">
                    {rows.length} · {readyCount} ready
                  </p>
                </div>
                {rows.map((row, index) => {
                  const suggestions = suggestConcepts(row.stem, concepts)
                  return (
                    <div
                      key={`row-${index}`}
                      className="rounded-xl border border-white/10 p-3"
                    >
                      <p className="text-[10px] text-dim">#{index + 1}</p>
                      <textarea
                        className="field-input mt-1 min-h-[4rem] text-[11px]"
                        value={row.stem}
                        onChange={(e) =>
                          setRows((cur) =>
                            cur.map((r, i) =>
                              i === index ? { ...r, stem: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {(['A', 'B', 'C', 'D'] as const).map((key) => (
                          <label key={key} className="flex items-center gap-1">
                            <button
                              type="button"
                              className={`hud-pill px-1.5 py-0.5 text-[9px] ${
                                row.correct_key === key ? 'hud-pill-active' : ''
                              }`}
                              onClick={() =>
                                setRows((cur) =>
                                  cur.map((r, i) =>
                                    i === index
                                      ? { ...r, correct_key: key }
                                      : r,
                                  ),
                                )
                              }
                            >
                              {key}
                            </button>
                            <input
                              className="field-input flex-1 text-[10px]"
                              value={row.options[key]}
                              onChange={(e) =>
                                setRows((cur) =>
                                  cur.map((r, i) =>
                                    i === index
                                      ? {
                                          ...r,
                                          options: {
                                            ...r.options,
                                            [key]: e.target.value,
                                          },
                                        }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <select
                        className="field-input mt-2 text-[11px]"
                        value={row.concept_id}
                        aria-label={`Concept for question ${index + 1}`}
                        onChange={(e) =>
                          setRows((cur) =>
                            cur.map((r, i) =>
                              i === index
                                ? { ...r, concept_id: e.target.value }
                                : r,
                            ),
                          )
                        }
                      >
                        <option value="">Concept…</option>
                        {suggestions.length > 0 ? (
                          <optgroup label="Suggested">
                            {suggestions.map((c) => (
                              <option key={`s-${c.id}`} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        <optgroup label="All">
                          {concepts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="hud-panel p-4">
            <ul className="space-y-2">
              {(batchesQuery.data ?? []).length === 0 ? (
                <li className="text-[11px] text-muted">No batches yet.</li>
              ) : (
                (batchesQuery.data ?? []).map((batch) => (
                  <li
                    key={batch.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <div>
                      <p className="text-[11px] text-white">{batch.label}</p>
                      <p className="data-mono text-[9px] text-dim">
                        {eventName(batch.event_id)} · {batch.source} ·{' '}
                        {batch.row_count} · {batch.status}
                      </p>
                    </div>
                    {batch.status === 'committed' ? (
                      <button
                        type="button"
                        className="hud-pill px-2 py-1 text-[9px] text-alert"
                        disabled={archiveMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Archive this batch?')) {
                            archiveMutation.mutate(batch.id)
                          }
                        }}
                      >
                        Archive
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
