import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/cmd/missions', label: 'MISSIONS' },
  { to: '/cmd/vault', label: 'VAULT' },
  { to: '/cmd/comms', label: 'COMMS' },
  { to: '/cmd/leaderboard', label: 'LEADERBOARD' },
] as const

export function BottomNav() {
  return (
    <nav className="flex w-full">
      <div className="flex w-full gap-2.5 lg:gap-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `hud-pill flex-1 py-3 text-sm tracking-[0.12em] lg:py-3.5 lg:text-base ${
                isActive ? 'hud-pill-active' : ''
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
