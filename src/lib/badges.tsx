import type { ReactNode } from 'react'
import { supabase } from './supabase'

export type BadgeId =
  | 'first_blood'
  | 'week_streak'
  | 'event_specialist'
  | 'clinic_graduate'
  | 'timed_survivor'
  | 'mission_runner'
  | 'team_anchor'
  | 'centurion'

export type BadgeDef = {
  id: BadgeId
  name: string
  blurb: string
  /** Short how-to for locked state */
  how: string
}

/** Static catalog — no image assets; UI uses SVG marks. */
export const BADGE_CATALOG: readonly BadgeDef[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    blurb: 'Land your first correct answer.',
    how: '1 correct answer',
  },
  {
    id: 'week_streak',
    name: 'Week Streak',
    blurb: 'Stay active seven days in a row.',
    how: '7-day streak',
  },
  {
    id: 'event_specialist',
    name: 'Event Specialist',
    blurb: 'Dominate one event.',
    how: '50 correct in one event',
  },
  {
    id: 'clinic_graduate',
    name: 'Clinic Graduate',
    blurb: 'Clear Clinic DO drills.',
    how: '5 Clinic DO clears',
  },
  {
    id: 'timed_survivor',
    name: 'Timed Survivor',
    blurb: 'Finish a Black Box run.',
    how: 'Complete 1 timed set',
  },
  {
    id: 'mission_runner',
    name: 'Mission Runner',
    blurb: 'Close team missions.',
    how: '3 missions completed',
  },
  {
    id: 'team_anchor',
    name: 'Team Anchor',
    blurb: 'Join a unit.',
    how: 'Join a team',
  },
  {
    id: 'centurion',
    name: 'Centurion',
    blurb: 'One hundred correct answers.',
    how: '100 correct total',
  },
] as const

export type UserBadgeRow = {
  badge_id: string
  earned_at: string
}

export async function syncMyBadges() {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('sync_my_badges')
  if (error) throw error
  return data as {
    ok: boolean
    correct: number
    event_max_correct: number
    clinic: number
    timed: number
    missions: number
    badges: string[]
  }
}

export async function fetchMyBadges(userId: string): Promise<UserBadgeRow[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserBadgeRow[]
}

export function BadgeMark({
  id,
  earned,
}: {
  id: BadgeId
  earned: boolean
}): ReactNode {
  const cls = earned ? 'text-cyan' : 'text-dim'
  const common = `h-8 w-8 ${cls}`
  switch (id) {
    case 'first_blood':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 8v10M12 14l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'week_streak':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <path
            d="M8 22c2-6 4-10 8-14 4 4 6 8 8 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="16" cy="22" r="2" fill="currentColor" />
        </svg>
      )
    case 'event_specialist':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <path
            d="M16 6l2.5 7.5H26l-6 4.5 2.5 7.5L16 21l-6.5 4.5 2.5-7.5-6-4.5h7.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      )
    case 'clinic_graduate':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <rect x="7" y="10" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 7v6M13 10h6" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'timed_survivor':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="17" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 17V11M16 17l4 3" stroke="currentColor" strokeWidth="2" />
          <path d="M12 6h8" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'mission_runner':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <path d="M8 24V10l8-4 8 4v14l-8-4-8 4z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'team_anchor':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 13v12M10 19c2 5 4 7 6 7s4-2 6-7" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'centurion':
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <text
            x="16"
            y="21"
            textAnchor="middle"
            fontSize="12"
            fontFamily="var(--font-mono)"
            fill="currentColor"
          >
            100
          </text>
        </svg>
      )
  }
}
