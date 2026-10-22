import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgeMark, badgeName, badgeXp } from '../../lib/badges'
import { XP_AWARDS } from '../../lib/progression'
import type { NewlyUnlockedBadge } from '../../lib/practiceCommit'
import { supabase } from '../../lib/supabase'
import { clientTimezone } from '../../lib/timezone'

export type ClinicPayload = {
  conceptId: string
  conceptName: string
  sessionToken: string
  lastStem?: string
}

type GuideRow = {
  concept_id: string
  read_body: string
  see_html: string | null
  status: string
  do_prompt: string | null
  do_options: Record<string, string> | null
  do_correct_key: string | null
}

type ConceptRow = {
  id: string
  name: string
  description: string
}

/**
 * Legacy pause for the demo. See / Do clinic code stays; it never opens.
 * Set this to true when concept guides are ready to bring Clinic back.
 */
export const CLINIC_ENABLED = false

type Step = 'read' | 'see' | 'do'

const DO_OPTIONS = ['A', 'B', 'C'] as const

async function fetchClinicContent(conceptId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const [guideRes, conceptRes] = await Promise.all([
    supabase
      .from('concept_guides')
      .select(
        'concept_id, read_body, see_html, status, do_prompt, do_options, do_correct_key',
      )
      .eq('concept_id', conceptId)
      .eq('status', 'live')
      .maybeSingle(),
    supabase
      .from('taxonomy_concepts')
      .select('id, name, description')
      .eq('id', conceptId)
      .maybeSingle(),
  ])

  if (guideRes.error) throw guideRes.error
  if (conceptRes.error) throw conceptRes.error

  return {
    guide: guideRes.data as GuideRow | null,
    concept: conceptRes.data as ConceptRow | null,
  }
}

async function awardClinicDo(conceptId: string, sessionToken: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('complete_clinic_do', {
    p_concept_id: conceptId,
    p_session_token: sessionToken,
    p_timezone: clientTimezone(),
  })
  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  const rawUnlocks = row.newly_unlocked
  const newly_unlocked: NewlyUnlockedBadge[] = Array.isArray(rawUnlocks)
    ? rawUnlocks
        .map((u) => {
          if (!u || typeof u !== 'object') return null
          const o = u as Record<string, unknown>
          const id = typeof o.id === 'string' ? o.id : null
          if (!id) return null
          return { id, xp: Number(o.xp ?? 0) }
        })
        .filter((u): u is NewlyUnlockedBadge => u != null)
    : []
  return {
    already_awarded: Boolean(row.already_awarded),
    xp_awarded: Number(row.xp_awarded ?? 0),
    xp_total: Number(row.xp_total ?? 0),
    streak: Number(row.streak ?? 0),
    cap_hit: Boolean(row.cap_hit),
    concept_id: String(row.concept_id ?? conceptId),
    newly_unlocked,
  }
}

