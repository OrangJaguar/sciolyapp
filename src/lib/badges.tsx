import type { ReactNode } from 'react'
import type { NewlyUnlockedBadge } from './practiceCommit'
import { supabase } from './supabase'

/** Stats keys returned by sync_my_badges → stats (SQL). */
export type BadgeStatKey =
  | 'total_correct'
  | 'streak'
  | 'timed_sets'
  | 'flawless_casual'
  | 'flawless_timed'
  | 'clinic_clears'
  | 'event_max_correct'
  | 'distinct_events'
  | 'missions'
  | 'binder_events'
  | 'team_joined'

export type BadgeCategory =
  | 'accuracy'
  | 'streak'
  | 'mode'
  | 'event'
  | 'team'
  | 'binder'
  | 'classified'

export type BadgeId =
  | 'first_blood'
  | 'week_streak'
  | 'timed_survivor'
  | 'team_anchor'
  | 'mission_runner'
  | 'clinic_graduate'
  | 'event_specialist'
  | 'binder_initiate'
  | 'centurion'
  | 'iron_streak'
  | 'flawless_operator'
  | 'blackout'
  | 'black_box_veteran'
  | 'event_authority'
  | 'event_generalist'
  | 'clinic_resident'
  | 'field_agent'
  | 'binder_ready'
  | 'praetorian'
  | 'season_streak'
  | 'whiteout'
  | 'black_box_operator'
  | 'event_dominator'
  | 'event_polymath'
  | 'clinic_chief'
  | 'unit_operator'
  | 'national_vanguard'
  | 'unbroken'
  | 'event_omnivore'
  | 'blackout_protocol'
  | 'sleeper_cell'
  | 'ghost_in_the_machine'
  | 'autodidact'

export type BadgeDef = {
  id: BadgeId
  name: string
  blurb: string
  /** Short how-to for locked visible badges */
  how: string
  xp: number
  category: BadgeCategory
  hidden: boolean
  /** Numeric progress toward unlock (omitted for binary / hidden). */
  progress?: { stat: BadgeStatKey; target: number }
}

export type BadgeStats = Partial<Record<BadgeStatKey, number>>

export type SyncMyBadgesResult = {
  ok: boolean
  badges: string[]
  newly_unlocked: NewlyUnlockedBadge[]
  xp_awarded: number
  stats: BadgeStats
}

function b(
  def: Omit<BadgeDef, 'hidden'> & { hidden?: boolean },
): BadgeDef {
  return { hidden: false, ...def }
}

