import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { profileToHud } from '../../lib/progression'
import { AdminTabSlider } from './AdminTabSlider'
import { CmdOpsToggle } from './CmdOpsToggle'
import { RadarIcon } from './RadarIcon'
import { XpBar } from './XpBar'

export function TopBar() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const hud = profileToHud(profile)
  const inAdmin = pathname.startsWith('/admin')

  return (
    <header
      className={`flex shrink-0 items-center gap-4 ${
        inAdmin ? 'pt-2 pb-1' : 'pt-4 pb-2'
      }`}
    >
      {inAdmin ? (
        <AdminTabSlider />
      ) : (
        <>
          <div className="shrink-0">
            <span className="text-base text-muted">Rank:&nbsp;</span>
            <span className="text-2xl font-bold tracking-wide text-[var(--text)] uppercase lg:text-3xl">
              {hud.rankTitle}
            </span>
          </div>

          <XpBar progress={hud.progress} xpLabel={hud.xpLabel} />
        </>
      )}

      <CmdOpsToggle />

      <Link
        to="/profile"
        aria-label="Profile"
        className="shrink-0 text-cyan/80 transition-colors hover:text-cyan"
      >
        <RadarIcon className="h-9 w-9 lg:h-10 lg:w-10" />
      </Link>
    </header>
  )
}
