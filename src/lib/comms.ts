import { supabase } from './supabase'
import {
  fetchTeamContext,
  isOfficerPlus,
  joinTeamByCode,
} from './missions'
import type { TeamRole } from './types'

export { fetchTeamContext, isOfficerPlus, joinTeamByCode }

export type RosterMember = {
  user_id: string
  role: TeamRole
  handle: string
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
    .select('id, handle, avatar_id')
    .in('id', ids)
  if (pErr) throw pErr

  const byId = new Map(
    ((profiles ?? []) as Array<{ id: string; handle: string; avatar_id: string }>).map(
      (p) => [p.id, p],
    ),
  )

  const roleRank: Record<TeamRole, number> = {
    coach: 4,
    captain: 3,
    officer: 2,
    member: 1,
  }

  return rows
    .map((r) => {
      const p = byId.get(r.user_id)
      return {
        user_id: r.user_id,
        role: r.role,
        handle: p?.handle ?? 'unknown',
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

  return posts.map((p) => ({
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
  return role.toUpperCase()
}

export function canManageRoster(role: TeamRole | null): boolean {
  return role === 'captain' || role === 'coach'
}

export type EventAssign = {
  user_id: string
  event_id: string
}

export type TeamEventOption = {
  id: string
  name: string
  studyable: boolean
}

export async function fetchTeamEventAssigns(
  teamId: string,
): Promise<EventAssign[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('team_event_coverage')
    .select('user_id, event_id')
    .eq('team_id', teamId)
  if (error) throw error
  return (data ?? []) as EventAssign[]
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

export async function assignTeamEvent(userId: string, eventId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.rpc('assign_team_event', {
    p_user_id: userId,
    p_event_id: eventId,
  })
  if (error) throw error
}

export async function unassignTeamEvent(userId: string, eventId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.rpc('unassign_team_event', {
    p_user_id: userId,
    p_event_id: eventId,
  })
  if (error) throw error
}

export async function setTeamMemberRole(userId: string, role: TeamRole) {
  if (!supabase) throw new Error('Supabase not configured')
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
