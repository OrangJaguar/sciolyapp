import { useLocation, useNavigate } from 'react-router-dom'

type Mode = 'cmd' | 'ops' | 'none'

export function CmdOpsToggle() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const mode: Mode = pathname.startsWith('/ops')
    ? 'ops'
    : pathname.startsWith('/cmd')
      ? 'cmd'
      : 'none'

  return (
    <div
      role="group"
      aria-label="CMD or OPS"
      className="relative flex h-10 w-[11rem] shrink-0 cursor-pointer items-center rounded-pill border border-[var(--ghost-border)] bg-surface-elevated p-1 lg:h-11 lg:w-[12rem]"
    >
      {mode !== 'none' && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-pill bg-cyan shadow-[0_0_16px_var(--cyan-glow)] transition-transform duration-300 ease-out"
          style={{
            left: 4,
            transform: mode === 'ops' ? 'translateX(100%)' : 'translateX(0)',
          }}
        />
      )}
      <button
        type="button"
        onClick={() => navigate('/cmd/missions')}
        className={`relative z-10 flex-1 cursor-pointer py-1.5 text-center text-sm font-bold tracking-[0.14em] transition-colors duration-300 ${
          mode === 'cmd'
            ? 'text-[var(--on-accent)]'
            : 'text-muted hover:text-[var(--text)]'
        }`}
      >
        CMD
      </button>
      <button
        type="button"
        onClick={() => navigate('/ops')}
        className={`relative z-10 flex-1 cursor-pointer py-1.5 text-center text-sm font-bold tracking-[0.14em] transition-colors duration-300 ${
          mode === 'ops'
            ? 'text-[var(--on-accent)]'
            : 'text-muted hover:text-[var(--text)]'
        }`}
      >
        OPS
      </button>
    </div>
  )
}
