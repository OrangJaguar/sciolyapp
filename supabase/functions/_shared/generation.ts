import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type GenerationContext = {
  item: {
    id: string
    job_id: string
    event_id: string
    concept_id: string
    pass: 'A' | 'B' | 'C'
    n_requested: number
    n_outstanding?: number
    n_written?: number
    shortfall_retries?: number
  }
  job: { id: string; config: Record<string, unknown> }
  concept: {
    id: string
    event_id: string
    topic_id: string
    name: string
    description: string
    depth_tags: string[]
  }
  master: { system_body: string }
  event_pack: { system_body: string; few_shots: unknown[] }
  guide: { read_body: string } | null
  media_menu: Array<{ id: string; label: string; description: string; tags: string[] }>
  existing_stems: string[]
}

export type ParsedMcq = {
  stem: string
  options: { A: string; B: string; C: string; D: string }
  correct_key: 'A' | 'B' | 'C' | 'D'
  explanation: string
  citation?: string
  difficulty?: string
  media_id?: string | null
}

export type NimCallResult = {
  content: string
  usage: Record<string, number>
  finishReason: string | null
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const
const MCQ_SCHEMA_KEYS = new Set([
  'stem',
  'options',
  'correct_key',
  'explanation',
  'citation',
  'difficulty',
  'media_id',
])

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service env missing')
  return createClient(url, key)
}

export function createUserClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) throw new Error('Supabase anon env missing')
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })
}

export function isInsideRunWindow(config: Record<string, unknown>): boolean {
  const window = (config.window ?? {}) as Record<string, unknown>
  if (window.enabled === false) return true

  const tz = String(window.tz ?? 'America/Chicago')
  const start = String(window.start ?? '08:00')
  const end = String(window.end ?? '22:00')

  const nowParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const hour = nowParts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = nowParts.find((p) => p.type === 'minute')?.value ?? '00'
  const nowMinutes = Number(hour) * 60 + Number(minute)

  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes
}

/** Strip author-only keys (style_notes, etc.) before few-shots hit the model. */
export function sanitizeFewShots(raw: unknown[]): unknown[] {
  return raw.map((shot) => {
    if (!shot || typeof shot !== 'object') return shot
    const row = shot as Record<string, unknown>
    const cleaned: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      if (MCQ_SCHEMA_KEYS.has(key)) cleaned[key] = row[key]
    }
    return cleaned
  })
}

export function emitCount(ctx: GenerationContext): number {
  const outstanding = ctx.item.n_outstanding
  if (typeof outstanding === 'number' && outstanding > 0) return outstanding
  return Math.max(ctx.item.n_requested, 1)
}

export function buildSystemPrompt(ctx: GenerationContext): string {
  const parts = [
    ctx.master.system_body.trim(),
    ctx.event_pack.system_body.trim(),
  ].filter(Boolean)

  const fewShots = Array.isArray(ctx.event_pack.few_shots)
    ? sanitizeFewShots(ctx.event_pack.few_shots)
    : []
  if (fewShots.length > 0) {
    parts.push(
      'Gold examples from this event pack (match voice and structure, do not copy verbatim):',
      JSON.stringify(fewShots, null, 2),
    )
  }

  return parts.join('\n\n')
}

