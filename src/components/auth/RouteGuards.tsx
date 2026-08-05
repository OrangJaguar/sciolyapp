import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-void text-muted">
      Loading…
    </div>
  )
}

export function RequireAuth() {
  const { ready, configured, session } = useAuth()
  const location = useLocation()

  if (!ready) return <Loading />
  if (!configured) return <Navigate to="/login" replace />
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequireOnboarding() {
  const { ready, profile } = useAuth()

  if (!ready) return <Loading />
  if (profile && !profile.onboarding_complete) {
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { ready, session, profile } = useAuth()

  if (!ready) return <Loading />

  if (session) {
    if (profile && !profile.onboarding_complete) {
      return <Navigate to="/setup" replace />
    }
    return <Navigate to="/cmd/missions" replace />
  }

  return children
}

/** Platform admin only (`profiles.platform_role`). Skip gate when Supabase is off (local shell). */
export function RequireAdmin() {
  const { ready, configured, profile } = useAuth()

  if (!ready) return <Loading />
  if (configured && profile?.platform_role !== 'admin') {
    return <Navigate to="/cmd/missions" replace />
  }

  return <Outlet />
}
