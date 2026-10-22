import { RANK_CURVE, type RankCurveBand } from '../../lib/progression'

const BLURB: Record<string, string> = {
  Recruit: 'First week on the squad.',
  Specialist: 'You can hold your event.',
  Tactician: 'You run the station.',
  Master: 'The binder lives in your head.',
  Elite: 'Invitationals start to flinch.',
  'National Contender': 'States is a warm-up.',
  'National Legend': 'The ladder does not end.',
}

export function RankLadderTip({ currentRank }: { currentRank: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan/40 text-[11px] font-semibold text-cyan transition-colors hover:border-cyan hover:bg-cyan/10 focus-visible:border-cyan focus-visible:outline-none"
        aria-label="Show the rank ladder"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-0 z-40 w-[min(22rem,calc(100vw-2.5rem))] pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100"
      >
      <span className="block rounded-2xl border border-cyan/30 bg-[var(--surface-elevated)] p-3 shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
        <span className="flex items-center justify-between gap-3">
          <span className="label-caps text-[9px] text-dim">Rank ladder</span>
          <LadderGlyph className="text-cyan/80" />
        </span>
        <span className="mt-1 block text-[11px] text-muted">
          Rank comes from total XP. Each level inside a rank costs a flat amount.
        </span>
        <span className="mt-3 block space-y-1.5">
          {RANK_CURVE.map((band, index) => (
            <RankRung
              key={band.name}
              band={band}
              index={index}
              current={band.name === currentRank}
            />
          ))}
        </span>
        <span className="mt-3 block border-t border-subtle pt-2 text-[10px] leading-relaxed text-dim">
          Casual correct +5 XP · timed correct +6 XP. Practice XP caps at 200 a
          day. A 7-day streak starts a 1.1× boost.
        </span>
      </span>
      </span>
    </span>
  )
}

function RankRung({
  band,
  index,
  current,
}: {
  band: RankCurveBand
  index: number
  current: boolean
}) {
  const levels =
    band.endLevel == null
      ? `Lv ${band.startLevel}+`
      : `Lv ${band.startLevel}–${band.endLevel}`
  return (
    <span
      className={`flex items-center gap-2.5 rounded-xl border px-2 py-1.5 ${
        current
          ? 'border-cyan/50 bg-cyan/10 shadow-[0_0_16px_var(--accent-dim)]'
          : 'border-transparent bg-void/40'
      }`}
    >
      <RankMark index={index} current={current} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`font-display text-sm ${current ? 'text-cyan' : 'text-foreground'}`}
          >
            {band.name}
          </span>
          <span className="data-mono text-[10px] text-dim">{levels}</span>
        </span>
        <span className="mt-0.5 block text-[10px] text-muted">
          {BLURB[band.name] ?? 'Keep answering.'}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block data-mono text-[10px] text-cyan">
          {band.entryXp === 0 ? '0' : band.entryXp.toLocaleString()} XP
        </span>
        <span className="block text-[9px] text-dim">
          {band.xpPerLevel} / level
        </span>
      </span>
    </span>
  )
}

function RankMark({ index, current }: { index: number; current: boolean }) {
  const tone = current ? 'text-cyan' : 'text-dim'
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-current/30 bg-void ${tone}`}
      aria-hidden
    >
      <MarkSvg index={index} />
    </span>
  )
}

function MarkSvg({ index }: { index: number }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'h-4 w-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (index <= 0) {
    return (
      <svg {...common}>
        <path d="M6 14l6-6 6 6" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <path d="M6 16l6-5 6 5" />
        <path d="M6 11l6-5 6 5" />
      </svg>
    )
  }
  if (index === 2) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </svg>
    )
  }
  if (index === 3) {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    )
  }
  if (index === 4) {
    return (
      <svg {...common}>
        <path d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z" />
      </svg>
    )
  }
  if (index === 5) {
    return (
      <svg {...common}>
        <path d="M7 16c-2-2-3-4-2-7 3 1 4 3 5 5" />
        <path d="M17 16c2-2 3-4 2-7-3 1-4 3-5 5" />
        <path d="M12 8l1.4 2.8L16.5 12 13.4 13.2 12 16l-1.4-2.8L8 12l3.1-1.2L12 8z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M5 16l2-6 5 3 5-3 2 6" />
      <path d="M8 16h8" />
      <path d="M12 4l1 2.2L15.4 7 13 8.2 12 10.5 11 8.2 8.6 7l2.4-.8L12 4z" />
    </svg>
  )
}

function LadderGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 14"
      className={`h-3.5 w-9 ${className ?? ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path d="M4 1v12M32 1v12M4 4h28M4 8h28M4 12h28" />
    </svg>
  )
}
