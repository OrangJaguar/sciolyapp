/** Browser IANA timezone for practice XP / streak local-day RPCs. */
export function clientTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (typeof tz === 'string' && tz.trim()) return tz.trim()
  } catch {
    /* ignore */
  }
  return 'UTC'
}

/**
 * Civil calendar date YYYY-MM-DD in an IANA timezone.
 * Uses en-CA which reliably yields ISO-like dates in modern engines.
 */
export function localDateString(timeZone: string, d = new Date()): string {
  const tz = timeZone?.trim() || 'UTC'
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** Add/subtract whole calendar days on a YYYY-MM-DD civil date string. */
export function addCalendarDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (![y, m, d].every((n) => Number.isFinite(n))) {
    return isoDate
  }
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Prefer profile timezone, then browser, then UTC. */
export function resolveTimezone(profileTz?: string | null): string {
  const fromProfile = profileTz?.trim()
  if (fromProfile) return fromProfile
  return clientTimezone()
}
