/**
 * Progression SSOT — ranks, XP awards, streak.
 * Session commit RPCs (Plan 09+) must mirror XP_AWARDS in SQL.
 * Rank is always derived from XP on read; do not trust profiles.rank_title.
 */

import type { Profile } from './types'

/** XP per level band. level = floor(xp / XP_PER_LEVEL) + 1 */
export const XP_PER_LEVEL = 100

/** Locked award table (00-MASTER). Tune later; don’t invent ad-hoc in features. */
export const XP_AWARDS = {
  casualCorrect: 10,
  casualIncorrect: 2,
  clinicDoCompleted: 5,
  timedCorrect: 12,
  timedIncorrect: 2,
  missionCompleteBonus: 50,
} as const

export type XpAwardKey = keyof typeof XP_AWARDS

export const STREAK = {
  /** Streak does not multiply XP in MVP. */
  multipliesXp: false,
  /** Calendar-day graded activity increments streak; missed day resets to 0 then +1 on next activity. */
  calendarDay: true,
} as const

export type RankBand = {
  /** Inclusive min level */
  minLevel: number
  /** Inclusive max level; omit for open-ended */
  maxLevel?: number
  /** Title template; `{n}` = level when in Recruit band */
  title: string
}

/** Locked rank bands (00-MASTER). */
export const RANK_BANDS: readonly RankBand[] = [
  { minLevel: 1, maxLevel: 5, title: 'Recruit Level {n}' },
  { minLevel: 6, maxLevel: 10, title: 'Specialist' },
  { minLevel: 11, maxLevel: 20, title: 'Tactician' },
  { minLevel: 21, maxLevel: 35, title: 'Master' },
  { minLevel: 36, title: 'National Legend' },
] as const

export function levelFromXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp))
  return Math.floor(safe / XP_PER_LEVEL) + 1
}

/** 0–1 progress through the current 100-XP band. */
export function xpProgress(xp: number): number {
  const safe = Math.max(0, Math.floor(xp))
  return (safe % XP_PER_LEVEL) / XP_PER_LEVEL
}

/** XP remaining until next level. */
export function xpToNextLevel(xp: number): number {
  const safe = Math.max(0, Math.floor(xp))
  return XP_PER_LEVEL - (safe % XP_PER_LEVEL)
}

export function titleForLevel(level: number): string {
  const n = Math.max(1, Math.floor(level))
  for (const band of RANK_BANDS) {
    const hi = band.maxLevel ?? Number.POSITIVE_INFINITY
    if (n >= band.minLevel && n <= hi) {
      return band.title.replace('{n}', String(n))
    }
  }
  return 'National Legend'
}

/** Derive rank title from XP (authoritative). */
export function rankFromXp(xp: number): string {
  return titleForLevel(levelFromXp(xp))
}

export function formatXp(xp: number): string {
  const safe = Math.max(0, Math.floor(xp))
  if (safe >= 1000) {
    const k = safe / 1000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
  }
  return String(safe)
}

export function awardXp(key: XpAwardKey): number {
  return XP_AWARDS[key]
}

/**
 * Next streak after a graded activity on `activityOn` (YYYY-MM-DD, local or UTC — pick one per app; MVP: UTC date).
 * `lastActivityOn` null → streak becomes 1.
 * Same day → unchanged.
 * Yesterday → +1.
 * Older gap → reset to 1.
 */
export function nextStreak(
  currentStreak: number,
  lastActivityOn: string | null,
  activityOn: string,
): { streak: number; lastActivityOn: string } {
  if (!lastActivityOn) {
    return { streak: 1, lastActivityOn: activityOn }
  }
  if (lastActivityOn === activityOn) {
    return { streak: Math.max(0, currentStreak), lastActivityOn }
  }
  const prev = parseUtcDate(lastActivityOn)
  const cur = parseUtcDate(activityOn)
  const diffDays = Math.round((cur - prev) / 86_400_000)
  if (diffDays === 1) {
    return { streak: Math.max(0, currentStreak) + 1, lastActivityOn: activityOn }
  }
  return { streak: 1, lastActivityOn: activityOn }
}

function parseUtcDate(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** UTC calendar date YYYY-MM-DD for streak math. */
export function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export type HudModel = {
  rankTitle: string
  xpLabel: string
  progress: number
  handle: string
  level: number
  streak: number
}

/** Shell preview when logged out / no profile (matches mockup vibe, not live XP). */
const GUEST_HUD: HudModel = {
  rankTitle: 'Specialist',
  xpLabel: '135k',
  progress: 0.71,
  handle: 'guest',
  level: 10,
  streak: 0,
}

/**
 * Streak shown in UI: break if last graded day is older than yesterday (UTC).
 */
export function liveStreak(
  currentStreak: number,
  lastActivityOn: string | null | undefined,
  now = new Date(),
): number {
  const streak = Math.max(0, currentStreak ?? 0)
  if (!lastActivityOn || streak <= 0) return 0
  const today = utcDateString(now)
  const y = new Date(now)
  y.setUTCDate(y.getUTCDate() - 1)
  const yesterday = utcDateString(y)
  if (lastActivityOn === today || lastActivityOn === yesterday) return streak
  return 0
}

/**
 * HUD from profile. Rank always derived from XP — ignores stale profiles.rank_title.
 */
export function profileToHud(profile: Profile | null): HudModel {
  if (!profile) return { ...GUEST_HUD }

  const xp = profile.xp ?? 0
  return {
    rankTitle: rankFromXp(xp),
    xpLabel: formatXp(xp),
    progress: xpProgress(xp),
    handle: profile.handle,
    level: levelFromXp(xp),
    streak: liveStreak(profile.current_streak ?? 0, profile.last_activity_on ?? null),
  }
}
