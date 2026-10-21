import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingFooter } from './MarketingFooter'
import {
  LEGAL_NOTE,
  LEGAL_UPDATED,
  type LegalSection,
} from '../../lib/legalCopy'

type Props = {
  title: string
  lede: string
  sections: readonly LegalSection[]
}

/**
 * Marketing legal chrome: exit links, TOC, one card per section.
 * Scroll root is the fixed page scroller (body overflow is hidden).
 */
export function LegalLayout({ title, lede, sections }: Props) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const first = document.getElementById(sections[0]?.id ?? '')
    const root = first?.closest('.legal-scroll')
    if (!(root instanceof HTMLElement)) return

    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => n instanceof HTMLElement)

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const id = visible[0]?.target.id
        if (id) setActive(id)
      },
      { root, rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4] },
    )
    for (const n of nodes) io.observe(n)
    return () => io.disconnect()
  }, [sections])

  return (
    <div
      className="legal-scroll fixed inset-0 z-0 overflow-y-auto bg-void text-foreground"
      data-theme="hud"
    >
      <div className="mx-auto min-h-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm text-dim transition-colors hover:text-cyan"
          >
            ← scioly.app
          </Link>
          <Link
            to="/login"
            className="text-sm text-muted transition-colors hover:text-cyan"
          >
            Log in
          </Link>
        </div>

        <header className="mt-8 max-w-2xl">
          <p className="label-caps text-[9px] text-dim">Legal</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-dim">Updated {LEGAL_UPDATED}</p>
          <p className="mt-4 text-base leading-relaxed text-muted">{lede}</p>
          <p className="mt-4 border-l-2 border-cyan/40 pl-4 text-sm leading-relaxed text-dim">
            {LEGAL_NOTE}
          </p>
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <nav
            aria-label="On this page"
            className="mb-8 lg:sticky lg:top-6 lg:mb-0"
          >
            <p className="label-caps mb-2 hidden text-[8px] text-dim lg:block">
              On this page
            </p>
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
              {sections.map((s) => {
                const on = active === s.id
                return (
                  <li key={s.id} className="shrink-0 lg:shrink">
                    <a
                      href={`#${s.id}`}
                      className={`block rounded-md px-2.5 py-1.5 text-sm transition-colors lg:px-2 ${
                        on
                          ? 'bg-cyan/10 text-cyan'
                          : 'text-muted hover:text-foreground'
                      }`}
                      aria-current={on ? 'true' : undefined}
                    >
                      {s.title}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-6 rounded-lg border border-subtle/70 bg-surface px-4 py-5 sm:px-5"
              >
                <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3">
                  {section.blocks.map((block, i) =>
                    block.type === 'p' ? (
                      <p
                        key={i}
                        className="text-sm leading-relaxed text-muted"
                      >
                        {block.text}
                      </p>
                    ) : (
                      <ul
                        key={i}
                        className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted"
                      >
                        {block.items.map((item) => (
                          <li key={item.slice(0, 32)}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <MarketingFooter />
        </div>
      </div>
    </div>
  )
}
