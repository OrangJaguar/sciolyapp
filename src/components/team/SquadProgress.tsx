import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  formatRole,
  rosterNameClass,
  type EventCoverage,
  type RosterMember,
} from '../../lib/comms'
import {
  fetchTeamAssignments,
  formatDeadline,
  missionKind,
  type AssignmentMission,
  type AssignmentProgress,
} from '../../lib/missions'

type Mode = 'event' | 'person'

function startOfWeek(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  return next
}

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function weekKey(iso: string): string {
  return localDateKey(startOfWeek(new Date(iso)))
}

function weekLabel(key: string, now = new Date()): string {
  const start = new Date(`${key}T00:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const range = `${fmt(start)} – ${fmt(end)}`
  return weekKey(now.toISOString()) === key ? `This week · ${range}` : range
}

function preferredWeek(keys: string[], now = new Date()): string | null {
  if (keys.length === 0) return null
  const today = weekKey(now.toISOString())
  if (keys.includes(today)) return today
  return keys.find((key) => key >= today) ?? keys[keys.length - 1]
}

function byName(a: RosterMember, b: RosterMember): number {
  return (a.display_name || a.handle).localeCompare(b.display_name || b.handle)
}

function missionLabel(mission: AssignmentMission): string {
  if (missionKind(mission) === 'timed') return `Test · ${mission.target_value} questions`
  const goal = mission.goal_type === 'correct' ? 'correct' : 'answered'
  return `${mission.target_value} ${goal}`
}

type Mark = { pct: number; finishedAt: string | null }

function shownValue(row: AssignmentProgress | undefined, mission: AssignmentMission): number {
  const past = Date.parse(mission.deadline) <= Date.now()
  if (past && row?.snapshot_value != null) return row.snapshot_value
  return row?.current_value ?? 0
}

function markOf(row: AssignmentProgress | undefined, mission: AssignmentMission): Mark {
  const current = shownValue(row, mission)
  const pct = Math.min(100, Math.round((current / Math.max(1, mission.target_value)) * 100))
  return { pct, finishedAt: pct >= 100 ? (row?.completed_at ?? null) : null }
}

function rollup(marks: Mark[]): Mark {
  if (marks.length === 0) return { pct: 0, finishedAt: null }
  const pct = average(marks.map((mark) => mark.pct))
  if (pct < 100) return { pct, finishedAt: null }
  const finishedAt = marks.reduce<string | null>((latest, mark) => {
    if (!mark.finishedAt) return latest
    if (!latest || mark.finishedAt > latest) return mark.finishedAt
    return latest
  }, null)
  return { pct, finishedAt }
}

export function SquadProgress({
  teamId,
  squadName,
  roster,
  events,
  coverage,
  onClose,
}: {
  teamId: string
  squadName: string
  roster: RosterMember[]
  events: Array<{ id: string; name: string }>
  coverage: EventCoverage[]
  onClose: () => void
}) {
  const [pickedWeek, setPickedWeek] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('person')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const boardQuery = useQuery({
    queryKey: ['squad-assignments', teamId],
    queryFn: () => fetchTeamAssignments(teamId),
  })

  const missions = boardQuery.data?.missions ?? []
  const progress = boardQuery.data?.progress ?? []
  const weeks = useMemo(() => {
    const keys = new Set(missions.map((mission) => weekKey(mission.deadline)))
    return [...keys].sort()
  }, [missions])
  const selected =
    pickedWeek && weeks.includes(pickedWeek) ? pickedWeek : preferredWeek(weeks)

  const board = useMemo(
    () => buildBoard(roster, events, coverage, missions, progress, selected),
    [coverage, events, missions, progress, roster, selected],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Progress"
      onClick={onClose}
    >
      <div
        className="hud-panel flex max-h-[min(90dvh,820px)] w-full max-w-3xl flex-col overflow-hidden border-cyan/30 shadow-[0_0_48px_var(--accent-dim)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-subtle px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-caps">Progress</p>
              <h2 className="mt-1 truncate text-2xl font-medium text-[var(--text)]">
                {squadName.toUpperCase()}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="hud-pill px-4 py-2 text-xs">
              Close
            </button>
          </div>
          {weeks.length > 0 && selected && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {weeks.map((key) => {
                const on = key === selected
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPickedWeek(key)}
                    className={`hud-pill shrink-0 px-3 py-1.5 text-[10px] ${
                      on ? 'hud-pill-active' : ''
                    }`}
                  >
                    {weekLabel(key)}
                  </button>
                )
              })}
            </div>
          )}
          {board.summary.length > 0 && (
            <ul className="mt-4 space-y-1">
              {board.summary.map((line) => (
                <li key={line} className="text-sm text-[var(--text)]">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              aria-pressed={mode === 'event'}
              onClick={() => setMode('event')}
              className={`hud-pill px-3 py-1.5 text-[10px] ${
                mode === 'event' ? 'hud-pill-active' : ''
              }`}
            >
              By event
            </button>
            <button
              type="button"
              aria-pressed={mode === 'person'}
              onClick={() => setMode('person')}
              className={`hud-pill px-3 py-1.5 text-[10px] ${
                mode === 'person' ? 'hud-pill-active' : ''
              }`}
            >
              By person
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {boardQuery.isLoading ? (
            <p className="py-4 text-sm text-muted">Loading progress…</p>
          ) : boardQuery.error ? (
            <p className="py-4 text-sm text-alert">
              {boardQuery.error instanceof Error
                ? boardQuery.error.message
                : 'Could not load progress'}
            </p>
          ) : weeks.length === 0 ? (
            <p className="py-4 text-sm text-dim">No assignments yet.</p>
          ) : mode === 'event' ? (
            <EventList rows={board.events} />
          ) : (
            <PersonList rows={board.people} />
          )}
        </div>
      </div>
    </div>
  )
}

function buildBoard(
  roster: RosterMember[],
  events: Array<{ id: string; name: string }>,
  coverage: EventCoverage[],
  missions: AssignmentMission[],
  progress: AssignmentProgress[],
  selected: string | null,
) {
  const weekMissions = selected
    ? missions.filter((mission) => weekKey(mission.deadline) === selected)
    : []
  const progressByKey = new Map(
    progress.map((row) => [`${row.user_id}:${row.mission_id}`, row]),
  )
  const eventName = new Map(events.map((event) => [event.id, event.name]))
  const peopleByEvent = new Map<string, RosterMember[]>()
  for (const row of coverage) {
    const member = roster.find((person) => person.user_id === row.user_id)
    if (!member) continue
    const list = peopleByEvent.get(row.event_id) ?? []
    if (!list.some((person) => person.user_id === member.user_id)) list.push(member)
    peopleByEvent.set(row.event_id, list)
  }

  function mark(member: RosterMember, mission: AssignmentMission): Mark {
    return markOf(progressByKey.get(`${member.user_id}:${mission.id}`), mission)
  }

  const summary = summarize(weekMissions, eventName)

  const eventRows = [...new Set(weekMissions.map((mission) => mission.target_event_id))]
    .filter((id): id is string => Boolean(id))
    .map((eventId) => {
      const assigned = weekMissions.filter((mission) => mission.target_event_id === eventId)
      const members = (peopleByEvent.get(eventId) ?? [])
        .map((member) => ({
          member,
          ...rollup(assigned.map((mission) => mark(member, mission))),
        }))
        .sort((a, b) => compareWork(a, b))
      return {
        id: eventId,
        name: eventName.get(eventId) ?? eventId,
        pct: members.length === 0 ? null : average(members.map((member) => member.pct)),
        members,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const personRows = roster
    .map((member) => {
      const mine = weekMissions.filter(
        (mission) =>
          mission.target_event_id != null &&
          (peopleByEvent.get(mission.target_event_id) ?? []).some(
            (person) => person.user_id === member.user_id,
          ),
      )
      const byEvent = new Map<string, Mark[]>()
      for (const mission of mine) {
        const name = eventName.get(mission.target_event_id ?? '') ?? mission.title
        const scores = byEvent.get(name) ?? []
        scores.push(mark(member, mission))
        byEvent.set(name, scores)
      }
      const splits = [...byEvent.entries()]
        .map(([name, scores]) => ({
          id: name,
          name,
          ...rollup(scores),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return {
        member,
        ...(splits.length === 0
          ? { pct: null, finishedAt: null }
          : rollup(splits.map((split) => ({ pct: split.pct, finishedAt: split.finishedAt })))),
        splits,
      }
    })
    .sort((a, b) => comparePeople(a, b))

  return { summary, events: eventRows, people: personRows }
}

function summarize(
  missions: AssignmentMission[],
  eventName: Map<string, string>,
): string[] {
  const groups = new Map<string, { events: string[]; due: string | null }>()
  for (const mission of missions) {
    if (!mission.target_event_id) continue
    const label = missionLabel(mission)
    const group = groups.get(label) ?? { events: [], due: formatDeadline(mission.deadline) }
    group.events.push(eventName.get(mission.target_event_id) ?? mission.target_event_id)
    if (group.due !== formatDeadline(mission.deadline)) group.due = null
    groups.set(label, group)
  }
  const lines = [...groups.entries()]
  if (lines.length === 1) {
    const [label, group] = lines[0]
    return [group.due ? `${label} · due ${group.due}` : label]
  }
  return lines.map(([label, group]) => {
    const where =
      group.events.length === 1 ? group.events[0] : `${group.events.length} events`
    return group.due ? `${label} · ${where} · due ${group.due}` : `${label} · ${where}`
  })
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function compareWork(
  a: { pct: number | null; finishedAt?: string | null; member: RosterMember },
  b: { pct: number | null; finishedAt?: string | null; member: RosterMember },
): number {
  if (a.pct == null && b.pct == null) return byName(a.member, b.member)
  if (a.pct == null) return 1
  if (b.pct == null) return -1
  if (a.pct !== b.pct) return b.pct - a.pct
  if (a.pct === 100 && b.pct === 100) {
    if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) {
      return a.finishedAt < b.finishedAt ? -1 : 1
    }
    if (a.finishedAt && !b.finishedAt) return -1
    if (!a.finishedAt && b.finishedAt) return 1
  }
  return byName(a.member, b.member)
}

function comparePeople(
  a: { pct: number | null; finishedAt?: string | null; member: RosterMember },
  b: { pct: number | null; finishedAt?: string | null; member: RosterMember },
): number {
  const benchA = a.member.role === 'bench' ? 1 : 0
  const benchB = b.member.role === 'bench' ? 1 : 0
  if (benchA !== benchB) return benchA - benchB
  return compareWork(a, b)
}

function EventList({
  rows,
}: {
  rows: Array<{
    id: string
    name: string
    pct: number | null
    members: Array<{ member: RosterMember; pct: number }>
  }>
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-dim">No event assignments this week.</p>
  }
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id} className="border-b border-subtle py-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="truncate text-sm text-[var(--text)]">{row.name}</p>
            <p className="data-mono text-sm text-cyan">
              {row.pct == null ? '—' : `${row.pct}%`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Seat member={row.members[0]} />
            <Seat member={row.members[1]} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Seat({ member }: { member?: { member: RosterMember; pct: number } }) {
  if (!member) {
    return (
      <div>
        <p className="truncate text-sm text-dim">Seat open</p>
        <Bar pct={null} />
      </div>
    )
  }
  const name = member.member.display_name || `@${member.member.handle}`
  return (
    <div>
      <p className={`truncate text-sm ${rosterNameClass(member.member.role) ?? 'text-[var(--text)]'}`}>
        {name}
      </p>
      <Bar pct={member.pct} />
    </div>
  )
}

function PersonList({
  rows,
}: {
  rows: Array<{
    member: RosterMember
    pct: number | null
    splits: Array<{ id: string; name: string; pct: number }>
  }>
}) {
  return (
    <ul>
      {rows.map((row) => {
        const name = row.member.display_name || `@${row.member.handle}`
        return (
          <li key={row.member.user_id} className="border-b border-subtle py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className={`truncate text-sm ${rosterNameClass(row.member.role) ?? 'text-[var(--text)]'}`}>
                {name}
              </p>
              <p className="shrink-0 text-xs text-dim">{formatRole(row.member.role)}</p>
            </div>
            <Bar pct={row.pct} />
            {row.splits.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {row.splits.map((split) => (
                  <li
                    key={split.id}
                    className="grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-3"
                  >
                    <p className="truncate text-xs text-muted">{split.name}</p>
                    <Bar pct={split.pct} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Bar({ pct }: { pct: number | null }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill border border-cyan/30">
        {pct != null && (
          <div className="stripe-progress h-full" style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className="data-mono w-9 shrink-0 text-right text-xs text-cyan">
        {pct == null ? '—' : `${pct}%`}
      </span>
    </div>
  )
}
