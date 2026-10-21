import { useEffect, useState, type FormEvent } from 'react'
import { createTeam } from '../../lib/teams'
import type { Division, Team } from '../../lib/types'

type Props = {
  defaultSchool?: string | null
  defaultDivision?: Division | null
  onCreated?: (team: Team) => void | Promise<void>
}

export function CreateTeamCard({
  defaultSchool,
  defaultDivision,
  onCreated,
}: Props) {
  const [name, setName] = useState('')
  const [school, setSchool] = useState(defaultSchool?.trim() ?? '')
  const [division, setDivision] = useState<Division>(defaultDivision ?? 'C')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!school.trim() && defaultSchool?.trim()) {
      setSchool(defaultSchool.trim())
    }
  }, [defaultSchool, school])

  useEffect(() => {
    if (defaultDivision) setDivision(defaultDivision)
  }, [defaultDivision])

  const nameOk = name.trim().length >= 2 && name.trim().length <= 60
  const schoolOk = school.trim().length >= 1 && school.trim().length <= 80

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!nameOk || !schoolOk) return
    setBusy(true)
    try {
      const team = await createTeam({
        name: name.trim(),
        schoolName: school.trim(),
        division,
      })
      await onCreated?.(team)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create team')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="label-caps text-dim">Team name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. North High Varsity"
          className="mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-void px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan"
        />
      </label>
      <label className="block">
        <span className="label-caps text-dim">School</span>
        <input
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          maxLength={80}
          placeholder="e.g. North High School"
          className="mt-2 w-full rounded-md border border-[var(--ghost-border)] bg-void px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan"
        />
      </label>
      <div>
        <p className="label-caps text-dim">Division</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['B', 'C'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDivision(d)}
              className={`hud-pill py-2.5 text-sm font-bold ${
                division === d ? 'hud-pill-active' : 'text-foreground'
              }`}
            >
              Div {d}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-dim">
        You’ll be the coach. You’ll get a student invite code and a coach invite
        code after create.
      </p>
      {error ? <p className="text-sm text-alert">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !nameOk || !schoolOk}
        className="hud-pill hud-pill-active w-full py-3 text-sm font-bold disabled:opacity-40"
      >
        {busy ? 'Creating…' : 'Start team'}
      </button>
    </form>
  )
}
