import { Link } from 'react-router-dom'
import { CaptainsCue } from '../../components/landing/CaptainsCue'
import { HeroConstellation } from '../../components/landing/HeroConstellation'
import { MarketingFooter } from '../../components/landing/MarketingFooter'
import { ProductPreview } from '../../components/landing/ProductPreview'
import { Reveal } from '../../components/landing/Reveal'
import { landingCopy } from '../../lib/landingCopy'

/**
 * Public marketing landing.
 * Plan 02: brand-first hero + constellation.
 * Plan 03: story · product · polish.
 */
export function LandingPage() {
  const { hero, why, product, scioly, captains, close } = landingCopy

  return (
    <div
      className="fixed inset-0 z-0 overflow-y-auto bg-void text-foreground"
      data-theme="hud"
    >
      <div className="marketing-root min-h-full">
        <section className="relative flex min-h-dvh flex-col justify-end overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
          <HeroConstellation />

          <div className="relative z-[1] mx-auto w-full max-w-6xl">
            <div className="max-w-xl">
              <p className="font-display text-4xl font-bold tracking-tight text-cyan sm:text-5xl lg:text-6xl">
                {hero.brand}
              </p>
              <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-6 sm:text-4xl lg:text-5xl">
                {hero.headline}
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
                {hero.support}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
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
              </div>
              <a
                href={hero.scrollTo}
                className="mt-5 inline-block text-sm text-dim transition-colors hover:text-cyan"
              >
                {hero.scrollCta}
              </a>
            </div>
          </div>
        </section>

        {/* Why */}
        <section
          id={why.id}
          className="border-t border-subtle/60 px-5 py-16 sm:px-8 sm:py-20 lg:px-12"
        >
          <Reveal className="mx-auto max-w-5xl">
            <p className="label-caps text-[9px] text-dim">{why.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {why.title}
            </h2>
            {why.body.map((p) => (
              <p
                key={p.slice(0, 28)}
                className="mt-4 max-w-2xl text-base leading-relaxed text-muted"
              >
                {p}
              </p>
            ))}
          </Reveal>
        </section>

        {/* Product */}
        <section
          id={product.id}
          className="border-t border-subtle/60 px-5 py-16 sm:px-8 sm:py-20 lg:px-12"
        >
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <p className="label-caps text-[9px] text-dim">{product.eyebrow}</p>
              <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {product.title}
              </h2>
              <p className="mt-3 max-w-xl text-muted">{product.lead}</p>
            </Reveal>

            <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
              <Reveal delayMs={80}>
                <ProductPreview />
              </Reveal>

              <Reveal delayMs={140}>
                <ol className="divide-y divide-subtle/60 border-y border-subtle/60">
                  {product.beats.map((beat, i) => (
                    <li key={beat.title} className="py-5 first:pt-4 last:pb-4">
                      <div className="flex gap-4">
                        <span className="data-mono shrink-0 pt-0.5 text-[11px] text-cyan">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="font-display text-lg text-foreground">
                            {beat.title}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted">
                            {beat.body}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Reveal>
            </div>
          </div>
        </section>

        {/* SciOly */}
        <section
          id={scioly.id}
          className="border-t border-subtle/60 px-5 py-16 sm:px-8 sm:py-20 lg:px-12"
        >
          <Reveal className="mx-auto max-w-5xl">
            <p className="label-caps text-[9px] text-dim">{scioly.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {scioly.title}
            </h2>
            {scioly.body.map((p) => (
              <p
                key={p.slice(0, 28)}
                className="mt-4 max-w-2xl text-base leading-relaxed text-muted"
              >
                {p}
              </p>
            ))}
            <p className="mt-6 max-w-2xl border-l-2 border-cyan/40 pl-4 text-sm leading-relaxed text-dim">
              {scioly.disclaimer}
            </p>
          </Reveal>
        </section>

        {/* Captains */}
        <section
          id={captains.id}
          className="border-t border-subtle/60 px-5 py-16 sm:px-8 sm:py-20 lg:px-12"
        >
          <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
            <Reveal>
              <p className="label-caps text-[9px] text-dim">{captains.eyebrow}</p>
              <h2 className="mt-2 max-w-xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {captains.title}
              </h2>
              {captains.body.map((p) => (
                <p
                  key={p.slice(0, 28)}
                  className="mt-4 max-w-xl text-base leading-relaxed text-muted"
                >
                  {p}
                </p>
              ))}
            </Reveal>
            <Reveal delayMs={100}>
              <CaptainsCue className="max-w-sm lg:ml-auto" />
            </Reveal>
          </div>
        </section>

        {/* Close */}
        <section
          id={close.id}
          className="border-t border-subtle/60 px-5 py-20 sm:px-8 lg:px-12"
        >
          <Reveal className="landing-close mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {close.title}
            </h2>
            <p className="mt-4 text-muted">{close.body}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={close.primaryTo}
                className="hud-pill hud-pill-active px-5 py-2.5 text-sm"
              >
                {close.primaryCta}
              </Link>
              <Link
                to={close.secondaryTo}
                className="text-sm text-muted transition-colors hover:text-cyan"
              >
                {close.secondaryCta}
              </Link>
            </div>
          </Reveal>
        </section>

        <MarketingFooter />
      </div>
    </div>
  )
}
