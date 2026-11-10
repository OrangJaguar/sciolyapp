import { useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { MemberIntelDrawer } from '../../components/team/MemberIntelDrawer'
import { SquadProgress } from '../../components/team/SquadProgress'
import { SquadSnapshot } from '../../components/team/SquadSnapshot'
import { NoTeamPanel } from '../../components/team/NoTeamPanel'
import { isSupabaseConfigured } from '../../lib/supabase'
import type { TeamRole } from '../../lib/types'
import {
  canManageRoster,
  createTeamPost,
  deleteTeamPost,
  fetchActiveEvents,
  fetchTeamContext,
  fetchTeamEventCoverage,
  fetchTeamPosts,
  fetchTeamRoster,
  formatRole,
  isOfficerPlus,
  postAgo,
  rosterNameClass,
  setPostPinned,
  type EventCoverage,
  type RosterMember,
  type TeamPost,
} from '../../lib/comms'

export function CommsPage() {
  const { profile, user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? profile?.id ?? null
  const teamId = profile?.team_id ?? null

  const [draft, setDraft] = useState('')
  const [pinOnCreate, setPinOnCreate] = useState(false)
  const [squadOpen, setSquadOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [intelUserId, setIntelUserId] = useState<string | null>(null)
  const [hoverTip, setHoverTip] = useState<{
    handle: string
    displayName: string | null
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
      displayName: m.display_name,
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

  const coverageQuery = useQuery({
    queryKey: ['comms-coverage', teamId],
    queryFn: () => fetchTeamEventCoverage(teamId!),
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
  const coverageByUser = useMemo(() => {
    const m = new Map<string, EventCoverage[]>()
    for (const row of coverageQuery.data ?? []) {
      const list = m.get(row.user_id) ?? []
      list.push(row)
      m.set(row.user_id, list)
    }
    return m
  }, [coverageQuery.data])
  const countByEvent = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of coverageQuery.data ?? []) {
      m.set(row.event_id, (m.get(row.event_id) ?? 0) + 1)
    }
    return m
  }, [coverageQuery.data])

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load comms.
      </div>
    )
  }

  if (!teamId) {
    return (
      <NoTeamPanel
        reason="Comms is team-scoped. Join with a code or start your own squad."
        onReady={async () => {
          void qc.invalidateQueries({ queryKey: ['comms-team'] })
          void qc.invalidateQueries({ queryKey: ['comms-roster'] })
          void qc.invalidateQueries({ queryKey: ['comms-posts'] })
          void qc.invalidateQueries({ queryKey: ['comms-coverage'] })
        }}
      />
    )
  }

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)] lg:gap-4">
        <aside className="hud-panel flex min-h-0 flex-col p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSquadOpen(true)}
              className="label-caps text-left hover:text-cyan"
            >
              Squad
            </button>
            {officer && (
              <button
                type="button"
                onClick={() => setProgressOpen(true)}
                className="data-mono text-[10px] text-cyan hover:underline"
              >
                PROGRESS
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSquadOpen(true)}
            className="hud-pill mb-2 w-full justify-center px-2 py-1.5 text-[10px] text-[var(--text)]"
            aria-label="Open squad snapshot"
          >
            {(team?.name ?? 'SQUAD').toUpperCase()}
          </button>
          {teamQuery.data?.role ? (
            <p
              className={`mb-3 text-center label-caps text-[9px] ${
                rosterNameClass(
                  roster.find((m) => m.user_id === userId)?.role ??
                    teamQuery.data.role,
                ) ?? 'text-cyan'
              }`}
            >
              You ·{' '}
              {formatRole(
                roster.find((m) => m.user_id === userId)?.role ??
                  teamQuery.data.role,
              )}
            </p>
          ) : null}
          {rosterQuery.isLoading && (
            <p className="text-xs text-muted">Loading…</p>
          )}
          {rosterQuery.error && (
            <p className="text-xs text-alert">Roster failed</p>
          )}
          <ul className="min-h-0 space-y-1 overflow-y-auto overflow-x-hidden">
            {roster.map((m) => {
              const cov = coverageByUser.get(m.user_id) ?? []
              const names = cov.map(
                (c) => eventName.get(c.event_id) ?? c.event_id,
              )
              const initials = (m.display_name || m.handle)
                .slice(0, 2)
                .toUpperCase()
              return (
                <li key={m.user_id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition hover:bg-surface-elevated ${
                      manager ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onMouseEnter={(e) => showTip(e, m, names)}
                    onMouseMove={(e) => showTip(e, m, names)}
                    onMouseLeave={() => setHoverTip(null)}
                    onClick={() => {
                      if (!manager) return
                      setHoverTip(null)
                      setIntelUserId(m.user_id)
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan/40 bg-surface-elevated data-mono text-[9px] text-cyan"
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      {m.display_name ? (
                        <p
                          className={`truncate text-xs ${
                            rosterNameClass(m.role) ??
                            (m.user_id === userId
                              ? 'text-cyan'
                              : 'text-[var(--text)]')
                          }`}
                        >
                          {m.display_name}
                        </p>
                      ) : null}
                      <p
                        className={`flex min-w-0 items-center gap-1 text-[10px] ${
                          rosterNameClass(m.role) ??
                          (m.display_name
                            ? 'text-dim'
                            : m.user_id === userId
                              ? 'text-cyan'
                              : 'text-[var(--text)]')
                        }`}
                      >
                        <RoleStar role={m.role} />
                        <span className="truncate">@{m.handle}</span>
                      </p>
                    </div>
                  </button>
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

      {hoverTip && !squadOpen && !progressOpen && (
        <div
          className="pointer-events-none fixed z-[60] w-52 rounded-md border border-cyan/30 bg-surface-elevated p-3 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
          style={{ left: hoverTip.x, top: hoverTip.y }}
        >
          <p className="label-caps !text-[9px] text-dim">Name</p>
          <p className="truncate text-xs font-medium text-[var(--text)]">
            {hoverTip.displayName ?? 'Not set'}
          </p>
          <p className="truncate text-xs text-dim">@{hoverTip.handle}</p>
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

      {squadOpen && teamId && (
        <SquadSnapshot
          teamId={teamId}
          squadName={team?.name ?? 'Squad'}
          roster={roster}
          events={events}
          coverage={coverageQuery.data ?? []}
          showAdminCode={manager}
          onClose={() => setSquadOpen(false)}
        />
      )}

      {progressOpen && teamId && (
        <SquadProgress
          teamId={teamId}
          squadName={team?.name ?? 'Squad'}
          roster={roster}
          events={events}
          coverage={coverageQuery.data ?? []}
          onClose={() => setProgressOpen(false)}
        />
      )}

      {intelUserId && userId && manager ? (
        <MemberIntelDrawer
          userId={intelUserId}
          selfId={userId}
          selfRole={teamQuery.data?.role ?? null}
          countByEvent={countByEvent}
          onClose={() => setIntelUserId(null)}
          onChanged={() => {
            void qc.invalidateQueries({ queryKey: ['comms-roster', teamId] })
            void qc.invalidateQueries({ queryKey: ['comms-coverage', teamId] })
          }}
        />
      ) : null}
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

function RoleStar({ role }: { role: TeamRole }) {
  if (role === 'member' || role === 'bench') return null
  return (
    <span
      className="shrink-0 text-[11px] leading-none text-cyan"
      title={formatRole(role)}
      aria-label={formatRole(role)}
    >
      ★
    </span>
  )
}
