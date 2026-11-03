import { supabase } from './supabase'
import {
  fetchTeamContext,
  isOfficerPlus,
  joinTeamByCode,
  SCHEDULE_POST_PREFIX,
} from './missions'
import type { TeamRole } from './types'

export { fetchTeamContext, isOfficerPlus, joinTeamByCode }

export type CoverageStatus = 'assigned' | 'training' | 'ready'

export type RosterMember = {
  user_id: string
  role: TeamRole
  handle: string
  display_name: string | null
  avatar_id: string
}

export type TeamPost = {
  id: string
  team_id: string
  author_id: string
  content: string
  is_pinned: boolean
  created_at: string
  author_handle: string
}

export type EventCoverage = {
  user_id: string
  event_id: string
  status: CoverageStatus
}

export type TeamEventOption = {
  id: string
  name: string
  studyable: boolean
}

const COVERAGE_CYCLE: Array<CoverageStatus | 'off'> = [
  'assigned',
  'training',
  'ready',
  'off',
]

export function nextCoverageStatus(
  current: CoverageStatus | null,
): CoverageStatus | 'off' {
  if (!current) return 'assigned'
  const i = COVERAGE_CYCLE.indexOf(current)
  return COVERAGE_CYCLE[(i + 1) % COVERAGE_CYCLE.length]!
}

export function coverageLabel(status: CoverageStatus): string {
  switch (status) {
    case 'assigned':
      return 'Assigned'
    case 'training':
      return 'Training'
    case 'ready':
      return 'Ready'
  }
}

export async function fetchTeamRoster(teamId: string): Promise<RosterMember[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('team_roster')
    .select('user_id, role')
    .eq('team_id', teamId)
  if (error) throw error

  const rows = (data ?? []) as Array<{ user_id: string; role: TeamRole }>
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.user_id)
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_id')
    .in('id', ids)
  if (pErr) throw pErr

  const byId = new Map(
    (
      (profiles ?? []) as Array<{
        id: string
        handle: string
        display_name: string | null
        avatar_id: string
      }>
    ).map((p) => [p.id, p]),
  )

  const roleRank: Record<TeamRole, number> = {
    coach: 4,
    captain: 3,
    officer: 2,
    member: 1,
    bench: 0,
  }
  const benched = await readBenchIds(teamId)

  return rows
    .map((r) => {
      const p = byId.get(r.user_id)
      return {
        user_id: r.user_id,
        role: benched.has(r.user_id) ? 'bench' : r.role,
        handle: p?.handle ?? 'unknown',
        display_name: p?.display_name?.trim() || null,
        avatar_id: p?.avatar_id ?? 'default',
      }
    })
    .sort((a, b) => {
      const d = roleRank[b.role] - roleRank[a.role]
      if (d !== 0) return d
      return a.handle.localeCompare(b.handle)
    })
}

export async function fetchTeamPosts(teamId: string): Promise<TeamPost[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('team_posts')
    .select('id, team_id, author_id, content, is_pinned, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const posts = (data ?? []) as Array<{
    id: string
    team_id: string
    author_id: string
    content: string
    is_pinned: boolean
    created_at: string
  }>
  if (posts.length === 0) return []

  const authorIds = [...new Set(posts.map((p) => p.author_id))]
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, handle')
    .in('id', authorIds)
  if (pErr) throw pErr

  const handleById = new Map(
    ((profiles ?? []) as Array<{ id: string; handle: string }>).map((p) => [
      p.id,
      p.handle,
    ]),
  )

  return posts
    .filter(
      (p) =>
        !p.content.startsWith(SCHEDULE_POST_PREFIX) &&
        !p.content.startsWith(BENCH_POST_PREFIX),
    )
    .map((p) => ({
      ...p,
      author_handle: handleById.get(p.author_id) ?? 'unknown',
    }))
}

export async function createTeamPost(input: {
  teamId: string
  userId: string
  content: string
  pinned?: boolean
}) {
  if (!supabase) throw new Error('Supabase not configured')
  const content = input.content.trim()
  if (content.length < 1) throw new Error('Message required')
  if (content.length > 2000) throw new Error('Message too long (max 2000)')

  const { data, error } = await supabase
    .from('team_posts')
    .insert({
      team_id: input.teamId,
      author_id: input.userId,
      content,
      is_pinned: Boolean(input.pinned),
    })
    .select('id, team_id, author_id, content, is_pinned, created_at')
    .single()
  if (error) throw error
  return data
}

export async function setPostPinned(postId: string, pinned: boolean) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('team_posts')
    .update({ is_pinned: pinned })
    .eq('id', postId)
  if (error) throw error
}

export async function deleteTeamPost(postId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('team_posts').delete().eq('id', postId)
  if (error) throw error
}

export function formatRole(role: TeamRole): string {
  switch (role) {
    case 'coach':
      return 'Coach'
    case 'captain':
      return 'Captain'
    case 'officer':
      return 'Officer'
    case 'member':
      return 'Member'
    case 'bench':
      return 'Bench'
  }
}

/** Bench names use a distinct shade so they read apart from officers. */
export function rosterNameClass(role: TeamRole): string | null {
  if (role === 'bench') return 'text-[#e0b15a]'
  return null
}

export function assignableRoles(selfRole: TeamRole | null): TeamRole[] {
  if (selfRole === 'coach') {
    return ['bench', 'member', 'officer', 'captain', 'coach']
  }
  return ['bench', 'member', 'officer', 'captain']
}

