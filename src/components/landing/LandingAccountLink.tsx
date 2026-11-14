import { Link } from 'react-router-dom'
import { AbandonAccountButton } from '../auth/AbandonAccountButton'
import { useAuth } from '../../features/auth/AuthProvider'
import { landingCopy } from '../../lib/landingCopy'

/**
 * Hero actions. A finished login gets “Go to app”.
 * An unfinished login also gets Log out, which deletes that account.
 * Signed-out users get Get started + Log in.
 */
export function HeroCtas() {
  const { hero } = landingCopy
  const { ready, session, profile, profileStatus } = useAuth()

  if (!ready || (session && profileStatus === 'loading' && !profile)) {
    return <div className="mt-8 h-11" />
  }

  const signedIn = Boolean(session)
  const unfinished = Boolean(profile && !profile.onboarding_complete)
  const appTo = unfinished ? '/setup' : '/cmd/missions'

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {signedIn ? (
          <>
            <Link to={appTo} className="hud-pill hud-pill-active px-5 py-2.5 text-sm">
              Go to app
            </Link>
            {unfinished && <AbandonAccountButton />}
          </>
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
      {unfinished && (
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          This login still needs setup. Log out deletes the account so the same
          email can start over.
        </p>
      )}
      <a
        href={hero.scrollTo}
        className="mt-6 inline-block text-sm text-dim transition-colors hover:text-cyan"
      >
        {hero.scrollCta}
      </a>
    </>
  )
}