/** Full catalog — order: visible (spec §4) then hidden (spec §5). */
export const BADGE_CATALOG: readonly BadgeDef[] = [
  // Foundational +50
  b({
    id: 'first_blood',
    name: 'First Blood',
    blurb: 'First correct answer.',
    how: '1 correct answer',
    xp: 50,
    category: 'accuracy',
    progress: { stat: 'total_correct', target: 1 },
  }),
  b({
    id: 'week_streak',
    name: 'Week Streak',
    blurb: 'Seven-day streak.',
    how: '7-day streak',
    xp: 50,
    category: 'streak',
    progress: { stat: 'streak', target: 7 },
  }),
  b({
    id: 'timed_survivor',
    name: 'Timed Survivor',
    blurb: 'Finish a Black Box run.',
    how: 'Complete 1 timed set',
    xp: 50,
    category: 'mode',
    progress: { stat: 'timed_sets', target: 1 },
  }),
  b({
    id: 'team_anchor',
    name: 'Team Anchor',
    blurb: 'Join a unit.',
    how: 'Join a team',
    xp: 50,
    category: 'team',
    progress: { stat: 'team_joined', target: 1 },
  }),
  b({
    id: 'mission_runner',
    name: 'Mission Runner',
    blurb: 'Close three team missions.',
    how: '3 missions completed',
    xp: 50,
    category: 'team',
    progress: { stat: 'missions', target: 3 },
  }),
  b({
    id: 'clinic_graduate',
    name: 'Clinic Graduate',
    blurb: 'Clear five Clinic DO drills.',
    how: '5 Clinic DO clears',
    xp: 50,
    category: 'mode',
    progress: { stat: 'clinic_clears', target: 5 },
  }),
  b({
    id: 'event_specialist',
    name: 'Event Specialist',
    blurb: 'Fifty correct in one event.',
    how: '50 correct in one event',
    xp: 50,
    category: 'event',
    progress: { stat: 'event_max_correct', target: 50 },
  }),
  b({
    id: 'binder_initiate',
    name: 'Binder Initiate',
    blurb: 'Complete your first binder audit.',
    how: '1 binder audit',
    xp: 50,
    category: 'binder',
    progress: { stat: 'binder_events', target: 1 },
  }),

  // Intermediate +100
  b({
    id: 'centurion',
    name: 'Centurion',
    blurb: 'One hundred correct answers.',
    how: '100 correct total',
    xp: 100,
    category: 'accuracy',
    progress: { stat: 'total_correct', target: 100 },
  }),
  b({
    id: 'iron_streak',
    name: 'Iron Streak',
    blurb: 'Thirty-day streak.',
    how: '30-day streak',
    xp: 100,
    category: 'streak',
    progress: { stat: 'streak', target: 30 },
  }),
  b({
    id: 'flawless_operator',
    name: 'Flawless Operator',
    blurb: 'Perfect casual session.',
    how: '1 flawless casual session',
    xp: 100,
    category: 'accuracy',
    progress: { stat: 'flawless_casual', target: 1 },
  }),
  b({
    id: 'blackout',
    name: 'Blackout',
    blurb: 'Perfect timed set.',
    how: '1 flawless timed set',
    xp: 100,
    category: 'mode',
    progress: { stat: 'flawless_timed', target: 1 },
  }),
  b({
    id: 'black_box_veteran',
    name: 'Black Box Veteran',
    blurb: 'Complete ten timed sets.',
    how: '10 timed sets',
    xp: 100,
    category: 'mode',
    progress: { stat: 'timed_sets', target: 10 },
  }),
  b({
    id: 'event_authority',
    name: 'Event Authority',
    blurb: 'One hundred fifty correct in one event.',
    how: '150 correct in one event',
    xp: 100,
    category: 'event',
    progress: { stat: 'event_max_correct', target: 150 },
  }),
  b({
    id: 'event_generalist',
    name: 'Event Generalist',
    blurb: 'Correct in three events.',
    how: 'Correct in 3 events',
    xp: 100,
    category: 'event',
    progress: { stat: 'distinct_events', target: 3 },
  }),
  b({
    id: 'clinic_resident',
    name: 'Clinic Resident',
    blurb: 'Clear twenty-five Clinic DO drills.',
    how: '25 Clinic DO clears',
    xp: 100,
    category: 'mode',
    progress: { stat: 'clinic_clears', target: 25 },
  }),
  b({
    id: 'field_agent',
    name: 'Field Agent',
    blurb: 'Complete ten missions.',
    how: '10 missions completed',
    xp: 100,
    category: 'team',
    progress: { stat: 'missions', target: 10 },
  }),
  b({
    id: 'binder_ready',
    name: 'Binder Ready',
    blurb: 'Complete audits for three events.',
    how: 'Binder audits for 3 events',
    xp: 100,
    category: 'binder',
    progress: { stat: 'binder_events', target: 3 },
  }),

  // Advanced +250
  b({
    id: 'praetorian',
    name: 'Praetorian',
    blurb: 'One thousand correct answers.',
    how: '1,000 correct total',
    xp: 250,
    category: 'accuracy',
    progress: { stat: 'total_correct', target: 1000 },
  }),
  b({
    id: 'season_streak',
    name: 'Season Streak',
    blurb: 'Ninety-day streak.',
    how: '90-day streak',
    xp: 250,
    category: 'streak',
    progress: { stat: 'streak', target: 90 },
  }),
  b({
    id: 'whiteout',
    name: 'Whiteout',
    blurb: 'Ten flawless timed sets.',
    how: '10 flawless timed sets',
    xp: 250,
    category: 'mode',
    progress: { stat: 'flawless_timed', target: 10 },
  }),
  b({
    id: 'black_box_operator',
    name: 'Black Box Operator',
    blurb: 'Complete fifty timed sets.',
    how: '50 timed sets',
    xp: 250,
    category: 'mode',
    progress: { stat: 'timed_sets', target: 50 },
  }),
  b({
    id: 'event_dominator',
    name: 'Event Dominator',
    blurb: 'Three hundred correct in one event.',
    how: '300 correct in one event',
    xp: 250,
    category: 'event',
    progress: { stat: 'event_max_correct', target: 300 },
  }),
  b({
    id: 'event_polymath',
    name: 'Event Polymath',
    blurb: 'Correct in seven events.',
    how: 'Correct in 7 events',
    xp: 250,
    category: 'event',
    progress: { stat: 'distinct_events', target: 7 },
  }),
  b({
    id: 'clinic_chief',
    name: 'Clinic Chief',
    blurb: 'Clear one hundred Clinic DO drills.',
    how: '100 Clinic DO clears',
    xp: 250,
    category: 'mode',
    progress: { stat: 'clinic_clears', target: 100 },
  }),
  b({
    id: 'unit_operator',
    name: 'Unit Operator',
    blurb: 'Complete thirty missions.',
    how: '30 missions completed',
    xp: 250,
    category: 'team',
    progress: { stat: 'missions', target: 30 },
  }),

  // Pinnacle +500
  b({
    id: 'national_vanguard',
    name: 'National Vanguard',
    blurb: 'Two thousand five hundred correct answers.',
    how: '2,500 correct total',
    xp: 500,
    category: 'accuracy',
    progress: { stat: 'total_correct', target: 2500 },
  }),
  b({
    id: 'unbroken',
    name: 'Unbroken',
    blurb: 'One hundred twenty-day streak.',
    how: '120-day streak',
    xp: 500,
    category: 'streak',
    progress: { stat: 'streak', target: 120 },
  }),
  b({
    id: 'event_omnivore',
    name: 'Event Omnivore',
    blurb: 'Correct in twelve events.',
    how: 'Correct in 12 events',
    xp: 500,
    category: 'event',
    progress: { stat: 'distinct_events', target: 12 },
  }),
  b({
    id: 'blackout_protocol',
    name: 'Blackout Protocol',
    blurb: 'Fifty flawless timed sets.',
    how: '50 flawless timed sets',
    xp: 500,
    category: 'mode',
    progress: { stat: 'flawless_timed', target: 50 },
  }),

  // Hidden
  b({
    id: 'sleeper_cell',
    name: 'Sleeper Cell',
    blurb: 'Mission closed within a day of joining.',
    how: 'CLASSIFIED',
    xp: 50,
    category: 'classified',
    hidden: true,
  }),
  b({
    id: 'ghost_in_the_machine',
    name: 'Ghost in the Machine',
    blurb: 'Perfect Black Box under half the clock.',
    how: 'CLASSIFIED',
    xp: 100,
    category: 'classified',
    hidden: true,
  }),
  b({
    id: 'autodidact',
    name: 'Autodidact',
    blurb: 'Five Clinic clears in one local day.',
    how: 'CLASSIFIED',
    xp: 100,
    category: 'classified',
    hidden: true,
  }),
]

