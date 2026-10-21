import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminListCoachVerifications,
  adminReviewCoachVerification,
  type CoachVerificationStatus,
} from '../../lib/coachVerify'
import { isSupabaseConfigured } from '../../lib/supabase'

type Filter = CoachVerificationStatus | 'all'

export function CoachesPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('pending')
  const [error, setError] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['admin-coach-verifications', filter],
    queryFn: () => adminListCoachVerifications(filter),
    enabled: isSupabaseConfigured,
  })

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: 'approved' | 'rejected'
    }) => adminReviewCoachVerification(id, status),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['admin-coach-verifications'] })
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Review failed'),
  })

  if (!isSupabaseConfigured) {
    return (
      <div className="hud-panel flex h-full items-center justify-center p-6 text-sm text-muted">
        Configure Supabase to review coach verifications.
      </div>
    )
  }

  const rows = listQuery.data ?? []

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-5">
      <header className="shrink-0 space-y-1">
        <p className="label-caps text-dim">Trust</p>
        <h1 className="font-display text-2xl text-foreground">
          Coach verification
        </h1>
        <p className="text-sm text-muted">
          Light review only — approving marks the team verified. Unverified
          coaches can still run their team.
        </p>
      </header>

      <div className="flex shrink-0 flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`hud-pill px-4 py-2 text-xs font-bold capitalize ${
              filter === f ? 'hud-pill-active' : 'text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-alert">{error}</p> : null}
      {listQuery.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : null}
      {listQuery.error ? (
        <p className="text-sm text-alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : 'Failed to load'}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {rows.length === 0 && !listQuery.isLoading ? (
          <p className="text-sm text-dim">No requests in this filter.</p>
        ) : null}
        {rows.map((row) => (
          <article
            key={row.id}
            className="hud-panel space-y-3 border border-subtle p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {row.display_name?.trim() || `@${row.handle}`}
                </p>
                <p className="text-sm text-muted">
                  @{row.handle}
                  {row.team_name ? ` · ${row.team_name}` : ''}
                </p>
                <p className="mt-1 text-sm text-dim">{row.school_name}</p>
              </div>
              <span className="data-mono text-[10px] uppercase text-cyan">
                {row.status}
              </span>
            </div>
            {row.note ? (
              <p className="text-sm leading-relaxed text-muted">{row.note}</p>
            ) : (
              <p className="text-sm text-dim">No note provided.</p>
            )}
            <p className="data-mono text-[10px] text-dim">
              Submitted {new Date(row.created_at).toLocaleString()}
              {row.reviewed_at
                ? ` · Reviewed ${new Date(row.reviewed_at).toLocaleString()}`
                : ''}
            </p>
            {row.status === 'pending' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ id: row.id, status: 'approved' })
                  }
                  className="hud-pill hud-pill-active px-5 py-2 text-xs"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ id: row.id, status: 'rejected' })
                  }
                  className="hud-pill px-5 py-2 text-xs text-alert"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}
