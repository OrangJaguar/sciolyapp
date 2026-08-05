import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  addEventMedia,
  deleteEventMedia,
  fetchEventMedia,
  parseCommaTags,
  setEventMediaActive,
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
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
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
      const url = new URL(sourceUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('URL must use http or https')
      }
      const userId = user?.id ?? profile?.id
      if (!userId) throw new Error('No authenticated admin user')
      await addEventMedia({
        eventId,
        label,
        sourceUrl: url.toString(),
        tags: parseCommaTags(tags),
        notes,
        userId,
      })
    },
    onSuccess: async () => {
      setLabel('')
      setSourceUrl('')
      setTags('')
      setNotes('')
      setActionNote('Media reference registered')
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
      setActionNote('Media reference removed')
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
            <span className="label-caps text-[9px] text-dim">
              Public source URL
            </span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
              className="field-input data-mono text-[10px]"
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
              Usage / rights notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Source, license, what question styles may use it…"
              className="field-input resize-y"
            />
          </label>
          <button
            type="button"
            disabled={
              addMutation.isPending ||
              !eventId ||
              !label.trim() ||
              !sourceUrl.trim()
            }
            onClick={() => addMutation.mutate()}
            className="hud-pill hud-pill-active w-full py-1.5 text-[10px] disabled:opacity-40"
          >
            {addMutation.isPending ? 'Registering…' : 'Register media'}
          </button>
          {actionNote ? (
            <p
              className={`text-[10px] ${
                /denied|fail|error|required|url/i.test(actionNote)
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
              {items.length} asset{items.length === 1 ? '' : 's'}
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
                  Register a trusted URL using the form.
                </p>
              </div>
            </div>
          ) : null}
          <ul className="grid gap-2 xl:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`overflow-hidden rounded-xl border bg-void ${
                  item.active ? 'border-white/10' : 'border-alert/20 opacity-60'
                }`}
              >
                {item.source_url ? (
                  <div className="flex h-28 items-center justify-center overflow-hidden bg-white/[0.03]">
                    <img
                      src={item.source_url}
                      alt={item.label}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-white">{item.label}</p>
                      <a
                        href={item.source_url ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 block truncate data-mono text-[8px] text-cyan hover:underline"
                      >
                        {item.source_url ?? item.storage_path}
                      </a>
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
                  {item.notes ? (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-dim">
                      {item.notes}
                    </p>
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
                    Remove reference
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
