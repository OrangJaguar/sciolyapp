/**
 * DeepSeek peak / off-peak calendar (UTC).
 * Peak (Mon–Fri only): 01:00–04:00 and 06:00–10:00 UTC.
 * Keep in sync with supabase/functions/_shared/generation.ts
 */

export type GenerationWindowMode = 'deepseek_offpeak' | 'custom'

export type GenerationWindowConfig = {
  enabled: boolean
  mode?: GenerationWindowMode
  tz?: string
  start?: string
  end?: string
  /** When true, DeepSeek off-peak mode still allows peak hours (2× cost). */
  allowPeak?: boolean
}

/** DeepSeek peak bands as [startMinute, endMinute) in UTC. */
export const DEEPSEEK_PEAK_UTC_BANDS: ReadonlyArray<readonly [number, number]> = [
  [1 * 60, 4 * 60],
  [6 * 60, 10 * 60],
]

export function isDeepseekProvider(provider: string | null | undefined): boolean {
  const p = String(provider ?? '').toLowerCase()
  return (
    p === 'deepseek_flash' ||
    p === 'deepseek_pro' ||
    p === 'deepseek' ||
    p === 'auto'
  )
}

export function utcWeekdayAndMinutes(now = new Date()): {
  weekday: number
  minutes: number
} {
  // 0 = Sunday … 6 = Saturday (UTC)
  const weekday = now.getUTCDay()
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  return { weekday, minutes }
}

/** True during DeepSeek billed peak (weekday UTC bands). */
export function isDeepseekPeakUtc(now = new Date()): boolean {
  const { weekday, minutes } = utcWeekdayAndMinutes(now)
  if (weekday === 0 || weekday === 6) return false
  return DEEPSEEK_PEAK_UTC_BANDS.some(
    ([start, end]) => minutes >= start && minutes < end,
  )
}

export function deepseekRateLabel(now = new Date()): 'PEAK' | 'OFF-PEAK' {
  return isDeepseekPeakUtc(now) ? 'PEAK' : 'OFF-PEAK'
}

function parseHm(value: string, fallback: number): number {
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback
  return h * 60 + m
}

function minutesInTz(tz: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

export function isInsideCustomWindow(
  window: GenerationWindowConfig,
  now = new Date(),
): boolean {
  const tz = window.tz ?? 'America/Chicago'
  const startMinutes = parseHm(window.start ?? '08:00', 8 * 60)
  const endMinutes = parseHm(window.end ?? '22:00', 22 * 60)
  const nowMinutes = minutesInTz(tz, now)

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes
}

/**
 * Same semantics as Edge `isInsideRunWindow`.
 * `provider` from job config (auto counts as DeepSeek for calendar when mode unset).
 */
export function isInsideRunWindow(
  window: GenerationWindowConfig | null | undefined,
  provider?: string | null,
  now = new Date(),
): boolean {
  const w = window ?? { enabled: false }
  if (w.enabled === false) return true

  const mode =
    w.mode ??
    (isDeepseekProvider(provider) ? 'deepseek_offpeak' : 'custom')

  if (mode === 'deepseek_offpeak') {
    if (w.allowPeak) return true
    return !isDeepseekPeakUtc(now)
  }

  return isInsideCustomWindow(w, now)
}

export function defaultWindowForProvider(
  provider: string,
): GenerationWindowConfig {
  if (isDeepseekProvider(provider) && provider !== 'nim') {
    // `auto` prefers DeepSeek when keyed — still default to off-peak safety.
    return {
      enabled: true,
      mode: 'deepseek_offpeak',
      allowPeak: false,
      tz: 'UTC',
      start: '00:00',
      end: '23:59',
    }
  }
  return {
    enabled: false,
    mode: 'custom',
    allowPeak: false,
    tz: 'America/Chicago',
    start: '08:00',
    end: '22:00',
  }
}

export function formatWindowSummary(
  window: GenerationWindowConfig | null | undefined,
  provider?: string | null,
): string | null {
  if (!window || window.enabled === false) return null
  const mode =
    window.mode ??
    (isDeepseekProvider(provider) ? 'deepseek_offpeak' : 'custom')
  if (mode === 'deepseek_offpeak') {
    return window.allowPeak
      ? 'DeepSeek window · peak allowed'
      : 'DeepSeek off-peak only'
  }
  return `Custom ${window.tz ?? 'tz'} ${window.start ?? '??'}–${window.end ?? '??'}`
}
