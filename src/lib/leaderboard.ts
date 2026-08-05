import { supabase } from './supabase'
import {
  fetchTeamContext,
  fetchStudyableEvents,
  joinTeamByCode,
} from './missions'

export { fetchTeamContext, joinTeamByCode, fetchStudyableEvents }

export type LeaderboardMetric = 'xp' | 'correct' | 'answered'
export type LeaderboardWindow = 'all' | 'season' | '30d' | '7d'

export type LeaderboardRow = {
  user_id: string
  handle: string
  avatar_id: string
  score: number
  place: number
}

export async function fetchTeamLeaderboard(input: {
  metric: LeaderboardMetric
  eventId: string | null
  window: LeaderboardWindow
}): Promise<LeaderboardRow[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('team_leaderboard', {
    p_metric: input.metric,
    p_event_id: input.eventId,
    p_window: input.window,
  })
  if (error) throw error
  return ((data ?? []) as Array<{
    user_id: string
    handle: string
    avatar_id: string
    score: number | string
    place: number
  }>).map((r) => ({
    user_id: r.user_id,
    handle: r.handle,
    avatar_id: r.avatar_id,
    score: Number(r.score),
    place: Number(r.place),
  }))
}

/** Surface PostgREST/RPC message (not just generic Error). */
export function leaderboardErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message)
    if (m) return m
  }
  if (err instanceof Error && err.message) return err.message
  return 'Failed to load leaderboard'
}

export function metricLabel(m: LeaderboardMetric): string {
  switch (m) {
    case 'xp':
      return 'XP'
    case 'correct':
      return 'Correct'
    case 'answered':
      return 'Answered'
  }
}

export function windowLabel(w: LeaderboardWindow): string {
  switch (w) {
    case 'all':
      return 'All time'
    case 'season':
      return 'This season'
    case '30d':
      return 'Last 30d'
    case '7d':
      return 'Last 7d'
  }
}

export function placeTone(place: number): 'gold' | 'silver' | 'bronze' | 'dim' {
  if (place === 1) return 'gold'
  if (place === 2) return 'silver'
  if (place === 3) return 'bronze'
  return 'dim'
}
