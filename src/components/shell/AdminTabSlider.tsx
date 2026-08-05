import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { to: '/admin/catalog', label: 'CATALOG' },
  { to: '/admin/generate', label: 'GENERATE' },
  { to: '/admin/review', label: 'REVIEW' },
  { to: '/admin/import', label: 'IMPORT' },
] as const

export function AdminTabSlider() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const index = Math.max(
    0,
    tabs.findIndex((tab) => pathname.startsWith(tab.to)),
  )

  return (
    <div
      role="group"
      aria-label="Admin section"
      className="relative flex h-9 min-w-0 flex-1 items-center rounded-pill border border-[var(--ghost-border)] bg-surface-elevated p-1"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(25%-2px)] rounded-pill bg-cyan shadow-[0_0_16px_var(--cyan-glow)] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {tabs.map((tab, tabIndex) => (
        <button
          key={tab.to}
          type="button"
          onClick={() => navigate(tab.to)}
          className={`relative z-10 min-w-0 flex-1 cursor-pointer truncate py-1 text-center text-[11px] font-bold tracking-[0.14em] transition-colors duration-300 ${
            tabIndex === index
              ? 'text-[var(--on-accent)]'
              : 'text-muted hover:text-[var(--text)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
