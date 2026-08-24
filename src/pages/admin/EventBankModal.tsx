import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  CatalogConcept,
  CatalogSnapshot,
  CatalogTopic,
  Coverage,
} from '../../lib/adminCatalog'
import {
  fetchQuestionsForConcept,
  type AdminQuestion,
} from '../../lib/adminQuestions'

type Props = {
  open: boolean
  onClose: () => void
  eventId: string
  eventName: string
  snapshot: CatalogSnapshot
  targetPerConcept?: number
}

export function EventBankModal({
  open,
  onClose,
  eventId,
  eventName,
  snapshot,
  targetPerConcept = 30,
}: Props) {
  const [search, setSearch] = useState('')
  const [gapsFirst, setGapsFirst] = useState(true)
  const [openTopicId, setOpenTopicId] = useState<string | null>(null)
  const [openConceptId, setOpenConceptId] = useState<string | null>(null)
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null)

  const coverageMap = useMemo(
    () => new Map(snapshot.coverage.map((row) => [row.concept_id, row])),
    [snapshot.coverage],
  )

  const topics = useMemo(
    () =>
      snapshot.topics
        .filter((t) => t.event_id === eventId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [snapshot.topics, eventId],
  )

  const conceptsByTopic = useMemo(() => {
    const map = new Map<string, CatalogConcept[]>()
    const q = search.trim().toLowerCase()
    for (const concept of snapshot.concepts) {
      if (concept.event_id !== eventId) continue
      if (q && !concept.name.toLowerCase().includes(q) && !concept.id.includes(q)) {
        continue
      }
      const list = map.get(concept.topic_id) ?? []
      list.push(concept)
      map.set(concept.topic_id, list)
    }
    for (const [topicId, list] of map) {
      list.sort((a, b) => {
        if (gapsFirst) {
          const ga = gapFor(coverageMap.get(a.id), targetPerConcept)
          const gb = gapFor(coverageMap.get(b.id), targetPerConcept)
          if (ga !== gb) return gb - ga
        }
        return a.sort_order - b.sort_order
      })
      map.set(topicId, list)
    }
    return map
  }, [snapshot.concepts, eventId, search, gapsFirst, coverageMap, targetPerConcept])

  const totals = useMemo(() => {
    let concepts = 0
    let live = 0
    let draft = 0
    for (const concept of snapshot.concepts) {
      if (concept.event_id !== eventId) continue
      concepts += 1
      const cov = coverageMap.get(concept.id)
      live += cov?.live_count ?? 0
      draft += cov?.draft_count ?? 0
    }
    return { concepts, live, draft }
  }, [snapshot.concepts, eventId, coverageMap])

  const questionsQuery = useQuery({
    queryKey: ['admin-bank-concept-questions', openConceptId],
    queryFn: () => fetchQuestionsForConcept(openConceptId!),
    enabled: Boolean(open && openConceptId),
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${eventName} question bank`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-subtle px-4 py-3">
          <div>
            <p className="label-caps text-[9px] text-dim">Event bank</p>
            <h2 className="mt-0.5 font-display text-lg text-foreground">{eventName}</h2>
            <p className="mt-1 data-mono text-[10px] text-muted">
              {totals.concepts} concepts · {totals.live} live · {totals.draft} draft
              {' · '}target {targetPerConcept}/concept
            </p>
          </div>
          <button
            type="button"
            className="hud-pill px-2 py-1 text-[10px]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-4 py-2">
          <input
            type="search"
            placeholder="Filter concepts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input max-w-xs flex-1 text-xs"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-muted">
            <input
              type="checkbox"
              checked={gapsFirst}
              onChange={(e) => setGapsFirst(e.target.checked)}
            />
            Gaps first
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {topics.map((topic) => {
            const concepts = conceptsByTopic.get(topic.id) ?? []
            if (concepts.length === 0) return null
            const topicOpen = openTopicId === topic.id
            return (
              <TopicBlock
                key={topic.id}
                topic={topic}
                concepts={concepts}
                open={topicOpen}
                onToggle={() =>
                  setOpenTopicId(topicOpen ? null : topic.id)
                }
                coverageMap={coverageMap}
                target={targetPerConcept}
                openConceptId={openConceptId}
                onToggleConcept={(id) => {
                  setOpenConceptId((cur) => (cur === id ? null : id))
                  setOpenQuestionId(null)
                }}
                questions={
                  openConceptId && concepts.some((c) => c.id === openConceptId)
                    ? questionsQuery.data ?? null
                    : null
                }
                questionsLoading={
                  questionsQuery.isFetching && openConceptId != null
                }
                openQuestionId={openQuestionId}
                onToggleQuestion={(id) =>
                  setOpenQuestionId((cur) => (cur === id ? null : id))
                }
              />
            )
          })}
        </div>

        <p className="border-t border-subtle px-4 py-2 text-[10px] text-dim">
          Read-only. Edit drafts in Review; taxonomy in Catalog.
        </p>
      </div>
    </div>
  )
}

function gapFor(cov: Coverage | undefined, target: number) {
  const have = (cov?.live_count ?? 0) + (cov?.draft_count ?? 0)
  return Math.max(target - have, 0)
}

function TopicBlock({
  topic,
  concepts,
  open,
  onToggle,
  coverageMap,
  target,
  openConceptId,
  onToggleConcept,
  questions,
  questionsLoading,
  openQuestionId,
  onToggleQuestion,
}: {
  topic: CatalogTopic
  concepts: CatalogConcept[]
  open: boolean
  onToggle: () => void
  coverageMap: Map<string, Coverage>
  target: number
  openConceptId: string | null
  onToggleConcept: (id: string) => void
  questions: AdminQuestion[] | null
  questionsLoading: boolean
  openQuestionId: string | null
  onToggleQuestion: (id: string) => void
}) {
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-subtle">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 bg-[var(--surface-hover)] px-3 py-2 text-left"
      >
        <span className="text-xs text-foreground">{topic.name}</span>
        <span className="data-mono text-[9px] text-dim">
          {concepts.length} concepts · {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <ul className="divide-y divide-white/5">
          {concepts.map((concept) => {
            const cov = coverageMap.get(concept.id)
            const live = cov?.live_count ?? 0
            const draft = cov?.draft_count ?? 0
            const gap = gapFor(cov, target)
            const conceptOpen = openConceptId === concept.id
            return (
              <li key={concept.id}>
                <button
                  type="button"
                  onClick={() => onToggleConcept(concept.id)}
                  className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted">{concept.name}</span>
                    <span className="data-mono text-[8px] text-dim">{concept.id}</span>
                  </span>
                  <span className="shrink-0 data-mono text-[9px] text-dim">
                    <span className="text-success">{live}L</span>
                    {' · '}
                    <span className="text-cyan">{draft}D</span>
                    {gap > 0 ? (
                      <>
                        {' · '}
                        <span className="text-alert">gap {gap}</span>
                      </>
                    ) : null}
                  </span>
                </button>
                {conceptOpen ? (
                  <div className="border-t border-subtle bg-[var(--surface-high)] px-3 py-2">
                    {questionsLoading ? (
                      <p className="text-[10px] text-dim">Loading questions…</p>
                    ) : !questions || questions.length === 0 ? (
                      <p className="text-[10px] text-dim">No live/draft questions yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {questions.map((q, index) => {
                          const qOpen = openQuestionId === q.id
                          return (
                            <li key={q.id}>
                              <button
                                type="button"
                                onClick={() => onToggleQuestion(q.id)}
                                className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                              >
                                <span className="data-mono text-[8px] text-dim">
                                  {index + 1}. {q.status}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                                  {q.stem}
                                </span>
                              </button>
                              {qOpen ? (
                                <div className="mt-1 mb-2 rounded-lg border border-subtle bg-[var(--surface-high)] px-2 py-2 data-mono text-[9px] text-dim">
                                  {(['A', 'B', 'C', 'D'] as const).map((key) => (
                                    <p
                                      key={key}
                                      className={
                                        q.correct_key === key ? 'text-success' : ''
                                      }
                                    >
                                      {key}. {q.options[key]}
                                    </p>
                                  ))}
                                  <p className="mt-2 text-muted">{q.explanation}</p>
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
