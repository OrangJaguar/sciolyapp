import { useState } from 'react'
import { copyText } from '../../lib/teams'

type Props = {
  studentCode: string
  coachCode: string
  title?: string
  body?: string
}

export function TeamInviteCodes({
  studentCode,
  coachCode,
  title = 'Invite codes',
  body = 'Share the student code with members. Share the coach invite only with people who should manage the team.',
}: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="label-caps text-dim">{title}</p>
        {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
      </div>
      <CodeRow
        label="Student invite"
        hint="Joins as a member"
        code={studentCode}
      />
      <CodeRow
        label="Coach invite"
        hint="Joins as a coach"
        code={coachCode}
      />
    </div>
  )
}

function CodeRow({
  label,
  hint,
  code,
}: {
  label: string
  hint: string
  code: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--ghost-border)] bg-surface px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-dim">{hint}</p>
        <p className="data-mono mt-1 text-lg tracking-[0.35em] text-cyan">
          {code}
        </p>
      </div>
      <button
        type="button"
        className="hud-pill px-4 py-2 text-xs text-foreground"
        onClick={() => {
          void (async () => {
            const ok = await copyText(code)
            if (ok) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }
          })()
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
