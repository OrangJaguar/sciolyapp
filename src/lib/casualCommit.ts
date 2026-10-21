import {
  parsePracticeCommitResult,
  type PracticeSessionCommitResult,
} from './practiceCommit'
import { supabase } from './supabase'
import { clientTimezone } from './timezone'

export type CasualAnswerPayload = {
  question_id: string
  skipped: boolean
  is_correct: boolean | null
  /** Wall time from question shown → Check/Skip; null when skipped without timing. */
  response_ms: number | null
}

export type SubmitCasualSessionResult = PracticeSessionCommitResult

export async function submitCasualSession(input: {
  sessionToken: string
  eventId: string
  topicId: string | 'all'
  answers: CasualAnswerPayload[]
  timezone?: string
}): Promise<SubmitCasualSessionResult> {
  if (!supabase) throw new Error('Supabase not configured')

  const payload = input.answers.map((a) => ({
    question_id: a.question_id,
    skipped: a.skipped,
    is_correct: a.skipped ? false : Boolean(a.is_correct),
    response_ms: a.skipped ? null : a.response_ms,
  }))

  const { data, error } = await supabase.rpc('submit_casual_session', {
    p_session_token: input.sessionToken,
    p_event_id: input.eventId,
    p_topic_id: input.topicId,
    p_answers: payload,
    p_timezone: input.timezone ?? clientTimezone(),
  })

  if (error) throw error
  return parsePracticeCommitResult(data)
}
