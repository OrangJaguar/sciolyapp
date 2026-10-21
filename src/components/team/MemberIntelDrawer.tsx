import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  coverageLabel,
  fetchActiveEvents,
  formatRole,
  nextCoverageStatus,
  removeTeamMember,
  setEventCoverage,
  setTeamMemberRole,
  type CoverageStatus,
} from '../../lib/comms'
import { fetchTeamMemberIntel } from '../../lib/memberIntel'
import {
  formatRankHud,
  formatXp,
  xpProgress,
} from '../../lib/progression'
import type { TeamRole } from '../../lib/types'

type Props = {
  userId: string
  selfId: string
  selfRole: TeamRole | null
  onClose: () => void
  onChanged: () => void
}

export function MemberIntelDrawer({
  userId,
  selfId,
  selfRole,
  onClose,
  onChanged,
}: Props) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [addingEvent, setAddingEvent] = useState(false)

  const intelQuery = useQuery({
    queryKey: ['member-intel', userId],
    queryFn: () => fetchTeamMemberIntel(userId),
  })

  const eventsQuery = useQuery({
    queryKey: ['comms-events'],
    queryFn: fetchActiveEvents,
  })

  const intel = intelQuery.data
  const isSelf = userId === selfId
  const roleOptions: TeamRole[] =
    selfRole === 'coach'
      ? ['member', 'officer', 'captain', 'coach']
      : ['member', 'officer', 'captain']

  const assignedIds = useMemo(
    () => new Set((intel?.coverage ?? []).map((c) => c.event_id)),
    [intel?.coverage],
  )

  const availableEvents = useMemo(() => {
    const events = eventsQuery.data ?? []
    return events.filter((e) => !assignedIds.has(e.id))
  }, [eventsQuery.data, assignedIds])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['member-intel', userId] })
    onChanged()
  }

  const roleMutation = useMutation({
    mutationFn: (role: TeamRole) => setTeamMemberRole(userId, role),
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Role update failed'),
  })

  const coverageMutation = useMutation({
    mutationFn: ({
      eventId,
      status,
    }: {
      eventId: string
      status: CoverageStatus | 'off'
    }) => setEventCoverage(userId, eventId, status),
    onSuccess: () => {
      setError(null)
      setAddingEvent(false)
      invalidate()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Coverage update failed'),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeTeamMember(userId),
    onSuccess: () => {
      setError(null)
      onChanged()
      onClose()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Remove failed'),
  })

  const xp = intel?.xp ?? 0
  const progressPct = Math.round(xpProgress(xp) * 100)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Member intel"
      onClick={onClose}
    >
      <div
        className="hud-panel flex h-full w-full max-w-md flex-col overflow-hidden border-l border-cyan/30 shadow-[0_0_48px_var(--accent-dim)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps text-dim">Member intel</p>
            {intelQuery.isLoading ? (
              <p className="mt-2 text-sm text-muted">Loading…</p>
            ) : intel ? (
              <>
                <h2 className="mt-1 truncate font-display text-2xl text-foreground">
                  {intel.display_name || `@${intel.handle}`}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  @{intel.handle}
                  {isSelf ? ' · you' : ''}
                  {intel.school_name ? ` · ${intel.school_name}` : ''}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-alert">Could not load member.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hud-pill px-4 py-2 text-xs"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {intelQuery.error ? (
            <p className="text-sm text-alert">
              {intelQuery.error instanceof Error
                ? intelQuery.error.message
                : 'Failed to load intel'}
            </p>
          ) : null}
          {error ? <p className="text-sm text-alert">{error}</p> : null}

          {intel ? (
            <>
              <section className="space-y-2">
                <p className="label-caps text-dim">Identity</p>
                <div className="flex flex-wrap gap-3 text-sm text-muted">
                  <span>Div {intel.division}</span>
                  <span>·</span>
                  <span>{formatRole(intel.role)}</span>
                </div>
                {!isSelf ? (
                  <label className="mt-2 block">
                    <span className="label-caps text-dim">Role</span>
                    <select
                      value={intel.role}
                      disabled={roleMutation.isPending}
                      onChange={(e) =>
                        roleMutation.mutate(e.target.value as TeamRole)
                      }
                      className="mt-2 w-full rounded-md border border-subtle bg-void px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {formatRole(r)}
                        </option>
                      ))}
                      {!roleOptions.includes(intel.role) && (
                        <option value={intel.role}>
                          {formatRole(intel.role)}
                        </option>
                      )}
                    </select>
                  </label>
                ) : null}
              </section>

              <section className="space-y-3">
                <p className="label-caps text-dim">Progression</p>
                <p className="font-display text-lg text-cyan">
                  {formatRankHud(xp)}
                </p>
                <div className="xp-stripes h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-[repeating-linear-gradient(90deg,var(--cyan)_0_8px,transparent_8px_12px)]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <Stat label="XP" value={formatXp(xp)} />
                  <Stat label="Streak" value={`${intel.current_streak}d`} />
                  <Stat
                    label="Answered"
                    value={String(intel.questions_answered)}
                  />
                  <Stat label="Badges" value={String(intel.badge_count)} />
                </div>
                <p className="text-xs text-dim">
                  Last activity:{' '}
                  {intel.last_activity_on
                    ? intel.last_activity_on
                    : 'No graded activity yet'}
                </p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="label-caps text-dim">Events</p>
                  <button
                    type="button"
                    disabled={availableEvents.length === 0}
                    onClick={() => setAddingEvent((v) => !v)}
                    className="data-mono text-[10px] text-cyan hover:underline disabled:opacity-40"
                  >
                    + EVENT
                  </button>
                </div>
                <p className="text-xs text-dim">
                  Tap a chip to cycle Assigned → Training → Ready → Off.
                </p>
                {addingEvent ? (
                  <select
                    autoFocus
                    defaultValue=""
                    className="w-full rounded-md border border-cyan/40 bg-void px-2 py-2 text-xs text-foreground outline-none"
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v) {
                        setAddingEvent(false)
                        return
                      }
                      coverageMutation.mutate({
                        eventId: v,
                        status: 'assigned',
                      })
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setAddingEvent(false), 150)
                    }}
                  >
                    <option value="">Select event…</option>
                    {availableEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {intel.coverage.length === 0 ? (
                  <p className="text-sm text-dim">No events yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {intel.coverage.map((c) => (
                      <button
                        key={c.event_id}
                        type="button"
                        disabled={coverageMutation.isPending}
                        title="Cycle coverage status"
                        onClick={() =>
                          coverageMutation.mutate({
                            eventId: c.event_id,
                            status: nextCoverageStatus(c.status),
                          })
                        }
                        className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs ${
                          c.status === 'ready'
                            ? 'border-success/40 bg-success/10 text-success'
                            : c.status === 'training'
                              ? 'border-[var(--ghost-border-active)] bg-surface-high text-foreground'
                              : 'border-cyan/30 bg-cyan/10 text-cyan'
                        }`}
                      >
                        <span>{c.event_name ?? c.event_id}</span>
                        <span className="data-mono text-[9px] opacity-80">
                          {coverageLabel(c.status)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <p className="label-caps text-dim">Active missions</p>
                {intel.missions.length === 0 ? (
                  <p className="text-sm text-dim">No active missions.</p>
                ) : (
                  <ul className="space-y-2">
                    {intel.missions.map((m) => {
                      const pct = Math.min(
                        100,
                        Math.round(
                          (m.current_value / Math.max(1, m.target_value)) * 100,
                        ),
                      )
                      return (
                        <li
                          key={m.id}
                          className="rounded-md border border-subtle bg-surface-elevated px-3 py-2"
                        >
                          <p className="text-sm text-foreground">{m.title}</p>
                          <p className="mt-1 data-mono text-[10px] text-dim">
                            {m.current_value}/{m.target_value} · {pct}%
                            {m.completed ? ' · done' : ''}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {!isSelf ? (
                <section className="border-t border-subtle pt-4">
                  <button
                    type="button"
                    disabled={removeMutation.isPending}
                    onClick={() => {
                      const label = intel.display_name
                        ? `${intel.display_name} (@${intel.handle})`
                        : `@${intel.handle}`
                      if (
                        window.confirm(
                          `Remove ${label} from the team? They will practice solo until they rejoin.`,
                        )
                      ) {
                        removeMutation.mutate()
                      }
                    }}
                    className="hud-pill w-full py-2.5 text-sm text-alert"
                  >
                    {removeMutation.isPending
                      ? 'Removing…'
                      : 'Remove from team'}
                  </button>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps text-dim">{label}</p>
      <p className="mt-0.5 data-mono text-foreground">{value}</p>
    </div>
  )
}
