import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { requireSupabase } from '../../lib/supabase'
import type { Division } from '../../lib/types'
import { SiteFooter } from '../../components/shell/SiteFooter'

type Step = 1 | 2 | 3

export function SetupPage() {
  const { ready, session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [handle, setHandle] = useState('')
  const [handleOk, setHandleOk] = useState<boolean | null>(null)
  const [division, setDivision] = useState<Division>('C')
  const [joinCode, setJoinCode] = useState('')
  const [freelancer, setFreelancer] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile?.handle && !profile.handle.startsWith('recruit_')) {
      setHandle(profile.handle)
    }
  }, [profile?.handle])

  useEffect(() => {
    const cleaned = handle.replace(/^@/, '').trim().toLowerCase()
    if (cleaned.length < 3) {
      setHandleOk(null)
      return
    }
    const t = window.setTimeout(async () => {
      try {
        const { data, error: err } = await requireSupabase().rpc(
          'is_handle_available',
          { p_handle: cleaned },
        )
        if (err) throw err
        setHandleOk(Boolean(data))
      } catch {
        setHandleOk(null)
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [handle])

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void text-muted">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (profile?.onboarding_complete) {
    return <Navigate to="/cmd/missions" replace />
  }

  const finish = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const cleaned = handle.replace(/^@/, '').trim().toLowerCase()
      const { error: err } = await requireSupabase().rpc('complete_onboarding', {
        p_handle: cleaned,
        p_division: division,
        p_join_code: freelancer ? null : joinCode.trim() || null,
      })
      if (err) throw err
      await refreshProfile()
      navigate('/cmd/missions', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-void">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5">
        <p className="label-caps mb-2">Setup · Step {step}/3</p>
        <h1 className="text-3xl font-bold tracking-wide text-foreground uppercase">
          Deploy Profile
        </h1>

        {step === 1 && (
          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="label-caps text-[var(--text-muted)]">Handle</span>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-[var(--ghost-border)] bg-surface px-3 focus-within:border-cyan">
                <span className="text-muted">@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="operative_alpha"
                  className="w-full bg-transparent py-2.5 text-foreground outline-none"
                  autoComplete="username"
                />
              </div>
              <p className="mt-2 data-mono text-[11px] text-muted">
                3–24 chars · a-z · 0-9 · underscore
                {handleOk === true && (
                  <span className="text-success"> · available</span>
                )}
                {handleOk === false && (
                  <span className="text-alert"> · taken</span>
                )}
              </p>
            </label>
            <button
              type="button"
              disabled={handleOk !== true}
              onClick={() => setStep(2)}
              className="hud-pill hud-pill-active w-full py-3 text-sm disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted">Classification</p>
            <div className="grid grid-cols-2 gap-3">
              {(['B', 'C'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDivision(d)}
                  className={`hud-pill py-4 text-sm ${
                    division === d ? 'hud-pill-active' : 'text-foreground'
                  }`}
                >
                  Division {d}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="hud-pill flex-1 py-3 text-sm text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="hud-pill hud-pill-active flex-1 py-3 text-sm"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={finish} className="mt-8 space-y-4">
            <p className="text-sm text-muted">Deployment</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFreelancer(true)}
                className={`hud-pill py-4 text-sm ${
                  freelancer ? 'hud-pill-active' : 'text-foreground'
                }`}
              >
                Freelancer
              </button>
              <button
                type="button"
                onClick={() => setFreelancer(false)}
                className={`hud-pill py-4 text-sm ${
                  !freelancer ? 'hud-pill-active' : 'text-foreground'
                }`}
              >
                Join Team
              </button>
            </div>

            {!freelancer && (
              <label className="block">
                <span className="label-caps text-[var(--text-muted)]">
                  6-digit join code
                </span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="data-mono mt-1 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-2.5 tracking-[0.3em] text-foreground outline-none focus:border-accent"
                  placeholder="ABC123"
                  required={!freelancer}
                />
              </label>
            )}

            {error && <p className="text-sm text-alert">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="hud-pill flex-1 py-3 text-sm text-foreground"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy || (!freelancer && joinCode.trim().length !== 6)}
                className="hud-pill hud-pill-active flex-1 py-3 text-sm disabled:opacity-40"
              >
                {busy ? '…' : 'Enter System'}
              </button>
            </div>
          </form>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}
