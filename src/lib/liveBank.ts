import { supabase } from './supabase'

export type LiveQuestionRow = {
  event_id: string
  topic_id: string | null
}

const PAGE = 1000

/** Every live question's event and topic. PostgREST returns at most 1000 rows per request. */
export async function fetchLiveQuestionRows(): Promise<LiveQuestionRow[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const rows: LiveQuestionRow[] = []
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await supabase
      .from('questions')
      .select('event_id, topic_id')
      .eq('status', 'live')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const batch = (data ?? []) as LiveQuestionRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}
