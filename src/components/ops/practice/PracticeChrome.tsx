import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type NavigatorItemState =
  | 'neutral'
  | 'current'
  | 'answered'
  | 'correct'
  | 'incorrect'
  | 'blank'

export type PracticeNavigatorItem = {
  /** 0-based index */
  index: number
  state: NavigatorItemState
}

export type PracticeShortcut = {
  keys: string
  label: string
}

export const CASUAL_PRACTICE_SHORTCUTS: PracticeShortcut[] = [
  { keys: '1–4', label: 'Select choice' },
  { keys: 'Enter', label: 'Check selected / Next' },
  { keys: 'P', label: 'Pause / resume' },
  { keys: 'H', label: 'Hide / show timer' },
  { keys: 'Esc', label: 'End session' },
]

export const TIMED_PRACTICE_SHORTCUTS: PracticeShortcut[] = [
  { keys: '1–4', label: 'Select choice' },
  { keys: '← / → / [ ]', label: 'Back / Next' },
  { keys: 'Enter', label: 'Next question' },
  { keys: 'P', label: 'Pause / resume' },
  { keys: 'H', label: 'Hide / show timer' },
  { keys: 'Esc', label: 'End exam' },
]

type PracticeChromeProps = {
  current: number
  total: number
  /** Overrides the `Q current/total` label (casual accuracy). */
  counterLabel?: string
  counterTitle?: string
  progressRatio: number
  progressLabel?: string
  navigatorItems: PracticeNavigatorItem[]
  onJump: (index: number) => void
  /** Display string; null hides the clock digits but keep controls if showTimerControls */
  timerLabel: string | null
  timerUrgent?: boolean
  showTimerControls?: boolean
  timerHidden?: boolean
  onTimerHiddenChange?: (hidden: boolean) => void
  paused: boolean
  onPausedChange: (paused: boolean) => void
  onExit: () => void
  exitLabel?: string
  showBack?: boolean
  backDisabled?: boolean
  onBack?: () => void
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  /** Optional End / secondary control (Casual Plan 02) */
  endSlot?: ReactNode
  /** Extra bottom-left (e.g. temporary Skip until Plan 02) */
  bottomLeftExtra?: ReactNode
  shortcuts?: PracticeShortcut[]
  children: ReactNode
}

