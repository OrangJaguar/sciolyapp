/**
 * Progression SSOT — XP awards, ranks/levels, streak multipliers.
 * Must mirror recovery spec (docs/recovery_help/scioly.app.md) and live SQL awards.
 * Rank is always derived from XP on read; do not trust profiles.rank_title.
 *
 * Flawless sessions (SQL): ≥5 valid answers, all correct, no skip/invalidate.
 * Server streak/cap use local timezone once clients send p_timezone (Plan 02).
 * Client liveStreak still uses UTC day keys until Plan 04/05.
 */

import type { Profile } from './types.ts'
import {
  addCalendarDays,
  localDateString,
  resolveTimezone,
} from './timezone.ts'

/** Locked award table — matches submit_casual_session / submit_timed_session / complete_clinic_do / mission sync. */
export const XP_AWARDS = {
  casualCorrect: 5,
  casualIncorrect: 1,
  timedCorrect: 6,
  timedIncorrect: 1,
  clinicDoCompleted: 10,
  flawlessCasualBonus: 10,
  flawlessTimedBonus: 15,
  missionCompleteBonus: 25,
} as const

export type XpAwardKey = keyof typeof XP_AWARDS

/** Anti-grind minimums — matches process_session_answers wrappers. */
export const MIN_RESPONSE_MS = {
  casual: 3000,
  timed: 4000,
} as const

/** Base practice XP per local day before streak multiplier (apply_practice_xp). */
export const DAILY_PRACTICE_XP_CAP = 200

export const STREAK = {
  multipliesXp: true,
  /** Calendar-day graded activity; server uses local TZ when client sends it. */
  calendarDay: true,
} as const

export type RankCurveBand = {
  name: string
  /** Inclusive start level for this rank */
  startLevel: number
  /** Inclusive end level; null = open-ended (National Legend) */
  endLevel: number | null
  entryXp: number
  xpPerLevel: number
}

/** Locked rank curve — recovery XP spec §6. */
export const RANK_CURVE: readonly RankCurveBand[] = [
  { name: 'Recruit', startLevel: 1, endLevel: 10, entryXp: 0, xpPerLevel: 100 },
  {
    name: 'Specialist',
    startLevel: 11,
    endLevel: 30,
    entryXp: 1_000,
    xpPerLevel: 150,
  },
  {
    name: 'Tactician',
    startLevel: 31,
    endLevel: 50,
    entryXp: 4_000,
    xpPerLevel: 200,
  },
  { name: 'Master', startLevel: 51, endLevel: 74, entryXp: 8_000, xpPerLevel: 300 },
  { name: 'Elite', startLevel: 75, endLevel: 102, entryXp: 15_200, xpPerLevel: 350 },
  {
    name: 'National Contender',
    startLevel: 103,
    endLevel: 132,
    entryXp: 25_000,
    xpPerLevel: 500,
  },
  {
    name: 'National Legend',
    startLevel: 133,
    endLevel: null,
    entryXp: 40_000,
    xpPerLevel: 750,
  },
] as const

function safeXp(xp: number): number {
  return Math.max(0, Math.floor(xp))
}

/** Rank band for total XP (highest entryXp ≤ xp). */
export function bandForXp(xp: number): RankCurveBand {
  const safe = safeXp(xp)
  for (let i = RANK_CURVE.length - 1; i >= 0; i--) {
    const band = RANK_CURVE[i]!
    if (safe >= band.entryXp) return band
  }
  return RANK_CURVE[0]!
}

/** Rank band containing a level number. */
export function bandForLevel(level: number): RankCurveBand {
  const n = Math.max(1, Math.floor(level))
  for (const band of RANK_CURVE) {
    const hi = band.endLevel ?? Number.POSITIVE_INFINITY
    if (n >= band.startLevel && n <= hi) return band
  }
  return RANK_CURVE[RANK_CURVE.length - 1]!
}

/**
 * Streak multiplier — mirrors SQL progression_streak_multiplier.
 * 1–6 → 1.0; 7–29 → 1.1; 30–59 → 1.2; 60–89 → 1.3; 90–119 → 1.4; 120+ → 1.5
 */
export function streakMultiplier(streak: number): number {
  const s = Math.max(0, Math.floor(streak))
  if (s >= 120) return 1.5
  if (s >= 90) return 1.4
  if (s >= 60) return 1.3
  if (s >= 30) return 1.2
  if (s >= 7) return 1.1
  return 1.0
}

/** current_level = R_start + floor((total_xp - R_entry) / C) */
export function levelFromXp(xp: number): number {
  const safe = safeXp(xp)
  const band = bandForXp(safe)
  return band.startLevel + Math.floor((safe - band.entryXp) / band.xpPerLevel)
}

/** Rank name only (e.g. Tactician). */
export function rankTitleFromXp(xp: number): string {
  return bandForXp(xp).name
}

/** HUD string: "Tactician [31]", "Recruit [1]". */
export function formatRankHud(xp: number): string {
  return `${rankTitleFromXp(xp)} [${levelFromXp(xp)}]`
}

/** XP earned into the current level band. */
export function xpIntoCurrentLevel(xp: number): number {
  const safe = safeXp(xp)
  const band = bandForXp(safe)
  return (safe - band.entryXp) % band.xpPerLevel
}

