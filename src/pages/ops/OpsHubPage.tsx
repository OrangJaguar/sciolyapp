import { Link } from 'react-router-dom'

const cards = [
  { to: '/ops/binder', label: 'Binder / Planner', badge: null },
  { to: '/ops/casual', label: 'Casual / Mode', badge: 'MOST POPULAR' },
  { to: '/ops/timed', label: 'Timed / Practice', badge: null },
] as const

export function OpsHubPage() {
  return (
    <div className="grid h-full min-h-0 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.to}
          to={card.to}
          className="hud-panel group relative flex h-full min-h-0 flex-col border-white/25 p-5 transition-colors hover:border-cyan/50"
        >
          {card.badge && (
            <span className="absolute top-5 left-1/2 -translate-x-1/2 rounded-pill bg-cyan px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-black">
              {card.badge}
            </span>
          )}
          <span className="mt-auto text-3xl font-medium tracking-tight text-white md:text-4xl">
            {card.label.split(' / ').map((line, i) => (
              <span key={line} className="block">
                {line}
                {i === 0 ? ' /' : ''}
              </span>
            ))}
          </span>
        </Link>
      ))}
    </div>
  )
}
