import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AvatarPickerModal } from '../../components/profile/AvatarPickerModal'
import { RankLadderTip } from '../../components/profile/RankLadderTip'
import { ThemePicker } from '../../components/profile/ThemePicker'
import { useAuth } from '../../features/auth/AuthProvider'
import { AvatarMark } from '../../lib/avatars'
import {
  BadgeMark,
  HIDDEN_BADGES,
  VISIBLE_BADGES,
  badgeProgressCurrent,
  fetchMyBadges,
  syncMyBadges,
  type BadgeDef,
  type BadgeStats,
} from '../../lib/badges'
import {
  DAILY_PRACTICE_XP_CAP,
  formatXp,
  profileToHud,
  rankAccentClass,
  xpProgress,
  xpToNextLevel,
} from '../../lib/progression'
import { isSupabaseConfigured } from '../../lib/supabase'

export function ProfilePage() {
  const { profile, signOut, configured, user, refreshProfile } = useAuth()
  const qc = useQueryClient()
  const hud = profileToHud(profile)
  const userId = user?.id ?? profile?.id ?? null
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [badgeStats, setBadgeStats] = useState<BadgeStats | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return
    let cancelled = false
    void (async () => {
      try {
        const sync = await syncMyBadges()
        if (cancelled) return
        setBadgeStats(sync.stats)
        setSyncNote(null)
        await refreshProfile()
        await qc.invalidateQueries({ queryKey: ['my-badges', userId] })
      } catch (err) {
        // Soft note only — shelf still loads via fetchMyBadges
        if (!cancelled) {
          console.warn('sync_my_badges', err)
          setSyncNote("Couldn't refresh unlocks — shelf may be slightly stale.")
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
  const earnedVisible = VISIBLE_BADGES.filter((b) => earned.has(b.id)).length
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
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="label-caps text-dim">Operative</p>
          <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            {profile.display_name?.trim() || `@${hud.handle}`}
          </h1>
          <p className="text-sm text-muted">
            @{hud.handle} · Div {profile.division}
            {profile.team_id ? ' · Team linked' : ' · Practice solo'}
            {profile.school_name?.trim()
              ? ` · ${profile.school_name.trim()}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label="Change profile picture"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cyan/40 bg-void text-cyan shadow-[0_0_18px_var(--accent-dim)] transition-colors hover:border-cyan"
        >
          <AvatarMark avatarId={profile.avatar_id} className="h-9 w-9" />
        </button>
      </header>

      <AvatarPickerModal
        open={pickerOpen}
        currentAvatarId={profile.avatar_id}
        earned={new Set(earned.keys())}
        onClose={() => setPickerOpen(false)}
        onSaved={refreshProfile}
      />

      <section
        className={`hud-panel relative z-10 space-y-4 border p-5 ${rankAccentClass(hud.rankName)}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps text-dim">Rank</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-display text-xl text-cyan">
              <span>{hud.rankName}</span>
              <RankLadderTip currentRank={hud.rankName} />
              <span className="data-mono inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-cyan/45 bg-cyan/10 px-1.5 text-base font-semibold text-cyan">
                {hud.level}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps text-dim">Total XP</p>
            <p className="mt-1 data-mono text-lg text-foreground">
              {formatXp(xp)}
              {toNext > 0 ? (
                <span className="text-sm text-dim">
                  {' '}
                  · {formatXp(toNext)} to next
                </span>
              ) : null}
            </p>
          </div>
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
          <Stat label="Level" value={String(hud.level)} />
          <Stat label="Streak" value={`${hud.streak}d`} accent={hud.streak > 0} />
          <Stat
            label="Badges"
            value={`${earnedVisible}/${VISIBLE_BADGES.length}`}
          />
          <Stat
            label="Practice today"
            value={`${hud.practiceXpBaseToday}/${DAILY_PRACTICE_XP_CAP}`}
            accent={hud.practiceXpBaseToday >= DAILY_PRACTICE_XP_CAP}
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
            One-time milestone XP outside the daily practice cap. No shop.
          </p>
        </div>

        {syncNote ? (
          <p className="rounded-lg border border-subtle bg-[var(--surface-elevated)] px-3 py-2 text-xs text-dim">
            {syncNote}
          </p>
        ) : null}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {VISIBLE_BADGES.map((def) => (
            <BadgeCard
              key={def.id}
              def={def}
              earnedAt={earned.get(def.id) ?? null}
              stats={badgeStats}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3 pb-2">
        <div>
          <p className="label-caps text-dim">Classified</p>
          <p className="mt-1 text-sm text-muted">
            Hidden milestones. Criteria stay sealed until unlock.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HIDDEN_BADGES.map((def) => (
            <BadgeCard
              key={def.id}
              def={def}
              earnedAt={earned.get(def.id) ?? null}
              stats={badgeStats}
            />
          ))}
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

function BadgeCard({
  def,
  earnedAt,
  stats,
}: {
  def: BadgeDef
  earnedAt: string | null
  stats: BadgeStats | null
}) {
  const unlocked = Boolean(earnedAt)
  const classifiedLocked = def.hidden && !unlocked
  const current = badgeProgressCurrent(def, stats)
  const showProgress =
    !unlocked && !def.hidden && def.progress != null && current != null

  return (
    <li
      className={`flex gap-3 rounded-xl border px-4 py-3 ${
        unlocked
          ? 'border-cyan/35 bg-cyan/5'
          : classifiedLocked
            ? 'border-subtle bg-[var(--surface-hover)]'
            : 'border-subtle bg-[var(--surface-hover)] opacity-80'
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${
          unlocked ? 'border-cyan/40 bg-void' : 'border-subtle bg-void'
        }`}
      >
        <BadgeMark
          id={def.id}
          earned={unlocked}
          classified={classifiedLocked}
          className="h-9 w-9"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-display text-sm ${
            unlocked ? 'text-foreground' : 'text-muted'
          }`}
        >
          {classifiedLocked ? 'CLASSIFIED' : def.name}
        </p>
        <p className="mt-0.5 text-xs text-dim">
          {classifiedLocked
            ? 'Sealed criteria'
            : unlocked
              ? def.blurb
              : def.how}
        </p>
        {showProgress ? (
          <p className="mt-1 data-mono text-[10px] text-cyan/80">
            {Math.min(current, def.progress!.target)} / {def.progress!.target}
          </p>
        ) : null}
        {unlocked && earnedAt ? (
          <p className="mt-1 data-mono text-[10px] text-cyan/80">
            {new Date(earnedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            {def.xp > 0 ? ` · +${def.xp} XP` : ''}
          </p>
        ) : !showProgress && !classifiedLocked ? (
          <p className="mt-1 label-caps text-[10px] text-dim">
            Locked{def.xp > 0 ? ` · +${def.xp} XP` : ''}
          </p>
        ) : classifiedLocked ? (
          <p className="mt-1 label-caps text-[10px] text-dim">Classified</p>
        ) : null}
      </div>
    </li>
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
