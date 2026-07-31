import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/cmd/missions', label: 'MISSIONS' },
  { to: '/cmd/vault', label: 'VAULT' },
  { to: '/cmd/comms', label: 'COMMS' },
  { to: '/cmd/leaderboard', label: 'LEADERBOARD' },
] as const

export function BottomNav() {
  return (
    <nav className="flex w-full justify-center">
      <div className="flex w-full max-w-3xl gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `hud-pill flex-1 py-2.5 text-sm ${isActive ? 'hud-pill-active' : ''}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
