import { requireSupabase } from './supabase'

export type PrepSummary = {
  sessions: number
  answered: number
  correct: number
  median_response_ms: number | null
  fast_answered: number
  fast_correct: number
}

export type PrepEvent = {
  event_id: string
  event_name: string | null
  answered: number
  correct: number
}

export type PrepSession = {
  session_token: string
  mode: 'casual' | 'timed' | string
  event_id: string | null
  event_name: string | null
  started_at: string
  answered: number
  correct: number
  skipped: number
  median_response_ms: number | null
  elapsed_ms: number | null
}

export type PrepMission = {
  id: string
  title: string
  goal_type: string
  target_value: number
  deadline: string
  event_name: string | null
  current_value: number
  completed: boolean
}

export type PrepAnswer = {
  created_at: string
  is_correct: boolean | null
  skipped: boolean
  response_ms: number | null
  topic_name: string | null
  stem: string | null
}

export type MemberPrep = {
  summary: PrepSummary
  by_event: PrepEvent[]
  sessions: PrepSession[]
  missions: PrepMission[]
}

export async function fetchMemberPrep(userId: string): Promise<MemberPrep> {
  const { data, error } = await requireSupabase().rpc('team_member_prep', {
    p_user_id: userId,
  })
  if (error) throw error
  const raw = (data ?? {}) as Partial<MemberPrep>
  return {
    summary: raw.summary ?? {
      sessions: 0,
      answered: 0,
      correct: 0,
      median_response_ms: null,
      fast_answered: 0,
      fast_correct: 0,
    },
    by_event: raw.by_event ?? [],
    sessions: raw.sessions ?? [],
    missions: raw.missions ?? [],
  }
}

export async function fetchMemberSession(
  userId: string,
  sessionToken: string,
): Promise<PrepAnswer[]> {
  const { data, error } = await requireSupabase().rpc('team_member_session', {
    p_user_id: userId,
    p_session_token: sessionToken,
  })
  if (error) throw error
  return (data ?? []) as PrepAnswer[]
}

export function formatResponse(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

export function prepNotes(prep: MemberPrep): string[] {
  const { summary, by_event } = prep
  if (summary.answered < 5) return ['Not enough answers yet to see a pattern.']
  const notes: string[] = []
  const accuracy = summary.correct / summary.answered
  if (summary.fast_answered >= 5) {
    const fast = summary.fast_correct / summary.fast_answered
    if (fast + 0.15 < accuracy) {
      notes.push('Answers under 8 seconds are less accurate than the rest.')
    }
  }
  if (
    summary.median_response_ms != null &&
    summary.median_response_ms < 6000 &&
    accuracy < 0.5
  ) {
    notes.push('Most questions are answered in a few seconds, and accuracy is low.')
  }
  const heavy = [...by_event].sort((a, b) => b.answered - a.answered)[0]
  if (heavy && heavy.answered >= 5 && heavy.event_name) {
    const pct = Math.round((heavy.correct / Math.max(1, heavy.answered)) * 100)
    notes.push(`${heavy.event_name} is the event they practice most, at ${pct}%.`)
  }
  return notes.slice(0, 2)
}
