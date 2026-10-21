import { useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import type { Team } from '../../lib/types'
import { CreateTeamCard } from './CreateTeamCard'
import { JoinTeamCard } from './JoinTeamCard'
import { TeamInviteCodes } from './TeamInviteCodes'

type Mode = 'join' | 'create'

type Props = {
  /** One line: why this screen needs a team */
  reason: string
  onReady?: () => void | Promise<void>
}

export function NoTeamPanel({ reason, onReady }: Props) {
  const { profile, refreshProfile } = useAuth()
  const [mode, setMode] = useState<Mode>('join')
  const [created, setCreated] = useState<Team | null>(null)

  if (created) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
        <div className="hud-panel space-y-5 p-6">
          <div>
            <p className="label-caps text-dim">Team created</p>
            <h1 className="mt-2 text-2xl font-medium text-foreground">
              {created.name}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Save these codes now — you can also find them later in Comms roster
              admin.
            </p>
          </div>
          <TeamInviteCodes
            studentCode={created.join_code_student}
            coachCode={created.join_code_admin}
          />
          <button
            type="button"
            className="hud-pill hud-pill-active w-full py-3 text-sm font-bold"
            onClick={() => {
              void (async () => {
                await refreshProfile()
                await onReady?.()
              })()
            }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
      <div className="hud-panel p-6">
        <p className="label-caps">No team yet</p>
        <h1 className="mt-2 text-2xl font-medium text-foreground">
          Practice solo
        </h1>
        <p className="mt-2 text-sm text-muted">{reason}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`hud-pill py-2.5 text-sm font-bold ${
              mode === 'join' ? 'hud-pill-active' : 'text-foreground'
            }`}
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`hud-pill py-2.5 text-sm font-bold ${
              mode === 'create' ? 'hud-pill-active' : 'text-foreground'
            }`}
          >
            Start a team
          </button>
        </div>

        <div className="mt-5">
          {mode === 'join' ? (
            <JoinTeamCard
              onJoined={async () => {
                await refreshProfile()
                await onReady?.()
              }}
            />
          ) : (
            <CreateTeamCard
              defaultSchool={profile?.school_name}
              defaultDivision={profile?.division}
              onCreated={async (team) => {
                setCreated(team)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