export function ClinicOverlay({
  payload,
  onComplete,
}: {
  payload: ClinicPayload
  onComplete: (xpAwareded: number) => void
}) {
  const [step, setStep] = useState<Step>('read')
  const [picked, setPicked] = useState<(typeof DO_OPTIONS)[number] | null>(null)
  const [doChecked, setDoChecked] = useState(false)
  const [doPassed, setDoPassed] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [awardError, setAwardError] = useState<string | null>(null)
  const [xpGained, setXpGained] = useState<number | null>(null)
  const [capHit, setCapHit] = useState(false)
  const [unlocked, setUnlocked] = useState<NewlyUnlockedBadge[]>([])

  const contentQuery = useQuery({
    queryKey: ['clinic-content', payload.conceptId],
    queryFn: () => fetchClinicContent(payload.conceptId),
  })

  const title =
    contentQuery.data?.concept?.name?.trim() || payload.conceptName

  const readBody = useMemo(() => {
    const guide = contentQuery.data?.guide
    const concept = contentQuery.data?.concept
    if (guide?.read_body?.trim()) return guide.read_body.trim()
    if (concept?.description?.trim()) return concept.description.trim()
    return `Review the core idea behind “${title}”. Focus on definitions, relationships, and when the idea applies in a Science Olympiad setting.`
  }, [contentQuery.data, title])

  const seeBody = useMemo(() => {
    const html = contentQuery.data?.guide?.see_html?.trim()
    if (html) return html
    return null
  }, [contentQuery.data])

  const doQuestion = useMemo(() => {
    const guide = contentQuery.data?.guide
    const opts = guide?.do_options
    const key = guide?.do_correct_key
    const prompt = guide?.do_prompt?.trim()

    if (
      prompt &&
      opts &&
      typeof opts === 'object' &&
      key &&
      DO_OPTIONS.every((k) => typeof opts[k] === 'string' && opts[k])
    ) {
      return {
        stem: prompt,
        options: {
          A: opts.A,
          B: opts.B,
          C: opts.C,
        } as Record<(typeof DO_OPTIONS)[number], string>,
        correct: key as (typeof DO_OPTIONS)[number],
        fromGuide: true,
      }
    }

    return {
      stem: `Quick check — which statement best fits “${title}”?`,
      options: {
        A: `I can explain ${title} in my own words and apply it to a new example.`,
        B: `${title} is unrelated to this event’s official scope.`,
        C: `Memorizing one formula is enough, no conceptual understanding needed.`,
      } as Record<(typeof DO_OPTIONS)[number], string>,
      correct: 'A' as const,
      fromGuide: false,
    }
  }, [contentQuery.data, title])

  useEffect(() => {
    function blockKeys(e: KeyboardEvent) {
      if (step === 'do' && !doPassed) {
        const n = Number(e.key)
        if (n >= 1 && n <= 3) {
          e.preventDefault()
          e.stopPropagation()
          setPicked(DO_OPTIONS[n - 1])
          setDoChecked(false)
          return
        }
        if ((e.key === 'Enter' || e.key === ' ') && picked) {
          e.preventDefault()
          e.stopPropagation()
          setDoChecked(true)
          if (picked === doQuestion.correct) setDoPassed(true)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', blockKeys, true)
    return () => window.removeEventListener('keydown', blockKeys, true)
  }, [step, doPassed, picked, doQuestion.correct])

  function checkDo() {
    if (!picked) return
    setDoChecked(true)
    if (picked === doQuestion.correct) {
      setDoPassed(true)
    }
  }

  async function continueFromDo() {
    if (!doPassed || awarding) return
    setAwarding(true)
    setAwardError(null)
    try {
      const result = await awardClinicDo(
        payload.conceptId,
        payload.sessionToken,
      )
      setXpGained(result.xp_awarded)
      setCapHit(result.cap_hit)
      setUnlocked(result.newly_unlocked)
      onComplete(result.xp_awarded)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not award Clinic XP'
      setAwardError(msg)
      // Still allow return so Arena is not soft-locked if RPC missing
      onComplete(0)
    } finally {
      setAwarding(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinic-title"
    >
      <div className="hud-panel relative flex max-h-[min(90dvh,720px)] w-full max-w-2xl flex-col overflow-hidden border-cyan/40 shadow-[0_0_48px_var(--accent-dim)]">
        <div className="flex shrink-0 items-center justify-between border-b border-subtle px-5 py-3">
          <div>
            <p className="label-caps text-cyan">Clinic interrupt</p>
            <h2 id="clinic-title" className="mt-1 text-lg font-medium text-foreground">
              {title}
            </h2>
          </div>
          <div className="flex gap-1.5">
            {(['read', 'see', 'do'] as Step[]).map((s) => (
              <span
                key={s}
                className={`data-mono rounded-pill px-2.5 py-1 text-[10px] uppercase tracking-wider ${
                  step === s
                    ? 'bg-cyan text-[var(--on-accent)]'
                    : 'bg-surface-high text-dim'
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {contentQuery.isLoading && (
            <p className="text-sm text-muted">Loading clinic materials…</p>
          )}

          {step === 'read' && !contentQuery.isLoading && (
            <div>
              <p className="label-caps mb-3">Read</p>
              <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
                {readBody}
              </p>
            </div>
          )}

          {step === 'see' && (
            <div>
              <p className="label-caps mb-3">See</p>
              {seeBody ? (
                <div
                  className="clinic-see space-y-2 text-sm leading-relaxed text-foreground/85 [&_strong]:text-cyan"
                  dangerouslySetInnerHTML={{ __html: seeBody }}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-cyan/30 bg-cyan/5 px-4 py-8 text-center">
                  <p className="data-mono text-cyan">VISUAL SLOT</p>
                  <p className="mt-3 text-sm text-muted">
                    No SEE content for this concept yet. Mentally picture the
                    key relationship for{' '}
                    <span className="text-foreground">{title}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'do' && (
            <div>
              <p className="label-caps mb-3">Do</p>
              {!doQuestion.fromGuide && (
                <p className="mb-2 text-xs text-dim">
                  Fallback check — seed a live concept guide DO item in Supabase.
                </p>
              )}
              <p className="text-base text-foreground">{doQuestion.stem}</p>
              <div className="mt-4 flex flex-col gap-2">
                {DO_OPTIONS.map((key, i) => {
                  const isPick = picked === key
                  let cls = 'border-subtle hover:border-cyan/50'
                  if (doChecked && key === doQuestion.correct) {
                    cls = 'border-success bg-success/10'
                  } else if (doChecked && isPick && !doPassed) {
                    cls = 'border-alert bg-alert/10'
                  } else if (isPick) {
                    cls = 'border-cyan bg-cyan/10'
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={doPassed}
                      onClick={() => {
                        if (doPassed) return
                        setDoChecked(false)
                        setPicked(key)
                      }}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${cls}`}
                    >
                      <span className="data-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-high text-xs text-muted">
                        {i + 1}
                      </span>
                      <span className="text-sm text-foreground">
                        {doQuestion.options[key]}
                      </span>
                    </button>
                  )
                })}
              </div>
              {doChecked && !doPassed && (
                <p className="mt-3 text-sm text-alert">
                  Not yet — try again, then check.
                </p>
              )}
              {doPassed && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-success">
                    Cleared
                    {xpGained != null
                      ? ` · +${xpGained} XP`
                      : ` · +${XP_AWARDS.clinicDoCompleted} XP on return`}
                    .
                  </p>
                  {capHit && (
                    <p className="text-xs text-dim">
                      Daily practice XP cap reached (200 base).
                    </p>
                  )}
                  {unlocked.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {unlocked.map((u) => {
                        const xp = u.xp || badgeXp(u.id)
                        return (
                          <li
                            key={u.id}
                            className="flex items-center gap-2 rounded-lg border border-cyan/35 bg-cyan/10 px-2.5 py-1.5"
                          >
                            <BadgeMark id={u.id} earned />
                            <span className="text-xs text-foreground">
                              {badgeName(u.id)}
                              {xp > 0 ? (
                                <span className="data-mono text-cyan">
                                  {' '}
                                  · +{xp}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
              {awardError && (
                <p className="mt-2 text-xs text-alert">
                  {awardError} (returning anyway)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-subtle px-5 py-3">
          <p className="text-xs text-dim">Complete DO to resume · Esc blocked</p>
          <div className="flex gap-2">
            {step === 'read' && (
              <button
                type="button"
                onClick={() => setStep('see')}
                className="hud-pill bg-cyan px-5 py-2 text-sm font-bold text-[var(--on-accent)]"
              >
                Next · SEE
              </button>
            )}
            {step === 'see' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('read')}
                  className="hud-pill border border-subtle px-4 py-2 text-sm text-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep('do')}
                  className="hud-pill bg-cyan px-5 py-2 text-sm font-bold text-[var(--on-accent)]"
                >
                  Next · DO
                </button>
              </>
            )}
            {step === 'do' && !doPassed && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('see')}
                  className="hud-pill border border-subtle px-4 py-2 text-sm text-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!picked}
                  onClick={checkDo}
                  className="hud-pill bg-cyan px-5 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-40"
                >
                  Check
                </button>
              </>
            )}
            {step === 'do' && doPassed && (
              <button
                type="button"
                disabled={awarding}
                onClick={() => void continueFromDo()}
                className="hud-pill bg-cyan px-5 py-2 text-sm font-bold text-[var(--on-accent)] shadow-[0_0_18px_var(--cyan-dim)] disabled:opacity-60"
              >
                {awarding ? 'Saving…' : 'Return to Arena'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** In-session miss threshold for a concept given how many Qs of it are in the bank. */
export function clinicMissThreshold(conceptCountInBank: number): number {
  const n = Math.max(0, conceptCountInBank)
  if (n <= 0) return 3
  return Math.min(3, Math.max(1, n))
}
