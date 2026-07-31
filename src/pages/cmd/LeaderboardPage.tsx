const ranks = [
  { place: 1, handle: 'OPERATIVE_ALPHA', tone: 'gold' },
  { place: 2, handle: 'GHOST_PROTOCOL', tone: 'silver' },
  { place: 3, handle: 'NIGHT_SIGNAL', tone: 'bronze' },
  { place: 4, handle: 'VECTOR_NINE', tone: 'dim' },
  { place: 5, handle: 'PHASE_LOCK', tone: 'dim' },
  { place: 6, handle: 'ORBIT_DRIFT', tone: 'dim' },
  { place: 7, handle: 'STATIC_FIELD', tone: 'dim' },
  { place: 8, handle: 'NULL_SCOPE', tone: 'dim' },
  { place: 9, handle: 'LOW_ORBIT', tone: 'dim' },
] as const

const badge: Record<string, string> = {
  gold: 'bg-[#e8c547] text-black',
  silver: 'bg-[#c0c0c0] text-black',
  bronze: 'bg-[#cd7f32] text-black',
  dim: 'bg-transparent text-dim',
}

export function LeaderboardPage() {
  return (
    <div className="hud-panel flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <div className="mb-4 flex shrink-0 flex-wrap gap-3">
        {[
          ['METRIC', 'Xp'],
          ['EVENT', 'All'],
          ['TIME', 'This Season'],
        ].map(([label, value]) => (
          <button
            key={label}
            type="button"
            className="rounded-md border border-cyan/40 px-4 py-2 text-left"
          >
            <span className="label-caps block text-[10px]">{label}</span>
            <span className="data-mono text-sm text-white">{value} ▾</span>
          </button>
        ))}
      </div>

      <ul className="min-h-0 space-y-2 overflow-y-auto pr-1">
        {ranks.map((row) => (
          <li
            key={row.handle}
            className={`flex items-center gap-4 rounded-pill border border-[var(--ghost-border)] bg-surface-elevated px-4 py-2.5 ${
              row.tone === 'dim' ? 'opacity-45' : ''
            }`}
          >
            <span
              className={`data-mono flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${badge[row.tone]}`}
            >
              {row.place}
            </span>
            <span
              className={`data-mono flex-1 text-sm tracking-wider ${
                row.place === 1 ? 'text-cyan' : 'text-white'
              }`}
            >
              {row.handle}
            </span>
            <span className="h-6 w-6 rounded-full border border-[var(--ghost-border)]" />
          </li>
        ))}
      </ul>
    </div>
  )
}
