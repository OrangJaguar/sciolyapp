import { formatXp } from '../../lib/progression'

type XpBarProps = {
  progress: number
  xpLabel: string
  /** XP remaining to next level — tooltip / secondary. */
  xpToNext?: number
  /** XP into current level band. */
  xpIntoLevel?: number
  /** Current level band span. */
  xpBand?: number
}

export function XpBar({
  progress,
  xpLabel,
  xpToNext,
  xpIntoLevel,
  xpBand,
}: XpBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const hasBand =
    xpIntoLevel != null && xpBand != null && xpBand > 0
  const bandLabel = hasBand
    ? `${formatXp(xpIntoLevel)} / ${formatXp(xpBand)}`
    : null
  const tip =
    xpToNext != null && xpToNext > 0
      ? `${formatXp(xpToNext)} XP to next level`
      : undefined

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 px-1 lg:gap-4 lg:px-4"
      title={tip}
    >
      <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-pill border border-accent/40 bg-surface-elevated lg:h-5">
        <div
          className="stripe-progress h-full rounded-pill"
          style={{ width: `${pct}%` }}
        />
        <span className="data-mono absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[color-mix(in_srgb,var(--void)_75%,transparent)] px-1.5 py-px text-[11px] font-semibold tracking-wider text-[var(--text)] shadow-[0_0_0_1px_rgba(0,0,0,0.4)] lg:text-xs">
          {pct}%
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end leading-none">
        <span className="data-mono text-xl font-semibold text-cyan lg:text-2xl">
          {xpLabel}
        </span>
        {bandLabel ? (
          <span className="mt-0.5 hidden data-mono text-[10px] text-dim sm:inline">
            {bandLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}
