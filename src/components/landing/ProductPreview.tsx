/**
 * Stylized HUD recreation — suggests CMD missions + practice chrome.
 * Decorative only; not a live screenshot.
 */
export function ProductPreview({ className = '' }: { className?: string }) {
  return (
    <div
      className={`product-preview relative overflow-hidden rounded-lg border border-cyan/25 bg-surface transition-shadow duration-700 ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,240,255,0.12),transparent_65%)]" />

      <div className="relative flex items-center justify-between border-b border-subtle/50 px-3 py-2">
        <span className="font-display text-[11px] font-semibold tracking-wide text-cyan">
          scioly.app
        </span>
        <span className="data-mono text-[9px] text-dim">CMD · MISSIONS</span>
        <span className="data-mono text-[9px] text-muted">XP 1,240</span>
      </div>

      <div className="relative grid gap-3 p-3 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-2">
          <p className="label-caps text-[8px] !text-dim">Active missions</p>
          <MissionRow
            title="Chem Lab — bonding drills"
            meta="Due Fri · 12 / 20"
            fill={0.6}
          />
          <MissionRow
            title="Codebusters — timed set"
            meta="Due Sun · 4 / 15"
            fill={0.28}
          />
          <MissionRow
            title="Anatomy — systems review"
            meta="Open · 9 / 12"
            fill={0.75}
          />
        </div>

        <div className="rounded-md border border-subtle/60 bg-void/80 p-3">
          <p className="label-caps text-[8px] !text-dim">Practice</p>
          <p className="mt-2 font-display text-sm text-foreground">
            Casual arena
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Check answers as you go. Clinic when you miss.
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-sm bg-cyan/15 px-2 py-1 text-[9px] font-semibold tracking-wide text-cyan uppercase">
              Casual
            </span>
            <span className="rounded-sm border border-subtle px-2 py-1 text-[9px] font-semibold tracking-wide text-dim uppercase">
              Timed
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-pill bg-surface-high">
            <div className="stripe-progress h-full w-[62%]" />
          </div>
          <p className="mt-1.5 data-mono text-[9px] text-dim">Session · Q 8/12</p>
        </div>
      </div>
    </div>
  )
}

function MissionRow({
  title,
  meta,
  fill,
}: {
  title: string
  meta: string
  fill: number
}) {
  return (
    <div className="rounded-md border border-subtle/50 bg-void/60 px-2.5 py-2">
      <p className="truncate text-[12px] font-medium text-foreground">{title}</p>
      <p className="mt-0.5 data-mono text-[9px] text-dim">{meta}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-surface-high">
        <div
          className="h-full rounded-pill bg-cyan/70"
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>
    </div>
  )
}
