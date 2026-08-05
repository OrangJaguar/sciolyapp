import { supabase } from './supabase'
import { fetchTeamContext, isOfficerPlus, joinTeamByCode } from './missions'
import type { TaxonomyEvent } from './types'

export type VaultCategory = 'doc' | 'video' | 'link'

export type VaultResource = {
  id: string
  team_id: string
  event_id: string | null
  title: string
  url: string
  category: VaultCategory
  created_by: string | null
  created_at: string
}

export type VaultFolder = {
  key: string
  name: string
  eventId: string | null
  resources: VaultResource[]
}

export { fetchTeamContext, isOfficerPlus, joinTeamByCode }

export async function fetchVaultEvents(): Promise<TaxonomyEvent[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('taxonomy_events')
    .select(
      'id, name, division, domain, test_component, studyable, season, active, official_scope',
    )
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as TaxonomyEvent[]
}

export async function fetchTeamVaultResources(
  teamId: string,
): Promise<VaultResource[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('team_vault_resources')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as VaultResource[]
}

export async function fetchMyLoadoutIds(userId: string): Promise<string[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('user_vault_loadout')
    .select('resource_id')
    .eq('user_id', userId)
    .order('pinned_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<{ resource_id: string }>).map((r) => r.resource_id)
}

export async function addVaultResource(input: {
  teamId: string
  eventId: string | null
  title: string
  url: string
  category: VaultCategory
  userId: string
}) {
  if (!supabase) throw new Error('Supabase not configured')
  const url = normalizeUrl(input.url)
  const { data, error } = await supabase
    .from('team_vault_resources')
    .insert({
      team_id: input.teamId,
      event_id: input.eventId,
      title: input.title.trim(),
      url,
      category: input.category,
      created_by: input.userId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as VaultResource
}

export async function deleteVaultResource(resourceId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('team_vault_resources')
    .delete()
    .eq('id', resourceId)
  if (error) throw error
}

export async function pinToLoadout(userId: string, resourceId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('user_vault_loadout').insert({
    user_id: userId,
    resource_id: resourceId,
  })
  if (error) throw error
}

export async function unpinFromLoadout(userId: string, resourceId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('user_vault_loadout')
    .delete()
    .eq('user_id', userId)
    .eq('resource_id', resourceId)
  if (error) throw error
}

export function buildVaultFolders(
  events: TaxonomyEvent[],
  resources: VaultResource[],
  query: string,
): VaultFolder[] {
  const q = query.trim().toLowerCase()
  const matches = (r: VaultResource) =>
    !q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)

  const byEvent = new Map<string | null, VaultResource[]>()
  for (const r of resources) {
    if (!matches(r)) continue
    const key = r.event_id
    const list = byEvent.get(key) ?? []
    list.push(r)
    byEvent.set(key, list)
  }

  const folders: VaultFolder[] = [
    {
      key: 'general',
      name: 'GENERAL',
      eventId: null,
      resources: byEvent.get(null) ?? [],
    },
    ...events.map((ev) => ({
      key: ev.id,
      name: ev.name.toUpperCase(),
      eventId: ev.id,
      resources: byEvent.get(ev.id) ?? [],
    })),
  ]

  // When searching, hide empty folders so results stay scannable
  if (q) return folders.filter((f) => f.resources.length > 0)
  return folders
}

export function relativeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'now'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}d ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('URL required')
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
