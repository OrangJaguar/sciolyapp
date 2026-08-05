import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { TaxonomyEvent, TaxonomyTopic } from '../../lib/types'

type LiveCountRow = {
  event_id: string
  topic_id: string | null
}

async function fetchLobbyData() {
  if (!supabase) throw new Error('Supabase not configured')

  const [eventsRes, topicsRes, questionsRes] = await Promise.all([
    supabase
      .from('taxonomy_events')
      .select(
        'id, name, division, domain, test_component, studyable, season, active, official_scope',
      )
      .eq('active', true)
      .order('name'),
    supabase
      .from('taxonomy_topics')
      .select('id, event_id, name, sort_order')
      .order('sort_order'),
    supabase
      .from('questions')
      .select('event_id, topic_id')
      .eq('status', 'live'),
  ])

  if (eventsRes.error) throw eventsRes.error
  if (topicsRes.error) throw topicsRes.error
  if (questionsRes.error) throw questionsRes.error

  return {
    events: (eventsRes.data ?? []) as TaxonomyEvent[],
    topics: (topicsRes.data ?? []) as TaxonomyTopic[],
    liveRows: (questionsRes.data ?? []) as LiveCountRow[],
  }
}

export function CasualLobbyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetEvent = searchParams.get('event')
  const presetTopic = searchParams.get('topic')

  const { data, isLoading, error } = useQuery({
    queryKey: ['casual-lobby'],
    queryFn: fetchLobbyData,
    enabled: isSupabaseConfigured,
  })

  const studyable = useMemo(
    () => (data?.events ?? []).filter((e) => e.studyable),
    [data?.events],
  )
  const comingSoon = useMemo(
    () => (data?.events ?? []).filter((e) => !e.studyable),
    [data?.events],
  )

  const [eventId, setEventId] = useState<string | null>(null)
  const [topicId, setTopicId] = useState<string | 'all'>('all')

  useEffect(() => {
    if (!data || !presetEvent) return
    const liveEvents = data.events.filter((e) => e.studyable)
    if (!liveEvents.some((e) => e.id === presetEvent)) return
    setEventId(presetEvent)
    if (presetTopic && presetTopic !== 'all') {
      const topicOk = data.topics.some(
        (t) => t.id === presetTopic && t.event_id === presetEvent,
      )
      setTopicId(topicOk ? presetTopic : 'all')
    } else {
      setTopicId('all')
    }
  }, [data, presetEvent, presetTopic])

  // Default to first studyable once loaded; honor ?event= from Missions
  const selectedEventId =
    eventId ??
    (presetEvent && studyable.some((e) => e.id === presetEvent)
      ? presetEvent
      : null) ??
    studyable[0]?.id ??
    null

  const topicsForEvent = useMemo(
    () =>
      (data?.topics ?? [])
        .filter((t) => t.event_id === selectedEventId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [data?.topics, selectedEventId],
  )

  const liveByEvent = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of data?.liveRows ?? []) {
      map.set(row.event_id, (map.get(row.event_id) ?? 0) + 1)
    }
    return map
  }, [data?.liveRows])

  const liveByTopic = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of data?.liveRows ?? []) {
      if (!row.topic_id) continue
      map.set(row.topic_id, (map.get(row.topic_id) ?? 0) + 1)
    }
    return map
  }, [data?.liveRows])

  const liveForSelection = useMemo(() => {
    if (!selectedEventId) return 0
    if (topicId === 'all') return liveByEvent.get(selectedEventId) ?? 0
    return liveByTopic.get(topicId) ?? 0
  }, [selectedEventId, topicId, liveByEvent, liveByTopic])

  const selectedEvent = studyable.find((e) => e.id === selectedEventId) ?? null
  const canStart = Boolean(selectedEventId) && liveForSelection > 0

  function startSession() {
    if (!canStart || !selectedEventId) return
    const params = new URLSearchParams({
      event: selectedEventId,
      topic: topicId,
    })
    navigate(`/ops/casual/arena?${params.toString()}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <aside className="hud-panel flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-[280px]">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="label-caps">Events</p>
          <p className="mt-1 text-xs text-dim">Studyable now · rest locked</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!isSupabaseConfigured && (
            <p className="px-2 py-3 text-sm text-muted">
              Configure Supabase to load events.
            </p>
          )}
          {isLoading && (
            <p className="px-2 py-3 text-sm text-muted">Loading events…</p>
          )}
          {error && (
            <p className="px-2 py-3 text-sm text-alert">
              Failed to load taxonomy. Check auth + seed.
            </p>
          )}
          <p className="px-2 pt-2 pb-1 text-[10px] tracking-[0.14em] text-dim uppercase">
            Live
          </p>
          {studyable.map((ev) => {
            const active = ev.id === selectedEventId
            const n = liveByEvent.get(ev.id) ?? 0
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  setEventId(ev.id)
                  setTopicId('all')
                }}
                className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-cyan text-black'
                    : 'text-white hover:bg-surface-high'
                }`}
              >
                <span className="text-sm font-medium">{ev.name}</span>
                <span
                  className={`data-mono text-[10px] ${active ? 'text-black/70' : 'text-cyan'}`}
                >
                  {n}Q
                </span>
              </button>
            )
          })}
          {comingSoon.length > 0 && (
            <>
              <p className="px-2 pt-4 pb-1 text-[10px] tracking-[0.14em] text-dim uppercase">
                Coming soon
              </p>
              {comingSoon.map((ev) => (
                <div
                  key={ev.id}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-2.5 text-muted opacity-50"
                  title="Topics lock in September"
                >
                  <span className="text-sm">{ev.name}</span>
                  <span className="text-[10px] tracking-wide uppercase">
                    Locked
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      <section className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <Link
              to="/ops"
              className="text-xs tracking-wide text-muted transition-colors hover:text-cyan"
            >
              ← OPS
            </Link>
            <h1 className="mt-2 text-2xl font-medium text-white md:text-3xl">
              Casual Mode
            </h1>
            <p className="mt-1 text-sm text-muted">
              {selectedEvent
                ? selectedEvent.official_scope
                  ? `Scope: ${selectedEvent.official_scope}`
                  : selectedEvent.name
                : 'Select a studyable event'}
            </p>
          </div>
          <button
            type="button"
            disabled={!canStart}
            onClick={startSession}
            className="hud-pill shrink-0 bg-cyan px-6 py-3 text-sm font-bold tracking-wide text-black shadow-[0_0_20px_var(--cyan-dim)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-dim disabled:shadow-none"
          >
            START
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="label-caps mb-3">Topic focus</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <TopicCard
              active={topicId === 'all'}
              title="All topics"
              subtitle={
                selectedEventId
                  ? `${liveByEvent.get(selectedEventId) ?? 0} live questions`
                  : '—'
              }
              onClick={() => setTopicId('all')}
            />
            {topicsForEvent.map((t) => (
              <TopicCard
                key={t.id}
                active={topicId === t.id}
                title={t.name}
                subtitle={`${liveByTopic.get(t.id) ?? 0} live`}
                onClick={() => setTopicId(t.id)}
                disabled={(liveByTopic.get(t.id) ?? 0) === 0}
              />
            ))}
          </div>

          {!isLoading && selectedEventId && liveForSelection === 0 && (
            <p className="mt-6 text-sm text-alert">
              No live questions for this selection. Re-run Plan 04 seed or pick
              another topic.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-3 data-mono text-xs text-dim">
          Selection · {selectedEventId ?? '—'} · topic={topicId} ·{' '}
          {liveForSelection} live
        </div>
      </section>
    </div>
  )
}

function TopicCard({
  active,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left transition ${
        active
          ? 'border-cyan bg-cyan/10 shadow-[0_0_18px_rgba(0,240,255,0.12)]'
          : 'border-white/15 hover:border-cyan/40'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 data-mono text-[11px] text-cyan">{subtitle}</p>
    </button>
  )
}
