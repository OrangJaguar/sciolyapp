import { isStudyableEvent } from './eventKinds'
import { supabase } from './supabase'
import type { TeamRole } from './types'

export type MissionGoalType = 'answered' | 'correct'

export type MissionKind = 'casual' | 'timed'

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
  kind?: MissionKind | null
  timed_seconds?: number | null
  deadline_policy?: DeadlinePolicy | null
}

export type TeamSchedule = {
  next_meeting_at: string | null
  next_meeting_place: string | null
  next_comp_at: string | null
  next_comp_place: string | null
}

/** Hidden comms post used until the schedule columns exist. */
export const SCHEDULE_POST_PREFIX = '@@schedule\n'

const EMPTY_SCHEDULE: TeamSchedule = {
  next_meeting_at: null,
  next_meeting_place: null,
  next_comp_at: null,
  next_comp_place: null,
}

export type DeadlinePolicy = 'close' | 'late' | 'count'

export type MissionProgress = {
  mission_id: string
  user_id: string
  current_value: number
  completed: boolean
  completed_at?: string | null
  snapshot_value?: number | null
  snapshot_at?: string | null
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
    supabase
      .from('teams')
      .select('id, name, school_name, division, verified')
      .eq('id', teamId)
      .maybeSingle(),
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
      verified?: boolean
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

export type MissionTiming = 'on-time' | 'done' | 'missed' | 'open'

export function missionTiming(
  mission: { completed: boolean; deadline: string },
  now = Date.now(),
): MissionTiming {
  const past = Date.parse(mission.deadline) <= now
  if (mission.completed) return past ? 'done' : 'on-time'
  return past ? 'missed' : 'open'
}

export function missionTimingLabel(timing: MissionTiming): string {
  if (timing === 'on-time') return 'On time'
  if (timing === 'done') return 'Done'
  if (timing === 'missed') return 'Missed'
  return 'Open'
}

export function deadlinePolicy(mission: {
  deadline_policy?: string | null
}): DeadlinePolicy {
  if (mission.deadline_policy === 'close' || mission.deadline_policy === 'count') {
    return mission.deadline_policy
  }
  return 'late'
}

export function missionIsOverdue(
  mission: { completed: boolean; deadline: string; deadline_policy?: string | null },
  now = Date.now(),
): boolean {
  if (mission.completed || deadlinePolicy(mission) === 'count') return false
  return Date.parse(mission.deadline) <= now
}

export function overdueLabel(mission: {
  deadline_policy?: string | null
}): string {
  return deadlinePolicy(mission) === 'close' ? 'Closed' : 'Late'
}

export function missionLobbyPath(mission: {
  kind?: string | null
  title: string
  target_event_id: string | null
}): string | null {
  if (!mission.target_event_id) return null
  const base = missionKind(mission) === 'timed' ? '/ops/timed' : '/ops/casual'
  return `${base}?event=${encodeURIComponent(mission.target_event_id)}`
}

export type AssignmentMission = {
  id: string
  title: string
  target_event_id: string | null
  goal_type: 'answered' | 'correct' | string
  target_value: number
  deadline: string
  deadline_policy?: DeadlinePolicy | null
}

export type AssignmentProgress = {
  mission_id: string
  user_id: string
  current_value: number
  completed: boolean
  completed_at?: string | null
  snapshot_value?: number | null
}

export async function fetchTeamAssignments(teamId: string): Promise<{
  missions: AssignmentMission[]
  progress: AssignmentProgress[]
}> {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.rpc('refresh_team_mission_progress')
  const fullMissions = await supabase
    .from('team_missions')
    .select('id, title, target_event_id, goal_type, target_value, deadline, deadline_policy')
    .eq('team_id', teamId)
    .order('deadline', { ascending: true })
  const missionsResult =
    fullMissions.error && /deadline_policy|column|schema cache/i.test(fullMissions.error.message)
      ? await supabase
          .from('team_missions')
          .select('id, title, target_event_id, goal_type, target_value, deadline')
          .eq('team_id', teamId)
          .order('deadline', { ascending: true })
      : fullMissions

  const fullProgress = await supabase
    .from('user_mission_progress')
    .select('mission_id, user_id, current_value, completed, completed_at, snapshot_value')
  const progressResult =
    fullProgress.error &&
    /completed_at|snapshot_value|column|schema cache/i.test(fullProgress.error.message)
      ? await supabase
          .from('user_mission_progress')
          .select('mission_id, user_id, current_value, completed')
      : fullProgress
  if (missionsResult.error) throw missionsResult.error
  if (progressResult.error) throw progressResult.error
  const ids = new Set(
    ((missionsResult.data ?? []) as AssignmentMission[]).map((mission) => mission.id),
  )
  return {
    missions: (missionsResult.data ?? []) as AssignmentMission[],
    progress: ((progressResult.data ?? []) as AssignmentProgress[]).filter((row) =>
      ids.has(row.mission_id),
    ),
  }
}

export function missionKind(mission: {
  kind?: string | null
  title: string
}): MissionKind {
  if (mission.kind === 'timed') return 'timed'
  if (/^Test\b/i.test(mission.title)) return 'timed'
  return 'casual'
}

export function missionTimedSeconds(mission: {
  timed_seconds?: number | null
  title: string
  target_value: number
}): number {
  if (mission.timed_seconds && mission.timed_seconds >= 60) return mission.timed_seconds
  const match = mission.title.match(/(\d+)\s*min/i)
  if (match) return Number(match[1]) * 60
  return Math.max(60, mission.target_value * 60)
}

export function missionStartPath(mission: {
  kind?: string | null
  title: string
  target_event_id: string | null
  target_value: number
  timed_seconds?: number | null
}): string | null {
  if (!mission.target_event_id) return null
  if (missionKind(mission) === 'timed') {
    const params = new URLSearchParams({
      session: crypto.randomUUID(),
      event: mission.target_event_id,
      topic: 'all',
      count: String(mission.target_value),
      seconds: String(missionTimedSeconds(mission)),
    })
    return `/ops/timed/exam?${params.toString()}`
  }
  const params = new URLSearchParams({
    event: mission.target_event_id,
    topic: 'all',
  })
  return `/ops/casual/arena?${params.toString()}`
}

export async function createEventMissions(input: {
  kind: MissionKind
  goalType: MissionGoalType
  targetValue: number
  deadlineIso: string
  eventIds: string[]
  timedSeconds: number | null
  deadlinePolicy?: DeadlinePolicy
}) {
  if (!supabase) throw new Error('Supabase not configured')
  if (input.eventIds.length === 0) throw new Error('Pick at least one event')
  const policy = input.deadlinePolicy ?? 'late'

  const { data, error } = await supabase.rpc('create_event_missions', {
    p_kind: input.kind,
    p_goal_type: input.goalType,
    p_target_value: input.targetValue,
    p_deadline: input.deadlineIso,
    p_event_ids: input.eventIds,
    p_timed_seconds: input.timedSeconds,
    p_deadline_policy: policy,
  })
  if (!error) return (data ?? []) as TeamMission[]

  const missing =
    /create_event_missions|schema cache|Could not find the function|PGRST202/i.test(
      error.message ?? '',
    )
  if (!missing) throw error

  const created: TeamMission[] = []
  for (const eventId of input.eventIds) {
    const title =
      input.kind === 'timed'
        ? `Test · ${input.targetValue} Q · ${Math.round((input.timedSeconds ?? 60) / 60)} min`
        : `Casual · ${input.targetValue} ${input.goalType}`
    const mission = await createTeamMission({
      title,
      targetEventId: eventId,
      goalType: input.goalType,
      targetValue: input.targetValue,
      deadlineIso: input.deadlineIso,
    })
    await supabase
      .from('team_missions')
      .update({
        deadline_policy: policy,
        kind: input.kind,
        timed_seconds: input.kind === 'timed' ? input.timedSeconds : null,
      })
      .eq('id', mission.id)
    created.push({ ...mission, deadline_policy: policy, kind: input.kind })
  }
  return created
}

export async function deleteTeamMissions(ids: string[]) {
  if (!supabase) throw new Error('Supabase not configured')
  if (ids.length === 0) return
  const { error } = await supabase.from('team_missions').delete().in('id', ids)
  if (error) throw error
}

function parseSchedulePost(content: string): TeamSchedule {
  try {
    const raw = JSON.parse(content.slice(SCHEDULE_POST_PREFIX.length)) as Partial<TeamSchedule>
    return {
      next_meeting_at: raw.next_meeting_at ?? null,
      next_meeting_place: raw.next_meeting_place ?? null,
      next_comp_at: raw.next_comp_at ?? null,
      next_comp_place: raw.next_comp_place ?? null,
    }
  } catch {
    return { ...EMPTY_SCHEDULE }
  }
}

async function readSchedulePost(teamId: string): Promise<TeamSchedule> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('team_posts')
    .select('content')
    .eq('team_id', teamId)
    .like('content', `${SCHEDULE_POST_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const content = (data?.[0] as { content?: string } | undefined)?.content
  if (!content) return { ...EMPTY_SCHEDULE }
  return parseSchedulePost(content)
}

async function writeSchedulePost(teamId: string, schedule: TeamSchedule) {
  if (!supabase) throw new Error('Supabase not configured')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing, error: readErr } = await supabase
    .from('team_posts')
    .select('id')
    .eq('team_id', teamId)
    .like('content', `${SCHEDULE_POST_PREFIX}%`)
    .order('created_at', { ascending: false })
  if (readErr) throw readErr

  const rows = (existing ?? []) as Array<{ id: string }>
  const empty =
    !schedule.next_meeting_at &&
    !schedule.next_meeting_place &&
    !schedule.next_comp_at &&
    !schedule.next_comp_place
  if (empty) {
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

  const content = SCHEDULE_POST_PREFIX + JSON.stringify(schedule)
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

export async function fetchTeamSchedule(teamId: string): Promise<TeamSchedule | null> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('teams')
    .select('next_meeting_at, next_meeting_place, next_comp_at, next_comp_place')
    .eq('id', teamId)
    .maybeSingle()
  if (!error) return (data ?? { ...EMPTY_SCHEDULE }) as TeamSchedule
  if (/next_meeting_at|column|schema cache/i.test(error.message)) {
    return readSchedulePost(teamId)
  }
  throw error
}

export async function saveTeamSchedule(input: {
  teamId: string
  which: 'meeting' | 'comp'
  at: string | null
  place: string
}) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('set_team_schedule', {
    p_which: input.which,
    p_at: input.at,
    p_place: input.place,
  })
  if (!error) return data as TeamSchedule

  const missing =
    /set_team_schedule|schema cache|Could not find the function|PGRST202/i.test(
      error.message ?? '',
    )
  if (!missing) throw error

  const current = await readSchedulePost(input.teamId)
  const place = input.place.trim() || null
  const next: TeamSchedule =
    input.which === 'meeting'
      ? { ...current, next_meeting_at: input.at, next_meeting_place: place }
      : { ...current, next_comp_at: input.at, next_comp_place: place }
  await writeSchedulePost(input.teamId, next)
  return next
}

export { joinTeamByCode, createTeam } from './teams'

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

const MIN_TOPIC_ATTEMPTS = 5

/**
 * Weakest topic on the user's own events.
 * One bad question is not enough — a topic needs a few answers before it can surface.
 */
export async function fetchTargetedPractice(
  userId: string,
  eventIds: string[],
): Promise<TargetedPractice | null> {
  if (!supabase) throw new Error('Supabase not configured')
  const allowed = new Set(eventIds)
  if (allowed.size === 0) return null

  const [weakRes, conceptsRes, topicsRes, eventsRes] = await Promise.all([
    supabase
      .from('user_weakness_map')
      .select('concept_id, total_attempts, correct_attempts')
      .eq('user_id', userId),
    supabase
      .from('taxonomy_concepts')
      .select('id, topic_id, event_id')
      .in('event_id', [...allowed]),
    supabase.from('taxonomy_topics').select('id, name'),
    supabase
      .from('taxonomy_events')
      .select('id, name, studyable')
      .in('id', [...allowed]),
  ])

  if (weakRes.error) throw weakRes.error
  if (conceptsRes.error) throw conceptsRes.error
  if (topicsRes.error) throw topicsRes.error
  if (eventsRes.error) throw eventsRes.error

  const studyableEvents = new Set(
    (
      (eventsRes.data ?? []) as Array<{
        id: string
        studyable?: boolean
      }>
    )
      .filter((event) => allowed.has(event.id) && isStudyableEvent(event))
      .map((event) => event.id),
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
    .filter((a) => a.attempts >= MIN_TOPIC_ATTEMPTS)
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
  return ((data ?? []) as Array<{ id: string; name: string }>).filter((event) =>
    isStudyableEvent(event),
  )
}
