import { supabase } from './supabase'
import type { CatalogConcept } from './adminCatalog'

export type ImportDraftRow = {
  stem: string
  options: { A: string; B: string; C: string; D: string }
  correct_key: 'A' | 'B' | 'C' | 'D'
  explanation: string
  concept_id: string
}

export type ImportSource = 'paste' | 'pdf'

export type ImportBatch = {
  id: string
  event_id: string
  source: ImportSource | 'csv' | 'json'
  label: string
  row_count: number
  status: 'committed' | 'archived'
  created_at: string
  archived_at: string | null
}

export type CommitImportResult = {
  batch_id: string
  imported: number
  skipped: number
  citation: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

/** Rough token estimate for display (chars/4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Client-side PDF text extract (no OCR). */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default

  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) parts.push(line)
  }

  return parts.join('\n\n')
}

/** Local keyword overlap → top concept suggestions (no API). */
export function suggestConcepts(
  stem: string,
  concepts: CatalogConcept[],
  limit = 3,
): CatalogConcept[] {
  const tokens = stem
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3)
  if (tokens.length === 0) return concepts.slice(0, limit)

  const scored = concepts.map((c) => {
    const hay =
      `${c.name} ${c.id} ${(c.description ?? '')} ${(c.depth_tags ?? []).join(' ')}`.toLowerCase()
    let score = 0
    for (const t of tokens) {
      if (hay.includes(t)) score += 1
    }
    return { c, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c)
}

/**
 * Parse pasted practice-test text into draft rows (keys may be blank until Answers: pass).
 */
export function parsePasteMcq(raw: string): ImportDraftRow[] {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const answerMap = new Map<number, 'A' | 'B' | 'C' | 'D'>()
  const answersMatch = text.match(/answers?\s*[:\-]?\s*([\s\S]+)$/i)
  const body = answersMatch ? text.slice(0, answersMatch.index).trim() : text
  if (answersMatch) {
    const chunk = answersMatch[1]
    const pairs = chunk.matchAll(/(\d+)\s*[.:)\-]?\s*([A-Da-d])/g)
    for (const m of pairs) {
      answerMap.set(Number(m[1]), m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D')
    }
  }

  const blocks = body.split(/\n(?=\s*\d+[.)]\s+)/)
  const rows: ImportDraftRow[] = []

  for (const block of blocks) {
    const m = block.match(/^\s*(\d+)[.)]\s*([\s\S]+)$/)
    if (!m) continue
    const num = Number(m[1])
    const rest = m[2].trim()
    const optRe = /(?:^|\n)\s*([A-Da-d])[).:\-]\s*/g
    const indices: Array<{ key: string; start: number; bodyStart: number }> = []
    let match: RegExpExecArray | null
    while ((match = optRe.exec(rest)) !== null) {
      indices.push({
        key: match[1].toUpperCase(),
        start: match.index,
        bodyStart: match.index + match[0].length,
      })
    }

    if (indices.length < 4) continue

    const stem = rest.slice(0, indices[0].start).trim()
    const options = { A: '', B: '', C: '', D: '' } as ImportDraftRow['options']
    for (let i = 0; i < indices.length && i < 4; i += 1) {
      const key = indices[i].key as keyof typeof options
      if (!['A', 'B', 'C', 'D'].includes(key)) continue
      const end = i + 1 < indices.length ? indices[i + 1].start : rest.length
      options[key] = rest.slice(indices[i].bodyStart, end).trim()
    }

    if (!options.A || !options.B || !options.C || !options.D || !stem) continue

    const key = answerMap.get(num) ?? 'A'
    rows.push({
      stem,
      options,
      correct_key: key,
      explanation: 'Imported practice item.',
      concept_id: '',
    })
  }

  return rows
}

export function validateImportRows(
  rows: ImportDraftRow[],
  eventId: string,
  concepts: CatalogConcept[],
): { ok: ImportDraftRow[]; errors: string[] } {
  const allowed = new Set(
    concepts.filter((c) => c.event_id === eventId).map((c) => c.id),
  )
  const ok: ImportDraftRow[] = []
  const errors: string[] = []

  rows.forEach((row, i) => {
    const n = i + 1
    if (!row.stem.trim()) {
      errors.push(`Row ${n}: empty stem`)
      return
    }
    if (!row.options.A || !row.options.B || !row.options.C || !row.options.D) {
      errors.push(`Row ${n}: missing options`)
      return
    }
    if (!['A', 'B', 'C', 'D'].includes(row.correct_key)) {
      errors.push(`Row ${n}: bad correct_key`)
      return
    }
    if (!row.concept_id || !allowed.has(row.concept_id)) {
      errors.push(`Row ${n}: pick a concept for this event`)
      return
    }
    ok.push(row)
  })

  return { ok, errors }
}

export async function commitImportBatch(input: {
  eventId: string
  source: ImportSource
  label: string
  rows: ImportDraftRow[]
}): Promise<CommitImportResult> {
  const payload = input.rows.map((r) => ({
    stem: r.stem,
    options: r.options,
    correct_key: r.correct_key,
    explanation: r.explanation,
    concept_id: r.concept_id,
  }))
  const { data, error } = await requireSupabase().rpc('admin_commit_import_batch', {
    p_event_id: input.eventId,
    p_source: input.source,
    p_label: input.label,
    p_rows: payload,
  })
  if (error) throw error
  const row = data as CommitImportResult
  return {
    batch_id: String(row.batch_id),
    imported: Number(row.imported),
    skipped: Number(row.skipped),
    citation: String(row.citation),
  }
}

export async function fetchImportBatches(): Promise<ImportBatch[]> {
  const { data, error } = await requireSupabase()
    .from('import_batches')
    .select('id, event_id, source, label, row_count, status, created_at, archived_at')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return (data ?? []) as ImportBatch[]
}

export async function archiveImportBatch(batchId: string): Promise<number> {
  const { data, error } = await requireSupabase().rpc('admin_archive_import_batch', {
    p_batch_id: batchId,
  })
  if (error) throw error
  return Number(data ?? 0)
}
