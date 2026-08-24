import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ensurePromptPack,
  parseCommaTags,
  saveConceptGuide,
  updateConcept,
  updateEventStudyable,
  type CatalogConcept,
  type CatalogSnapshot,
  type ConceptGuide,
  type Coverage,
} from '../../lib/adminCatalog'
import { adminErrorMessage } from '../../lib/adminQuestions'

export function CatalogCurriculum({
  snapshot,
}: {
  snapshot: CatalogSnapshot
}) {
  const firstEvent =
    snapshot.events.find((event) => event.studyable) ?? snapshot.events[0] ?? null
  const [eventId, setEventId] = useState(firstEvent?.id ?? '')
  const [conceptId, setConceptId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [eventSearch, setEventSearch] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const selectedEvent =
    snapshot.events.find((event) => event.id === eventId) ?? firstEvent
  const guideMap = useMemo(
    () => new Map(snapshot.guides.map((guide) => [guide.concept_id, guide])),
    [snapshot.guides],
  )
  const coverageMap = useMemo(
    () => new Map(snapshot.coverage.map((row) => [row.concept_id, row])),
    [snapshot.coverage],
  )

  const eventTopics = snapshot.topics.filter(
    (topic) => topic.event_id === selectedEvent?.id,
  )
  const eventConcepts = snapshot.concepts.filter(
    (concept) => concept.event_id === selectedEvent?.id,
  )
  const query = search.trim().toLowerCase()
  const filteredConcepts = eventConcepts.filter((concept) => {
    if (missingOnly && guideMap.has(concept.id)) return false
    if (!query) return true
    return (
      concept.name.toLowerCase().includes(query) ||
      concept.id.toLowerCase().includes(query) ||
      concept.depth_tags.some((tag) => tag.toLowerCase().includes(query))
    )
  })
  const selectedConcept =
    filteredConcepts.find((concept) => concept.id === conceptId) ??
    filteredConcepts[0] ??
    null

  const eventQuery = eventSearch.trim().toLowerCase()
  const visibleEvents = snapshot.events.filter((event) => {
    if (!eventQuery) return true
    return (
      event.name.toLowerCase().includes(eventQuery) ||
      (event.domain ?? '').toLowerCase().includes(eventQuery)
    )
  })

  // A concept search should reveal its matches without extra clicks; otherwise
  // topics stay collapsed so 90-concept events are navigable.
  const forceOpen = query.length > 0 || missingOnly
  const isTopicOpen = (topicId: string) =>
    forceOpen || openTopics.has(topicId)
  const toggleTopic = (topicId: string) =>
    setOpenTopics((current) => {
      const next = new Set(current)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })

  const toggleStudyable = useMutation({
    mutationFn: async (next: boolean) => {
      await updateEventStudyable(selectedEvent!.id, next)
      if (next) {
        await ensurePromptPack({
          scopeType: 'event',
          scopeId: selectedEvent!.id,
          name: `${selectedEvent!.name} Style Pack`,
        })
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-catalog'] }),
        qc.invalidateQueries({ queryKey: ['admin-prompt-packs'] }),
      ])
    },
  })

  if (!selectedEvent) {
    return (
      <div className="hud-panel flex h-full items-center justify-center text-sm text-muted">
        No taxonomy events found.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <section className="hud-panel flex shrink-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 px-2 py-1.5">
          <p className="label-caps shrink-0 text-[9px] text-dim">
            Events
            <span className="ml-1.5 data-mono text-dim">
              {visibleEvents.length}/{snapshot.events.length}
            </span>
          </p>
          <input
            value={eventSearch}
            onChange={(event) => setEventSearch(event.target.value)}
            placeholder="Search events…"
            className="field-input ml-auto w-40 sm:w-56"
          />
        </div>
        <div className="max-h-[4.25rem] min-h-0 overflow-y-auto px-1.5 pb-1.5">
          {visibleEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => {
                setEventId(event.id)
                setConceptId(null)
                setOpenTopics(new Set())
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left ${
                event.id === selectedEvent.id
                  ? 'bg-cyan/10 text-foreground'
                  : 'text-muted hover:bg-[var(--surface-hover)] hover:text-foreground'
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-xs">
                {event.name}
              </span>
              <span className="shrink-0 data-mono text-[8px] uppercase text-dim">
                {event.domain || 'uncategorized'}
              </span>
              <span
                className={`shrink-0 data-mono text-[8px] uppercase ${
                  event.studyable ? 'text-success' : 'text-dim'
                }`}
              >
                {event.studyable ? 'studyable' : 'disabled'}
              </span>
            </button>
          ))}
          {visibleEvents.length === 0 ? (
            <p className="py-2 text-center text-[10px] text-dim">
              No event matches “{eventSearch}”.
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto lg:grid-cols-[minmax(240px,300px)_1fr] lg:overflow-hidden">
      <section className="hud-panel flex min-h-[18rem] flex-col overflow-hidden lg:min-h-0">
        <div className="shrink-0 border-b border-subtle p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate label-caps text-[9px] text-dim">
                {selectedEvent.name}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                {eventTopics.length} topics · {eventConcepts.length} concepts
              </p>
            </div>
            <button
              type="button"
              disabled={toggleStudyable.isPending}
              onClick={() =>
                toggleStudyable.mutate(!selectedEvent.studyable)
              }
              className={`hud-pill shrink-0 px-2 py-0.5 text-[9px] ${
                selectedEvent.studyable ? 'hud-pill-active' : ''
              }`}
            >
              {selectedEvent.studyable ? 'Studyable' : 'Enable'}
            </button>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search concepts or depth tags…"
            className="field-input mt-1.5"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(event) => setMissingOnly(event.target.checked)}
                className="accent-cyan"
              />
              Missing guides
              <span className="data-mono text-dim">
                ({eventConcepts.filter((c) => !guideMap.has(c.id)).length})
              </span>
            </label>
            <button
              type="button"
              onClick={() =>
                setOpenTopics((current) =>
                  current.size > 0
                    ? new Set()
                    : new Set(eventTopics.map((topic) => topic.id)),
                )
              }
              className="data-mono text-[9px] uppercase text-cyan hover:underline"
            >
              {openTopics.size > 0 ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          {toggleStudyable.isError ? (
            <p className="mt-1.5 text-[10px] text-alert">
              {adminErrorMessage(toggleStudyable.error)}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {eventTopics.map((topic) => {
            const concepts = filteredConcepts.filter(
              (concept) => concept.topic_id === topic.id,
            )
            if (concepts.length === 0) return null
            const open = isTopicOpen(topic.id)
            const missing = concepts.filter(
              (concept) => !guideMap.has(concept.id),
            ).length
            return (
              <div key={topic.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-[var(--surface-hover)]"
                >
                  <span
                    aria-hidden
                    className={`data-mono text-[8px] text-cyan transition-transform ${
                      open ? 'rotate-90' : ''
                    }`}
                  >
                    ▶
                  </span>
                  <span className="min-w-0 flex-1 truncate label-caps text-[8px] text-dim">
                    {topic.name}
                  </span>
                  <span className="shrink-0 data-mono text-[8px] text-dim">
                    {missing > 0 ? (
                      <span className="text-alert">{missing}!</span>
                    ) : null}{' '}
                    {concepts.length}
                  </span>
                </button>
                {open
                  ? concepts.map((concept) => {
                      const coverage = coverageMap.get(concept.id)
                      const active = selectedConcept?.id === concept.id
                      return (
                        <button
                          key={concept.id}
                          type="button"
                          onClick={() => setConceptId(concept.id)}
                          className={`mb-0.5 ml-2.5 w-[calc(100%-0.625rem)] rounded-lg px-2 py-1 text-left ${
                            active
                              ? 'bg-cyan/10 text-foreground'
                              : 'text-muted hover:bg-[var(--surface-hover)] hover:text-foreground'
                          }`}
                        >
                          <span className="block text-[11px] leading-snug">
                            {concept.name}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-1 data-mono text-[8px] uppercase">
                            <Count tone="text-success" value={coverage?.live_count} label="live" />
                            <Count tone="text-cyan" value={coverage?.draft_count} label="draft" />
                            <span
                              className={
                                guideMap.has(concept.id)
                                  ? 'text-muted'
                                  : 'text-alert'
                              }
                            >
                              {guideMap.has(concept.id) ? 'guide' : 'no guide'}
                            </span>
                          </span>
                        </button>
                      )
                    })
                  : null}
              </div>
            )
          })}
          {filteredConcepts.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">
              No matching concepts.
            </p>
          ) : null}
        </div>
      </section>

      <section className="hud-panel min-h-[26rem] overflow-hidden lg:min-h-0">
        {selectedConcept ? (
          <ConceptEditor
            key={selectedConcept.id}
            concept={selectedConcept}
            guide={guideMap.get(selectedConcept.id) ?? null}
            coverage={coverageMap.get(selectedConcept.id) ?? null}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-xs text-muted">
            Select a concept.
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

function Count({
  value = 0,
  label,
  tone,
}: {
  value?: number
  label: string
  tone: string
}) {
  return <span className={tone}>{value} {label}</span>
}

function ConceptEditor({
  concept,
  guide,
  coverage,
}: {
  concept: CatalogConcept
  guide: ConceptGuide | null
  coverage: Coverage | null
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [description, setDescription] = useState(concept.description)
  const [tags, setTags] = useState(concept.depth_tags.join(', '))
  const [readBody, setReadBody] = useState(guide?.read_body ?? '')
  const [seeHtml, setSeeHtml] = useState(guide?.see_html ?? '')
  const [doPrompt, setDoPrompt] = useState(guide?.do_prompt ?? '')
  const [optionA, setOptionA] = useState(guide?.do_options?.A ?? '')
  const [optionB, setOptionB] = useState(guide?.do_options?.B ?? '')
  const [optionC, setOptionC] = useState(guide?.do_options?.C ?? '')
  const [correct, setCorrect] = useState<'A' | 'B' | 'C'>(
    guide?.do_correct_key ?? 'A',
  )
  const [status, setStatus] = useState<'draft' | 'live'>(
    guide?.status ?? 'draft',
  )
  const [note, setNote] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateConcept({
        id: concept.id,
        description,
        depthTags: parseCommaTags(tags),
      })
      await saveConceptGuide({
        concept_id: concept.id,
        read_body: readBody,
        see_html: seeHtml || null,
        status,
        do_prompt: doPrompt,
        do_options: { A: optionA, B: optionB, C: optionC },
        do_correct_key: correct,
      })
    },
    onSuccess: async () => {
      setNote('Concept + guide saved')
      await qc.invalidateQueries({ queryKey: ['admin-catalog'] })
    },
    onError: (error) => setNote(adminErrorMessage(error)),
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-subtle px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm text-foreground">{concept.name}</h2>
            <p className="mt-0.5 truncate data-mono text-[8px] text-dim">
              {concept.id}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`hud-pill px-2 py-0.5 text-[9px] ${
                mode === 'edit' ? 'hud-pill-active' : ''
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`hud-pill px-2 py-0.5 text-[9px] ${
                mode === 'preview' ? 'hud-pill-active' : ''
              }`}
            >
              Preview
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2 data-mono text-[8px] uppercase">
          <span className="text-success">{coverage?.live_count ?? 0} live</span>
          <span className="text-cyan">{coverage?.draft_count ?? 0} draft</span>
          <span className="text-dim">{coverage?.archived_count ?? 0} archived</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {mode === 'edit' ? (
          <div className="space-y-3">
            <Field label="Concept description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="field-input resize-y"
              />
            </Field>
            <Field label="Depth tags (comma separated)">
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="field-input data-mono text-[10px]"
              />
            </Field>

            <div className="border-t border-subtle pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="label-caps text-[9px] text-cyan">
                  Clinic guide · READ / SEE / DO
                </p>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as 'draft' | 'live')
                  }
                  className="field-input w-auto data-mono text-[10px]"
                >
                  <option value="draft">draft</option>
                  <option value="live">live</option>
                </select>
              </div>
              <div className="space-y-3">
                <Field label="READ · Study paragraph">
                  <textarea
                    value={readBody}
                    onChange={(event) => setReadBody(event.target.value)}
                    rows={6}
                    className="field-input resize-y"
                  />
                </Field>
                <Field label="SEE · HTML / visual explanation (optional)">
                  <textarea
                    value={seeHtml}
                    onChange={(event) => setSeeHtml(event.target.value)}
                    rows={4}
                    placeholder="<p>Use lightweight trusted HTML…</p>"
                    className="field-input resize-y data-mono text-[10px]"
                  />
                </Field>
                <Field label="DO · Check question">
                  <textarea
                    value={doPrompt}
                    onChange={(event) => setDoPrompt(event.target.value)}
                    rows={2}
                    className="field-input resize-y"
                  />
                </Field>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ['A', optionA, setOptionA],
                      ['B', optionB, setOptionB],
                      ['C', optionC, setOptionC],
                    ] as const
                  ).map(([key, value, setter]) => (
                    <Field key={key} label={`Option ${key}`}>
                      <input
                        value={value}
                        onChange={(event) => setter(event.target.value)}
                        className="field-input"
                      />
                    </Field>
                  ))}
                </div>
                <div>
                  <p className="label-caps text-[9px] text-dim">Correct answer</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {(['A', 'B', 'C'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCorrect(key)}
                        className={`hud-pill px-3 py-1 text-[10px] ${
                          correct === key ? 'hud-pill-active' : ''
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ClinicPreview
            title={concept.name}
            readBody={readBody || description}
            seeHtml={seeHtml}
            doPrompt={doPrompt}
            options={{ A: optionA, B: optionB, C: optionC }}
            correct={correct}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-subtle px-3 py-2">
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="hud-pill hud-pill-active px-3 py-1 text-[10px] disabled:opacity-40"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save dossier'}
        </button>
        {note ? (
          <p
            className={`text-[10px] ${
              /denied|fail|error/i.test(note) ? 'text-alert' : 'text-cyan'
            }`}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ClinicPreview({
  title,
  readBody,
  seeHtml,
  doPrompt,
  options,
  correct,
}: {
  title: string
  readBody: string
  seeHtml: string
  doPrompt: string
  options: Record<'A' | 'B' | 'C', string>
  correct: 'A' | 'B' | 'C'
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="label-caps text-[9px] text-cyan">READ</p>
        <h3 className="mt-1 text-sm text-foreground">{title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">
          {readBody || 'No READ paragraph yet.'}
        </p>
      </div>
      <div className="border-t border-subtle pt-3">
        <p className="label-caps text-[9px] text-cyan">SEE</p>
        {seeHtml ? (
          <div
            className="mt-2 rounded-lg border border-subtle bg-void p-2.5 text-xs text-muted"
            dangerouslySetInnerHTML={{ __html: seeHtml }}
          />
        ) : (
          <p className="mt-1.5 text-xs text-dim">No SEE visual yet.</p>
        )}
      </div>
      <div className="border-t border-subtle pt-3">
        <p className="label-caps text-[9px] text-cyan">DO</p>
        <p className="mt-1.5 text-xs text-foreground">
          {doPrompt || 'No DO check yet.'}
        </p>
        <div className="mt-2 space-y-1.5">
          {(['A', 'B', 'C'] as const).map((key) => (
            <div
              key={key}
              className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                key === correct
                  ? 'border-success/40 bg-success/5 text-foreground'
                  : 'border-subtle text-muted'
              }`}
            >
              <span className="mr-2 data-mono text-cyan">{key}</span>
              {options[key] || 'Empty option'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="label-caps text-[9px] text-dim">{label}</span>
      {children}
    </label>
  )
}
