import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { LandingPage } from '../../pages/landing/LandingPage'

/**
 * `/` — landing for logged-out users; onboarded users go to CMD.
 */
export function HomeEntry() {
  const { ready, session, profile, profileStatus, configured } = useAuth()

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void text-muted">
        Loading…
      </div>
    )
  }

  // Demo / no Supabase: still show landing at /
  if (!configured) {
    return <LandingPage />
  }

  if (session) {
    if (profileStatus === 'loading') {
      return (
        <div className="flex h-dvh items-center justify-center bg-void text-muted">
          Loading profile…
        </div>
      )
    }
    if (profileStatus === 'missing' || !profile) {
      return <Navigate to="/setup" replace />
    }
    if (!profile.onboarding_complete) {
      return <Navigate to="/setup" replace />
    }
    return <Navigate to="/cmd/missions" replace />
  }

  return <LandingPage />
}
