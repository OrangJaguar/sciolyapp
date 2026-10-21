import { BadgeMark, badgeName, badgeXp } from '../../lib/badges'
import { formatXp, formatRankHud } from '../../lib/progression'
import type { PracticeSessionCommitResult } from '../../lib/practiceCommit'

type Props = {
  result: PracticeSessionCommitResult | null
  committing?: boolean
  /** Extra line under the XP summary (e.g. score summary already shown above). */
  compact?: boolean
}

/** Shared post-session XP / streak / unlock feedback for casual + timed. */
export function PracticeCommitFeedback({
  result,
  committing = false,
  compact = false,
}: Props) {
  if (committing && !result) {
    return (
      <p className="data-mono text-sm text-cyan">Saving progress…</p>
    )
  }

  if (!result) return null

  return (
    <div className={`space-y-2 ${compact ? '' : 'mt-4'} text-left`}>
      <p className="data-mono text-sm text-cyan">
        +{result.xp_awarded} XP · total {formatXp(result.xp_total)} ·{' '}
        {formatRankHud(result.xp_total)}
      </p>
      <p className="text-xs text-dim">
        Streak {result.streak}
        {result.flawless ? ' · flawless bonus' : ''}
        {result.already_committed ? ' · already saved' : ''}
      </p>
      {result.invalidated > 0 && (
        <p className="text-xs text-alert/90">
          {result.invalidated} answer
          {result.invalidated === 1 ? '' : 's'} too fast — 0 XP (anti-grind).
        </p>
      )}
      {result.cap_hit && (
        <p className="text-xs text-dim">
          Daily practice XP cap reached (200 base). Missions/badges still award.
        </p>
      )}
      {result.newly_unlocked.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {result.newly_unlocked.map((u) => {
            const xp = u.xp || badgeXp(u.id)
            return (
              <li
                key={u.id}
                className="flex items-center gap-2 rounded-lg border border-cyan/35 bg-cyan/10 px-2.5 py-1.5"
              >
                <BadgeMark id={u.id} earned />
                <span className="text-xs text-foreground">
                  {badgeName(u.id)}
                  {xp > 0 ? (
                    <span className="data-mono text-cyan"> · +{xp}</span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
