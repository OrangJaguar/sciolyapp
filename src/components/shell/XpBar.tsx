type XpBarProps = {
  progress: number
  xpLabel: string
}

export function XpBar({ progress, xpLabel }: XpBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4 px-2 lg:px-4">
      <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-pill border border-cyan/40 bg-surface-elevated lg:h-5">
        <div
          className="stripe-progress h-full rounded-pill"
          style={{ width: `${pct}%` }}
        />
        <span className="data-mono absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[color-mix(in_srgb,var(--void)_75%,transparent)] px-1.5 py-px text-[11px] font-semibold tracking-wider text-[var(--text)] shadow-[0_0_0_1px_rgba(0,0,0,0.4)] lg:text-xs">
          {pct}%
        </span>
      </div>
      <span className="data-mono shrink-0 text-xl font-semibold text-cyan lg:text-2xl">
        {xpLabel}
      </span>
    </div>
  )
}