const BY_ID = new Map(BADGE_CATALOG.map((d) => [d.id, d]))

export const VISIBLE_BADGES = BADGE_CATALOG.filter((d) => !d.hidden)
export const HIDDEN_BADGES = BADGE_CATALOG.filter((d) => d.hidden)

export function getBadgeDef(id: string): BadgeDef | undefined {
  return BY_ID.get(id as BadgeId)
}

export function badgeName(id: string): string {
  return getBadgeDef(id)?.name ?? id.replace(/_/g, ' ')
}

export function badgeXp(id: string): number {
  return getBadgeDef(id)?.xp ?? 0
}

/** Format unlock chips for session/clinic feedback. */
export function formatUnlockLine(
  unlocks: readonly { id: string; xp?: number }[],
): string {
  return unlocks
    .map((u) => {
      const xp = u.xp ?? badgeXp(u.id)
      return `${badgeName(u.id)}${xp ? ` (+${xp})` : ''}`
    })
    .join(', ')
}

export function badgeProgressCurrent(
  def: BadgeDef,
  stats: BadgeStats | null | undefined,
): number | null {
  if (!def.progress || def.hidden) return null
  const n = stats?.[def.progress.stat]
  if (n == null || !Number.isFinite(n)) return null
  return Math.max(0, Math.floor(n))
}

