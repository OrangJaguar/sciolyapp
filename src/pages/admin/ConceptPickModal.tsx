import { useMemo, useState } from 'react'
import type {
  CatalogConcept,
  CatalogSnapshot,
  Coverage,
} from '../../lib/adminCatalog'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (conceptIds: string[]) => void
  eventId: string
  eventName: string
  snapshot: CatalogSnapshot
  maxSelect: number
  initialSelected: string[]
  targetPerConcept?: number
}

function gapFor(cov: Coverage | undefined, target: number) {
  const have = (cov?.live_count ?? 0) + (cov?.draft_count ?? 0)
  return Math.max(target - have, 0)
}

export function ConceptPickModal({
  open,
  onClose,
  onConfirm,
  eventId,
  eventName,
  snapshot,
  maxSelect,
  initialSelected,
  targetPerConcept = 30,
}: Props) {
  const [search, setSearch] = useState('')
  const [gapsFirst, setGapsFirst] = useState(true)
  const [openTopicId, setOpenTopicId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(initialSelected)

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

  if (!open) return null

  const atCap = selected.length >= maxSelect

  const toggle = (conceptId: string) => {
    setSelected((current) => {
      if (current.includes(conceptId)) {
        return current.filter((id) => id !== conceptId)
      }
      if (current.length >= maxSelect) return current
      return [...current, conceptId]
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select concepts"
      >
        <div className="flex items-start justify-between gap-3 border-b border-subtle px-4 py-3">
          <div>
            <p className="label-caps text-[9px] text-dim">Pick concepts</p>
            <h2 className="font-display text-lg text-foreground">{eventName}</h2>
            <p className="mt-1 text-[11px] text-muted">
              Select up to {maxSelect}. Leave empty on the Workbench to auto-pick
              gap concepts.
            </p>
          </div>
          <button type="button" className="hud-pill px-2.5 py-1 text-[10px]" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-4 py-2">
          <input
            type="search"
            placeholder="Search concepts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input min-w-[12rem] flex-1"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-muted">
            <input
              type="checkbox"
              checked={gapsFirst}
              onChange={(e) => setGapsFirst(e.target.checked)}
            />
            Gaps first
          </label>
          <span className="data-mono text-[10px] text-cyan">
            {selected.length}/{maxSelect} selected
          </span>
          {selected.length > 0 ? (
            <button
              type="button"
              className="text-[10px] text-dim underline"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {topics.map((topic) => {
            const concepts = conceptsByTopic.get(topic.id) ?? []
            if (concepts.length === 0) return null
            const open = openTopicId === topic.id
            return (
              <div key={topic.id} className="mb-1 rounded-lg border border-subtle">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                  onClick={() => setOpenTopicId(open ? null : topic.id)}
                >
                  <span className="text-[12px] text-foreground">{topic.name}</span>
                  <span className="data-mono text-[9px] text-dim">
                    {concepts.length} · {open ? '−' : '+'}
                  </span>
                </button>
                {open ? (
                  <ul className="border-t border-subtle px-2 py-1">
                    {concepts.map((concept) => {
                      const checked = selected.includes(concept.id)
                      const gap = gapFor(coverageMap.get(concept.id), targetPerConcept)
                      const disabled = !checked && atCap
                      return (
                        <li key={concept.id}>
                          <label
                            className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 ${
                              disabled ? 'opacity-40' : 'hover:bg-[var(--surface-hover)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggle(concept.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] text-muted">
                                {concept.name}
                              </span>
                              <span className="data-mono text-[9px] text-dim">
                                gap {gap}/{targetPerConcept}
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-subtle px-4 py-3">
          <button type="button" className="hud-pill px-3 py-1.5 text-[10px]" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="hud-pill hud-pill-active px-3 py-1.5 text-[10px]"
            onClick={() => {
              onConfirm(selected)
              onClose()
            }}
          >
            Use {selected.length || 'auto'} concept
            {selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
