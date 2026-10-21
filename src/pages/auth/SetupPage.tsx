import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { SiteFooter } from '../../components/shell/SiteFooter'
import { TeamInviteCodes } from '../../components/team/TeamInviteCodes'
import { useAuth } from '../../features/auth/AuthProvider'
import { requireSupabase } from '../../lib/supabase'
import {
  JOIN_CODE_LENGTH,
  createTeam,
  normalizeJoinCode,
} from '../../lib/teams'
import { clientTimezone } from '../../lib/timezone'
import type { Division, Team } from '../../lib/types'

type Step = 1 | 2 | 3 | 4
type PathChoice = 'solo' | 'join' | 'create'

export function SetupPage() {
  const {
    ready,
    session,
    profile,
    profileStatus,
    refreshProfile,
    signOut,
  } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [handle, setHandle] = useState('')
  const [handleOk, setHandleOk] = useState<boolean | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [division, setDivision] = useState<Division>('C')
  const [schoolName, setSchoolName] = useState('')
  const [path, setPath] = useState<PathChoice>('solo')
  const [joinCode, setJoinCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createdTeam, setCreatedTeam] = useState<Team | null>(null)

  useEffect(() => {
    if (profile?.handle && !profile.handle.startsWith('recruit_')) {
      setHandle(profile.handle)
    }
    if (profile?.display_name) setDisplayName(profile.display_name)
    if (profile?.school_name) setSchoolName(profile.school_name)
    if (profile?.division) setDivision(profile.division)
  }, [profile?.handle, profile?.display_name, profile?.school_name, profile?.division])

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

  if (profileStatus === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-void text-muted">
        Loading profile…
      </div>
    )
  }

  if (profileStatus === 'missing' || !profile) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-void px-5 text-center">
        <p className="label-caps text-dim">Setup</p>
        <h1 className="text-xl font-bold text-foreground">
          Could not load profile
        </h1>
        <p className="max-w-sm text-sm text-muted">
          Retry loading your profile before continuing setup.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="hud-pill hud-pill-active px-5 py-2.5 text-sm"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="hud-pill px-5 py-2.5 text-sm text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  // Show invite codes before the onboarding_complete redirect can fire.
  if (createdTeam) {
    return (
      <div className="flex min-h-dvh flex-col bg-void">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
          <p className="label-caps mb-2 text-dim">Setup complete</p>
          <h1 className="font-display text-3xl tracking-tight text-foreground">
            {createdTeam.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            You’re the coach. Copy these invite codes — you’ll also find them in
            Comms → roster admin.
          </p>
          <div className="mt-8">
            <TeamInviteCodes
              studentCode={createdTeam.join_code_student}
              coachCode={createdTeam.join_code_admin}
            />
          </div>
          <button
            type="button"
            onClick={() => navigate('/cmd/missions', { replace: true })}
            className="hud-pill hud-pill-active mt-8 w-full py-3.5 text-sm font-bold"
          >
            Enter CMD
          </button>
        </div>
        <SiteFooter />
      </div>
    )
  }

  if (profile.onboarding_complete) {
    return <Navigate to="/cmd/missions" replace />
  }

  const nameOk = displayName.trim().length >= 1 && displayName.trim().length <= 48
  const schoolOk = schoolName.trim().length >= 1 && schoolName.trim().length <= 80
  const joinOk = path !== 'join' || joinCode.trim().length === JOIN_CODE_LENGTH
  const createOk =
    path !== 'create' ||
    (teamName.trim().length >= 2 &&
      teamName.trim().length <= 60 &&
      schoolName.trim().length >= 1)

  const finish = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!nameOk || !schoolOk || !joinOk || !createOk) return
    setBusy(true)
    try {
      const cleaned = handle.replace(/^@/, '').trim().toLowerCase()
      const { error: err } = await requireSupabase().rpc('complete_onboarding', {
        p_handle: cleaned,
        p_division: division,
        p_join_code: path === 'join' ? joinCode.trim() : null,
        p_display_name: displayName.trim(),
        p_school_name: schoolName.trim(),
        p_timezone: clientTimezone(),
      })
      if (err) throw err

      if (path === 'create') {
        const team = await createTeam({
          name: teamName.trim(),
          schoolName: schoolName.trim(),
          division,
        })
        setCreatedTeam(team)
        await refreshProfile()
        return
      }

      await refreshProfile()
      navigate('/cmd/missions', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  const stepTitle =
    step === 1
      ? 'Choose a handle'
      : step === 2
        ? 'Name & division'
        : step === 3
          ? 'Your school'
          : 'How are you joining?'

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
        <p className="label-caps mb-2 text-dim">
          Setup · Step {step} of 4
        </p>
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          Set up your profile
        </h1>
        <p className="mt-2 text-sm text-muted">{stepTitle}</p>

        {step === 1 && (
          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="label-caps text-dim">Handle</span>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--ghost-border)] bg-surface px-3 focus-within:border-cyan">
                <span className="text-muted">@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="operative_alpha"
                  className="w-full bg-transparent py-3 text-foreground outline-none"
                  autoComplete="username"
                />
              </div>
              <p className="mt-2 data-mono text-[11px] text-muted">
                3–24 characters · lowercase letters, numbers, underscore
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
              className="hud-pill hud-pill-active w-full py-3.5 text-sm font-bold disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="label-caps text-dim">Preferred name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What teammates should call you"
                maxLength={48}
                className="mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-3 text-foreground outline-none focus:border-cyan"
                autoComplete="nickname"
              />
            </label>
            <div>
              <p className="label-caps text-dim">Division</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(['B', 'C'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDivision(d)}
                    className={`hud-pill py-3.5 text-sm font-bold ${
                      division === d ? 'hud-pill-active' : 'text-foreground'
                    }`}
                  >
                    Division {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="hud-pill flex-1 py-3.5 text-sm text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!nameOk}
                onClick={() => setStep(3)}
                className="hud-pill hud-pill-active flex-1 py-3.5 text-sm font-bold disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="label-caps text-dim">School</span>
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. North High School"
                maxLength={80}
                className="mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-3 text-foreground outline-none focus:border-cyan"
                autoComplete="organization"
              />
              <p className="mt-2 text-xs text-dim">
                Used if you start a team later. You can edit this later.
              </p>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="hud-pill flex-1 py-3.5 text-sm text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!schoolOk}
                onClick={() => setStep(4)}
                className="hud-pill hud-pill-active flex-1 py-3.5 text-sm font-bold disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <form onSubmit={finish} className="mt-8 space-y-4">
            <PathCard
              selected={path === 'solo'}
              title="Practice solo"
              body="Study now. Join a team later with a code."
              onSelect={() => setPath('solo')}
            />
            <PathCard
              selected={path === 'join'}
              title="Join a team"
              body="Enter the code from your coach or captain."
              onSelect={() => setPath('join')}
            />
            <PathCard
              selected={path === 'create'}
              title="Start a team"
              body="Create the squad — you’ll be the coach."
              onSelect={() => setPath('create')}
            />

            {path === 'join' && (
              <label className="block pt-1">
                <span className="label-caps text-dim">
                  {JOIN_CODE_LENGTH}-character team code
                </span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(normalizeJoinCode(e.target.value))}
                  maxLength={JOIN_CODE_LENGTH}
                  className="data-mono mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-3 tracking-[0.35em] text-foreground outline-none focus:border-cyan"
                  placeholder="ABC123"
                  required
                />
                <p className="mt-2 text-xs text-dim">
                  Ask your coach for the student code. A coach invite code makes
                  you a coach on that team.
                </p>
              </label>
            )}

            {path === 'create' && (
              <label className="block pt-1">
                <span className="label-caps text-dim">Team name</span>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. North High Varsity"
                  className="mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-3 text-foreground outline-none focus:border-cyan"
                  required
                />
                <p className="mt-2 text-xs text-dim">
                  School will be saved as{' '}
                  <span className="text-muted">{schoolName.trim() || '—'}</span>
                  .
                </p>
              </label>
            )}

            {error && <p className="text-sm text-alert">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="hud-pill flex-1 py-3.5 text-sm text-foreground"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy || !joinOk || !createOk}
                className="hud-pill hud-pill-active flex-1 py-3.5 text-sm font-bold disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Finish setup'}
              </button>
            </div>
          </form>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}

function PathCard({
  selected,
  title,
  body,
  onSelect,
}: {
  selected: boolean
  title: string
  body: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-4 py-4 text-left transition ${
        selected
          ? 'border-cyan bg-cyan/10 shadow-[0_0_18px_var(--accent-dim)]'
          : 'border-[var(--ghost-border)] bg-surface hover:border-cyan/40'
      }`}
    >
      <p
        className={`font-display text-base ${
          selected ? 'text-cyan' : 'text-foreground'
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </button>
  )
}
