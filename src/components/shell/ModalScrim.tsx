import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-viewport dialog layer.
 * Rendered on document.body so the app header, footer, and their overflow
 * clipping cannot cover it. The layer itself scrolls, so a short screen can
 * reach the top and bottom of the dialog. A nested overflow region still
 * scrolls on its own while the pointer is inside it.
 */
export function ModalScrim({
  children,
  label,
  onClose,
  align = 'center',
}: {
  children: ReactNode
  label: string
  onClose?: () => void
  align?: 'center' | 'end' | 'stretch'
}) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-overlay backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={
          align === 'end'
            ? 'flex min-h-full justify-end'
            : align === 'stretch'
              ? 'flex h-dvh items-stretch justify-center p-3 sm:p-5'
              : 'flex min-h-full items-[safe_center] justify-center p-4 py-6'
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