export function canManageRoster(role: TeamRole | null): boolean {
  return role === 'captain' || role === 'coach'
}

export async function fetchTeamEventCoverage(
  teamId: string,
): Promise<EventCoverage[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('team_event_coverage')
    .select('user_id, event_id, status')
    .eq('team_id', teamId)
  if (error) throw error
  return (data ?? []) as EventCoverage[]
}

/** @deprecated Prefer fetchTeamEventCoverage */
export async function fetchTeamEventAssigns(
  teamId: string,
): Promise<EventCoverage[]> {
  return fetchTeamEventCoverage(teamId)
}

export async function fetchActiveEvents(): Promise<TeamEventOption[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('taxonomy_events')
    .select('id, name, studyable')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as TeamEventOption[]
}

export async function fetchTeamJoinCodes(teamId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('teams')
    .select('join_code_student, join_code_admin')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  return data as {
    join_code_student: string
    join_code_admin: string
  } | null
}

export async function setEventCoverage(
  userId: string,
  eventId: string,
  status: CoverageStatus | 'off',
) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.rpc('set_event_coverage', {
    p_user_id: userId,
    p_event_id: eventId,
    p_status: status,
  })
  if (error) throw error
}

const BENCH_POST_PREFIX = '@@bench\n'

function isMissingBenchEnum(error: { message?: string }): boolean {
  return /invalid input value for enum|team_role/i.test(error.message ?? '')
}

async function teamIdForMember(userId: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('team_roster')
    .select('team_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.team_id as string | undefined) ?? null
}

async function readBenchIds(teamId: string): Promise<Set<string>> {
  if (!supabase) return new Set()
  const { data, error } = await supabase
    .from('team_posts')
    .select('content')
    .eq('team_id', teamId)
    .like('content', `${BENCH_POST_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const content = (data?.[0] as { content?: string } | undefined)?.content
  if (!content) return new Set()
  try {
    const ids = JSON.parse(content.slice(BENCH_POST_PREFIX.length)) as unknown
    if (!Array.isArray(ids)) return new Set()
    return new Set(ids.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

async function writeBenchIds(teamId: string, ids: Set<string>) {
  if (!supabase) throw new Error('Supabase not configured')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing, error: readErr } = await supabase
    .from('team_posts')
    .select('id')
    .eq('team_id', teamId)
    .like('content', `${BENCH_POST_PREFIX}%`)
    .order('created_at', { ascending: false })
  if (readErr) throw readErr

  const rows = (existing ?? []) as Array<{ id: string }>
  if (ids.size === 0) {
    if (rows.length === 0) return
    const { error } = await supabase
      .from('team_posts')
      .delete()
      .in(
        'id',
        rows.map((row) => row.id),
      )
    if (error) throw error
    return
  }

  const content = BENCH_POST_PREFIX + JSON.stringify([...ids])
  if (rows.length === 0) {
    const { error } = await supabase.from('team_posts').insert({
      team_id: teamId,
      author_id: user.id,
      content,
      is_pinned: false,
    })
    if (error) throw error
    return
  }

  const [keep, ...rest] = rows
  const { error } = await supabase
    .from('team_posts')
    .update({ content })
    .eq('id', keep.id)
  if (error) throw error
  if (rest.length > 0) {
    const { error: delErr } = await supabase
      .from('team_posts')
      .delete()
      .in(
        'id',
        rest.map((row) => row.id),
      )
    if (delErr) throw delErr
  }
}

/** Overlay the bench mark when the database role list does not include it yet. */
export async function applyBenchRole(
  userId: string,
  role: TeamRole,
): Promise<TeamRole> {
  if (role === 'bench') return role
  const teamId = await teamIdForMember(userId)
  if (!teamId) return role
  const ids = await readBenchIds(teamId)
  return ids.has(userId) ? 'bench' : role
}

export async function setTeamMemberRole(userId: string, role: TeamRole) {
  if (!supabase) throw new Error('Supabase not configured')
  const teamId = await teamIdForMember(userId)
  if (!teamId) throw new Error('Not on a team')

  if (role === 'bench') {
    const { error } = await supabase.rpc('set_team_member_role', {
      p_user_id: userId,
      p_role: 'bench',
    })
    if (!error) {
      const ids = await readBenchIds(teamId)
      if (ids.delete(userId)) await writeBenchIds(teamId, ids)
      return
    }
    if (!isMissingBenchEnum(error)) throw error
    const { error: memberErr } = await supabase.rpc('set_team_member_role', {
      p_user_id: userId,
      p_role: 'member',
    })
    if (memberErr) throw memberErr
    const ids = await readBenchIds(teamId)
    ids.add(userId)
    await writeBenchIds(teamId, ids)
    return
  }

  const ids = await readBenchIds(teamId)
  if (ids.delete(userId)) await writeBenchIds(teamId, ids)
  const { error } = await supabase.rpc('set_team_member_role', {
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw error
}

export async function removeTeamMember(userId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.rpc('remove_team_member', {
    p_user_id: userId,
  })
  if (error) throw error
}

export function postAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'NOW'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'NOW'
  if (m < 60) return `${m}M AGO`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}H AGO`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}D AGO`
  const w = Math.floor(d / 7)
  return `${w}W AGO`
}
