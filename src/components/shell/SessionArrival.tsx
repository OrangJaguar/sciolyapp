import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  bandForXp,
  levelFromXp,
  rankTitleFromXp,
} from '../../lib/progression'
import type { PracticeSummaryPayload } from '../../lib/practiceSummary'

type Hold = { xp: number; animate: boolean }

const HoldContext = createContext<Hold | null>(null)

export function useHeldXp(): Hold | null {
  return useContext(HoldContext)
}

function levelCapXp(xp: number): number {
  const band = bandForXp(xp)
  const level = levelFromXp(xp)
  const nextLine =
    band.entryXp + (level - band.startLevel + 1) * band.xpPerLevel
  return Math.max(xp, nextLine - 1)
}

function flyXp(onDone: () => void): () => void {
  const source = document.querySelector('[data-xp-source]')
  const target = document.querySelector('[data-xp-bar]')
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    onDone()
    return () => {}
  }
  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  const layer = document.createElement('div')
  layer.className = 'xp-flight-layer'
  const count = 18
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span')
    spark.className = i % 4 === 0 ? 'xp-spark xp-spark-core' : 'xp-spark'
    const sx = from.left + from.width * (0.15 + Math.random() * 0.7)
    const sy = from.top + from.height * (0.2 + Math.random() * 0.6)
    const angle = Math.random() * Math.PI * 2
    const reach = 28 + Math.random() * 72
    spark.style.setProperty('--sx', `${sx}px`)
    spark.style.setProperty('--sy', `${sy}px`)
    spark.style.setProperty('--bx', `${sx + Math.cos(angle) * reach}px`)
    spark.style.setProperty('--by', `${sy + Math.sin(angle) * reach - 24}px`)
    spark.style.setProperty(
      '--tx',
      `${to.left + 12 + Math.random() * Math.max(24, to.width - 24)}px`,
    )
    spark.style.setProperty('--ty', `${to.top + to.height / 2}px`)
    spark.style.animationDelay = `${i * 26}ms`
    layer.appendChild(spark)
  }
  document.body.appendChild(layer)
  const timer = window.setTimeout(() => {
    layer.remove()
    onDone()
  }, 980)
  return () => {
    window.clearTimeout(timer)
    layer.remove()
  }
}

type Ceremony = {
  kind: 'level' | 'rank'
  title: string
  detail: string
}

export function SessionArrival({
  summary,
  children,
}: {
  summary: PracticeSummaryPayload | null
  children: ReactNode
}) {
  const [hold, setHold] = useState<Hold | null>(null)
  const [ceremony, setCeremony] = useState<Ceremony | null>(null)
  const flightKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!summary) {
      setHold(null)
      return
    }
    if (flightKey.current === summary.createdAt) return
    setHold({ xp: summary.xpBefore, animate: false })
  }, [summary])

  useEffect(() => {
    if (!summary?.settled) return
    if (flightKey.current === summary.createdAt) return
    const key = summary.createdAt
    const from = summary.xpBefore
    const to = summary.commit.xp_total
    const gained = summary.commit.xp_awarded > 0 && !summary.saveError && to > from
    if (!gained) {
      flightKey.current = key
      setHold(null)
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cancelFlight = () => {}
    let finishTimer = 0
    let snapTimer = 0
    let ceremonyTimer = 0
    let stopped = false

    const finish = () => {
      if (stopped) return
      flightKey.current = key
      const fromLevel = levelFromXp(from)
      const toLevel = levelFromXp(to)
      const fromRank = rankTitleFromXp(from)
      const toRank = rankTitleFromXp(to)
      const leveled = toLevel !== fromLevel || toRank !== fromRank
      if (!leveled) {
        setHold({ xp: to, animate: !reduced })
        finishTimer = window.setTimeout(() => setHold(null), reduced ? 0 : 800)
        return
      }
      if (reduced) {
        setHold({ xp: to, animate: false })
        setCeremony({
          kind: toRank !== fromRank ? 'rank' : 'level',
          title: toRank !== fromRank ? toRank : String(toLevel),
          detail: toRank !== fromRank ? `Level ${toLevel}` : toRank,
        })
        return
      }
      setHold({ xp: levelCapXp(from), animate: true })
      snapTimer = window.setTimeout(() => {
        setHold({ xp: to, animate: false })
        ceremonyTimer = window.setTimeout(() => {
          setCeremony({
            kind: toRank !== fromRank ? 'rank' : 'level',
            title: toRank !== fromRank ? toRank : String(toLevel),
            detail: toRank !== fromRank ? `Level ${toLevel}` : toRank,
          })
        }, 180)
      }, 720)
    }

    const start = window.setTimeout(() => {
      if (reduced) {
        finish()
        return
      }
      cancelFlight = flyXp(finish)
    }, 220)

    return () => {
      stopped = true
      window.clearTimeout(start)
      window.clearTimeout(finishTimer)
      window.clearTimeout(snapTimer)
      window.clearTimeout(ceremonyTimer)
      cancelFlight()
    }
  }, [summary])

  const dismissCeremony = useCallback(() => {
    setCeremony(null)
    setHold(null)
  }, [])

  return (
    <HoldContext.Provider value={hold}>
      {children}
      {ceremony
        ? createPortal(
            <RankCeremony ceremony={ceremony} onDone={dismissCeremony} />,
            document.body,
          )
        : null}
    </HoldContext.Provider>
  )
}

function RankCeremony({
  ceremony,
  onDone,
}: {
  ceremony: Ceremony
  onDone: () => void
}) {
  useEffect(() => {
    const ms = ceremony.kind === 'rank' ? 3400 : 2500
    const timer = window.setTimeout(onDone, ms)
    return () => window.clearTimeout(timer)
  }, [ceremony, onDone])

  return (
    <button
      type="button"
      className={`rank-veil ${ceremony.kind === 'rank' ? 'rank-veil-major' : ''}`}
      onClick={onDone}
      aria-label={ceremony.kind === 'rank' ? 'New rank' : 'Level up'}
    >
      <div className="rank-stage">
        <span className="rank-ring rank-ring-a" />
        <span className="rank-ring rank-ring-b" />
        <span className="rank-ring rank-ring-c" />
        <p className="rank-kicker">
          {ceremony.kind === 'rank' ? 'New rank' : 'Level up'}
        </p>
        <p
          className={`rank-title ${ceremony.kind === 'rank' ? 'rank-title-major' : ''}`}
        >
          {ceremony.title}
        </p>
        <p className="rank-detail">{ceremony.detail}</p>
      </div>
    </button>
  )
}
