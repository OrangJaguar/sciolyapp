import { useLocation, useNavigate } from 'react-router-dom'

export function CmdOpsToggle() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isOps = pathname.startsWith('/ops')

  const toggle = () => {
    if (isOps) navigate('/cmd/missions')
    else navigate('/ops')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOps ? 'Switch to CMD' : 'Switch to OPS'}
      className="relative flex h-9 w-[9.5rem] shrink-0 items-center rounded-pill border border-[var(--ghost-border)] bg-surface-elevated p-1"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-pill bg-cyan shadow-[0_0_16px_var(--cyan-glow)] transition-transform duration-300 ease-out"
        style={{
          left: 4,
          transform: isOps ? 'translateX(100%)' : 'translateX(0)',
        }}
      />
      <span
        className={`relative z-10 flex-1 text-center text-xs font-bold tracking-[0.14em] transition-colors duration-300 ${
          !isOps ? 'text-black' : 'text-muted'
        }`}
      >
        CMD
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-xs font-bold tracking-[0.14em] transition-colors duration-300 ${
          isOps ? 'text-black' : 'text-muted'
        }`}
      >
        OPS
      </span>
    </button>
  )
}
