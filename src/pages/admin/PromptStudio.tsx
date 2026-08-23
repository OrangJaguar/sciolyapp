import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  ensureBinderMasterPack,
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
  const [showAdvancedTopic, setShowAdvancedTopic] = useState(false)

  const packsQuery = useQuery({
    queryKey: ['admin-prompt-packs'],
    queryFn: fetchPromptPacks,
  })
  const packs = packsQuery.data ?? []

  useEffect(() => {
    void ensureBinderMasterPack()
      .then(() => qc.invalidateQueries({ queryKey: ['admin-prompt-packs'] }))
      .catch(() => {
        /* migration not applied yet — sidebar stays without binder until SQL */
      })
  }, [qc])

  const selected =
    packs.find((pack) => pack.id === selectedId) ??
    packs.find((pack) => pack.id === 'master') ??
    packs[0] ??
    null

  const createMutation = useMutation({
    mutationFn: async () => {
      if (newScope === 'event') {
        const event = snapshot.events.find((item) => item.id === newScopeId)
        if (!event) throw new Error('Choose an event')
        return ensurePromptPack({
          scopeType: 'event',
          scopeId: event.id,
          name: `${event.name} Style Pack`,
        })
      }
      const topic = snapshot.topics.find((item) => item.id === newScopeId)
      if (!topic) throw new Error('Choose a topic')
      const event = snapshot.events.find((item) => item.id === topic.event_id)
      return ensurePromptPack({
        scopeType: 'topic',
        scopeId: topic.id,
        name: `${event?.name ?? topic.event_id} · ${topic.name} Overlay`,
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
          {(['master', 'binder_master', 'event', 'topic'] as const).map((scope) => {
            const scoped = packs.filter((pack) => pack.scope_type === scope)
            if (scoped.length === 0) return null
            return (
              <div key={scope} className="mb-2">
                <p className="truncate px-1.5 py-0.5 label-caps text-[7px] leading-none text-dim">
                  {scope === 'master'
                    ? '01 · Master'
                    : scope === 'binder_master'
                      ? '02 · Binder'
                      : scope === 'event'
                        ? '03 · Events'
                        : '04 · Topics'}
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
          <p className="label-caps text-[9px] text-dim">Add event pack</p>
          <p className="text-[9px] leading-snug text-dim">
            You need one event pack per studyable event. Topic overlays are
            optional and rare — skip them for season 1.
          </p>
          <select
            value={newScopeId}
            onChange={(event) => {
              setNewScope('event')
              setNewScopeId(event.target.value)
            }}
            className="field-input min-w-0 text-[10px]"
          >
            <option value="">Choose event…</option>
            {snapshot.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!newScopeId || createMutation.isPending}
            onClick={() => {
              setNewScope('event')
              createMutation.mutate()
            }}
            className="hud-pill w-full py-1 text-[9px] disabled:opacity-40"
          >
            Create / open event pack
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedTopic((v) => !v)}
            className="w-full truncate text-left data-mono text-[7px] uppercase leading-none text-dim hover:text-muted"
          >
            {showAdvancedTopic ? 'Hide topic overlays' : 'Topic overlays'}
          </button>
          {showAdvancedTopic ? (
            <div className="space-y-1.5 border-t border-white/5 pt-1.5">
              <select
                value={newScope === 'topic' ? newScopeId : ''}
                onChange={(event) => {
                  setNewScope('topic')
                  setNewScopeId(event.target.value)
                }}
                className="field-input min-w-0 text-[10px]"
              >
                <option value="">Choose topic…</option>
                {snapshot.topics.map((topic) => {
                  const event = snapshot.events.find(
                    (item) => item.id === topic.event_id,
                  )
                  return (
                    <option key={topic.id} value={topic.id}>
                      {event?.name ?? topic.event_id} · {topic.name}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                disabled={
                  newScope !== 'topic' ||
                  !newScopeId ||
                  createMutation.isPending
                }
                onClick={() => createMutation.mutate()}
                className="hud-pill w-full py-1 text-[9px] disabled:opacity-40"
              >
                Create topic overlay
              </button>
            </div>
          ) : null}
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
  const [binderCriteria, setBinderCriteria] = useState(
    pack.binder_criteria ?? '',
  )
  const [fewShotsText, setFewShotsText] = useState(
    JSON.stringify(pack.few_shots, null, 2),
  )
  const [active, setActive] = useState(pack.active)
  const [note, setNote] = useState<string | null>(null)

  const parsedFewShots = useMemo(() => {
    try {
      const value = JSON.parse(fewShotsText) as unknown
      if (!Array.isArray(value)) {
        return { value: null as unknown[] | null, error: 'Must be a JSON array' }
      }
      return { value, error: null as string | null }
    } catch (error) {
      return {
        value: null as unknown[] | null,
        error: error instanceof Error ? error.message : 'Invalid JSON',
      }
    }
  }, [fewShotsText])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('No authenticated admin user')
      if (!name.trim()) throw new Error('Pack name is required')
      const fewShotsForSave =
        pack.scope_type === 'master' || pack.scope_type === 'binder_master'
          ? []
          : (() => {
              if (parsedFewShots.error || !parsedFewShots.value) {
                throw new Error(parsedFewShots.error ?? 'Invalid few-shot JSON')
              }
              return parsedFewShots.value
            })()
      return savePromptPack({
        id: pack.id,
        name,
        systemBody: body,
        fewShots: fewShotsForSave,
        binderCriteria:
          pack.scope_type === 'event' ? binderCriteria : '',
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

  const layerCopy =
    pack.scope_type === 'master'
      ? {
          title: 'Master contract',
          blurb:
            'Shared rules for every event. JSON schema, distractors, difficulty, no invented facts. No few-shots here — those live on event packs.',
          bodyLabel: 'Global instructions / contract',
          placeholder:
            'Role, exact JSON output schema, distractor rules, difficulty bands, anti-hallucination, formatting…',
        }
      : pack.scope_type === 'binder_master'
        ? {
            title: 'Binder master critic',
            blurb:
              'Global coach for page audits. Output schema, scorecard, reject rules, anti-generic fluff. Event-specific criteria live on each event style pack (below few-shots).',
            bodyLabel: 'Binder critic system prompt',
            placeholder:
              'Role, score dimensions, JSON schema, reject/low_confidence rules, how to cite the page, forbid vague praise…',
          }
        : pack.scope_type === 'event'
          ? {
              title: 'Event style pack',
              blurb:
                'How THIS event’s questions sound. Research real SciOly style for this event. Few-shots go here (2–4 gold MCQs). Binder audit criteria sit under few-shots.',
              bodyLabel: 'Event style bible',
              placeholder:
                'Question shapes, calc vs vocab balance, trap families, what “hard” means, citation style, media habits…',
            }
          : {
              title: 'Topic overlay (rare)',
              blurb:
                'Only when one topic inside an event is weird enough that the event pack is wrong for it. Most topics need no overlay.',
              bodyLabel: 'Topic overlay instructions',
              placeholder:
                'Extra rules only for this topic…',
            }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/5 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="label-caps text-[9px] text-cyan">{layerCopy.title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted">
              {layerCopy.blurb}
            </p>
            <p className="mt-1 truncate data-mono text-[8px] text-dim">
              {pack.id} · v{pack.version} ·{' '}
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
            Active
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
            {layerCopy.bodyLabel}
          </span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={16}
            placeholder={layerCopy.placeholder}
            className="field-input min-h-[16rem] resize-y data-mono text-[11px] leading-relaxed"
          />
        </label>

        {pack.scope_type === 'master' || pack.scope_type === 'binder_master' ? (
          <div className="rounded-lg border border-white/10 bg-void p-2.5">
            <p className="label-caps text-[9px] text-dim">Few-shots</p>
            <p className="mt-1 text-[10px] leading-snug text-muted">
              {pack.scope_type === 'binder_master'
                ? 'Not used on the binder critic. Put event-specific audit criteria on each event style pack (below gold few-shots).'
                : (
                  <>
                    Not used on the master pack. Open an{' '}
                    <span className="text-cyan">event</span> pack and add 2–4 gold
                    MCQs there so the model copies that event’s style.
                  </>
                )}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="label-caps text-[9px] text-dim">
                  Gold few-shots · JSON array
                </p>
                <p className="mt-0.5 text-[9px] text-muted">
                  {pack.scope_type === 'event'
                    ? '2–4 hand-quality MCQs that teach THIS event’s voice. Biggest quality lever.'
                    : 'Usually empty. Only add if this topic needs examples the event pack lacks.'}
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
        )}

        {pack.scope_type === 'event' ? (
          <label className="block space-y-1 border-t border-white/10 pt-3">
            <span className="label-caps text-[9px] text-dim">
              Binder audit criteria · this event
            </span>
            <p className="text-[9px] leading-snug text-muted">
              What “good notes” means for this event (diagrams, calc setup,
              units, lab technique). Injected with the binder master critic at
              audit time — not used by Generate.
            </p>
            <textarea
              value={binderCriteria}
              onChange={(event) => setBinderCriteria(event.target.value)}
              rows={10}
              placeholder="Chem Lab example: weight labeled setups, stoichiometry work, significant figures, error analysis; penalize unlabeled axes / missing units…"
              className="field-input min-h-[10rem] resize-y data-mono text-[11px] leading-relaxed"
            />
          </label>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-void p-2.5">
          <p className="label-caps text-[9px] text-dim">
            {pack.scope_type === 'binder_master'
              ? 'What Binder Audit will send'
              : 'What Plan 23 sends to the model'}
          </p>
          <p className="mt-1.5 data-mono text-[9px] leading-relaxed text-muted">
            {pack.scope_type === 'binder_master' ? (
              <>
                SYSTEM: binder master critic → event binder criteria
                <br />
                USER: page image + concept checklist (+ optional Clinic snippets)
                <br />
                OUT: fixed JSON scorecard (gaps, fixes, reject paths)
              </>
            ) : (
              <>
                SYSTEM: master instructions → event instructions → (rare) topic
                overlay
                <br />
                THEN: event few-shots (only)
                <br />
                USER: this concept’s name / description / depth tags → optional
                Clinic guide → optional media menu → “write N MCQs as JSON”
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/5 px-3 py-2">
        <button
          type="button"
          disabled={
            saveMutation.isPending ||
            (pack.scope_type !== 'master' &&
              pack.scope_type !== 'binder_master' &&
              Boolean(parsedFewShots.error))
          }
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
