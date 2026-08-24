import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  addVaultResource,
  buildVaultFolders,
  deleteVaultResource,
  fetchMyLoadoutIds,
  fetchTeamContext,
  fetchTeamVaultResources,
  fetchVaultEvents,
  isOfficerPlus,
  joinTeamByCode,
  pinToLoadout,
  relativeAgo,
  unpinFromLoadout,
  type VaultCategory,
  type VaultResource,
} from '../../lib/vault'
import { FolderIcon, KindIcon } from './VaultIcons'

export function VaultPage() {
  const { profile, refreshProfile, user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? profile?.id ?? null
  const teamId = profile?.team_id ?? null

  const [search, setSearch] = useState('')
  const [openKey, setOpenKey] = useState<string>('general')
  const [showAdd, setShowAdd] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const teamQuery = useQuery({
    queryKey: ['vault-team', teamId, userId],
    queryFn: () => fetchTeamContext(userId!, teamId!),
    enabled: isSupabaseConfigured && Boolean(userId && teamId),
  })

  const eventsQuery = useQuery({
    queryKey: ['vault-events'],
    queryFn: fetchVaultEvents,
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const resourcesQuery = useQuery({
    queryKey: ['vault-resources', teamId],
    queryFn: () => fetchTeamVaultResources(teamId!),
    enabled: isSupabaseConfigured && Boolean(teamId),
  })

  const loadoutQuery = useQuery({
    queryKey: ['vault-loadout', userId],
    queryFn: () => fetchMyLoadoutIds(userId!),
    enabled: isSupabaseConfigured && Boolean(userId && teamId),
  })

  const joinMutation = useMutation({
    mutationFn: () => joinTeamByCode(joinCode),
    onSuccess: async () => {
      setJoinError(null)
      setJoinCode('')
      await refreshProfile()
      void qc.invalidateQueries({ queryKey: ['vault-team'] })
      void qc.invalidateQueries({ queryKey: ['vault-resources'] })
    },
    onError: (err) => {
      setJoinError(err instanceof Error ? err.message : 'Join failed')
    },
  })

  const officer = isOfficerPlus(teamQuery.data?.role ?? null)
  const resources = resourcesQuery.data ?? []
  const loadoutIds = loadoutQuery.data ?? []
  const loadoutSet = useMemo(() => new Set(loadoutIds), [loadoutIds])

  const folders = useMemo(
    () => buildVaultFolders(eventsQuery.data ?? [], resources, search),
    [eventsQuery.data, resources, search],
  )

  const openFolder =
    folders.find((f) => f.key === openKey) ?? folders[0] ?? null

  const loadoutResources = useMemo(() => {
    const byId = new Map(resources.map((r) => [r.id, r]))
    return loadoutIds
      .map((id) => byId.get(id))
      .filter((r): r is VaultResource => Boolean(r))
  }, [loadoutIds, resources])

  const pinMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      if (!userId) throw new Error('Not signed in')
      if (loadoutSet.has(resourceId)) {
        await unpinFromLoadout(userId, resourceId)
      } else {
        await pinToLoadout(userId, resourceId)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vault-loadout', userId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (resourceId: string) => deleteVaultResource(resourceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vault-resources', teamId] })
      void qc.invalidateQueries({ queryKey: ['vault-loadout', userId] })
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load vault.
      </div>
    )
  }

  if (!teamId) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
        <div className="hud-panel p-6">
          <p className="label-caps">Freelancer</p>
          <h1 className="mt-2 text-2xl font-medium text-foreground">Join a unit</h1>
          <p className="mt-2 text-sm text-muted">
            Vault is team-scoped. Enter a join code from your captain or coach.
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
              className="w-full rounded-md border border-subtle bg-void px-3 py-2.5 data-mono text-sm tracking-widest text-foreground outline-none focus:border-accent"
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3 rounded-pill border border-[var(--ghost-border)] bg-surface-elevated px-4 py-2.5">
        <span className="text-muted" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-dim"
        />
      </div>

      <div className="hud-panel grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1fr_260px]">
        <div className="min-h-0 overflow-y-auto border-b border-[var(--ghost-border)] p-3 lg:border-r lg:border-b-0">
          {(resourcesQuery.isLoading || eventsQuery.isLoading) && (
            <p className="px-3 py-2 text-sm text-muted">Loading vault…</p>
          )}
          {resourcesQuery.error && (
            <p className="px-3 py-2 text-sm text-alert">
              {resourcesQuery.error instanceof Error
                ? resourcesQuery.error.message
                : 'Failed to load vault'}
            </p>
          )}

          <ul className="space-y-1">
            {folders.map((folder) => {
              const isOpen = openFolder?.key === folder.key
              return (
                <li key={folder.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenKey(folder.key)
                      setShowAdd(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm tracking-wide uppercase transition-colors ${
                      isOpen
                        ? 'bg-surface-high text-cyan'
                        : 'text-foreground hover:bg-surface-elevated'
                    }`}
                  >
                    <FolderIcon open={isOpen} />
                    <span className="flex-1 font-medium">{folder.name}</span>
                    <span className="data-mono text-[10px] text-muted">
                      {folder.resources.length}
                    </span>
                    <span className="text-muted">▾</span>
                  </button>

                  {isOpen && (
                    <div className="ml-8 mt-1 border-l border-[var(--ghost-border)] pl-3">
                      {officer && (
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAdd((v) => !v)}
                            className="data-mono text-[10px] text-cyan hover:underline"
                          >
                            {showAdd ? 'CLOSE' : '+ ADD'}
                          </button>
                        </div>
                      )}

                      {showAdd && officer && teamId && userId && (
                        <AddResourceForm
                          teamId={teamId}
                          userId={userId}
                          eventId={folder.eventId}
                          onCreated={() => {
                            setShowAdd(false)
                            void qc.invalidateQueries({
                              queryKey: ['vault-resources', teamId],
                            })
                          }}
                        />
                      )}

                      <ul className="space-y-1">
                        {folder.resources.map((item) => {
                          const pinned = loadoutSet.has(item.id)
                          return (
                            <li
                              key={item.id}
                              className="group flex items-center gap-2 py-1.5 text-sm text-muted"
                            >
                              <KindIcon kind={item.category} />
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 flex-1 truncate text-foreground hover:text-cyan"
                                title={item.url}
                              >
                                {item.title}
                              </a>
                              <span className="data-mono shrink-0 text-[10px]">
                                {relativeAgo(item.created_at)}
                              </span>
                              <button
                                type="button"
                                title={pinned ? 'Unpin from loadout' : 'Pin to loadout'}
                                onClick={() => pinMutation.mutate(item.id)}
                                className={`data-mono shrink-0 text-[10px] ${
                                  pinned ? 'text-cyan' : 'text-dim hover:text-cyan'
                                }`}
                              >
                                {pinned ? 'PINNED' : 'PIN'}
                              </button>
                              {officer && (
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => {
                                    if (
                                      window.confirm(`Delete “${item.title}”?`)
                                    ) {
                                      deleteMutation.mutate(item.id)
                                    }
                                  }}
                                  className="data-mono shrink-0 text-[10px] text-dim hover:text-alert"
                                >
                                  DEL
                                </button>
                              )}
                            </li>
                          )
                        })}
                        {folder.resources.length === 0 && (
                          <li className="py-1.5 text-sm text-dim">Empty folder</li>
                        )}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <aside className="min-h-0 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-caps">Active Loadout</p>
            <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_var(--cyan)]" />
          </div>
          <ul className="space-y-2">
            {loadoutResources.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-[var(--ghost-border)] bg-surface-elevated p-3"
              >
                <div className="flex items-start gap-2">
                  <KindIcon kind={item.category} />
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold tracking-wide text-foreground uppercase hover:text-cyan"
                    >
                      {item.title}
                    </a>
                    <p className="mt-1 data-mono text-[10px] text-muted">
                      {relativeAgo(item.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => pinMutation.mutate(item.id)}
                    className="data-mono text-[10px] text-dim hover:text-cyan"
                  >
                    UNPIN
                  </button>
                </div>
              </li>
            ))}
            {loadoutResources.length === 0 && (
              <p className="text-sm text-dim">
                No resources equipped. Pin items from a folder.
              </p>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}

function AddResourceForm({
  teamId,
  userId,
  eventId,
  onCreated,
}: {
  teamId: string
  userId: string
  eventId: string | null
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState<VaultCategory>('link')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      addVaultResource({
        teamId,
        eventId,
        title,
        url,
        category,
        userId,
      }),
    onSuccess: () => {
      setError(null)
      setTitle('')
      setUrl('')
      onCreated()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Add failed')
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (title.trim().length < 2 || !url.trim()) return
    createMutation.mutate()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-3 space-y-2 rounded-md border border-cyan/25 bg-void/60 p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as VaultCategory)}
        className="w-full rounded-md border border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent"
      >
        <option value="link">Link</option>
        <option value="doc">Doc</option>
        <option value="video">Video</option>
      </select>
      {error && <p className="text-xs text-alert">{error}</p>}
      <button
        type="submit"
        disabled={
          title.trim().length < 2 ||
          !url.trim() ||
          createMutation.isPending
        }
        className="hud-pill w-full py-2 text-xs text-cyan disabled:opacity-40"
        style={{ borderColor: 'var(--cyan)' }}
      >
        {createMutation.isPending ? 'Saving…' : 'SAVE RESOURCE'}
      </button>
    </form>
  )
}
