/** Shared practice session commit result (casual + timed RPCs). */

export type NewlyUnlockedBadge = {
  id: string
  xp: number
}

export type PracticeSessionCommitResult = {
  already_committed: boolean
  xp_awarded: number
  xp_total: number
  streak: number
  answered: number
  correct: number
  skipped: number
  invalidated: number
  flawless: boolean
  cap_hit: boolean
  newly_unlocked: NewlyUnlockedBadge[]
}

export function parsePracticeCommitResult(data: unknown): PracticeSessionCommitResult {
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

  return {
    already_committed: Boolean(row.already_committed),
    xp_awarded: Number(row.xp_awarded ?? 0),
    xp_total: Number(row.xp_total ?? 0),
    streak: Number(row.streak ?? 0),
    answered: Number(row.answered ?? 0),
    correct: Number(row.correct ?? 0),
    skipped: Number(row.skipped ?? 0),
    invalidated: Number(row.invalidated ?? 0),
    flawless: Boolean(row.flawless),
    cap_hit: Boolean(row.cap_hit),
    newly_unlocked,
  }
}
