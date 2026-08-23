import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  addEventMedia,
  deleteEventMedia,
  fetchEventMedia,
  parseCommaTags,
  setEventMediaActive,
  uploadEventMediaFile,
  type CatalogEvent,
} from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'

export function MediaStudio({ events }: { events: CatalogEvent[] }) {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const firstEvent = events.find((event) => event.studyable) ?? events[0]
  const [eventId, setEventId] = useState(firstEvent?.id ?? '')
  const [label, setLabel] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [specificity, setSpecificity] = useState<'broad' | 'specific'>('broad')
  const [actionNote, setActionNote] = useState<string | null>(null)

  const mediaQuery = useQuery({
    queryKey: ['admin-event-media'],
    queryFn: fetchEventMedia,
  })
  const items = useMemo(
    () => (mediaQuery.data ?? []).filter((item) => item.event_id === eventId),
    [eventId, mediaQuery.data],
  )

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error('Label is required')
      if (!description.trim()) throw new Error('Description is required')
      const userId = user?.id ?? profile?.id
      if (!userId) throw new Error('No authenticated admin user')

      let sourceUrlFinal: string | null = null
      let storagePath: string | null = null

      if (file) {
        const uploaded = await uploadEventMediaFile(eventId, file)
        sourceUrlFinal = uploaded.publicUrl
        storagePath = uploaded.storagePath
      } else if (sourceUrl.trim()) {
        const url = new URL(sourceUrl.trim())
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('URL must use http or https')
        }
        sourceUrlFinal = url.toString()
      } else {
        throw new Error('Upload a file or paste a public URL')
      }

      await addEventMedia({
        eventId,
        label,
        sourceUrl: sourceUrlFinal,
        storagePath,
        tags: parseCommaTags(tags),
        notes,
        description,
        specificity,
        userId,
      })
    },
    onSuccess: async () => {
      setLabel('')
      setSourceUrl('')
      setFile(null)
      setTags('')
      setDescription('')
      setNotes('')
      setSpecificity('broad')
      setActionNote('Media registered')
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
      setActionNote('Media removed')
      await qc.invalidateQueries({ queryKey: ['admin-event-media'] })
    },
    onError: (error) => setActionNote(adminErrorMessage(error)),
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto lg:grid lg:grid-cols-[300px_1fr] lg:overflow-hidden">
      <aside className="hud-panel min-h-[22rem] shrink-0 overflow-y-auto p-3 lg:min-h-0 lg:shrink">
        <div className="space-y-2.5">
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Event</span>
            <select
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              className="field-input"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Label</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Titration curve — weak acid"
              className="field-input"
            />
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Upload image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="field-input text-[10px]"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Or public URL
            </span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
              className="field-input data-mono text-[10px]"
            />
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">Specificity</span>
            <select
              className="field-input"
              value={specificity}
              onChange={(e) =>
                setSpecificity(e.target.value as 'broad' | 'specific')
              }
            >
              <option value="broad">Broad (reusable)</option>
              <option value="specific">Specific (tight tag match)</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Description (for Generate menu)
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What the figure shows and which question styles it supports…"
              className="field-input resize-y"
            />
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Tags (comma separated)
            </span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="titration_curve, acid_base"
              className="field-input data-mono text-[10px]"
            />
          </label>
          <label className="block space-y-1">
            <span className="label-caps text-[9px] text-dim">
              Rights / notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Source, license…"
              className="field-input resize-y"
            />
          </label>
          <button
            type="button"
            disabled={
              addMutation.isPending ||
              !eventId ||
              !label.trim() ||
              !description.trim() ||
              (!file && !sourceUrl.trim())
            }
            onClick={() => addMutation.mutate()}
            className="hud-pill hud-pill-active w-full py-1.5 text-[10px] disabled:opacity-40"
          >
            {addMutation.isPending ? 'Saving…' : 'Add media'}
          </button>
          {actionNote ? (
            <p
              className={`text-[10px] ${
                /denied|fail|error|required|url|upload/i.test(actionNote)
                  ? 'text-alert'
                  : 'text-cyan'
              }`}
            >
              {actionNote}
            </p>
          ) : null}
        </div>
      </aside>

      <section className="hud-panel flex min-h-[24rem] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:shrink">
        <div className="shrink-0 border-b border-white/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="label-caps text-[9px] text-dim">
              {events.find((event) => event.id === eventId)?.name ?? eventId}
            </p>
            <p className="data-mono text-[9px] text-dim">
              {items.length} asset{items.length === 1 ? '' : 's'} · aim 15–40
            </p>
          </div>
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
          {!mediaQuery.isLoading && items.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center text-center">
              <div>
                <p className="text-xs text-muted">No media for this event yet.</p>
                <p className="mt-1 text-[10px] text-dim">
                  Upload a figure or register a trusted URL.
                </p>
              </div>
            </div>
          ) : null}
          <ul className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => {
              const src = item.source_url
              return (
                <li
                  key={item.id}
                  className={`overflow-hidden rounded-xl border bg-void ${
                    item.active
                      ? 'border-white/10'
                      : 'border-alert/20 opacity-60'
                  }`}
                >
                  {src ? (
                    <div className="flex h-28 items-center justify-center overflow-hidden bg-white/[0.03]">
                      <img
                        src={src}
                        alt={item.label}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : null}
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-white">
                          {item.label}
                        </p>
                        <p className="data-mono text-[8px] text-dim">
                          {item.specificity}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={activeMutation.isPending}
                        onClick={() =>
                          activeMutation.mutate({
                            id: item.id,
                            active: !item.active,
                          })
                        }
                        className={`hud-pill shrink-0 px-2 py-0.5 text-[8px] ${
                          item.active ? 'hud-pill-active' : ''
                        }`}
                      >
                        {item.active ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                    {item.description ? (
                      <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                        {item.description}
                      </p>
                    ) : null}
                    {item.tags.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 px-2 py-0.5 data-mono text-[8px] text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove “${item.label}” from the media library?`,
                          )
                        ) {
                          deleteMutation.mutate(item.id)
                        }
                      }}
                      className="mt-2 text-[9px] uppercase tracking-wider text-alert hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
