/** Visual cue for captains section — roster signal, not a dashboard. */
export function CaptainsCue({ className = '' }: { className?: string }) {
  const rows = [
    { name: 'A. Chen', signal: 'On pace', tone: 'ok' as const },
    { name: 'J. Ortiz', signal: 'Mission due', tone: 'warn' as const },
    { name: 'M. Park', signal: 'Quiet 5d', tone: 'dim' as const },
  ]

  return (
    <div
      className={`rounded-lg border border-subtle/60 bg-surface px-4 py-4 ${className}`}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <p className="label-caps text-[8px] !text-dim">Unit signal</p>
        <p className="data-mono text-[9px] text-dim">READ ONLY</p>
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between gap-3 border-b border-subtle/40 pb-2 last:border-0 last:pb-0"
          >
            <span className="text-sm text-foreground">{r.name}</span>
            <span
              className={
                r.tone === 'ok'
                  ? 'data-mono text-[10px] text-success'
                  : r.tone === 'warn'
                    ? 'data-mono text-[10px] text-cyan'
                    : 'data-mono text-[10px] text-dim'
              }
            >
              {r.signal}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
