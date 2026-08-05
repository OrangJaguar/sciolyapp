import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  createTeamMission,
  fetchMyMissions,
  fetchStudyableEvents,
  fetchTargetedPractice,
  fetchTeamContext,
  formatDeadline,
  isOfficerPlus,
  joinTeamByCode,
  syncMyMissionProgress,
  tMinus,
  type MissionGoalType,
  type MissionRow,
} from '../../lib/missions'

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
      const sync = await syncMyMissionProgress()
      if (sync.xp_awarded > 0) await refreshProfile()
      return fetchMyMissions(teamId!, userId!)
    },
  })

  const targetQuery = useQuery({
    queryKey: ['missions-target', userId],
    queryFn: () => fetchTargetedPractice(userId!),
    enabled: isSupabaseConfigured && Boolean(userId),
  })

  const eventsQuery = useQuery({
    queryKey: ['missions-studyable-events'],
    queryFn: fetchStudyableEvents,
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const officer = isOfficerPlus(teamQuery.data?.role ?? null)
  const missions = missionsQuery.data ?? []
  const now = Date.now()
  const upcoming = missions.filter((m) => Date.parse(m.deadline) > now)
  const old = missions.filter((m) => Date.parse(m.deadline) <= now)
  const nearest = upcoming[0] ?? null

  const [showCreate, setShowCreate] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const joinMutation = useMutation({
    mutationFn: () => joinTeamByCode(joinCode),
    onSuccess: async () => {
      setJoinError(null)
      setJoinCode('')
      await refreshProfile()
      void qc.invalidateQueries({ queryKey: ['missions-team'] })
      void qc.invalidateQueries({ queryKey: ['missions-list'] })
    },
    onError: (err) => {
      setJoinError(err instanceof Error ? err.message : 'Join failed')
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load missions.
      </div>
    )
  }

  if (!teamId) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
        <div className="hud-panel p-6">
          <p className="label-caps">Freelancer</p>
          <h1 className="mt-2 text-2xl font-medium text-white">Join a unit</h1>
          <p className="mt-2 text-sm text-muted">
            Missions require a team. Enter a join code from your captain or
            coach.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              joinMutation.mutate()
            }}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="JOIN CODE"
              className="w-full rounded-md border border-white/15 bg-void px-3 py-2.5 data-mono text-sm tracking-widest text-white outline-none focus:border-cyan"
              autoComplete="off"
            />
            {joinError && <p className="text-sm text-alert">{joinError}</p>}
            <button
              type="submit"
              disabled={joinCode.trim().length < 4 || joinMutation.isPending}
              className="hud-pill hud-pill-active w-full py-3 text-sm disabled:opacity-40"
            >
              {joinMutation.isPending ? 'Joining…' : 'JOIN TEAM'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const team = teamQuery.data?.team
  const target = targetQuery.data
  const casualHref = target
    ? `/ops/casual?event=${encodeURIComponent(target.eventId)}&topic=${encodeURIComponent(target.topicId)}`
    : '/ops/casual'

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(360px,32%)_1fr] lg:gap-4">
      <aside className="hud-panel flex min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-5">
        <div className="flex shrink-0 flex-col gap-2.5">
          <div className="hud-pill w-full justify-start px-4 py-2.5 text-sm text-muted">
            UNIT: {team?.school_name ?? '…'}
          </div>
          <div className="hud-pill hud-pill-active w-full justify-start px-4 py-2.5 text-sm">
            SQUAD: {team?.name ?? '…'}
          </div>
        </div>

        <section className="min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="label-caps">Upcoming:</p>
            {officer && (
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="data-mono text-xs text-cyan hover:underline"
              >
                {showCreate ? 'CLOSE' : '+ CREATE'}
              </button>
            )}
          </div>
          {nearest ? (
            <p className="mb-3 data-mono text-xs text-muted lg:text-sm">
              Due {formatDeadline(nearest.deadline)} ({tMinus(nearest.deadline)})
            </p>
          ) : (
            <p className="mb-3 data-mono text-xs text-muted lg:text-sm">
              No open deadlines
            </p>
          )}

          {showCreate && officer && (
            <CreateMissionForm
              events={eventsQuery.data ?? []}
              onCreated={() => {
                setShowCreate(false)
                void qc.invalidateQueries({ queryKey: ['missions-list'] })
              }}
            />
          )}

          {missionsQuery.isLoading && (
            <p className="text-base text-muted">Syncing missions…</p>
          )}
          {missionsQuery.error && (
            <p className="text-base text-alert">
              {missionsQuery.error instanceof Error
                ? missionsQuery.error.message
                : 'Failed to load missions'}
            </p>
          )}

          <ul className="space-y-3.5">
            {upcoming.map((item) => (
              <MissionListItem key={item.id} item={item} />
            ))}
            {!missionsQuery.isLoading && upcoming.length === 0 && (
              <li className="text-base text-muted">
                {officer
                  ? 'No upcoming missions. Create one for the squad.'
                  : 'No upcoming missions yet.'}
              </li>
            )}
          </ul>
        </section>

        <section className="mt-auto shrink-0 pt-2">
          <p className="label-caps mb-2" style={{ color: 'var(--text-dim)' }}>
            Old:
          </p>
          <ul className="space-y-2">
            {old.map((item) => (
              <li key={item.id} className="text-base text-dim line-through">
                {item.title}
                {item.event_name ? ` / ${item.event_name}` : ''}
              </li>
            ))}
            {old.length === 0 && (
              <li className="text-base text-dim">No past missions</li>
            )}
          </ul>
        </section>
      </aside>

      <div className="flex min-h-0 flex-col gap-3 lg:gap-4">
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:gap-4">
          <div className="hud-panel p-4 lg:p-5">
            <p className="label-caps mb-2">Next Meeting</p>
            <p className="data-mono text-2xl font-semibold text-muted lg:text-3xl">
              Schedule TBD
            </p>
            <p className="mt-1 data-mono text-base text-dim">T-MINUS —</p>
            <p className="mt-3 text-base tracking-wide text-dim">ROOM —</p>
          </div>
          <div className="hud-panel p-4 lg:p-5">
            <p className="label-caps mb-2">Next Comp</p>
            <p className="data-mono text-2xl font-semibold text-muted lg:text-3xl">
              Schedule TBD
            </p>
            <p className="mt-1 data-mono text-base text-dim">T-MINUS —</p>
            <button
              type="button"
              disabled
              className="mt-3 text-base tracking-wide text-dim"
            >
              SYSTEM_INFO
            </button>
          </div>
        </div>

        <div className="hud-panel relative flex min-h-0 flex-1 flex-col p-5 lg:p-7">
          <p className="label-caps">Targeted Practice</p>
          {targetQuery.isLoading ? (
            <p className="mt-3 text-base text-muted">Diagnosing weakness…</p>
          ) : target ? (
            <>
              <h2 className="mt-3 text-4xl font-medium tracking-tight text-[var(--text)] lg:text-5xl xl:text-6xl">
                {target.eventName}
              </h2>
              <p className="mt-3 flex items-center gap-2 text-lg text-muted lg:text-xl">
                <span className="text-cyan" aria-hidden>
                  └
                </span>
                {target.topicName}
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-4xl font-medium tracking-tight text-[var(--text)] lg:text-5xl xl:text-6xl">
                Start grinding
              </h2>
              <p className="mt-3 text-lg text-muted lg:text-xl">
                No weakness map yet — open Casual to build one.
              </p>
            </>
          )}
          <div className="mt-auto flex items-end justify-between gap-4 pt-6">
            <div>
              <p className="label-caps" style={{ color: 'var(--text-muted)' }}>
                Current Accuracy
              </p>
              <p className="mt-1 data-mono text-4xl font-semibold text-cyan lg:text-5xl">
                {target?.accuracyPct != null ? `${target.accuracyPct}%` : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(casualHref)}
              className="hud-pill px-10 py-3.5 text-base text-cyan shadow-[0_0_20px_var(--cyan-dim)] lg:px-12 lg:py-4 lg:text-lg"
              style={{ borderColor: 'var(--cyan)' }}
            >
              CASUAL →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MissionListItem({ item }: { item: MissionRow }) {
  const label = item.event_name ?? 'Any event'
  return (
    <li
      className={`flex items-center gap-3 text-base ${
        item.completed ? 'text-dim line-through' : 'text-[var(--text)]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.title}</div>
        <div className="text-sm text-muted">
          / {label} · {item.current_value}/{item.target_value}{' '}
          {item.goal_type === 'correct' ? 'correct' : 'answered'}
        </div>
      </div>
      {!item.completed && (
        <div className="flex w-20 items-center gap-1.5">
          <div className="h-2 flex-1 overflow-hidden rounded-pill border border-cyan/30">
            <div
              className="stripe-progress h-full"
              style={{ width: `${item.progress_pct}%` }}
            />
          </div>
          <span className="data-mono text-xs text-cyan">{item.progress_pct}</span>
        </div>
      )}
      {!item.completed && (
        <span className="text-lg text-cyan" aria-hidden>
          →
        </span>
      )}
    </li>
  )
}

function CreateMissionForm({
  events,
  onCreated,
}: {
  events: Array<{ id: string; name: string }>
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [eventId, setEventId] = useState('')
  const [goalType, setGoalType] = useState<MissionGoalType>('answered')
  const [targetValue, setTargetValue] = useState(25)
  const [deadlineLocal, setDeadlineLocal] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3_600_000)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createTeamMission({
        title,
        targetEventId: eventId || null,
        goalType,
        targetValue,
        deadlineIso: new Date(deadlineLocal).toISOString(),
      }),
    onSuccess: () => {
      setError(null)
      setTitle('')
      onCreated()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Create failed')
    },
  })

  const canSubmit = useMemo(
    () => title.trim().length >= 2 && targetValue >= 1 && Boolean(deadlineLocal),
    [title, targetValue, deadlineLocal],
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    createMutation.mutate()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 space-y-2 rounded-md border border-cyan/25 bg-void/60 p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 25 casual Chem Lab answers"
        className="w-full rounded-md border border-white/15 bg-surface px-2.5 py-2 text-sm text-white outline-none focus:border-cyan"
      />
      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        className="w-full rounded-md border border-white/15 bg-surface px-2.5 py-2 text-sm text-white outline-none focus:border-cyan"
      >
        <option value="">Any studyable event</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={goalType}
          onChange={(e) => setGoalType(e.target.value as MissionGoalType)}
          className="rounded-md border border-white/15 bg-surface px-2.5 py-2 text-sm text-white outline-none focus:border-cyan"
        >
          <option value="answered">Answered</option>
          <option value="correct">Correct</option>
        </select>
        <input
          type="number"
          min={1}
          value={targetValue}
          onChange={(e) => setTargetValue(Number(e.target.value) || 1)}
          className="rounded-md border border-white/15 bg-surface px-2.5 py-2 data-mono text-sm text-white outline-none focus:border-cyan"
        />
      </div>
      <input
        type="datetime-local"
        value={deadlineLocal}
        onChange={(e) => setDeadlineLocal(e.target.value)}
        className="w-full rounded-md border border-white/15 bg-surface px-2.5 py-2 data-mono text-sm text-white outline-none focus:border-cyan"
      />
      {error && <p className="text-xs text-alert">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit || createMutation.isPending}
        className="hud-pill w-full py-2 text-xs text-cyan disabled:opacity-40"
        style={{ borderColor: 'var(--cyan)' }}
      >
        {createMutation.isPending ? 'Saving…' : 'DEPLOY MISSION'}
      </button>
    </form>
  )
}