/** XP span of the current level band. */
export function xpBandSpan(xp: number): number {
  return bandForXp(safeXp(xp)).xpPerLevel
}

/** @deprecated Prefer formatRankHud or rankTitleFromXp. Alias of formatRankHud. */
export function rankFromXp(xp: number): string {
  return formatRankHud(xp)
}

/** Rank name for a level number. */
export function titleForLevel(level: number): string {
  return bandForLevel(level).name
}

/** 0–1 progress through the current level's XP cost band. */
export function xpProgress(xp: number): number {
  const safe = safeXp(xp)
  const band = bandForXp(safe)
  const into = (safe - band.entryXp) % band.xpPerLevel
  return into / band.xpPerLevel
}

/** XP remaining until next level. */
export function xpToNextLevel(xp: number): number {
  const safe = safeXp(xp)
  const band = bandForXp(safe)
  const into = (safe - band.entryXp) % band.xpPerLevel
  return band.xpPerLevel - into
}

export function formatXp(xp: number): string {
  const safe = safeXp(xp)
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
 * Next streak after a graded activity on `activityOn` (YYYY-MM-DD).
 * Server uses local calendar days when timezone is provided (Plan 02).
 * Client helpers still treat keys as opaque date strings.
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

/** UTC calendar date YYYY-MM-DD (legacy helper; prefer localDateString + TZ). */
export function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export type HudModel = {
  /** Full HUD rank line, e.g. "Tactician [31]" */
  rankTitle: string
  /** Rank name only */
  rankName: string
  xpLabel: string
  /** XP remaining to next level (variable cost). */
  xpToNext: number
  /** XP into current level / band span (for quieter HUD). */
  xpIntoLevel: number
  xpBand: number
  progress: number
  handle: string
  level: number
  streak: number
  /** Base practice XP earned today in profile TZ (0 if none / other day). */
  practiceXpBaseToday: number
}

/** Shell preview when logged out / no profile. */
const GUEST_HUD: HudModel = {
  rankTitle: 'Specialist [20]',
  rankName: 'Specialist',
  xpLabel: '2.4k',
  xpToNext: 75,
  xpIntoLevel: 75,
  xpBand: 150,
  progress: 0.5,
  handle: 'guest',
  level: 20,
  streak: 0,
  practiceXpBaseToday: 0,
}

/**
 * Streak shown in UI: break if last graded local day is older than yesterday
 * in `timeZone` (profile TZ → browser → UTC).
 */
export function liveStreak(
  currentStreak: number,
  lastActivityOn: string | null | undefined,
  now = new Date(),
  timeZone?: string | null,
): number {
  const streak = Math.max(0, currentStreak ?? 0)
  if (!lastActivityOn || streak <= 0) return 0
  const tz = resolveTimezone(timeZone)
  const today = localDateString(tz, now)
  const yesterday = addCalendarDays(today, -1)
  const key = String(lastActivityOn).slice(0, 10)
  if (key === today || key === yesterday) return streak
  return 0
}

/** Base practice XP counted toward today's 200 cap (local day). */
export function practiceXpBaseToday(
  profile: Pick<Profile, 'practice_xp_base' | 'practice_xp_date' | 'timezone'>,
  now = new Date(),
): number {
  const tz = resolveTimezone(profile.timezone)
  const today = localDateString(tz, now)
  const dateKey = profile.practice_xp_date
    ? String(profile.practice_xp_date).slice(0, 10)
    : null
  if (dateKey !== today) return 0
  return Math.max(0, Math.floor(profile.practice_xp_base ?? 0))
}

/** Subtle border accent by rank (profile / HUD chrome). */
export function rankAccentClass(rankName: string): string {
  switch (rankName) {
    case 'Recruit':
      return 'border-[var(--ghost-border)]'
    case 'Specialist':
      return 'border-cyan/35'
    case 'Tactician':
      return 'border-cyan/55'
    case 'Master':
      return 'border-cyan/70'
    case 'Elite':
      return 'border-cyan'
    case 'National Contender':
      return 'border-cyan shadow-[0_0_18px_var(--accent-dim)]'
    case 'National Legend':
      return 'border-cyan shadow-[0_0_28px_var(--accent-dim)]'
    default:
      return 'border-[var(--ghost-border)]'
  }
}

/**
 * HUD from profile. Rank always derived from XP — ignores stale profiles.rank_title.
 */
export function profileToHud(profile: Profile | null): HudModel {
  if (!profile) return { ...GUEST_HUD }

  const xp = profile.xp ?? 0
  const tz = resolveTimezone(profile.timezone)
  return {
    rankTitle: formatRankHud(xp),
    rankName: rankTitleFromXp(xp),
    xpLabel: formatXp(xp),
    xpToNext: xpToNextLevel(xp),
    xpIntoLevel: xpIntoCurrentLevel(xp),
    xpBand: xpBandSpan(xp),
    progress: xpProgress(xp),
    handle: profile.handle,
    level: levelFromXp(xp),
    streak: liveStreak(
      profile.current_streak ?? 0,
      profile.last_activity_on ?? null,
      new Date(),
      tz,
    ),
    practiceXpBaseToday: practiceXpBaseToday(profile),
  }
}
