import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-void text-muted">
      {label}
    </div>
  )
}

function ProfileMissing() {
  const { refreshProfile, signOut } = useAuth()
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-void px-5 text-center">
      <p className="label-caps text-dim">Profile</p>
      <h1 className="text-xl font-bold text-foreground">Could not load profile</h1>
      <p className="max-w-sm text-sm text-muted">
        Your account is signed in, but no profile row was found. Retry, or sign
        out and try again.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void refreshProfile()}
          className="hud-pill hud-pill-active px-5 py-2.5 text-sm"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="hud-pill px-5 py-2.5 text-sm text-foreground"
        >
          Sign out
        </button>
      </div>
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
  const { ready, session, profile, profileStatus } = useAuth()

  if (!ready) return <Loading />
  if (!session) return <Navigate to="/login" replace />

  if (profileStatus === 'loading') {
    return <Loading label="Loading profile…" />
  }
  if (profileStatus === 'missing' || !profile) {
    return <ProfileMissing />
  }
  if (!profile.onboarding_complete) {
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { ready, session, profile, profileStatus } = useAuth()

  if (!ready) return <Loading />

  if (session) {
    if (profileStatus === 'loading') {
      return <Loading label="Loading profile…" />
    }
    if (profileStatus === 'missing' || !profile) {
      return <ProfileMissing />
    }
    if (!profile.onboarding_complete) {
      return <Navigate to="/setup" replace />
    }
    return <Navigate to="/cmd/missions" replace />
  }

  return children
}

/** Platform admin only (`profiles.platform_role`). Skip gate when Supabase is off (local shell). */
export function RequireAdmin() {
  const { ready, configured, session, profile, profileStatus } = useAuth()

  if (!ready) return <Loading />
  if (!configured) return <Outlet />

  if (!session) return <Navigate to="/login" replace />
  if (profileStatus === 'loading') {
    return <Loading label="Loading profile…" />
  }
  if (profileStatus === 'missing' || !profile) {
    return <ProfileMissing />
  }
  if (profile.platform_role !== 'admin') {
    return <Navigate to="/cmd/missions" replace />
  }

  return <Outlet />
}
