import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  BADGE_CATALOG,
  BadgeMark,
  fetchMyBadges,
  syncMyBadges,
  type BadgeId,
} from '../../lib/badges'
import {
  formatXp,
  profileToHud,
  xpProgress,
  xpToNextLevel,
} from '../../lib/progression'
import { isSupabaseConfigured } from '../../lib/supabase'
import { ThemePicker } from '../../components/profile/ThemePicker'

export function ProfilePage() {
  const { profile, signOut, configured, user, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const hud = profileToHud(profile)
  const userId = user?.id ?? profile?.id ?? null
  const [syncNote, setSyncNote] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return
    let cancelled = false
    void (async () => {
      try {
        await syncMyBadges()
        if (cancelled) return
        setSyncNote(null)
        await refreshProfile()
        await qc.invalidateQueries({ queryKey: ['my-badges', userId] })
      } catch (err) {
        if (!cancelled) {
          setSyncNote(
            err instanceof Error
              ? err.message
              : 'Badge sync unavailable — run SCIOLY-0804-BADGES SQL?',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, refreshProfile, qc])

  const badgesQuery = useQuery({
    queryKey: ['my-badges', userId],
    queryFn: () => fetchMyBadges(userId!),
    enabled: isSupabaseConfigured && Boolean(userId),
  })

  const earned = new Map(
    (badgesQuery.data ?? []).map((r) => [r.badge_id, r.earned_at]),
  )
  const earnedCount = BADGE_CATALOG.filter((b) => earned.has(b.id)).length
  const xp = profile?.xp ?? 0
  const toNext = xpToNextLevel(xp)
  const progressPct = Math.round(xpProgress(xp) * 100)

  if (!configured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to load profile.
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        No profile yet — finish setup.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-5 overflow-y-auto">
      <header className="space-y-1">
        <p className="label-caps text-dim">Operative</p>
        <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          @{hud.handle}
        </h1>
        <p className="text-sm text-muted">
          Div {profile.division}
          {profile.team_id ? ' · Team linked' : ' · Freelancer'}
        </p>
      </header>

      <section className="hud-panel space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps text-dim">Rank / XP</p>
            <p className="mt-1 font-display text-xl text-cyan">{hud.rankTitle}</p>
          </div>
          <p className="data-mono text-sm text-muted">
            {formatXp(xp)} XP
            {toNext > 0 ? (
              <span className="text-dim"> · {formatXp(toNext)} to next</span>
            ) : null}
          </p>
        </div>
        <div
          className="xp-stripes h-3 overflow-hidden rounded-full bg-[var(--surface)]"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="XP progress in level"
        >
          <div
            className="h-full rounded-full bg-[repeating-linear-gradient(90deg,var(--cyan)_0_8px,transparent_8px_12px)] transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-6 border-t border-subtle pt-4">
          <Stat label="Streak" value={`${hud.streak}d`} accent={hud.streak > 0} />
          <Stat
            label="Badges"
            value={`${earnedCount}/${BADGE_CATALOG.length}`}
          />
        </div>
      </section>

      <section className="hud-panel p-5">
        <p className="label-caps text-dim">Appearance</p>
        <p className="mt-1 text-sm text-muted">Choose a visual theme for the app.</p>
        <ThemePicker />
      </section>

      <section className="space-y-3">
        <div>
          <p className="label-caps text-dim">Badge shelf</p>
          <p className="mt-1 text-sm text-muted">
            Milestones from grind — no shop, no badge XP.
          </p>
        </div>

        {syncNote ? (
          <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
            {syncNote}
          </p>
        ) : null}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BADGE_CATALOG.map((b) => {
            const at = earned.get(b.id)
            const unlocked = Boolean(at)
            return (
              <li
                key={b.id}
                className={`flex gap-3 rounded-xl border px-4 py-3 ${
                  unlocked
                    ? 'border-cyan/35 bg-cyan/5'
                    : 'border-subtle bg-[var(--surface-hover)] opacity-70'
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
                    unlocked ? 'border-cyan/40 bg-void' : 'border-subtle bg-void'
                  }`}
                >
                  <BadgeMark id={b.id as BadgeId} earned={unlocked} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-display text-sm ${
                      unlocked ? 'text-foreground' : 'text-muted'
                    }`}
                  >
                    {b.name}
                  </p>
                  <p className="mt-0.5 text-xs text-dim">
                    {unlocked ? b.blurb : b.how}
                  </p>
                  {unlocked && at ? (
                    <p className="mt-1 data-mono text-[10px] text-cyan/80">
                      {new Date(at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  ) : (
                    <p className="mt-1 label-caps text-[10px] text-dim">Locked</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3 pb-4 pt-2">
        {profile.platform_role === 'admin' ? (
          <Link to="/admin" className="hud-pill px-6 py-2 text-sm text-cyan">
            Admin Factory
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
          className="hud-pill px-6 py-2 text-sm text-foreground"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="label-caps text-dim">{label}</p>
      <p
        className={`mt-1 data-mono text-lg ${accent ? 'text-cyan' : 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  )
}