export function buildUserPrompt(ctx: GenerationContext): string {
  const config = ctx.job.config ?? {}
  const mix = (config.difficultyMix ?? {}) as Record<string, number>
  const easy = mix.easy ?? 20
  const medium = mix.medium ?? 50
  const hard = mix.hard ?? 100 - easy - medium
  const n = emitCount(ctx)
  const shortfallRetries = ctx.item.shortfall_retries ?? 0

  const lines: string[] = [
    'Generate MCQs for exactly this concept:',
    JSON.stringify(
      {
        id: ctx.concept.id,
        name: ctx.concept.name,
        description: ctx.concept.description,
        depth_tags: ctx.concept.depth_tags,
      },
      null,
      2,
    ),
  ]

  if (ctx.guide?.read_body?.trim()) {
    lines.push('Clinic guide excerpt (grounding only):', ctx.guide.read_body.trim())
  }

  if (ctx.media_menu.length > 0) {
    lines.push(
      'Optional media menu (media_id must be one of these ids or null):',
      JSON.stringify(ctx.media_menu, null, 2),
      'Target ~10–20% of items with a valid media_id when a figure genuinely helps.',
    )
  }

  const existingStems = Array.isArray(ctx.existing_stems) ? ctx.existing_stems : []
  if (existingStems.length > 0) {
    const stems = existingStems.map((stem) =>
      typeof stem === 'string' ? stem : String(stem),
    )
    lines.push(
      'Already written for this concept (do NOT paraphrase, clone, or closely imitate):',
      ...stems.slice(0, 30).map((stem, i) => `${i + 1}. ${stem}`),
      [
        'Novelty rules:',
        '- Use a different question angle / skill slice than the stems above',
          '(definition vs mechanism vs calc setup vs error analysis vs graph/data vs compare/contrast).',
        '- Do not reuse the same scenario numbers, apparatus setup, or trap family as any listed stem.',
        '- Near-paraphrases will be rejected — invent genuinely new items.',
      ].join('\n'),
    )
  }

  if (shortfallRetries > 0) {
    lines.push(
      `Shortfall retry ${shortfallRetries}/2: prior call under-delivered or near-duplicates were rejected.`,
      `Emit exactly ${n} NEW MCQs only. New angles only — do not repeat prior stems.`,
    )
  }

  lines.push(
    `Pass ${ctx.item.pass}: emit exactly ${n} MCQs as a JSON array.`,
    `Difficulty mix target: ~${easy}% easy, ~${medium}% medium, ~${hard}% hard.`,
    'Each object MUST include: stem, options {A,B,C,D}, correct_key, explanation, citation, difficulty, media_id.',
    'Vary correct_key across A/B/C/D in the batch (do not always use B). Options will also be shuffled server-side.',
    [
      'Citation quality: use a credible textbook-style source string, e.g.',
      '"Zumdahl, Chemical Principles, 8th ed., Ch. 12 — Collision theory"',
      'or "OpenStax Chemistry 2e, §12.5 — Collision theory".',
      'Never use bare concept names alone (e.g. not just "Collision theory of reaction rates").',
      'Do not invent URLs, DOIs, or page numbers you cannot support; author + title + chapter/section is enough.',
    ].join(' '),
    [
      'CRITICAL output discipline (token budget):',
      '- Output the JSON array only. Never narrate, brainstorm, or revise mid-item.',
      '- Never write phrases like "Wait", "recalc", "Let me", "I think", "Error in setup", "revised stem", or "abandon" inside any field.',
      '- Design stem numbers so the correct answer matches an option BEFORE writing the object.',
      '- If a calc does not land cleanly on an option: omit that item and write a different clean item — do NOT rewrite the stem inside explanation.',
      '- explanation = 1–3 short sentences max. No multi-paragraph essays.',
    ].join(' '),
    'Output JSON array only. No markdown fences. No commentary outside the array.',
    'Strip author-only fields like style_notes.',
  )

  return lines.join('\n\n')
}

export function extractJsonArray(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed)
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim())
  }

  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1))
  }

  throw new Error('Model output did not contain a JSON array')
}

export function parseMcq(raw: unknown): ParsedMcq | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const optionsRaw = row.options
  if (!optionsRaw || typeof optionsRaw !== 'object') return null

  const options = optionsRaw as Record<string, unknown>
  const parsedOptions = {} as ParsedMcq['options']
  for (const key of OPTION_KEYS) {
    const value = options[key] ?? options[key.toLowerCase()]
    if (typeof value !== 'string' || !value.trim()) return null
    parsedOptions[key] = value.trim()
  }

  const correct = String(row.correct_key ?? '').trim().toUpperCase()
  if (!OPTION_KEYS.includes(correct as (typeof OPTION_KEYS)[number])) return null

  const stem = String(row.stem ?? '').trim()
  const explanation = String(row.explanation ?? '').trim()
  if (!stem || !explanation) return null

  // Reject chain-of-thought dumps that burn tokens and poison the bank
  if (explanation.length > 600) return null
  if (
    /\b(wait,? recalc|let me |i think|error in setup|revised stem|abandon|i give up|overcomplicating|start over|as an ai)\b/i
      .test(explanation)
  ) {
    return null
  }

  return {
    stem,
    options: parsedOptions,
    correct_key: correct as ParsedMcq['correct_key'],
    explanation,
    citation: typeof row.citation === 'string' ? row.citation.trim() : undefined,
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : undefined,
    media_id: sanitizeMediaId(row.media_id),
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function sanitizeMediaId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const value = String(raw).trim()
  if (!value || value.toLowerCase() === 'null') return null
  return UUID_RE.test(value) ? value : null
}

