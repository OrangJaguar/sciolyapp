import { lazy, Suspense, useEffect, useState } from 'react'
import { EventConstellationFallback } from './EventConstellationFallback'

const EventConstellation = lazy(() =>
  import('./EventConstellation').then((m) => ({
    default: m.EventConstellation,
  })),
)

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Full-bleed signature beat: canvas constellation with static fallback.
 */
export function HeroConstellation() {
  const reduced = usePrefersReducedMotion()

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {/* Depth wash under the beat */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_62%_42%,rgba(0,240,255,0.09),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_18%_78%,rgba(0,240,255,0.04),transparent_65%)]" />

      <div className="pointer-events-auto absolute inset-0">
        {reduced ? (
          <EventConstellationFallback />
        ) : (
          <Suspense fallback={<EventConstellationFallback />}>
            <EventConstellation className="h-full w-full" />
          </Suspense>
        )}
      </div>

      {/* Readability veil over the right/ambient field so type stays crisp */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--void)] via-[var(--void)]/75 to-transparent sm:via-[var(--void)]/55 sm:to-[var(--void)]/10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--void)] to-transparent" />
    </div>
  )
}
