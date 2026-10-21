import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { NoTeamPanel } from '../../components/team/NoTeamPanel'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  fetchStudyableEvents,
  fetchTeamContext,
  fetchTeamLeaderboard,
  leaderboardErrorMessage,
  metricLabel,
  placeTone,
  windowLabel,
  type LeaderboardMetric,
  type LeaderboardWindow,
} from '../../lib/leaderboard'

const badge: Record<string, string> = {
  gold: 'bg-[#e8c547] text-[var(--on-accent)]',
  silver: 'bg-[#c0c0c0] text-[var(--on-accent)]',
  bronze: 'bg-[#cd7f32] text-[var(--on-accent)]',
  dim: 'bg-transparent text-dim',
}

export function LeaderboardPage() {
  const { profile, user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? profile?.id ?? null
  const teamId = profile?.team_id ?? null

  const [metric, setMetric] = useState<LeaderboardMetric>('xp')
  const [eventId, setEventId] = useState<string | null>(null)
  const [window, setWindow] = useState<LeaderboardWindow>('all')
  const [openFilter, setOpenFilter] = useState<'metric' | 'event' | 'time' | null>(
    null,
  )

  const teamQuery = useQuery({
    queryKey: ['lb-team', teamId, userId],
    queryFn: () => fetchTeamContext(userId!, teamId!),
    enabled: isSupabaseConfigured && Boolean(userId && teamId),
  })

  const eventsQuery = useQuery({
    queryKey: ['lb-events'],
    queryFn: fetchStudyableEvents,
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const boardQuery = useQuery({
    queryKey: ['lb-board', teamId, metric, eventId, window],
    queryFn: () =>
      fetchTeamLeaderboard({ metric, eventId, window }),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load leaderboard.
      </div>
    )
  }

  if (!teamId) {
    return (
      <NoTeamPanel
        reason="Leaderboard is team-scoped. Join with a code or start your own squad."
        onReady={async () => {
          void qc.invalidateQueries({ queryKey: ['lb-team'] })
          void qc.invalidateQueries({ queryKey: ['lb-board'] })
          void qc.invalidateQueries({ queryKey: ['lb-events'] })
        }}
      />
    )
  }

  const rows = boardQuery.data ?? []
  const eventName =
    eventId == null
      ? 'All'
      : (eventsQuery.data?.find((e) => e.id === eventId)?.name ?? eventId)
  const xpNote = metric === 'xp' && (eventId != null || window !== 'all')

  return (
    <div className="hud-panel flex h-full min-h-0 w-full flex-col overflow-hidden p-4 lg:p-5">
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
        <p className="label-caps mr-auto">
          {(teamQuery.data?.team?.name ?? 'Squad').toUpperCase()} · Leaderboard
        </p>
      </div>

      <div className="mb-4 flex shrink-0 flex-wrap gap-3">
        <FilterButton
          label="METRIC"
          value={metricLabel(metric)}
          open={openFilter === 'metric'}
          onToggle={() =>
            setOpenFilter((v) => (v === 'metric' ? null : 'metric'))
          }
        >
          {(['xp', 'correct', 'answered'] as const).map((m) => (
            <FilterOption
              key={m}
              active={metric === m}
              onClick={() => {
                setMetric(m)
                setOpenFilter(null)
              }}
            >
              {metricLabel(m)}
            </FilterOption>
          ))}
        </FilterButton>

        <FilterButton
          label="EVENT"
          value={eventName}
          open={openFilter === 'event'}
          onToggle={() => setOpenFilter((v) => (v === 'event' ? null : 'event'))}
        >
          <FilterOption
            active={eventId == null}
            onClick={() => {
              setEventId(null)
              setOpenFilter(null)
            }}
          >
            All
          </FilterOption>
          {(eventsQuery.data ?? []).map((ev) => (
            <FilterOption
              key={ev.id}
              active={eventId === ev.id}
              onClick={() => {
                setEventId(ev.id)
                setOpenFilter(null)
              }}
            >
              {ev.name}
            </FilterOption>
          ))}
        </FilterButton>

        <FilterButton
          label="TIME"
          value={windowLabel(window)}
          open={openFilter === 'time'}
          onToggle={() => setOpenFilter((v) => (v === 'time' ? null : 'time'))}
        >
          {(['all', 'season', '30d', '7d'] as const).map((w) => (
            <FilterOption
              key={w}
              active={window === w}
              onClick={() => {
                setWindow(w)
                setOpenFilter(null)
              }}
            >
              {windowLabel(w)}
            </FilterOption>
          ))}
        </FilterButton>
      </div>

      {xpNote && (
        <p className="mb-3 shrink-0 data-mono text-xs text-dim">
          XP is all-time — event/time filters apply to Correct / Answered.
        </p>
      )}

      {boardQuery.isLoading && (
        <p className="text-sm text-muted">Loading ranks…</p>
      )}
      {boardQuery.error && (
        <p className="text-sm text-alert">
          {leaderboardErrorMessage(boardQuery.error)}
        </p>
      )}

      <ul className="min-h-0 space-y-2 overflow-y-auto pr-1">
        {rows.map((row) => {
          const tone = placeTone(row.place)
          const isMe = row.user_id === userId
          return (
            <li
              key={row.user_id}
              className={`flex items-center gap-4 rounded-pill border px-4 py-2.5 ${
                isMe
                  ? 'border-cyan/60 bg-cyan/10 shadow-[0_0_18px_var(--accent-dim)]'
                  : 'border-[var(--ghost-border)] bg-surface-elevated'
              } ${tone === 'dim' && !isMe ? 'opacity-45' : ''}`}
            >
              <span
                className={`data-mono flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${badge[tone]}`}
              >
                {row.place}
              </span>
              <span
                className={`data-mono flex-1 text-sm tracking-wider ${
                  row.place === 1 || isMe ? 'text-cyan' : 'text-[var(--text)]'
                }`}
              >
                {row.handle.toUpperCase()}
                {isMe ? ' · YOU' : ''}
              </span>
              <span className="data-mono shrink-0 text-sm text-cyan">
                {row.score.toLocaleString()}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--ghost-border)] data-mono text-[9px] text-dim">
                {row.handle.slice(0, 2).toUpperCase()}
              </span>
            </li>
          )
        })}
        {!boardQuery.isLoading && rows.length === 0 && (
          <li className="text-sm text-dim">No teammates on the board yet.</li>
        )}
      </ul>
    </div>
  )
}

function FilterButton({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string
  value: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-md border px-4 py-2 text-left transition ${
          open ? 'border-cyan' : 'border-cyan/40 hover:border-cyan/70'
        }`}
      >
        <span className="label-caps block text-[10px]">{label}</span>
        <span className="data-mono text-sm text-[var(--text)]">
          {value} ▾
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-[10rem] rounded-md border border-cyan/30 bg-surface-elevated p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {children}
        </div>
      )}
    </div>
  )
}

function FilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded px-3 py-2 text-left text-sm ${
        active ? 'bg-cyan/15 text-cyan' : 'text-muted hover:bg-surface-high hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  )
}
