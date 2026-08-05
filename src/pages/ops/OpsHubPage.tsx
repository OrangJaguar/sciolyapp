import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

type OpsCard = {
  to: string
  title: [string, string]
  badge: string | null
  bullets: string[]
  glow: string
  Visual: () => ReactNode
}

function BinderVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.95">
        <rect x="48" y="28" width="88" height="110" rx="4" opacity="0.35" />
        <rect x="56" y="34" width="88" height="110" rx="4" opacity="0.6" />
        <rect x="64" y="40" width="88" height="110" rx="4" fill="#111111" />
      </g>
      <g stroke="currentColor" strokeWidth="1" opacity="0.55">
        <line x1="76" y1="62" x2="136" y2="62" />
        <line x1="76" y1="78" x2="128" y2="78" />
        <line x1="76" y1="94" x2="132" y2="94" />
        <line x1="76" y1="110" x2="118" y2="110" />
      </g>
      <circle cx="148" cy="52" r="3" fill="currentColor" opacity="0.85" />
      <path d="M148 52 L162 40" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

function CasualVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" aria-hidden>
      <g
        transform="translate(100 82)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <circle r="54" opacity="0.25" />
        <circle r="38" opacity="0.4" />
        <circle r="22" opacity="0.55" />
        <circle r="6" fill="currentColor" stroke="none" opacity="0.95" />
        <line x1="0" y1="-54" x2="0" y2="54" opacity="0.25" />
        <line x1="-54" y1="0" x2="54" y2="0" opacity="0.25" />
        <g className="origin-center animate-none transition-transform duration-700 ease-out group-hover:rotate-[70deg]">
          <path d="M0 0 L38 -28" strokeWidth="1.5" opacity="0.85" />
          <circle cx="32" cy="-24" r="3.5" fill="currentColor" stroke="none" />
        </g>
      </g>
    </svg>
  )
}

function TimedVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" aria-hidden>
      <rect
        x="36"
        y="36"
        width="128"
        height="88"
        rx="8"
        fill="#0a0a0a"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.95"
      />
      <rect
        x="48"
        y="48"
        width="104"
        height="40"
        rx="4"
        fill="#050505"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />
      <text
        x="100"
        y="74"
        textAnchor="middle"
        fill="currentColor"
        fontSize="16"
        fontFamily="JetBrains Mono, monospace"
        opacity="0.95"
      >
        12:00
      </text>
      <g fill="currentColor">
        <circle cx="64" cy="106" r="3" opacity="0.75" />
        <circle cx="100" cy="106" r="3" opacity="0.4" />
        <circle cx="136" cy="106" r="3" opacity="0.4" />
      </g>
      <g stroke="currentColor" strokeWidth="1" opacity="0.3">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = 70
          const rad = (deg * Math.PI) / 180
          return (
            <line
              key={deg}
              x1={100 + Math.cos(rad) * (r - 6)}
              y1={80 + Math.sin(rad) * (r - 6)}
              x2={100 + Math.cos(rad) * r}
              y2={80 + Math.sin(rad) * r}
            />
          )
        })}
      </g>
    </svg>
  )
}

const cards: OpsCard[] = [
  {
    to: '/ops/binder',
    title: ['Binder', 'Planner'],
    badge: null,
    bullets: [
      'Structure your event binder',
      'Track section gaps',
      'Vision audit coming later',
    ],
    glow: 'radial-gradient(ellipse 80% 70% at 50% 28%, rgba(0,240,255,0.18), transparent 70%)',
    Visual: BinderVisual,
  },
  {
    to: '/ops/casual',
    title: ['Casual', 'Mode'],
    badge: 'MOST POPULAR',
    bullets: [
      'Adaptive concept practice',
      'Clinic on repeat misses',
      'Live bank ready to grind',
    ],
    glow: 'radial-gradient(ellipse 90% 75% at 50% 32%, rgba(0,240,255,0.22), transparent 72%)',
    Visual: CasualVisual,
  },
  {
    to: '/ops/timed',
    title: ['Timed', 'Practice'],
    badge: null,
    bullets: [
      'Exam-style black box',
      'No mid-run Clinic',
      'Autopsy after submit',
    ],
    glow: 'radial-gradient(ellipse 85% 70% at 50% 30%, rgba(0,240,255,0.16), transparent 70%)',
    Visual: TimedVisual,
  },
]

export function OpsHubPage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:h-full md:min-h-0 md:grid-cols-3 md:grid-rows-1 md:items-stretch">
      {cards.map((card) => (
        <Link
          key={card.to}
          to={card.to}
          className="hud-panel group relative flex min-h-[320px] flex-col overflow-hidden border-white/20 transition-[border-color,box-shadow,transform] duration-500 ease-out hover:border-cyan/70 hover:shadow-[0_0_40px_rgba(0,240,255,0.18),inset_0_0_40px_rgba(0,240,255,0.04)] md:min-h-0 md:h-full md:hover:-translate-y-1"
        >
          {/* Full-card cyan atmosphere (not a square around the SVG) */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-500 opacity-90 group-hover:opacity-100"
            style={{ background: card.glow }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                'linear-gradient(135deg, rgba(0,240,255,0.08) 0%, transparent 42%, transparent 58%, rgba(0,240,255,0.06) 100%)',
            }}
            aria-hidden
          />

          {card.badge && (
            <span className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-pill bg-cyan px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-black shadow-[0_0_16px_rgba(0,240,255,0.45)] transition-transform duration-500 group-hover:scale-105">
              ✪ {card.badge}
            </span>
          )}

          <div className="relative z-[1] flex min-h-0 flex-1 items-center justify-center px-5 pt-12 pb-2">
            <div className="h-[min(100%,14rem)] w-full max-w-[200px] text-cyan transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-105 group-hover:drop-shadow-[0_0_18px_rgba(0,240,255,0.45)]">
              <card.Visual />
            </div>
          </div>

          <div className="relative z-[1] flex shrink-0 flex-col gap-3 px-5 pt-2 pb-5">
            <h2 className="text-3xl font-medium tracking-tight text-white transition-colors duration-300 group-hover:text-cyan md:text-4xl">
              <span className="block">{card.title[0]}</span>
              <span className="block text-white/90 group-hover:text-cyan/90">
                {card.title[1]}
              </span>
            </h2>
            <ul className="space-y-1.5">
              {card.bullets.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-sm text-muted transition-colors duration-300 group-hover:text-white/70"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan/70 transition-all duration-300 group-hover:scale-125 group-hover:bg-cyan group-hover:shadow-[0_0_8px_var(--cyan)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </Link>
      ))}
    </div>
  )
}
