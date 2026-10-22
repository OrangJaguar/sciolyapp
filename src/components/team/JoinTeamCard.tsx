import { useState, type FormEvent } from 'react'
import {
  JOIN_CODE_LENGTH,
  isValidJoinCode,
  joinTeamByCode,
  normalizeJoinCode,
  unknownErrorText,
} from '../../lib/teams'

type Props = {
  onJoined?: () => void | Promise<void>
  compact?: boolean
}

export function JoinTeamCard({ onJoined, compact }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidJoinCode(code)) {
      setError(`Enter the full ${JOIN_CODE_LENGTH}-character code`)
      return
    }
    setBusy(true)
    try {
      await joinTeamByCode(code)
      setCode('')
      await onJoined?.()
    } catch (err) {
      setError(unknownErrorText(err, 'Join failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={compact ? 'space-y-3' : 'space-y-4'}>
      <label className="block">
        <span className="label-caps text-dim">Team code</span>
        <input
          value={code}
          onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
          maxLength={JOIN_CODE_LENGTH}
          placeholder="ABC123"
          autoComplete="off"
          className="data-mono mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-void px-3 py-2.5 tracking-[0.35em] text-foreground outline-none focus:border-cyan"
        />
        <p className="mt-2 text-xs text-dim">
          Use the student code. A coach promotes you to officer afterward.
          The coach code makes you a coach.
        </p>
      </label>
      {error ? <p className="text-sm text-alert">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !isValidJoinCode(code)}
        className="hud-pill hud-pill-active w-full py-3 text-sm font-bold disabled:opacity-40"
      >
        {busy ? 'Joining…' : 'Join team'}
      </button>
    </form>
  )
}
