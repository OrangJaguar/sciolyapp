import { useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { TeamRole } from '../../lib/types'
import {
  assignTeamEvent,
  canManageRoster,
  createTeamPost,
  deleteTeamPost,
  fetchActiveEvents,
  fetchTeamContext,
  fetchTeamEventAssigns,
  fetchTeamJoinCodes,
  fetchTeamPosts,
  fetchTeamRoster,
  formatRole,
  isOfficerPlus,
  joinTeamByCode,
  postAgo,
  removeTeamMember,
  setPostPinned,
  setTeamMemberRole,
  unassignTeamEvent,
  type RosterMember,
  type TeamPost,
} from '../../lib/comms'

export function CommsPage() {
  const { profile, refreshProfile, user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? profile?.id ?? null
  const teamId = profile?.team_id ?? null

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pinOnCreate, setPinOnCreate] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [hoverTip, setHoverTip] = useState<{
    handle: string
    role: string
    events: string[]
    x: number
    y: number
  } | null>(null)

  function showTip(
    e: MouseEvent,
    m: RosterMember,
    names: string[],
  ) {
    const pad = 14
    const approxW = 220
    const approxH = 120
    let x = e.clientX + pad
    let y = e.clientY + pad
    if (x + approxW > window.innerWidth - 8) x = e.clientX - approxW - pad
    if (y + approxH > window.innerHeight - 8) y = e.clientY - approxH - pad
    setHoverTip({
      handle: m.handle,
      role: formatRole(m.role),
      events: names,
      x: Math.max(8, x),
      y: Math.max(8, y),
    })
  }

  const teamQuery = useQuery({
    queryKey: ['comms-team', teamId, userId],
    queryFn: () => fetchTeamContext(userId!, teamId!),
    enabled: isSupabaseConfigured && Boolean(userId && teamId),
  })

  const rosterQuery = useQuery({
    queryKey: ['comms-roster', teamId],
    queryFn: () => fetchTeamRoster(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const assignsQuery = useQuery({
    queryKey: ['comms-assigns', teamId],
    queryFn: () => fetchTeamEventAssigns(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const eventsQuery = useQuery({
    queryKey: ['comms-events'],
    queryFn: fetchActiveEvents,
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const postsQuery = useQuery({
    queryKey: ['comms-posts', teamId],
    queryFn: () => fetchTeamPosts(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
    refetchInterval: 30_000,
  })

  const joinMutation = useMutation({
    mutationFn: () => joinTeamByCode(joinCode),
    onSuccess: async () => {
      setJoinError(null)
      setJoinCode('')
      await refreshProfile()
      void qc.invalidateQueries({ queryKey: ['comms-team'] })
      void qc.invalidateQueries({ queryKey: ['comms-roster'] })
      void qc.invalidateQueries({ queryKey: ['comms-posts'] })
      void qc.invalidateQueries({ queryKey: ['comms-assigns'] })
    },
    onError: (err) => {
      setJoinError(err instanceof Error ? err.message : 'Join failed')
    },
  })

  const invalidatePosts = () =>
    void qc.invalidateQueries({ queryKey: ['comms-posts', teamId] })

  const createMutation = useMutation({
    mutationFn: () =>
      createTeamPost({
        teamId: teamId!,
        userId: userId!,
        content: draft,
        pinned: pinOnCreate,
      }),
    onSuccess: () => {
      setDraft('')
      setPinOnCreate(false)
      invalidatePosts()
    },
  })

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      setPostPinned(id, pinned),
    onSuccess: invalidatePosts,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTeamPost(id),
    onSuccess: invalidatePosts,
  })

  const officer = isOfficerPlus(teamQuery.data?.role ?? null)
  const manager = canManageRoster(teamQuery.data?.role ?? null)
  const posts = postsQuery.data ?? []
  const pinned = posts.filter((p) => p.is_pinned)
  const stream = posts.filter((p) => !p.is_pinned)
  const team = teamQuery.data?.team
  const roster = rosterQuery.data ?? []
  const events = eventsQuery.data ?? []
  const eventName = useMemo(
    () => new Map(events.map((e) => [e.id, e.name])),
    [events],
  )
  const eventsByUser = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of assignsQuery.data ?? []) {
      const list = m.get(a.user_id) ?? []
      list.push(a.event_id)
      m.set(a.user_id, list)
    }
    return m
  }, [assignsQuery.data])
  const countByEvent = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of assignsQuery.data ?? []) {
      m.set(a.event_id, (m.get(a.event_id) ?? 0) + 1)
    }
    return m
  }, [assignsQuery.data])

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load comms.
      </div>
    )
  }

  if (!teamId) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
        <div className="hud-panel p-6">
          <p className="label-caps">Freelancer</p>
          <h1 className="mt-2 text-2xl font-medium text-[var(--text)]">
            Join a unit
          </h1>
          <p className="mt-2 text-sm text-muted">
            Comms is team-scoped. Enter a join code from your captain or coach.
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
              className="w-full rounded-md border border-subtle bg-void px-3 py-2.5 data-mono text-sm tracking-widest text-[var(--text)] outline-none focus:border-accent"
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

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[160px_1fr] xl:grid-cols-[180px_1fr] lg:gap-4">
        <aside className="hud-panel flex min-h-0 flex-col p-2.5 lg:p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-1">
            <p className="label-caps">Squad</p>
            {manager && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="data-mono text-[10px] text-cyan hover:underline"
              >
                EDIT
              </button>
            )}
          </div>
          <div className="hud-pill mb-3 w-full justify-center px-2 py-1.5 text-[10px] text-[var(--text)]">
            {(team?.name ?? 'SQUAD').toUpperCase()}
          </div>
          {rosterQuery.isLoading && (
            <p className="text-xs text-muted">Loading…</p>
          )}
          {rosterQuery.error && (
            <p className="text-xs text-alert">Roster failed</p>
          )}
          <ul className="min-h-0 space-y-1 overflow-y-auto overflow-x-hidden">
            {roster.map((m) => {
              const evIds = eventsByUser.get(m.user_id) ?? []
              const names = evIds.map((id) => eventName.get(id) ?? id)
              return (
                <li key={m.user_id}>
                  <div
                    className="flex cursor-default items-center gap-2 rounded-md px-1 py-1.5 transition hover:bg-surface-elevated"
                    onMouseEnter={(e) => showTip(e, m, names)}
                    onMouseMove={(e) => showTip(e, m, names)}
                    onMouseLeave={() => setHoverTip(null)}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan/40 bg-surface-elevated data-mono text-[9px] text-cyan"
                      aria-hidden
                    >
                      {m.handle.slice(0, 2).toUpperCase()}
                    </span>
                    <p
                      className={`min-w-0 flex-1 truncate text-xs ${
                        m.user_id === userId
                          ? 'text-cyan'
                          : 'text-[var(--text)]'
                      }`}
                    >
                      @{m.handle}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col gap-3 lg:gap-4">
          <section className="hud-panel shrink-0 space-y-2 p-3 lg:p-4">
            <p className="label-caps">Pinned</p>
            {postsQuery.isLoading && (
              <p className="text-sm text-muted">Loading…</p>
            )}
            {!postsQuery.isLoading && pinned.length === 0 && (
              <p className="text-sm text-dim">No pinned transmissions.</p>
            )}
            {pinned.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                officer={officer}
                onPin={() => pinMutation.mutate({ id: post.id, pinned: false })}
                onDelete={() => {
                  if (window.confirm('Delete this pinned post?')) {
                    deleteMutation.mutate(post.id)
                  }
                }}
              />
            ))}
          </section>

          <section className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden p-3 lg:p-4">
            <p className="label-caps mb-2 shrink-0">Active Stream</p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {postsQuery.error && (
                <p className="text-sm text-alert">
                  {postsQuery.error instanceof Error
                    ? postsQuery.error.message
                    : 'Failed to load posts'}
                </p>
              )}
              {!postsQuery.isLoading && stream.length === 0 && (
                <p className="text-sm text-dim">
                  {officer
                    ? 'No stream posts yet. Transmit below.'
                    : 'No stream posts yet.'}
                </p>
              )}
              {stream.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  officer={officer}
                  onPin={() => pinMutation.mutate({ id: post.id, pinned: true })}
                  onDelete={() => {
                    if (window.confirm('Delete this post?')) {
                      deleteMutation.mutate(post.id)
                    }
                  }}
                />
              ))}
            </div>

            {officer && (
              <form
                className="mt-3 shrink-0 space-y-2 border-t border-subtle pt-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault()
                  if (!draft.trim()) return
                  createMutation.mutate()
                }}
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Transmit to squad…"
                  className="w-full resize-none rounded-md border border-subtle bg-void px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-accent"
                />
                {createMutation.error && (
                  <p className="text-xs text-alert">
                    {createMutation.error instanceof Error
                      ? createMutation.error.message
                      : 'Post failed'}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={pinOnCreate}
                      onChange={(e) => setPinOnCreate(e.target.checked)}
                      className="accent-[var(--cyan)]"
                    />
                    Pin on send
                  </label>
                  <button
                    type="submit"
                    disabled={!draft.trim() || createMutation.isPending}
                    className="hud-pill px-6 py-2 text-xs text-cyan disabled:opacity-40"
                    style={{ borderColor: 'var(--cyan)' }}
                  >
                    {createMutation.isPending ? 'SENDING…' : 'TRANSMIT'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>

      {hoverTip && !editOpen && (
        <div
          className="pointer-events-none fixed z-[60] w-52 rounded-md border border-cyan/30 bg-surface-elevated p-3 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
          style={{ left: hoverTip.x, top: hoverTip.y }}
        >
          <p className="truncate text-xs font-medium text-[var(--text)]">
            @{hoverTip.handle}
          </p>
          <p className="mt-1 data-mono text-[10px] text-cyan">{hoverTip.role}</p>
          <p className="mt-2 label-caps !text-[9px] text-dim">Events</p>
          {hoverTip.events.length === 0 ? (
            <p className="mt-1 text-xs text-dim">None assigned</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {hoverTip.events.map((n) => (
                <li key={n} className="text-xs text-[var(--text)]">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editOpen && teamId && userId && (
        <RosterAdminModal
          teamId={teamId}
          selfId={userId}
          selfRole={teamQuery.data?.role ?? null}
          squadName={team?.name ?? 'Squad'}
          roster={roster}
          events={events}
          eventsByUser={eventsByUser}
          countByEvent={countByEvent}
          onClose={() => setEditOpen(false)}
          onChanged={() => {
            void qc.invalidateQueries({ queryKey: ['comms-roster', teamId] })
            void qc.invalidateQueries({ queryKey: ['comms-assigns', teamId] })
          }}
        />
      )}
    </>
  )
}

function PostCard({
  post,
  officer,
  onPin,
  onDelete,
}: {
  post: TeamPost
  officer: boolean
  onPin: () => void
  onDelete: () => void
}) {
  return (
    <article className="relative rounded-md border border-[var(--ghost-border)] bg-surface-elevated p-3 pr-14">
      <p className="label-caps mb-1.5 !text-[var(--text)]">
        @{post.author_handle.toUpperCase()}
      </p>
      <p className="text-sm leading-relaxed tracking-wide text-muted uppercase">
        {post.content}
      </p>
      <p className="mt-2 text-right data-mono text-[10px] text-dim">
        {postAgo(post.created_at)}
      </p>
      {officer && (
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onPin}
            className="data-mono text-[10px] text-cyan hover:underline"
          >
            {post.is_pinned ? 'UNPIN' : 'PIN'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="data-mono text-[10px] text-dim hover:text-alert"
          >
            DEL
          </button>
        </div>
      )}
      <div className="absolute top-1/2 right-0 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-[var(--ghost-border)] bg-surface">
        <span
          className={`h-3 w-3 rounded-full border ${
            post.is_pinned ? 'border-cyan bg-cyan/40' : 'border-cyan/60'
          }`}
        />
      </div>
    </article>
  )
}

function RosterAdminModal({
  teamId,
  selfId,
  selfRole,
  squadName,
  roster,
  events,
  eventsByUser,
  countByEvent,
  onClose,
  onChanged,
}: {
  teamId: string
  selfId: string
  selfRole: TeamRole | null
  squadName: string
  roster: RosterMember[]
  events: Array<{ id: string; name: string; studyable: boolean }>
  eventsByUser: Map<string, string[]>
  countByEvent: Map<string, number>
  onClose: () => void
  onChanged: () => void
}) {
  const codesQuery = useQuery({
    queryKey: ['comms-codes', teamId],
    queryFn: () => fetchTeamJoinCodes(teamId),
  })
  const [error, setError] = useState<string | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [eventFilter, setEventFilter] = useState('')

  const filteredRoster = useMemo(() => {
    if (!eventFilter) return roster
    return roster.filter((m) =>
      (eventsByUser.get(m.user_id) ?? []).includes(eventFilter),
    )
  }, [roster, eventsByUser, eventFilter])

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TeamRole }) =>
      setTeamMemberRole(userId, role),
    onSuccess: () => {
      setError(null)
      onChanged()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Role update failed'),
  })

  const removeMutation = useMutation({
    mutationFn: (uid: string) => removeTeamMember(uid),
    onSuccess: () => {
      setError(null)
      onChanged()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Remove failed'),
  })

  const assignMutation = useMutation({
    mutationFn: ({ userId, eventId }: { userId: string; eventId: string }) =>
      assignTeamEvent(userId, eventId),
    onSuccess: () => {
      setError(null)
      setAddingFor(null)
      onChanged()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Assign failed'),
  })

  const unassignMutation = useMutation({
    mutationFn: ({ userId, eventId }: { userId: string; eventId: string }) =>
      unassignTeamEvent(userId, eventId),
    onSuccess: () => {
      setError(null)
      onChanged()
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Unassign failed'),
  })

  const roleOptions: TeamRole[] =
    selfRole === 'coach'
      ? ['member', 'officer', 'captain', 'coach']
      : ['member', 'officer', 'captain']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Edit squad roster"
      onClick={onClose}
    >
      <div
        className="hud-panel flex max-h-[min(90dvh,820px)] w-full max-w-3xl flex-col overflow-hidden border-cyan/30 shadow-[0_0_48px_var(--accent-dim)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div>
            <p className="label-caps">Roster Admin</p>
            <h2 className="mt-1 text-2xl font-medium text-[var(--text)]">
              {squadName.toUpperCase()}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Roles, event partners (max 2 per event), remove members. People can
              hold any number of events.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hud-pill px-4 py-2 text-xs"
          >
            CLOSE
          </button>
        </div>

        <div className="shrink-0 space-y-2 border-b border-subtle px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {codesQuery.data && (
              <div className="flex min-w-0 flex-1 flex-wrap gap-4 data-mono text-xs text-muted">
                <span>
                  Student join{' '}
                  <span className="text-cyan">
                    {codesQuery.data.join_code_student}
                  </span>
                </span>
                <span>
                  Admin join{' '}
                  <span className="text-cyan">
                    {codesQuery.data.join_code_admin}
                  </span>
                </span>
              </div>
            )}
            <label className="ml-auto flex items-center gap-2 text-xs text-muted">
              <span className="label-caps !text-[9px]">Filter</span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="max-w-[14rem] rounded-md border border-subtle bg-void px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-accent"
              >
                <option value="">All members</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} · {countByEvent.get(ev.id) ?? 0}/2
                  </option>
                ))}
              </select>
            </label>
          </div>
          {eventFilter && (
            <p className="data-mono text-[11px] text-dim">
              Showing {filteredRoster.length} assigned to{' '}
              {events.find((e) => e.id === eventFilter)?.name ?? eventFilter}
            </p>
          )}
          {error && <p className="text-sm text-alert">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {filteredRoster.length === 0 && (
            <p className="text-sm text-dim">
              {eventFilter
                ? 'Nobody assigned to this event yet.'
                : 'No teammates on roster.'}
            </p>
          )}
          {filteredRoster.map((m) => {
            const assigned = eventsByUser.get(m.user_id) ?? []
            const isSelf = m.user_id === selfId
            // Person can hold many events; dropdown only hides ones they already have.
            // Still hide events that already have 2 partners (unless this person is one).
            const available = events.filter((ev) => {
              if (assigned.includes(ev.id)) return false
              const n = countByEvent.get(ev.id) ?? 0
              return n < 2
            })
            return (
              <div
                key={m.user_id}
                className="rounded-md border border-subtle bg-surface-elevated p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan/40 data-mono text-xs text-cyan">
                    {m.handle.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">
                      @{m.handle}
                      {isSelf ? ' · YOU' : ''}
                    </p>
                  </div>
                  {!isSelf ? (
                    <select
                      value={m.role}
                      disabled={roleMutation.isPending}
                      onChange={(e) =>
                        roleMutation.mutate({
                          userId: m.user_id,
                          role: e.target.value as TeamRole,
                        })
                      }
                      className="rounded-md border border-subtle bg-void px-2 py-1.5 data-mono text-xs text-[var(--text)] outline-none focus:border-accent"
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {formatRole(r)}
                        </option>
                      ))}
                      {!roleOptions.includes(m.role) && (
                        <option value={m.role}>{formatRole(m.role)}</option>
                      )}
                    </select>
                  ) : (
                    <span className="data-mono text-xs text-dim">
                      {formatRole(m.role)}
                    </span>
                  )}
                  {!isSelf && (
                    <button
                      type="button"
                      disabled={removeMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove @${m.handle} from the team? They become a freelancer.`,
                          )
                        ) {
                          removeMutation.mutate(m.user_id)
                        }
                      }}
                      className="data-mono text-[10px] text-dim hover:text-alert"
                    >
                      REMOVE
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {assigned.length === 0 && (
                    <span className="text-xs text-dim">No events</span>
                  )}
                  {assigned.map((eid) => {
                    const ev = events.find((e) => e.id === eid)
                    return (
                      <span
                        key={eid}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-xs text-cyan"
                      >
                        {ev?.name ?? eid}
                        <button
                          type="button"
                          title="Remove event"
                          onClick={() =>
                            unassignMutation.mutate({
                              userId: m.user_id,
                              eventId: eid,
                            })
                          }
                          className="text-dim hover:text-alert"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  {addingFor === m.user_id ? (
                    <select
                      autoFocus
                      defaultValue=""
                      className="rounded-md border border-cyan/40 bg-void px-2 py-1 text-xs text-[var(--text)] outline-none"
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) {
                          setAddingFor(null)
                          return
                        }
                        assignMutation.mutate({
                          userId: m.user_id,
                          eventId: v,
                        })
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setAddingFor(null), 150)
                      }}
                    >
                      <option value="">Select event…</option>
                      {available.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                          {ev.studyable ? '' : ' (locked)'} ·{' '}
                          {countByEvent.get(ev.id) ?? 0}/2
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      disabled={available.length === 0}
                      onClick={() => setAddingFor(m.user_id)}
                      className="hud-pill px-3 py-1 text-[10px] text-cyan disabled:opacity-30"
                      style={{ borderColor: 'var(--cyan)' }}
                      title={
                        available.length === 0
                          ? 'No more events available (already assigned or full at 2/2)'
                          : 'Add another event'
                      }
                    >
                      + EVENT
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
