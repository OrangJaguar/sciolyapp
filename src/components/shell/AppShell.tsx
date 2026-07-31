import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { SiteFooter } from './SiteFooter'
import { TopBar } from './TopBar'

export function AppShell() {
  const { pathname } = useLocation()
  const showCmdNav = pathname.startsWith('/cmd')

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-void">
      <TopBar />
      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-5 pt-1 pb-2">
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
      <div className="shrink-0 px-5 pt-1">
        {showCmdNav && <BottomNav />}
        <SiteFooter />
      </div>
    </div>
  )
}
