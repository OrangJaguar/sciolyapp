import { requireSupabase, supabase } from './supabase'
import type { Division, Team } from './types'

export const JOIN_CODE_LENGTH = 6

export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, JOIN_CODE_LENGTH)
}

export function isValidJoinCode(code: string): boolean {
  return normalizeJoinCode(code).length === JOIN_CODE_LENGTH
}

export async function joinTeamByCode(code: string): Promise<Team> {
  if (!supabase) throw new Error('Supabase not configured')
  const cleaned = normalizeJoinCode(code)
  if (cleaned.length !== JOIN_CODE_LENGTH) {
    throw new Error('Enter the full 6-character join code')
  }
  const { data, error } = await supabase.rpc('join_team_by_code', {
    p_code: cleaned,
  })
  if (error) throw error
  return data as Team
}

export async function createTeam(input: {
  name: string
  schoolName: string
  division: Division
}): Promise<Team> {
  const name = input.name.trim()
  const schoolName = input.schoolName.trim()
  if (name.length < 2 || name.length > 60) {
    throw new Error('Team name must be 2–60 characters')
  }
  if (schoolName.length < 1 || schoolName.length > 80) {
    throw new Error('School name must be 1–80 characters')
  }
  const { data, error } = await requireSupabase().rpc('create_team', {
    p_name: name,
    p_school_name: schoolName,
    p_division: input.division,
  })
  if (error) throw error
  return data as Team
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