export async function callNim(
  systemPrompt: string,
  userPrompt: string,
  usePro = false,
): Promise<NimCallResult> {
  const apiKey = Deno.env.get('NVIDIA_NIM_API_KEY')
  const baseUrl = Deno.env.get('NVIDIA_NIM_BASE_URL') ?? 'https://integrate.api.nvidia.com/v1'
  const flashModel =
    Deno.env.get('NVIDIA_NIM_FLASH_MODEL') ?? 'nvidia/nemotron-3-super-120b-a12b'
  const proModel =
    Deno.env.get('NVIDIA_NIM_PRO_MODEL') ?? flashModel

  if (!apiKey) {
    throw new Error('NVIDIA_NIM_API_KEY is not set in Edge Function secrets')
  }

  const model = usePro ? proModel : flashModel
  const controller = new AbortController()
  const timeoutMs = Number(Deno.env.get('NVIDIA_NIM_TIMEOUT_MS') ?? 120_000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 16384,
        temperature: 0.45,
        chat_template_kwargs: { enable_thinking: false },
      }),
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`NIM timeout after ${timeoutMs}ms`)
    }
    throw err
  }
  clearTimeout(timer)

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`NIM ${response.status}: ${body.slice(0, 500)}`)
  }

  const json = JSON.parse(body) as {
    choices?: Array<{
      message?: { content?: string }
      finish_reason?: string
    }>
    usage?: Record<string, number>
  }
  const choice = json.choices?.[0]
  const content = choice?.message?.content
  if (!content) throw new Error('NIM returned empty content')

  return {
    content,
    usage: json.usage ?? {},
    finishReason: choice?.finish_reason ?? null,
  }
}

export type VisionImage = {
  mimeType: string
  /** Raw base64 without data: prefix, OR a https URL */
  data: string
  kind: 'base64' | 'url'
}

/** Multimodal NIM call (MiniMax M3 etc.). */
export async function callNimVision(
  systemPrompt: string,
  userText: string,
  images: VisionImage[],
  opts?: { maxTokens?: number },
): Promise<NimCallResult> {
  const apiKey = Deno.env.get('NVIDIA_NIM_API_KEY')
  const baseUrl = Deno.env.get('NVIDIA_NIM_BASE_URL') ?? 'https://integrate.api.nvidia.com/v1'
  const model =
    Deno.env.get('NVIDIA_NIM_VISION_MODEL') ??
    Deno.env.get('NVIDIA_NIM_FLASH_MODEL') ??
    'minimaxai/minimax-m3'

  if (!apiKey) {
    throw new Error('NVIDIA_NIM_API_KEY is not set in Edge Function secrets')
  }
  if (images.length === 0) {
    throw new Error('callNimVision requires at least one image')
  }

  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: userText },
  ]
  for (const img of images) {
    const url =
      img.kind === 'url'
        ? img.data
        : `data:${img.mimeType};base64,${img.data}`
    content.push({
      type: 'image_url',
      image_url: { url },
    })
  }

  const controller = new AbortController()
  const timeoutMs = Number(Deno.env.get('NVIDIA_NIM_TIMEOUT_MS') ?? 90_000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: 0.3,
        chat_template_kwargs: { thinking_mode: 'disabled' },
      }),
    })
  } catch (err) {
    clearTimeout(timer)
    const name =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name: unknown }).name)
        : ''
    if (name === 'AbortError') {
      throw new Error(`NIM vision timeout after ${timeoutMs}ms`)
    }
    throw err
  }
  clearTimeout(timer)

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`NIM vision ${response.status}: ${body.slice(0, 500)}`)
  }

  const json = JSON.parse(body) as {
    choices?: Array<{
      message?: { content?: string }
      finish_reason?: string
    }>
    usage?: Record<string, number>
  }
  const choice = json.choices?.[0]
  const contentOut = choice?.message?.content
  if (!contentOut) throw new Error('NIM vision returned empty content')

  return {
    content: contentOut,
    usage: json.usage ?? {},
    finishReason: choice?.finish_reason ?? null,
  }
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1].trim() : trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('No JSON object found in model output')
  }
  return JSON.parse(raw.slice(start, end + 1))
}

export async function repairJson(
  broken: string,
  errorMessage: string,
): Promise<string> {
  const { content } = await callNim(
    'You repair invalid JSON arrays for a quiz generator. Return JSON array only.',
    `Fix this broken output into a valid JSON array of MCQ objects.\nError: ${errorMessage}\n\n${broken.slice(0, 12000)}`,
    true,
  )
  return content
}
