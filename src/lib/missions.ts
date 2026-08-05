import { supabase } from './supabase'
import type { TeamRole } from './types'

export type MissionGoalType = 'answered' | 'correct'

export type TeamMission = {
  id: string
  team_id: string
  created_by: string
  title: string
  target_event_id: string | null
  goal_type: MissionGoalType
  target_value: number
  deadline: string
  created_at: string
}

export type MissionProgress = {
  mission_id: string
  user_id: string
  current_value: number
  completed: boolean
}

export type MissionRow = TeamMission & {
  event_name: string | null
  current_value: number
  completed: boolean
  progress_pct: number
}

export async function fetchTeamContext(userId: string, teamId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const [teamRes, rosterRes] = await Promise.all([
    supabase.from('teams').select('id, name, school_name, division').eq('id', teamId).maybeSingle(),
    supabase
      .from('team_roster')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (teamRes.error) throw teamRes.error
  if (rosterRes.error) throw rosterRes.error

  return {
    team: teamRes.data as {
      id: string
      name: string
      school_name: string
      division: string
    } | null,
    role: (rosterRes.data?.role as TeamRole | undefined) ?? null,
  }
}

export async function syncMyMissionProgress() {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('sync_my_mission_progress')
  if (error) throw error
  return data as { synced: number; newly_completed: number; xp_awarded: number }
}

export async function fetchMyMissions(teamId: string, userId: string): Promise<MissionRow[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const [missionsRes, progressRes, eventsRes] = await Promise.all([
    supabase
      .from('team_missions')
      .select('*')
      .eq('team_id', teamId)
      .order('deadline', { ascending: true }),
    supabase
      .from('user_mission_progress')
      .select('*')
      .eq('user_id', userId),
    supabase.from('taxonomy_events').select('id, name'),
  ])

  if (missionsRes.error) throw missionsRes.error
  if (progressRes.error) throw progressRes.error
  if (eventsRes.error) throw eventsRes.error

  const progressById = new Map(
    ((progressRes.data ?? []) as MissionProgress[]).map((p) => [p.mission_id, p]),
  )
  const eventName = new Map(
    ((eventsRes.data ?? []) as Array<{ id: string; name: string }>).map((e) => [
      e.id,
      e.name,
    ]),
  )

  return ((missionsRes.data ?? []) as TeamMission[]).map((m) => {
    const p = progressById.get(m.id)
    const current = p?.current_value ?? 0
    const completed = p?.completed ?? current >= m.target_value
    return {
      ...m,
      event_name: m.target_event_id ? (eventName.get(m.target_event_id) ?? m.target_event_id) : null,
      current_value: current,
      completed,
      progress_pct: Math.min(100, Math.round((current / Math.max(1, m.target_value)) * 100)),
    }
  })
}

export async function createTeamMission(input: {
  title: string
  targetEventId: string | null
  goalType: MissionGoalType
  targetValue: number
  deadlineIso: string
}) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('create_team_mission', {
    p_title: input.title,
    p_target_event_id: input.targetEventId,
    p_goal_type: input.goalType,
    p_target_value: input.targetValue,
    p_deadline: input.deadlineIso,
  })
  if (error) throw error
  return data as TeamMission
}

export async function joinTeamByCode(code: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('join_team_by_code', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw error
  return data
}

export function isOfficerPlus(role: TeamRole | null): boolean {
  return role === 'officer' || role === 'captain' || role === 'coach'
}

export function formatDeadline(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function tMinus(iso: string): string {
  const ms = Date.parse(iso) - Date.now()
  if (ms <= 0) return 'PASSED'
  const h = Math.floor(ms / 3_600_000)
  if (h < 48) return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export type TargetedPractice = {
  eventId: string
  eventName: string
  topicId: string
  topicName: string
  accuracyPct: number | null
  attempts: number
}

/** Weakest studyable topic for the current user; null if no weakness data yet. */
export async function fetchTargetedPractice(
  userId: string,
): Promise<TargetedPractice | null> {
  if (!supabase) throw new Error('Supabase not configured')

  const [weakRes, conceptsRes, topicsRes, eventsRes] = await Promise.all([
    supabase
      .from('user_weakness_map')
      .select('concept_id, total_attempts, correct_attempts')
      .eq('user_id', userId),
    supabase.from('taxonomy_concepts').select('id, topic_id, event_id'),
    supabase.from('taxonomy_topics').select('id, name'),
    supabase
      .from('taxonomy_events')
      .select('id, name, studyable')
      .eq('studyable', true),
  ])

  if (weakRes.error) throw weakRes.error
  if (conceptsRes.error) throw conceptsRes.error
  if (topicsRes.error) throw topicsRes.error
  if (eventsRes.error) throw eventsRes.error

  const studyableEvents = new Set(
    ((eventsRes.data ?? []) as Array<{ id: string }>).map((e) => e.id),
  )
  const conceptMeta = new Map(
    (
      (conceptsRes.data ?? []) as Array<{
        id: string
        topic_id: string
        event_id: string
      }>
    ).map((c) => [c.id, c]),
  )
  const topicName = new Map(
    ((topicsRes.data ?? []) as Array<{ id: string; name: string }>).map((t) => [
      t.id,
      t.name,
    ]),
  )
  const eventName = new Map(
    ((eventsRes.data ?? []) as Array<{ id: string; name: string }>).map((e) => [
      e.id,
      e.name,
    ]),
  )

  type Agg = { attempts: number; correct: number; eventId: string; topicId: string }
  const byTopic = new Map<string, Agg>()

  for (const row of (weakRes.data ?? []) as Array<{
    concept_id: string
    total_attempts: number
    correct_attempts: number
  }>) {
    const meta = conceptMeta.get(row.concept_id)
    if (!meta || !studyableEvents.has(meta.event_id)) continue
    const key = meta.topic_id
    const cur = byTopic.get(key) ?? {
      attempts: 0,
      correct: 0,
      eventId: meta.event_id,
      topicId: meta.topic_id,
    }
    cur.attempts += row.total_attempts
    cur.correct += row.correct_attempts
    byTopic.set(key, cur)
  }

  const ranked = [...byTopic.values()]
    .filter((a) => a.attempts > 0)
    .sort((a, b) => {
      const accA = a.correct / a.attempts
      const accB = b.correct / b.attempts
      if (accA !== accB) return accA - accB
      return b.attempts - a.attempts
    })

  const best = ranked[0]
  if (!best) return null

  return {
    eventId: best.eventId,
    eventName: eventName.get(best.eventId) ?? best.eventId,
    topicId: best.topicId,
    topicName: topicName.get(best.topicId) ?? best.topicId,
    accuracyPct: Math.round((best.correct / best.attempts) * 100),
    attempts: best.attempts,
  }
}

export async function fetchStudyableEvents(): Promise<
  Array<{ id: string; name: string }>
> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('taxonomy_events')
    .select('id, name')
    .eq('studyable', true)
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as Array<{ id: string; name: string }>
}
