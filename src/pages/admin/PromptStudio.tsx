import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  ensurePromptPack,
  fetchPromptPacks,
  savePromptPack,
  type CatalogSnapshot,
  type PromptPack,
} from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'

const FEW_SHOT_TEMPLATE = JSON.stringify(
  [
    {
      stem: 'Replace with one gold-standard event-style question.',
      options: {
        A: 'Distractor A',
        B: 'Correct answer',
        C: 'Distractor C',
        D: 'Distractor D',
      },
      correct_key: 'B',
      explanation: 'Explain why B is correct and why the trap is plausible.',
      citation: 'Source or rules section',
      style_notes: 'What this example teaches the generator about this event.',
    },
  ],
  null,
  2,
)

export function PromptStudio({ snapshot }: { snapshot: CatalogSnapshot }) {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>('master')
  const [newScope, setNewScope] = useState<'event' | 'topic'>('event')
  const [newScopeId, setNewScopeId] = useState('')
  const [createNote, setCreateNote] = useState<string | null>(null)

  const packsQuery = useQuery({
    queryKey: ['admin-prompt-packs'],
    queryFn: fetchPromptPacks,
  })
  const packs = packsQuery.data ?? []
  const selected =
    packs.find((pack) => pack.id === selectedId) ??
    packs.find((pack) => pack.id === 'master') ??
    packs[0] ??
    null

  const scopeOptions = useMemo(() => {
    if (newScope === 'event') {
      return snapshot.events.map((event) => ({
        id: event.id,
        name: event.name,
      }))
    }
    return snapshot.topics.map((topic) => {
      const event = snapshot.events.find((item) => item.id === topic.event_id)
      return {
        id: topic.id,
        name: `${event?.name ?? topic.event_id} · ${topic.name}`,
      }
    })
  }, [newScope, snapshot.events, snapshot.topics])

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedScope = scopeOptions.find((option) => option.id === newScopeId)
      if (!selectedScope) throw new Error('Choose an event or topic')
      return ensurePromptPack({
        scopeType: newScope,
        scopeId: selectedScope.id,
        name: `${selectedScope.name} ${newScope === 'event' ? 'Style Pack' : 'Topic Overlay'}`,
      })
    },
    onSuccess: async (id) => {
      setCreateNote('Pack ready')
      setSelectedId(id)
      await qc.invalidateQueries({ queryKey: ['admin-prompt-packs'] })
    },
    onError: (error) => setCreateNote(adminErrorMessage(error)),
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto lg:grid lg:grid-cols-[260px_1fr] lg:overflow-hidden">
      <aside className="hud-panel flex min-h-[20rem] shrink-0 flex-col overflow-hidden lg:min-h-0 lg:shrink">
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {packsQuery.isError ? (
            <p className="p-2 text-[10px] text-alert">
              {adminErrorMessage(packsQuery.error)}
            </p>
          ) : null}
          {(['master', 'event', 'topic'] as const).map((scope) => {
            const scoped = packs.filter((pack) => pack.scope_type === scope)
            if (scoped.length === 0) return null
            return (
              <div key={scope} className="mb-2">
                <p className="px-1.5 py-0.5 label-caps text-[8px] text-dim">
                  {scope === 'master'
                    ? '01 · Global contract'
                    : scope === 'event'
                      ? '02 · Event style'
                      : '03 · Topic overlays'}
                </p>
                {scoped.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedId(pack.id)}
                    className={`mb-0.5 w-full rounded-lg px-2 py-1.5 text-left ${
                      selected?.id === pack.id
                        ? 'bg-cyan/10 text-white'
                        : 'text-muted hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="block text-[11px] leading-snug">
                      {pack.name}
                    </span>
                    <span className="mt-0.5 flex gap-2 data-mono text-[8px] uppercase text-dim">
                      <span>v{pack.version}</span>
                      <span className={pack.active ? 'text-success' : 'text-alert'}>
                        {pack.active ? 'active' : 'inactive'}
                      </span>
                      <span className={pack.system_body.trim() ? 'text-muted' : 'text-alert'}>
                        {pack.system_body.trim() ? 'authored' : 'empty'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-white/5 p-2">
          <p className="label-caps text-[9px] text-dim">Add missing pack</p>
          <div className="grid grid-cols-[80px_1fr] gap-1.5">
            <select
              value={newScope}
              onChange={(event) => {
                setNewScope(event.target.value as 'event' | 'topic')
                setNewScopeId('')
              }}
              className="field-input text-[10px]"
            >
              <option value="event">Event</option>
              <option value="topic">Topic</option>
            </select>
            <select
              value={newScopeId}
              onChange={(event) => setNewScopeId(event.target.value)}
              className="field-input min-w-0 text-[10px]"
            >
              <option value="">Choose…</option>
              {scopeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!newScopeId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="hud-pill w-full py-1 text-[9px] disabled:opacity-40"
          >
            Create / open pack
          </button>
          {createNote ? (
            <p className="text-[9px] text-muted">{createNote}</p>
          ) : null}
        </div>
      </aside>

      <section className="hud-panel min-h-[30rem] shrink-0 overflow-hidden lg:min-h-0 lg:shrink">
        {selected ? (
          <PromptEditor
            key={`${selected.id}:${selected.version}`}
            pack={selected}
            userId={user?.id ?? profile?.id ?? ''}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-xs text-muted">
            {packsQuery.isLoading ? 'Loading prompt packs…' : 'No prompt packs found.'}
          </div>
        )}
      </section>
    </div>
  )
}

function PromptEditor({
  pack,
  userId,
}: {
  pack: PromptPack
  userId: string
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(pack.name)
  const [body, setBody] = useState(pack.system_body)
  const [fewShotsText, setFewShotsText] = useState(
    JSON.stringify(pack.few_shots, null, 2),
  )
  const [active, setActive] = useState(pack.active)
  const [note, setNote] = useState<string | null>(null)

  const parsedFewShots = useMemo(() => {
    try {
      const value = JSON.parse(fewShotsText) as unknown
      if (!Array.isArray(value)) return { value: null, error: 'Must be a JSON array' }
      return { value, error: null }
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'Invalid JSON',
      }
    }
  }, [fewShotsText])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('No authenticated admin user')
      if (!name.trim()) throw new Error('Pack name is required')
      if (parsedFewShots.error || !parsedFewShots.value) {
        throw new Error(parsedFewShots.error ?? 'Invalid few-shot JSON')
      }
      return savePromptPack({
        id: pack.id,
        name,
        systemBody: body,
        fewShots: parsedFewShots.value,
        active,
        version: pack.version,
        userId,
      })
    },
    onSuccess: async () => {
      setNote(`Saved as version ${pack.version + 1}`)
      await qc.invalidateQueries({ queryKey: ['admin-prompt-packs'] })
    },
    onError: (error) => setNote(adminErrorMessage(error)),
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/5 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="label-caps text-[9px] text-dim">{pack.id}</p>
            <p className="mt-0.5 data-mono text-[8px] text-dim">
              version {pack.version} · updated{' '}
              {new Date(pack.updated_at).toLocaleString()}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[10px] text-muted">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="accent-cyan"
            />
            Active in generation
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <label className="block space-y-1">
          <span className="label-caps text-[9px] text-dim">Pack name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field-input"
          />
        </label>

        <label className="block space-y-1">
          <span className="label-caps text-[9px] text-dim">
            Instructions / style bible
          </span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={16}
            placeholder={
              pack.scope_type === 'master'
                ? 'Paste the master JSON contract, quality rules, difficulty bands, and anti-hallucination requirements…'
                : 'Paste event-specific question style, scientific boundaries, common traps, calculation expectations, and source requirements…'
            }
            className="field-input min-h-[16rem] resize-y data-mono text-[11px] leading-relaxed"
          />
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label-caps text-[9px] text-dim">
                Gold few-shots · JSON array
              </p>
              <p className="mt-0.5 text-[9px] text-muted">
                Best used on event packs: 2–4 reviewed examples that teach style.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFewShotsText(FEW_SHOT_TEMPLATE)}
              className="hud-pill px-2 py-0.5 text-[9px]"
            >
              Insert template
            </button>
          </div>
          <textarea
            value={fewShotsText}
            onChange={(event) => setFewShotsText(event.target.value)}
            rows={12}
            spellCheck={false}
            className={`field-input mt-1.5 min-h-[12rem] resize-y data-mono text-[11px] leading-relaxed ${
              parsedFewShots.error ? 'border-alert/70' : ''
            }`}
          />
          <p
            className={`mt-1 data-mono text-[9px] ${
              parsedFewShots.error ? 'text-alert' : 'text-success'
            }`}
          >
            {parsedFewShots.error
              ? parsedFewShots.error
              : `Valid array · ${parsedFewShots.value?.length ?? 0} example(s)`}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-void p-2.5">
          <p className="label-caps text-[9px] text-dim">Assembly order in Plan 23</p>
          <p className="mt-1.5 data-mono text-[9px] leading-relaxed text-muted">
            MASTER → EVENT → OPTIONAL TOPIC → CONCEPT NAME / DESCRIPTION /
            DEPTH TAGS → OPTIONAL GUIDE EXCERPT → EXACT JSON OUTPUT REQUEST
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/5 px-3 py-2">
        <button
          type="button"
          disabled={saveMutation.isPending || Boolean(parsedFewShots.error)}
          onClick={() => saveMutation.mutate()}
          className="hud-pill hud-pill-active px-3 py-1 text-[10px] disabled:opacity-40"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save + version'}
        </button>
        {note ? (
          <p
            className={`text-[10px] ${
              /denied|fail|error|invalid/i.test(note)
                ? 'text-alert'
                : 'text-cyan'
            }`}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  )
}
