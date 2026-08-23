import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  callNim,
  createUserClient,
  extractJsonArray,
} from '../_shared/generation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CriticVerdict = {
  id: string
  score: number
  route: 'auto_live' | 'human' | 'reject_regen'
  notes: string
  hard_fail?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const limit = Math.min(Math.max(Number(body.limit ?? 6) || 6, 1), 12)
    const supabase = createUserClient(authHeader)

    const { data: claimed, error: claimError } = await supabase.rpc(
      'admin_critic_claim_batch',
      { p_limit: limit },
    )

    if (claimError) {
      return json({ error: claimError.message }, 500)
    }

    const rows = (claimed ?? []) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      return json({ processed: 0, idle: true, routes: {} })
    }

    const softRejects: CriticVerdict[] = []
    const toModel: Array<Record<string, unknown>> = []

    for (const row of rows) {
      const lint = softLint(row)
      if (lint.hard_fail) {
        softRejects.push({
          id: String(row.id),
          score: 0.15,
          route: 'reject_regen',
          notes: `Structural fail: ${lint.flags.join(', ')}`,
          hard_fail: true,
        })
      } else {
        toModel.push(row)
      }
    }

    const modelVerdicts =
      toModel.length > 0 ? await runLenientCritic(toModel) : []

    const all = [...softRejects, ...modelVerdicts]
    const routes: Record<string, number> = {
      auto_live: 0,
      human: 0,
      reject_regen: 0,
    }

    for (const verdict of all) {
      const route = enforceLenientRoute(verdict)
      const audit = route === 'auto_live' && Math.random() < 0.02

      const { error } = await supabase.rpc('admin_apply_critic_result', {
        p_question_id: verdict.id,
        p_score: verdict.score,
        p_notes: verdict.notes,
        p_route: route,
        p_audit: audit,
      })

      if (error) {
        return json({ error: error.message, partial: routes }, 500)
      }
      routes[route] = (routes[route] ?? 0) + 1
    }

    return json({
      processed: all.length,
      idle: false,
      routes,
      claimed: rows.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Critic worker failed'
    return json({ error: message }, 500)
  }
})

function softLint(row: Record<string, unknown>): {
  flags: string[]
  hard_fail: boolean
} {
  const flags: string[] = []
  const stem = String(row.stem ?? '').trim()
  const expl = String(row.explanation ?? '').trim()
  const key = String(row.correct_key ?? '').trim().toUpperCase()
  const options = (row.options ?? {}) as Record<string, unknown>

  if (stem.length < 12) flags.push('short_stem')
  if (expl.length < 8) flags.push('short_explanation')
  if (!['A', 'B', 'C', 'D'].includes(key)) flags.push('bad_key')
  else if (!String(options[key] ?? '').trim()) flags.push('key_missing_option')
  for (const k of ['A', 'B', 'C', 'D']) {
    if (!String(options[k] ?? '').trim()) flags.push('empty_option')
  }
  if (
    /\b(wait,? recalc|let me |revised stem|abandon|as an ai|overcomplicating)\b/i.test(
      expl,
    )
  ) {
    flags.push('cot_leak')
  }

  const hard_fail =
    flags.includes('bad_key') ||
    flags.includes('key_missing_option') ||
    flags.includes('empty_option') ||
    flags.includes('cot_leak') ||
    flags.includes('short_stem')

  return { flags: [...new Set(flags)], hard_fail }
}

function enforceLenientRoute(
  verdict: CriticVerdict,
): 'auto_live' | 'human' | 'reject_regen' {
  if (verdict.hard_fail) return 'reject_regen'
  if (verdict.route === 'reject_regen' && verdict.score < 0.25) {
    return 'reject_regen'
  }
  if (verdict.score < 0.35) return 'human'
  if (verdict.route === 'human' && verdict.score >= 0.45) return 'auto_live'
  if (verdict.route === 'human' && verdict.score < 0.45) return 'human'
  return 'auto_live'
}

async function runLenientCritic(
  rows: Array<Record<string, unknown>>,
): Promise<CriticVerdict[]> {
  const payload = rows.map((row) => ({
    id: row.id,
    event_id: row.event_id,
    concept_id: row.concept_id,
    stem: row.stem,
    options: row.options,
    correct_key: row.correct_key,
    explanation: String(row.explanation ?? '').slice(0, 500),
    citation: row.citation,
  }))

  const system = [
    'You are a lenient Science Olympiad MCQ critic for a practice app.',
    'DEFAULT TO PASS. Auto-publish anything that is decent student practice.',
    'Only escalate when you would NOT trust a student to see this item.',
    'Be relatively positive. Grammar quirks, mild awkwardness, and imperfect citations are OK.',
    'Human queue must stay tiny (~2–3%). Reject only unusable junk.',
    'Return a JSON array only — one object per input id.',
    'Each object: { "id": "<uuid>", "score": 0-1, "route": "auto_live"|"human"|"reject_regen", "notes": "short reason" }',
    'Score guide: ≥0.45 → auto_live; 0.25–0.45 → human only if clearly wrong answer or nonsense; <0.25 → reject_regen.',
    'Prefer auto_live when unsure.',
  ].join('\n')

  const user = `Review these draft MCQs. Prefer auto_live.\n\n${JSON.stringify(payload)}`

  const nim = await callNim(system, user, false)
  let raw: unknown
  try {
    raw = extractJsonArray(nim.content)
  } catch {
    return rows.map((row) => ({
      id: String(row.id),
      score: 0.7,
      route: 'auto_live' as const,
      notes: 'Critic parse failed — defaulted to auto_live (lenient)',
    }))
  }

  if (!Array.isArray(raw)) {
    return rows.map((row) => ({
      id: String(row.id),
      score: 0.7,
      route: 'auto_live' as const,
      notes: 'Critic non-array — defaulted to auto_live',
    }))
  }

  const byId = new Map<string, CriticVerdict>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = String(row.id ?? '')
    if (!id) continue
    let route = String(row.route ?? 'auto_live').toLowerCase()
    if (route !== 'auto_live' && route !== 'human' && route !== 'reject_regen') {
      route = 'auto_live'
    }
    const score = Math.min(1, Math.max(0, Number(row.score) || 0.7))
    byId.set(id, {
      id,
      score,
      route: route as CriticVerdict['route'],
      notes: String(row.notes ?? '').slice(0, 800) || 'ok',
    })
  }

  return rows.map((row) => {
    const id = String(row.id)
    return (
      byId.get(id) ?? {
        id,
        score: 0.7,
        route: 'auto_live' as const,
        notes: 'Missing critic row — defaulted to auto_live',
      }
    )
  })
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
