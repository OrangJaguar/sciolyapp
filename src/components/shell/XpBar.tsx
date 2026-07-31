type XpBarProps = {
  progress: number
  xpLabel: string
}

export function XpBar({ progress, xpLabel }: XpBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
      <div className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-pill border border-cyan/40 bg-surface-elevated">
        <div
          className="stripe-progress h-full rounded-pill"
          style={{ width: `${pct}%` }}
        />
        <span className="data-mono absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-black/75 px-1.5 py-px text-[10px] font-semibold tracking-wider text-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]">
          {pct}%
        </span>
      </div>
      <span className="data-mono shrink-0 text-lg font-semibold text-cyan">
        {xpLabel}
      </span>
    </div>
  )
}
