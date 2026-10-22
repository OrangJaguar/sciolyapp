import { useEffect, useState, type ReactNode } from 'react'
import { BADGE_CATALOG, BadgeMark } from '../../lib/badges'
import {
  DEFAULT_AVATARS,
  AvatarMark,
  badgeAvatarId,
  badgeIdFromAvatar,
  defaultAvatarId,
  resolveAvatarKey,
  setMyAvatar,
} from '../../lib/avatars'

type AvatarPickerModalProps = {
  open: boolean
  currentAvatarId: string
  earned: ReadonlySet<string>
  onClose: () => void
  onSaved: () => Promise<unknown> | void
}

export function AvatarPickerModal({
  open,
  currentAvatarId,
  earned,
  onClose,
  onSaved,
}: AvatarPickerModalProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const currentBadge = badgeIdFromAvatar(currentAvatarId)
  const currentDefault = currentBadge ? null : resolveAvatarKey(currentAvatarId)

  const pick = async (avatarId: string) => {
    if (busyId) return
    setError(null)
    setBusyId(avatarId)
    try {
      await setMyAvatar(avatarId)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save picture')
    } finally {
      setBusyId(null)
    }
  }

  const visible = BADGE_CATALOG.filter((b) => !b.hidden)
  const earnedHidden = BADGE_CATALOG.filter((b) => b.hidden && earned.has(b.id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(40rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div>
            <p className="label-caps text-dim">Operative</p>
            <h2
              id="avatar-picker-title"
              className="font-display text-xl text-foreground"
            >
              Profile picture
            </h2>
            <p className="mt-1 text-sm text-muted">
              Standard marks are always available. Badge portraits unlock when
              you earn that badge.
            </p>
          </div>
          <button
            type="button"
            className="hud-pill px-3 py-1.5 text-xs"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section>
            <p className="label-caps text-dim">Standard</p>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {DEFAULT_AVATARS.map((avatar) => {
                const id = defaultAvatarId(avatar.key)
                return (
                  <Choice
                    key={avatar.key}
                    label={avatar.label}
                    selected={currentDefault === avatar.key}
                    busy={busyId === id}
                    onPick={() => void pick(id)}
                  >
                    <AvatarMark avatarId={id} className="h-8 w-8" />
                  </Choice>
                )
              })}
            </ul>
          </section>

          <section>
            <p className="label-caps text-dim">Earned badges</p>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visible.map((badge) => {
                const unlocked = earned.has(badge.id)
                const id = badgeAvatarId(badge.id)
                return (
                  <Choice
                    key={badge.id}
                    label={badge.name}
                    selected={currentBadge === badge.id}
                    locked={!unlocked}
                    busy={busyId === id}
                    onPick={() => {
                      if (!unlocked) return
                      void pick(id)
                    }}
                  >
                    <BadgeMark
                      id={badge.id}
                      earned={unlocked}
                      className="h-8 w-8"
                    />
                  </Choice>
                )
              })}
              {earnedHidden.map((badge) => {
                const id = badgeAvatarId(badge.id)
                return (
                  <Choice
                    key={badge.id}
                    label={badge.name}
                    selected={currentBadge === badge.id}
                    busy={busyId === id}
                    onPick={() => void pick(id)}
                  >
                    <BadgeMark id={badge.id} earned className="h-8 w-8" />
                  </Choice>
                )
              })}
            </ul>
          </section>

          {error ? <p className="text-sm text-alert">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

function Choice({
  label,
  selected,
  locked,
  busy,
  onPick,
  children,
}: {
  label: string
  selected: boolean
  locked?: boolean
  busy?: boolean
  onPick: () => void
  children: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        disabled={locked || busy}
        onClick={onPick}
        title={locked ? `${label} — locked` : label}
        aria-label={locked ? `${label}, locked` : label}
        aria-pressed={selected}
        className={`flex w-full flex-col items-center gap-1.5 rounded-xl border px-1 py-2 text-cyan transition-colors ${
          selected
            ? 'border-cyan bg-cyan/15 shadow-[0_0_18px_var(--accent-dim)]'
            : 'border-subtle bg-void'
        } ${locked ? 'cursor-not-allowed text-dim opacity-45' : 'hover:border-cyan/50'} disabled:cursor-not-allowed`}
      >
        {children}
        <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted">
          {label}
        </span>
      </button>
    </li>
  )
}
