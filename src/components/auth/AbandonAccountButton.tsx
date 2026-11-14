import { useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { unknownErrorText } from '../../lib/teams'
import { requireSupabase } from '../../lib/supabase'

/**
 * Log out for a profile that never finished setup.
 * Confirms, deletes that auth user, then clears the saved login.
 */
export function AbandonAccountButton() {
  const { signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await requireSupabase().rpc(
        'abandon_incomplete_account',
      )
      if (rpcError) throw rpcError
      await signOut()
    } catch (err) {
      setError(unknownErrorText(err, 'Could not delete this account'))
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="hud-pill px-5 py-2.5 text-sm text-alert disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete account'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          className="text-sm text-muted transition-colors hover:text-cyan disabled:opacity-40"
        >
          Keep it
        </button>
        {error && (
          <span className="basis-full text-sm text-alert">{error}</span>
        )}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="hud-pill px-5 py-2.5 text-sm text-foreground"
    >
      Log out
    </button>
  )
}
