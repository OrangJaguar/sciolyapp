import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { landingCopy } from '../../lib/landingCopy'

/**
 * Hero actions. Signed-in users get one “Go to app” pill.
 * Signed-out users get Get started + Log in. Nothing floats over the scroll link.
 */
export function HeroCtas() {
  const { hero } = landingCopy
  const { ready, session, profile, profileStatus } = useAuth()

  if (!ready || (session && profileStatus === 'loading' && !profile)) {
    return <div className="mt-8 h-11" />
  }

  const signedIn = Boolean(session)
  const appTo =
    profile && !profile.onboarding_complete ? '/setup' : '/cmd/missions'

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {signedIn ? (
          <Link to={appTo} className="hud-pill hud-pill-active px-5 py-2.5 text-sm">
            Go to app
          </Link>
        ) : (
          <>
            <Link
              to={hero.primaryTo}
              className="hud-pill hud-pill-active px-5 py-2.5 text-sm"
            >
              {hero.primaryCta}
            </Link>
            <Link
              to={hero.secondaryTo}
              className="hud-pill px-5 py-2.5 text-sm text-foreground"
            >
              {hero.secondaryCta}
            </Link>
          </>
        )}
      </div>
      <a
        href={hero.scrollTo}
        className="mt-6 inline-block text-sm text-dim transition-colors hover:text-cyan"
      >
        {hero.scrollCta}
      </a>
    </>
  )
}
