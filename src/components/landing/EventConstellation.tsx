import { useEffect, useRef } from 'react'

type NodeDef = {
  label: string
  ring: number
  angle0: number
  speed: number
  size: number
}

/** Short SciOly-flavored labels — decorative, not a live catalog. */
const NODES: NodeDef[] = [
  { label: 'Chem Lab', ring: 0, angle0: 0.35, speed: 0.12, size: 1.15 },
  { label: 'Codebusters', ring: 0, angle0: 2.4, speed: 0.11, size: 1 },
  { label: 'Optics', ring: 0, angle0: 4.5, speed: 0.13, size: 0.95 },
  { label: 'Anatomy', ring: 1, angle0: 0.8, speed: 0.08, size: 1.1 },
  { label: 'Forensics', ring: 1, angle0: 2.1, speed: 0.09, size: 1 },
  { label: 'Fossils', ring: 1, angle0: 3.6, speed: 0.075, size: 0.95 },
  { label: 'Astronomy', ring: 1, angle0: 5.2, speed: 0.085, size: 1.05 },
  { label: 'Circuit Lab', ring: 2, angle0: 0.2, speed: 0.055, size: 1.1 },
  { label: 'Dynamic Planet', ring: 2, angle0: 1.7, speed: 0.05, size: 1 },
  { label: 'Disease Detectives', ring: 2, angle0: 3.1, speed: 0.06, size: 1.05 },
  { label: 'Robot Tour', ring: 2, angle0: 4.4, speed: 0.048, size: 0.95 },
  { label: 'Rocks & Minerals', ring: 2, angle0: 5.6, speed: 0.052, size: 1 },
]

const RING_RADII = [0.28, 0.48, 0.72]

type Props = {
  className?: string
}

/**
 * Procedural event constellation — canvas rings + nodes, pointer parallax.
 * Pauses when offscreen. No textures / Three.js.
 */
export function EventConstellation({ className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const visible = useRef(true)
  const raf = useRef(0)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry?.isIntersecting ?? false
      },
      { threshold: 0.05 },
    )
    io.observe(wrap)

    const onMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      pointer.current.tx = Math.max(-1, Math.min(1, nx))
      pointer.current.ty = Math.max(-1, Math.min(1, ny))
    }
    const onLeave = () => {
      pointer.current.tx = 0
      pointer.current.ty = 0
    }
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    let dpr = 1
    let w = 0
    let h = 0
    let t0 = performance.now()

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = wrap.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const draw = (now: number) => {
      raf.current = requestAnimationFrame(draw)
      if (!visible.current || w < 1 || h < 1) return

      const p = pointer.current
      p.x += (p.tx - p.x) * 0.06
      p.y += (p.ty - p.y) * 0.06

      const elapsed = (now - t0) / 1000
      const cx = w * 0.58 + p.x * 18
      const cy = h * 0.48 + p.y * 14
      const scale = Math.min(w, h) * 0.48

      ctx.clearRect(0, 0, w, h)

      // Soft radial wash
      const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 1.35)
      wash.addColorStop(0, 'rgba(0,240,255,0.10)')
      wash.addColorStop(0.55, 'rgba(0,240,255,0.03)')
      wash.addColorStop(1, 'rgba(0,240,255,0)')
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, w, h)

      // Rings
      for (let i = 0; i < RING_RADII.length; i++) {
        const r = RING_RADII[i]! * scale
        ctx.beginPath()
        ctx.ellipse(
          cx + p.x * (4 + i * 2),
          cy + p.y * (3 + i * 1.5),
          r,
          r * (0.92 + p.y * 0.03),
          p.x * 0.08,
          0,
          Math.PI * 2,
        )
        ctx.strokeStyle = `rgba(0,240,255,${0.14 + i * 0.06})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Core
      ctx.beginPath()
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,240,255,0.95)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,240,255,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()

      const positions: Array<{ x: number; y: number; n: NodeDef }> = []

      for (const n of NODES) {
        const baseR = RING_RADII[n.ring]! * scale
        const angle = n.angle0 + elapsed * n.speed
        const tiltX = p.x * (6 + n.ring * 3)
        const tiltY = p.y * (5 + n.ring * 2)
        const x = cx + Math.cos(angle) * baseR + tiltX
        const y =
          cy +
          Math.sin(angle) * baseR * (0.92 + p.y * 0.03) +
          tiltY
        positions.push({ x, y, n })
      }

      // Links to core
      for (const { x, y } of positions) {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(x, y)
        ctx.strokeStyle = 'rgba(0,240,255,0.12)'
        ctx.lineWidth = 0.75
        ctx.stroke()
      }

      // Occasional neighbor links (same ring)
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i]!
        for (let j = i + 1; j < positions.length; j++) {
          const b = positions[j]!
          if (a.n.ring !== b.n.ring) continue
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist > scale * 0.42) continue
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = 'rgba(0,240,255,0.08)'
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }

      ctx.font =
        '600 11px "Space Grotesk", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      for (const { x, y, n } of positions) {
        const radius = 3.2 * n.size
        ctx.beginPath()
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,240,255,0.08)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,240,255,0.92)'
        ctx.fill()

        // Labels only on larger viewports — keep mobile clean
        if (w >= 640) {
          ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.fillText(n.label, x, y + radius + 5)
        }
      }
    }

    raf.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf.current)
      io.disconnect()
      ro.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
    </div>
  )
}
