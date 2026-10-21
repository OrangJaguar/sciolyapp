import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** Extra delay in ms for staggered children */
  delayMs?: number
}

/**
 * One-shot fade/slide on enter. No-op when prefers-reduced-motion.
 */
export function Reveal({ children, className = '', delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    if (mq.matches) {
      setShown(true)
      return
    }

    const el = ref.current
    if (!el) return

    // Landing scrolls inside a fixed overflow container (body is overflow:hidden).
    const root =
      el.closest('.marketing-root')?.parentElement instanceof HTMLElement
        ? el.closest('.marketing-root')!.parentElement
        : null

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { root, threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const style: CSSProperties | undefined =
    reduce || !delayMs
      ? undefined
      : ({ ['--reveal-delay' as string]: `${delayMs}ms` } as CSSProperties)

  return (
    <div
      ref={ref}
      className={`landing-reveal ${shown ? 'landing-reveal-in' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
