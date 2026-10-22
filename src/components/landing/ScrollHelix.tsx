import { useEffect, useId, useState } from 'react'

const HEIGHT = 720
const WIDTH = 44
const TURNS = 7.5
const STEPS = 56

function strandPath(phase: number) {
  let d = ''
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS
    const y = 8 + t * (HEIGHT - 16)
    const x = WIDTH / 2 + Math.sin(t * Math.PI * 2 * TURNS + phase) * 13
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `
  }
  return d.trim()
}

function rungs() {
  const bars: Array<{ x1: number; x2: number; y: number; key: number }> = []
  for (let i = 1; i < STEPS; i += 2) {
    const t = i / STEPS
    const y = 8 + t * (HEIGHT - 16)
    const a = Math.sin(t * Math.PI * 2 * TURNS)
    const b = Math.sin(t * Math.PI * 2 * TURNS + Math.PI)
    bars.push({
      key: i,
      y,
      x1: WIDTH / 2 + a * 13,
      x2: WIDTH / 2 + b * 13,
    })
  }
  return bars
}

const BACK = strandPath(0)
const FRONT = strandPath(Math.PI)
const RUNGS = rungs()

/**
 * Side DNA that fills with page scroll. The landing scroller is a div,
 * not the window, so progress is read from that element.
 */
export function ScrollHelix() {
  const rawId = useId().replace(/:/g, '')
  const clipId = `helix-fill-${rawId}`
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const root = document.querySelector('.marketing-root')
    const scroller = root?.parentElement
    if (!scroller) return

    const read = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      setProgress(max <= 0 ? 0 : scroller.scrollTop / max)
    }
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      scroller.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [])

  const fillHeight = 8 + progress * (HEIGHT - 16)

  return (
    <div
      className="pointer-events-none fixed top-1/2 right-2 z-30 hidden h-[min(70vh,720px)] w-11 -translate-y-1/2 md:block"
      aria-hidden
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={WIDTH} height={fillHeight} />
          </clipPath>
        </defs>
        <g stroke="rgba(255,255,255,0.16)" fill="none" strokeWidth="1.4">
          <path d={BACK} />
          <path d={FRONT} />
          {RUNGS.map((bar) => (
            <line key={bar.key} x1={bar.x1} y1={bar.y} x2={bar.x2} y2={bar.y} />
          ))}
        </g>
        <g
          stroke="#00f0ff"
          fill="none"
          strokeWidth="1.6"
          clipPath={`url(#${clipId})`}
        >
          <path d={BACK} opacity="0.55" />
          <path d={FRONT} />
          {RUNGS.map((bar) => (
            <line
              key={`on-${bar.key}`}
              x1={bar.x1}
              y1={bar.y}
              x2={bar.x2}
              y2={bar.y}
              opacity="0.8"
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
