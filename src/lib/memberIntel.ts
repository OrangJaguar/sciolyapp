import { requireSupabase } from './supabase'
import type { CoverageStatus } from './comms'
import type { Division, TeamRole } from './types'

export type MemberIntelCoverage = {
  event_id: string
  event_name: string | null
  status: CoverageStatus
}

export type MemberIntelMission = {
  id: string
  title: string
  goal_type: string
  target_value: number
  current_value: number
  completed: boolean
  deadline: string
}

export type MemberIntel = {
  user_id: string
  handle: string
  display_name: string | null
  school_name: string | null
  division: Division
  xp: number
  current_streak: number
  questions_answered: number
  last_activity_on: string | null
  role: TeamRole
  coverage: MemberIntelCoverage[]
  missions: MemberIntelMission[]
  badge_count: number
}

export async function fetchTeamMemberIntel(
  userId: string,
): Promise<MemberIntel> {
  const { data, error } = await requireSupabase().rpc('team_member_intel', {
    p_user_id: userId,
  })
  if (error) throw error
  const raw = data as MemberIntel
  return {
    ...raw,
    display_name: raw.display_name?.trim() || null,
    school_name: raw.school_name?.trim() || null,
    coverage: raw.coverage ?? [],
    missions: raw.missions ?? [],
    badge_count: raw.badge_count ?? 0,
  }
}
