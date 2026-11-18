import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { NoTeamPanel } from '../../components/team/NoTeamPanel'
import { ModalScrim } from '../../components/shell/ModalScrim'
import {
  fetchActiveEvents,
  fetchTeamEventCoverage,
  fetchTeamRoster,
  rosterNameClass,
  type RosterMember,
} from '../../lib/comms'
import { isStudyableEvent } from '../../lib/eventKinds'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  createEventMissions,
  createRecurringMissions,
  deleteTeamMissions,
  fetchMissionRecurrences,
  fetchMyMissions,
  fetchStudyableEvents,
  fetchTargetedPractice,
  fetchTeamContext,
  fetchTeamSchedule,
  formatDeadline,
  formatWeeklyDue,
  isOfficerPlus,
  missionIsOverdue,
  missionKind,
  missionLobbyPath,
  missionStartPath,
  overdueLabel,
  saveTeamSchedule,
  stopRecurringMission,
  syncMyMissionProgress,
  tMinus,
  type DeadlinePolicy,
  type MissionGoalType,
  type MissionRecurrence,
  type MissionRow,
  type TeamSchedule,
} from '../../lib/missions'

type AssignTab = 'weekly' | 'casual' | 'timed'

export function MissionsPage() {
  const { profile, refreshProfile, user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const userId = user?.id ?? profile?.id ?? null
  const teamId = profile?.team_id ?? null

  const teamQuery = useQuery({
    queryKey: ['missions-team', teamId, userId],
    queryFn: () => fetchTeamContext(userId!, teamId!),
    enabled: isSupabaseConfigured && Boolean(userId && teamId),
  })

  const missionsQuery = useQuery({
    queryKey: ['missions-list', teamId, userId],
    enabled: isSupabaseConfigured && Boolean(userId && teamId),
    queryFn: async () => {
      try {
        await syncMyMissionProgress()
        await refreshProfile()
      } catch (err) {
        console.warn('sync_my_mission_progress', err)
      }
      return fetchMyMissions(teamId!, userId!)
    },
  })

  const coverageQuery = useQuery({
    queryKey: ['missions-coverage', teamId],
    queryFn: () => fetchTeamEventCoverage(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const scheduleQuery = useQuery({
    queryKey: ['missions-schedule', teamId],
    queryFn: () => fetchTeamSchedule(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const rosterQuery = useQuery({
    queryKey: ['missions-roster', teamId],
    queryFn: () => fetchTeamRoster(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const allEventsQuery = useQuery({
    queryKey: ['missions-events'],
    queryFn: fetchActiveEvents,
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const eventsQuery = useQuery({
    queryKey: ['missions-studyable-events'],
    queryFn: fetchStudyableEvents,
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const officer = isOfficerPlus(teamQuery.data?.role ?? null)
  const missions = missionsQuery.data ?? []
  const myEventIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of coverageQuery.data ?? []) {
      if (row.user_id === userId) ids.add(row.event_id)
    }
    return ids
  }, [coverageQuery.data, userId])

  const mine = useMemo(
    () =>
      missions.filter(
        (m) => m.target_event_id == null || myEventIds.has(m.target_event_id),
      ),
    [missions, myEventIds],
  )

  const now = Date.now()
  const upcoming = mine.filter((m) => Date.parse(m.deadline) > now)
  const old = mine.filter((m) => Date.parse(m.deadline) <= now)
  const loose = upcoming.filter(
    (m) => m.target_event_id == null && !m.completed,
  )
  const expired = [
    ...old.filter((m) => m.target_event_id == null),
    ...mine.filter(
      (m) =>
        m.target_event_id == null &&
        m.completed &&
        Date.parse(m.deadline) > now,
    ),
  ]

  const onBench = useMemo(
    () =>
      (rosterQuery.data ?? []).some(
        (member) => member.user_id === userId && member.role === 'bench',
      ),
    [rosterQuery.data, userId],
  )
  const studyableIds = useMemo(
    () => (eventsQuery.data ?? []).map((event) => event.id),
    [eventsQuery.data],
  )
  const targetIds = onBench ? studyableIds : [...myEventIds]

  const targetQuery = useQuery({
    queryKey: ['missions-target', userId, onBench, targetIds.slice().sort().join('|')],
    queryFn: () => fetchTargetedPractice(userId!, targetIds),
    enabled:
      isSupabaseConfigured &&
      Boolean(userId) &&
      (onBench
        ? eventsQuery.isSuccess && studyableIds.length > 0
        : coverageQuery.isSuccess && myEventIds.size > 0),
  })

  const eventCards = useMemo(() => {
    const names = new Map(
      (allEventsQuery.data ?? []).map((event) => [event.id, event.name]),
    )
    const studyableById = new Map(
      (allEventsQuery.data ?? []).map((event) => [event.id, event.studyable]),
    )
    const people = new Map(
      (rosterQuery.data ?? []).map((member) => [member.user_id, member]),
    )
    const coverage = coverageQuery.data ?? []
    const seen = new Set<string>()
    return coverage
      .filter((row) => {
        if (row.user_id !== userId || seen.has(row.event_id)) return false
        seen.add(row.event_id)
        return true
      })
      .map((row) => ({
        id: row.event_id,
        name: names.get(row.event_id) ?? row.event_id,
        studyable: isStudyableEvent({
          id: row.event_id,
          studyable: studyableById.get(row.event_id),
        }),
        partners: coverage
          .filter(
            (other) =>
              other.event_id === row.event_id && other.user_id !== userId,
          )
          .map((other) => people.get(other.user_id))
          .filter((member): member is RosterMember => Boolean(member))
          .sort((a, b) =>
            (a.display_name || a.handle).localeCompare(
              b.display_name || b.handle,
            ),
          ),
        missions: mine.filter((mission) => {
          if (mission.target_event_id !== row.event_id) return false
          if (
            mission.recurrence_id &&
            Date.parse(mission.deadline) <= Date.now()
          ) {
            return false
          }
          return true
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [
    allEventsQuery.data,
    coverageQuery.data,
    rosterQuery.data,
    mine,
    userId,
  ])

  const [showAssign, setShowAssign] = useState(false)

  const refreshMissions = () => {
    void qc.invalidateQueries({ queryKey: ['missions-list'] })
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load missions.
      </div>
    )
  }

  if (!teamId) {
    return (
      <NoTeamPanel
        reason="Missions require a team. Join with a code or start your own squad."
        onReady={async () => {
          void qc.invalidateQueries({ queryKey: ['missions-team'] })
          void qc.invalidateQueries({ queryKey: ['missions-list'] })
        }}
      />
    )
  }

  const target = targetQuery.data
  const casualHref = target
    ? `/ops/casual?event=${encodeURIComponent(target.eventId)}&topic=${encodeURIComponent(target.topicId)}`
    : '/ops/casual'

  const eventsLoading = coverageQuery.isLoading || allEventsQuery.isLoading
  const studyCards = eventCards.filter((card) => card.studyable)
  const otherEventNames = eventCards
    .filter((card) => !card.studyable)
    .map((card) => card.name)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2">
        <ScheduleCard
          teamId={teamId}
          label="Next Meeting"
          at={scheduleQuery.data?.next_meeting_at ?? null}
          place={scheduleQuery.data?.next_meeting_place ?? null}
          officer={officer}
          which="meeting"
          onSaved={(next) => {
            qc.setQueryData(['missions-schedule', teamId], next)
          }}
        />
        <ScheduleCard
          teamId={teamId}
          label="Next Comp"
          at={scheduleQuery.data?.next_comp_at ?? null}
          place={scheduleQuery.data?.next_comp_place ?? null}
          officer={officer}
          which="comp"
          onSaved={(next) => {
            qc.setQueryData(['missions-schedule', teamId], next)
          }}
        />
      </div>

      <section className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-5 py-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="label-caps shrink-0">
              {onBench ? 'Bench' : 'Your events'}
              {!onBench && studyCards.length > 0 ? ` · ${studyCards.length}` : ''}
            </p>
            {!onBench && otherEventNames.length > 0 && (
              <p className="truncate text-xs text-dim">
                {otherEventNames.join(' · ')}
              </p>
            )}
          </div>
          {officer && (
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="hud-pill shrink-0 px-3 py-1.5 text-[10px] text-cyan"
              style={{ borderColor: 'var(--cyan)' }}
            >
              + Assign
            </button>
          )}
        </div>

        {(loose.length > 0 || expired.length > 0) && !onBench && (
          <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-subtle px-5 py-2">
            {loose.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const path = missionStartPath(item)
                  if (path) navigate(path)
                }}
                className="shrink-0 text-xs text-muted hover:text-cyan"
              >
                {item.title} · {item.current_value}/{item.target_value}
              </button>
            ))}
            {expired.map((item) => (
              <span key={item.id} className="inline-flex shrink-0 items-center gap-2">
                <span className="text-xs text-dim line-through">
                  {item.event_name ?? item.title}
                </span>
                {officer && (
                  <RemoveMissionButton id={item.id} onRemoved={refreshMissions} />
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          {missionsQuery.isError && (
            <p className="px-2 pb-2 text-sm text-alert">
              {missionsQuery.error instanceof Error
                ? missionsQuery.error.message
                : 'Could not load missions'}
            </p>
          )}

          {onBench ? (
            <div className="flex h-full min-h-0 flex-col justify-between rounded-lg border border-subtle bg-surface-elevated p-6">
              <div>
                <p className="text-3xl font-medium text-[var(--text)]">
                  Practice is open
                </p>
                <p className="mt-3 max-w-lg text-sm text-muted">
                  Bench is not on an event and does not take a partner seat.
                  Homework is for people assigned to an event. You can practice
                  any event.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/ops/casual')}
                className="hud-pill self-start px-6 py-3 text-sm text-cyan"
                style={{ borderColor: 'var(--cyan)' }}
              >
                Practice
              </button>
            </div>
          ) : eventsLoading ? (
            <p className="px-2 text-sm text-muted">Loading your events…</p>
          ) : studyCards.length === 0 ? (
            <p className="px-2 text-sm text-muted">
              {otherEventNames.length > 0
                ? 'Question events show here. Builds stay in the header.'
                : 'No events on you yet. Officers assign them from Comms.'}
            </p>
          ) : (
            <EventFill
              cards={studyCards}
              officer={officer}
              onStart={(path) => navigate(path)}
              onRemoved={refreshMissions}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-6 border-t border-subtle px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps">Targeted practice</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {coverageQuery.isLoading || targetQuery.isLoading
                ? 'Checking…'
                : target
                  ? `${target.eventName} · ${target.topicName} · ${target.accuracyPct}%`
                  : onBench
                    ? 'A weak topic shows up after a few questions.'
                    : myEventIds.size === 0
                      ? 'Assign an event first.'
                      : 'No weak topic yet. A few questions on your events first.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!target}
            onClick={() => target && navigate(casualHref)}
            className="hud-pill shrink-0 px-5 py-2.5 text-xs text-cyan disabled:opacity-30"
            style={{ borderColor: 'var(--cyan)' }}
          >
            Practice
          </button>
        </div>
      </section>

      {showAssign && officer && (
        <AssignMissionsModal
          teamId={teamId}
          events={eventsQuery.data ?? []}
          missions={missions}
          onClose={() => setShowAssign(false)}
          onChanged={refreshMissions}
        />
      )}
    </div>
  )
}

function cardLayout(count: number): {
  cols: number
  rows: number
  spans: number[]
} {
  if (count <= 3) {
    return { cols: Math.max(count, 1), rows: 1, spans: Array(count).fill(1) }
  }
  if (count === 4) return { cols: 2, rows: 2, spans: [1, 1, 1, 1] }
  if (count === 5) return { cols: 6, rows: 2, spans: [2, 2, 2, 3, 3] }
  if (count === 7) return { cols: 12, rows: 2, spans: [3, 3, 3, 3, 4, 4, 4] }
  const cols = count <= 6 ? 3 : 4
  if (count > 12) return { cols: 4, rows: 0, spans: [] }
  const rows = Math.ceil(count / cols)
  const last = count % cols || cols
  const spans: number[] = []
  const full = last === cols ? rows : rows - 1
  for (let i = 0; i < full * cols; i++) spans.push(1)
  if (last !== cols) {
    const base = Math.floor(cols / last)
    let extra = cols - base * last
    for (let i = 0; i < last; i++) {
      spans.push(base + (extra > 0 ? 1 : 0))
      if (extra > 0) extra -= 1
    }
  }
  return { cols, rows, spans }
}

function EventFill({
  cards,
  officer,
  onStart,
  onRemoved,
}: {
  cards: Array<{
    id: string
    name: string
    partners: RosterMember[]
    missions: MissionRow[]
  }>
  officer: boolean
  onStart: (path: string) => void
  onRemoved: () => void
}) {
  const layout = cardLayout(cards.length)
  return (
    <ul
      className="grid content-start gap-2.5"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
      }}
    >
      {cards.map((card, index) => {
        const open = card.missions
          .filter((mission) => !mission.completed)
          .sort(
            (a, b) =>
              Date.parse(a.deadline) - Date.parse(b.deadline) ||
              Date.parse(a.created_at) - Date.parse(b.created_at),
          )
        const done = card.missions.filter((mission) => mission.completed)
        return (
          <li
            key={card.id}
            className="event-card rise-in flex min-h-0 flex-col rounded-lg border border-subtle bg-surface-elevated p-4"
            style={{
              gridColumn: layout.spans[index]
                ? `span ${layout.spans[index]}`
                : undefined,
              animationDelay: `${Math.min(index, 8) * 40}ms`,
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-base font-medium text-[var(--text)]">
                {card.name}
              </p>
              {card.partners.length === 0 ? (
                <p className="shrink-0 text-sm text-dim">Seat open</p>
              ) : (
                <p className="min-w-0 max-w-[46%] truncate text-right text-sm">
                  {card.partners.map((partner, partnerIndex) => (
                    <span
                      key={partner.user_id}
                      className={rosterNameClass(partner.role) ?? 'text-[var(--text)]'}
                    >
                      {partnerIndex > 0 ? ', ' : ''}
                      {partner.display_name || `@${partner.handle}`}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <p className="label-caps mt-4">Missions</p>
            {open.length === 0 && done.length === 0 ? (
              <p className="mt-2 text-sm text-dim">None</p>
            ) : open.length > 0 ? (
              <div className="mt-2 max-h-40 space-y-3 overflow-y-auto pr-1">
                {open.map((mission) => (
                  <EventMission
                    key={mission.id}
                    item={mission}
                    officer={officer}
                    onStart={onStart}
                    onRemoved={onRemoved}
                  />
                ))}
              </div>
            ) : null}
            {done.length > 0 && (
              <div className="mt-3 border-t border-subtle pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">
                  Done
                </p>
                <div className="mt-1 max-h-20 overflow-y-auto pr-1">
                  {done.map((mission) => (
                    <CompletedMission
                      key={mission.id}
                      item={mission}
                      officer={officer}
                      onRemoved={onRemoved}
                    />
                  ))}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function EventMission({
  item,
  officer,
  onStart,
  onRemoved,
}: {
  item: MissionRow
  officer: boolean
  onStart: (path: string) => void
  onRemoved: () => void
}) {
  const kind = missionKind(item)
  const label = item.recurrence_id
    ? 'Every week'
    : kind === 'timed'
      ? 'Test'
      : 'Casual'
  const lobby = missionLobbyPath(item)
  const overdue = missionIsOverdue(item)
  return (
    <div>
      <button
        type="button"
        disabled={!lobby}
        aria-label={`Open ${item.event_name ?? 'event'}`}
        onClick={() => lobby && onStart(lobby)}
        className="group flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-[var(--surface-high)] disabled:cursor-default"
      >
        <span
          className={`min-w-0 flex-1 truncate text-sm transition-colors ${
            overdue
              ? 'text-alert group-hover:brightness-150'
              : 'text-muted group-hover:text-cyan'
          }`}
        >
          {label}
          {' · '}
          {item.goal_type === 'correct' ? 'correct' : 'answered'}
          {' · '}
          {overdue ? overdueLabel(item) : `due ${formatDeadline(item.deadline)}`}
        </span>
        <span
          className={`data-mono shrink-0 text-lg font-semibold ${
            overdue ? 'text-alert' : 'text-cyan'
          }`}
        >
          {item.current_value}/{item.target_value}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-lg leading-none ${overdue ? 'text-alert' : 'text-cyan'}`}
        >
          →
        </span>
      </button>
      <div
        className={`mt-2 h-1.5 overflow-hidden rounded-pill border ${
          overdue ? 'border-alert/50' : 'border-cyan/30'
        }`}
      >
        <div
          className={`h-full ${overdue ? 'stripe-progress-alert' : 'stripe-progress'}`}
          style={{ width: `${item.progress_pct}%` }}
        />
      </div>
      {officer && (
        <div className="mt-1.5">
          <RemoveMissionButton
            id={item.id}
            recurrenceId={item.recurrence_id}
            onRemoved={onRemoved}
          />
        </div>
      )}
    </div>
  )
}

function CompletedMission({
  item,
  officer,
  onRemoved,
}: {
  item: MissionRow
  officer: boolean
  onRemoved: () => void
}) {
  const kind = missionKind(item)
  const label = item.recurrence_id
    ? 'Every week'
    : kind === 'timed'
      ? 'Test'
      : 'Casual'
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <p className="min-w-0 truncate text-sm text-dim line-through">
        {label} · {item.current_value}/{item.target_value}
      </p>
      {officer && (
        <RemoveMissionButton
          id={item.id}
          recurrenceId={item.recurrence_id}
          onRemoved={onRemoved}
        />
      )}
    </div>
  )
}

function RemoveMissionButton({
  id,
  recurrenceId,
  onRemoved,
}: {
  id: string
  recurrenceId?: string | null
  onRemoved: () => void
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () =>
      recurrenceId ? stopRecurringMission(recurrenceId) : deleteTeamMissions([id]),
    onSuccess: () => {
      if (recurrenceId) {
        void qc.invalidateQueries({ queryKey: ['mission-recurrences'] })
      }
      onRemoved()
    },
  })
  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm('Remove this mission?')) mutation.mutate()
      }}
      className="data-mono text-[10px] text-dim hover:text-alert disabled:opacity-40"
    >
      {mutation.isPending ? '…' : 'REMOVE'}
    </button>
  )
}

function errText(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function CountField({
  label,
  value,
  onChange,
  presets,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  presets: number[]
}) {
  return (
    <div>
      <span className="label-caps mb-1.5 block text-[9px] text-dim">{label}</span>
      <input
        aria-label={label}
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? 0 : Number(digits))
        }}
        className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 data-mono text-sm text-foreground outline-none focus:border-accent"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {presets.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`hud-pill px-2 py-0.5 text-[10px] ${
              value === n ? 'hud-pill-active' : ''
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function WeeklyRules({
  rules,
  eventName,
  pending,
  onStop,
  onStopAll,
}: {
  rules: MissionRecurrence[]
  eventName: Map<string, string>
  pending: boolean
  onStop: (id: string) => void
  onStopAll: () => void
}) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="label-caps text-[9px] text-dim">
          Every week{rules.length > 0 ? ` · ${rules.length}` : ''}
        </p>
        <button
          type="button"
          disabled={pending || rules.length === 0}
          onClick={onStopAll}
          className="data-mono text-[10px] text-dim hover:text-alert disabled:opacity-40"
        >
          Stop all
        </button>
      </div>
      <ul className="max-h-52 space-y-1.5 overflow-y-auto overscroll-contain rounded-md border border-subtle p-2">
        {rules.length === 0 ? (
          <li className="px-2 py-3 text-sm text-dim">No weekly missions yet.</li>
        ) : (
          rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {eventName.get(rule.event_id) ?? rule.event_id}
                </p>
                <p className="truncate text-xs text-dim">
                  {rule.target_value} {rule.goal_type} · due{' '}
                  {formatWeeklyDue(rule.due_isodow, rule.due_minute)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => onStop(rule.id)}
                className="data-mono shrink-0 text-[10px] text-dim hover:text-alert"
              >
                Stop
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  )
}

function OneOffBoard({
  board,
  pending,
  onRemove,
}: {
  board: MissionRow[]
  pending: boolean
  onRemove: (ids: string[]) => void
}) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="label-caps text-[9px] text-dim">
          On the board{board.length > 0 ? ` · ${board.length}` : ''}
        </p>
        <button
          type="button"
          disabled={pending || board.length === 0}
          onClick={() => {
            if (window.confirm(`Remove all ${board.length} upcoming missions?`)) {
              onRemove(board.map((mission) => mission.id))
            }
          }}
          className="data-mono text-[10px] text-dim hover:text-alert disabled:opacity-40"
        >
          Remove all
        </button>
      </div>
      <ul className="max-h-52 space-y-1.5 overflow-y-auto overscroll-contain rounded-md border border-subtle p-2">
        {board.length === 0 ? (
          <li className="px-2 py-3 text-sm text-dim">Nothing assigned right now.</li>
        ) : (
          board.map((mission) => (
            <li
              key={mission.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {mission.event_name ?? 'Any event'}
                </p>
                <p className="truncate text-xs text-dim">
                  {mission.title} · due {formatDeadline(mission.deadline)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => onRemove([mission.id])}
                className="data-mono shrink-0 text-[10px] text-dim hover:text-alert"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  )
}

function AssignMissionsModal({
  teamId,
  events,
  missions,
  onClose,
  onChanged,
}: {
  teamId: string
  events: Array<{ id: string; name: string }>
  missions: MissionRow[]
  onClose: () => void
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<AssignTab>('weekly')
  const [goalType, setGoalType] = useState<MissionGoalType>('answered')
  const [questions, setQuestions] = useState(25)
  const [minutes, setMinutes] = useState(20)
  const [selected, setSelected] = useState<string[]>([])
  const [deadlinePolicyChoice, setDeadlinePolicyChoice] = useState<DeadlinePolicy>('late')
  const [dueIsodow, setDueIsodow] = useState(7)
  const [dueTime, setDueTime] = useState('23:59')
  const [deadlineLocal, setDeadlineLocal] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3_600_000)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [error, setError] = useState<string | null>(null)

  const rulesQuery = useQuery({
    queryKey: ['mission-recurrences', teamId],
    queryFn: () => fetchMissionRecurrences(teamId),
  })
  const rules = rulesQuery.data ?? []
  const eventName = new Map(events.map((event) => [event.id, event.name]))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const now = Date.now()
  const board = missions.filter(
    (m) => !m.recurrence_id && Date.parse(m.deadline) > now,
  )
  const dueMinute = (() => {
    const [hourText, minuteText] = dueTime.split(':')
    const hour = Number(hourText)
    const minute = Number(minuteText)
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  })()

  const createMutation = useMutation({
    mutationFn: async () => {
      if (tab === 'weekly') {
        await createRecurringMissions({
          goalType,
          targetValue: questions,
          dueIsodow,
          dueMinute: dueMinute ?? 0,
          eventIds: selected,
        })
        return
      }
      await createEventMissions({
        kind: tab === 'timed' ? 'timed' : 'casual',
        goalType,
        targetValue: questions,
        deadlineIso: new Date(deadlineLocal).toISOString(),
        eventIds: selected,
        timedSeconds: tab === 'timed' ? minutes * 60 : null,
        deadlinePolicy: deadlinePolicyChoice,
      })
    },
    onSuccess: () => {
      setError(null)
      setSelected([])
      void qc.invalidateQueries({ queryKey: ['mission-recurrences', teamId] })
      onChanged()
    },
    onError: (err) => {
      setError(errText(err, 'Could not assign'))
    },
  })

  const clearMutation = useMutation({
    mutationFn: (ids: string[]) => deleteTeamMissions(ids),
    onSuccess: () => {
      setError(null)
      onChanged()
    },
    onError: (err) => {
      setError(errText(err, 'Could not remove'))
    },
  })

  const stopMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => stopRecurringMission(id))),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['mission-recurrences', teamId] })
      onChanged()
    },
    onError: (err) => {
      setError(errText(err, 'Could not stop'))
    },
  })

  const ready =
    selected.length > 0 &&
    questions >= 1 &&
    (tab === 'weekly'
      ? dueMinute != null
      : Boolean(deadlineLocal) &&
        Date.parse(deadlineLocal) > Date.now() &&
        (tab === 'casual' || minutes >= 1))

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    createMutation.mutate()
  }

  const summary =
    tab === 'weekly'
      ? `${questions} ${goalType} every week, due ${formatWeeklyDue(dueIsodow, dueMinute ?? 0)}, on ${selected.length} event${selected.length === 1 ? '' : 's'}`
      : tab === 'timed'
        ? `${questions} question test, ${minutes} min, on ${selected.length} event${selected.length === 1 ? '' : 's'}`
        : `${questions} casual ${goalType} on ${selected.length} event${selected.length === 1 ? '' : 's'}`

  return (
    <ModalScrim label="Assign missions" onClose={onClose}>
      <div
        className="hud-panel rise-in w-full max-w-3xl border-cyan/30 shadow-[0_0_48px_var(--accent-dim)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div>
            <p className="label-caps">Assign</p>
            <h2 className="mt-1 text-2xl font-medium text-[var(--text)]">
              {tab === 'weekly' ? 'Every week' : 'One mission per event'}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              {tab === 'weekly'
                ? 'Pick the count, answered or correct, and the weekly deadline. Each week starts at zero. Last week’s answers stay on last week.'
                : 'Check the events. Each one becomes its own mission, and only the people assigned to that event see it.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="hud-pill px-4 py-2 text-xs">
            CLOSE
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['weekly', 'Every week'],
                  ['casual', 'Casual'],
                  ['timed', 'Tests'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    tab === id
                      ? 'border-cyan bg-cyan/10 text-cyan'
                      : 'border-subtle text-muted hover:border-cyan/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <CountField
                label="Questions"
                value={questions}
                onChange={setQuestions}
                presets={[10, 25, 50]}
              />
              {tab === 'timed' ? (
                <CountField
                  label="Minutes"
                  value={minutes}
                  onChange={setMinutes}
                  presets={[10, 20, 30]}
                />
              ) : (
                <div>
                  <span className="label-caps mb-1.5 block text-[9px] text-dim">
                    Count
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['answered', 'Answered'],
                        ['correct', 'Correct'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setGoalType(id)}
                        className={`rounded-md border px-2 py-2 text-sm ${
                          goalType === id
                            ? 'border-cyan bg-cyan/10 text-cyan'
                            : 'border-subtle text-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {tab === 'weekly' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="label-caps mb-1.5 block text-[9px] text-dim">
                    Due day
                  </span>
                  <div className="grid grid-cols-7 gap-1">
                    {(
                      [
                        [1, 'Mo'],
                        [2, 'Tu'],
                        [3, 'We'],
                        [4, 'Th'],
                        [5, 'Fr'],
                        [6, 'Sa'],
                        [7, 'Su'],
                      ] as const
                    ).map(([day, letter]) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setDueIsodow(day)}
                        className={`rounded-md border py-2 text-sm ${
                          dueIsodow === day
                            ? 'border-cyan bg-cyan/10 text-cyan'
                            : 'border-subtle text-muted'
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="label-caps mb-1.5 block text-[9px] text-dim">
                    Due time
                  </span>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 data-mono text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
              </div>
            ) : (
              <>
                <div>
                  <span className="label-caps mb-1.5 block text-[9px] text-dim">
                    After the deadline
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['late', 'Late'],
                        ['close', 'Closes'],
                        ['count', 'Counts'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDeadlinePolicyChoice(id)}
                        className={`rounded-md border px-2 py-2 text-sm ${
                          deadlinePolicyChoice === id
                            ? 'border-cyan bg-cyan/10 text-cyan'
                            : 'border-subtle text-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-dim">
                    {deadlinePolicyChoice === 'close'
                      ? 'After the deadline it is closed and later work does not fill it.'
                      : deadlinePolicyChoice === 'count'
                        ? 'It stays open and still counts.'
                        : 'It stays open, turns red, and later work still fills it.'}
                  </p>
                </div>
                <label className="block">
                  <span className="label-caps mb-1.5 block text-[9px] text-dim">
                    Deadline
                  </span>
                  <input
                    type="datetime-local"
                    value={deadlineLocal}
                    onChange={(e) => setDeadlineLocal(e.target.value)}
                    className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 data-mono text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
              </>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="label-caps text-[9px] text-dim">Events</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="data-mono text-[10px] text-cyan hover:underline"
                    onClick={() => setSelected(events.map((ev) => ev.id))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="data-mono text-[10px] text-dim hover:text-foreground"
                    onClick={() => setSelected([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="grid max-h-52 gap-1 overflow-y-auto overscroll-contain rounded-md border border-subtle p-2 sm:grid-cols-2">
                {events.length === 0 && (
                  <li className="px-2 py-3 text-sm text-dim">Loading events…</li>
                )}
                {events.map((ev) => {
                  const on = selected.includes(ev.id)
                  return (
                    <li key={ev.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                          on ? 'bg-cyan/10 text-cyan' : 'text-foreground hover:bg-surface-high'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(ev.id)}
                        />
                        <span className="truncate">{ev.name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <p className="data-mono text-xs text-muted">
              {selected.length === 0
                ? 'Check at least one event.'
                : tab === 'weekly'
                  ? `Will save ${selected.length} weekly mission${selected.length === 1 ? '' : 's'} · ${summary}`
                  : `Will create ${selected.length} mission${selected.length === 1 ? '' : 's'} · ${summary}`}
            </p>
            {questions < 1 && (
              <p className="text-xs text-alert">Question count has to be at least 1.</p>
            )}
            {error && <p className="text-sm text-alert">{error}</p>}

            <div className="border-t border-subtle pt-4">
              {tab === 'weekly' ? (
                <WeeklyRules
                  rules={rules}
                  eventName={eventName}
                  pending={stopMutation.isPending}
                  onStop={(id) => stopMutation.mutate([id])}
                  onStopAll={() => {
                    if (
                      window.confirm(
                        `Stop all ${rules.length} weekly missions?`,
                      )
                    ) {
                      stopMutation.mutate(rules.map((rule) => rule.id))
                    }
                  }}
                />
              ) : (
                <OneOffBoard
                  board={board}
                  pending={clearMutation.isPending}
                  onRemove={(ids) => clearMutation.mutate(ids)}
                />
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-subtle px-5 py-4">
            <button
              type="submit"
              disabled={!ready || createMutation.isPending}
              className="hud-pill w-full py-2.5 text-sm text-cyan disabled:opacity-40"
              style={{ borderColor: 'var(--cyan)' }}
            >
              {createMutation.isPending
                ? 'Saving…'
                : tab === 'weekly'
                  ? `Save weekly${selected.length ? ` ${selected.length}` : ''}`
                  : `Assign ${selected.length || ''}`.trim()}
            </button>
          </div>
        </form>
      </div>
    </ModalScrim>
  )
}

function ScheduleCard({
  teamId,
  label,
  at,
  place,
  officer,
  which,
  onSaved,
}: {
  teamId: string
  label: string
  at: string | null
  place: string | null
  officer: boolean
  which: 'meeting' | 'comp'
  onSaved: (next: TeamSchedule) => void
}) {
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState('')
  const [error, setError] = useState<string | null>(null)

  function open() {
    if (at) {
      const d = new Date(at)
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      setWhen(d.toISOString().slice(0, 16))
    } else {
      setWhen('')
    }
    setWhere(place ?? '')
    setError(null)
    setEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      saveTeamSchedule({
        teamId,
        which,
        at: when ? new Date(when).toISOString() : null,
        place: where,
      }),
    onSuccess: (next) => {
      setEditing(false)
      setError(null)
      onSaved(next)
    },
    onError: (err) => {
      setError(errText(err, 'Could not save'))
    },
  })

  return (
    <div className="hud-panel rise-in px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label-caps shrink-0">{label}</p>
        {!editing && (
          <p className="min-w-0 truncate text-sm text-muted">
            {at ? formatDeadline(at) : 'Schedule TBD'}
            <span className="text-dim">
              {' '}
              · {place?.trim() ? place : 'Place —'}
              {at ? ` · ${tMinus(at)}` : ''}
            </span>
          </p>
        )}
        {officer && !editing && (
          <button
            type="button"
            onClick={open}
            className="data-mono shrink-0 text-[10px] text-cyan hover:underline"
          >
            EDIT
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 data-mono text-sm text-foreground outline-none focus:border-accent"
          />
          <input
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="Room or place"
            className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-alert">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="hud-pill px-3 py-1.5 text-[10px] text-cyan"
              style={{ borderColor: 'var(--cyan)' }}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="hud-pill px-3 py-1.5 text-[10px]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
