import { supabase } from './supabase'
import type { Question, QuestionOptions } from './types'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const
const ADMIN_SELECT =
  'id, event_id, topic_id, concept_id, question_type, status, stem, options, correct_key, explanation, citation, created_at'

export type AdminQuestion = Question & {
  citation: string
  created_at: string
}

export type AdminQuestionPatch = {
  stem: string
  options: QuestionOptions
  correct_key: Question['correct_key']
  explanation: string
  topic_id: string | null
  concept_id: string | null
}

function normalizeOptions(raw: unknown): QuestionOptions | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  for (const k of OPTION_KEYS) {
    if (typeof o[k] !== 'string' || !o[k]) return null
  }
  return { A: o.A as string, B: o.B as string, C: o.C as string, D: o.D as string }
}

function parseAdminQuestion(row: Record<string, unknown>): AdminQuestion | null {
  const options = normalizeOptions(row.options)
  const key = row.correct_key as Question['correct_key']
  if (!options || !OPTION_KEYS.includes(key)) return null
  return {
    id: row.id as string,
    event_id: row.event_id as string,
    topic_id: (row.topic_id as string | null) ?? null,
    concept_id: (row.concept_id as string | null) ?? null,
    question_type: row.question_type as Question['question_type'],
    status: row.status as Question['status'],
    stem: row.stem as string,
    options,
    correct_key: key,
    explanation: (row.explanation as string) ?? '',
    citation: (row.citation as string) ?? '',
    created_at: row.created_at as string,
  }
}

export async function fetchDraftQueue(): Promise<AdminQuestion[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('questions')
    .select(ADMIN_SELECT)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
  if (error) throw error
  const out: AdminQuestion[] = []
  for (const row of data ?? []) {
    const q = parseAdminQuestion(row as Record<string, unknown>)
    if (q) out.push(q)
  }
  return out
}

export async function saveDraftQuestion(
  id: string,
  patch: AdminQuestionPatch,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('questions')
    .update({
      stem: patch.stem.trim(),
      options: patch.options,
      correct_key: patch.correct_key,
      explanation: patch.explanation.trim(),
      topic_id: patch.topic_id,
      concept_id: patch.concept_id,
    })
    .eq('id', id)
  if (error) throw error
}

export async function setQuestionStatus(
  id: string,
  status: 'draft' | 'live' | 'archived',
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('questions')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function fetchEventNameMap(): Promise<Map<string, string>> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('taxonomy_events')
    .select('id, name')
  if (error) throw error
  return new Map((data ?? []).map((e) => [e.id as string, e.name as string]))
}

export function adminErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Request failed'
  const msg = err.message
  if (/permission|policy|row-level/i.test(msg)) {
    return 'Admin write denied — set platform_role=admin and run SCIOLY-0804-ADMIN SQL'
  }
  return msg
}