export type UserBadgeRow = {
  badge_id: string
  earned_at: string
}

function parseSyncResult(data: unknown): SyncMyBadgesResult {
  const row = (data ?? {}) as Record<string, unknown>
  const rawUnlocks = row.newly_unlocked
  const newly_unlocked: NewlyUnlockedBadge[] = Array.isArray(rawUnlocks)
    ? rawUnlocks
        .map((u) => {
          if (!u || typeof u !== 'object') return null
          const o = u as Record<string, unknown>
          const id = typeof o.id === 'string' ? o.id : null
          if (!id) return null
          return { id, xp: Number(o.xp ?? 0) }
        })
        .filter((u): u is NewlyUnlockedBadge => u != null)
    : []

  const rawStats = row.stats
  const stats: BadgeStats = {}
  if (rawStats && typeof rawStats === 'object') {
    const s = rawStats as Record<string, unknown>
    const keys: BadgeStatKey[] = [
      'total_correct',
      'streak',
      'timed_sets',
      'flawless_casual',
      'flawless_timed',
      'clinic_clears',
      'event_max_correct',
      'distinct_events',
      'missions',
      'binder_events',
      'team_joined',
    ]
    for (const k of keys) {
      if (s[k] != null && Number.isFinite(Number(s[k]))) {
        stats[k] = Number(s[k])
      }
    }
  }

  const badges = Array.isArray(row.badges)
    ? row.badges.filter((x): x is string => typeof x === 'string')
    : []

  return {
    ok: row.ok !== false,
    badges,
    newly_unlocked,
    xp_awarded: Number(row.xp_awarded ?? 0),
    stats,
  }
}

export async function syncMyBadges(): Promise<SyncMyBadgesResult> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('sync_my_badges')
  if (error) throw error
  return parseSyncResult(data)
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

const HIDDEN_BADGE_IDS = new Set<string>([
  'sleeper_cell',
  'ghost_in_the_machine',
  'autodidact',
])

/** Public URL for a badge glyph (white-on-transparent PNG). */
export function badgeAssetUrl(
  id: string,
  opts?: { earned?: boolean; classified?: boolean },
): string {
  if (opts?.classified) return '/badges/classified.png'
  if (HIDDEN_BADGE_IDS.has(id)) {
    if (!opts?.earned) return '/badges/classified.png'
    return `/badges/hidden_${id}.png`
  }
  return `/badges/${id}.png`
}

/** Recolor white PNG glyphs via CSS mask + currentColor. */
function GlyphMark({
  src,
  className = 'h-8 w-8',
}: {
  src: string
  className?: string
}): ReactNode {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

/** Badge art from /public/badges — theme-aware via currentColor. */
export function BadgeMark({
  id,
  earned,
  classified,
  className = 'h-8 w-8',
}: {
  id: string
  earned: boolean
  /** Force classified silhouette (hidden + locked). */
  classified?: boolean
  className?: string
}): ReactNode {
  const lockedHidden = Boolean(classified) || (HIDDEN_BADGE_IDS.has(id) && !earned)
  const src = badgeAssetUrl(id, { earned, classified: lockedHidden })
  const tone = lockedHidden ? 'text-dim' : earned ? 'text-accent' : 'text-dim'
  return <GlyphMark src={src} className={`${className} ${tone}`} />
}
