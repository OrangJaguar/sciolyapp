import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { SiteFooter } from './SiteFooter'
import { TopBar } from './TopBar'

export function AppShell() {
  const { pathname } = useLocation()
  const showCmdNav = pathname.startsWith('/cmd')

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-void">
      {/* Full-bleed HUD — no max-width island / side gutters */}
      <div className="mx-auto flex h-full w-full min-h-0 flex-1 flex-col px-5 sm:px-6 lg:px-8 xl:px-10">
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col pt-2 pb-2">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </main>
        <div className="shrink-0 pt-1">
          {showCmdNav && <BottomNav />}
          <SiteFooter />
        </div>
      </div>
    </div>
  )
}
