import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { AvatarMark } from '../../lib/avatars'
import { profileToHud } from '../../lib/progression'
import { AdminTabSlider } from './AdminTabSlider'
import { CmdOpsToggle } from './CmdOpsToggle'
import { XpBar } from './XpBar'

export function TopBar() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const hud = profileToHud(profile)
  const inAdmin = pathname.startsWith('/admin')

  return (
    <header
      className={`flex shrink-0 items-center gap-3 lg:gap-4 ${
        inAdmin ? 'pt-2 pb-1' : 'pt-4 pb-2'
      }`}
    >
      {inAdmin ? (
        <AdminTabSlider />
      ) : (
        <>
          <div className="min-w-0 shrink-0 max-w-[42%] sm:max-w-none">
            <p className="label-caps text-dim">Rank</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-lg font-bold tracking-wide text-[var(--text)] uppercase sm:text-xl lg:text-2xl">
                {hud.rankName}
              </span>
              <span
                className="data-mono inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-cyan/45 bg-cyan/10 px-1.5 text-sm font-semibold text-cyan lg:h-7 lg:text-base"
                title={`Level ${hud.level}`}
              >
                {hud.level}
              </span>
            </div>
          </div>

          <XpBar
            progress={hud.progress}
            xpLabel={hud.xpLabel}
            xpToNext={hud.xpToNext}
            xpIntoLevel={hud.xpIntoLevel}
            xpBand={hud.xpBand}
          />

          {hud.streak > 0 ? (
            <div
              className="hidden shrink-0 flex-col items-end sm:flex"
              title={`${hud.streak}-day streak`}
            >
              <p className="label-caps text-dim">Streak</p>
              <p className="data-mono text-sm font-semibold text-cyan lg:text-base">
                {hud.streak}d
              </p>
            </div>
          ) : null}

          <CmdOpsToggle />

          <Link
            to="/profile"
            aria-label="Profile"
            className="shrink-0 text-cyan/80 transition-colors hover:text-cyan"
          >
            <AvatarMark
              avatarId={profile?.avatar_id}
              className="h-9 w-9 lg:h-10 lg:w-10"
            />
          </Link>
        </>
      )}
    </header>
  )
}
