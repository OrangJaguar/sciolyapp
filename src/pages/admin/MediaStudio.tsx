import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  addEventMedia,
  deleteEventMedia,
  fetchEventMedia,
  mediaTagFromName,
  parseCommaTags,
  setEventMediaActive,
  updateEventMedia,
  uploadEventMediaFile,
  type CatalogSnapshot,
  type EventMedia,
} from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'

const TARGET_MIN = 12
const TARGET_MAX = 30

type Draft = {
  label: string
  sourceUrl: string
  tags: string
  description: string
  notes: string
  specificity: 'broad' | 'specific'
}

function emptyDraft(): Draft {
  return {
    label: '',
    sourceUrl: '',
    tags: '',
    description: '',
    notes: '',
    specificity: 'broad',
  }
}

function isErrorNote(note: string) {
  return /denied|fail|error|required|url|upload|choose|provide|invalid|keep|image/i.test(
    note,
  )
}

export function MediaStudio({ snapshot }: { snapshot: CatalogSnapshot }) {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const studyableEvents = useMemo(
    () =>
      snapshot.events
        .filter((event) => event.studyable)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.events],
  )

  const [eventId, setEventId] = useState(studyableEvents[0]?.id ?? '')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [actionNote, setActionNote] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const mediaQuery = useQuery({
    queryKey: ['admin-event-media'],
    queryFn: fetchEventMedia,
  })

  const eventTopics = useMemo(
    () =>
      snapshot.topics
        .filter((topic) => topic.event_id === eventId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [eventId, snapshot.topics],
  )

  const eventItems = useMemo(
    () => (mediaQuery.data ?? []).filter((item) => item.event_id === eventId),
    [eventId, mediaQuery.data],
  )

  const activeCount = eventItems.filter((item) => item.active).length
  const broadCount = eventItems.filter(
    (item) => item.active && item.specificity === 'broad',
  ).length

  const visibleItems = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase()
    return eventItems.filter((item) => {
      if (!showInactive && !item.active) return false
      if (!q) return true
      return (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [eventItems, libraryQuery, showInactive])

  const editingItem = editingId
    ? (eventItems.find((item) => item.id === editingId) ?? null)
    : null

  const coverageLabel =
    activeCount < TARGET_MIN
      ? `thin · aim ${TARGET_MIN}–${TARGET_MAX} active`
      : activeCount <= TARGET_MAX
        ? 'on target'
        : 'plenty — prefer broad reuse'

  function resetForm() {
    setDraft(emptyDraft())
    setFile(null)
    setEditingId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function loadForEdit(item: EventMedia) {
    setEditingId(item.id)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setDraft({
      label: item.label,
      sourceUrl: '',
      tags: item.tags.join(', '),
      description: item.description,
      notes: item.notes,
      specificity: item.specificity,
    })
    setActionNote(`Editing “${item.label}” — save to update metadata.`)
  }

  function acceptFile(next: File | null) {
    if (!next) {
      setFile(null)
      return
    }
    if (!next.type.startsWith('image/')) {
      setActionNote('Upload an image (PNG, JPEG, WebP, or GIF).')
      return
    }
    if (next.size > 8 * 1024 * 1024) {
      setActionNote('Keep uploads under 8 MB.')
      return
    }
    setFile(next)
    setDraft((current) => {
      const base = next.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      return {
        ...current,
        sourceUrl: '',
        label: current.label.trim() || base,
      }
    })
  }

  function toggleTag(tag: string) {
    const current = parseCommaTags(draft.tags)
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag]
    setDraft((state) => ({ ...state, tags: next.join(', ') }))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.label.trim()) throw new Error('Label is required')
      if (!draft.description.trim()) {
        throw new Error(
          'Description is required — Generate reads this to pick figures.',
        )
      }
      const userId = user?.id ?? profile?.id
      if (!userId) throw new Error('No authenticated admin user')

      if (editingId) {
        await updateEventMedia({
          id: editingId,
          label: draft.label,
          tags: parseCommaTags(draft.tags),
          notes: draft.notes,
          description: draft.description,
          specificity: draft.specificity,
        })
        return 'updated' as const
      }

      let sourceUrlFinal: string | null = null
      let storagePath: string | null = null

      if (file) {
        const uploaded = await uploadEventMediaFile(eventId, file)
        sourceUrlFinal = uploaded.publicUrl
        storagePath = uploaded.storagePath
      } else if (draft.sourceUrl.trim()) {
        let url: URL
        try {
          url = new URL(draft.sourceUrl.trim())
        } catch {
          throw new Error('URL is invalid')
        }
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('URL must use http or https')
        }
        sourceUrlFinal = url.toString()
      } else {
        throw new Error('Upload a file or paste a public URL')
      }

      await addEventMedia({
        eventId,
        label: draft.label,
        sourceUrl: sourceUrlFinal,
        storagePath,
        tags: parseCommaTags(draft.tags),
        notes: draft.notes,
        description: draft.description,
        specificity: draft.specificity,
        userId,
      })
      return 'added' as const
    },
    onSuccess: async (mode) => {
      resetForm()
      setActionNote(mode === 'updated' ? 'Media updated' : 'Media registered')
      await qc.invalidateQueries({ queryKey: ['admin-event-media'] })
    },
    onError: (error) => setActionNote(adminErrorMessage(error)),
  })

  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setEventMediaActive(id, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-event-media'] })
    },
    onError: (error) => setActionNote(adminErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEventMedia,
    onSuccess: async () => {
      if (editingId) resetForm()
      setActionNote('Media removed')
      await qc.invalidateQueries({ queryKey: ['admin-event-media'] })
    },
    onError: (error) => setActionNote(adminErrorMessage(error)),
  })

  const previewSrc = filePreview || draft.sourceUrl.trim() || null
  const busy =
    saveMutation.isPending ||
    activeMutation.isPending ||
    deleteMutation.isPending

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto lg:grid lg:grid-cols-[340px_1fr] lg:overflow-hidden">
      <aside className="hud-panel min-h-[22rem] shrink-0 overflow-y-auto p-3 lg:min-h-0 lg:shrink">
        <div className="space-y-2.5">
          <div>
            <p className="label-caps text-[9px] text-dim">Event media</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Prefer <span className="text-cyan">broad</span> reusable charts,
              diagrams, and tables. Tag topics so Generate can match them.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Event</span>
            <select
              value={eventId}
              onChange={(event) => {
                setEventId(event.target.value)
                resetForm()
                setLibraryQuery('')
                setActionNote(null)
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

          {editingItem ? (
            <div className="rounded-lg border border-cyan/30 bg-cyan/5 px-2.5 py-2">
              <p className="text-[10px] text-cyan">
                Editing metadata for “{editingItem.label}”
              </p>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setActionNote(null)
                }}
                className="mt-1 text-[9px] uppercase tracking-wider text-muted hover:text-foreground"
              >
                Cancel edit · add new instead
              </button>
            </div>
          ) : null}

          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Label</span>
            <input
              value={draft.label}
              onChange={(event) =>
                setDraft((state) => ({ ...state, label: event.target.value }))
              }
              placeholder="HR diagram — annotated main sequence"
              className="field-input"
            />
          </label>

          {!editingId ? (
            <>
              <div
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  acceptFile(event.dataTransfer.files?.[0] ?? null)
                }}
                className={`rounded-xl border border-dashed p-3 transition-colors ${
                  dragOver
                    ? 'border-cyan bg-cyan/10'
                    : 'border-subtle bg-void'
                }`}
              >
                <p className="label-caps text-[9px] text-dim">Upload image</p>
                <p className="mt-1 text-[10px] text-muted">
                  Drop a file here, or choose one. PNG / JPEG / WebP / GIF · max
                  8 MB.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="mt-2 field-input text-[10px]"
                  onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="mt-1.5 data-mono text-[9px] text-cyan">
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </p>
                ) : null}
              </div>

              <label className="block space-y-1">
                <span className="label-caps text-[9px] text-dim">
                  Or public URL
                </span>
                <input
                  value={draft.sourceUrl}
                  onChange={(event) => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                    setDraft((state) => ({
                      ...state,
                      sourceUrl: event.target.value,
                    }))
                  }}
                  disabled={Boolean(file)}
                  placeholder="https://…"
                  className="field-input data-mono text-[10px] disabled:opacity-40"
                />
                {file ? (
                  <p className="text-[9px] text-dim">
                    Clear the file to use a URL instead.
                  </p>
                ) : null}
              </label>

              {previewSrc ? (
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg border border-subtle bg-void">
                  <img
                    src={previewSrc}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[10px] leading-relaxed text-dim">
              Image file stays as-is while editing. Remove and re-add to replace
              the figure.
            </p>
          )}

          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Specificity</span>
            <select
              className="field-input"
              value={draft.specificity}
              onChange={(e) =>
                setDraft((state) => ({
                  ...state,
                  specificity: e.target.value as 'broad' | 'specific',
                }))
              }
            >
              <option value="broad">
                Broad — reusable across many questions
              </option>
              <option value="specific">
                Specific — only for tightly tagged stems
              </option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Description (Generate menu)
            </span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder="What the figure shows, labeled parts, and which question styles it supports…"
              className="field-input resize-y"
            />
          </label>

          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Tags (comma separated)
            </span>
            <input
              value={draft.tags}
              onChange={(event) =>
                setDraft((state) => ({ ...state, tags: event.target.value }))
              }
              placeholder="hr_diagram, stellar_evolution"
              className="field-input data-mono text-[10px]"
            />
            {eventTopics.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {eventTopics.map((topic) => {
                  const tag = mediaTagFromName(topic.name)
                  const on = parseCommaTags(draft.tags).includes(tag)
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-2 py-0.5 data-mono text-[8px] transition-colors ${
                        on
                          ? 'border-cyan/50 bg-cyan/10 text-cyan'
                          : 'border-subtle text-muted hover:border-cyan/30 hover:text-foreground'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Rights / notes
            </span>
            <textarea
              value={draft.notes}
              onChange={(event) =>
                setDraft((state) => ({ ...state, notes: event.target.value }))
              }
              rows={2}
              placeholder="Source, license, attribution…"
              className="field-input resize-y"
            />
          </label>

          <button
            type="button"
            disabled={
              busy ||
              !eventId ||
              !draft.label.trim() ||
              !draft.description.trim() ||
              (!editingId && !file && !draft.sourceUrl.trim())
            }
            onClick={() => saveMutation.mutate()}
            className="hud-pill hud-pill-active w-full py-1.5 text-[10px] disabled:opacity-40"
          >
            {saveMutation.isPending
              ? 'Saving…'
              : editingId
                ? 'Save changes'
                : 'Add media'}
          </button>
          {actionNote ? (
            <p
              className={`text-[10px] ${
                isErrorNote(actionNote) ? 'text-alert' : 'text-cyan'
              }`}
            >
              {actionNote}
            </p>
          ) : null}
        </div>
      </aside>

      <section className="hud-panel flex min-h-[24rem] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:shrink">
        <div className="shrink-0 space-y-2 border-b border-subtle px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label-caps text-[9px] text-dim">
                {snapshot.events.find((event) => event.id === eventId)?.name ??
                  eventId}
              </p>
              <p className="mt-0.5 data-mono text-[9px] text-muted">
                {activeCount} active · {broadCount} broad · {eventItems.length}{' '}
                total · {coverageLabel}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-[9px] text-muted">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-[var(--cyan)]"
              />
              Show disabled
            </label>
          </div>
          <input
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
            placeholder="Filter by label, tag, or description…"
            className="field-input"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {mediaQuery.isLoading ? (
            <p className="p-4 text-center text-xs text-muted">Loading media…</p>
          ) : null}
          {mediaQuery.isError ? (
            <p className="p-4 text-center text-xs text-alert">
              {adminErrorMessage(mediaQuery.error)}
            </p>
          ) : null}
          {!mediaQuery.isLoading && visibleItems.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center text-center">
              <div>
                <p className="text-xs text-muted">
                  {eventItems.length === 0
                    ? 'No media for this event yet.'
                    : 'No assets match this filter.'}
                </p>
                <p className="mt-1 text-[10px] text-dim">
                  Start with broad reusable diagrams — not one-off scenario art.
                </p>
              </div>
            </div>
          ) : null}
          <ul className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
            {visibleItems.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                busy={busy}
                onEdit={() => loadForEdit(item)}
                onToggleActive={() =>
                  activeMutation.mutate({
                    id: item.id,
                    active: !item.active,
                  })
                }
                onDelete={() => {
                  if (
                    window.confirm(
                      `Remove “${item.label}” from the media library?`,
                    )
                  ) {
                    deleteMutation.mutate(item)
                  }
                }}
              />
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function MediaCard({
  item,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  item: EventMedia
  busy: boolean
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [broken, setBroken] = useState(false)
  const src = item.source_url

  return (
    <li
      className={`overflow-hidden rounded-xl border bg-void ${
        item.active ? 'border-subtle' : 'border-alert/20 opacity-60'
      }`}
    >
      {src && !broken ? (
        <div className="flex h-28 items-center justify-center overflow-hidden bg-void">
          <img
            src={src}
            alt={item.label}
            loading="lazy"
            onError={() => setBroken(true)}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center bg-void text-[10px] text-dim">
          {src ? 'Preview unavailable' : 'No preview URL'}
        </div>
      )}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs text-foreground">{item.label}</p>
            <p className="data-mono text-[8px] text-dim">
              {item.specificity}
              {item.storage_path ? ' · uploaded' : ' · url'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onToggleActive}
            className={`hud-pill shrink-0 px-2 py-0.5 text-[8px] ${
              item.active ? 'hud-pill-active' : ''
            }`}
          >
            {item.active ? 'Active' : 'Disabled'}
          </button>
        </div>
        {item.description ? (
          <p className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-muted">
            {item.description}
          </p>
        ) : (
          <p className="mt-1.5 text-[10px] text-alert">
            Missing description — Generate can’t use this well.
          </p>
        )}
        {item.tags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-subtle px-2 py-0.5 data-mono text-[8px] text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[9px] text-dim">
            No tags — add topic tags so Generate can match.
          </p>
        )}
        {item.notes ? (
          <p className="mt-1.5 line-clamp-2 text-[9px] text-dim">{item.notes}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="text-[9px] uppercase tracking-wider text-cyan hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="text-[9px] uppercase tracking-wider text-alert hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}
