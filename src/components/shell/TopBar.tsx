import { Link } from 'react-router-dom'
import { demoUser, formatXp } from '../../mocks/demoUser'
import { CmdOpsToggle } from './CmdOpsToggle'
import { RadarIcon } from './RadarIcon'
import { XpBar } from './XpBar'

export function TopBar() {
  return (
    <header className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-1">
      <div className="shrink-0">
        <span className="text-sm text-muted">Rank:&nbsp;</span>
        <span className="text-xl font-bold tracking-wide text-white uppercase">
          {demoUser.rankTitle}
        </span>
      </div>

      <XpBar
        progress={demoUser.xpProgress}
        xpLabel={formatXp(demoUser.xp)}
      />

      <CmdOpsToggle />

      <Link
        to="/profile"
        aria-label="Profile"
        className="shrink-0 text-cyan/80 transition-colors hover:text-cyan"
      >
        <RadarIcon className="h-8 w-8" />
      </Link>
    </header>
  )
}
