import { useRef, useState } from 'react'

/**
 * Sample CMD window — generic squad data, laid out like Missions.
 * Hover tilts the frame. Decorative only.
 */
export function ProductPreview({ className = '' }: { className?: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [reduce, setReduce] = useState(false)

  function tilt(clientX: number, clientY: number) {
    const el = frame.current
    if (!el || reduce) return
    const rect = el.getBoundingClientRect()
    const x = (clientX - rect.left) / rect.width - 0.5
    const y = (clientY - rect.top) / rect.height - 0.5
    el.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`
  }

  return (
    <div
      className={`[perspective:1100px] ${className}`}
      onPointerEnter={() => {
        setReduce(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        )
      }}
      onPointerMove={(e) => tilt(e.clientX, e.clientY)}
      onPointerLeave={() => {
        if (frame.current) frame.current.style.transform = 'rotateX(0deg) rotateY(0deg)'
      }}
    >
      <div
        ref={frame}
        className="product-preview origin-center transition-transform duration-200 ease-out will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
        aria-hidden
      >
        <div className="overflow-hidden rounded-lg border border-cyan/30 bg-[#070707] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#101010] px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-cyan/70" />
            <span className="ml-2 font-display text-[11px] font-semibold tracking-wide text-cyan">
              scioly.app
            </span>
            <span className="ml-auto data-mono text-[9px] tracking-wide text-dim">
              SAMPLE · CMD
            </span>
          </div>

          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[8px] tracking-[0.14em] text-dim uppercase">
                Rank
              </p>
              <p className="text-[11px] font-bold tracking-wide text-foreground uppercase">
                Specialist
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded border border-cyan/40 px-1 text-[9px] text-cyan">
                  12
                </span>
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-2 overflow-hidden rounded-full border border-cyan/30 bg-[#141414]">
                <div className="stripe-progress h-full w-[64%]" />
              </div>
              <p className="mt-0.5 data-mono text-[8px] text-dim">1,840 / 2,200 XP</p>
            </div>
            <div className="flex h-6 items-center rounded-full border border-white/10 bg-[#141414] p-0.5 text-[8px] font-bold tracking-[0.12em]">
              <span className="rounded-full bg-cyan px-2 py-0.5 text-black">CMD</span>
              <span className="px-2 text-dim">OPS</span>
            </div>
            <span className="h-6 w-6 rounded-full border border-cyan/40 bg-cyan/10" />
          </div>

          <div className="grid gap-2 p-2.5 sm:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-md border border-white/10 bg-[#0c0c0c] p-2.5">
              <p className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-muted">
                UNIT: Eastview HS
              </p>
              <p className="mt-1.5 rounded-full bg-cyan px-2 py-1 text-[9px] font-bold text-black">
                SQUAD: Varsity C
              </p>
              <p className="mt-3 text-[8px] tracking-[0.14em] text-dim uppercase">
                Upcoming
              </p>
              <p className="data-mono text-[9px] text-muted">Due Fri · T-2d</p>
              <ul className="mt-2 space-y-1.5">
                <MissionLine name="Chem Lab drills" meta="12 / 20" fill={0.6} />
                <MissionLine name="Codebusters set" meta="4 / 15" fill={0.27} />
                <MissionLine name="Anatomy systems" meta="9 / 12" fill={0.75} />
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Next meeting" value="Fri 16:00" note="Room 214" />
                <MiniStat label="Next comp" value="Invite" note="T-18d" />
              </div>
              <div className="flex-1 rounded-md border border-white/10 bg-[#0c0c0c] p-2.5">
                <p className="text-[8px] tracking-[0.14em] text-dim uppercase">
                  Targeted practice
                </p>
                <p className="mt-1 text-[13px] font-medium text-foreground">
                  Disease Detectives
                </p>
                <p className="text-[10px] text-muted">Epidemiology · 18 live</p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded-full bg-cyan px-2 py-0.5 text-[8px] font-bold tracking-wide text-black uppercase">
                    Casual
                  </span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[8px] font-bold tracking-wide text-dim uppercase">
                    Timed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MissionLine({
  name,
  meta,
  fill,
}: {
  name: string
  meta: string
  fill: number
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[10px] text-foreground">{name}</span>
        <span className="data-mono text-[8px] text-dim">{meta}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan/80"
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>
    </li>
  )
}

function MiniStat({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0c0c0c] px-2 py-2">
      <p className="text-[8px] tracking-[0.12em] text-dim uppercase">{label}</p>
      <p className="mt-1 data-mono text-[12px] text-foreground">{value}</p>
      <p className="data-mono text-[9px] text-dim">{note}</p>
    </div>
  )
}
