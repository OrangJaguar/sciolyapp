import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RedirectIfAuthed } from '../../components/auth/RouteGuards'
import { SiteFooter } from '../../components/shell/SiteFooter'
import { isSupabaseConfigured, requireSupabase } from '../../lib/supabase'

export function LoginPage() {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  )
}

function LoginForm() {
  const [params] = useSearchParams()
  const initial: 'signin' | 'signup' =
    params.get('mode') === 'signup' ? 'signup' : 'signin'
  const [mode, setMode] = useState<'signin' | 'signup'>(initial)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!isSupabaseConfigured) {
      setError(
        'Supabase keys missing. Create .env.local from .env.example, paste your URL + anon key, restart npm run dev. Full steps: docs/SUPABASE_SETUP.md',
      )
      return
    }

    setBusy(true)
    try {
      const client = requireSupabase()
      if (mode === 'signin') {
        const { error: err } = await client.auth.signInWithPassword({
          email,
          password,
        })
        if (err) throw err
      } else {
        const { data, error: err } = await client.auth.signUp({ email, password })
        if (err) throw err
        if (data.session) {
          // email confirm off → session exists → setup wizard next
          return
        }
        if (data.user && !data.session) {
          setInfo(
            'Account created. If email confirmation is ON in Supabase, check your inbox, then sign in. For local testing, turn Confirm email OFF (see docs/SUPABASE_SETUP.md).',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    if (!isSupabaseConfigured) {
      setError('Add Supabase keys to .env.local first. See docs/SUPABASE_SETUP.md')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/cmd/missions` },
      })
      if (err) throw err
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">
        <p className="label-caps mb-2">scioly.app</p>
        <h1 className="text-3xl font-bold tracking-wide text-foreground uppercase">
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Team ops + practice. Sign up here first if you are new.
        </p>

        <div className="mt-6 flex rounded-pill border border-[var(--ghost-border)] bg-surface-elevated p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 cursor-pointer rounded-pill py-2 text-xs font-bold tracking-[0.14em] ${
              mode === 'signin' ? 'bg-cyan text-[var(--on-accent)]' : 'text-muted'
            }`}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 cursor-pointer rounded-pill py-2 text-xs font-bold tracking-[0.14em] ${
              mode === 'signup' ? 'bg-cyan text-[var(--on-accent)]' : 'text-muted'
            }`}
          >
            SIGN UP
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-md border border-alert/50 bg-alert/10 px-4 py-3 text-sm text-alert">
            Auth is not connected yet. Follow{' '}
            <span className="data-mono">docs/SUPABASE_SETUP.md</span> — you need
            a <span className="data-mono">.env.local</span> file before signup
            works.
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="label-caps text-[var(--text-muted)]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-2.5 text-foreground outline-none focus:border-accent"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="label-caps text-[var(--text-muted)]">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-2.5 text-foreground outline-none focus:border-accent"
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
            />
          </label>

          {error && <p className="text-sm text-alert">{error}</p>}
          {info && <p className="text-sm text-success">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="hud-pill hud-pill-active w-full cursor-pointer py-3 text-sm disabled:opacity-60"
          >
            {busy ? '…' : mode === 'signin' ? 'Enter' : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="hud-pill mt-3 w-full cursor-pointer py-3 text-sm text-foreground"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-dim">
          Direct link:{' '}
          <Link to="/login?mode=signup" className="text-cyan">
            /login?mode=signup
          </Link>
        </p>
      </div>
      <SiteFooter />
    </div>
  )
}
