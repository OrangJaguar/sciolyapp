import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CaptainsCue } from '../../components/landing/CaptainsCue'
import { HeroConstellation } from '../../components/landing/HeroConstellation'
import { HeroCtas } from '../../components/landing/LandingAccountLink'
import { MarketingFooter } from '../../components/landing/MarketingFooter'
import { ProductPreview } from '../../components/landing/ProductPreview'
import { Reveal } from '../../components/landing/Reveal'
import { ScrollHelix } from '../../components/landing/ScrollHelix'
import { landingCopy } from '../../lib/landingCopy'

/**
 * Public marketing landing.
 */
export function LandingPage() {
  const { hero, why, product, scioly, captains, close } = landingCopy

  return (
    <div
      className="fixed inset-0 z-0 overflow-y-auto bg-void text-foreground"
      data-theme="hud"
    >
      <ScrollHelix />
      <div className="marketing-root min-h-full">
        <section className="relative flex min-h-dvh flex-col justify-end overflow-hidden px-5 pb-16 pt-16 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
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
              <HeroCtas />
            </div>
          </div>
        </section>

        <LandingBand id={why.id}>
          <Reveal>
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
            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {why.arc.map((step) => (
                <li key={step.k} className="border-t border-cyan/25 pt-3">
                  <p className="data-mono text-[11px] text-cyan">{step.k}</p>
                  <p className="mt-1 font-display text-lg text-foreground">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </LandingBand>

        <LandingBand id={product.id}>
          <Reveal>
            <p className="label-caps text-[9px] text-dim">{product.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {product.title}
            </h2>
            <p className="mt-3 max-w-xl text-muted">{product.lead}</p>
          </Reveal>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-12">
            <Reveal delayMs={80}>
              <p className="mb-3 text-[11px] tracking-wide text-dim">
                Hover the window. Sample squad, same chrome as CMD.
              </p>
              <ProductPreview />
            </Reveal>

            <Reveal delayMs={140}>
              <ol className="space-y-6">
                {product.beats.map((beat, i) => (
                  <li key={beat.title} className="flex gap-4">
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
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          <Reveal delayMs={80} className="mt-12">
            <p className="label-caps text-[9px] text-dim">One run</p>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {product.run.map((step, i) => (
                <li
                  key={step.k}
                  className="rounded-lg bg-white/[0.03] px-4 py-4"
                >
                  <p className="data-mono text-[10px] text-cyan">
                    {String(i + 1).padStart(2, '0')} {step.k}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </LandingBand>

        <LandingBand id={scioly.id}>
          <Reveal>
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
            <ul className="mt-8 flex flex-wrap gap-2">
              {scioly.domains.map((d) => (
                <li
                  key={d.name}
                  className="rounded-full border border-cyan/20 bg-cyan/[0.04] px-3 py-2"
                >
                  <span className="text-sm text-foreground">{d.name}</span>
                  <span className="ml-2 text-[11px] text-dim">{d.note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-dim">
              {scioly.disclaimer}
            </p>
          </Reveal>
        </LandingBand>

        <LandingBand id={captains.id}>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
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
              <div className="mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
                <ListBlock label="Leaders can see" items={captains.see} tone="cyan" />
                <ListBlock label="Not in the app" items={captains.skip} tone="dim" />
              </div>
            </Reveal>
            <Reveal delayMs={100}>
              <CaptainsCue className="max-w-sm lg:ml-auto" />
            </Reveal>
          </div>
        </LandingBand>

        <LandingBand id={close.id}>
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
        </LandingBand>

        <MarketingFooter />
      </div>
    </div>
  )
}

function LandingBand({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="relative px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent"
      />
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

function ListBlock({
  label,
  items,
  tone,
}: {
  label: string
  items: readonly string[]
  tone: 'cyan' | 'dim'
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.14em] text-dim uppercase">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`text-sm ${tone === 'cyan' ? 'text-foreground' : 'text-dim'}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