export function PracticeChrome({
  current,
  total,
  counterLabel,
  counterTitle = 'Question navigator',
  progressRatio,
  progressLabel = 'Session progress',
  navigatorItems,
  onJump,
  timerLabel,
  timerUrgent = false,
  showTimerControls = true,
  timerHidden: timerHiddenControlled,
  onTimerHiddenChange,
  paused,
  onPausedChange,
  onExit,
  exitLabel = 'End',
  showBack = false,
  backDisabled = false,
  onBack,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  endSlot,
  bottomLeftExtra,
  shortcuts = CASUAL_PRACTICE_SHORTCUTS,
  children,
}: PracticeChromeProps) {
  const [navOpen, setNavOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [timerHiddenInternal, setTimerHiddenInternal] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)
  const navPanelId = useId()
  const helpPanelId = useId()

  const timerHidden = timerHiddenControlled ?? timerHiddenInternal
  const setTimerHidden = (next: boolean) => {
    onTimerHiddenChange?.(next)
    if (timerHiddenControlled === undefined) setTimerHiddenInternal(next)
  }

  const ratio = Math.min(1, Math.max(0, progressRatio))

  useEffect(() => {
    if (!navOpen && !helpOpen) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (navOpen && navRef.current && !navRef.current.contains(t)) {
        setNavOpen(false)
      }
      if (helpOpen && helpRef.current && !helpRef.current.contains(t)) {
        setHelpOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (helpOpen) {
          e.preventDefault()
          setHelpOpen(false)
          return
        }
        if (navOpen) {
          e.preventDefault()
          setNavOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [navOpen, helpOpen])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Top chrome */}
      <div className="relative z-20 flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <div className="relative min-w-0 flex-1" ref={navRef}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-expanded={navOpen}
              aria-controls={navPanelId}
              onClick={() => {
                setHelpOpen(false)
                setNavOpen((o) => !o)
              }}
              className="data-mono shrink-0 rounded-md px-1.5 py-0.5 text-sm text-foreground transition hover:bg-[var(--surface-hover)] hover:text-cyan"
              title={counterTitle}
            >
              {counterLabel ?? `Q ${current}/${total}`}
            </button>
            <div
              className="relative h-1.5 min-w-[4rem] max-w-md flex-1 overflow-hidden rounded-pill bg-surface-high"
              role="progressbar"
              aria-valuenow={Math.round(ratio * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={progressLabel}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-pill bg-cyan transition-[width] duration-300"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          </div>

          {navOpen ? (
            <div
              id={navPanelId}
              role="dialog"
              aria-label="Jump to question"
              className="absolute top-full left-0 z-30 mt-2 w-[min(100%,20rem)] rounded-xl border border-subtle bg-[var(--surface-elevated)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            >
              <p className="label-caps text-[9px] text-dim">Questions</p>
              <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {navigatorItems.map((item) => (
                  <NavigatorButton
                    key={item.index}
                    item={item}
                    onClick={() => {
                      onJump(item.index)
                      setNavOpen(false)
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showTimerControls ? (
            <>
              {!timerHidden && timerLabel != null ? (
                <span
                  className={`data-mono rounded-pill border border-subtle px-2.5 py-1 text-sm font-semibold tabular-nums ${
                    timerUrgent ? 'border-alert/40 text-alert' : 'text-cyan'
                  }`}
                >
                  {timerLabel}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setTimerHidden(!timerHidden)}
                className="hud-pill px-2.5 py-1 text-[10px] text-muted"
                title={timerHidden ? 'Show timer' : 'Hide timer'}
              >
                {timerHidden ? 'Show' : 'Hide'}
              </button>
              <button
                type="button"
                onClick={() => onPausedChange(!paused)}
                className={`hud-pill px-2.5 py-1 text-[10px] ${
                  paused ? 'hud-pill-active' : 'text-muted'
                }`}
                title={paused ? 'Resume' : 'Pause'}
                aria-pressed={paused}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onExit}
            className="px-1.5 text-sm text-muted transition hover:text-cyan"
          >
            {exitLabel}
          </button>
        </div>
      </div>

      {/* Question region */}
      <div className="relative min-h-0 flex-1">
        <div
          className={`flex h-full min-h-0 flex-col transition-[filter] duration-200 ${
            paused ? 'pointer-events-none select-none blur-[10px] opacity-40' : ''
          }`}
          aria-hidden={paused}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-0.5 pb-2 md:px-1">
            {children}
          </div>
        </div>

        {paused ? (
          <button
            type="button"
            className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--void)_55%,transparent)]"
            onClick={() => onPausedChange(false)}
          >
            <p className="font-display text-lg font-semibold tracking-wide text-foreground">
              Paused
            </p>
            <p className="text-sm text-muted">Click to resume</p>
          </button>
        ) : null}
      </div>

      {/* Bottom chrome */}
      <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-subtle/80 pt-3">
        <div className="flex items-center gap-2" ref={helpRef}>
          <div
            className="relative"
            onMouseEnter={() => {
              setNavOpen(false)
              setHelpOpen(true)
            }}
            onMouseLeave={() => setHelpOpen(false)}
          >
            <button
              type="button"
              aria-expanded={helpOpen}
              aria-controls={helpPanelId}
              onFocus={() => {
                setNavOpen(false)
                setHelpOpen(true)
              }}
              onBlur={() => setHelpOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-subtle text-sm font-semibold text-muted transition hover:border-cyan/40 hover:text-cyan"
              title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
            >
              ?
            </button>
            {helpOpen ? (
              <div
                id={helpPanelId}
                role="dialog"
                aria-label="Keyboard shortcuts"
                className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-subtle bg-[var(--surface-elevated)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              >
                <p className="label-caps text-[9px] text-dim">Shortcuts</p>
                <ul className="mt-2 space-y-1.5">
                  {shortcuts.map((row) => (
                    <li
                      key={`${row.keys}-${row.label}`}
                      className="flex items-baseline justify-between gap-3 text-[11px]"
                    >
                      <span className="data-mono text-cyan">{row.keys}</span>
                      <span className="text-right text-muted">{row.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {bottomLeftExtra}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {showBack ? (
            <button
              type="button"
              disabled={backDisabled}
              onClick={onBack}
              className="hud-pill border border-subtle px-4 py-2 text-sm text-foreground disabled:opacity-40"
            >
              Back
            </button>
          ) : null}
          {endSlot}
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={onPrimary}
            className="hud-pill bg-cyan px-6 py-2.5 text-sm font-bold tracking-wide text-[var(--on-accent)] shadow-[0_0_18px_var(--cyan-dim)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-high disabled:text-dim disabled:shadow-none"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function NavigatorButton({
  item,
  onClick,
}: {
  item: PracticeNavigatorItem
  onClick: () => void
}) {
  const label = item.index + 1
  const base =
    'data-mono flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold transition'
  let tone = 'bg-surface-high text-dim hover:text-foreground'
  if (item.state === 'current') {
    tone = 'bg-cyan text-[var(--on-accent)]'
  } else if (item.state === 'correct') {
    tone = 'bg-success/25 text-success ring-1 ring-[var(--glow-correct-border)]'
  } else if (item.state === 'incorrect') {
    tone = 'bg-alert/25 text-alert ring-1 ring-[var(--glow-wrong-border)]'
  } else if (item.state === 'answered') {
    tone = 'bg-cyan/20 text-cyan'
  } else if (item.state === 'blank') {
    tone = 'bg-surface-high text-dim ring-1 ring-dashed ring-subtle'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${tone}`}
      aria-current={item.state === 'current' ? 'true' : undefined}
    >
      {label}
    </button>
  )
}
