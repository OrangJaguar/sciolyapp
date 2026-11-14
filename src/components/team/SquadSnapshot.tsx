import { ModalScrim } from '../shell/ModalScrim'
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchTeamJoinCodes,
  rosterNameClass,
  type EventCoverage,
  type RosterMember,
} from '../../lib/comms'

export function SquadSnapshot({
  teamId,
  squadName,
  roster,
  events,
  coverage,
  showAdminCode,
  onClose,
}: {
  teamId: string
  squadName: string
  roster: RosterMember[]
  events: Array<{ id: string; name: string }>
  coverage: EventCoverage[]
  showAdminCode: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const codesQuery = useQuery({
    queryKey: ['comms-codes', teamId, showAdminCode],
    queryFn: () => fetchTeamJoinCodes(teamId, showAdminCode),
  })

  const rows = useMemo(() => {
    const byId = new Map(roster.map((member) => [member.user_id, member]))
    return events.map((event) => {
      const people = coverage
        .filter((row) => row.event_id === event.id)
        .map((row) => byId.get(row.user_id))
        .filter((member): member is RosterMember => Boolean(member))
        .sort((a, b) =>
          (a.display_name || a.handle).localeCompare(b.display_name || b.handle),
        )
      return { event, people }
    })
  }, [coverage, events, roster])

  const filled = rows.filter((row) => row.people.length > 0).length
  const codes = codesQuery.data

  return (
    <ModalScrim label="Squad snapshot" onClose={onClose}>
      <div
        className="hud-panel w-full max-w-3xl border-cyan/30 shadow-[0_0_48px_var(--accent-dim)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
              {codesQuery.isLoading ? (
                <p>Loading codes…</p>
              ) : codes ? (
                <>
                  <p>
                    Team code{' '}
                    <span className="data-mono text-cyan">{codes.join_code_student}</span>
                  </p>
                  {showAdminCode && codes.join_code_admin ? (
                    <p>
                      Admin code{' '}
                      <span className="data-mono text-cyan">{codes.join_code_admin}</span>
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <h2 className="mt-2 text-2xl font-medium text-[var(--text)]">
              {squadName.toUpperCase()}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {filled} of {rows.length} events have a pair.
            </p>
          </div>
          <button type="button" onClick={onClose} className="hud-pill px-4 py-2 text-xs">
            Close
          </button>
        </div>
        <div>
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-subtle text-[10px] tracking-[0.14em] text-dim">
                <th className="px-5 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Teammate 1</th>
                <th className="px-5 py-2 font-medium">Teammate 2</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ event, people }) => (
                <tr key={event.id} className="border-b border-subtle/80">
                  <td className="px-5 py-2.5 text-[var(--text)]">{event.name}</td>
                  <td className="px-3 py-2.5">
                    <PartnerName member={people[0]} />
                  </td>
                  <td className="px-5 py-2.5">
                    <PartnerName member={people[1]} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-dim">
                    No events loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ModalScrim>
  )
}

function PartnerName({ member }: { member?: RosterMember }) {
  if (!member) return <span className="text-dim">—</span>
  const name = member.display_name || `@${member.handle}`
  return (
    <span className={rosterNameClass(member.role) ?? 'text-[var(--text)]'}>{name}</span>
  )
}
