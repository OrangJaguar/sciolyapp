import { supabase } from './supabase'

export type CasualAnswerPayload = {
  question_id: string
  skipped: boolean
  is_correct: boolean | null
}

export type SubmitCasualSessionResult = {
  already_committed: boolean
  xp_awarded: number
  xp_total: number
  streak: number
  answered: number
  correct: number
  skipped: number
}

export async function submitCasualSession(input: {
  sessionToken: string
  eventId: string
  topicId: string | 'all'
  answers: CasualAnswerPayload[]
}): Promise<SubmitCasualSessionResult> {
  if (!supabase) throw new Error('Supabase not configured')

  const payload = input.answers.map((a) => ({
    question_id: a.question_id,
    skipped: a.skipped,
    is_correct: a.skipped ? false : Boolean(a.is_correct),
  }))

  const { data, error } = await supabase.rpc('submit_casual_session', {
    p_session_token: input.sessionToken,
    p_event_id: input.eventId,
    p_topic_id: input.topicId,
    p_answers: payload,
  })

  if (error) throw error

  const row = data as SubmitCasualSessionResult
  return {
    already_committed: Boolean(row.already_committed),
    xp_awarded: Number(row.xp_awarded ?? 0),
    xp_total: Number(row.xp_total ?? 0),
    streak: Number(row.streak ?? 0),
    answered: Number(row.answered ?? 0),
    correct: Number(row.correct ?? 0),
    skipped: Number(row.skipped ?? 0),
  }
}
